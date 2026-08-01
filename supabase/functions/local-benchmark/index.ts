// Supabase Edge Function — local-benchmark
//
// Measures a prospect's nearest same-category neighbours so the pitch can be
// comparative instead of abstract.
//
// "Your site has no HTTPS" makes a small business owner shrug. "Five of the six
// nearest cafés have HTTPS and yours doesn't" books a meeting. The difference
// is entirely in having measured the neighbours — which is the one thing a
// chat assistant cannot do for them.
//
// Deploy: supabase functions deploy local-benchmark

import { createClient } from "jsr:@supabase/supabase-js@2";
import { json, preflight, requireUser, AuthError } from "../_shared/http.ts";
import { measureAll } from "../_shared/measure.ts";

const OVERPASS = "https://overpass-api.de/api/interpreter";

const MAX_PEERS = 8;          // each peer costs a fetch; keep a scan affordable
const SEARCH_RADIUS_M = 2500; // "round here" for a high-street business
const WIDE_RADIUS_M = 8000;   // fallback for rural / sparse areas

// Rate limited alongside the other measurement work.
const LIMIT_PER_MINUTE = 4;
const LIMIT_PER_DAY = 60;

/**
 * Which OSM tag identifies this kind of business.
 *
 * We match on the raw tag rather than our friendly label, because the label is
 * lossy — "Café" and "Coffee Shop" both come from `amenity=cafe`.
 */
function tagFilter(osmTagKey: string, osmTagValue: string, radius: number, lat: number, lon: number) {
  const around = `(around:${radius},${lat},${lon})`;
  return `[out:json][timeout:20];
(
  node["name"]["${osmTagKey}"="${osmTagValue}"]${around};
  way["name"]["${osmTagKey}"="${osmTagValue}"]${around};
);
out body center ${MAX_PEERS * 4};`;
}

async function fetchPeers(key: string, value: string, lat: number, lon: number, radius: number) {
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(tagFilter(key, value, radius, lat, lon)),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`Map service returned ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.elements) ? data.elements : [];
}

/** Great-circle distance in metres — used to rank "nearest". */
function distanceM(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371000;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLon = (bLon - aLon) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let profile;
  try {
    profile = await requireUser(req, supabase);
  } catch (err) {
    if (err instanceof AuthError) return json(req, { error: err.message }, err.status);
    throw err;
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Body must be JSON" }, 400);
  }

  const lat = Number(body.lat);
  const lon = Number(body.lon);
  const tagKey = String(body.osmTagKey || "");
  const tagValue = String(body.osmTagValue || "");
  const leadId = body.leadId ? String(body.leadId) : null;

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return json(req, { error: "This lead has no location on record, so we can't find its neighbours." }, 400);
  }
  if (!/^[a-z_]{2,30}$/.test(tagKey) || !/^[a-z0-9_:;-]{2,40}$/.test(tagValue)) {
    // The tag goes straight into an Overpass query — keep it to known shapes.
    return json(req, { error: "Unknown business category for comparison." }, 400);
  }

  const { data: rate, error: rateErr } = await supabase.rpc("record_ai_call", {
    p_user_id: profile.id,
    p_task: "local_benchmark",
    p_limit_minute: LIMIT_PER_MINUTE,
    p_limit_day: LIMIT_PER_DAY,
  });
  if (rateErr) {
    console.error("record_ai_call failed:", rateErr.message);
    return json(req, { error: "Usage tracking unavailable, try again shortly." }, 503);
  }
  if (rate && rate.allowed === false) {
    return json(req, {
      error: rate.reason === "minute"
        ? "Too many comparisons at once — wait a moment."
        : "Daily comparison limit reached. It resets at midnight UTC.",
      retryAfter: rate.retry_after_seconds ?? 60,
    }, 429);
  }

  try {
    let radius = SEARCH_RADIUS_M;
    let elements = await fetchPeers(tagKey, tagValue, lat, lon, radius);

    // Rural high streets are thin; widen once rather than report "no peers".
    if (elements.length < 3) {
      radius = WIDE_RADIUS_M;
      elements = await fetchPeers(tagKey, tagValue, lat, lon, radius);
    }

    const peers = elements
      .map((el: any) => {
        const pLat = el.lat ?? el.center?.lat;
        const pLon = el.lon ?? el.center?.lon;
        const site = el.tags?.website || el.tags?.["contact:website"] || null;
        if (pLat == null || pLon == null) return null;
        const d = distanceM(lat, lon, Number(pLat), Number(pLon));
        // Anything within ~25m is almost certainly the prospect themselves.
        if (d < 25) return null;
        return { name: el.tags?.name as string, website: site as string | null, distanceM: Math.round(d) };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.distanceM - b.distanceM)
      .slice(0, MAX_PEERS);

    if (peers.length === 0) {
      return json(req, {
        benchmark: {
          sampleSize: 0,
          radiusM: radius,
          peers: [],
          measuredAt: new Date().toISOString(),
          note: "No comparable businesses found nearby.",
        },
      });
    }

    // Measure only the ones that actually have a site; a peer with no website
    // is still a data point (it counts against "everyone round here has one").
    const withSites = peers.filter((p: any) => p.website);
    const measurements = withSites.length
      ? await measureAll(withSites.map((p: any) => p.website))
      : [];

    const measuredByUrl = new Map<string, any>();
    measurements.forEach((m, i) => { if (m) measuredByUrl.set(withSites[i].website, m); });

    const benchmark = {
      sampleSize: peers.length,
      radiusM: radius,
      measuredAt: new Date().toISOString(),
      peers: peers.map((p: any) => ({
        name: p.name,
        distanceM: p.distanceM,
        hasWebsite: !!p.website,
        measurement: p.website ? measuredByUrl.get(p.website) ?? null : null,
      })),
    };

    if (leadId) {
      await supabase
        .from("leads")
        .update({ benchmark, benchmarked_at: benchmark.measuredAt })
        .eq("id", leadId)
        .eq("user_id", profile.id);
    }

    return json(req, { benchmark });
  } catch (err) {
    console.error("local-benchmark failed:", err);
    return json(req, { error: "Couldn't reach the map service. Try again shortly." }, 502);
  }
});

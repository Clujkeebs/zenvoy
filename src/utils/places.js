/* ── places.js — Real business lookup via OpenStreetMap ─────────────────
 *
 * Two free, no-key APIs:
 *   Nominatim  — geocodes "Austin, TX, United States" → bounding box
 *   Overpass   — returns real businesses within that bounding box
 *
 * The AI layer in ai.js then *analyses* these real businesses instead of
 * inventing fake ones.
 * ─────────────────────────────────────────────────────────────────────── */

const NOMINATIM = "https://nominatim.openstreetmap.org/search"
const OVERPASS  = "https://overpass-api.de/api/interpreter"

/* ── OSM tag → friendly business-type label ──────────────────────────── */

const TAG_MAP = {
  // amenity
  "amenity:restaurant":   "Restaurant",
  "amenity:dentist":      "Dental Practice",
  "amenity:doctors":      "Medical Clinic",
  "amenity:pharmacy":     "Pharmacy",
  "amenity:gym":          "Fitness Gym",
  "amenity:bar":          "Bar",
  "amenity:pub":          "Pub",
  "amenity:cafe":         "Café",
  "amenity:fast_food":    "Fast Food Restaurant",
  "amenity:spa":          "Day Spa",
  "amenity:beauty":       "Beauty Salon",
  "amenity:veterinary":   "Veterinary Clinic",
  "amenity:bank":         "Bank",
  "amenity:car_wash":     "Car Wash",
  "amenity:car_rental":   "Car Rental",
  "amenity:school":       "School",
  "amenity:childcare":    "Childcare Center",
  "amenity:kindergarten": "Daycare Center",
  "amenity:tattoo":       "Tattoo Studio",
  "amenity:studio":       "Studio",
  // shop
  "shop:hairdresser":     "Hair Salon",
  "shop:beauty":          "Beauty Salon",
  "shop:bakery":          "Bakery",
  "shop:florist":         "Florist",
  "shop:car_repair":      "Auto Repair Shop",
  "shop:optician":        "Optician",
  "shop:pet":             "Pet Store",
  "shop:clothes":         "Clothing Store",
  "shop:furniture":       "Furniture Store",
  "shop:electronics":     "Electronics Store",
  "shop:hardware":        "Hardware Store",
  "shop:garden_centre":   "Garden Center",
  "shop:photo":           "Photography Studio",
  "shop:massage":         "Massage Studio",
  "shop:tattoo":          "Tattoo Studio",
  "shop:jewelry":         "Jewelry Store",
  "shop:dry_cleaning":    "Dry Cleaner",
  "shop:laundry":         "Laundromat",
  "shop:bicycle":         "Bike Shop",
  "shop:mobile_phone":    "Phone Repair Shop",
  "shop:computer":        "Computer Repair",
  "shop:books":           "Bookstore",
  "shop:sports":          "Sports Store",
  "shop:toys":            "Toy Store",
  "shop:travel_agency":   "Travel Agency",
  "shop:copyshop":        "Print Shop",
  // office
  "office:lawyer":        "Law Office",
  "office:accountant":    "Accounting Firm",
  "office:real_estate":   "Real Estate Agency",
  "office:estate_agent":  "Real Estate Agency",
  "office:financial":     "Financial Services",
  "office:insurance":     "Insurance Agency",
  "office:travel_agent":  "Travel Agency",
  "office:it":            "Tech Company",
  "office:architect":     "Architecture Firm",
  "office:therapist":     "Therapy Practice",
  "office:physician":     "Medical Practice",
  "office:company":       "Business",
  // craft
  "craft:plumber":        "Plumbing Company",
  "craft:electrician":    "Electrical Contractor",
  "craft:carpenter":      "Carpentry",
  "craft:painter":        "Painting Company",
  "craft:roofer":         "Roofing Contractor",
  "craft:landscaper":     "Landscaping Company",
  "craft:photographer":   "Photography Studio",
  "craft:hvac":           "HVAC Company",
  // healthcare
  "healthcare:dentist":         "Dental Practice",
  "healthcare:doctor":          "Medical Clinic",
  "healthcare:optometrist":     "Optometrist",
  "healthcare:physiotherapist": "Physiotherapy Clinic",
  "healthcare:chiropractor":    "Chiropractic Clinic",
  // leisure
  "leisure:fitness_centre": "Fitness Gym",
  "leisure:sports_centre":  "Sports Center",
  "leisure:dance":          "Dance Studio",
  "leisure:yoga":           "Yoga Studio",
  "leisure:swimming_pool":  "Swimming Pool",
}

const TAG_PRIORITY = ["amenity", "shop", "office", "craft", "healthcare", "leisure", "tourism"]

function tagToBtype(tags) {
  for (const key of TAG_PRIORITY) {
    const val = tags[key]
    if (!val || val === "yes") continue
    const mapped = TAG_MAP[key + ":" + val]
    if (mapped) return mapped
    // Graceful fallback: title-case the raw value
    return val.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  }
  return "Local Business"
}

/* ── Bounding-box helpers ─────────────────────────────────────────────── */

/**
 * Clamp a Nominatim bounding box to ±maxDeg/2 around its centre.
 * Prevents enormous country/state bboxes from timing out Overpass.
 */
function clampBbox(south, north, west, east, maxDeg = 0.35) {
  const s = parseFloat(south), n = parseFloat(north)
  const w = parseFloat(west),  e = parseFloat(east)
  const clat = (s + n) / 2
  const clon = (w + e) / 2
  const dlat = Math.min((n - s) / 2, maxDeg / 2)
  const dlon = Math.min((e - w) / 2, maxDeg / 2)
  return {
    south: (clat - dlat).toFixed(6),
    north: (clat + dlat).toFixed(6),
    west:  (clon - dlon).toFixed(6),
    east:  (clon + dlon).toFixed(6),
  }
}

/* ── Nominatim geocoding ──────────────────────────────────────────────── */

async function geocodeLocation(city, country) {
  const q = encodeURIComponent(city ? `${city}, ${country}` : country)
  const url = `${NOMINATIM}?q=${q}&format=json&limit=1&addressdetails=0`

  let res
  try {
    res = await fetch(url, { headers: { "Accept-Language": "en" } })
  } catch {
    throw new Error("Geocoding unavailable — check your internet connection.")
  }
  if (!res.ok) throw new Error(`Geocoding service error ${res.status}. Try again.`)

  const data = await res.json()
  if (!data.length) {
    const loc = city ? `"${city}, ${country}"` : `"${country}"`
    throw new Error(`Couldn't find ${loc} on the map. Check the spelling and try again.`)
  }

  const { boundingbox } = data[0]
  // Nominatim returns [south, north, west, east]
  const maxDeg = city ? 0.35 : 0.28   // city → ~35 km radius; country → narrower around centroid
  return clampBbox(boundingbox[0], boundingbox[1], boundingbox[2], boundingbox[3], maxDeg)
}

/* ── Overpass QL query ────────────────────────────────────────────────── */

function buildOverpassQuery({ south, west, north, east }) {
  const bb = `${south},${west},${north},${east}`
  // Fetch nodes and ways that have a name + a recognised business tag
  return `[out:json][timeout:25];
(
  node["name"]["amenity"](${bb});
  node["name"]["shop"](${bb});
  node["name"]["office"](${bb});
  node["name"]["craft"](${bb});
  node["name"]["healthcare"](${bb});
  node["name"]["leisure"](${bb});
  way["name"]["amenity"](${bb});
  way["name"]["shop"](${bb});
  way["name"]["office"](${bb});
);
out body center 300;`
}

/* ── Element normalisation ───────────────────────────────────────────── */

function normalizePhone(raw) {
  if (!raw) return null
  const cleaned = raw.trim()
  return /\d{4,}/.test(cleaned) ? cleaned : null
}

function normalizeWebsite(raw) {
  if (!raw) return null
  let w = raw.trim().replace(/\s+/g, "")
  if (!w.startsWith("http")) w = "https://" + w
  // Sanity-check: must have at least a dot after the scheme
  return w.length > 10 && /https?:\/\/[^/]+\.[^/]+/.test(w) ? w : null
}

function buildAddress(tags, city, country) {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"] || (city || undefined),
    tags["addr:postcode"],
  ].filter(Boolean)
  return parts.length >= 2 ? parts.join(", ") : [city, country].filter(Boolean).join(", ")
}

function normalizeElement(el, city, country) {
  const tags = el.tags || {}
  const name = tags.name
  if (!name || name.length < 2) return null

  // Skip clearly non-commercial or generic entries
  const skip = ["parking","toilets","bench","post_box","waste_basket","fuel","charging_station"]
  if (skip.includes(tags.amenity)) return null

  const lat = el.lat ?? el.center?.lat
  const lon = el.lon ?? el.center?.lon

  const website = normalizeWebsite(tags.website || tags["contact:website"] || tags["url"])
  const phone   = normalizePhone(tags.phone || tags["contact:phone"] || tags["contact:mobile"])

  return {
    osmId:   (el.type || "n") + el.id,
    name,
    btype:   tagToBtype(tags),
    address: buildAddress(tags, city, country),
    phone,
    website,
    ssl:     website ? website.startsWith("https://") : false,
    lat:     lat != null ? parseFloat(lat) : null,
    lon:     lon != null ? parseFloat(lon) : null,
  }
}

/* ── Fisher-Yates shuffle (in-place) ─────────────────────────────────── */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/* ── Public API ──────────────────────────────────────────────────────── */

/**
 * Fetch real local businesses from OpenStreetMap for a given location.
 *
 * @param {Object} opts
 * @param {string} opts.city     — optional city/suburb name
 * @param {string} opts.country  — required country name
 * @returns {Promise<Array>}     — normalised business objects, sorted by data richness
 */
export async function fetchRealBusinesses({ city, country }) {
  const bbox = await geocodeLocation(city, country)

  const query = buildOverpassQuery(bbox)
  let res
  try {
    res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(query),
    })
  } catch {
    throw new Error("Couldn't reach the map service. Check your connection and try again.")
  }
  if (!res.ok) throw new Error(`Map data service returned ${res.status}. Try again in a moment.`)

  const data = await res.json().catch(() => null)
  if (!data?.elements) throw new Error("Unexpected response from map service. Please try again.")

  // Normalise and drop nulls / non-businesses
  const businesses = data.elements
    .map(el => normalizeElement(el, city, country))
    .filter(Boolean)

  if (businesses.length === 0) {
    const loc = city ? `${city}, ${country}` : country
    throw new Error(`No businesses found in ${loc}. Try a different or more specific city.`)
  }

  // Deduplicate by lower-cased name
  const seen = new Set()
  const unique = businesses.filter(b => {
    const key = b.name.toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Sort by data richness: website → phone-only → name-only
  // Shuffle within each tier for variety across scans
  const withSite  = shuffle(unique.filter(b =>  b.website))
  const withPhone = shuffle(unique.filter(b => !b.website && b.phone))
  const rest      = shuffle(unique.filter(b => !b.website && !b.phone))

  return [...withSite, ...withPhone, ...rest].slice(0, 60)
}

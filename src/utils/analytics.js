// ─── Zenvylo Analytics ──────────────────────────────────
// Dual-layer tracking:
//   1. Google Analytics 4 (via window._gtag injected in index.html)
//   2. Supabase events table for custom dashboards
//
// Usage:
//   track('signup', { plan: 'free', country: 'US' })
//   page('home')
//   identify(userId, { plan: 'pro', name: 'Jane' })

import { supabase } from '../lib/supabase'

// ── Helpers ─────────────────────────────────────────────
function gtag(...args) {
  if (typeof window !== 'undefined' && window._gtag) {
    window._gtag(...args)
  }
}

// Fire-and-forget to Supabase events table (won't block UI)
async function supabaseEvent(name, props = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return // events table requires auth (RLS)
    const row = {
      name,
      user_id: user.id,
      properties: {
        ...props,
        url: window.location.pathname,
        referrer: document.referrer || null,
        ua: navigator.userAgent?.slice(0, 150) || null,
      },
    }
    await supabase.from('events').insert(row)
  } catch (_) {
    // Silently fail — analytics should never break the app
  }
}

// ── Core API ─────────────────────────────────────────────

/**
 * Track a named event with optional properties.
 * @param {string} name  - Event name, snake_case (e.g. 'scan_run')
 * @param {object} props - Key/value properties (will be sent to GA4 + Supabase)
 */
export function track(name, props = {}) {
  // 1. GA4
  gtag('event', name, {
    ...props,
    event_category: props.category || 'app',
  })

  // 2. Supabase (async, non-blocking)
  supabaseEvent(name, props)
}

/**
 * Track a virtual page view (for SPA tab navigation).
 * @param {string} tabName - Internal tab name (e.g. 'home', 'leads')
 * @param {string} title   - Human-readable page title
 */
export function page(tabName, title) {
  const path = '/' + (tabName === 'home' ? '' : tabName)
  gtag('event', 'page_view', {
    page_title: title || tabName,
    page_location: window.location.origin + path,
    page_path: path,
  })
  supabaseEvent('page_view', { tab: tabName, title })
}

/**
 * Identify a user (set GA4 user properties).
 * @param {string} userId
 * @param {object} traits - { plan, country, name }
 */
export function identify(userId, traits = {}) {
  if (!userId) return
  gtag('set', 'user_properties', {
    user_id: userId,
    plan: traits.plan || 'free',
    country: traits.country || '',
  })
  gtag('config', 'G-ZENVYLO001', { user_id: userId })
}

// ── Preset Events (typed helpers) ────────────────────────

export const Analytics = {
  // Auth
  signupStarted:    (method = 'email')    => track('signup_started',    { method }),
  signupCompleted:  (plan, country)       => track('signup_completed',  { plan, country }),
  loginCompleted:   ()                    => track('login_completed'),
  logoutCompleted:  ()                    => track('logout_completed'),

  // Scans
  scanStarted:      (service, country)   => track('scan_started',      { service, country }),
  scanCompleted:    (service, leadsN)    => track('scan_completed',    { service, leads_count: leadsN }),
  scanFailed:       (error)              => track('scan_failed',       { error }),

  // Leads
  leadSaved:        ()                   => track('lead_saved'),
  leadDeleted:      ()                   => track('lead_deleted'),
  leadStatusChanged:(status)             => track('lead_status_changed',{ status }),

  // Clients
  clientAdded:      ()                   => track('client_added'),
  clientDeleted:    ()                   => track('client_deleted'),

  // AI Tools
  aiToolUsed:       (tool, service)      => track('ai_tool_used',      { tool, service }),

  // Payments
  upgradeClicked:   (fromPlan, toPlan)   => track('upgrade_clicked',   { from_plan: fromPlan, to_plan: toPlan }),
  upgradeCompleted: (plan, price)        => track('upgrade_completed', { plan, price, currency: 'USD' }),
  scanPackBought:   (pack, price)        => track('scan_pack_bought',  { pack, price, currency: 'USD' }),

  // Onboarding
  onboardingCompleted: ()               => track('onboarding_completed'),

  // Engagement
  searchOpened:     ()                   => track('search_opened'),
  csvExported:      (count)              => track('csv_exported',       { lead_count: count }),
  upgradeModalSeen: (feature, plan)      => track('upgrade_modal_seen', { feature, required_plan: plan }),

  // Navigation
  page,
  identify,
}

export default Analytics

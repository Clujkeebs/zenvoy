/* ── site.js — one place for the public identity of Zenvylo ──────────────
 *
 * The repo used to mix zenvylo.com and zenvylo.app. The owner calls the
 * product zenvylo.app, and the only live product URL already in the app
 * (the affiliate referral link) pointed at zenvylo.app. GitHub's repository
 * homepage field says zenvoy.app. The product domain stays zenvylo.app
 * until that is changed on purpose. Everything public hangs off this file.
 * ─────────────────────────────────────────────────────────────────────── */

export const SITE_ORIGIN = 'https://zenvylo.app'
export const SITE_NAME = 'Zenvylo'
export const SUPPORT_EMAIL = 'support@zenvylo.app'
export const HELLO_EMAIL = 'hello@zenvylo.app'

/**
 * The legal entity that owns the business is not known in this repo.
 * Payouts go through a business account under the founder's parent's company.
 * These placeholders must be replaced before the pages are treated as final,
 * and a human should review the legal copy.
 */
export const LEGAL_ENTITY_PLACEHOLDER = '[LEGAL ENTITY NAME]'
export const LEGAL_ADDRESS_PLACEHOLDER = '[LEGAL ENTITY ADDRESS]'

export const OSM_ATTRIBUTION =
  'Business listings © OpenStreetMap contributors, available under the Open Database License (ODbL).'

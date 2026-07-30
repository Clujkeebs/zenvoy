/* ── router.js — the app's pages get real URLs ───────────────────────────
 *
 * Navigation used to be `useState("home")`, which meant the whole app lived at
 * one URL: no back button, no deep links, nothing shareable or bookmarkable,
 * and six SEO blog posts pointing at a single crawlable page.
 *
 * This is a ~40-line History API binding rather than a routing library. The app
 * has one flat level of pages and no nested or parameterised routes, so a
 * dependency would be more machinery than the problem needs.
 * ─────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback } from 'react'

export const ROUTES = [
  'home', 'leads', 'clients', 'tools', 'analytics', 'history',
  'subscription', 'settings', 'enterprise', 'support', 'admin', 'affiliate',
]

const DEFAULT_ROUTE = 'home'

/** Path → tab id. Unknown paths fall back to home. */
export function routeFromPath(pathname = window.location.pathname) {
  const seg = pathname.replace(/^\/+|\/+$/g, '').split('/')[0]
  return ROUTES.includes(seg) ? seg : DEFAULT_ROUTE
}

/** Tab id → path. Home lives at "/" so the landing URL stays clean. */
export function pathFromRoute(route) {
  return route === DEFAULT_ROUTE ? '/' : `/${route}`
}

/**
 * Keep a tab id and the address bar in sync.
 *
 * @returns {[string, Function]} current route, and a setter that pushes history
 */
export function useRoute() {
  const [route, setRouteState] = useState(() => routeFromPath())

  // Back/forward buttons.
  useEffect(() => {
    const onPop = () => setRouteState(routeFromPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const setRoute = useCallback(next => {
    const target = ROUTES.includes(next) ? next : DEFAULT_ROUTE
    setRouteState(prev => {
      if (prev === target) return prev
      // Preserve the query string — ?ref= codes and Stripe's ?session_id= both
      // arrive on the landing URL and are read after navigation.
      window.history.pushState({ route: target }, '', pathFromRoute(target) + window.location.search)
      return target
    })
  }, [])

  return [route, setRoute]
}

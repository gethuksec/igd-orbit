/**
 * Outlet-only scope (IGDERP-270 hygiene).
 *
 * Branches stay outlet-only by construction: HQ-like sites live in the
 * separate WorkingLocation table, so no branch row is ever a non-outlet.
 * Selling-outlet pickers (POS, public, intake links, fallbacks) must route
 * through this scope so a future branch-type split has exactly one place
 * to tighten — and so tests can assert HQ-like rows never leak into
 * outlet dropdowns. No DB view involved.
 */
export function outletOnlyWhere<T extends object = Record<string, never>>(
  extra?: T,
): { isActive: true } & T {
  return { isActive: true, ...(extra ?? ({} as T)) };
}

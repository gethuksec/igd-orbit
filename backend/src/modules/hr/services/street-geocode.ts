/**
 * Street name resolved at clock-in/out time (OpenStreetMap Nominatim).
 * Stored on the attendance row so the roster popup shows the actual street
 * without a live lookup. Never throws — failures resolve null and callers
 * fall back to the recorded location text.
 */

export interface NominatimAddress {
  road?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  village?: string;
  city?: string;
  town?: string;
  county?: string;
}

/**
 * Pure: "Jl. Sudirman No. 88, Kaliwates, Jember" from a Nominatim address,
 * or null when nothing usable is present. Exported for unit tests.
 */
export function formatStreetLabel(a: NominatimAddress | null | undefined): string | null {
  if (!a) return null;
  const road = a.road ? (a.house_number ? `${a.road} No. ${a.house_number}` : a.road) : null;
  const area = a.suburb || a.neighbourhood || a.village || null;
  const city = a.city || a.town || a.county || null;
  const parts = [road, area, city].filter((p): p is string => !!p);
  return parts.length ? parts.join(', ') : null;
}

type FetchImpl = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/**
 * Reverse-geocode lat/lng into a street label. Returns null on any failure
 * (network, non-200, timeout, unusable payload) — never rejects.
 */
export async function resolveStreetLabel(
  lat: number,
  lng: number,
  opts?: { fetchImpl?: FetchImpl; timeoutMs?: number },
): Promise<string | null> {
  const fetchImpl: FetchImpl =
    opts?.fetchImpl ??
    ((url, init) =>
      fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'igd-orbit-erp/1.0' },
        signal: init?.signal,
      }) as unknown as Promise<{ ok: boolean; json(): Promise<unknown> }>);
  const timeoutMs = opts?.timeoutMs ?? 3000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${lat}&lon=${lng}&format=jsonv2&zoom=18&accept-language=id`;
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as { address?: NominatimAddress };
    return formatStreetLabel(body?.address);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

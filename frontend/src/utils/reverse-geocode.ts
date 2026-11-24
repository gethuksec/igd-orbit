/**
 * Reverse-geocode clock coordinates into a street-level label via
 * OpenStreetMap Nominatim. Cached per rounded coordinate; failures resolve
 * null so callers fall back to the recorded location text.
 */
const cache = new Map<string, Promise<string | null>>();

interface NominatimAddress {
  road?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  village?: string;
  city?: string;
  town?: string;
  county?: string;
}

export function reverseGeocodeStreet(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const req = (async (): Promise<string | null> => {
    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse` +
        `?lat=${lat}&lon=${lng}&format=jsonv2&zoom=18&accept-language=id`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const body = (await res.json()) as { address?: NominatimAddress };
      const a = body.address;
      if (!a) return null;
      const road = a.road ? (a.house_number ? `${a.road} No. ${a.house_number}` : a.road) : null;
      const area = a.suburb || a.neighbourhood || a.village || null;
      const city = a.city || a.town || a.county || null;
      const parts = [road, area, city].filter((p): p is string => !!p);
      return parts.length ? parts.join(', ') : null;
    } catch {
      return null;
    }
  })();
  cache.set(key, req);
  return req;
}

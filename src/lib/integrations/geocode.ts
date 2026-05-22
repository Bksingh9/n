// Nominatim (OpenStreetMap) geocoding wrapper.
//
// Free + no auth, but the OSM Nominatim usage policy is strict:
//   - One request per second, max.
//   - Identify the app via a meaningful User-Agent.
//   - Cache results aggressively — never re-query the same address.
//
// We hand caching to the caller (events store lat/lng on the row), and
// throttle via the existing rate_limits table.

import { checkRateLimit } from '@/lib/rate-limit';
import { publicEnv } from '@/lib/env';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export interface GeocodeQuery {
  venue?: string | null;
  city?: string | null;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  label: string;
}

export const buildGeocodeQueryString = (q: GeocodeQuery): string => {
  const parts = [q.venue, q.city]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s && s.length > 0));
  return parts.join(', ');
};

export const parseNominatimResponse = (
  body: unknown,
): GeocodeResult | null => {
  if (!Array.isArray(body) || body.length === 0) return null;
  const first = body[0] as { lat?: string; lon?: string; display_name?: string };
  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    label: typeof first.display_name === 'string' ? first.display_name : '',
  };
};

export const geocodeVenue = async (q: GeocodeQuery): Promise<GeocodeResult | null> => {
  const query = buildGeocodeQueryString(q);
  if (!query) return null;

  // Nominatim policy: 1 req/sec. We use a 1s rate-limit bucket to throttle
  // across server invocations; if the bucket is full we drop this attempt.
  const limit = await checkRateLimit({
    action: 'nominatim',
    identifier: 'global',
    limit: 1,
    windowMs: 1_000,
  });
  if (!limit.allowed) return null;

  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(query)}`;
  try {
    const resp = await fetch(url, {
      headers: {
        // OSM requires a meaningful UA. APP_URL gives the operator a way to
        // reach us if there's an issue.
        'User-Agent': `DateOpsLive/1.0 (${publicEnv.APP_URL})`,
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(5_000),
    });
    if (!resp.ok) return null;
    const body = await resp.json();
    return parseNominatimResponse(body);
  } catch (err) {
    console.error('[geocode] failed', err);
    return null;
  }
};

// Static OSM tile URL for a given lat/lng. No JS map dependency needed.
export const staticMapUrl = (lat: number, lng: number, zoom = 15): string =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;

// Embed iframe URL for a static map (no JS / API key).
export const embedMapUrl = (lat: number, lng: number, deltaDeg = 0.005): string => {
  const minLon = lng - deltaDeg;
  const maxLon = lng + deltaDeg;
  const minLat = lat - deltaDeg;
  const maxLat = lat + deltaDeg;
  const bbox = `${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
};

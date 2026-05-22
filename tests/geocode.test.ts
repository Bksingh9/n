import { describe, expect, it } from 'vitest';
import {
  buildGeocodeQueryString,
  embedMapUrl,
  parseNominatimResponse,
  staticMapUrl,
} from '@/lib/integrations/geocode';

describe('buildGeocodeQueryString', () => {
  it('joins venue and city with a comma', () => {
    expect(buildGeocodeQueryString({ venue: 'The Living Room', city: 'Brooklyn' })).toBe(
      'The Living Room, Brooklyn',
    );
  });
  it('drops empty parts', () => {
    expect(buildGeocodeQueryString({ venue: '', city: 'Brooklyn' })).toBe('Brooklyn');
    expect(buildGeocodeQueryString({ venue: 'Bar', city: null })).toBe('Bar');
  });
  it('trims whitespace', () => {
    expect(buildGeocodeQueryString({ venue: '  Bar  ', city: ' NYC ' })).toBe('Bar, NYC');
  });
  it('returns empty when nothing provided', () => {
    expect(buildGeocodeQueryString({})).toBe('');
  });
});

describe('parseNominatimResponse', () => {
  it('returns the first hit', () => {
    const r = parseNominatimResponse([
      { lat: '40.7128', lon: '-74.0060', display_name: 'New York, NY, USA' },
    ]);
    expect(r).toEqual({ latitude: 40.7128, longitude: -74.006, label: 'New York, NY, USA' });
  });
  it('rejects malformed numbers', () => {
    expect(parseNominatimResponse([{ lat: 'nope', lon: '0' }])).toBeNull();
  });
  it('returns null on empty array', () => {
    expect(parseNominatimResponse([])).toBeNull();
  });
  it('returns null on non-array body', () => {
    expect(parseNominatimResponse({})).toBeNull();
    expect(parseNominatimResponse(null)).toBeNull();
  });
});

describe('staticMapUrl / embedMapUrl', () => {
  it('static URL contains lat/lng/zoom', () => {
    const u = staticMapUrl(40.7, -74, 14);
    expect(u).toContain('mlat=40.7');
    expect(u).toContain('mlon=-74');
    expect(u).toContain('#map=14/40.7/-74');
  });
  it('embed URL contains a sensible bbox and marker', () => {
    const u = embedMapUrl(40, -74, 0.01);
    expect(u).toContain('bbox=');
    expect(u).toContain('marker=40%2C-74');
  });
});

import type { GeoPoint } from "./types";

export const NM_PER_DEG_LAT = 60;
export const M_PER_NM = 1852;
export const KTS_TO_NM_PER_SEC = 1 / 3600;

const DEG = Math.PI / 180;

export function normDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}

/** Local tangent-plane offset of `p` relative to `origin`, in nautical miles. */
export function localOffsetNm(origin: GeoPoint, p: GeoPoint): { east: number; north: number } {
  const north = (p.lat - origin.lat) * NM_PER_DEG_LAT;
  const east = (p.lon - origin.lon) * NM_PER_DEG_LAT * Math.cos(origin.lat * DEG);
  return { east, north };
}

/** Range (nm) and true bearing (deg) from `origin` to `p`. */
export function rangeBearing(origin: GeoPoint, p: GeoPoint): { rangeNm: number; bearingDeg: number } {
  const { east, north } = localOffsetNm(origin, p);
  const rangeNm = Math.hypot(east, north);
  const bearingDeg = normDeg(Math.atan2(east, north) / DEG);
  return { rangeNm, bearingDeg };
}

/** Move `p` along true bearing `bearingDeg` by `distNm`. */
export function moveAlong(p: GeoPoint, bearingDeg: number, distNm: number): GeoPoint {
  const north = distNm * Math.cos(bearingDeg * DEG);
  const east = distNm * Math.sin(bearingDeg * DEG);
  return {
    lat: p.lat + north / NM_PER_DEG_LAT,
    lon: p.lon + east / (NM_PER_DEG_LAT * Math.cos(p.lat * DEG)),
  };
}

/** Offset `p` by an east/north vector in nm. */
export function offsetNm(p: GeoPoint, east: number, north: number): GeoPoint {
  return {
    lat: p.lat + north / NM_PER_DEG_LAT,
    lon: p.lon + east / (NM_PER_DEG_LAT * Math.cos(p.lat * DEG)),
  };
}

/**
 * Project a geo point into plan-display pixel coordinates.
 * `rotationDeg` is subtracted from bearings (Head-up mode passes the ship heading).
 * Screen y grows downward, so north is negative y.
 */
export function projectToScreen(
  origin: GeoPoint,
  p: GeoPoint,
  pxPerNm: number,
  rotationDeg: number,
): { x: number; y: number; rangeNm: number; bearingDeg: number } {
  const { rangeNm, bearingDeg } = rangeBearing(origin, p);
  const rel = (bearingDeg - rotationDeg) * DEG;
  return {
    x: Math.sin(rel) * rangeNm * pxPerNm,
    y: -Math.cos(rel) * rangeNm * pxPerNm,
    rangeNm,
    bearingDeg,
  };
}

/** Smallest signed angle from a to b, in degrees (-180..180]. */
export function angleDelta(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

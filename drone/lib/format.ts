import type { GeoPoint } from "./types";

export type Locale = "zh-TW" | "en";

/** DD°MM.mmm' H — the notation mariners actually read off a plotter. */
export function formatLat(lat: number, decimals = 3): string {
  const h = lat >= 0 ? "N" : "S";
  const a = Math.abs(lat);
  const d = Math.floor(a);
  const m = (a - d) * 60;
  return `${d.toString().padStart(2, "0")}°${m.toFixed(decimals).padStart(3 + decimals, "0")}′${h}`;
}

export function formatLon(lon: number, decimals = 3): string {
  const h = lon >= 0 ? "E" : "W";
  const a = Math.abs(lon);
  const d = Math.floor(a);
  const m = (a - d) * 60;
  return `${d.toString().padStart(3, "0")}°${m.toFixed(decimals).padStart(3 + decimals, "0")}′${h}`;
}

export function formatPosition(p: GeoPoint): string {
  return `${formatLat(p.lat)}  ${formatLon(p.lon)}`;
}

export function formatBearing(deg: number): string {
  return `${Math.round(((deg % 360) + 360) % 360)
    .toString()
    .padStart(3, "0")}°`;
}

export function formatRange(nm: number): string {
  if (nm < 10) return `${nm.toFixed(1)} nm`;
  return `${nm.toFixed(0)} nm`;
}

/** Relative age like "4m", "1h 12m" — compact for the plan display. */
export function formatAgeShort(ageMs: number, locale: Locale): string {
  const s = Math.max(0, Math.floor(ageMs / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (locale === "zh-TW") {
    if (s < 60) return `${s}秒`;
    if (m < 60) return `${m}分`;
    return `${h}時${(m % 60).toString().padStart(2, "0")}分`;
  }
  if (s < 60) return `${s}s`;
  if (m < 60) return `${m}m`;
  return `${h}h ${(m % 60).toString().padStart(2, "0")}m`;
}

/** Sentence form like "12 min ago" / "12 分鐘前". */
export function formatAgeLong(ageMs: number, locale: Locale): string {
  const s = Math.max(0, Math.floor(ageMs / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (locale === "zh-TW") {
    if (s < 60) return `${s} 秒前`;
    if (m < 60) return `${m} 分鐘前`;
    return `${h} 小時 ${m % 60} 分前`;
  }
  if (s < 60) return `${s} sec ago`;
  if (m < 60) return `${m} min ago`;
  return `${h} h ${m % 60} min ago`;
}

export function formatClock(epochMs: number, tzOffsetHours: number): string {
  const d = new Date(epochMs + tzOffsetHours * 3600_000);
  return `${d.getUTCHours().toString().padStart(2, "0")}:${d
    .getUTCMinutes()
    .toString()
    .padStart(2, "0")}:${d.getUTCSeconds().toString().padStart(2, "0")}`;
}

export function formatDateUTC(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1).toString().padStart(2, "0")}-${d
    .getUTCDate()
    .toString()
    .padStart(2, "0")}`;
}

export function formatTimeUTC(epochMs: number, withSeconds = true): string {
  const d = new Date(epochMs);
  const hm = `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
  return withSeconds ? `${hm}:${d.getUTCSeconds().toString().padStart(2, "0")}Z` : `${hm}Z`;
}

export function formatPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function formatDurationHM(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(m / 60);
  return `${h}:${(m % 60).toString().padStart(2, "0")}`;
}

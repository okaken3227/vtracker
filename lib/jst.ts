export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getJstMidnightMs(): number {
  const nowMs = Date.now();
  return Math.floor((nowMs + JST_OFFSET_MS) / 86400000) * 86400000 - JST_OFFSET_MS;
}

export function getTodayJST(): string {
  const d = new Date(Date.now() + JST_OFFSET_MS);
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function getJstMidnightForDate(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - JST_OFFSET_MS;
}

export function offsetDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, "0"),
    String(dt.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

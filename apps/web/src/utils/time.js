export function formatRelTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function fmtDuration(seconds) {
  if (!seconds || seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

export function fmtElapsed(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

const pad = (n) => String(n).padStart(2, "0");

/** yyyy-mm-dd in the browser's local timezone (what <input type="date"> expects). */
export function toLocalDateInput(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** hh:mm in the browser's local timezone (what <input type="time"> expects). */
export function toLocalTimeInput(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Combine local date + time inputs into a UTC ISO string for the API. */
export function localToIso(date, time) {
  return new Date(`${date}T${time}:00`).toISOString();
}

/** Minutes east of UTC for the current browser (what the API's ?tz_offset= wants). */
export function tzOffsetMinutes() {
  return -new Date().getTimezoneOffset();
}

/** "2026-07-20" or "2026-07-20T00:00:00" → yyyy-mm-dd for date inputs (no timezone shifting). */
export function dateOnly(iso) {
  return iso ? String(iso).slice(0, 10) : "";
}

/** Parse the date part as a LOCAL date so a due date never shifts a day. */
export function parseDueDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

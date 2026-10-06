import { format } from "date-fns";

const pad = (n: number) => String(n).padStart(2, "0");

/** Timestamp in local time: dd/MM/yyyy */
export function formatDate(value: Date | string) {
  return format(new Date(value), "dd/MM/yyyy");
}

/** Timestamp in local time, 24h: dd/MM/yyyy HH:mm */
export function formatDateTime(value: Date | string) {
  return format(new Date(value), "dd/MM/yyyy HH:mm");
}

/** Timestamp in local time, 24h with seconds: dd/MM/yyyy HH:mm:ss */
export function formatDateTimeSeconds(value: Date | string) {
  return format(new Date(value), "dd/MM/yyyy HH:mm:ss");
}

/** Timestamp in local time, 24h: HH:mm */
export function formatTime(value: Date | string) {
  return format(new Date(value), "HH:mm");
}

/**
 * Calendar-date fields (stored as UTC midnight, e.g. Task.date) — uses UTC
 * components so the day never shifts with the viewer's timezone.
 */
export function formatDateOnly(value: Date | string) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  const d = new Date(value);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

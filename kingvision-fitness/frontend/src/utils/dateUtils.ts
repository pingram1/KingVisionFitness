/**
 * Centralized date/time formatting helpers.
 *
 * The whole app standardises on 12-hour AM/PM notation in the UI. Backend
 * APIs and form values (e.g. availability slots) still use 24-hour "HH:MM"
 * strings — that's the storage format. Display-time conversion happens here.
 *
 * Never inline 24-hour formatting in screens; always route through these
 * helpers so the app stays consistent if we later add localization.
 */

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Convert a 24-hour "HH:MM" string to 12-hour AM/PM ("2:00 PM").
 *
 * Returns the original string if it isn't valid 24-hour notation so we never
 * silently swallow malformed data — e.g. an empty TextInput value.
 */
export function formatTime12Hour(value: string | null | undefined): string {
  if (!value) return '';
  const match = HH_MM.exec(value.trim());
  if (!match) return value;

  const hours24 = Number.parseInt(match[1], 10);
  const minutes = match[2];
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${period}`;
}

/**
 * Format a Date or ISO string as 12-hour AM/PM ("2:05 PM"), respecting the
 * local timezone. Used for booking timestamps coming back from the API.
 */
export function formatDateTime12Hour(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const hours24 = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes} ${period}`;
}

/** Convert a Date instance to the 24-hour "HH:MM" storage format. */
export function toHHMM(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Convert a Date instance to the ISO date storage format "YYYY-MM-DD" (local TZ). */
export function toYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a "YYYY-MM-DD" date string in a friendly long form for display
 * ("Monday, May 25, 2026"). Returns an empty string for empty/invalid input.
 */
export function formatLongDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

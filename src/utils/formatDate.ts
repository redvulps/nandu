import GLib from 'gi://GLib';

/**
 * Formats a date string, number or object into a string based on the system's locale configuration.
 * @param date The date to format
 * @param withIsoDate Whether to append the ISO 8601 date string in parentheses
 * @returns The formatted date string
 */
export function formatDate(
  date: Date | string | number,
  withIsoDate = false
): string {
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  const glibDate = GLib.DateTime.new_from_unix_local(
    Math.floor(d.getTime() / 1000)
  );

  let formatted = glibDate ? glibDate.format('%c') : null;

  if (!formatted) {
    formatted = d.toLocaleDateString();
  }

  if (withIsoDate) {
    formatted += ` (${d.toISOString()})`;
  }

  return formatted;
}

/**
 * Formats a number of bytes into a human-readable string with appropriate units (B, KB, MB, GB, TB).
 *
 * @param bytes The number of bytes to format.
 * @returns A string representing the formatted bytes (e.g., "1.23 KB", "500 B").
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return Math.round(value * 100) / 100 + ' ' + sizes[i];
}

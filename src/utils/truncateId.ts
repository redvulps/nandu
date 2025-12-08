/**
 * Truncates a Docker ID to its short form (first 12 characters).
 * Handles IDs with or without the sha256: prefix.
 *
 * @param id The full Docker ID (e.g., "sha256:abc123..." or "abc123...")
 * @param length The number of characters to keep (default: 12)
 * @returns The truncated ID
 */
export function truncateId(id: string, length = 12): string {
  if (!id) {
    return '';
  }

  // Remove sha256: prefix if present
  const cleanId = id.startsWith('sha256:') ? id.slice(7) : id;

  return cleanId.slice(0, length);
}

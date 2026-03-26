/**
 * Strip any HTML/script tags and null bytes from a string.
 * Used to sanitize user inputs before processing.
 */
export function sanitizeString(value: unknown, maxLength = 255): string {
  if (typeof value !== 'string') return '';
  return value
    .slice(0, maxLength)
    .replace(/\0/g, '')                    // null bytes
    .replace(/<[^>]*>/g, '')               // HTML tags
    .replace(/javascript:/gi, '')          // js: protocol
    .replace(/on\w+\s*=/gi, '')            // inline event handlers
    .trim();
}

/**
 * Validate an email — only allow printable ASCII, no control chars.
 */
export function sanitizeEmail(value: unknown): string {
  const s = sanitizeString(value, 254);
  // Only allow characters valid in an email address
  return s.replace(/[^\w.+\-@]/g, '').toLowerCase();
}

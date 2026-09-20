/**
 * SmartEats Phone Formatting & Tel URI Utility (Step 8.4A)
 *
 * Normalizes and formats phone numbers for safe, accessible browser & mobile `tel:` dialer links.
 */

/**
 * Sanitizes a phone number into a valid RFC 3966 `tel:` URI.
 * Normalizes Indian 10-digit mobile numbers to international E.164 standard (+91).
 *
 * @param {string|number|null|undefined} phone - Raw input phone string
 * @returns {string|null} - Sanitized `tel:+91XXXXXXXXXX` URI or `null` if invalid/missing
 */
export function cleanTelUri(phone) {
  if (!phone) return null;

  const raw = String(phone).trim();
  if (!raw) return null;

  // Remove common delimiter characters: spaces, hyphens, parentheses, dots
  let cleaned = raw.replace(/[\s\-().]/g, '');

  // If contains any characters other than digits and optional leading '+'
  if (!/^\+?[0-9]+$/.test(cleaned)) {
    return null;
  }

  // Handle leading zeros e.g. 09876543210
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // Case 1: 10-digit Indian number e.g. "9876543210"
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `tel:+91${cleaned}`;
  }

  // Case 2: 12-digit Indian number with 91 prefix without plus e.g. "919876543210"
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    return `tel:+${cleaned}`;
  }

  // Case 3: Standard international with leading plus e.g. "+919876543210"
  if (cleaned.startsWith('+')) {
    const digitsOnly = cleaned.substring(1);
    // Minimum 7 digits, maximum 15 digits according to ITU E.164
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
      return `tel:${cleaned}`;
    }
    return null;
  }

  // Case 4: General valid international digit length (7-15 digits)
  if (cleaned.length >= 7 && cleaned.length <= 15) {
    return `tel:+${cleaned}`;
  }

  return null;
}

/**
 * Formats a phone number for user-facing display.
 * Formats 10-digit Indian numbers as "+91 XXXXX XXXXX".
 *
 * @param {string|number|null|undefined} phone - Raw phone string
 * @returns {string} - Formatted phone string or "Phone not available"
 */
export function formatIndianPhone(phone) {
  if (!phone) return 'Phone not available';

  const raw = String(phone).trim();
  if (!raw) return 'Phone not available';

  let cleaned = raw.replace(/[\s\-().]/g, '');

  if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // Strip leading "+91" or "91" if 10-digit payload follows
  if (cleaned.startsWith('+91') && cleaned.length === 13) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  }

  // If 10-digit Indian mobile format
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    const part1 = cleaned.substring(0, 5);
    const part2 = cleaned.substring(5);
    return `+91 ${part1} ${part2}`;
  }

  // If valid generic international number
  if (/^\+?[0-9]{7,15}$/.test(cleaned)) {
    return raw;
  }

  return 'Phone not available';
}

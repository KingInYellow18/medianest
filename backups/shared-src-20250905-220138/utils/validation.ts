/**
 * Validate an email address
 * @param email - The email address to validate
 * @returns Whether the email is valid
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;

  // Basic email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate a URL
 * @param url - The URL to validate
 * @returns Whether the URL is valid
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;

  try {
    const urlObj = new URL(url);
    // Check if protocol is valid (http, https, ftp, etc)
    return ['http:', 'https:', 'ftp:', 'ftps:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate a UUID (v4 format)
 * @param uuid - The UUID to validate
 * @returns Whether the UUID is valid
 */
export function isValidUuid(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') return false;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate a port number
 * @param port - The port number to validate
 * @returns Whether the port is valid (1-65535)
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

/**
 * Validate an IP address (IPv4 or IPv6)
 * @param ip - The IP address to validate
 * @returns Whether the IP address is valid
 */
export function isValidIpAddress(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;

  // IPv4 regex
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  // IPv6 regex (simplified but covers most cases)
  const ipv6Regex =
    /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Sanitize a string by removing HTML tags and trimming whitespace
 * @param str - The string to sanitize
 * @returns The sanitized string
 */
export function sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') return '';

  // Remove HTML tags and their content for script tags
  let sanitized = str.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Remove remaining HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Replace multiple spaces with single space and trim
  return sanitized.replace(/\s+/g, ' ').trim();
}

/**
 * Truncate a string to a specified length
 * @param str - The string to truncate
 * @param maxLength - Maximum length of the string (before suffix)
 * @param suffix - Suffix to append when truncated (default: '...')
 * @returns The truncated string
 */
export function truncateString(str: string, maxLength: number, suffix: string = '...'): string {
  if (!str || typeof str !== 'string') return '';

  // Handle edge cases
  if (maxLength <= 0) return suffix;

  // Return original string if it's short enough
  if (str.length <= maxLength) return str;

  // Truncate at maxLength and add suffix
  // Trim any trailing space before adding suffix
  return str.substring(0, maxLength).trimEnd() + suffix;
}

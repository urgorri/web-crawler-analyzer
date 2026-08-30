/**
 * SSRF (Server-Side Request Forgery) Protection Policy
 * 
 * This module provides centralized URL validation to prevent SSRF attacks.
 * It blocks requests to private/internal network resources while allowing
 * explicit opt-in for local development.
 * 
 * @module lib/ssrf-policy
 */

import { lookup } from 'node:dns/promises';
import net from 'node:net';

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Whether to allow private/internal network targets.
 * Only enabled in development when explicitly set via ALLOW_PRIVATE_TARGETS=true
 */
const ALLOW_PRIVATE_TARGETS = process.env.ALLOW_PRIVATE_TARGETS === 'true';

/**
 * Indicates if running in development environment
 */
const IS_DEV = process.env.NODE_ENV === 'development';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UrlValidationResult {
  /** Whether the URL is valid and allowed */
  isValid: boolean;
  /** The validated URL string (trimmed) if valid */
  url?: string;
  /** Reason for rejection if invalid */
  reason?: string;
  /** Error code for programmatic handling */
  errorCode?: 'INVALID_URL' | 'UNSUPPORTED_PROTOCOL' | 'PRIVATE_NETWORK_BLOCKED';
}

export interface UrlValidationOptions {
  /** Override the ALLOW_PRIVATE_TARGETS setting (for testing) */
  allowPrivateTargets?: boolean;
}

export interface SSRFValidationError {
  url: string;
  reason?: string;
  message?: string;
  code?: string;
  errorCode?: string;
}

// ─── Security Policy ──────────────────────────────────────────────────────────

/**
 * List of hostnames considered as "localhost" for development purposes
 */
const LOCALHOST_ALIASES = ['localhost', '0.0.0.0', '127.0.0.1', '[::1]', '::1', '0000:0000:0000:0000:0000:0000:0000:0001', '::'];

/**
 * Check if a hostname or IP string represents a private IP address or internal network resource.
 * 
 * Blocks:
 * - localhost and loopback addresses (127.x.x.x, ::1)
 * - Private IPv4 ranges:
 *   - 10.0.0.0/8 (Class A private)
 *   - 127.0.0.0/8 (Loopback)
 *   - 0.0.0.0/8 (This network)
 *   - 172.16.0.0/12 (Class B private)
 *   - 192.168.0.0/16 (Class C private)
 *   - 169.254.0.0/16 (Link-local / AWS IMDS)
 *   - 100.64.0.0/10 (Carrier-grade NAT)
 *   - Multicast (224.0.0.0/4) & Reserved (240.0.0.0/4)
 * - Private IPv6 ranges:
 *   - Loopback (::1)
 *   - Unique Local Addresses (fc00::/7)
 *   - Link-Local Addresses (fe80::/10)
 *   - Multicast (ff00::/8)
 *   - IPv4-mapped IPv6 addresses targeting private IPv4
 * 
 * @param hostname - The hostname or IP string to check
 * @returns true if the address is a private/internal address
 */
export function isPrivateIp(hostname: string): boolean {
  let normalized = hostname.toLowerCase().trim();

  // Strip surrounding brackets for IPv6 literals
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    normalized = normalized.slice(1, -1);
  }
  
  // Check for localhost aliases
  if (LOCALHOST_ALIASES.includes(normalized)) {
    return true;
  }
  
  // Check IPv4-mapped IPv6 addresses e.g. ::ffff:127.0.0.1
  if (normalized.startsWith('::ffff:')) {
    const embeddedIpv4 = normalized.substring(7);
    if (isPrivateIp(embeddedIpv4)) {
      return true;
    }
  }

  // Check for IPv4 private ranges
  const ipv4Match = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b, c, d] = ipv4Match.map(Number);

    // Validate octets
    if (a > 255 || b > 255 || c > 255 || d > 255) {
      return false;
    }
    
    // 10.0.0.0/8
    if (a === 10) return true;
    
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
    
    // 0.0.0.0/8 (this network)
    if (a === 0) return true;
    
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;

    // 100.64.0.0/10 (CGNAT)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // Multicast (224.0.0.0/4) & Reserved (240.0.0.0/4)
    if (a >= 224) return true;
  }
  
  // IPv6 Checks
  if (normalized === '::' || normalized === '::1') {
    return true;
  }

  // IPv6 Unique Local Addresses fc00::/7 (fc00:: - fdff::)
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) {
    return true;
  }

  // IPv6 Link-Local Addresses fe80::/10 (fe80:: - febf::)
  if (/^fe[89ab][0-9a-f]:/i.test(normalized)) {
    return true;
  }

  // IPv6 Multicast ff00::/8
  if (/^ff[0-9a-f]{2}:/i.test(normalized)) {
    return true;
  }
  
  return false;
}

/**
 * Resolves a host name via DNS and checks if any resolved IP address (IPv4 or IPv6)
 * points to a private/internal network.
 *
 * @param hostname - The domain hostname or IP address to resolve
 * @returns Object indicating if the host resolves to a private IP, or if DNS resolution failed
 */
export async function isPrivateHost(hostname: string): Promise<{ isPrivate: boolean; error?: string }> {
  let normalized = hostname.toLowerCase().trim();
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    normalized = normalized.slice(1, -1);
  }

  // First direct string check for IP literal / alias
  if (isPrivateIp(normalized)) {
    return { isPrivate: true };
  }

  // If it's an IP literal and passed isPrivateIp, it's public
  if (net.isIP(normalized)) {
    return { isPrivate: false };
  }

  // Perform DNS resolution for hostname
  try {
    const records = await lookup(normalized, { all: true });
    if (!records || records.length === 0) {
      return { isPrivate: false, error: `Could not resolve domain: ${hostname}` };
    }

    for (const record of records) {
      if (isPrivateIp(record.address)) {
        return { isPrivate: true };
      }
    }

    return { isPrivate: false };
  } catch (err) {
    return { isPrivate: false, error: `DNS resolution failed for ${hostname}` };
  }
}

/**
 * Validate a single URL against the SSRF protection policy.
 * 
 * Performs protocol checks, static hostname validation, and async DNS resolution
 * to guard against DNS rebinding and internal network access bypasses.
 *
 * @param url - The URL string to validate
 * @param options - Optional validation overrides
 * @returns Validation result with details
 * 
 * @example
 * ```typescript
 * const result = await validateUrl('https://example.com');
 * if (!result.isValid) {
 *   console.error(result.reason);
 * }
 * ```
 */
export async function validateUrl(
  url: string,
  options: UrlValidationOptions = {}
): Promise<UrlValidationResult> {
  const allowPrivate = options.allowPrivateTargets ?? ALLOW_PRIVATE_TARGETS;
  
  try {
    const trimmed = url.trim();
    const parsed = new URL(trimmed);
    
    // Check protocol
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        isValid: false,
        reason: 'Unsupported protocol. Only http and https are allowed.',
        errorCode: 'UNSUPPORTED_PROTOCOL',
      };
    }
    
    // Check for private/internal networks (unless explicitly allowed in dev)
    if (!allowPrivate) {
      const privateCheck = await isPrivateHost(parsed.hostname);

      if (privateCheck.isPrivate) {
        return {
          isValid: false,
          reason: IS_DEV
            ? 'URL targets a private/internal network address. Set ALLOW_PRIVATE_TARGETS=true to allow in development.'
            : 'URL targets a private/internal network address which is not allowed.',
          errorCode: 'PRIVATE_NETWORK_BLOCKED',
        };
      }

      if (privateCheck.error) {
        return {
          isValid: false,
          reason: privateCheck.error,
          errorCode: 'INVALID_URL',
        };
      }
    }
    
    return {
      isValid: true,
      url: trimmed,
    };
  } catch (error) {
    return {
      isValid: false,
      reason: 'Invalid URL format.',
      errorCode: 'INVALID_URL',
    };
  }
}

/**
 * Validate multiple URLs asynchronously and filter out invalid ones.
 * 
 * @param urls - Array of URL strings to validate
 * @param options - Optional validation overrides
 * @returns Object with valid URLs and rejection details
 * 
 * @example
 * ```typescript
 * const { validUrls, rejections } = await validateUrls(urls);
 * if (rejections.length > 0) {
 *   console.warn('Some URLs were rejected:', rejections);
 * }
 * ```
 */
export async function validateUrls(
  urls: string[],
  options: UrlValidationOptions = {}
): Promise<{ validUrls: string[]; rejections: SSRFValidationError[] }> {
  const validUrls: string[] = [];
  const rejections: SSRFValidationError[] = [];
  
  for (const url of urls) {
    const result = await validateUrl(url, options);
    if (result.isValid && result.url) {
      validUrls.push(result.url);
    } else {
      rejections.push({
        url: url.trim(),
        reason: result.reason ?? 'Unknown validation error',
        errorCode: result.errorCode,
      });
    }
  }
  
  return { validUrls, rejections };
}

/**
 * Get the current SSRF policy configuration status.
 * Useful for logging and debugging.
 */
export function getSsrfPolicyStatus(): {
  allowPrivateTargets: boolean;
  isDev: boolean;
  effectivePolicy: string;
} {
  return {
    allowPrivateTargets: ALLOW_PRIVATE_TARGETS,
    isDev: IS_DEV,
    effectivePolicy: ALLOW_PRIVATE_TARGETS
      ? 'PERMISSIVE (private targets allowed)'
      : IS_DEV
        ? 'STRICT (private targets blocked, set ALLOW_PRIVATE_TARGETS=true to enable)'
        : 'STRICT (private targets blocked)',
  };
}

// ─── Error Messages ───────────────────────────────────────────────────────────

/**
 * Standardized error messages for API responses.
 */
export const SSRF_ERROR_MESSAGES = {
  INVALID_URL: 'Invalid URL format. Please provide a properly formatted URL.',
  UNSUPPORTED_PROTOCOL: 'Unsupported protocol. Only http and https URLs are allowed.',
  PRIVATE_NETWORK_BLOCKED: IS_DEV
    ? 'Access to private/internal network addresses is restricted. Set ALLOW_PRIVATE_TARGETS=true in your environment to enable local development testing.'
    : 'Access to private/internal network addresses is not allowed for security reasons.',
  NO_VALID_URLS: 'No valid URLs provided. All submitted URLs were rejected due to validation errors.',
} as const;

/**
 * Formats SSRF validation errors into a human-readable string.
 * Useful for logging and debugging.
 */
export function formatValidationError(errors: SSRFValidationError[]): string {
  if (errors.length === 0) return '';
  return errors.map((e) => `${e.url}: ${e.message || e.reason || 'Unknown error'} (${e.code || e.errorCode || 'UNKNOWN'})`).join(", ");
}

/**
 * SSRF (Server-Side Request Forgery) Protection Policy
 * 
 * This module provides centralized URL validation to prevent SSRF attacks.
 * It blocks requests to private/internal network resources while allowing
 * explicit opt-in for local development.
 * 
 * @module lib/ssrf-policy
 */

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
const LOCALHOST_ALIASES = ['localhost', '0.0.0.0', '127.0.0.1', '[::1]'];

/**
 * Check if a hostname is a private IP address or internal network resource.
 * 
 * Blocks:
 * - localhost and loopback addresses (127.x.x.x, ::1)
 * - Private IPv4 ranges:
 *   - 10.0.0.0/8 (Class A private)
 *   - 172.16.0.0/12 (Class B private)
 *   - 192.168.0.0/16 (Class C private)
 *   - 169.254.0.0/16 (Link-local)
 *   - 0.0.0.0/8 (This network)
 * 
 * @param hostname - The hostname to check
 * @returns true if the hostname is a private/internal address
 */
export function isPrivateIp(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  
  // Check for localhost aliases
  if (LOCALHOST_ALIASES.includes(normalized)) {
    return true;
  }
  
  // Check for IPv4 private ranges
  const ipv4Match = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    
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
  }
  
  // Note: IPv6 private ranges could be added here if needed
  // For now, we focus on the most common IPv4 private ranges
  
  return false;
}

/**
 * Validate a single URL against the SSRF protection policy.
 * 
 * @param url - The URL string to validate
 * @param options - Optional validation overrides
 * @returns Validation result with details
 * 
 * @example
 * ```typescript
 * const result = validateUrl('https://example.com');
 * if (!result.isValid) {
 *   console.error(result.reason);
 * }
 * ```
 */
export function validateUrl(
  url: string,
  options: UrlValidationOptions = {}
): UrlValidationResult {
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
    if (!allowPrivate && isPrivateIp(parsed.hostname)) {
      return {
        isValid: false,
        reason: IS_DEV
          ? 'URL targets a private/internal network address. Set ALLOW_PRIVATE_TARGETS=true to allow in development.'
          : 'URL targets a private/internal network address which is not allowed.',
        errorCode: 'PRIVATE_NETWORK_BLOCKED',
      };
    }
    
    return {
      isValid: true,
      url: trimmed,
    };
  } catch (_error) {
    return {
      isValid: false,
      reason: 'Invalid URL format.',
      errorCode: 'INVALID_URL',
    };
  }
}

/**
 * Validate multiple URLs and filter out invalid ones.
 * 
 * @param urls - Array of URL strings to validate
 * @param options - Optional validation overrides
 * @returns Object with valid URLs and rejection details
 * 
 * @example
 * ```typescript
 * const { validUrls, rejections } = validateUrls(urls);
 * if (rejections.length > 0) {
 *   console.warn('Some URLs were rejected:', rejections);
 * }
 * ```
 */
export function validateUrls(
  urls: string[],
  options: UrlValidationOptions = {}
): { validUrls: string[]; rejections: SSRFValidationError[] } {
  const validUrls: string[] = [];
  const rejections: SSRFValidationError[] = [];
  
  for (const url of urls) {
    const result = validateUrl(url, options);
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

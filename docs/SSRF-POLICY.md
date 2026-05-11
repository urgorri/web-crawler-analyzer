# SSRF (Server-Side Request Forgery) Protection Policy

## Overview

This document defines the unified security policy implemented across the application to prevent SSRF attacks. The policy is enforced consistently in both the Next.js API layer (`src/app/api/crawls/route.ts`) and the crawler service (`mini-services/crawler-service/crawl.ts`).

## Security Objectives

1. **Prevent SSRF Attacks**: Block requests to private/internal network resources that could be exploited to access internal systems.
2. **Consistent Validation**: Apply the same URL validation logic across all entry points.
3. **Developer Experience**: Allow explicit opt-in for local development testing via environment variable.
4. **Clear Error Messages**: Provide consistent, user-friendly error messages when URLs are rejected.

## Policy Rules

### Allowed Protocols
- ✅ `http:` 
- ✅ `https:`
- ❌ All other protocols (ftp, file, gopher, etc.)

### Blocked Hostnames (Private/Internal Networks)

The following hostname patterns are blocked by default:

| Category | Pattern | Examples |
|----------|---------|----------|
| **Localhost** | `localhost`, `0.0.0.0`, `127.0.0.1`, `[::1]` | `http://localhost:3000` |
| **Class A Private** | `10.0.0.0/8` | `10.0.0.1`, `10.255.255.255` |
| **Loopback** | `127.0.0.0/8` | `127.0.0.1`, `127.1.2.3` |
| **This Network** | `0.0.0.0/8` | `0.0.0.1` |
| **Class B Private** | `172.16.0.0/12` | `172.16.0.1` - `172.31.255.255` |
| **Class C Private** | `192.168.0.0/16` | `192.168.0.1`, `192.168.255.255` |
| **Link-Local** | `169.254.0.0/16` | `169.254.1.1` |

### Development Override

In **development environments only**, you can allow private network targets by setting:

```bash
ALLOW_PRIVATE_TARGETS=true
```

⚠️ **Warning**: Never enable `ALLOW_PRIVATE_TARGETS` in production environments.

## Implementation

### Shared Library (`src/lib/ssrf-policy.ts`)

A centralized module provides consistent validation functions:

```typescript
import { validateUrl, validateUrls, SSRF_ERROR_MESSAGES } from '@/lib/ssrf-policy';

// Validate single URL
const result = validateUrl('https://example.com');
if (!result.isValid) {
  console.error(result.reason);
}

// Validate multiple URLs
const { validUrls, rejections } = validateUrls(urls);
```

### API Layer (`src/app/api/crawls/route.ts`)

The POST endpoint validates URLs before initiating a crawl:

```typescript
const { validUrls, rejections } = validateUrls(urls);

if (validUrls.length === 0) {
  return NextResponse.json(
    { error: formatValidationError(rejections) },
    { status: 400 }
  );
}
```

### Crawler Service (`mini-services/crawler-service/crawl.ts`)

The crawler applies the same validation logic with consistent `isPrivateIp()` implementation.

## Error Messages

### Standardized Responses

| Error Code | Message (Production) | Message (Development) |
|------------|---------------------|----------------------|
| `INVALID_URL` | Invalid URL format. Please provide a properly formatted URL. | Same |
| `UNSUPPORTED_PROTOCOL` | Unsupported protocol. Only http and https URLs are allowed. | Same |
| `PRIVATE_NETWORK_BLOCKED` | Access to private/internal network addresses is not allowed for security reasons. | Access to private/internal network addresses is restricted. Set ALLOW_PRIVATE_TARGETS=true in your environment to enable local development testing. |

### Example API Response

```json
{
  "error": "URL rejected: http://192.168.1.1 - Access to private/internal network addresses is not allowed for security reasons."
}
```

Multiple rejections:

```
3 URL(s) were rejected:
  • http://localhost:3000: Access to private/internal network addresses is not allowed...
  • ftp://example.com: Unsupported protocol. Only http and https URLs are allowed.
  • http://10.0.0.1: Access to private/internal network addresses is not allowed...
```

## Configuration

### Environment Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `ALLOW_PRIVATE_TARGETS` | `true`, `false` | `false` | Allow private network targets (dev only) |
| `NODE_ENV` | `development`, `production` | - | Determines error message verbosity |

### Recommended Setup

**.env.local** (for local development):
```bash
# Enable localhost testing during development
ALLOW_PRIVATE_TARGETS=true
NODE_ENV=development
```

**.env.production**:
```bash
# Never allow private targets in production
ALLOW_PRIVATE_TARGETS=false
NODE_ENV=production
```

## Testing

### Unit Test Examples

```typescript
import { validateUrl, isPrivateIp } from '@/lib/ssrf-policy';

// Valid public URLs
expect(validateUrl('https://example.com').isValid).toBe(true);
expect(validateUrl('http://api.github.com').isValid).toBe(true);

// Blocked private IPs
expect(validateUrl('http://localhost:3000').isValid).toBe(false);
expect(validateUrl('http://192.168.1.1').isValid).toBe(false);
expect(validateUrl('http://10.0.0.1').isValid).toBe(false);

// Invalid protocols
expect(validateUrl('ftp://example.com').isValid).toBe(false);
expect(validateUrl('file:///etc/passwd').isValid).toBe(false);
```

### Integration Test

```bash
# Test with private target blocking (default)
curl -X POST http://localhost:3000/api/crawls \
  -H "Content-Type: application/json" \
  -d '{"urls": ["http://localhost:3000"]}'

# Test with private targets allowed (dev only)
ALLOW_PRIVATE_TARGETS=true npm run dev
curl -X POST http://localhost:3000/api/crawls \
  -H "Content-Type: application/json" \
  -d '{"urls": ["http://localhost:3000"]}'
```

## Security Considerations

### Defense in Depth

1. **Input Validation**: All URLs are validated before processing
2. **Consistent Logic**: Same validation in API and crawler service
3. **Environment Isolation**: Private targets only allowed with explicit dev flag
4. **Logging**: Rejected URLs are logged for security monitoring

### Potential Attack Vectors Mitigated

- 🛡️ Access to internal metadata services (e.g., AWS EC2 metadata)
- 🛡️ Access to internal admin interfaces
- 🛡️ Port scanning of internal networks
- 🛡️ Access to local development servers from production
- 🛡️ File protocol abuse

## Maintenance

### Updating the Policy

To modify the SSRF protection rules:

1. Update `src/lib/ssrf-policy.ts` with new rules
2. Mirror changes in `mini-services/crawler-service/crawl.ts`
3. Update this documentation
4. Add/update tests
5. Review in security audit

### Code Synchronization

Both files must maintain identical logic for:
- `isPrivateIp()` function
- Protocol validation
- `ALLOW_PRIVATE_TARGETS` handling

Consider creating a shared package if the codebase grows.

## References

- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server-side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [CWE-918: Server-Side Request Forgery (SSRF)](https://cwe.mitre.org/data/definitions/918.html)
- RFC 1918 - Address Allocation for Private Internets

---

**Last Updated**: 2024  
**Policy Version**: 1.0  
**Owner**: Security Team

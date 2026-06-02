import { parse } from "tldts";

export function getHostnameFromUrl(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function getRegistrableDomainFromHostname(hostname: string | null | undefined): string | null {
  if (!hostname) return null;
  const parsed = parse(hostname);
  if (parsed.domain) return parsed.domain.toLowerCase();
  return hostname.toLowerCase();
}

export function getRegistrableDomainFromUrl(value: string): string | null {
  const hostname = getHostnameFromUrl(value);
  return getRegistrableDomainFromHostname(hostname);
}

export function isSameRegistrableDomain(left: string, right: string): boolean {
  const leftDomain = getRegistrableDomainFromUrl(left);
  const rightDomain = getRegistrableDomainFromUrl(right);
  return !!leftDomain && leftDomain === rightDomain;
}

import { promises as dns } from "node:dns";
import { parse } from "tldts";
import { whoisDomain, whoisIp as whoisIpLookup } from "whoiser";
import { ip as rdapIpLookup } from "node-rdap";
import Traceroute from "nodejs-traceroute";

export interface DomainDnsIntel {
  a: string[];
  aaaa: string[];
  ns: string[];
  mx: Array<{ exchange: string; priority: number }>;
  cname: string[];
  txt: string[];
}

export interface PortIntel {
  port: number;
  status: "open" | "closed" | "filtered" | "unknown";
  banner?: string | null;
  service?: string | null;
}

export interface TraceHop {
  hop: number;
  ip: string | null;
  rtt1?: string;
  rtt2?: string;
  rtt3?: string;
}

export interface DomainIntel {
  seedDomain: string;
  observedDomain: string | null;
  seedUrl: string;
  resolvedIps: string[];
  dns: DomainDnsIntel;
  whoisDomain: Record<string, unknown> | null;
  whoisIp: Record<string, unknown> | null;
  rdapIp: Record<string, unknown> | null;
  traceroute: TraceHop[];
  ports: PortIntel[];
  warnings: string[];
  errors: string[];
}

function registrableDomain(value: string): string {
  const parsed = parse(value);
  return (parsed.domain ?? value).toLowerCase();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function safeJson(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) return { items: value as unknown[] } as Record<string, unknown>;
  return value as Record<string, unknown>;
}

export function getSeedDomain(seedUrl: string): string {
  return registrableDomain(new URL(seedUrl).hostname);
}

export function getObservedDomain(urls: string[], fallback: string): string {
  const counts = new Map<string, number>();
  const order: string[] = [];

  for (const value of urls) {
    try {
      const hostname = new URL(value).hostname;
      const domain = registrableDomain(hostname);
      if (!counts.has(domain)) order.push(domain);
      counts.set(domain, (counts.get(domain) ?? 0) + 1);
    } catch {
      // ignore malformed values
    }
  }

  if (counts.size === 0) return fallback;

  let winner = fallback;
  let max = -1;

  for (const domain of order) {
    const score = counts.get(domain) ?? 0;
    if (score > max) {
      winner = domain;
      max = score;
    }
  }

  return winner;
}

export async function resolveDns(seedDomain: string, timeoutMs = 10_000): Promise<DomainDnsIntel> {
  const [a, aaaa, ns, mx, cname, txt] = await Promise.allSettled([
    withTimeout(dns.resolve4(seedDomain), timeoutMs, "DNS A"),
    withTimeout(dns.resolve6(seedDomain), timeoutMs, "DNS AAAA"),
    withTimeout(dns.resolveNs(seedDomain), timeoutMs, "DNS NS"),
    withTimeout(dns.resolveMx(seedDomain), timeoutMs, "DNS MX"),
    withTimeout(dns.resolveCname(seedDomain), timeoutMs, "DNS CNAME"),
    withTimeout(dns.resolveTxt(seedDomain), timeoutMs, "DNS TXT"),
  ]);

  return {
    a: a.status === "fulfilled" ? a.value : [],
    aaaa: aaaa.status === "fulfilled" ? aaaa.value : [],
    ns: ns.status === "fulfilled" ? ns.value : [],
    mx:
      mx.status === "fulfilled"
        ? mx.value.map((record) => ({ exchange: record.exchange, priority: record.priority }))
        : [],
    cname: cname.status === "fulfilled" ? cname.value : [],
    txt:
      txt.status === "fulfilled"
        ? txt.value.flatMap((chunkSet) => chunkSet.map((chunk) => Buffer.from(chunk).toString("utf8")))
        : [],
  };
}

export function selectPrimaryIp(dnsIntel: DomainDnsIntel): string | null {
  for (const ip of dnsIntel.a) {
    if (ip) return ip;
  }
  for (const ip of dnsIntel.aaaa) {
    if (ip) return ip;
  }
  return null;
}

export async function lookupWhois(seedDomain: string, ipAddress: string | null, timeoutMs = 12_000) {
  const [domainResult, ipResult] = await Promise.allSettled([
    withTimeout(whoisDomain(seedDomain), timeoutMs, "WHOIS domain"),
    ipAddress ? withTimeout(whoisIpLookup(ipAddress), timeoutMs, "WHOIS IP") : Promise.resolve(null),
  ]);

  return {
    domain: domainResult.status === "fulfilled" ? safeJson(domainResult.value as unknown) : null,
    ip: ipResult.status === "fulfilled" ? safeJson(ipResult.value as unknown) : null,
  };
}

export async function lookupRdapIp(ipAddress: string | null, timeoutMs = 12_000): Promise<Record<string, unknown> | null> {
  if (!ipAddress) return null;
  try {
    const result = await withTimeout(rdapIpLookup(ipAddress), timeoutMs, "RDAP IP");
    return safeJson(result);
  } catch {
    return null;
  }
}

export async function runTraceroute(target: string, timeoutMs = 30_000): Promise<TraceHop[]> {
  try {
    const tracer = new Traceroute();
    const hops: TraceHop[] = [];

    return await withTimeout(
      new Promise<TraceHop[]>((resolve, reject) => {
        tracer
          .on("hop", (hop: any) => {
            hops.push({
              hop: Number(hop?.hop) || hops.length + 1,
              ip: hop?.ip && hop.ip !== "*" ? String(hop.ip) : null,
              rtt1: hop?.rtt1 ? String(hop.rtt1) : undefined,
              rtt2: hop?.rtt2 ? String(hop.rtt2) : undefined,
              rtt3: hop?.rtt3 ? String(hop.rtt3) : undefined,
            });
          })
          .on("close", (code: number) => {
            if (code === 0 || code === null || code === undefined) {
              resolve(hops);
            } else {
              reject(new Error(`Traceroute exited with code ${code}`));
            }
          })
          .on("error", reject);

        tracer.trace(target);
      }),
      timeoutMs,
      "Traceroute",
    );
  } catch {
    return [];
  }
}

export async function scanPorts(
  targetIp: string | null,
  ports: number[],
  timeoutMs = 800,
): Promise<PortIntel[]> {
  if (!targetIp || ports.length === 0) return [];
  const portscannerModule: any = await import("portscanner");
  const portscanner = portscannerModule.default ?? portscannerModule;
  const grabModule: any = await import("grab.js");
  const grabber = grabModule.default ?? grabModule;

  const scanPromises = ports.map(async (port): Promise<PortIntel> => {
    try {
      const status = await withTimeout(
        new Promise<"open" | "closed" | "filtered" | "unknown">((resolve) => {
          portscanner.checkPortStatus(port, { host: targetIp, timeout: timeoutMs }, (_err: unknown, portStatus: string) => {
            resolve((portStatus as PortIntel["status"]) ?? "unknown");
          });
        }),
        timeoutMs + 200,
        `Port ${port}`,
      );

      let banner: string | null = null;
      let service: string | null = null;
      if (status === "open") {
        try {
          const record: any = await withTimeout(
            grabber.grab(targetIp, port, { timeout: timeoutMs }).run(),
            timeoutMs + 1_000,
            `Banner ${port}`,
          );
          const bannerText = Buffer.isBuffer(record?.banner) ? record.banner.toString("utf8").trim() : "";
          banner = bannerText ? bannerText.slice(0, 500) : null;
          service = banner ? banner.split("\n")[0].slice(0, 120) : null;
        } catch {
          banner = null;
          service = null;
        }
      }

      return { port, status, banner, service };
    } catch {
      return { port, status: "unknown" };
    }
  });

  const results = await Promise.all(scanPromises);
  return results;
}

export function flattenPageDomains(values: string[]): string[] {
  const domains: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    try {
      const domain = registrableDomain(new URL(value).hostname);
      if (!seen.has(domain)) {
        seen.add(domain);
        domains.push(domain);
      }
    } catch {
      // ignore malformed values
    }
  }

  return domains;
}

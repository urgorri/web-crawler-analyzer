import { promises as dns } from "node:dns";
import { parse } from "tldts";
import { whoisDomain, whoisIp as whoisIpLookup } from "whoiser";
import { ip as rdapIpLookup } from "node-rdap";
import Traceroute from "nodejs-traceroute";
function registrableDomain(value) {
    const parsed = parse(value);
    return (parsed.domain ?? value).toLowerCase();
}
function withTimeout(promise, timeoutMs, label) {
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
function toStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.map((item) => String(item)).filter(Boolean);
}
function safeJson(value) {
    if (!value || typeof value !== "object")
        return null;
    if (Array.isArray(value))
        return { items: value };
    return value;
}
export function getSeedDomain(seedUrl) {
    return registrableDomain(new URL(seedUrl).hostname);
}
export function getObservedDomain(urls, fallback) {
    const counts = new Map();
    const order = [];
    for (const value of urls) {
        try {
            const hostname = new URL(value).hostname;
            const domain = registrableDomain(hostname);
            if (!counts.has(domain))
                order.push(domain);
            counts.set(domain, (counts.get(domain) ?? 0) + 1);
        }
        catch {
            // ignore malformed values
        }
    }
    if (counts.size === 0)
        return fallback;
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
export async function resolveDns(seedDomain, timeoutMs = 10_000) {
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
        mx: mx.status === "fulfilled"
            ? mx.value.map((record) => ({ exchange: record.exchange, priority: record.priority }))
            : [],
        cname: cname.status === "fulfilled" ? cname.value : [],
        txt: txt.status === "fulfilled"
            ? txt.value.flatMap((chunkSet) => chunkSet.map((chunk) => Buffer.from(chunk).toString("utf8")))
            : [],
    };
}
export function selectPrimaryIp(dnsIntel) {
    for (const ip of dnsIntel.a) {
        if (ip)
            return ip;
    }
    for (const ip of dnsIntel.aaaa) {
        if (ip)
            return ip;
    }
    return null;
}
export async function lookupWhois(seedDomain, ipAddress, timeoutMs = 12_000) {
    const [domainResult, ipResult] = await Promise.allSettled([
        withTimeout(whoisDomain(seedDomain), timeoutMs, "WHOIS domain"),
        ipAddress ? withTimeout(whoisIpLookup(ipAddress), timeoutMs, "WHOIS IP") : Promise.resolve(null),
    ]);
    return {
        domain: domainResult.status === "fulfilled" ? safeJson(domainResult.value) : null,
        ip: ipResult.status === "fulfilled" ? safeJson(ipResult.value) : null,
    };
}
export async function lookupRdapIp(ipAddress, timeoutMs = 12_000) {
    if (!ipAddress)
        return null;
    try {
        const result = await withTimeout(rdapIpLookup(ipAddress), timeoutMs, "RDAP IP");
        return safeJson(result);
    }
    catch {
        return null;
    }
}
export async function runTraceroute(target, timeoutMs = 30_000) {
    try {
        const TracerClass = Traceroute;
        const tracer = new TracerClass();
        const hops = [];
        return await withTimeout(new Promise((resolve, reject) => {
            tracer
                .on("hop", (hop) => {
                hops.push({
                    hop: Number(hop?.hop) || hops.length + 1,
                    ip: hop?.ip && hop.ip !== "*" ? String(hop.ip) : null,
                    rtt1: hop?.rtt1 ? String(hop.rtt1) : undefined,
                    rtt2: hop?.rtt2 ? String(hop.rtt2) : undefined,
                    rtt3: hop?.rtt3 ? String(hop.rtt3) : undefined,
                });
            })
                .on("close", (code) => {
                if (code === 0 || code === null || code === undefined) {
                    resolve(hops);
                }
                else {
                    reject(new Error(`Traceroute exited with code ${code}`));
                }
            })
                .on("error", reject);
            tracer.trace(target);
        }), timeoutMs, "Traceroute");
    }
    catch {
        return [];
    }
}
export async function scanPorts(targetIp, ports, timeoutMs = 800) {
    if (!targetIp || ports.length === 0)
        return [];
    const portscannerModule = await import("portscanner");
    const portscanner = portscannerModule.default ?? portscannerModule;
    const grabModule = await import("grab.js");
    const grabber = grabModule.default ?? grabModule;
    const scanPromises = ports.map(async (port) => {
        try {
            const status = await withTimeout(new Promise((resolve) => {
                portscanner.checkPortStatus(port, { host: targetIp, timeout: timeoutMs }, (_err, portStatus) => {
                    resolve(portStatus ?? "unknown");
                });
            }), timeoutMs + 200, `Port ${port}`);
            let banner = null;
            let service = null;
            if (status === "open") {
                try {
                    const record = await withTimeout(grabber.grab(targetIp, port, { timeout: timeoutMs }).run(), timeoutMs + 1_000, `Banner ${port}`);
                    const bannerText = Buffer.isBuffer(record?.banner) ? record.banner.toString("utf8").trim() : "";
                    banner = bannerText ? bannerText.slice(0, 500) : null;
                    service = banner ? banner.split("\n")[0].slice(0, 120) : null;
                }
                catch {
                    banner = null;
                    service = null;
                }
            }
            return { port, status, banner, service };
        }
        catch {
            return { port, status: "unknown" };
        }
    });
    const results = await Promise.all(scanPromises);
    return results;
}
export function flattenPageDomains(values) {
    const domains = [];
    const seen = new Set();
    for (const value of values) {
        try {
            const domain = registrableDomain(new URL(value).hostname);
            if (!seen.has(domain)) {
                seen.add(domain);
                domains.push(domain);
            }
        }
        catch {
            // ignore malformed values
        }
    }
    return domains;
}

import { chromium } from "playwright";
import * as fs from "fs";
import {
  getObservedDomain,
  getSeedDomain,
  lookupRdapIp,
  lookupWhois,
  resolveDns,
  runTraceroute,
  scanPorts,
  selectPrimaryIp,
  type DomainIntel,
} from "./domain-intel.js";

// ─── SSRF Policy Configuration ────────────────────────────────────────────────

const ALLOW_PRIVATE_TARGETS = process.env.ALLOW_PRIVATE_TARGETS === 'true';
const IS_DEV = process.env.NODE_ENV === 'development';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrawlConfig {
  timeout?: number;
  userAgent?: string;
  maxPages?: number;
  headless?: boolean;
  waitNetwork?: number;
  concurrency?: number;
  portScanPorts?: number[];
}

export interface CrawlRequest {
  crawlId?: string;
  urls: string[];
  config?: CrawlConfig;
  scopeDomain?: string;
}

export interface PageResult {
  url: string;
  final_url: string;
  status_code: number;
  title: string;
  meta_description: string;
  canonical: string;
  robots_meta: string;
  lang: string;
  dir: string;
  charset: string;
  meta_generator: string;
  visible_text: string;
  // visible_text_raw: string;
  word_count: number;
  char_count: number;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  buttons: Array<{ text: string; type: string; aria_label: string; href?: string; name?: string; value?: string }>;
  links: { internal: Array<{ text: string; href: string; rel: string }>; external: Array<{ text: string; href: string; rel: string }> };
  forms: Array<{ action: string; method: string; fields: Array<{ name: string; type: string; label: string }> }>;
  images: Array<{ src: string; alt: string; width?: number; height?: number }>;
  scripts: string[];
  stylesheets: string[];
  resources: Array<{ type: string; url: string; size?: number }>;
  network: Array<{ url: string; method: string; status?: number; resourceType?: string; size?: number }>;
  structured_data: Record<string, unknown>[];
  body_classes: string[];
  html_classes: string[];
  tech_evidence: string[];
  load_time_ms: number;
  dom_content_loaded_ms: number;
  full_content_ready_ms: number;
  headers?: Record<string, string>;
  html?: string;
}

const DEFAULT_PORTS = [21, 22, 25, 53, 80, 110, 143, 443, 587, 8080, 8443, 3306, 5432, 6379];

// ─── Security ──────────────────────────────────────────────────────────────────

const SENSITIVE_PATTERNS = [
  /cookie[^;]*;?/gi, /token[=:][^\s&"']*/gi,
  /authorization[:=][^\s"']*/gi, /api[_-]?key[=:][^\s&"']*/gi,
  /password[=:][^\s&"']*/gi, /session[_-]?id[=:][^\s&"']*/gi,
];

export function sanitize(str: string): string {
  let r = str;
  for (const p of SENSITIVE_PATTERNS) r = r.replace(p, "[REDACTED]");
  return r;
}

/**
 * Check if a hostname is a private IP address or internal network resource.
 * Consistent with src/lib/ssrf-policy.ts
 */
export function isPrivateIp(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  
  // Check for localhost aliases
  if (["localhost", "0.0.0.0", "127.0.0.1", "[::1]"].includes(normalized)) {
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
  
  return false;
}

// ─── Tech evidence ─────────────────────────────────────────────────────────────

const LIB_PATTERNS = [
  "react", "vue", "angular", "jquery", "bootstrap", "tailwind", "next", "nuxt",
  "svelte", "gatsby", "remix", "astro", "webpack", "vite", "rollup", "esbuild",
  "three\\.js", "d3", "chart\\.js", "lodash", "moment", "axios", "algolia",
  "gtm", "ga\\.", "google-analytics", "fontawesome", "material-ui", "ant-design",
  "chakra", "tailwindcss", "styled-components", "emotion", "redux", "mobx",
  "pinia", "zustand", "firebase", "supabase", "wordpress", "drupal",
  "shopify", "squarespace", "wix",
];

const LIB_REGEXPS = LIB_PATTERNS.map((lib) => ({ lib, regex: new RegExp(lib, "i") }));

export function extractTechEvidence(page: PageResult): string[] {
  const evidence: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => { if (!seen.has(s)) { seen.add(s); evidence.push(s); } };
  for (const src of page.scripts) add(`script:${src}`);
  for (const href of page.stylesheets) add(`stylesheet:${href}`);
  if (page.meta_generator) add(`generator:${page.meta_generator}`);
  for (const url of [...page.scripts, ...page.stylesheets]) {
    const lower = url.toLowerCase();
    for (const { lib, regex } of LIB_REGEXPS) if (regex.test(lower)) add(`lib-url:${lib}`);
  }
  const domains = new Set<string>();
  for (const r of page.resources) { try { domains.add(new URL(r.url).hostname); } catch {} }
  for (const d of domains) add(`domain:${d}`);
  for (const sd of page.structured_data) if (sd["@type"]) add(`jsonld-type:${String(sd["@type"])}`);
  return evidence;
}

// ─── Page extraction ──────────────────────────────────────────────────────────

export async function crawlPage(browser: import("playwright").Browser, url: string, config: CrawlConfig): Promise<PageResult> {
  const timeout = config.timeout ?? 30000;
  const waitNetwork = config.waitNetwork ?? 2000;
  const ctxOpts: Record<string, unknown> = { ignoreHTTPSErrors: true, javaScriptEnabled: true };
  if (config.userAgent) ctxOpts.userAgent = config.userAgent;

  const context = await browser.newContext(ctxOpts as Parameters<typeof browser.newContext>[0]);
  const networkEntries: PageResult["network"] = [];
  const resourceEntries: PageResult["resources"] = [];

  context.on("request", (req) => {
    try { networkEntries.push({ url: sanitize(req.url()), method: req.method(), resourceType: req.resourceType() }); } catch {}
  });
  context.on("response", (res) => {
    try {
      const entry = networkEntries.find((n) => n.url === sanitize(res.url()));
      if (entry) { entry.status = res.status(); const cl = res.headers()["content-length"]; if (cl) entry.size = parseInt(cl, 10) || undefined; }
      const rt = res.request().resourceType();
      // Only include resources that are not already captured in specific arrays like images, scripts, or stylesheets
      if (["font", "media", "other"].includes(rt)) resourceEntries.push({ type: rt, url: sanitize(res.url()) });
    } catch {}
  });

  const page = await context.newPage();
  const startTime = performance.now();
  try {
    const gotoResponse = await page.goto(url, { timeout, waitUntil: "domcontentloaded" });
    const domContentLoadedTime = performance.now();
    await page.waitForTimeout(waitNetwork);
    const fullContentReadyTime = performance.now();
    const finalUrl = page.url();
    const status = gotoResponse?.status() ?? 200;

    const rawHeaders = gotoResponse?.headers() ?? {};
    const sanitizedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawHeaders)) {
      if (typeof value === "string") {
        if (/^(set-cookie|authorization)$/i.test(key)) {
          sanitizedHeaders[key.toLowerCase()] = "[REDACTED]";
        } else {
          sanitizedHeaders[key.toLowerCase()] = sanitize(value).substring(0, 4000);
        }
      }
    }

    let pageHtml = "";
    try {
      pageHtml = (await page.content()) || "";
      if (pageHtml.length > 250000) {
        pageHtml = pageHtml.substring(0, 250000);
      }
    } catch {
      pageHtml = "";
    }

    const extracted = await page.evaluate(() => {
      const getMeta = (n: string) => { const el = document.querySelector(`meta[name="${n}"]`) || document.querySelector(`meta[property="${n}"]`); return el?.getAttribute("content")?.trim() ?? ""; };
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() ?? "";
      const clone = document.body?.cloneNode(true) as HTMLElement | null;
      if (clone) clone.querySelectorAll("script, style, noscript").forEach((e) => e.remove());
      const rawText = clone?.innerText ?? "";
      const cleanText = rawText.replace(/\s+/g, " ").trim();
      const getH = (t: string) => Array.from(document.querySelectorAll(t)).map((e) => (e.textContent ?? "").trim()).filter(Boolean);

      const btns: PageResult["buttons"] = [];
      document.querySelectorAll("button, input[type='button'], input[type='submit'], input[type='reset'], [role='button']").forEach((el) => {
        const h = el as HTMLElement; const a = h.closest("a");
        btns.push({ text: (h.textContent ?? "").trim().substring(0, 200), type: (h.getAttribute("type") ?? h.tagName.toLowerCase()).substring(0, 50), aria_label: (h.getAttribute("aria-label") ?? "").substring(0, 200), href: a?.getAttribute("href")?.substring(0, 2000) ?? undefined, name: (h.getAttribute("name") ?? undefined), value: (h.getAttribute("value") ?? undefined) });
      });

      const ch = window.location.hostname;
      const il: PageResult["links"]["internal"] = [];
      const el_: PageResult["links"]["external"] = [];
      document.querySelectorAll("a[href]").forEach((e) => {
        const a = e as HTMLAnchorElement; const href = a.getAttribute("href") ?? "";
        if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
        try {
          const resolved = new URL(href, window.location.href).href;
          const obj = { text: (a.textContent ?? "").trim().substring(0, 200), href: resolved.substring(0, 2000), rel: (a.getAttribute("rel") ?? "").substring(0, 200) };
          const u = new URL(resolved); if (u.hostname === ch) il.push(obj); else el_.push(obj);
        } catch {}
      });

      const forms: PageResult["forms"] = [];
      document.querySelectorAll("form").forEach((fe) => {
        const f = fe as HTMLFormElement; const fields: PageResult["forms"][0]["fields"] = [];
        f.querySelectorAll("input, select, textarea").forEach((fi) => {
          const inp = fi as HTMLInputElement; const name = (inp.getAttribute("name") ?? "").trim();
          const type = (inp.getAttribute("type") ?? inp.tagName.toLowerCase()).toLowerCase().trim();
          if (!name) return;
          let label = ""; const le = document.querySelector(`label[for="${name}"]`);
          if (le) label = le.textContent?.trim() ?? ""; else { const pl = inp.closest("label"); if (pl) label = pl.textContent?.trim()?.substring(0, 100) ?? ""; }
          fields.push({ name: name.substring(0, 200), type: type.substring(0, 50), label: label.substring(0, 200) });
        });
        forms.push({ action: (f.getAttribute("action") ?? "").substring(0, 2000), method: (f.getAttribute("method") ?? "GET").toUpperCase(), fields: fields.slice(0, 100) });
      });

      const imgs: PageResult["images"] = [];
      const seenImgs = new Set<string>();
      document.querySelectorAll("img").forEach((ie) => {
        const i = ie as HTMLImageElement;
        if (!i.src || seenImgs.has(i.src)) return;
        seenImgs.add(i.src);
        imgs.push({ src: i.src.substring(0, 2000), alt: (i.alt ?? "").substring(0, 500), width: i.width || undefined, height: i.height || undefined });
      });

      const scripts: string[] = [];
      const seenScripts = new Set<string>();
      document.querySelectorAll("script[src]").forEach((s) => {
        const src = (s as HTMLScriptElement).getAttribute("src");
        if (src && !seenScripts.has(src)) {
          seenScripts.add(src);
          scripts.push(src.substring(0, 2000));
        }
      });

      const stylesheets: string[] = [];
      const seenStyles = new Set<string>();
      document.querySelectorAll("link[rel='stylesheet'][href]").forEach((s) => {
        const href = (s as HTMLLinkElement).getAttribute("href");
        if (href && !seenStyles.has(href)) {
          seenStyles.add(href);
          stylesheets.push(href.substring(0, 2000));
        }
      });
      const sd: Record<string, unknown>[] = [];
      document.querySelectorAll('script[type="application/ld+json"]').forEach((e) => { try { sd.push(JSON.parse((e.textContent ?? "").trim())); } catch {} });
      const bc = document.body?.className?.split(/\s+/).filter(Boolean) ?? [];
      const hc = document.documentElement?.className?.split(/\s+/).filter(Boolean) ?? [];
      return { title: (document.title ?? "").trim(), meta_description: getMeta("description"), canonical, robots_meta: getMeta("robots"), lang: (document.documentElement?.getAttribute("lang") ?? "").trim(), dir: (document.documentElement?.getAttribute("dir") ?? "").trim(), charset: document.characterSet ?? "", meta_generator: getMeta("generator"), cleanText, rawText, headings: { h1: getH("h1"), h2: getH("h2"), h3: getH("h3") }, buttons: btns, links: { internal: il, external: el_ }, forms, images: imgs.slice(0, 500), scripts, stylesheets, structured_data: sd.slice(0, 50), body_classes: bc, html_classes: hc };
    });

    const result: PageResult = {
      url: sanitize(url), final_url: sanitize(finalUrl), status_code: status,
      title: extracted.title, meta_description: extracted.meta_description.substring(0, 5000),
      canonical: extracted.canonical.substring(0, 2000), robots_meta: extracted.robots_meta,
      lang: extracted.lang, dir: extracted.dir, charset: extracted.charset,
      meta_generator: extracted.meta_generator.substring(0, 500),
      visible_text: extracted.cleanText.substring(0, 500000),
      // visible_text_raw: extracted.rawText.substring(0, 1000000),
      word_count: extracted.cleanText.split(/\s+/).filter(Boolean).length,
      char_count: extracted.cleanText.length,
      headings: extracted.headings, buttons: extracted.buttons, links: extracted.links,
      forms: extracted.forms, images: extracted.images, scripts: extracted.scripts,
      stylesheets: extracted.stylesheets, resources: resourceEntries.slice(0, 500),
      network: networkEntries.slice(0, 1000), structured_data: extracted.structured_data,
      body_classes: extracted.body_classes, html_classes: extracted.html_classes, tech_evidence: [],
      load_time_ms: Math.round(fullContentReadyTime - startTime),
      dom_content_loaded_ms: Math.round(domContentLoadedTime - startTime),
      full_content_ready_ms: Math.round(fullContentReadyTime - startTime),
      headers: sanitizedHeaders,
      html: pageHtml,
    };
    result.tech_evidence = extractTechEvidence(result);
    return result;
  } finally {
    await context.close();
  }
}

// ─── Input Parsing & URL Validation ──────────────────────────────────────────

export function parseInputRequest(rawInput: string): { body: CrawlRequest; config: CrawlConfig } {
  if (!rawInput || !rawInput.trim()) {
    throw new Error("CRAWLER_INPUT from stdin is empty");
  }

  let body: CrawlRequest;
  try {
    body = JSON.parse(rawInput);
  } catch {
    throw new Error("Invalid JSON in stdin");
  }

  if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
    throw new Error("urls array required");
  }

  const config: CrawlConfig = {
    timeout: body.config?.timeout ?? 30000,
    userAgent: body.config?.userAgent,
    maxPages: body.config?.maxPages ?? 50,
    headless: body.config?.headless ?? true,
    waitNetwork: body.config?.waitNetwork ?? 2000,
    concurrency: Math.min(body.config?.concurrency ?? 2, 5),
    portScanPorts: body.config?.portScanPorts,
  };

  return { body, config };
}

export function validateAndFilterUrls(
  rawUrls: string[],
  config: CrawlConfig,
  scopeDomain?: string
): { validUrls: string[]; warnings: string[]; seedDomain: string } {
  const urls = rawUrls.slice(0, config.maxPages ?? 50);
  const warnings: string[] = [];
  const validUrls: string[] = [];
  const seedDomain = scopeDomain?.trim().toLowerCase() || getSeedDomain(urls[0]);

  for (const url of urls) {
    try {
      const parsed = new URL(url);

      // Check protocol
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        warnings.push(`Invalid scheme: ${sanitize(url)}`);
        continue;
      }

      // Check for private/internal networks (unless explicitly allowed in dev)
      if (!ALLOW_PRIVATE_TARGETS && isPrivateIp(parsed.hostname)) {
        const blockReason = IS_DEV
          ? `Blocked (private network, set ALLOW_PRIVATE_TARGETS=true to allow): ${sanitize(url)}`
          : `Blocked (private network not allowed): ${sanitize(url)}`;
        warnings.push(blockReason);
        continue;
      }

      if (getSeedDomain(url) !== seedDomain) {
        warnings.push(`Out of scope: ${sanitize(url)} (crawl domain is ${seedDomain})`);
        continue;
      }

      validUrls.push(url);
    } catch {
      warnings.push(`Unparseable: ${sanitize(url)}`);
    }
  }

  return { validUrls, warnings, seedDomain };
}

// ─── Batch Execution ─────────────────────────────────────────────────────────

export async function executeCrawlBatch(
  browser: import("playwright").Browser,
  validUrls: string[],
  config: CrawlConfig,
  crawlId?: string
): Promise<{ pages: PageResult[]; errors: string[] }> {
  const pages: PageResult[] = [];
  const errors: string[] = [];
  const concurrency = config.concurrency ?? 2;

  for (let i = 0; i < validUrls.length; i += concurrency) {
    const batch = validUrls.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map((url) => crawlPage(browser, url, config)));
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        pages.push(result.value);
        /**
         * IPC Progress Reporting
         *
         * We use stderr to stream real-time progress updates to the parent process.
         * This decouples the crawler from the parent process's file system and
         * allows the parent to handle progress storage/broadcasting.
         *
         * (stdout is reserved exclusively for the final JSON result).
         */
        process.stderr.write(`PROGRESS_UPDATE:${JSON.stringify({
          crawlId,
          url: result.value.url,
          title: result.value.title,
          pageCount: pages.length,
          errorCount: errors.length,
          status: 'running',
        })}\n`);
      } else {
        const msg = result.reason?.message ?? String(result.reason);
        errors.push(`${sanitize(batch[j])}: ${sanitize(msg)}`);
        process.stderr.write(`PROGRESS_UPDATE:${JSON.stringify({
          crawlId,
          url: batch[j],
          error: msg,
          pageCount: pages.length,
          errorCount: errors.length,
          status: 'running',
        })}\n`);
      }
    }
  }

  return { pages, errors };
}

// ─── Domain Intelligence Gathering ───────────────────────────────────────────

export async function gatherCrawlDomainIntel(
  seedDomain: string,
  validUrls: string[],
  pages: PageResult[],
  config: CrawlConfig
): Promise<DomainIntel> {
  const observedDomain = getObservedDomain(
    pages.flatMap((page) => [page.final_url, page.url, page.canonical].filter(Boolean) as string[]),
    seedDomain,
  );

  const domainIntelErrors: string[] = [];
  let dnsIntel = {
    a: [] as string[],
    aaaa: [] as string[],
    ns: [] as string[],
    mx: [] as Array<{ exchange: string; priority: number }>,
    cname: [] as string[],
    txt: [] as string[],
  };
  let resolvedIps: string[] = [];
  let whoisDomain: Record<string, unknown> | null = null;
  let whoisIp: Record<string, unknown> | null = null;
  let rdapIp: Record<string, unknown> | null = null;
  let traceroute: DomainIntel["traceroute"] = [];
  let ports: DomainIntel["ports"] = [];

  try {
    dnsIntel = await resolveDns(seedDomain);
    resolvedIps = [...dnsIntel.a, ...dnsIntel.aaaa];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    domainIntelErrors.push(message);
  }

  const primaryIp = selectPrimaryIp(dnsIntel);

  try {
    const whois = await lookupWhois(seedDomain, primaryIp);
    whoisDomain = whois.domain;
    whoisIp = whois.ip;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    domainIntelErrors.push(message);
  }

  try {
    rdapIp = await lookupRdapIp(primaryIp);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    domainIntelErrors.push(message);
  }

  try {
    traceroute = await runTraceroute(primaryIp ?? seedDomain);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    domainIntelErrors.push(message);
  }

  try {
    ports = await scanPorts(primaryIp, config.portScanPorts ?? DEFAULT_PORTS);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    domainIntelErrors.push(message);
  }

  return {
    seedDomain,
    observedDomain,
    seedUrl: validUrls[0],
    resolvedIps,
    dns: dnsIntel,
    whoisDomain,
    whoisIp,
    rdapIp,
    traceroute,
    ports,
    warnings: [],
    errors: domainIntelErrors,
  };
}

// ─── Main Orchestrator ───────────────────────────────────────────────────────

export function readStdinInput(): string {
  return fs.readFileSync(0, "utf-8");
}

async function main() {
  let input = "";
  try {
    input = readStdinInput();
  } catch (_error) {
    process.stderr.write("Error: Failed to read from stdin\n");
    process.exit(1);
  }

  let parsedInput: ReturnType<typeof parseInputRequest>;
  try {
    parsedInput = parseInputRequest(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  }

  const { body, config } = parsedInput;
  const { validUrls, warnings, seedDomain } = validateAndFilterUrls(body.urls, config, body.scopeDomain);

  const slicedUrlsLength = body.urls.slice(0, config.maxPages ?? 50).length;

  if (validUrls.length === 0) {
    const result = {
      status: "partial",
      pages: [],
      errors: ["No valid URLs"],
      warnings,
      stats: { total: slicedUrlsLength, success: 0, failed: slicedUrlsLength },
    };
    process.stdout.write(JSON.stringify(result));
    return;
  }

  const pages: PageResult[] = [];
  const errors: string[] = [];

  const browser = await chromium.launch({ headless: config.headless });
  try {
    const crawlResult = await executeCrawlBatch(browser, validUrls, config, body.crawlId);
    pages.push(...crawlResult.pages);
    errors.push(...crawlResult.errors);
  } finally {
    await browser.close();
  }

  const domainIntel = await gatherCrawlDomainIntel(seedDomain, validUrls, pages, config);

  const output = {
    status: errors.length === 0 ? "completed" : "partial",
    pages,
    errors,
    warnings,
    domainIntel,
    stats: { total: slicedUrlsLength, success: pages.length, failed: errors.length },
  };
  process.stdout.write(JSON.stringify(output));
}

const isScriptExecution = () => {
  if (!process.argv[1]) return false;
  const script = process.argv[1].toLowerCase();
  return (
    script.endsWith("crawl.ts") ||
    script.endsWith("crawl.js") ||
    script.endsWith("index.ts") ||
    script.endsWith("index.js")
  );
};

if (isScriptExecution()) {
  main().catch((err) => {
    process.stderr.write(`Fatal: ${err.message}\n`);
    process.exit(1);
  });
}

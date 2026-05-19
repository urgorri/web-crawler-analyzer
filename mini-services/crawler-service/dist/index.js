import { chromium } from "playwright";
// ─── Security ──────────────────────────────────────────────────────────────────
const SENSITIVE_PATTERNS = [
    /cookie[^;]*;?/gi,
    /token[=:][^\s&"']*/gi,
    /authorization[:=][^\s"']*/gi,
    /api[_-]?key[=:][^\s&"']*/gi,
    /password[=:][^\s&"']*/gi,
];
function sanitize(str) {
    let result = str;
    for (const p of SENSITIVE_PATTERNS)
        result = result.replace(p, "[REDACTED]");
    return result;
}
function isPrivateIp(hostname) {
    const blocked = ["localhost", "0.0.0.0", "127.0.0.1", "[::1]"];
    if (blocked.includes(hostname.toLowerCase()))
        return true;
    const m = hostname.toLowerCase().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (m) {
        const [, a, b] = m.map(Number);
        if (a === 10 || a === 127 || a === 0)
            return true;
        if (a === 172 && b >= 16 && b <= 31)
            return true;
        if (a === 192 && b === 168)
            return true;
        if (a === 169 && b === 254)
            return true;
    }
    return false;
}
// ─── Tech evidence ─────────────────────────────────────────────────────────────
const LIB_PATTERNS = [
    "react", "vue", "angular", "jquery", "bootstrap", "tailwind",
    "next", "nuxt", "svelte", "gatsby", "remix", "astro",
    "webpack", "vite", "rollup", "esbuild",
    "three\\.js", "d3", "chart\\.js", "lodash", "moment",
    "axios", "algolia", "gtm", "ga\\.", "google-analytics",
    "fontawesome", "material-ui", "ant-design", "chakra",
    "tailwindcss", "styled-components", "emotion",
    "redux", "mobx", "pinia", "zustand",
    "firebase", "supabase",
    "wordpress", "drupal", "shopify", "squarespace", "wix",
];
function extractTechEvidence(page) {
    const evidence = [];
    const seen = new Set();
    const add = (s) => { if (!seen.has(s)) {
        seen.add(s);
        evidence.push(s);
    } };
    for (const src of page.scripts)
        add(`script:${src}`);
    for (const href of page.stylesheets)
        add(`stylesheet:${href}`);
    if (page.meta_generator)
        add(`generator:${page.meta_generator}`);
    for (const url of [...page.scripts, ...page.stylesheets]) {
        const lower = url.toLowerCase();
        for (const lib of LIB_PATTERNS) {
            if (new RegExp(lib, "i").test(lower))
                add(`lib-url:${lib}`);
        }
    }
    const domains = new Set();
    for (const r of page.resources) {
        try {
            domains.add(new URL(r.url).hostname);
        }
        catch { /* skip */ }
    }
    for (const d of domains)
        add(`domain:${d}`);
    for (const sd of page.structured_data) {
        if (sd["@type"])
            add(`jsonld-type:${String(sd["@type"])}`);
    }
    return evidence;
}
// ─── Page extraction ──────────────────────────────────────────────────────────
async function crawlPage(browser, url, config) {
    const timeout = config.timeout ?? 30000;
    const waitNetwork = config.waitNetwork ?? 2000;
    const ctxOpts = {
        ignoreHTTPSErrors: true,
        javaScriptEnabled: true,
    };
    if (config.userAgent)
        ctxOpts.userAgent = config.userAgent;
    const context = await browser.newContext(ctxOpts);
    const networkEntries = [];
    const resourceEntries = [];
    context.on("request", (req) => {
        try {
            networkEntries.push({ url: sanitize(req.url()), method: req.method(), resourceType: req.resourceType() });
        }
        catch { /* skip */ }
    });
    context.on("response", (res) => {
        try {
            const entry = networkEntries.find((n) => n.url === sanitize(res.url()));
            if (entry) {
                entry.status = res.status();
                const cl = res.headers()["content-length"];
                if (cl)
                    entry.size = parseInt(cl, 10) || undefined;
            }
            const rt = res.request().resourceType();
            if (["image", "font", "media", "other"].includes(rt)) {
                resourceEntries.push({ type: rt, url: sanitize(res.url()) });
            }
        }
        catch { /* skip */ }
    });
    const page = await context.newPage();
    try {
        const gotoResponse = await page.goto(url, { timeout, waitUntil: "domcontentloaded" });
        await page.waitForTimeout(waitNetwork);
        const finalUrl = page.url();
        const status = gotoResponse?.status() ?? 200;
        const extracted = await page.evaluate(() => {
            const getMeta = (name) => {
                const el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
                return el?.getAttribute("content")?.trim() ?? "";
            };
            const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() ?? "";
            const clone = document.body?.cloneNode(true);
            if (clone)
                clone.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
            const rawText = clone?.innerText ?? "";
            const cleanText = rawText.replace(/\s+/g, " ").trim();
            const getHeadings = (tag) => Array.from(document.querySelectorAll(tag)).map((el) => (el.textContent ?? "").trim()).filter(Boolean);
            const buttons = [];
            document.querySelectorAll("button, input[type='button'], input[type='submit'], input[type='reset'], [role='button']").forEach((el) => {
                const h = el;
                const a = h.closest("a");
                buttons.push({
                    text: (h.textContent ?? "").trim().substring(0, 200),
                    type: (h.getAttribute("type") ?? h.tagName.toLowerCase()).substring(0, 50),
                    aria_label: (h.getAttribute("aria-label") ?? "").substring(0, 200),
                    href: a?.getAttribute("href")?.substring(0, 2000) ?? undefined,
                    name: (h.getAttribute("name") ?? undefined),
                    value: (h.getAttribute("value") ?? undefined),
                });
            });
            const currentHost = window.location.hostname;
            const internal = [];
            const external = [];
            document.querySelectorAll("a[href]").forEach((el) => {
                const anchor = el;
                const href = anchor.getAttribute("href") ?? "";
                if (!href || href.startsWith("#") || href.startsWith("javascript:"))
                    return;
                try {
                    const resolved = new URL(href, window.location.href).href;
                    const obj = { text: (anchor.textContent ?? "").trim().substring(0, 200), href: resolved.substring(0, 2000), rel: (anchor.getAttribute("rel") ?? "").substring(0, 200) };
                    const urlObj = new URL(resolved);
                    if (urlObj.hostname === currentHost)
                        internal.push(obj);
                    else
                        external.push(obj);
                }
                catch { /* skip */ }
            });
            const forms = [];
            document.querySelectorAll("form").forEach((formEl) => {
                const form = formEl;
                const fields = [];
                form.querySelectorAll("input, select, textarea").forEach((fieldEl) => {
                    const f = fieldEl;
                    const name = (f.getAttribute("name") ?? "").trim();
                    const type = (f.getAttribute("type") ?? f.tagName.toLowerCase()).toLowerCase().trim();
                    if (!name)
                        return;
                    let label = "";
                    const labelEl = document.querySelector(`label[for="${name}"]`);
                    if (labelEl)
                        label = labelEl.textContent?.trim() ?? "";
                    else {
                        const pl = f.closest("label");
                        if (pl)
                            label = pl.textContent?.trim()?.substring(0, 100) ?? "";
                    }
                    fields.push({ name: name.substring(0, 200), type: type.substring(0, 50), label: label.substring(0, 200) });
                });
                forms.push({ action: (form.getAttribute("action") ?? "").substring(0, 2000), method: (form.getAttribute("method") ?? "GET").toUpperCase(), fields: fields.slice(0, 100) });
            });
            const images = [];
            document.querySelectorAll("img").forEach((imgEl) => {
                const img = imgEl;
                if (!img.src)
                    return;
                images.push({ src: img.src.substring(0, 2000), alt: (img.alt ?? "").substring(0, 500), width: img.width || undefined, height: img.height || undefined });
            });
            const scripts = [];
            document.querySelectorAll("script[src]").forEach((s) => { const src = s.getAttribute("src"); if (src)
                scripts.push(src.substring(0, 2000)); });
            const stylesheets = [];
            document.querySelectorAll("link[rel='stylesheet'][href]").forEach((s) => { const href = s.getAttribute("href"); if (href)
                stylesheets.push(href.substring(0, 2000)); });
            const structuredData = [];
            document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => { try {
                structuredData.push(JSON.parse((el.textContent ?? "").trim()));
            }
            catch { /* skip */ } });
            const bodyClasses = document.body?.className?.split(/\s+/).filter(Boolean) ?? [];
            const htmlClasses = document.documentElement?.className?.split(/\s+/).filter(Boolean) ?? [];
            return { title: (document.title ?? "").trim(), meta_description: getMeta("description"), canonical, robots_meta: getMeta("robots"), lang: (document.documentElement?.getAttribute("lang") ?? "").trim(), dir: (document.documentElement?.getAttribute("dir") ?? "").trim(), charset: document.characterSet ?? "", meta_generator: getMeta("generator"), cleanText, rawText, headings: { h1: getHeadings("h1"), h2: getHeadings("h2"), h3: getHeadings("h3") }, buttons, links: { internal, external }, forms, images: images.slice(0, 500), scripts, stylesheets, structured_data: structuredData.slice(0, 50), body_classes: bodyClasses, html_classes: htmlClasses };
        });
        const result = {
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
        };
        result.tech_evidence = extractTechEvidence(result);
        return result;
    }
    finally {
        await context.close();
    }
}
// ─── Crawl handler ────────────────────────────────────────────────────────────
async function handleCrawl(body) {
    const config = {
        timeout: body.config?.timeout ?? 30000,
        userAgent: body.config?.userAgent,
        maxPages: body.config?.maxPages ?? 50,
        headless: body.config?.headless ?? true,
        waitNetwork: body.config?.waitNetwork ?? 2000,
        concurrency: body.config?.concurrency ?? 2,
    };
    const urls = body.urls.slice(0, config.maxPages ?? 50);
    const warnings = [];
    const validUrls = [];
    for (const url of urls) {
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
                warnings.push(`Invalid scheme: ${sanitize(url)}`);
                continue;
            }
            if (isPrivateIp(parsed.hostname)) {
                warnings.push(`Blocked private URL: ${sanitize(url)}`);
                continue;
            }
            validUrls.push(url);
        }
        catch {
            warnings.push(`Unparseable URL: ${sanitize(url)}`);
        }
    }
    if (validUrls.length === 0) {
        return { status: "partial", pages: [], errors: ["No valid URLs"], warnings, stats: { total: urls.length, success: 0, failed: urls.length } };
    }
    const pages = [];
    const errors = [];
    const concurrency = Math.min(config.concurrency ?? 2, 5);
    const browser = await chromium.launch({ headless: config.headless });
    try {
        for (let i = 0; i < validUrls.length; i += concurrency) {
            const batch = validUrls.slice(i, i + concurrency);
            const results = await Promise.allSettled(batch.map((url) => crawlPage(browser, url, config)));
            for (let j = 0; j < results.length; j++) {
                if (results[j].status === "fulfilled")
                    pages.push(results[j].value);
                else {
                    const errMsg = results[j].reason?.message ?? String(results[j].reason);
                    errors.push(`Failed: ${sanitize(batch[j])}: ${sanitize(errMsg)}`);
                }
            }
        }
    }
    finally {
        await browser.close();
    }
    return {
        status: errors.length === 0 ? "completed" : "partial",
        pages, errors, warnings,
        stats: { total: urls.length, success: pages.length, failed: errors.length },
    };
}
// ─── HTTP Server ──────────────────────────────────────────────────────────────
const PORT = 3003;
const MAX_BODY_SIZE = 10 * 1024 * 1024;
const server = Bun.serve({
    port: PORT,
    async fetch(req) {
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };
        if (req.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
        }
        // Health check
        if (req.method === "GET" && new URL(req.url).pathname === "/health") {
            return new Response(JSON.stringify({ status: "ok", port: PORT }), {
                headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }
        if (req.method !== "POST") {
            return new Response(JSON.stringify({ error: "Method not allowed" }), {
                status: 405, headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }
        const contentLength = req.headers.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
            return new Response(JSON.stringify({ error: "Body too large" }), {
                status: 413, headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }
        try {
            const body = (await req.json());
            if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
                return new Response(JSON.stringify({ error: "Include non-empty 'urls' array" }), {
                    status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
                });
            }
            console.log(`[Crawler] Received ${body.urls.length} URL(s)`);
            const result = await handleCrawl(body);
            console.log(`[Crawler] Done: ${result.stats.success} ok, ${result.stats.failed} fail`);
            return new Response(JSON.stringify(result), {
                status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            console.error(`[Crawler] Error: ${sanitize(msg)}`);
            return new Response(JSON.stringify({ error: sanitize(msg) }), {
                status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
            });
        }
    },
});
// Keep alive
process.stdin.resume();
process.on("unhandledRejection", (r) => console.error("[Crawler] Unhandled:", r));
process.on("uncaughtException", (e) => console.error("[Crawler] Uncaught:", e));
console.log(`[Crawler] Service running on port ${PORT}`);

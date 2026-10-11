# WebScope — Crawler Engine & Network Intelligence Mini-Service

A standalone, high-performance web crawler and domain intelligence engine powered by [Playwright](https://playwright.dev/) (Chromium) and native Node.js networking tools.

---

## Architecture & Decoupling

This mini-service is completely decoupled from the Next.js frontend and web server. It can be executed:
1. **As a background subprocess** spawned by the Next.js API runner (`src/lib/crawler/runner.ts`).
2. **As an autonomous CLI worker** by piping JSON into `stdin` and reading JSON from `stdout`.
3. **As a standalone worker daemon** in custom pipelines, Python scripts, or CI workflows.

---

## Input / Output Protocol (IPC)

The crawler communicates strictly through standard streams:

### 1. Input (`stdin`)
Accepts a JSON payload adhering to `CrawlRequest`:
```json
{
  "crawlId": "custom-uuid-optional",
  "urls": ["https://example.com", "https://example.com/about"],
  "config": {
    "timeout": 30000,
    "maxPages": 50,
    "concurrency": 2,
    "headless": true,
    "waitNetwork": 2000,
    "userAgent": "WebScope/1.0"
  }
}
```

### 2. Streaming Progress (`stderr`)
During execution, real-time progress lines are emitted to `stderr` prefixed with `PROGRESS_UPDATE:`:
```
PROGRESS_UPDATE:{"crawlId":"...","url":"https://example.com","title":"Example","pageCount":1,"errorCount":0,"status":"running"}
```

### 3. Final Output (`stdout`)
Upon completion, the full deterministic crawl record is written exclusively to `stdout` as JSON:
```json
{
  "status": "completed",
  "pages": [ ... ],
  "domainIntel": { ... },
  "errors": [],
  "warnings": [],
  "stats": { "total": 2, "success": 2, "failed": 0 }
}
```

---

## Standalone Usage

### Build
From repository root or this directory:
```bash
npm run build
```
*(Compiles TypeScript to `dist/`)*

### Run via CLI
```bash
echo '{"urls":["https://example.com"],"config":{"headless":true}}' | node dist/crawl.js
```

Or run in development mode directly with `tsx`:
```bash
echo '{"urls":["https://example.com"]}' | npm run dev
```

---

## Network & Domain Intelligence

The engine isolates network intelligence probes in [domain-intel.ts](domain-intel.ts):
- **DNS Records**: Resolves A, AAAA, MX, NS, CNAME, and TXT records.
- **WHOIS & RDAP**: Domain registration and IP network delegation lookups.
- **Traceroute**: Network path hop latency (skippable via `DISABLE_TRACEROUTE=true`).
- **Port Scanner**: TCP probe for standard ports 21, 22, 25, 53, 80, 443, 3306, 5432, 6379, etc. (skippable via `DISABLE_PORT_SCAN=true`).

---

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `ALLOW_PRIVATE_TARGETS` | `false` | When `true`, permits crawling localhost and RFC-1918 private IP addresses. |
| `DISABLE_TRACEROUTE` | `false` | Bypasses traceroute execution in sandboxed or permission-restricted environments. |
| `DISABLE_PORT_SCAN` | `false` | Bypasses TCP port scans in restricted firewalls. |
| `PLAYWRIGHT_BROWSERS_PATH` | System default | Custom directory for cached Playwright browser binaries. |

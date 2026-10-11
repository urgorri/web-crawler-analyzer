// Types shared between API routes for crawler page data

export interface PageData {
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
  buttons: Array<{
    text: string;
    type: string;
    aria_label: string;
    href?: string;
    name?: string;
    value?: string;
  }>;
  links: {
    internal: Array<{ text: string; href: string; rel: string }>;
    external: Array<{ text: string; href: string; rel: string }>;
  };
  forms: Array<{
    action: string;
    method: string;
    fields: Array<{ name: string; type: string; label: string }>;
  }>;
  images: Array<{
    src: string;
    alt: string;
    width?: number;
    height?: number;
    naturalWidth?: number;
    naturalHeight?: number;
  }>;
  scripts: string[];
  stylesheets: string[];
  resources: Array<{ type: string; url: string; size?: number }>;
  network: Array<{
    url: string;
    method: string;
    status?: number;
    resourceType?: string;
    size?: number;
  }>;
  structured_data: Record<string, unknown>[];
  body_classes: string[];
  html_classes: string[];
  tech_evidence: string[];
  loadTimeMs?: number;
  domContentLoadedMs?: number;
  fullContentReadyMs?: number;
  error?: string | null;
  scrapedAt?: string;
}

export interface DomainIntel {
  seedDomain: string;
  observedDomain: string | null;
  seedUrl: string;
  resolvedIps: string[];
  dns: {
    a: string[];
    aaaa: string[];
    ns: string[];
    mx: Array<{ exchange: string; priority: number }>;
    cname: string[];
    txt: string[];
  };
  whoisDomain: Record<string, unknown> | null;
  whoisIp: Record<string, unknown> | null;
  rdapIp: Record<string, unknown> | null;
  traceroute: Array<{
    hop: number;
    ip: string | null;
    rtt1?: string;
    rtt2?: string;
    rtt3?: string;
  }>;
  ports: Array<{
    port: number;
    status: "open" | "closed" | "filtered" | "unknown";
    banner?: string | null;
    service?: string | null;
  }>;
  warnings: string[];
  errors: string[];
}

// ─── V2 Optimized Schema (Normalized) ─────────────────────────────────────────

export interface NormalizedPageData {
  url: string;
  finalUrl: string | null;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  lang: string | null;
  dir: string | null;
  charset: string | null;
  metaGenerator: string | null;
  visibleText: string | null;
  wordCount: number;
  charCount: number;
  loadTimeMs?: number;
  domContentLoadedMs?: number;
  fullContentReadyMs?: number;
  error?: string | null;
  scrapedAt?: string;

  // Reference IDs
  headingIds: { h1: string[]; h2: string[]; h3: string[] };
  buttonIds: string[];
  linkIds: {
    internal: string[];
    external: string[];
  };
  scriptIds: string[];
  stylesheetIds: string[];
  techIds: string[];
  bodyClassIds: string[];
  htmlClassIds: string[];
  imageIds: string[];
  formIds: string[];
  resourceIds: string[];
  networkIds: string[];
  structuredDataIds: string[];
}

export interface CrawlEntities {
  links: Record<string, { text: string; href: string; rel: string }>;
  technologies: Record<string, string>;
  buttons: Record<string, {
    text: string;
    type: string;
    aria_label: string;
    href?: string;
    name?: string;
    value?: string;
  }>;
  headings: Record<string, string>;
  scripts: Record<string, string>;
  stylesheets: Record<string, string>;
  classes: Record<string, string>;
  images: Record<string, {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    naturalWidth?: number;
    naturalHeight?: number;
  }>;
  forms: Record<string, {
    action: string;
    method: string;
    fields: Array<{ name: string; type: string; label: string }>;
  }>;
  resources: Record<string, { type: string; url: string; size?: number }>;
  network: Record<string, {
    url: string;
    method: string;
    status?: number;
    resourceType?: string;
    size?: number;
  }>;
  structuredData: Record<string, Record<string, unknown>>;
}

export interface NormalizedCrawl {
  schemaVersion: 4;
  id: string;
  name: string;
  status: string;
  seedCount: number;
  pageCount: number;
  errorCount: number;
  startedAt: string;
  completedAt: string | null;
  urls: string[];
  config: Record<string, unknown> | null;
  engine: string;
  domainIntel?: DomainIntel | null;
  warnings: string[];
  errors: string[];
  pages: NormalizedPageData[];
  entities: CrawlEntities;
  avgLoadTimeMs?: number;
  minLoadTimeMs?: number;
  maxLoadTimeMs?: number;
  p95LoadTimeMs?: number;
  dedupStats: {
    rawBytesEstimate: number;
    optimizedBytesEstimate: number;
    reductionPercentage: number;
  };
}

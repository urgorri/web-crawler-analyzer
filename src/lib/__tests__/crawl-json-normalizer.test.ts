import { describe, it, expect } from 'vitest';
import { normalizeCrawl } from "../crawl-json-normalizer";
import { CrawlRecord } from "../crawl-storage";

const mockCrawl: CrawlRecord = {
  id: "test-id",
  name: "Test Crawl",
  status: "completed",
  seedCount: 1,
  pageCount: 3,
  errorCount: 0,
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  urls: ["https://example.com"],
  config: null,
  engine: "playwright",
  domainIntel: {
    seedDomain: "example.com",
    observedDomain: "example.com",
    seedUrl: "https://example.com",
    resolvedIps: ["93.184.216.34"],
    dns: {
      a: ["93.184.216.34"],
      aaaa: [],
      ns: ["ns1.example.com"],
      mx: [],
      cname: [],
      txt: [],
    },
    whoisDomain: null,
    whoisIp: null,
    rdapIp: null,
    traceroute: [],
    ports: [],
    warnings: [],
    errors: [],
  },
  warnings: [],
  errors: [],
  lastErrorStage: null,
  pages: [
    {
      url: "https://example.com/1",
      title: "Page 1",
      headings: { h1: ["Welcome"], h2: ["Subtitle"], h3: [] },
      links: {
        internal: [{ text: "Home", href: "/", rel: "" }],
        external: [{ text: "Google", href: "https://google.com", rel: "nofollow" }],
      },
      buttons: [{ text: "Click me", type: "button", aria_label: "Click" }],
      scripts: ["https://example.com/shared.js", "https://example.com/1.js"],
      stylesheets: ["https://example.com/shared.css"],
      tech_evidence: ["React", "Tailwind"],
      body_classes: ["bg-white", "text-black"],
      images: [{ src: "/logo.png", alt: "Logo" }],
      forms: [{ action: "/login", method: "POST", fields: [] }],
      resources: [{ type: "image", url: "/logo.png" }],
      network: [{ url: "/api/data", method: "GET", status: 200 }],
      structured_data: [{ "@type": "WebSite", name: "Example" }],
      loadTimeMs: 1200,
      domContentLoadedMs: 800,
      fullContentReadyMs: 1200,
    },
    {
      url: "https://example.com/2",
      title: "Page 2",
      headings: { h1: ["Welcome"], h2: ["Another Subtitle"], h3: [] },
      links: {
        internal: [{ text: "Home", href: "/", rel: "" }],
        external: [{ text: "Bing", href: "https://bing.com", rel: "" }],
      },
      buttons: [{ text: "Click me", type: "button", aria_label: "Click" }],
      scripts: ["https://example.com/shared.js", "https://example.com/2.js"],
      stylesheets: ["https://example.com/shared.css"],
      tech_evidence: ["React", "Framer Motion"],
      body_classes: ["bg-white", "p-4"],
      images: [{ src: "/logo.png", alt: "Logo" }, { src: "/p2.png", alt: "P2" }],
      forms: [{ method: "POST", action: "/login", fields: [] }], // Key order swapped
      resources: [{ type: "image", url: "/logo.png" }],
      network: [{ url: "/api/data", method: "GET", status: 200 }],
      structured_data: [{ name: "Example", "@type": "WebSite" }], // Key order swapped
      loadTimeMs: 1500,
      domContentLoadedMs: 1000,
      fullContentReadyMs: 1500,
    },
    {
      url: "https://example.com/3",
      title: "Page 3",
      headings: { h1: ["Contact"], h2: ["Subtitle"], h3: [] },
      links: {
        internal: [{ text: "Home", href: "/", rel: "" }],
        external: [{ text: "Google", href: "https://google.com", rel: "nofollow" }],
      },
      buttons: [{ text: "Submit", type: "submit", aria_label: "Submit" }],
      scripts: ["https://example.com/shared.js"],
      stylesheets: ["https://example.com/shared.css"],
      tech_evidence: ["React", "Tailwind"],
      body_classes: ["bg-white", "text-black"],
      images: [{ src: "/logo.png", alt: "Logo" }],
      forms: [{ action: "/login", method: "POST", fields: [] }],
      resources: [{ type: "image", url: "/logo.png" }],
      network: [{ url: "/api/data", method: "GET", status: 200 }],
      structured_data: [{ "@type": "WebSite", name: "Example" }],
      loadTimeMs: 1000,
      domContentLoadedMs: 600,
      fullContentReadyMs: 1000,
    },
  ],
  avgLoadTimeMs: 1233,
  minLoadTimeMs: 1000,
  maxLoadTimeMs: 1500,
  p95LoadTimeMs: 1500,
};

describe("normalizeCrawl", () => {
  it("normalizes crawl records and deduplicates shared entities", () => {
    const normalized = normalizeCrawl(mockCrawl);

    // Verify entities
    const sharedH1 = normalized.pages[0].headingIds.h1[0];
    const page2H1 = normalized.pages[1].headingIds.h1[0];
    const page3H1 = normalized.pages[2].headingIds.h1[0];

    expect(sharedH1).toBe(page2H1);
    expect(sharedH1).not.toBe(page3H1);

    const sharedLink = normalized.pages[0].linkIds.internal[0];
    const page2Link = normalized.pages[1].linkIds.internal[0];
    expect(sharedLink).toBe(page2Link);

    const sharedScript = normalized.pages[0].scriptIds[0];
    const page2Script = normalized.pages[1].scriptIds[0];
    expect(sharedScript).toBe(page2Script);

    const sharedTech = normalized.pages[0].techIds[0]; // React
    const page2Tech = normalized.pages[1].techIds[0]; // React
    expect(sharedTech).toBe(page2Tech);

    const sharedClass = normalized.pages[0].bodyClassIds[0]; // bg-white
    const page2Class = normalized.pages[1].bodyClassIds[0]; // bg-white
    expect(sharedClass).toBe(page2Class);

    const sharedImage = normalized.pages[0].imageIds[0];
    const page2Image = normalized.pages[1].imageIds[0];
    expect(sharedImage).toBe(page2Image);

    const sharedForm = normalized.pages[0].formIds[0];
    const page2Form = normalized.pages[1].formIds[0];
    expect(sharedForm).toBe(page2Form);

    const sharedResource = normalized.pages[0].resourceIds[0];
    const page2Resource = normalized.pages[1].resourceIds[0];
    expect(sharedResource).toBe(page2Resource);

    const sharedNetwork = normalized.pages[0].networkIds[0];
    const page2Network = normalized.pages[1].networkIds[0];
    expect(sharedNetwork).toBe(page2Network);

    const sharedSD = normalized.pages[0].structuredDataIds[0];
    const page2SD = normalized.pages[1].structuredDataIds[0];
    expect(sharedSD).toBe(page2SD);

    // Verify output case
    expect(normalized.pages[0].loadTimeMs).toBe(1200);
    expect(normalized.avgLoadTimeMs).toBe(1233);

    expect(normalized.pages[0].title).toBe("Page 1");
    expect(normalized.pages[0].techIds.length).toBe(2);

    // Verify counts
    expect(Object.keys(normalized.entities.headings).length).toBe(4);
    expect(Object.keys(normalized.entities.links).length).toBe(3);
    expect(Object.keys(normalized.entities.scripts).length).toBe(3);
    expect(Object.keys(normalized.entities.technologies).length).toBe(3);
    expect(Object.keys(normalized.entities.classes).length).toBe(3);
  });
});

import assert from 'node:assert/strict';
// Simple test script for the normalizer
// Run with: npx tsx src/lib/__tests__/crawl-json-normalizer.test.ts

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

function runTest() {
  const normalized = normalizeCrawl(mockCrawl);

  // Verify entities
  const sharedH1 = normalized.pages[0].headingIds.h1[0];
  const page2H1 = normalized.pages[1].headingIds.h1[0];
  const page3H1 = normalized.pages[2].headingIds.h1[0];

  assert.equal(sharedH1, page2H1, "Page 1 & 2 should share H1 'Welcome'");
  assert.notEqual(sharedH1, page3H1, "Page 1 & 3 should have different H1");

  const sharedLink = normalized.pages[0].linkIds.internal[0];
  const page2Link = normalized.pages[1].linkIds.internal[0];
  assert.equal(sharedLink, page2Link, "Page 1 & 2 should share internal link");

  const sharedScript = normalized.pages[0].scriptIds[0];
  const page2Script = normalized.pages[1].scriptIds[0];
  assert.equal(sharedScript, page2Script, "Page 1 & 2 should share script");

  const sharedTech = normalized.pages[0].techIds[0]; // React
  const page2Tech = normalized.pages[1].techIds[0]; // React
  assert.equal(sharedTech, page2Tech, "Page 1 & 2 should share tech 'React'");

  const sharedClass = normalized.pages[0].bodyClassIds[0]; // bg-white
  const page2Class = normalized.pages[1].bodyClassIds[0]; // bg-white
  assert.equal(sharedClass, page2Class, "Page 1 & 2 should share class 'bg-white'");

  const sharedImage = normalized.pages[0].imageIds[0];
  const page2Image = normalized.pages[1].imageIds[0];
  assert.equal(sharedImage, page2Image, "Page 1 & 2 should share image");

  const sharedForm = normalized.pages[0].formIds[0];
  const page2Form = normalized.pages[1].formIds[0];
  assert.equal(sharedForm, page2Form, "Page 1 & 2 should share form (stable order check)");

  const sharedResource = normalized.pages[0].resourceIds[0];
  const page2Resource = normalized.pages[1].resourceIds[0];
  assert.equal(sharedResource, page2Resource, "Page 1 & 2 should share resource");

  const sharedNetwork = normalized.pages[0].networkIds[0];
  const page2Network = normalized.pages[1].networkIds[0];
  assert.equal(sharedNetwork, page2Network, "Page 1 & 2 should share network");

  const sharedSD = normalized.pages[0].structuredDataIds[0];
  const page2SD = normalized.pages[1].structuredDataIds[0];
  assert.equal(sharedSD, page2SD, "Page 1 & 2 should share structured data (stable order check)");

  // Verify output case
  assert.equal(normalized.pages[0].loadTimeMs, 1200, "Page 1 has loadTimeMs");
  assert.equal(normalized.avgLoadTimeMs, 1233, "Crawl has avgLoadTimeMs");

  assert.ok(normalized.pages[0].title, "Page 1 title in output");
  assert.equal(normalized.pages[0].techIds.length, 2, "Page 1 techIds count is 2");

  // Verify counts
  assert.equal(Object.keys(normalized.entities.headings).length, 4, "Unique Headings count");
  assert.equal(Object.keys(normalized.entities.links).length, 3, "Unique Links count");
  assert.equal(Object.keys(normalized.entities.scripts).length, 3, "Unique Scripts count");
  assert.equal(Object.keys(normalized.entities.technologies).length, 3, "Unique Tech count");
  assert.equal(Object.keys(normalized.entities.classes).length, 3, "Unique Classes count");
}

runTest();

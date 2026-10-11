import { describe, it, expect } from 'vitest';
import { SecurityHeadersAnalyzer } from '../security-headers';
import { TechProfilerAnalyzer } from '../tech-profiler';
import { SeoMetadataAnalyzer } from '../seo-metadata';
import type { AnalysisContext } from '../types';

describe('SecurityHeadersAnalyzer', () => {
  const analyzer = new SecurityHeadersAnalyzer();

  it('evaluates secure site headers and gives high grade', async () => {
    const context: AnalysisContext = {
      crawlId: 'c1',
      targetUrl: 'https://secure.example.com',
      finalUrl: 'https://secure.example.com',
      domain: 'secure.example.com',
      statusCode: 200,
      headers: {
        'content-security-policy': "default-src 'self'",
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'geolocation=()',
      },
    };

    const report = await analyzer.run(context);
    expect(report.score).toBeGreaterThanOrEqual(90);
    expect(report.grade).toBe('A+');
    expect(report.summary.passed).toBeGreaterThanOrEqual(5);
    expect(report.summary.failed).toBe(0);
  });

  it('detects missing security headers and lowers score', async () => {
    const context: AnalysisContext = {
      crawlId: 'c2',
      targetUrl: 'http://insecure.example.com',
      finalUrl: 'http://insecure.example.com',
      domain: 'insecure.example.com',
      statusCode: 200,
      headers: {},
    };

    const report = await analyzer.run(context);
    expect(report.score).toBeLessThan(35);
    expect(report.grade).toBe('F');
    expect(report.summary.failed).toBeGreaterThanOrEqual(3);
  });
});

describe('TechProfilerAnalyzer', () => {
  const analyzer = new TechProfilerAnalyzer();

  it('detects Next.js and Tailwind CSS from scripts and HTML', async () => {
    const context: AnalysisContext = {
      crawlId: 'c3',
      targetUrl: 'https://nextjs-site.com',
      finalUrl: 'https://nextjs-site.com',
      domain: 'nextjs-site.com',
      statusCode: 200,
      scripts: ['https://nextjs-site.com/_next/static/chunks/main.js'],
      html: '<div id="__next" class="flex items-center text-sm">Hello</div>',
      headers: {
        'x-powered-by': 'Next.js',
      },
    };

    const report = await analyzer.run(context);
    const techNames = report.technologies.map((t) => t.name);

    expect(techNames).toContain('Next.js');
    expect(techNames).toContain('Tailwind CSS');
    expect(report.categories['Frontend Framework']).toBeGreaterThanOrEqual(1);
  });

  it('detects WordPress from meta generator and wp-content assets', async () => {
    const context: AnalysisContext = {
      crawlId: 'c4',
      targetUrl: 'https://blog.com',
      finalUrl: 'https://blog.com',
      domain: 'blog.com',
      statusCode: 200,
      metaGenerator: 'WordPress 6.4.2',
      scripts: ['https://blog.com/wp-includes/js/jquery.js'],
      stylesheets: ['https://blog.com/wp-content/themes/theme/style.css'],
    };

    const report = await analyzer.run(context);
    const techNames = report.technologies.map((t) => t.name);

    expect(techNames).toContain('WordPress');
  });
});

describe('SeoMetadataAnalyzer', () => {
  const analyzer = new SeoMetadataAnalyzer();

  it('evaluates optimal SEO metadata and awards high grade', async () => {
    const context: AnalysisContext = {
      crawlId: 'c5',
      targetUrl: 'https://mysite.com',
      finalUrl: 'https://mysite.com',
      domain: 'mysite.com',
      statusCode: 200,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <title>WebScope - High Performance Web Analysis Shell</title>
            <meta name="description" content="WebScope is a modern modular web crawler and analysis shell for extracting metadata, tech stacks, and domain intelligence.">
            <link rel="canonical" href="https://mysite.com">
            <meta property="og:title" content="WebScope">
            <meta property="og:description" content="Web analysis shell">
            <meta property="og:image" content="https://mysite.com/og.png">
          </head>
          <body>
            <h1>Comprehensive Website Auditing</h1>
            <img src="/logo.png" alt="Company Logo">
          </body>
        </html>
      `,
    };

    const report = await analyzer.run(context);
    expect(report.score).toBeGreaterThanOrEqual(90);
    expect(['A', 'A+']).toContain(report.grade);
    expect(report.summary.passed).toBeGreaterThanOrEqual(5);
    expect(report.summary.failed).toBe(0);
  });

  it('flags missing title, description, and h1 with low grade', async () => {
    const context: AnalysisContext = {
      crawlId: 'c6',
      targetUrl: 'https://poor-seo.com',
      finalUrl: 'https://poor-seo.com',
      domain: 'poor-seo.com',
      statusCode: 200,
      html: `
        <html>
          <body>
            <div>No headings or title here</div>
            <img src="/banner.jpg">
          </body>
        </html>
      `,
    };

    const report = await analyzer.run(context);
    expect(report.score).toBeLessThan(40);
    expect(report.grade).toBe('F');
    expect(report.summary.failed).toBeGreaterThanOrEqual(3);
  });
});

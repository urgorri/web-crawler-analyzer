import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


// ─── GET /api/crawls/[id]/export — Export crawl as downloadable JSON ──────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const crawl = await db.crawl.findUnique({
      where: { id },
    });

    if (!crawl) {
      return NextResponse.json({ error: "Crawl not found" }, { status: 404 });
    }

    const pages = await db.page.findMany({
      where: { crawlId: id },
      orderBy: { scrapedAt: "asc" },
    });

    // Build the normalized JSON output matching the spec
    const parseJson = <T>(str: string | null, fallback: T): T => {
      if (!str) return fallback;
      try {
        return JSON.parse(str) as T;
      } catch {
        return fallback;
      }
    };

    const exportData = {
      crawl: {
        id: crawl.id,
        name: crawl.name,
        started_at: crawl.startedAt.toISOString(),
        completed_at: crawl.completedAt?.toISOString() ?? null,
        engine: crawl.engine,
        config: parseJson<Record<string, unknown> | null>(
          crawl.config,
          null,
        ),
        seed_urls: parseJson<string[]>(crawl.urls, []),
        status: crawl.status,
        stats: {
          seed_count: crawl.seedCount,
          page_count: crawl.pageCount,
          error_count: crawl.errorCount,
        },
        warnings: parseJson<string[] | null>(crawl.warnings, []),
        errors: parseJson<string[] | null>(crawl.errors, []),
      },
      site: {
        total_pages: pages.length,
        pages_with_errors: pages.filter((p) => p.error).length,
        pages_with_structured_data: pages.filter(
          (p) => p.structuredData,
        ).length,
        total_word_count: pages.reduce((sum, p) => sum + p.wordCount, 0),
        total_char_count: pages.reduce((sum, p) => sum + p.charCount, 0),
        unique_external_domains: [
          ...new Set(
            pages.flatMap((p) => {
              const links = parseJson<{
                external: Array<{ href: string }>;
              } | null>(p.links, null);
              if (!links) return [];
              return links.external.map((l) => {
                try {
                  return new URL(l.href).hostname;
                } catch {
                  return null;
                }
              }).filter(Boolean) as string[];
            }),
          ),
        ].length,
      },
      pages: pages.map((p) => ({
        url: p.url,
        final_url: p.finalUrl,
        status_code: p.statusCode,
        title: p.title,
        meta: {
          description: p.metaDescription,
          canonical: p.canonical,
          robots: p.robotsMeta,
          generator: p.metaGenerator,
          lang: p.lang,
          dir: p.dir,
          charset: p.charset,
        },
        visible_text: {
          cleaned: p.visibleText,
          raw: p.visibleTextRaw,
          word_count: p.wordCount,
          char_count: p.charCount,
        },
        headings: parseJson<{
          h1: string[];
          h2: string[];
          h3: string[];
        } | null>(p.headings, null),
        buttons: parseJson<
          Array<{
            text: string;
            type: string;
            aria_label?: string;
            href?: string;
          }>
        >(p.buttons, []),
        links: parseJson<{
          internal: Array<{
            text: string;
            href: string;
            rel?: string;
          }>;
          external: Array<{
            text: string;
            href: string;
            rel?: string;
          }>;
        } | null>(p.links, null),
        forms: parseJson<
          Array<{
            action: string;
            method: string;
            fields: Array<{
              name: string;
              type: string;
              label?: string;
            }>;
          }>
        | null>(p.forms, null),
        images: parseJson<
          Array<{
            src: string;
            alt: string;
            width?: number;
            height?: number;
          }>
        | null>(p.images, null),
        scripts: parseJson<string[] | null>(p.scripts, null),
        styles: parseJson<string[] | null>(p.stylesheets, null),
        resources: parseJson<
          Array<{ type: string; url: string; size?: number }> | null
        >(p.resources, null),
        network: parseJson<
          Array<{
            url: string;
            method: string;
            status?: number;
            resource_type?: string;
            size?: number;
          }>
        | null>(p.network, null),
        structured_data: parseJson<unknown[] | null>(
          p.structuredData,
          null,
        ),
        evidence: {
          body_classes: parseJson<string[] | null>(p.bodyClasses, null),
          html_classes: parseJson<string[] | null>(p.htmlClasses, null),
          tech_evidence: parseJson<string[] | null>(p.techEvidence, null),
        },
        error: p.error,
        scraped_at: p.scrapedAt.toISOString(),
      })),
    };

    const jsonString = JSON.stringify(exportData, null, 2);

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="crawl-${crawl.id}.json"`,
      },
    });
  } catch (error) {
    console.error("[API] Failed to export crawl:", error);
    return NextResponse.json(
      { error: "Failed to export crawl" },
      { status: 500 },
    );
  }
}

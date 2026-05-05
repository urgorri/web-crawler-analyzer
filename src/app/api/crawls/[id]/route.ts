import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ─── GET /api/crawls/[id] — Get crawl detail with pages ───────────────────────

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

    // Parse JSON fields
    const parseJson = <T>(str: string | null, fallback: T): T => {
      if (!str) return fallback;
      try {
        return JSON.parse(str) as T;
      } catch {
        return fallback;
      }
    };

    const crawlDetail = {
      id: crawl.id,
      name: crawl.name,
      status: crawl.status,
      seedCount: crawl.seedCount,
      pageCount: crawl.pageCount,
      errorCount: crawl.errorCount,
      startedAt: crawl.startedAt.toISOString(),
      completedAt: crawl.completedAt?.toISOString() ?? null,
      urls: parseJson<string[]>(crawl.urls, []),
      config: parseJson<Record<string, unknown> | null>(crawl.config, null),
      engine: crawl.engine,
      warnings: parseJson<string[] | null>(crawl.warnings, null),
      errors: parseJson<string[] | null>(crawl.errors, null),
      pages: pages.map((p) => ({
        id: p.id,
        url: p.url,
        finalUrl: p.finalUrl,
        statusCode: p.statusCode,
        title: p.title,
        metaDescription: p.metaDescription,
        canonical: p.canonical,
        robotsMeta: p.robotsMeta,
        lang: p.lang,
        dir: p.dir,
        charset: p.charset,
        visibleText: p.visibleText,
        visibleTextRaw: p.visibleTextRaw,
        wordCount: p.wordCount,
        charCount: p.charCount,
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
        scripts: parseJson<string[] | null>(p.scripts, []) ?? [],
        stylesheets: parseJson<string[] | null>(p.stylesheets, []) ?? [],
        resources: parseJson<
          Array<{ type: string; url: string; size?: number }> | null
        >(p.resources, null),
        network: parseJson<
          Array<{
            url: string;
            method: string;
            status?: number;
            resourceType?: string;
            size?: number;
          }>
        | null>(p.network, null),
        structuredData: parseJson<unknown[] | null>(
          p.structuredData,
          null,
        ),
        bodyClasses: parseJson<string[] | null>(p.bodyClasses, []) ?? [],
        htmlClasses: parseJson<string[] | null>(p.htmlClasses, []) ?? [],
        techEvidence: parseJson<string[] | null>(p.techEvidence, []) ?? [],
        metaGenerator: p.metaGenerator,
        error: p.error,
        scrapedAt: p.scrapedAt.toISOString(),
      })),
    };

    return NextResponse.json(crawlDetail);
  } catch (error) {
    console.error("[API] Failed to get crawl:", error);
    return NextResponse.json(
      { error: "Failed to fetch crawl" },
      { status: 500 },
    );
  }
}

// ─── DELETE /api/crawls/[id] — Delete a crawl and its pages ────────────────────

export async function DELETE(
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

    // Delete all pages first (cascade should handle this, but be explicit)
    await db.page.deleteMany({
      where: { crawlId: id },
    });

    await db.crawl.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Failed to delete crawl:", error);
    return NextResponse.json(
      { error: "Failed to delete crawl" },
      { status: 500 },
    );
  }
}

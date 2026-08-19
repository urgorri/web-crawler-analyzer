import { NextRequest, NextResponse } from "next/server";
import { getCrawl } from "@/lib/crawl-storage";
import { normalizeCrawl } from "@/lib/crawl-json-normalizer";
import { isValidId } from "@/lib/utils";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: rawId } = await params;
    if (!isValidId(rawId)) {
      return NextResponse.json({ error: "Invalid crawl ID" }, { status: 400 });
    }
    const id = path.basename(rawId);
    const crawl = await getCrawl(id);

    if (!crawl) {
      return NextResponse.json({ error: "Crawl not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");

    let data: unknown = crawl;
    let filename = `crawl-${crawl.id}.json`;

    if (format !== "legacy") {
      data = normalizeCrawl(crawl);
      filename = `crawl-${crawl.id}-v2.json`;
    }

    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[API] Failed to export crawl:", error);
    return NextResponse.json({ error: "Failed to export crawl" }, { status: 500 });
  }
}

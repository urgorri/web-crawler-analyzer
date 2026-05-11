import { NextRequest, NextResponse } from "next/server";
import { getCrawl } from "@/lib/crawl-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const crawl = await getCrawl(id);

    if (!crawl) {
      return NextResponse.json({ error: "Crawl not found" }, { status: 404 });
    }

    return new NextResponse(JSON.stringify(crawl, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="crawl-${crawl.id}.json"`,
      },
    });
  } catch (error) {
    console.error("[API] Failed to export crawl:", error);
    return NextResponse.json({ error: "Failed to export crawl" }, { status: 500 });
  }
}

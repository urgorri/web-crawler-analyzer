import { NextRequest, NextResponse } from "next/server";
import { deleteCrawl, getCrawl } from "@/lib/crawl-storage";
import { isValidId } from "@/lib/utils";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
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

    return NextResponse.json(crawl);
  } catch (error) {
    console.error("[API] Failed to get crawl:", error);
    return NextResponse.json({ error: "Failed to fetch crawl" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: rawId } = await params;
    if (!isValidId(rawId)) {
      return NextResponse.json({ error: "Invalid crawl ID" }, { status: 400 });
    }
    const id = path.basename(rawId);
    const deleted = await deleteCrawl(id);

    if (!deleted) {
      return NextResponse.json({ error: "Crawl not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Failed to delete crawl:", error);
    return NextResponse.json({ error: "Failed to delete crawl" }, { status: 500 });
  }
}

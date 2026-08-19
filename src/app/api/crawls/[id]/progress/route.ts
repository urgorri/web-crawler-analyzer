import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getCrawl } from "@/lib/crawl-storage";
import { isValidId } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!isValidId(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const progressFile = path.join(process.cwd(), "output", `${path.basename(id)}.progress.json`);

    try {
      const data = await readFile(progressFile, "utf8");
      return NextResponse.json(JSON.parse(data));
    } catch (e) {
      // If file doesn't exist, it might be that it hasn't started or already finished.
      // Fallback to crawl storage to see if it's already done.
      const crawl = await getCrawl(id);
      if (crawl && crawl.status !== "running") {
        return NextResponse.json({
          pageCount: crawl.pageCount,
          errorCount: crawl.errorCount,
          status: crawl.status,
          updatedAt: crawl.completedAt || new Date().toISOString(),
        });
      }

      return NextResponse.json({ message: "No progress available" }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
  }
}

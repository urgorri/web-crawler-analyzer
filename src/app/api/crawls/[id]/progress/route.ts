import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const progressFile = path.join(process.cwd(), "output", `${id}.progress.json`);

    try {
      const data = await readFile(progressFile, "utf8");
      return NextResponse.json(JSON.parse(data));
    } catch (e) {
      // If file doesn't exist, it might be that it hasn't started or already finished
      return NextResponse.json({ message: "No progress available" }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getJobCollectionRun } from "@/lib/jobs/collection-runs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = getJobCollectionRun(id);

  if (!run) {
    return NextResponse.json({ error: "Collection run not found" }, { status: 404 });
  }

  return NextResponse.json(run);
}

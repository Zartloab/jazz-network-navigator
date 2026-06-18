import { NextResponse } from "next/server";
import { inspectAiBudget } from "@/lib/ai-budget";

export async function GET() {
  return NextResponse.json(await inspectAiBudget());
}

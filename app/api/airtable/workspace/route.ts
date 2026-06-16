import { NextResponse } from "next/server";
import { airtableAvailable, getAirtableRecords } from "@/lib/airtable";

export async function GET() {
  if (!airtableAvailable()) return NextResponse.json({ available: false });
  try {
    const records = await getAirtableRecords("Workspace", {
      maxRecords: 1,
      filterByFormula: "{External ID}='HAMED-OPERATIONAL-WORKSPACE'",
    });
    const snapshot = records[0]?.fields.Snapshot;
    if (typeof snapshot !== "string") return NextResponse.json({ available: true, workspace: null });
    return NextResponse.json({ available: true, workspace: JSON.parse(snapshot) });
  } catch (error) {
    return NextResponse.json(
      { available: true, error: error instanceof Error ? error.message : "Airtable workspace could not be read." },
      { status: 502 },
    );
  }
}

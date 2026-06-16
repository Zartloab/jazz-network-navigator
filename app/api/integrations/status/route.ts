import { NextResponse } from "next/server";
import { airtableAvailable } from "@/lib/airtable";

export async function GET() {
  return NextResponse.json({
    airtable: airtableAvailable(),
    make: Boolean(process.env.MAKE_WEBHOOK_URL),
    googleCalendar: Boolean(process.env.GOOGLE_CALENDAR_ID),
    gmailMode: "drafts-only",
  });
}

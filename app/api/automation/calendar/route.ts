import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const webhook = process.env.MAKE_WEBHOOK_URL;
  if (!webhook || !process.env.GOOGLE_CALENDAR_ID) {
    return NextResponse.json(
      { error: "Make and Google Calendar are not configured." },
      { status: 503 },
    );
  }
  const body = (await request.json()) as {
    campaignId?: string;
    campaignName?: string;
    events?: Array<{
      id: string;
      title: string;
      startDate: string;
      endDate: string;
      location: string;
      status: string;
    }>;
  };
  const events = (body.events || []).filter(
    (event) => event.status === "Confirmed" && event.startDate,
  );
  if (!events.length) {
    return NextResponse.json({ error: "There are no confirmed dated events to sync." }, { status: 400 });
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "upsert_calendar_events",
      calendar_id: process.env.GOOGLE_CALENDAR_ID,
      campaign_id: body.campaignId || "",
      events: events.map((event) => ({
        ...event,
        idempotency_key: `calendar:${body.campaignId}:${event.id}`,
      })),
    }),
  });
  if (!response.ok) {
    return NextResponse.json({ error: "Calendar automation failed." }, { status: 502 });
  }
  return NextResponse.json({ synced: events.length });
}

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const webhook = process.env.MAKE_WEBHOOK_URL;
  if (!webhook) {
    return NextResponse.json(
      { error: "Make is not configured. The approved draft remains safely inside the app." },
      { status: 503 },
    );
  }
  const body = (await request.json()) as {
    approved?: boolean;
    campaignId?: string;
    actId?: string;
    subject?: string;
    body?: string;
  };
  if (!body.approved || !body.subject?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: "An approved subject and body are required." }, { status: 400 });
  }

  const idempotencyKey = `gmail-draft:${body.campaignId || "campaign"}:${body.subject}`;
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create_gmail_draft",
      idempotency_key: idempotencyKey,
      campaign_id: body.campaignId || "",
      act_id: body.actId || "",
      subject: body.subject,
      body: body.body,
      send: false,
      status: "Approved",
    }),
  });
  if (!response.ok) {
    return NextResponse.json({ error: "Make could not create the Gmail draft." }, { status: 502 });
  }
  let payload: { draftId?: string } = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  return NextResponse.json({
    created: true,
    gmailDraftId: payload.draftId || idempotencyKey,
    sent: false,
  });
}

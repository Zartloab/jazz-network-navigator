import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";
import { Contact, EmailIntent } from "@/lib/types";

export async function POST(request: Request) {
  const client = getOpenAIClient();
  if (!client) return NextResponse.json({ available: false });

  const body = (await request.json()) as { contact?: Contact; intent?: EmailIntent };
  if (!body.contact || !body.intent) {
    return NextResponse.json({ error: "Contact and intent are required." }, { status: 400 });
  }

  try {
    const response = await client.responses.create({
      model: getOpenAIModel(),
      instructions:
        "Write a short, human music-industry outreach email. Return valid JSON with string fields subject, body, and cta. Keep it specific, warm, low-pressure, and under 170 words. Do not invent facts or claim attachments were sent.",
      input: JSON.stringify({
        intent: body.intent,
        contact: {
          name: body.contact.full_name,
          first_name: body.contact.first_name,
          company: body.contact.company,
          position: body.contact.position,
          category: body.contact.category,
          notes: body.contact.notes,
          latest_interaction: body.contact.latest_interaction,
          opportunity: body.contact.opportunity_summary,
          recommended_action: body.contact.recommended_next_action,
          introduced_by: body.contact.introduced_by,
        },
      }),
      text: {
        format: {
          type: "json_schema",
          name: "email_draft",
          strict: true,
          schema: {
            type: "object",
            properties: {
              subject: { type: "string" },
              body: { type: "string" },
              cta: { type: "string" },
            },
            required: ["subject", "body", "cta"],
            additionalProperties: false,
          },
        },
      },
    });
    return NextResponse.json({ available: true, draft: JSON.parse(response.output_text) });
  } catch (error) {
    console.error("Email generation failed", error);
    return NextResponse.json({ available: true, error: "AI request failed." }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";
import { ArtistProfile, Contact, TourBrief, TourDraft } from "@/lib/types";
import { cacheAiResponse, makeAiCacheKey, reserveAiBudget } from "@/lib/ai-budget";

type DraftRequest = {
  brief?: TourBrief;
  profile?: ArtistProfile;
  contacts?: Array<{
    contact: Contact;
    why: string;
    suggestedAction: string;
  }>;
};

export async function POST(request: Request) {
  const client = getOpenAIClient();
  if (!client) return NextResponse.json({ available: false });

  const body = (await request.json()) as DraftRequest;
  if (!body.brief || !Array.isArray(body.contacts) || !body.contacts.length) {
    return NextResponse.json({ error: "Tour brief and contacts are required." }, { status: 400 });
  }
  const cacheKey = makeAiCacheKey("tour-outreach", body);
  const reservation = await reserveAiBudget({ feature: "tour-outreach", estimatedCostUsd: 0.25, cacheKey });
  if (!reservation.allowed) {
    return NextResponse.json({ available: false, budgetBlocked: true, budget: reservation.budget });
  }
  if (reservation.cachedPayload) return NextResponse.json(reservation.cachedPayload);

  const contacts = body.contacts.slice(0, 30).map(({ contact, why, suggestedAction }) => ({
    id: contact.id,
    name: contact.full_name,
    first_name: contact.first_name,
    organisation: contact.company,
    role: contact.position,
    city: contact.city,
    country: contact.country,
    type: contact.category,
    notes: contact.notes.slice(0, 500),
    latest_interaction: contact.latest_interaction,
    opportunity: contact.opportunity_summary,
    introduced_by: contact.introduced_by,
    recommendation_reason: why,
    suggested_action: suggestedAction,
  }));

  try {
    const response = await client.responses.create({
      model: getOpenAIModel(),
      instructions:
        "You are a careful music tour manager. Return exactly one draft for every supplied contact, preserving each contact id. Write concise, warm outreach drafts using only supplied facts. Never claim an email was sent, never invent achievements, dates, links, fees, or prior conversations. Each body must be under 180 words and clearly be a draft for human review.",
      input: JSON.stringify({ artist_profile: body.profile || {}, tour: body.brief, contacts }),
      text: {
        format: {
          type: "json_schema",
          name: "tour_outreach_pack",
          strict: true,
          schema: {
            type: "object",
            properties: {
              drafts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    contactId: { type: "string" },
                    subject: { type: "string" },
                    body: { type: "string" },
                    followUpBody: { type: "string" },
                    usefulReason: { type: "string" },
                  },
                  required: ["contactId", "subject", "body", "followUpBody", "usefulReason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["drafts"],
            additionalProperties: false,
          },
        },
      },
    });

    const parsed = JSON.parse(response.output_text) as {
      drafts: Array<TourDraft & { contactId: string }>;
    };
    const payload = { available: true, drafts: parsed.drafts, budget: reservation.budget };
    await cacheAiResponse(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Tour outreach generation failed", error);
    return NextResponse.json({ available: true, error: "AI request failed." }, { status: 502 });
  }
}

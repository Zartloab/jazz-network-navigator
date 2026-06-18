import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";
import { Contact } from "@/lib/types";
import { cacheAiResponse, makeAiCacheKey, reserveAiBudget } from "@/lib/ai-budget";

export async function POST(request: Request) {
  const client = getOpenAIClient();
  if (!client) return NextResponse.json({ available: false });

  const body = (await request.json()) as { query?: string; contacts?: Contact[] };
  if (!body.query?.trim() || !Array.isArray(body.contacts)) {
    return NextResponse.json({ error: "Query and contacts are required." }, { status: 400 });
  }
  const cacheKey = makeAiCacheKey("ask-network", body);
  const reservation = await reserveAiBudget({ feature: "ask-network", estimatedCostUsd: 0.05, cacheKey });
  if (!reservation.allowed) {
    return NextResponse.json({ available: false, budgetBlocked: true, budget: reservation.budget });
  }
  if (reservation.cachedPayload) return NextResponse.json(reservation.cachedPayload);

  const compactContacts = body.contacts.slice(0, 150).map((contact) => ({
    name: contact.full_name,
    company: contact.company,
    location: [contact.city, contact.country].filter(Boolean).join(", "),
    category: contact.category,
    stage: contact.relationship_stage,
    score: contact.relationship_score,
    priority: contact.priority,
    notes: contact.notes.slice(0, 280),
    opportunity: contact.opportunity_summary,
    next_action: contact.recommended_next_action,
    introduced_by: contact.introduced_by,
    connected_to: contact.connected_to,
  }));

  try {
    const response = await client.responses.create({
      model: getOpenAIModel(),
      instructions:
        "You are a sharp music-industry relationship strategist. Answer only from the supplied contacts. Be concise, recommend no more than five people, explain each in one short sentence, and end with one practical outreach move. Use plain text without markdown symbols. Never invent contact facts.",
      input: `Question: ${body.query}\n\nContacts:\n${JSON.stringify(compactContacts)}`,
    });
    const payload = { available: true, answer: response.output_text, budget: reservation.budget };
    await cacheAiResponse(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Ask network failed", error);
    return NextResponse.json({ available: true, error: "AI request failed." }, { status: 502 });
  }
}

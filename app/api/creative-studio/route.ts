import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";
import {
  ActProfile,
  ArtistAsset,
  ArtistProfile,
  Campaign,
  CreativeBrief,
  CreativePack,
} from "@/lib/types";
import { cacheAiResponse, makeAiCacheKey, reserveAiBudget } from "@/lib/ai-budget";

export async function POST(request: Request) {
  const client = getOpenAIClient();
  if (!client) return NextResponse.json({ available: false });

  const body = (await request.json()) as {
    profile?: ArtistProfile;
    brief?: CreativeBrief;
    act?: ActProfile;
    campaign?: Campaign;
    assets?: ArtistAsset[];
  };
  if (!body.profile || !body.brief) {
    return NextResponse.json({ error: "Artist profile and creative brief are required." }, { status: 400 });
  }
  const cacheKey = makeAiCacheKey("creative-studio", body);
  const reservation = await reserveAiBudget({ feature: "creative-studio", estimatedCostUsd: 0.1, cacheKey });
  if (!reservation.allowed) {
    return NextResponse.json({ available: false, budgetBlocked: true, budget: reservation.budget });
  }
  if (reservation.cachedPayload) return NextResponse.json(reservation.cachedPayload);

  try {
    const response = await client.responses.create({
      model: getOpenAIModel(),
      store: false,
      reasoning: { effort: "low" },
      instructions:
        "You are a senior music-industry creative strategist. Build a useful, specific creative pack for the supplied act and campaign. Use only supplied profile facts and verified assets. Do not invent achievements, quotes, audience numbers, collaborators, reviews, dates, bookings, or press coverage. Avoid hype, clichés, and generic AI phrasing. Keep the writing human, confident, easy to edit, and clearly a draft.",
      input: JSON.stringify({
        artist_profile: body.profile,
        act: body.act,
        campaign: body.campaign,
        verified_assets: body.assets || [],
        creative_brief: body.brief,
      }),
      text: {
        format: {
          type: "json_schema",
          name: "creative_pack",
          strict: true,
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              oneLiner: { type: "string" },
              subjectLine: { type: "string" },
              shortPitch: { type: "string" },
              longPitch: { type: "string" },
              storyAngles: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: { type: "string" },
              },
              callsToAction: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: { type: "string" },
              },
              contentIdeas: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: { type: "string" },
              },
            },
            required: [
              "title",
              "oneLiner",
              "subjectLine",
              "shortPitch",
              "longPitch",
              "storyAngles",
              "callsToAction",
              "contentIdeas",
            ],
            additionalProperties: false,
          },
        },
      },
    }, { timeout: 20_000 });

    const generated = JSON.parse(response.output_text) as Omit<
      CreativePack,
      "id" | "createdAt" | "source" | "goal"
    >;
    const pack: CreativePack = {
      ...generated,
      id: `CREATIVE-${Date.now()}`,
      createdAt: new Date().toISOString(),
      source: "ai",
      goal: body.brief.goal,
      campaignId: body.brief.campaignId,
      actId: body.brief.actId,
      approvalStatus: "Draft",
    };
    const payload = { available: true, pack, budget: reservation.budget };
    await cacheAiResponse(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Creative Studio generation failed", error);
    return NextResponse.json({ available: true, error: "Creative generation failed." }, { status: 502 });
  }
}

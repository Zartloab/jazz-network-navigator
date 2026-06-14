import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";
import {
  ArtistProfile,
  CreativeBrief,
  CreativePack,
} from "@/lib/types";

export async function POST(request: Request) {
  const client = getOpenAIClient();
  if (!client) return NextResponse.json({ available: false });

  const body = (await request.json()) as {
    profile?: ArtistProfile;
    brief?: CreativeBrief;
  };
  if (!body.profile || !body.brief) {
    return NextResponse.json({ error: "Artist profile and creative brief are required." }, { status: 400 });
  }

  try {
    const response = await client.responses.create({
      model: getOpenAIModel(),
      store: false,
      reasoning: { effort: "low" },
      instructions:
        "You are a senior music-industry creative strategist. Build a useful, specific creative pack from only the supplied artist profile and brief. Do not invent achievements, quotes, audience numbers, collaborators, reviews, dates, or press coverage. Avoid hype, clichés, and generic AI phrasing. Keep the writing human, confident, and easy to edit.",
      input: JSON.stringify({ artist_profile: body.profile, creative_brief: body.brief }),
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
    };
    return NextResponse.json({ available: true, pack });
  } catch (error) {
    console.error("Creative Studio generation failed", error);
    return NextResponse.json({ available: true, error: "Creative generation failed." }, { status: 502 });
  }
}

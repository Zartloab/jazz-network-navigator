import { NextResponse } from "next/server";
import { getOpenAIClient, getOpenAIModel } from "@/lib/openai";
import { OpportunityType, ResearchBrief, ResearchOpportunity } from "@/lib/types";
import { cacheAiResponse, makeAiCacheKey, reserveAiBudget } from "@/lib/ai-budget";

type WebOpportunity = {
  title: string;
  organisation: string;
  location: string;
  type: OpportunityType;
  summary: string;
  whyNow: string;
  nextAction: string;
  deadline: string;
  confidence: number;
  sourceLabel: string;
  sourceUrl: string;
};

function opportunityId(opportunity: WebOpportunity): string {
  const value = `${opportunity.title}|${opportunity.organisation}|${opportunity.sourceUrl}`;
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `WEB-${hash.toString(36).toUpperCase()}`;
}

export async function POST(request: Request) {
  const client = getOpenAIClient();
  if (!client) return NextResponse.json({ available: false, opportunities: [] });

  const body = (await request.json()) as {
    brief?: ResearchBrief;
    networkSummary?: {
      cities?: string[];
      countries?: string[];
      categories?: string[];
    };
    campaign?: {
      name?: string;
      type?: string;
      goal?: string;
      regions?: string[];
      dates?: string[];
      ensembleSize?: number;
      minimumFee?: string;
      routeStops?: unknown[];
      availableAssets?: string[];
    };
  };
  if (!body.brief) {
    return NextResponse.json({ error: "A research brief is required." }, { status: 400 });
  }
  const cacheKey = makeAiCacheKey("research-opportunities", body);
  const reservation = await reserveAiBudget({ feature: "research-opportunities", estimatedCostUsd: 0.75, cacheKey });
  if (!reservation.allowed) {
    return NextResponse.json({ available: false, budgetBlocked: true, budget: reservation.budget });
  }
  if (reservation.cachedPayload) return NextResponse.json(reservation.cachedPayload);

  try {
    const controller = new AbortController();
    const abortTimeout = setTimeout(() => controller.abort(), 24_000);
    let guardTimeout: ReturnType<typeof setTimeout> | undefined;
    const searchRequest = client.responses.create({
        model: getOpenAIModel(),
        store: false,
        reasoning: { effort: "low" },
        tools: [{ type: "web_search", search_context_size: "low" }],
        tool_choice: "required",
        instructions:
          "You are a careful music-industry opportunity researcher. Perform one focused search of current official sources for legitimate festivals, showcases, grants, venue calls, press opportunities, conferences, residencies, or collaboration programs relevant to the brief. Return no more than three strong opportunities, each supported by a direct official source page. Never invent a deadline, fee, eligibility rule, or contact. Use an empty string when a deadline is not stated. Prefer quality over quantity and keep recommendations practical for an independent artist or manager.",
        input: JSON.stringify({
          research_brief: body.brief,
          campaign: body.campaign || {},
          existing_network_coverage: body.networkSummary || {},
          requested_output:
            "Find up to 3 current opportunities. Explain why each fits, give one next action, and include the direct official source URL.",
        }),
        text: {
          format: {
            type: "json_schema",
            name: "music_opportunities",
            strict: true,
            schema: {
              type: "object",
              properties: {
                opportunities: {
                type: "array",
                  maxItems: 3,
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      organisation: { type: "string" },
                      location: { type: "string" },
                      type: {
                        type: "string",
                        enum: ["Booking", "Festival", "Press", "Funding", "Collaboration", "Release"],
                      },
                      summary: { type: "string" },
                      whyNow: { type: "string" },
                      nextAction: { type: "string" },
                      deadline: { type: "string" },
                      confidence: { type: "number", minimum: 0, maximum: 100 },
                      sourceLabel: { type: "string" },
                      sourceUrl: { type: "string" },
                    },
                    required: [
                      "title",
                      "organisation",
                      "location",
                      "type",
                      "summary",
                      "whyNow",
                      "nextAction",
                      "deadline",
                      "confidence",
                      "sourceLabel",
                      "sourceUrl",
                    ],
                    additionalProperties: false,
                  },
                },
              },
              required: ["opportunities"],
              additionalProperties: false,
            },
          },
        },
      }, { signal: controller.signal, timeout: 24_000 });
    let response;
    try {
      response = await Promise.race([
        searchRequest,
        new Promise<never>((_, reject) => {
          guardTimeout = setTimeout(() => reject(new Error("Live research timed out.")), 25_000);
        }),
      ]);
    } finally {
      clearTimeout(abortTimeout);
      if (guardTimeout) clearTimeout(guardTimeout);
    }

    const parsed = JSON.parse(response.output_text) as { opportunities: WebOpportunity[] };
    const opportunities: ResearchOpportunity[] = parsed.opportunities
      .filter((opportunity) => opportunity.sourceUrl.startsWith("http"))
      .map((opportunity) => ({
        ...opportunity,
        confidence: Math.round(
          Math.min(100, Math.max(0, opportunity.confidence <= 1 ? opportunity.confidence * 100 : opportunity.confidence)),
        ),
        id: opportunityId(opportunity),
        sourceType: "web",
        contactIds: [],
        createdAt: new Date().toISOString(),
        status: "New",
      }));

    const payload = { available: true, opportunities, budget: reservation.budget };
    await cacheAiResponse(cacheKey, payload);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Opportunity research failed", error);
    return NextResponse.json(
      { available: true, opportunities: [], error: "Live research could not be completed." },
      { status: 502 },
    );
  }
}

import { NextResponse } from "next/server";
import { upsertAirtableRecords } from "@/lib/airtable";
import {
  ActProfile,
  ArtistAsset,
  Campaign,
  Contact,
  ResearchOpportunity,
} from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    acts?: ActProfile[];
    assets?: ArtistAsset[];
    campaigns?: Campaign[];
    opportunities?: ResearchOpportunity[];
    contacts?: Contact[];
  };
  if (!Array.isArray(body.acts) || !Array.isArray(body.campaigns)) {
    return NextResponse.json({ error: "Acts and campaigns are required." }, { status: 400 });
  }

  try {
    const counts = {
      acts: await upsertAirtableRecords("Acts", body.acts.map((act) => ({
        fields: {
          "External ID": act.id,
          Name: act.name,
          Format: act.format,
          Genres: act.genres,
          "Base City": act.baseCity,
          Pitch: act.oneLinePitch,
          Biography: act.shortBio,
          Website: act.websiteUrl,
          Confirmed: act.confirmed,
        },
      }))),
      campaigns: await upsertAirtableRecords("Campaigns", body.campaigns.map((campaign) => ({
        fields: {
          "External ID": campaign.id,
          "Act ID": campaign.actId,
          Name: campaign.name,
          Type: campaign.type,
          Status: campaign.status,
          Goal: campaign.goal,
          "Start Date": campaign.startDate,
          "End Date": campaign.endDate,
          Regions: campaign.targetRegions.join(", "),
          "Minimum Fee": campaign.minimumFee,
          "Ensemble Size": campaign.ensembleSize,
          Confirmed: campaign.confirmed,
        },
      }))),
      assets: await upsertAirtableRecords("Assets", (body.assets || []).map((asset) => ({
        fields: {
          "External ID": asset.id,
          "Act ID": asset.actId,
          Kind: asset.kind,
          Label: asset.label,
          Value: asset.value,
          Verified: asset.verified,
        },
      }))),
      opportunities: await upsertAirtableRecords("Opportunities", (body.opportunities || []).map((opportunity) => ({
        fields: {
          "External ID": opportunity.id,
          "Campaign ID": opportunity.campaignId || "",
          Title: opportunity.title,
          Organisation: opportunity.organisation,
          Location: opportunity.location,
          Type: opportunity.type,
          Status: opportunity.status,
          Confidence: opportunity.confidence,
          "Source URL": opportunity.sourceUrl,
          "Next Action": opportunity.nextAction,
        },
      }))),
      contacts: await upsertAirtableRecords("Contacts", (body.contacts || []).map((contact) => ({
        fields: {
          "External ID": contact.id,
          Name: contact.full_name,
          Organisation: contact.company,
          Email: contact.email,
          City: contact.city,
          Country: contact.country,
          Category: contact.category,
          Stage: contact.relationship_stage,
          Temperature: contact.relationship_temperature,
          Priority: contact.priority,
          "Relationship Score": contact.relationship_score,
          "Next Follow Up": contact.next_follow_up_date,
        },
      }))),
      workspace: await upsertAirtableRecords("Workspace", [{
        fields: {
          "External ID": "HAMED-OPERATIONAL-WORKSPACE",
          Snapshot: JSON.stringify({
            acts: body.acts,
            assets: body.assets || [],
            campaigns: body.campaigns,
            opportunities: body.opportunities || [],
            syncedAt: new Date().toISOString(),
          }),
        },
      }]),
    };
    return NextResponse.json({ synced: true, counts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Airtable sync failed." },
      { status: 502 },
    );
  }
}

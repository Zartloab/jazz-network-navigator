import {
  ArtistAsset,
  BookingDeal,
  Campaign,
  Contact,
  ManagerAction,
  ResearchOpportunity,
} from "@/lib/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function contactLabel(contact: Contact): string {
  return contact.full_name || contact.company || "this contact";
}

function campaignOpportunities(campaign: Campaign, opportunities: ResearchOpportunity[]) {
  return opportunities
    .filter(
      (opportunity) =>
        opportunity.status !== "Dismissed" &&
        (opportunity.campaignId === campaign.id ||
          campaign.opportunityIds.includes(opportunity.id)),
    )
    .sort((a, b) => b.confidence - a.confidence);
}

function isDue(contact: Contact): boolean {
  return Boolean(contact.next_follow_up_date && contact.next_follow_up_date <= todayIso());
}

export function buildManagerActions({
  contacts,
  campaigns,
  opportunities,
  assets,
  bookingDeals = [],
  completedIds = [],
}: {
  contacts: Contact[];
  campaigns: Campaign[];
  opportunities: ResearchOpportunity[];
  assets: ArtistAsset[];
  bookingDeals?: BookingDeal[];
  completedIds?: string[];
}): ManagerAction[] {
  const completed = new Set(completedIds);
  const actions: ManagerAction[] = [];
  const activeCampaign =
    campaigns.find((campaign) => campaign.status === "Active") ||
    campaigns.find((campaign) => campaign.status === "Suggested") ||
    campaigns[0];

  if (activeCampaign && !activeCampaign.confirmed) {
    actions.push({
      id: `manager-confirm-${activeCampaign.id}`,
      campaignId: activeCampaign.id,
      type: "confirm",
      title: `Review ${activeCampaign.name}`,
      reason: "The campaign is built from public website details.",
      detail: "Confirm what is real before drafts, outreach, or calendar sync use it.",
      primaryActionLabel: "Confirm campaign",
      targetView: "work",
      urgency: 98,
      relatedLabel: activeCampaign.name,
    });
  }

  bookingDeals
    .filter(
      (deal) =>
        deal.status === "follow_up_due" ||
        Boolean(deal.followUpDate && deal.followUpDate <= todayIso()),
    )
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 2)
    .forEach((deal) => {
      actions.push({
        id: `manager-deal-followup-${deal.id}-${deal.followUpDate || todayIso()}`,
        campaignId: deal.campaignId,
        type: "deal",
        title: `Follow up on ${deal.title}`,
        reason: "This booking conversation is due for a polite next step.",
        detail: deal.nextStep || "Send one short follow-up and record the outcome.",
        primaryActionLabel: "Open deal",
        targetView: "deals",
        urgency: 96,
        dealId: deal.id,
        contactId: deal.contactId,
        opportunityId: deal.opportunityId,
        relatedLabel: deal.organisation || deal.city || "Booking deal",
      });
    });

  bookingDeals
    .filter((deal) => ["lead", "pitch_ready", "interested", "negotiating"].includes(deal.status))
    .sort((a, b) => {
      const valueDelta = (b.projectedValue || 0) - (a.projectedValue || 0);
      return valueDelta || b.confidenceScore - a.confidenceScore;
    })
    .slice(0, 2)
    .forEach((deal) => {
      actions.push({
        id: `manager-deal-${deal.id}-${deal.status}`,
        campaignId: deal.campaignId,
        type: "deal",
        title: `Move ${deal.title} forward`,
        reason: deal.missingMaterials.length
          ? `Pitch is blocked by ${deal.missingMaterials[0].toLowerCase()}.`
          : "This is one of the strongest active booking opportunities.",
        detail: deal.nextStep || "Choose the next booking move and keep the pipeline current.",
        primaryActionLabel: "Work deal",
        targetView: "deals",
        urgency: 82 + Math.min(12, Math.round(deal.confidenceScore / 12)),
        dealId: deal.id,
        contactId: deal.contactId,
        opportunityId: deal.opportunityId,
        relatedLabel: deal.organisation || deal.city || "Booking deal",
      });
    });

  if (activeCampaign) {
    const campaignAssets = assets.filter((asset) => asset.actId === activeCampaign.actId);
    const missingAsset = activeCampaign.requiredAssetKinds.find(
      (kind) => !campaignAssets.some((asset) => asset.kind === kind),
    );
    if (missingAsset) {
      actions.push({
        id: `manager-material-${activeCampaign.id}-${missingAsset}`,
        campaignId: activeCampaign.id,
        type: "material",
        title: `Add the ${missingAsset.toLowerCase()} for ${activeCampaign.name}`,
        reason: "Outreach will be stronger once this material is ready.",
        detail: "Keep the pitch pack factual and useful before sending anyone a draft.",
        primaryActionLabel: "Open materials",
        targetView: "settings",
        urgency: 78,
        relatedLabel: missingAsset,
      });
    }

    const routeGap = activeCampaign.routeStops.find((stop) => stop.status === "Available");
    if (routeGap) {
      actions.push({
        id: `manager-route-${activeCampaign.id}-${routeGap.id}`,
        campaignId: activeCampaign.id,
        type: "route",
        title: `Fill the ${routeGap.city || "open"} route window`,
        reason: "This date window is still open and can guide the next outreach batch.",
        detail: `${routeGap.startDate || "Open start"} to ${routeGap.endDate || "open end"}`,
        primaryActionLabel: "Review route",
        targetView: "work",
        urgency: 70,
        relatedLabel: activeCampaign.name,
      });
    }

    const bestOpportunity = campaignOpportunities(activeCampaign, opportunities)[0];
    if (bestOpportunity) {
      actions.push({
        id: `manager-opportunity-${bestOpportunity.id}`,
        campaignId: activeCampaign.id,
        type: "opportunity",
        title: bestOpportunity.title,
        reason: bestOpportunity.whyNow || `${bestOpportunity.confidence}% campaign fit.`,
        detail: bestOpportunity.nextAction || bestOpportunity.summary,
        primaryActionLabel: "Prepare outreach",
        targetView: "discover",
        urgency: 60 + Math.min(35, Math.round(bestOpportunity.confidence / 3)),
        opportunityId: bestOpportunity.id,
        relatedLabel: bestOpportunity.location || bestOpportunity.organisation,
      });
    }
  }

  contacts
    .filter(isDue)
    .sort((a, b) => b.relationship_score - a.relationship_score)
    .slice(0, 2)
    .forEach((contact) => {
      actions.push({
        id: `manager-follow-up-${contact.id}-${contact.next_follow_up_date}`,
        type: "follow-up",
        title: `Follow up with ${contactLabel(contact)}`,
        reason: "This relationship has a follow-up due now.",
        detail: contact.recommended_next_action || "Send one short, specific next step.",
        primaryActionLabel: "Draft follow-up",
        targetView: "relationships",
        urgency: 88 + (contact.priority === "High" ? 8 : 0),
        contactId: contact.id,
        relatedLabel: contact.company || contact.category,
      });
    });

  contacts
    .filter(
      (contact) =>
        !contact.next_follow_up_date &&
        contact.relationship_temperature === "Hot" &&
        contact.relationship_stage !== "Unqualified",
    )
    .sort((a, b) => b.relationship_score - a.relationship_score)
    .slice(0, 2)
    .forEach((contact) => {
      actions.push({
        id: `manager-relationship-${contact.id}`,
        type: "relationship",
        title: `Set the next move for ${contactLabel(contact)}`,
        reason: "A strong relationship has no next date.",
        detail: contact.recommended_next_action || "Choose a next step before the momentum fades.",
        primaryActionLabel: "Open contact",
        targetView: "relationships",
        urgency: 58 + Math.round(contact.relationship_score / 4),
        contactId: contact.id,
        relatedLabel: contact.company || contact.category,
      });
    });

  opportunities
    .filter((opportunity) => opportunity.status === "New" && opportunity.confidence >= 70)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .forEach((opportunity) => {
      actions.push({
        id: `manager-new-opportunity-${opportunity.id}`,
        campaignId: opportunity.campaignId,
        type: "opportunity",
        title: `Review ${opportunity.title}`,
        reason: "A new opportunity is strong enough to inspect.",
        detail: opportunity.nextAction || opportunity.summary,
        primaryActionLabel: "Review opportunity",
        targetView: "discover",
        urgency: 45 + Math.round(opportunity.confidence / 3),
        opportunityId: opportunity.id,
        relatedLabel: opportunity.location || opportunity.organisation,
      });
    });

  return actions
    .filter((action, index, list) => list.findIndex((item) => item.id === action.id) === index)
    .filter((action) => !completed.has(action.id))
    .sort((a, b) => b.urgency - a.urgency)
    .slice(0, 5);
}

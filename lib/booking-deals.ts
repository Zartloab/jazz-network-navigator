import {
  ActProfile,
  ArtistAsset,
  BookingDeal,
  BookingDealStatus,
  BookingDealSummary,
  BookingDealType,
  Campaign,
  Contact,
  ResearchOpportunity,
} from "@/lib/types";

export const BOOKING_DEAL_COLUMNS: Array<{ status: BookingDealStatus; label: string; helper: string }> = [
  { status: "lead", label: "Lead", helper: "Worth looking at" },
  { status: "pitch_ready", label: "Pitch Ready", helper: "Materials are good enough" },
  { status: "contacted", label: "Contacted", helper: "Waiting for the first reply" },
  { status: "follow_up_due", label: "Follow-Up Due", helper: "Needs a polite nudge" },
  { status: "interested", label: "Interested", helper: "Positive signal" },
  { status: "negotiating", label: "Negotiating", helper: "Dates, fee, or details" },
  { status: "confirmed", label: "Confirmed", helper: "Booked or agreed" },
  { status: "passed", label: "Passed", helper: "Not a fit right now" },
];

export const BOOKING_DEAL_LABELS = Object.fromEntries(
  BOOKING_DEAL_COLUMNS.map((column) => [column.status, column.label]),
) as Record<BookingDealStatus, string>;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(date: string, days: number): string {
  const base = date ? new Date(`${date.slice(0, 10)}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return todayIso();
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

export function parseMoney(value?: string): number {
  if (!value) return 0;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoney(value: number, currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Math.max(0, Math.round(value)));
}

function splitLocation(location: string): { city?: string; country?: string } {
  const parts = location.split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return {};
  if (parts.length === 1) return { city: parts[0] };
  return { city: parts[0], country: parts.slice(1).join(", ") };
}

function dealTypeFromOpportunity(opportunity: ResearchOpportunity): BookingDealType {
  if (opportunity.type === "Festival") return "festival";
  if (opportunity.type === "Booking") return "venue";
  if (opportunity.type === "Press" || opportunity.type === "Release") return "press";
  if (opportunity.type === "Funding") return "funding";
  if (opportunity.type === "Collaboration") return "commission";
  return "other";
}

function dealTypeFromContact(contact: Contact): BookingDealType {
  const haystack = `${contact.category} ${contact.position} ${contact.company}`.toLowerCase();
  if (haystack.includes("festival") || haystack.includes("promoter")) return "festival";
  if (haystack.includes("venue") || haystack.includes("program")) return "venue";
  if (haystack.includes("agent") || haystack.includes("book")) return "agent";
  if (haystack.includes("press") || haystack.includes("media") || haystack.includes("radio")) return "press";
  if (haystack.includes("fund")) return "funding";
  if (haystack.includes("commission") || haystack.includes("composer")) return "commission";
  return "other";
}

function fallbackValue(campaign: Campaign, dealType: BookingDealType): number {
  const fee = parseMoney(campaign.minimumFee);
  if (fee) return fee;
  const ensembleMultiplier = Math.max(1, campaign.ensembleSize || 1);
  if (dealType === "press") return 0;
  if (dealType === "funding") return 6000;
  if (dealType === "commission") return 5000;
  if (dealType === "agent") return 3500 * ensembleMultiplier;
  return 2200 * ensembleMultiplier;
}

export function getPitchMissingMaterials(campaign: Campaign, assets: ArtistAsset[], act?: ActProfile): string[] {
  const campaignAssets = assets.filter((asset) => asset.actId === campaign.actId);
  const missing: string[] = campaign.requiredAssetKinds.filter(
    (kind) => !campaignAssets.some((asset) => asset.kind === kind && asset.value.trim()),
  );

  if (!act) missing.push("Correct act selected");
  if (!campaign.confirmed) missing.push("Confirmed campaign facts");
  if (!campaign.minimumFee.trim() && campaign.type !== "Release") missing.push("Fee guidance");
  if (!campaign.startDate && !campaign.endDate && campaign.type !== "Release") missing.push("Dates / availability");

  return [...new Set(missing)];
}

export function createBookingDealFromOpportunity({
  opportunity,
  campaign,
  act,
  assets,
  contacts,
}: {
  opportunity: ResearchOpportunity;
  campaign: Campaign;
  act?: ActProfile;
  assets: ArtistAsset[];
  contacts: Contact[];
}): BookingDeal {
  const contact = opportunity.contactIds
    .map((id) => contacts.find((item) => item.id === id))
    .find((item): item is Contact => Boolean(item));
  const type = dealTypeFromOpportunity(opportunity);
  const missingMaterials = getPitchMissingMaterials(campaign, assets, act);
  const { city, country } = splitLocation(opportunity.location);
  const value = fallbackValue(campaign, type);
  const status: BookingDealStatus =
    opportunity.status === "In progress"
      ? "contacted"
      : missingMaterials.length
        ? "lead"
        : "pitch_ready";

  return {
    id: `DEAL-OPP-${opportunity.id}`,
    campaignId: campaign.id,
    actId: campaign.actId,
    contactId: contact?.id,
    opportunityId: opportunity.id,
    title: opportunity.title,
    organisation: opportunity.organisation || contact?.company,
    city: city || contact?.city,
    country: country || contact?.country,
    dealType: type,
    status,
    targetFee: value,
    projectedValue: Math.round(value * Math.min(0.95, Math.max(0.35, opportunity.confidence / 100))),
    confirmedValue: 0,
    dateWindow: opportunity.deadline ? `Deadline ${opportunity.deadline}` : `${campaign.startDate || "Open"} to ${campaign.endDate || "open"}`,
    nextStep: missingMaterials.length
      ? `Finish ${missingMaterials[0].toLowerCase()} before pitching.`
      : opportunity.nextAction || "Prepare one clear booking pitch.",
    followUpDate: status === "contacted" ? addDaysIso(todayIso(), 7) : "",
    confidenceScore: opportunity.confidence,
    missingMaterials,
    notes: opportunity.summary || opportunity.whyNow,
    source: "opportunity",
    createdAt: opportunity.createdAt || new Date().toISOString(),
  };
}

export function createBookingDealFromContact({
  contact,
  campaign,
  act,
  assets,
}: {
  contact: Contact;
  campaign: Campaign;
  act?: ActProfile;
  assets: ArtistAsset[];
}): BookingDeal {
  const type = dealTypeFromContact(contact);
  const missingMaterials = getPitchMissingMaterials(campaign, assets, act);
  const value = fallbackValue(campaign, type);
  const relationshipFit =
    contact.relationship_temperature === "Hot"
      ? 12
      : contact.relationship_temperature === "Warm"
        ? 7
        : 0;
  const confidenceScore = Math.min(98, Math.max(42, contact.relationship_score + relationshipFit));

  return {
    id: `DEAL-CONTACT-${campaign.id}-${contact.id}`,
    campaignId: campaign.id,
    actId: campaign.actId,
    contactId: contact.id,
    title: `${type === "agent" ? "Booking route via" : "Pitch"} ${contact.company || contact.full_name}`,
    organisation: contact.company,
    city: contact.city,
    country: contact.country,
    dealType: type,
    status: missingMaterials.length ? "lead" : "pitch_ready",
    targetFee: value,
    projectedValue: Math.round(value * Math.min(0.9, Math.max(0.3, confidenceScore / 100))),
    confirmedValue: 0,
    dateWindow: `${campaign.startDate || "Open"} to ${campaign.endDate || "open"}`,
    nextStep: missingMaterials.length
      ? `Complete ${missingMaterials[0].toLowerCase()} before outreach.`
      : contact.recommended_next_action || "Prepare one personal booking email.",
    followUpDate: contact.next_follow_up_date || "",
    confidenceScore,
    missingMaterials,
    notes: contact.opportunity_summary || contact.ai_summary || contact.notes,
    source: "contact",
    createdAt: new Date().toISOString(),
  };
}

export function buildInitialBookingDeals({
  campaigns,
  acts,
  assets,
  opportunities,
  contacts,
}: {
  campaigns: Campaign[];
  acts: ActProfile[];
  assets: ArtistAsset[];
  opportunities: ResearchOpportunity[];
  contacts: Contact[];
}): BookingDeal[] {
  const activeCampaigns = campaigns
    .filter((campaign) => campaign.status === "Active" || campaign.status === "Suggested")
    .slice(0, 4);
  const deals: BookingDeal[] = [];

  activeCampaigns.forEach((campaign) => {
    const act = acts.find((item) => item.id === campaign.actId);
    opportunities
      .filter(
        (opportunity) =>
          opportunity.status !== "Dismissed" &&
          (opportunity.campaignId === campaign.id || campaign.opportunityIds.includes(opportunity.id)),
      )
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 4)
      .forEach((opportunity) => {
        deals.push(createBookingDealFromOpportunity({ opportunity, campaign, act, assets, contacts }));
      });

    const targetRegions = campaign.targetRegions.join(" ").toLowerCase();
    contacts
      .filter((contact) => {
        const type = dealTypeFromContact(contact);
        const relevantType = ["festival", "venue", "agent", "commission", "funding"].includes(type);
        const place = `${contact.city} ${contact.country}`.toLowerCase();
        const inRegion = !targetRegions || targetRegions.includes(contact.country.toLowerCase()) || targetRegions.includes(contact.city.toLowerCase()) || place.includes("europe");
        return relevantType && (inRegion || contact.relationship_temperature === "Hot" || contact.priority === "High");
      })
      .sort((a, b) => b.relationship_score - a.relationship_score)
      .slice(0, 3)
      .forEach((contact) => {
        deals.push(createBookingDealFromContact({ contact, campaign, act, assets }));
      });
  });

  return deals
    .filter((deal, index, list) => list.findIndex((item) => item.id === deal.id) === index)
    .sort((a, b) => {
      const valueDelta = (b.projectedValue || 0) - (a.projectedValue || 0);
      return valueDelta || b.confidenceScore - a.confidenceScore;
    })
    .slice(0, 24);
}

export function summarizeBookingDeals(deals: BookingDeal[], campaigns: Campaign[]): BookingDealSummary {
  const activeStatuses: BookingDealStatus[] = [
    "lead",
    "pitch_ready",
    "contacted",
    "follow_up_due",
    "interested",
    "negotiating",
  ];
  const activeDeals = deals.filter((deal) => activeStatuses.includes(deal.status));
  const confirmedDeals = deals.filter((deal) => deal.status === "confirmed");
  const dueToday = todayIso();
  const routeGaps = campaigns
    .filter((campaign) => campaign.status === "Active" || campaign.status === "Suggested")
    .flatMap((campaign) => campaign.routeStops)
    .filter((stop) => stop.status === "Available")
    .filter(
      (stop) =>
        !deals.some(
          (deal) =>
            deal.status !== "passed" &&
            stop.city &&
            deal.city &&
            deal.city.toLowerCase() === stop.city.toLowerCase(),
        ),
    );
  const highestValueDeals = [...activeDeals]
    .sort((a, b) => (b.projectedValue || b.targetFee || 0) - (a.projectedValue || a.targetFee || 0))
    .slice(0, 5);
  const dueDeals = activeDeals.filter(
    (deal) => deal.status === "follow_up_due" || Boolean(deal.followUpDate && deal.followUpDate <= dueToday),
  );
  const mostImportantDeal =
    dueDeals.sort((a, b) => b.confidenceScore - a.confidenceScore)[0] ||
    highestValueDeals[0] ||
    activeDeals.sort((a, b) => b.confidenceScore - a.confidenceScore)[0];

  return {
    confirmedIncome: confirmedDeals.reduce((sum, deal) => sum + (deal.confirmedValue || deal.targetFee || 0), 0),
    projectedIncome: activeDeals.reduce((sum, deal) => sum + (deal.projectedValue || 0), 0),
    openDealValue: activeDeals.reduce((sum, deal) => sum + (deal.targetFee || 0), 0),
    followUpsDue: dueDeals.length,
    highestValueDeals,
    routeGaps,
    mostImportantDeal,
  };
}

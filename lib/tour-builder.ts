import {
  AutomationPayload,
  Contact,
  TourBrief,
  TourContactStatus,
  TourDraft,
  TourPlan,
  TourRecommendation,
} from "@/lib/types";

export const tourStatuses: TourContactStatus[] = [
  "Suggested",
  "Drafted",
  "Approved",
  "Contacted",
  "Replied",
  "Interested",
  "Booked",
  "Not a Fit",
];

const temperaturePoints = { Hot: 18, Warm: 14, Cooling: 8, Cold: 3 };
const priorityPoints = { High: 10, Medium: 6, Low: 2 };

const goalTerms: Record<TourBrief["goal"], string[]> = {
  "Paid gigs": ["booking", "agent", "venue", "promoter", "programmer"],
  Festivals: ["festival", "promoter", "programmer", "booking"],
  Press: ["press", "media", "journalist", "radio", "publisher", "editor"],
  "Label meetings": ["label", "record", "a&r", "distribution", "publisher"],
  Networking: ["agent", "manager", "promoter", "label", "media", "venue", "publisher"],
};

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ");
}

function locationTerms(value: string): string[] {
  return normalized(value)
    .split(/\s+|,/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2);
}

function daysSince(value: string): number | null {
  if (!value) return null;
  const time = new Date(`${value.slice(0, 10)}T00:00:00`).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((Date.now() - time) / 86400000);
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function tourToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function goalLabel(goal: TourBrief["goal"]): string {
  if (goal === "Paid gigs") return "a paid show";
  if (goal === "Festivals") return "a festival opportunity";
  if (goal === "Press") return "press or radio coverage";
  if (goal === "Label meetings") return "a label conversation";
  return "a useful industry connection";
}

export function generateTourDraft(
  brief: TourBrief,
  contact: Contact,
  suggestedAction: string,
): TourDraft {
  const firstName = contact.first_name || contact.full_name.split(" ")[0] || "there";
  const location = [contact.city, contact.country].filter((part) => part && part !== "Unknown").join(", ");
  const dateContext =
    brief.startDate && brief.endDate
      ? `between ${brief.startDate} and ${brief.endDate}`
      : brief.startDate
        ? `from ${brief.startDate}`
        : "on an upcoming run";
  const feeContext = brief.minimumFee ? ` Our minimum fee is ${brief.minimumFee}.` : "";
  const intro = contact.introduced_by ? ` ${contact.introduced_by} suggested we connect.` : "";
  const subjectLocation = contact.city && contact.city !== "Unknown" ? ` in ${contact.city}` : "";

  return {
    subject: `${brief.name || "Tour"}: ${goalLabel(brief.goal)}${subjectLocation}`,
    body: `Hi ${firstName},\n\nI’m planning ${brief.name || "an upcoming tour"} ${dateContext}${brief.genre ? `, centred on ${brief.genre}` : ""}.${intro}\n\nI thought of you because of your work${contact.company ? ` with ${contact.company}` : ""}${location ? ` in ${location}` : ""}. ${suggestedAction}${feeContext}\n\nWould this be worth a quick conversation? I’m happy to send a concise live link and the relevant details.\n\nBest,\n[Your name]`,
    followUpBody: `Hi ${firstName},\n\nJust following up on my note about ${brief.name || "the upcoming tour"}. I know schedules get busy, so no pressure at all.\n\nIf ${goalLabel(brief.goal)}${subjectLocation} could be relevant, I’d be glad to send the shortest useful version of the plan. If not, a quick steer toward the right person would also be appreciated.\n\nBest,\n[Your name]`,
    usefulReason: `${contact.full_name || contact.company || "This contact"} is relevant for ${goalLabel(brief.goal)}${location ? ` in ${location}` : ""}.`,
  };
}

function scoreContact(brief: TourBrief, contact: Contact) {
  const reasons: string[] = [];
  let score = 0;
  const locationHaystack = normalized(`${contact.city} ${contact.country}`);
  const requestedLocations = locationTerms(brief.locations);
  const exactLocationHits = requestedLocations.filter((term) => locationHaystack.includes(term));
  if (exactLocationHits.length) {
    score += Math.min(32, 22 + exactLocationHits.length * 5);
    reasons.push(`Matches ${[contact.city, contact.country].filter(Boolean).join(", ")}`);
  }

  const contactText = normalized(
    [
      contact.category,
      contact.position,
      contact.company,
      contact.notes,
      contact.tags,
      contact.opportunity_summary,
      contact.recommended_next_action,
    ].join(" "),
  );
  const relevantTerms = goalTerms[brief.goal].filter((term) => contactText.includes(term));
  if (relevantTerms.length) {
    score += Math.min(24, 10 + relevantTerms.length * 4);
    reasons.push(`Relevant ${contact.category || relevantTerms[0]} connection`);
  }

  score += temperaturePoints[contact.relationship_temperature];
  reasons.push(`${contact.relationship_temperature.toLowerCase()} relationship`);
  score += Math.round(Math.min(100, Math.max(0, contact.relationship_score)) * 0.16);
  score += priorityPoints[contact.priority];

  const since = daysSince(contact.last_contact_date);
  if (since === null) {
    score += 6;
    reasons.push("No recent outreach recorded");
  } else if (since >= 90) {
    score += 9;
    reasons.push("Ready for a thoughtful reconnect");
  } else if (since >= 30) {
    score += 6;
  } else if (since < 7) {
    score -= 5;
  }

  if (contact.introduced_by || contact.connected_to) {
    score += 8;
    reasons.push("Has a warm introduction path");
  }
  if (/\b(venue|festival|booking|press|label|promoter|introduction|introduced)\b/i.test(contact.notes)) {
    score += 7;
    reasons.push("Notes contain a useful tour signal");
  }
  if (brief.genre && contactText.includes(normalized(brief.genre).trim())) {
    score += 5;
    reasons.push(`Matches the ${brief.genre} context`);
  }

  return {
    score: Math.min(100, Math.max(0, Math.round(score))),
    reasons: reasons.slice(0, 3),
  };
}

export function buildLocalTourPlan(brief: TourBrief, contacts: Contact[]): TourPlan {
  const ranked = contacts
    .map((contact) => ({ contact, ...scoreContact(brief, contact) }))
    .filter(({ score }) => score >= 22)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(30, Math.max(8, brief.maxEmailsPerWeek * 2)));

  const recommendations: TourRecommendation[] = ranked.map(({ contact, score, reasons }) => {
    const suggestedAction =
      contact.recommended_next_action ||
      `Ask whether ${goalLabel(brief.goal)} is a fit and offer one strong live link.`;
    return {
      contactId: contact.id,
      score,
      why: reasons.join(" · "),
      suggestedAction,
      status: "Drafted",
      draft: generateTourDraft(brief, contact, suggestedAction),
      draftSource: "local",
      followUpDate: "",
      approvedAt: "",
      contactedAt: "",
    };
  });

  return {
    id: `TOUR-${Date.now()}`,
    createdAt: new Date().toISOString(),
    brief,
    recommendations,
  };
}

export function updateTourStatus(
  recommendation: TourRecommendation,
  status: TourContactStatus,
): TourRecommendation {
  const today = tourToday();
  return {
    ...recommendation,
    status,
    approvedAt: status === "Approved" && !recommendation.approvedAt ? new Date().toISOString() : recommendation.approvedAt,
    contactedAt:
      status === "Contacted" && !recommendation.contactedAt
        ? new Date().toISOString()
        : recommendation.contactedAt,
    followUpDate:
      status === "Contacted" && !recommendation.followUpDate
        ? addDays(today, 7)
        : recommendation.followUpDate,
  };
}

export function isTourFollowUpDue(recommendation: TourRecommendation): boolean {
  return (
    recommendation.status === "Contacted" &&
    Boolean(recommendation.followUpDate) &&
    recommendation.followUpDate <= tourToday()
  );
}

export function getAutomationPayloads(plan: TourPlan, contacts: Contact[]): AutomationPayload[] {
  return plan.recommendations
    .filter((recommendation) =>
      ["Approved", "Contacted", "Replied", "Interested", "Booked"].includes(recommendation.status),
    )
    .map((recommendation) => {
      const contact = contacts.find((item) => item.id === recommendation.contactId);
      return {
        tour_id: plan.id,
        contact_id: recommendation.contactId,
        contact_name: contact?.full_name || contact?.company || "Unknown contact",
        email: contact?.email || "",
        subject: recommendation.draft.subject,
        body: recommendation.draft.body,
        follow_up_date: recommendation.followUpDate,
        status: recommendation.status,
      };
    });
}

import {
  AppNotification,
  Contact,
  OpportunityType,
  ResearchBrief,
  ResearchOpportunity,
} from "@/lib/types";

const TODAY = () => new Date().toISOString().slice(0, 10);

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function stableId(...parts: string[]): string {
  const input = normalized(parts.join(" "));
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return `OPP-${hash.toString(36).toUpperCase()}`;
}

function contactName(contact: Contact): string {
  return contact.full_name || contact.company || "this contact";
}

function contactType(contact: Contact): OpportunityType {
  const value = normalized(`${contact.category} ${contact.position} ${contact.company}`);
  if (value.includes("festival")) return "Festival";
  if (/\b(press|media|journalist|radio|editor|publisher)\b/.test(value)) return "Press";
  if (/\b(label|record|distribution|a r)\b/.test(value)) return "Release";
  if (/\b(manager|agent|artist|musician)\b/.test(value)) return "Collaboration";
  return "Booking";
}

function typeMatchesBrief(type: OpportunityType, brief: ResearchBrief): boolean {
  const target = normalized(`${brief.goals} ${brief.notes}`);
  if (!target) return true;
  const terms: Record<OpportunityType, string[]> = {
    Booking: ["booking", "gig", "show", "venue", "tour"],
    Festival: ["festival", "showcase"],
    Press: ["press", "radio", "media", "publicity"],
    Funding: ["funding", "grant", "support"],
    Collaboration: ["collaboration", "network", "agent", "manager"],
    Release: ["release", "label", "distribution"],
  };
  return terms[type].some((term) => target.includes(term));
}

function contactConfidence(contact: Contact): number {
  return Math.min(
    96,
    Math.max(
      42,
      Math.round(
        contact.relationship_score * 0.62 +
          (contact.relationship_temperature === "Hot" ? 18 : contact.relationship_temperature === "Warm" ? 11 : 4) +
          (contact.email ? 5 : 0) +
          (contact.introduced_by || contact.connected_to ? 7 : 0),
      ),
    ),
  );
}

function fitsLocation(contact: Contact, brief: ResearchBrief): boolean {
  const terms = normalized(brief.locations).split(" ").filter((term) => term.length > 2);
  if (!terms.length) return true;
  const place = normalized(`${contact.city} ${contact.country}`);
  return terms.some((term) => place.includes(term));
}

function makeContactOpportunity(contact: Contact, brief: ResearchBrief): ResearchOpportunity {
  const type = contactType(contact);
  const organisation = contact.company || contactName(contact);
  const location = [contact.city, contact.country]
    .filter((value) => value && value !== "Unknown")
    .join(", ");
  const warmPath = contact.introduced_by
    ? `You can open through ${contact.introduced_by}.`
    : contact.connected_to
      ? `The record includes a connection to ${contact.connected_to}.`
      : `The relationship is currently ${contact.relationship_temperature.toLowerCase()}.`;
  const typeCopy: Record<OpportunityType, string> = {
    Booking: "a booking or routing conversation",
    Festival: "a festival programming conversation",
    Press: "a press, editorial, or radio angle",
    Funding: "a funding route",
    Collaboration: "a partnership or introduction",
    Release: "a release or label conversation",
  };

  return {
    id: stableId(contact.id, type, organisation),
    title: `${type === "Booking" ? "Booking route" : type} with ${organisation}`,
    organisation,
    location,
    type,
    summary:
      contact.opportunity_summary ||
      `${contactName(contact)} could provide ${typeCopy[type]}${location ? ` in ${location}` : ""}.`,
    whyNow: `${warmPath} Relationship score ${contact.relationship_score}/100.`,
    nextAction:
      contact.recommended_next_action ||
      `Review the relationship context and prepare one specific question for ${contactName(contact)}.`,
    deadline: "",
    confidence: contactConfidence(contact),
    sourceType: "network",
    sourceLabel: "Your saved network",
    sourceUrl: "",
    contactIds: [contact.id],
    createdAt: new Date().toISOString(),
    status: "New",
  };
}

function makeCityOpportunity(cityKey: string, contacts: Contact[], brief: ResearchBrief): ResearchOpportunity {
  const [city, country] = cityKey.split("|");
  const ranked = [...contacts].sort((a, b) => b.relationship_score - a.relationship_score);
  const average = Math.round(
    ranked.reduce((sum, contact) => sum + contact.relationship_score, 0) / ranked.length,
  );
  const people = ranked.slice(0, 3).map(contactName);
  const type: OpportunityType = "Booking";

  return {
    id: stableId("city-cluster", cityKey, type),
    title: `Build a focused ${city} route`,
    organisation: `${ranked.length} network contacts`,
    location: [city, country].filter(Boolean).join(", "),
    type,
    summary: `Your network already has enough coverage to plan a coordinated ${city} approach instead of isolated cold emails.`,
    whyNow: `${people.join(", ")} are the strongest starting points. The city cluster averages ${average}/100 relationship strength.`,
    nextAction: `Choose one anchor contact, one venue or programmer, and one supporting relationship before drafting outreach.`,
    deadline: "",
    confidence: Math.min(92, 25 + Math.min(15, ranked.length * 2) + Math.round(average * 0.5)),
    sourceType: "network",
    sourceLabel: "Network cluster analysis",
    sourceUrl: "",
    contactIds: ranked.slice(0, 4).map((contact) => contact.id),
    createdAt: new Date().toISOString(),
    status: "New",
  };
}

export function buildLocalOpportunityScan(
  brief: ResearchBrief,
  contacts: Contact[],
): ResearchOpportunity[] {
  const candidates = contacts
    .filter((contact) => contact.relationship_score >= 55)
    .filter((contact) => fitsLocation(contact, brief))
    .filter((contact) => typeMatchesBrief(contactType(contact), brief))
    .map((contact) => makeContactOpportunity(contact, brief))
    .sort((a, b) => b.confidence - a.confidence);

  const cityGroups = new Map<string, Contact[]>();
  contacts
    .filter((contact) => contact.city && contact.city !== "Unknown")
    .filter((contact) => fitsLocation(contact, brief))
    .forEach((contact) => {
      const key = `${contact.city}|${contact.country}`;
      cityGroups.set(key, [...(cityGroups.get(key) || []), contact]);
    });

  const clusters = [...cityGroups.entries()]
    .filter(([, group]) => group.length >= 2)
    .map(([key, group]) => makeCityOpportunity(key, group, brief))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);

  return [...clusters, ...candidates].sort((a, b) => b.confidence - a.confidence).slice(0, 18);
}

export function mergeOpportunities(
  current: ResearchOpportunity[],
  incoming: ResearchOpportunity[],
  preserveUnmatched = false,
): ResearchOpportunity[] {
  const currentByKey = new Map(
    current.map((opportunity) => [
      opportunity.sourceUrl || normalized(`${opportunity.title} ${opportunity.organisation}`),
      opportunity,
    ]),
  );
  const merged = incoming.map((opportunity) => {
    const key = opportunity.sourceUrl || normalized(`${opportunity.title} ${opportunity.organisation}`);
    const existing = currentByKey.get(key);
    return existing ? { ...opportunity, id: existing.id, status: existing.status } : opportunity;
  });
  const retained = current.filter(
    (opportunity) =>
      (preserveUnmatched || opportunity.status !== "New") &&
      !merged.some(
        (item) =>
          (item.sourceUrl && item.sourceUrl === opportunity.sourceUrl) ||
          normalized(`${item.title} ${item.organisation}`) ===
            normalized(`${opportunity.title} ${opportunity.organisation}`),
      ),
  );
  return [...merged, ...retained];
}

export function buildAppNotifications(
  contacts: Contact[],
  opportunities: ResearchOpportunity[],
  readIds: string[],
): AppNotification[] {
  const today = TODAY();
  const due = contacts
    .filter((contact) => contact.next_follow_up_date && contact.next_follow_up_date <= today)
    .sort((a, b) => b.relationship_score - a.relationship_score)
    .slice(0, 4)
    .map<AppNotification>((contact) => {
      const id = `FOLLOW-${contact.id}-${contact.next_follow_up_date}`;
      return {
        id,
        kind: "follow-up",
        title: `Follow up with ${contactName(contact)}`,
        body: contact.recommended_next_action || "This relationship is due for a thoughtful next step.",
        createdAt: contact.next_follow_up_date,
        priority: contact.priority === "High" ? "High" : "Normal",
        actionView: "follow-ups",
        contactId: contact.id,
        read: readIds.includes(id),
      };
    });

  const opportunitySignals = opportunities
    .filter((opportunity) => opportunity.status === "New" && opportunity.confidence >= 70)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map<AppNotification>((opportunity) => {
      const id = `OPPORTUNITY-${opportunity.id}`;
      return {
        id,
        kind: "opportunity",
        title: opportunity.title,
        body: opportunity.whyNow,
        createdAt: opportunity.createdAt.slice(0, 10),
        priority: opportunity.confidence >= 85 ? "High" : "Normal",
        actionView: "research",
        opportunityId: opportunity.id,
        read: readIds.includes(id),
      };
    });

  const relationshipSignals = contacts
    .filter(
      (contact) =>
        contact.relationship_temperature === "Hot" &&
        !contact.next_follow_up_date &&
        contact.relationship_stage !== "Unqualified",
    )
    .sort((a, b) => b.relationship_score - a.relationship_score)
    .slice(0, 2)
    .map<AppNotification>((contact) => {
      const id = `RELATIONSHIP-${contact.id}`;
      return {
        id,
        kind: "relationship",
        title: `${contactName(contact)} has no next date`,
        body: "This is a strong active relationship, but the next follow-up has not been scheduled.",
        createdAt: today,
        priority: "Normal",
        actionView: "directory",
        contactId: contact.id,
        read: readIds.includes(id),
      };
    });

  return [...due, ...opportunitySignals, ...relationshipSignals].sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    if (a.priority !== b.priority) return a.priority === "High" ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

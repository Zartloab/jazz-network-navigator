import { Contact, EmailDraft, EmailIntent, Priority, Temperature } from "@/lib/types";

const stageOrder = [
  "Materials requested",
  "Follow-up needed",
  "Awaiting reply",
  "Referral lead",
  "Met / warm contact",
  "Unqualified",
];

export const opportunityStages = stageOrder;

export function getSuggestedOutreachAngle(contact: Contact): string {
  const stage = contact.relationship_stage.toLowerCase();
  const category = contact.category.toLowerCase();
  const parts: string[] = [];

  if (contact.introduced_by) {
    parts.push(`Open by mentioning ${contact.introduced_by}.`);
  }
  if (stage.includes("materials requested")) {
    parts.push("Send a concise EPK, one strong live video, and clear availability.");
  } else if (stage.includes("follow-up needed")) {
    parts.push("Reference the last context and ask one easy, specific question.");
  } else if (category.includes("venue")) {
    parts.push("Lead with programming fit, target dates, and the live proposition.");
  } else if (category.includes("record label") || category.includes("label")) {
    parts.push("Frame the release story, strongest track, audience signal, and distribution ask.");
  } else if (
    category.includes("journalist") ||
    category.includes("media") ||
    category.includes("radio") ||
    category.includes("publisher")
  ) {
    parts.push("Offer a clear story angle with one listening link and a timely hook.");
  } else {
    parts.push("Reconnect around their current priorities and make one low-friction next step.");
  }

  return parts.join(" ");
}

function searchable(contact: Contact): string {
  return [
    contact.full_name,
    contact.company,
    contact.city,
    contact.country,
    contact.category,
    contact.position,
    contact.notes,
    contact.tags,
    contact.opportunity_summary,
    contact.connected_to,
  ]
    .join(" ")
    .toLowerCase();
}

const stopWords = new Set([
  "who", "what", "which", "should", "contact", "for", "the", "a", "an", "me",
  "is", "are", "to", "my", "build", "plan", "about", "asked", "connected",
]);

export function findNetworkMatches(query: string, contacts: Contact[]): Contact[] {
  const terms = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2 && !stopWords.has(term));

  return contacts
    .map((contact) => {
      const haystack = searchable(contact);
      const matches = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      const materialBoost =
        query.toLowerCase().includes("material") &&
        contact.relationship_stage.toLowerCase().includes("material")
          ? 3
          : 0;
      return { contact, relevance: matches * 20 + materialBoost * 20 + contact.relationship_score };
    })
    .filter(({ contact, relevance }) => terms.length === 0 || relevance > contact.relationship_score)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 5)
    .map(({ contact }) => contact);
}

export function answerNetworkQuestion(query: string, contacts: Contact[]): string {
  const matches = findNetworkMatches(query, contacts);
  if (!matches.length) {
    return "I could not find a confident match. Try a city, country, category, company, or phrase from your notes.";
  }

  const lines = matches.map(
    (contact, index) =>
      `${index + 1}. ${contact.full_name || "Unnamed contact"}${
        contact.company ? ` at ${contact.company}` : ""
      } — ${contact.relationship_score}/100, ${contact.relationship_temperature}. ${contact.recommended_next_action}`,
  );
  const strongest = matches[0];
  return `${lines.join("\n")}\n\nStrategy: start with ${strongest.full_name} and make the outreach specific to ${strongest.city || strongest.category || "their current context"}.`;
}

function datePlusDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function temperatureForScore(score: number): Temperature {
  if (score >= 80) return "Hot";
  if (score >= 60) return "Warm";
  if (score >= 40) return "Cooling";
  return "Cold";
}

export function simulateMakeEnrichment(contact: Contact): Contact {
  const notes = contact.notes.toLowerCase();
  const latest = contact.latest_interaction.toLowerCase();
  let stage = contact.relationship_stage || "Unqualified";

  if (notes.includes("asked") || notes.includes("send")) stage = "Materials requested";
  if (notes.includes("offered to connect")) stage = "Referral lead";
  if (latest.includes("awaiting reply")) stage = "Awaiting reply";

  const detailBonus = contact.notes.trim().length > 80 ? 8 : contact.notes.trim().length > 20 ? 4 : 0;
  const score = Math.min(
    100,
    Math.max(
      contact.relationship_score,
      20 + (contact.email ? 14 : 0) + detailBonus + (contact.introduced_by ? 10 : 0),
    ),
  );
  const daysByPriority: Record<Priority, number> = { High: 3, Medium: 7, Low: 14 };

  return {
    ...contact,
    relationship_stage: stage,
    relationship_score: score,
    relationship_temperature: temperatureForScore(score),
    next_follow_up_date: datePlusDays(daysByPriority[contact.priority]),
    make_automation_status: "enriched_in_prototype",
    ai_summary: `${contact.full_name || "Contact"}${
      contact.company ? ` / ${contact.company}` : ""
    }: ${contact.opportunity_summary || "Relationship to develop"}. Next: ${
      contact.recommended_next_action || getSuggestedOutreachAngle(contact)
    }`,
  };
}

const intentCopy: Record<EmailIntent, { subject: string; opening: string; ask: string }> = {
  "Follow up after meeting": {
    subject: "Great connecting — quick follow-up",
    opening: "It was great connecting. I wanted to follow up while the conversation is still fresh.",
    ask: "Would a quick call next week be useful to explore the fit?",
  },
  "Send music / EPK": {
    subject: "Music + EPK for your consideration",
    opening: "As discussed, I am sending a compact set of music and live materials.",
    ask: "Could you let me know if this feels relevant for anything you are programming?",
  },
  "Ask for introduction": {
    subject: "A quick introduction request",
    opening: "I am reaching out with a small, specific introduction request.",
    ask: "Would you feel comfortable introducing me to the most relevant person on your side?",
  },
  "Ask about venue dates": {
    subject: "Potential dates and programming fit",
    opening: "I am mapping upcoming dates and thought the project could fit your room and audience.",
    ask: "Are there any suitable openings or programming windows worth discussing?",
  },
  "Label/release pitch": {
    subject: "New release project for your radar",
    opening: "I wanted to share a focused release project that may align with your roster and audience.",
    ask: "Would you be open to hearing the lead track and a short release plan?",
  },
  "Press/radio pitch": {
    subject: "Story and listening pitch",
    opening: "I have a timely music story that may suit your editorial or radio audience.",
    ask: "May I send a private listening link and a concise story outline?",
  },
};

export function generateLocalEmailDraft(contact: Contact, intent: EmailIntent): EmailDraft {
  const template = intentCopy[intent];
  const name = contact.first_name || contact.full_name.split(" ")[0] || "there";
  const context = contact.notes
    ? `I especially remembered this from our context: ${contact.notes.slice(0, 180).trim()}${contact.notes.length > 180 ? "…" : ""}`
    : contact.opportunity_summary
      ? `The reason I thought of you is: ${contact.opportunity_summary}.`
      : `I thought this could be relevant to your work${contact.company ? ` at ${contact.company}` : ""}.`;
  const intro = contact.introduced_by ? ` ${contact.introduced_by} suggested we connect.` : "";

  return {
    subject: `${template.subject}${contact.company ? ` | ${contact.company}` : ""}`,
    body: `Hi ${name},\n\n${template.opening}${intro}\n\n${context}\n\n${getSuggestedOutreachAngle(contact)}\n\n${template.ask}\n\nBest,\n[Your name]`,
    cta: template.ask,
  };
}

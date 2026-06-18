import { profileCompleteness } from "@/lib/creative-studio";
import {
  ArtistProfile,
  Contact,
  ResearchOpportunity,
  TodayTask,
} from "@/lib/types";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function contactName(contact: Contact): string {
  return contact.full_name || contact.company || "Unnamed contact";
}

function urgency(contact: Contact): number {
  const priority = contact.priority === "High" ? 30 : contact.priority === "Medium" ? 15 : 0;
  const overdueDays = contact.next_follow_up_date
    ? Math.max(
        0,
        Math.floor(
          (new Date(`${todayIso()}T00:00:00`).getTime() -
            new Date(`${contact.next_follow_up_date}T00:00:00`).getTime()) /
            86400000,
        ),
      )
    : 0;
  return contact.relationship_score + priority + Math.min(overdueDays, 30);
}

export function buildTodayTasks(
  contacts: Contact[],
  opportunities: ResearchOpportunity[],
  profile: ArtistProfile,
  completedIds: string[] = [],
): TodayTask[] {
  const completed = new Set(completedIds);
  const tasks: TodayTask[] = [];

  const dueContacts = contacts
    .filter(
      (contact) =>
        contact.next_follow_up_date &&
        contact.next_follow_up_date <= todayIso(),
    )
    .sort((a, b) => urgency(b) - urgency(a))
    .slice(0, 3);

  dueContacts.forEach((contact) => {
    const task: TodayTask = {
      id: `today-follow-up-${contact.id}-${contact.next_follow_up_date}`,
      kind: "follow-up",
      title: `Follow up with ${contactName(contact)}`,
      body:
        contact.recommended_next_action ||
        `Reconnect with one clear, easy next step.`,
      actionLabel: "Draft message",
      actionView: "follow-ups",
      priority:
        contact.priority === "High" ||
        contact.next_follow_up_date < todayIso()
          ? "High"
          : "Normal",
      contactId: contact.id,
    };
    if (!completed.has(task.id)) tasks.push(task);
  });

  opportunities
    .filter(
      (opportunity) =>
        opportunity.status === "In progress" ||
        (opportunity.status === "Saved" && opportunity.confidence >= 75),
    )
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "In progress" ? -1 : 1;
      return b.confidence - a.confidence;
    })
    .slice(0, 2)
    .forEach((opportunity) => {
      const task: TodayTask = {
        id: `today-opportunity-${opportunity.id}`,
        kind: "opportunity",
        title:
          opportunity.status === "In progress"
            ? `Continue: ${opportunity.title}`
            : `Review: ${opportunity.title}`,
        body: opportunity.nextAction || opportunity.summary,
        actionLabel: "Open opportunity",
        actionView: "research",
        priority:
          opportunity.status === "In progress" && opportunity.confidence >= 85
            ? "High"
            : "Normal",
        opportunityId: opportunity.id,
      };
      if (!completed.has(task.id)) tasks.push(task);
    });

  const scheduledContactIds = new Set(dueContacts.map((contact) => contact.id));
  contacts
    .filter(
      (contact) =>
        !scheduledContactIds.has(contact.id) &&
        !contact.next_follow_up_date &&
        (contact.priority === "High" ||
          contact.relationship_temperature === "Hot") &&
        contact.relationship_stage !== "Unqualified",
    )
    .sort((a, b) => urgency(b) - urgency(a))
    .slice(0, 2)
    .forEach((contact) => {
      const task: TodayTask = {
        id: `today-relationship-${contact.id}`,
        kind: "relationship",
        title: `Set the next move for ${contactName(contact)}`,
        body:
          contact.recommended_next_action ||
          "Review the relationship and choose a realistic next date.",
        actionLabel: "Open contact",
        actionView: "directory",
        priority: contact.priority === "High" ? "High" : "Normal",
        contactId: contact.id,
      };
      if (!completed.has(task.id)) tasks.push(task);
    });

  const completeness = profileCompleteness(profile);
  if (completeness < 75) {
    const task: TodayTask = {
      id: "today-complete-artist-profile",
      kind: "profile",
      title: "Give your AI assistant better context",
      body: `Your artist profile is ${completeness}% complete. Add the core facts once so every plan and draft improves.`,
      actionLabel: "Complete profile",
      actionView: "settings",
      priority: completeness < 25 ? "High" : "Normal",
    };
    if (!completed.has(task.id)) tasks.push(task);
  }

  return tasks
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === "High" ? -1 : 1;
      const order = {
        "follow-up": 0,
        opportunity: 1,
        relationship: 2,
        profile: 3,
      };
      return order[a.kind] - order[b.kind];
    })
    .slice(0, 6);
}

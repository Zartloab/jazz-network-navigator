import { Contact } from "@/lib/types";

export type DataHealthMetric = {
  id: "email" | "location" | "next-action" | "follow-up";
  label: string;
  value: number;
  detail: string;
};

export type DataHealthTask = {
  id: string;
  contactId: string;
  contactName: string;
  company: string;
  title: string;
  reason: string;
  priority: "Important" | "Useful";
};

export type DataHealthSummary = {
  score: number;
  metrics: DataHealthMetric[];
  tasks: DataHealthTask[];
};

function percent(complete: number, total: number): number {
  if (!total) return 100;
  return Math.round((complete / total) * 100);
}

function name(contact: Contact): string {
  return contact.full_name || contact.company || "Unnamed contact";
}

function contactValue(contact: Contact): number {
  return (
    contact.relationship_score +
    (contact.priority === "High" ? 30 : contact.priority === "Medium" ? 15 : 0) +
    (contact.relationship_temperature === "Hot" ? 20 : 0) +
    (contact.relationship_stage !== "Unqualified" ? 15 : 0)
  );
}

export function buildDataHealthSummary(contacts: Contact[]): DataHealthSummary {
  const valueByContact = new Map(
    contacts.map((contact) => [contact.id, contactValue(contact)]),
  );
  const activeContacts = contacts.filter(
    (contact) => contact.relationship_stage !== "Unqualified",
  );
  const metrics: DataHealthMetric[] = [
    {
      id: "email",
      label: "Contactable",
      value: percent(contacts.filter((contact) => contact.email.trim()).length, contacts.length),
      detail: "Contacts with an email route",
    },
    {
      id: "location",
      label: "Located",
      value: percent(
        contacts.filter(
          (contact) =>
            contact.city.trim() &&
            contact.country.trim() &&
            contact.city.toLowerCase() !== "unknown",
        ).length,
        contacts.length,
      ),
      detail: "Contacts with city and country",
    },
    {
      id: "next-action",
      label: "Actionable",
      value: percent(
        contacts.filter((contact) => contact.recommended_next_action.trim()).length,
        contacts.length,
      ),
      detail: "Contacts with a clear next move",
    },
    {
      id: "follow-up",
      label: "Scheduled",
      value: percent(
        activeContacts.filter((contact) => contact.next_follow_up_date).length,
        activeContacts.length,
      ),
      detail: "Active relationships with a date",
    },
  ];

  const candidates = contacts
    .flatMap((contact): DataHealthTask[] => {
      const important =
        contact.priority === "High" ||
        contact.relationship_temperature === "Hot" ||
        contact.relationship_stage !== "Unqualified";
      const priority = important ? "Important" : "Useful";
      const tasks: DataHealthTask[] = [];

      if (!contact.email.trim()) {
        tasks.push({
          id: `health-email-${contact.id}`,
          contactId: contact.id,
          contactName: name(contact),
          company: contact.company,
          title: "Find a verified contact route",
          reason: "Add an official booking email, form, or trusted introduction path.",
          priority,
        });
      }
      if (
        !contact.city.trim() ||
        !contact.country.trim() ||
        contact.city.toLowerCase() === "unknown"
      ) {
        tasks.push({
          id: `health-location-${contact.id}`,
          contactId: contact.id,
          contactName: name(contact),
          company: contact.company,
          title: "Confirm the location",
          reason: "City and country are needed for routing and local opportunity matching.",
          priority,
        });
      }
      if (!contact.recommended_next_action.trim()) {
        tasks.push({
          id: `health-action-${contact.id}`,
          contactId: contact.id,
          contactName: name(contact),
          company: contact.company,
          title: "Choose the next move",
          reason: "Add one concrete action so the relationship can enter the daily plan.",
          priority,
        });
      }
      if (
        contact.relationship_stage !== "Unqualified" &&
        !contact.next_follow_up_date
      ) {
        tasks.push({
          id: `health-follow-up-${contact.id}`,
          contactId: contact.id,
          contactName: name(contact),
          company: contact.company,
          title: "Set a follow-up date",
          reason: "This active relationship has no date protecting the next step.",
          priority,
        });
      }
      return tasks;
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === "Important" ? -1 : 1;
      return (
        (valueByContact.get(b.contactId) || 0) -
        (valueByContact.get(a.contactId) || 0)
      );
    });

  const seenContacts = new Set<string>();
  const tasks = candidates.filter((task) => {
    if (seenContacts.has(task.contactId)) return false;
    seenContacts.add(task.contactId);
    return true;
  }).slice(0, 6);

  return {
    score: Math.round(
      metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length,
    ),
    metrics,
    tasks,
  };
}

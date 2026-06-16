"use client";

import {
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  ChartBar,
  FolderKanban,
  Home,
  Search,
  Radio,
  ScanSearch,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppView,
  Contact,
  ResearchOpportunity,
  WorkProject,
} from "@/lib/types";

type PaletteResult = {
  id: string;
  group: string;
  title: string;
  detail: string;
  icon: typeof Search;
  action: () => void;
};

const destinations: Array<{
  view: AppView;
  title: string;
  detail: string;
  icon: typeof Search;
}> = [
  { view: "home", title: "Today", detail: "Priorities and manager briefing", icon: Home },
  { view: "deals", title: "Deals", detail: "Booking pipeline, fees, follow-ups, and pitch readiness", icon: CircleDollarSign },
  { view: "work", title: "Campaigns", detail: "Tours, releases, campaigns, and tasks", icon: FolderKanban },
  { view: "relationships", title: "People", detail: "Follow-ups, pipeline, and contacts", icon: Users },
  { view: "studio", title: "Pitch Room", detail: "Pitches, creative material, and artist profile", icon: WandSparkles },
  { view: "calendar", title: "Calendar", detail: "Dates, follow-ups, deadlines, and route gaps", icon: CalendarClock },
  { view: "radar", title: "Radar", detail: "Opportunity scanner and warm paths", icon: Radio },
  { view: "income", title: "Income", detail: "Fees, projections, and break-even", icon: ChartBar },
];

function includesQuery(values: string[], query: string): boolean {
  return values.join(" ").toLowerCase().includes(query);
}

export default function CommandPalette({
  open,
  contacts,
  opportunities,
  projects,
  onClose,
  onNavigate,
  onSelectContact,
}: {
  open: boolean;
  contacts: Contact[];
  opportunities: ResearchOpportunity[];
  projects: WorkProject[];
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  onSelectContact: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const run = (action: () => void) => {
      action();
      onClose();
    };
    const items: PaletteResult[] = destinations
      .filter((item) => !normalized || includesQuery([item.title, item.detail], normalized))
      .map((item) => ({
        id: `view-${item.view}`,
        group: "Go to",
        title: item.title,
        detail: item.detail,
        icon: item.icon,
        action: () => run(() => onNavigate(item.view)),
      }));

    projects
      .filter(
        (project) =>
          !normalized ||
          includesQuery([project.name, project.type, project.goal, project.status], normalized),
      )
      .slice(0, 5)
      .forEach((project) =>
        items.push({
          id: `project-${project.id}`,
          group: "Projects",
          title: project.name,
          detail: `${project.type} · ${project.status}${project.goal ? ` · ${project.goal}` : ""}`,
          icon: FolderKanban,
          action: () => run(() => onNavigate("work")),
        }),
      );

    contacts
      .filter(
        (contact) =>
          !normalized ||
          includesQuery(
            [
              contact.full_name,
              contact.company,
              contact.city,
              contact.country,
              contact.category,
              contact.email,
              contact.notes,
            ],
            normalized,
          ),
      )
      .sort((a, b) => b.relationship_score - a.relationship_score)
      .slice(0, 7)
      .forEach((contact) =>
        items.push({
          id: `contact-${contact.id}`,
          group: "Contacts",
          title: contact.full_name || contact.company || "Unnamed contact",
          detail: [contact.company, contact.city, contact.country].filter(Boolean).join(" · "),
          icon: Users,
          action: () =>
            run(() => {
              onNavigate("relationships");
              onSelectContact(contact.id);
            }),
        }),
      );

    opportunities
      .filter(
        (opportunity) =>
          opportunity.status !== "Dismissed" &&
          (!normalized ||
            includesQuery(
              [
                opportunity.title,
                opportunity.organisation,
                opportunity.location,
                opportunity.type,
                opportunity.summary,
              ],
              normalized,
            )),
      )
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
      .forEach((opportunity) =>
        items.push({
          id: `opportunity-${opportunity.id}`,
          group: "Find Work",
          title: opportunity.title,
          detail: `${opportunity.organisation} · ${opportunity.confidence}% fit`,
          icon: ScanSearch,
          action: () => run(() => onNavigate("discover")),
        }),
      );

    return items.slice(0, 18);
  }, [contacts, onClose, onNavigate, onSelectContact, opportunities, projects, query]);

  if (!open) return null;

  let previousGroup = "";
  return (
    <div className="command-layer" onMouseDown={onClose}>
      <section className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-search">
          <Search size={19} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the whole workspace..."
            aria-label="Search the whole workspace"
          />
          <kbd>esc</kbd>
          <button onClick={onClose} aria-label="Close search"><X size={17} /></button>
        </div>
        <div className="command-results">
          {results.map((result) => {
            const showGroup = result.group !== previousGroup;
            previousGroup = result.group;
            const Icon = result.icon;
            return (
              <div className="command-result-wrap" key={result.id}>
                {showGroup && <span className="command-group">{result.group}</span>}
                <button onClick={result.action}>
                  <span><Icon size={16} /></span>
                  <div><strong>{result.title}</strong><small>{result.detail}</small></div>
                  <ArrowRight size={14} />
                </button>
              </div>
            );
          })}
          {!results.length && (
            <div className="command-empty">
              <Search size={20} />
              <strong>No match yet</strong>
              <span>Try a person, company, city, project, opportunity, or workspace name.</span>
            </div>
          )}
        </div>
        <footer>
          <span><kbd>⌘</kbd><kbd>K</kbd> open anywhere</span>
          <span>Search stays inside this workspace</span>
        </footer>
      </section>
    </div>
  );
}

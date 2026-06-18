"use client";

import {
  Activity,
  ArrowRight,
  Bell,
  Bot,
  CalendarClock,
  ChartBar,
  Check,
  ChevronRight,
  CircleDollarSign,
  CircleDot,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FileJson,
  Filter,
  Flame,
  FolderKanban,
  Globe2,
  HelpCircle,
  Home,
  LayoutGrid,
  ListChecks,
  Mail,
  Map as MapIcon,
  MapPin,
  Menu,
  MessageSquareText,
  Music2,
  PanelLeftClose,
  Plus,
  Radio,
  RefreshCcw,
  Route,
  ScanSearch,
  Search,
  Send,
  Settings,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Users,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
} from "recharts";
import encryptedSeed from "@/data/jazz_network_seed_contacts.encrypted.json";
import { contactsToCsv, downloadFile } from "@/lib/csv";
import { decryptContactBundle, EncryptedContactBundle } from "@/lib/encryption";
import {
  answerNetworkQuestion,
  generateLocalEmailDraft,
  getSuggestedOutreachAngle,
  opportunityStages,
  simulateMakeEnrichment,
  suggestRelationshipNextStep,
} from "@/lib/local-ai";
import {
  buildAppNotifications,
  buildLocalOpportunityScan,
} from "@/lib/opportunity-scout";
import {
  AppNotification,
  AppView,
  ActProfile,
  ArtistAsset,
  ArtistProfile,
  ArtistWorkspace,
  BookingDeal,
  Campaign,
  Contact,
  ContactActivity,
  ContactActivityKind,
  EmailDraft,
  EmailIntent,
  ManagerAction,
  Priority,
  ResearchOpportunity,
  RelationshipNoteSuggestion,
  Temperature,
  WorkProject,
} from "@/lib/types";
import TourBuilder from "@/components/TourBuilder";
import OpportunityScout from "@/components/OpportunityScout";
import ArtistProfileEditor from "@/components/ArtistProfileEditor";
import CreativeStudio from "@/components/CreativeStudio";
import CampaignHub from "@/components/CampaignHub";
import DealsWorkspace from "@/components/DealsWorkspace";
import CommandPalette from "@/components/CommandPalette";
import { emptyArtistProfile } from "@/lib/creative-studio";
import {
  actToArtistProfile,
  hamedActs,
  hamedAssets,
  hamedCampaigns,
  hamedWorkspace,
} from "@/lib/hamed-portfolio";
import { buildManagerActions } from "@/lib/manager-actions";
import {
  buildInitialBookingDeals,
  formatMoney,
  summarizeBookingDeals,
} from "@/lib/booking-deals";
import {
  buildDataHealthSummary,
  DataHealthMetric,
} from "@/lib/data-health";

const STORAGE_KEY = "jazz-network-navigator-contacts-v1";
const OPPORTUNITY_STORAGE_KEY = "jazz-network-navigator-opportunities-v1";
const NOTIFICATION_READ_KEY = "jazz-network-navigator-notifications-read-v1";
const ARTIST_PROFILE_KEY = "jazz-network-navigator-artist-profile-v1";
const TODAY_COMPLETED_KEY = "jazz-network-navigator-today-completed-v1";
const PROJECTS_STORAGE_KEY = "jazz-network-navigator-projects-v1";
const CONTACT_ACTIVITY_STORAGE_KEY = "jazz-network-navigator-contact-activity-v1";
const PORTFOLIO_STORAGE_KEY = "jazz-network-navigator-portfolio-v1";
const BOOKING_DEALS_STORAGE_KEY = "jazz-network-navigator-booking-deals-v1";
const TODAY = () => new Date().toISOString().slice(0, 10);

const temperatureColors: Record<Temperature, string> = {
  Hot: "#ff5c68",
  Warm: "#f8b84e",
  Cooling: "#7a8cff",
  Cold: "#5bd5d0",
};

const emailIntents: EmailIntent[] = [
  "Follow up after meeting",
  "Send music / EPK",
  "Ask for introduction",
  "Ask about venue dates",
  "Label/release pitch",
  "Press/radio pitch",
];

const mapFilters = [
  "All",
  "Hot",
  "Warm",
  "Cooling",
  "Cold",
  "Booking Agent",
  "Venue",
  "Festival/Promoter",
  "Record Label",
  "Media",
] as const;

type MapFilter = (typeof mapFilters)[number];

const viewDetails: Record<AppView, { title: string; description: string; help: string }> = {
  home: {
    title: "Today",
    description: "The next booking moves that matter most.",
    help: "Start here. See the five practical actions most likely to move bookings, follow-ups, and pitch readiness forward.",
  },
  deals: {
    title: "Deals",
    description: "Track gig leads, fees, follow-ups, and confirmed bookings.",
    help: "Use Deals to see every booking target, what it might be worth, what needs to happen next, and whether the pitch is ready.",
  },
  work: {
    title: "Campaigns",
    description: "Run tours, releases, bookings, commissions, and funding work.",
    help: "Choose one campaign to see its next action, route, opportunities, people, materials, tasks, and money.",
  },
  relationships: {
    title: "People",
    description: "Follow up, move conversations forward, and find anyone in your network.",
    help: "Use the tabs to work through follow-ups, update the relationship pipeline, or search all contacts.",
  },
  discover: {
    title: "Find Work",
    description: "Sourced openings, warm paths, and routing gaps.",
    help: "Choose the campaign first. Find Work checks your network, routing needs, materials, and official sources before ranking opportunities.",
  },
  tour: {
    title: "Tour Builder",
    description: "Turn a tour idea into contacts, drafts, and a follow-up plan.",
    help: "Enter the places and goal for your tour, then review the suggested contacts. Nothing is sent automatically.",
  },
  research: {
    title: "Opportunity Finder",
    description: "Find warm routes and current openings worth acting on.",
    help: "Start with a simple brief. Scout checks your saved network first and uses clearly linked web sources when live research is available.",
  },
  studio: {
    title: "Pitch Room",
    description: "Prepare outreach, pitches, and campaign material for approval.",
    help: "Choose what you need and who it is for. The studio uses your artist profile, creates drafts only, and never invents achievements.",
  },
  "follow-ups": {
    title: "Follow-ups",
    description: "See who needs a message and what to say next.",
    help: "Work from the top down. The highest-priority relationships appear first. Use the envelope to create a draft.",
  },
  directory: {
    title: "Contacts",
    description: "Search, filter, and update everyone in your network.",
    help: "Search by person, company, city, email, or note. Open a contact card to view and edit the complete record.",
  },
  pipeline: {
    title: "Pipeline",
    description: "Track where every active relationship currently stands.",
    help: "Choose one stage at a time. Move a contact by changing the status on their card.",
  },
  radar: {
    title: "Radar",
    description: "Scan for campaign opportunities and warm routes.",
    help: "Use Radar to review the weekly opportunity scanner, then use the map or Ask tools when you need more context.",
  },
  ask: {
    title: "Ask AI",
    description: "Ask a plain-language question about your existing contacts.",
    help: "Ask one specific question, such as who to contact in a city or which relationships deserve attention this week.",
  },
  settings: {
    title: "Setup",
    description: "Check data quality, create backups, and prepare future automations.",
    help: "Your contact edits stay in this browser. Export a backup before resetting local data.",
  },
  calendar: {
    title: "Calendar",
    description: "See dates, follow-ups, deadlines, and route gaps.",
    help: "Use Calendar to spot confirmed dates, pending windows, follow-ups, and empty route space before anything gets missed.",
  },
  income: {
    title: "Income",
    description: "Track fees, projected value, and break-even pressure.",
    help: "Use Income to understand what is confirmed, what is likely, and where the current campaign still needs value.",
  },
};

function cleanContact(contact: Contact): Contact {
  return {
    ...contact,
    relationship_score: Number(contact.relationship_score) || 0,
    lat: contact.lat === "" ? "" : Number(contact.lat),
    lng: contact.lng === "" ? "" : Number(contact.lng),
  };
}

function cleanProject(project: Partial<WorkProject>): WorkProject {
  return {
    id: project.id || `PROJECT-${Date.now()}`,
    name: project.name || "Untitled project",
    type: project.type || "Campaign",
    status: project.status || "Idea",
    startDate: project.startDate || "",
    endDate: project.endDate || "",
    goal: project.goal || "",
    targetValue: project.targetValue || "",
    notes: project.notes || "",
    contactIds: Array.isArray(project.contactIds) ? project.contactIds : [],
    opportunityIds: Array.isArray(project.opportunityIds) ? project.opportunityIds : [],
    tasks: Array.isArray(project.tasks) ? project.tasks : [],
    deals: Array.isArray(project.deals) ? project.deals : [],
    expenses: Array.isArray(project.expenses) ? project.expenses : [],
    createdAt: project.createdAt || new Date().toISOString(),
  };
}

function readLocalJson<T>(key: string): T | null {
  const stored = window.localStorage.getItem(key);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as T;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function priorityWeight(priority: Priority): number {
  return priority === "High" ? 30 : priority === "Medium" ? 15 : 0;
}

function followUpUrgency(contact: Contact): number {
  let dateWeight = 0;
  if (contact.next_follow_up_date) {
    const days = Math.floor(
      (new Date(contact.next_follow_up_date).getTime() - new Date(TODAY()).getTime()) / 86400000,
    );
    dateWeight = days <= 0 ? 45 + Math.min(Math.abs(days), 30) : Math.max(0, 15 - days);
  } else if (contact.priority === "High") {
    dateWeight = 20;
  }
  return contact.relationship_score + priorityWeight(contact.priority) + dateWeight;
}

function formatDate(date: string): string {
  if (!date) return "Not scheduled";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${date}T00:00:00`),
  );
}

function formatActivityDate(date: string): string {
  if (!date) return "Previously recorded";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function isDue(date: string): boolean {
  return Boolean(date && date <= TODAY());
}

function contactLabel(contact: Contact): string {
  return contact.full_name || contact.company || "Unnamed contact";
}

function contactMatchesMapFilter(contact: Contact, filter: MapFilter): boolean {
  if (filter === "All") return true;
  if (["Hot", "Warm", "Cooling", "Cold"].includes(filter)) {
    return contact.relationship_temperature === filter;
  }
  const category = contact.category.toLowerCase();
  if (filter === "Festival/Promoter") return category.includes("promoter") || category.includes("festival");
  if (filter === "Media") {
    return category.includes("media") || category.includes("journalist") || category.includes("publisher");
  }
  return category.includes(filter.toLowerCase());
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "hot" | "warm" | "cooling" | "cold" | "demo" | "success";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function TemperatureBadge({ value }: { value: Temperature }) {
  return <Badge tone={value.toLowerCase() as "hot" | "warm" | "cooling" | "cold"}>{value}</Badge>;
}

function SectionHeading({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  );
}

export default function JazzDashboard() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [locked, setLocked] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapFilter, setMapFilter] = useState<MapFilter>("All");
  const [mapHoverId, setMapHoverId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [temperatureFilter, setTemperatureFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [emailContactId, setEmailContactId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppView>("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [opportunities, setOpportunities] = useState<ResearchOpportunity[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [researchHydrated, setResearchHydrated] = useState(false);
  const [artistProfile, setArtistProfile] = useState<ArtistProfile>(emptyArtistProfile);
  const [completedTodayIds, setCompletedTodayIds] = useState<string[]>([]);
  const [projects, setProjects] = useState<WorkProject[]>([]);
  const [artistWorkspace, setArtistWorkspace] = useState<ArtistWorkspace>(hamedWorkspace);
  const [acts, setActs] = useState<ActProfile[]>(hamedActs);
  const [assets, setAssets] = useState<ArtistAsset[]>(hamedAssets);
  const [campaigns, setCampaigns] = useState<Campaign[]>(hamedCampaigns);
  const [bookingDeals, setBookingDeals] = useState<BookingDeal[]>([]);
  const [bookingDealsHydrated, setBookingDealsHydrated] = useState(false);
  const [contactActivities, setContactActivities] = useState<ContactActivity[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const storedContacts = readLocalJson<Contact[]>(STORAGE_KEY);
    if (storedContacts) {
      setContacts(storedContacts.map(cleanContact));
    } else {
      setLocked(true);
    }
    const initialView = window.location.hash.replace("#", "") as AppView;
    if (initialView in viewDetails) setActiveView(initialView);
    const storedOpportunities = readLocalJson<ResearchOpportunity[]>(
      OPPORTUNITY_STORAGE_KEY,
    );
    if (storedOpportunities) setOpportunities(storedOpportunities);
    const storedReadIds = readLocalJson<string[]>(NOTIFICATION_READ_KEY);
    if (storedReadIds) setReadNotificationIds(storedReadIds);
    const storedProfile = readLocalJson<ArtistProfile>(ARTIST_PROFILE_KEY);
    if (storedProfile) {
      setArtistProfile({ ...emptyArtistProfile, ...storedProfile });
    }
    const storedToday = readLocalJson<{ date: string; ids: string[] }>(
      TODAY_COMPLETED_KEY,
    );
    if (storedToday) {
      if (storedToday.date === TODAY()) setCompletedTodayIds(storedToday.ids);
    }
    const storedProjects = readLocalJson<WorkProject[]>(PROJECTS_STORAGE_KEY);
    if (storedProjects) setProjects(storedProjects.map(cleanProject));
    const storedBookingDeals = readLocalJson<BookingDeal[]>(BOOKING_DEALS_STORAGE_KEY);
    if (storedBookingDeals) setBookingDeals(storedBookingDeals);
    const storedActivities = readLocalJson<ContactActivity[]>(CONTACT_ACTIVITY_STORAGE_KEY);
    if (storedActivities) setContactActivities(storedActivities);
    const storedPortfolio = readLocalJson<{
      workspace?: ArtistWorkspace;
      acts?: ActProfile[];
      assets?: ArtistAsset[];
      campaigns?: Campaign[];
    }>(PORTFOLIO_STORAGE_KEY);
    if (storedPortfolio) {
      if (storedPortfolio.workspace) setArtistWorkspace(storedPortfolio.workspace);
      if (Array.isArray(storedPortfolio.acts)) setActs(storedPortfolio.acts);
      if (Array.isArray(storedPortfolio.assets)) setAssets(storedPortfolio.assets);
      if (Array.isArray(storedPortfolio.campaigns)) setCampaigns(storedPortfolio.campaigns);
    }
    fetch("/api/airtable/workspace")
      .then((response) => response.json())
      .then((payload) => {
        if (!payload.available || !payload.workspace) return;
        if (Array.isArray(payload.workspace.acts)) setActs(payload.workspace.acts);
        if (Array.isArray(payload.workspace.assets)) setAssets(payload.workspace.assets);
        if (Array.isArray(payload.workspace.campaigns)) setCampaigns(payload.workspace.campaigns);
        if (Array.isArray(payload.workspace.opportunities)) setOpportunities(payload.workspace.opportunities);
      })
      .catch(() => undefined);
    setResearchHydrated(true);
    setBookingDealsHydrated(true);
    setHydrated(true);
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const nextView = window.location.hash.replace("#", "") as AppView;
      if (nextView in viewDetails) setActiveView(nextView);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
  }, [contacts, hydrated]);

  useEffect(() => {
    if (!researchHydrated) return;
    window.localStorage.setItem(OPPORTUNITY_STORAGE_KEY, JSON.stringify(opportunities));
  }, [opportunities, researchHydrated]);

  useEffect(() => {
    if (!researchHydrated) return;
    window.localStorage.setItem(NOTIFICATION_READ_KEY, JSON.stringify(readNotificationIds));
  }, [readNotificationIds, researchHydrated]);

  useEffect(() => {
    if (!researchHydrated) return;
    window.localStorage.setItem(ARTIST_PROFILE_KEY, JSON.stringify(artistProfile));
  }, [artistProfile, researchHydrated]);

  useEffect(() => {
    if (!researchHydrated) return;
    window.localStorage.setItem(
      TODAY_COMPLETED_KEY,
      JSON.stringify({ date: TODAY(), ids: completedTodayIds }),
    );
  }, [completedTodayIds, researchHydrated]);

  useEffect(() => {
    if (!researchHydrated) return;
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  }, [projects, researchHydrated]);

  useEffect(() => {
    if (!bookingDealsHydrated) return;
    window.localStorage.setItem(BOOKING_DEALS_STORAGE_KEY, JSON.stringify(bookingDeals));
  }, [bookingDeals, bookingDealsHydrated]);

  useEffect(() => {
    if (!researchHydrated) return;
    window.localStorage.setItem(
      CONTACT_ACTIVITY_STORAGE_KEY,
      JSON.stringify(contactActivities),
    );
  }, [contactActivities, researchHydrated]);

  useEffect(() => {
    if (!researchHydrated) return;
    window.localStorage.setItem(
      PORTFOLIO_STORAGE_KEY,
      JSON.stringify({ workspace: artistWorkspace, acts, assets, campaigns }),
    );
  }, [acts, artistWorkspace, assets, campaigns, researchHydrated]);

  useEffect(() => {
    const openCommand = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", openCommand);
    return () => window.removeEventListener("keydown", openCommand);
  }, []);

  useEffect(() => {
    if (!researchHydrated || !contacts.length || opportunities.length) return;
    const campaign = campaigns.find((item) => item.status === "Active") || campaigns[0];
    const act = campaign ? acts.find((item) => item.id === campaign.actId) : undefined;
    setOpportunities(
      buildLocalOpportunityScan(
        {
          campaignId: campaign?.id,
          locations: campaign?.targetRegions.join(", ") || "",
          genres: act?.genres || "Jazz, improvised music",
          goals: campaign?.goal || "Paid shows, festivals, press, funding",
          notes: campaign?.notes || "",
        },
        contacts,
      ),
    );
  }, [acts, campaigns, contacts, opportunities.length, researchHydrated]);

  useEffect(() => {
    if (!bookingDealsHydrated || bookingDeals.length || !contacts.length || !campaigns.length) return;
    setBookingDeals(
      buildInitialBookingDeals({
        campaigns,
        acts,
        assets,
        opportunities,
        contacts,
      }),
    );
  }, [acts, assets, bookingDeals.length, bookingDealsHydrated, campaigns, contacts, opportunities]);

  const selectedContact = contacts.find((contact) => contact.id === selectedId) || null;
  const emailContact = contacts.find((contact) => contact.id === emailContactId) || null;
  const notifications = useMemo(
    () => buildAppNotifications(contacts, opportunities, readNotificationIds),
    [contacts, opportunities, readNotificationIds],
  );

  const addContactActivity = (
    contactId: string,
    kind: ContactActivityKind,
    title: string,
    detail: string,
  ) => {
    if (!detail.trim()) return;
    setContactActivities((current) => [
      {
        id: `ACTIVITY-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        contactId,
        kind,
        title,
        detail: detail.trim(),
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
  };

  const removeContactActivity = (activityId: string) => {
    setContactActivities((current) =>
      current.filter((activity) => activity.id !== activityId || activity.kind !== "note"),
    );
  };

  const updateContact = (updated: Contact) => {
    const previous = contacts.find((contact) => contact.id === updated.id);
    setContacts((current) => current.map((contact) => (contact.id === updated.id ? updated : contact)));
    if (!previous) return;

    const changes: string[] = [];
    let kind: ContactActivityKind = "relationship";
    let title = "Contact updated";

    if (previous.relationship_stage !== updated.relationship_stage) {
      changes.push(`Stage changed from ${previous.relationship_stage || "not set"} to ${updated.relationship_stage || "not set"}`);
      title = "Relationship stage changed";
    }
    if (previous.relationship_temperature !== updated.relationship_temperature) {
      changes.push(`Warmth changed from ${previous.relationship_temperature} to ${updated.relationship_temperature}`);
    }
    if (previous.priority !== updated.priority) {
      changes.push(`Priority changed from ${previous.priority} to ${updated.priority}`);
    }
    if (previous.next_follow_up_date !== updated.next_follow_up_date) {
      changes.push(
        updated.next_follow_up_date
          ? `Next follow-up set for ${formatDate(updated.next_follow_up_date)}`
          : "Next follow-up removed",
      );
      kind = "follow-up";
      title = "Follow-up plan updated";
    }
    if (previous.last_contact_date !== updated.last_contact_date) {
      changes.push(
        updated.last_contact_date
          ? `Contact recorded on ${formatDate(updated.last_contact_date)}`
          : "Last contact date removed",
      );
      kind = "follow-up";
      title = "Follow-up recorded";
    }
    if (
      previous.latest_interaction !== updated.latest_interaction &&
      updated.latest_interaction.trim()
    ) {
      changes.push(updated.latest_interaction.trim());
    }

    const detailFields: (keyof Contact)[] = [
      "full_name",
      "company",
      "position",
      "email",
      "city",
      "country",
      "category",
      "opportunity_summary",
      "recommended_next_action",
      "notes",
      "introduced_by",
      "connected_to",
      "tags",
    ];
    if (detailFields.some((field) => previous[field] !== updated[field])) {
      changes.push("Contact details updated");
    }
    if (previous.ai_summary !== updated.ai_summary) {
      changes.push("Relationship summary refreshed");
      kind = "enrichment";
      title = "Contact enrichment updated";
    }

    if (changes.length) {
      addContactActivity(updated.id, kind, title, [...new Set(changes)].join(" · "));
    }
  };

  const resetData = () => {
    if (!window.confirm("Clear this local workspace, including contacts, plans, profile, and saved drafts?")) return;
    [
      STORAGE_KEY,
      OPPORTUNITY_STORAGE_KEY,
      NOTIFICATION_READ_KEY,
      ARTIST_PROFILE_KEY,
      TODAY_COMPLETED_KEY,
      "jazz-network-navigator-research-brief-v1",
      "jazz-network-navigator-creative-packs-v1",
      "jazz-network-navigator-tour-plan-v1",
      PROJECTS_STORAGE_KEY,
      CONTACT_ACTIVITY_STORAGE_KEY,
      PORTFOLIO_STORAGE_KEY,
      BOOKING_DEALS_STORAGE_KEY,
    ].forEach((key) => window.localStorage.removeItem(key));
    setContacts([]);
    setOpportunities([]);
    setReadNotificationIds([]);
    setArtistProfile(emptyArtistProfile);
    setCompletedTodayIds([]);
    setProjects([]);
    setArtistWorkspace(hamedWorkspace);
    setActs(hamedActs);
    setAssets(hamedAssets);
    setCampaigns(hamedCampaigns);
    setBookingDeals([]);
    setContactActivities([]);
    setSelectedId(null);
    setLocked(true);
  };

  const exportJson = () =>
    downloadFile("jazz-network-contacts.json", JSON.stringify(contacts, null, 2), "application/json");
  const exportCsv = () =>
    downloadFile("jazz-network-contacts.csv", contactsToCsv(contacts), "text/csv;charset=utf-8");
  const exportWorkspace = () =>
    downloadFile(
      `jazz-network-workspace-${TODAY()}.json`,
      JSON.stringify(
        {
          kind: "jazz-network-workspace",
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          contacts,
          opportunities,
          artistProfile,
          projects,
          bookingDeals,
          contactActivities,
          portfolio: { workspace: artistWorkspace, acts, assets, campaigns },
          readNotificationIds,
          completedToday: { date: TODAY(), ids: completedTodayIds },
          modules: {
            researchBrief: readLocalJson<unknown>("jazz-network-navigator-research-brief-v1"),
            creativePacks: readLocalJson<unknown>("jazz-network-navigator-creative-packs-v1"),
            tourPlan: readLocalJson<unknown>("jazz-network-navigator-tour-plan-v1"),
          },
        },
        null,
        2,
      ),
      "application/json",
    );

  const importWorkspace = async (file: File) => {
    const parsed = JSON.parse(await file.text()) as {
      kind?: string;
      contacts?: Contact[];
      opportunities?: ResearchOpportunity[];
      artistProfile?: ArtistProfile;
      projects?: WorkProject[];
      bookingDeals?: BookingDeal[];
      contactActivities?: ContactActivity[];
      portfolio?: {
        workspace?: ArtistWorkspace;
        acts?: ActProfile[];
        assets?: ArtistAsset[];
        campaigns?: Campaign[];
      };
      readNotificationIds?: string[];
      completedToday?: { date?: string; ids?: string[] };
      modules?: {
        researchBrief?: unknown;
        creativePacks?: unknown;
        tourPlan?: unknown;
      };
    };
    if (parsed.kind !== "jazz-network-workspace" || !Array.isArray(parsed.contacts)) {
      throw new Error("This is not a Jazz Network workspace backup.");
    }
    if (!window.confirm("Replace this browser’s current workspace with the selected backup?")) {
      return;
    }

    const writeOrRemove = (key: string, value: unknown) => {
      if (value === undefined || value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, JSON.stringify(value));
    };

    writeOrRemove(STORAGE_KEY, parsed.contacts.map(cleanContact));
    writeOrRemove(OPPORTUNITY_STORAGE_KEY, Array.isArray(parsed.opportunities) ? parsed.opportunities : []);
    writeOrRemove(ARTIST_PROFILE_KEY, { ...emptyArtistProfile, ...(parsed.artistProfile || {}) });
    writeOrRemove(
      PROJECTS_STORAGE_KEY,
      Array.isArray(parsed.projects) ? parsed.projects.map(cleanProject) : [],
    );
    writeOrRemove(
      BOOKING_DEALS_STORAGE_KEY,
      Array.isArray(parsed.bookingDeals) ? parsed.bookingDeals : [],
    );
    writeOrRemove(
      CONTACT_ACTIVITY_STORAGE_KEY,
      Array.isArray(parsed.contactActivities) ? parsed.contactActivities : [],
    );
    writeOrRemove(PORTFOLIO_STORAGE_KEY, {
      workspace: parsed.portfolio?.workspace || hamedWorkspace,
      acts: Array.isArray(parsed.portfolio?.acts) ? parsed.portfolio.acts : hamedActs,
      assets: Array.isArray(parsed.portfolio?.assets) ? parsed.portfolio.assets : hamedAssets,
      campaigns: Array.isArray(parsed.portfolio?.campaigns) ? parsed.portfolio.campaigns : hamedCampaigns,
    });
    writeOrRemove(
      NOTIFICATION_READ_KEY,
      Array.isArray(parsed.readNotificationIds) ? parsed.readNotificationIds : [],
    );
    writeOrRemove(TODAY_COMPLETED_KEY, {
      date: parsed.completedToday?.date || TODAY(),
      ids: Array.isArray(parsed.completedToday?.ids) ? parsed.completedToday.ids : [],
    });
    writeOrRemove(
      "jazz-network-navigator-research-brief-v1",
      parsed.modules?.researchBrief,
    );
    writeOrRemove(
      "jazz-network-navigator-creative-packs-v1",
      parsed.modules?.creativePacks,
    );
    writeOrRemove(
      "jazz-network-navigator-tour-plan-v1",
      parsed.modules?.tourPlan,
    );
    window.location.reload();
  };
  const navigate = (view: AppView) => {
    setActiveView(view);
    setMobileNavOpen(false);
    window.history.replaceState(null, "", `#${view}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!hydrated) {
    return (
      <main className="loading-screen">
        <Music2 />
        <span>Warming up the network…</span>
      </main>
    );
  }

  if (locked) {
    return (
      <UnlockScreen
        onUnlock={async (passphrase) => {
          const decrypted = await decryptContactBundle(
            encryptedSeed as EncryptedContactBundle,
            passphrase,
          );
          setContacts(decrypted.map(cleanContact));
          setLocked(false);
        }}
      />
    );
  }

  return (
    <main className={`app-shell${sidebarOpen ? "" : " sidebar-collapsed"}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <AppSidebar
        activeView={activeView}
        open={sidebarOpen}
        mobileOpen={mobileNavOpen}
        onNavigate={navigate}
        onToggle={() => setSidebarOpen((current) => !current)}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      {mobileNavOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <div className="app-main">
        <AppTopbar
          view={activeView}
          onOpenMobile={() => setMobileNavOpen(true)}
          onOpenSearch={() => setCommandOpen(true)}
          onAdd={() => setShowAdd(true)}
          notifications={notifications}
          onMarkAllRead={() =>
            setReadNotificationIds((current) => [
              ...new Set([...current, ...notifications.map((notification) => notification.id)]),
            ])
          }
          onOpenNotification={(notification) => {
            setReadNotificationIds((current) => [...new Set([...current, notification.id])]);
            navigate(notification.actionView);
            if (notification.contactId) setSelectedId(notification.contactId);
          }}
        />
        <div className="workspace-scroll">
          <div className="workspace-content">
            {activeView === "home" && (
              <DashboardOverview
                contacts={contacts}
                opportunities={opportunities}
                projects={projects}
                bookingDeals={bookingDeals}
                campaigns={campaigns}
                assets={assets}
                profile={artistProfile}
                completedTodayIds={completedTodayIds}
                onCompleteToday={(id) =>
                  setCompletedTodayIds((current) => [...new Set([...current, id])])
                }
                onResetToday={() => setCompletedTodayIds([])}
                onNavigate={navigate}
                onSelect={setSelectedId}
                onEmail={setEmailContactId}
                onAdd={() => setShowAdd(true)}
              />
            )}
            {activeView === "deals" && (
              <DealsWorkspace
                deals={bookingDeals}
                onDealsChange={setBookingDeals}
                contacts={contacts}
                campaigns={campaigns}
                acts={acts}
                assets={assets}
                opportunities={opportunities}
                onNavigate={navigate}
              />
            )}
            {activeView === "work" && (
              <CampaignHub
                acts={acts}
                assets={assets}
                campaigns={campaigns}
                onCampaignsChange={setCampaigns}
                contacts={contacts}
                opportunities={opportunities}
                onNavigate={navigate}
              />
            )}
            {activeView === "relationships" && (
              <RelationshipsWorkspace
                contacts={contacts}
                onUpdate={updateContact}
                onSelect={setSelectedId}
                onEmail={setEmailContactId}
                search={search}
                onSearch={setSearch}
                categoryFilter={categoryFilter}
                onCategoryFilter={setCategoryFilter}
                temperatureFilter={temperatureFilter}
                onTemperatureFilter={setTemperatureFilter}
                priorityFilter={priorityFilter}
                onPriorityFilter={setPriorityFilter}
                sourceFilter={sourceFilter}
                onSourceFilter={setSourceFilter}
              />
            )}
            {(activeView === "discover" || activeView === "radar") && (
              <DiscoverWorkspace
                contacts={contacts}
                profile={artistProfile}
                opportunities={opportunities}
                onOpportunityChange={setOpportunities}
                campaigns={campaigns}
                onCampaignsChange={setCampaigns}
                acts={acts}
                assets={assets}
                workspace={artistWorkspace}
                onSelect={setSelectedId}
                mapFilter={mapFilter}
                onMapFilter={setMapFilter}
                mapHoverId={mapHoverId}
                onMapHover={setMapHoverId}
              />
            )}
            {activeView === "calendar" && (
              <CalendarWorkspace
                contacts={contacts}
                campaigns={campaigns}
                deals={bookingDeals}
                opportunities={opportunities}
                onNavigate={navigate}
              />
            )}
            {activeView === "income" && (
              <IncomeWorkspace
                campaigns={campaigns}
                deals={bookingDeals}
                workspace={artistWorkspace}
                onNavigate={navigate}
              />
            )}
            {activeView === "follow-ups" && (
              <>
                <PageGuide text="Start with the first person in the list. Generate a draft, review it, then record the follow-up after you send it yourself." />
                <FollowUpSection contacts={contacts} onUpdate={updateContact} onSelect={setSelectedId} onEmail={setEmailContactId} />
              </>
            )}
            {activeView === "tour" && <TourBuilder contacts={contacts} profile={artistProfile} />}
            {activeView === "research" && (
              <OpportunityScout
                contacts={contacts}
                profile={artistProfile}
                opportunities={opportunities}
                onChange={setOpportunities}
                onSelectContact={setSelectedId}
                campaigns={campaigns}
                onCampaignsChange={setCampaigns}
                acts={acts}
                assets={assets}
                workspace={artistWorkspace}
              />
            )}
            {activeView === "studio" && (
              <StudioWorkspace
                profile={artistProfile}
                onProfileChange={setArtistProfile}
                workspace={artistWorkspace}
                acts={acts}
                assets={assets}
                campaigns={campaigns}
              />
            )}
            {activeView === "pipeline" && (
              <>
                <PageGuide text="Choose a stage to focus the list. Change a contact’s stage when the conversation moves forward." />
                <OpportunitySection contacts={contacts} onUpdate={updateContact} onSelect={setSelectedId} />
              </>
            )}
            {activeView === "directory" && (
              <>
                <PageGuide text="Use search first, then narrow the results with filters. Select a card to edit the relationship record." />
                <DirectorySection
                  contacts={contacts}
                  search={search}
                  onSearch={setSearch}
                  categoryFilter={categoryFilter}
                  onCategoryFilter={setCategoryFilter}
                  temperatureFilter={temperatureFilter}
                  onTemperatureFilter={setTemperatureFilter}
                  priorityFilter={priorityFilter}
                  onPriorityFilter={setPriorityFilter}
                  sourceFilter={sourceFilter}
                  onSourceFilter={setSourceFilter}
                  onSelect={setSelectedId}
                />
              </>
            )}
            {activeView === "ask" && (
              <>
                <PageGuide text="Ask one focused question. The answer only uses information already stored in your contact network." />
                <AskNetwork contacts={contacts} onSelect={setSelectedId} />
              </>
            )}
            {activeView === "settings" && (
              <SettingsWorkspace
                contacts={contacts}
                workspace={artistWorkspace}
                acts={acts}
                assets={assets}
                campaigns={campaigns}
                opportunities={opportunities}
                onWorkspaceChange={setArtistWorkspace}
                onActsChange={setActs}
                onAssetsChange={setAssets}
                onSelectContact={setSelectedId}
                onReset={resetData}
                onExportWorkspace={exportWorkspace}
                onImportWorkspace={importWorkspace}
                onExportJson={exportJson}
                onExportCsv={exportCsv}
              />
            )}
          </div>
        </div>
      </div>

      {selectedContact && (
        <ContactDrawer
          contact={selectedContact}
          onClose={() => setSelectedId(null)}
          onUpdate={updateContact}
          onEmail={() => setEmailContactId(selectedContact.id)}
          projects={projects}
          onProjectsChange={setProjects}
          activities={contactActivities.filter((activity) => activity.contactId === selectedContact.id)}
          onAddActivity={addContactActivity}
          onRemoveActivity={removeContactActivity}
        />
      )}
      {showAdd && (
        <AddContactModal
          onClose={() => setShowAdd(false)}
          onAdd={(contact) => {
            setContacts((current) => [contact, ...current]);
            addContactActivity(
              contact.id,
              "relationship",
              "Contact added",
              "Added to the relationship workspace.",
            );
            setShowAdd(false);
            setSelectedId(contact.id);
          }}
        />
      )}
      {emailContact && (
        <EmailDraftModal contact={emailContact} profile={artistProfile} onClose={() => setEmailContactId(null)} />
      )}
      <CommandPalette
        open={commandOpen}
        contacts={contacts}
        opportunities={opportunities}
        projects={projects}
        onClose={() => setCommandOpen(false)}
        onNavigate={navigate}
        onSelectContact={setSelectedId}
      />
    </main>
  );
}

function AppSidebar({
  activeView,
  open,
  mobileOpen,
  onNavigate,
  onToggle,
  onCloseMobile,
}: {
  activeView: AppView;
  open: boolean;
  mobileOpen: boolean;
  onNavigate: (view: AppView) => void;
  onToggle: () => void;
  onCloseMobile: () => void;
}) {
  const primary = [
    { view: "home" as AppView, label: "Today", icon: Home, hint: "Next five moves" },
    { view: "deals" as AppView, label: "Deals", icon: CircleDollarSign, hint: "Gig pipeline and money" },
    { view: "work" as AppView, label: "Campaigns", icon: FolderKanban, hint: "Tours, releases, commissions" },
    { view: "relationships" as AppView, label: "People", icon: Users, hint: "Follow-ups and contacts" },
    { view: "studio" as AppView, label: "Pitch Room", icon: WandSparkles, hint: "Drafts and approvals" },
    { view: "calendar" as AppView, label: "Calendar", icon: CalendarClock, hint: "Dates and route gaps" },
    { view: "radar" as AppView, label: "Radar", icon: Radio, hint: "Opportunity scanner", badge: "New" },
    { view: "income" as AppView, label: "Income", icon: ChartBar, hint: "Fees and break-even", badge: "New" },
  ];
  const activeGroup: AppView =
    activeView === "tour"
      ? "work"
      : ["follow-ups", "directory", "pipeline"].includes(activeView)
        ? "relationships"
        : ["discover", "research", "ask"].includes(activeView)
          ? "radar"
          : activeView;

  const renderItem = ({ view, label, icon: Icon, hint, badge }: (typeof primary)[number]) => {
    const active = activeGroup === view;
    return (
    <button
      key={view}
      className={`sidebar-link${active ? " active" : ""}`}
      onClick={() => onNavigate(view)}
      aria-current={active ? "page" : undefined}
      data-tooltip={`${label}: ${viewDetails[view].help}`}
    >
      <Icon size={19} />
      <span><strong>{label}{badge && <b className="sidebar-new-badge">{badge}</b>}</strong><small>{hint}</small></span>
    </button>
    );
  };

  return (
    <aside className={`app-sidebar${open ? "" : " collapsed"}${mobileOpen ? " mobile-open" : ""}`}>
      <div className="sidebar-brand">
        <span className="brand-mark"><Music2 size={20} /></span>
        <span className="sidebar-brand-copy">Hamed<strong>Artist Manager</strong></span>
        <button className="sidebar-mobile-close" onClick={onCloseMobile} aria-label="Close navigation"><X size={18} /></button>
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        <span className="sidebar-section-label">Your workspace</span>
        {primary.map(renderItem)}
      </nav>
      <div className="sidebar-footer">
        <button
          className={`sidebar-link${activeView === "settings" ? " active" : ""}`}
          onClick={() => onNavigate("settings")}
          data-tooltip="Setup, exports, and automation readiness"
        >
          <Settings size={19} />
          <span><strong>Setup</strong><small>Data, backups, automation</small></span>
        </button>
        <div className="privacy-note"><Check size={13} /><span>Saved locally in this browser</span></div>
        <button className="sidebar-collapse" onClick={onToggle} title={open ? "Collapse sidebar" : "Expand sidebar"}>
          <PanelLeftClose size={17} /><span>Collapse menu</span>
        </button>
      </div>
    </aside>
  );
}

function AppTopbar({
  view,
  onOpenMobile,
  onOpenSearch,
  onAdd,
  notifications,
  onMarkAllRead,
  onOpenNotification,
}: {
  view: AppView;
  onOpenMobile: () => void;
  onOpenSearch: () => void;
  onAdd: () => void;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onOpenNotification: (notification: AppNotification) => void;
}) {
  const detail = viewDetails[view];
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const unread = notifications.filter((notification) => !notification.read).length;
  return (
    <header className="app-topbar">
      <button className="mobile-menu-button" onClick={onOpenMobile} aria-label="Open navigation"><Menu size={20} /></button>
      <div className="topbar-page-copy">
        <div className="topbar-title-row">
          <h1>{detail.title}</h1>
          <HelpTip text={detail.help} />
        </div>
        <p>{detail.description}</p>
      </div>
      <div className="topbar-actions">
        <button className="command-trigger" onClick={onOpenSearch} aria-label="Search workspace">
          <Search size={16} />
          <span>Search</span>
          <kbd>⌘K</kbd>
        </button>
        <div className="notification-menu">
          <button
            className={`notification-trigger${notificationsOpen ? " active" : ""}`}
            onClick={() => setNotificationsOpen((current) => !current)}
            aria-label={`${unread} unread notifications`}
            aria-expanded={notificationsOpen}
          >
            <Bell size={18} />
            {unread > 0 && <b>{unread > 9 ? "9+" : unread}</b>}
          </button>
          {notificationsOpen && (
            <div className="notification-panel">
              <div className="notification-panel-head">
                <div><strong>What needs attention</strong><small>{unread ? `${unread} unread` : "You’re up to date"}</small></div>
                {unread > 0 && <button onClick={onMarkAllRead}>Mark all read</button>}
              </div>
              <div className="notification-list">
                {notifications.slice(0, 8).map((notification) => (
                  <button
                    key={notification.id}
                    className={notification.read ? "read" : ""}
                    onClick={() => {
                      onOpenNotification(notification);
                      setNotificationsOpen(false);
                    }}
                  >
                    <span className={`notification-kind ${notification.kind}`}>
                      {notification.kind === "opportunity" ? <ScanSearch size={15} /> : notification.kind === "follow-up" ? <CalendarClock size={15} /> : <Users size={15} />}
                    </span>
                    <span><strong>{notification.title}</strong><small>{notification.body}</small></span>
                    {!notification.read && <i />}
                  </button>
                ))}
                {!notifications.length && (
                  <div className="notification-empty"><Check size={18} /><span>Nothing urgent right now.</span></div>
                )}
              </div>
              <button
                className="notification-footer"
                onClick={() => {
                  onOpenNotification({
                    id: "OPEN-SCOUT",
                    kind: "opportunity",
                    title: "",
                    body: "",
                    createdAt: TODAY(),
                    priority: "Normal",
                    actionView: "research",
                    read: true,
                  });
                  setNotificationsOpen(false);
                }}
              >
                Find work <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>
        <button className="button button-primary" onClick={onAdd}><Plus size={16} /> Add contact</button>
      </div>
    </header>
  );
}

function HelpTip({ text }: { text: string }) {
  return (
    <span className="help-tip" tabIndex={0} aria-label={text}>
      <HelpCircle size={16} />
      <span role="tooltip">{text}</span>
    </span>
  );
}

function PageGuide({ text }: { text: string }) {
  return <div className="page-guide"><HelpCircle size={16} /><span>{text}</span></div>;
}

function RelationshipsWorkspace({
  contacts,
  onUpdate,
  onSelect,
  onEmail,
  search,
  onSearch,
  categoryFilter,
  onCategoryFilter,
  temperatureFilter,
  onTemperatureFilter,
  priorityFilter,
  onPriorityFilter,
  sourceFilter,
  onSourceFilter,
}: {
  contacts: Contact[];
  onUpdate: (contact: Contact) => void;
  onSelect: (id: string) => void;
  onEmail: (id: string) => void;
  search: string;
  onSearch: (value: string) => void;
  categoryFilter: string;
  onCategoryFilter: (value: string) => void;
  temperatureFilter: string;
  onTemperatureFilter: (value: string) => void;
  priorityFilter: string;
  onPriorityFilter: (value: string) => void;
  sourceFilter: string;
  onSourceFilter: (value: string) => void;
}) {
  const [tab, setTab] = useState<"follow-ups" | "pipeline" | "contacts">("follow-ups");
  const due = contacts.filter((contact) => isDue(contact.next_follow_up_date)).length;
  const active = contacts.filter((contact) => contact.relationship_stage !== "Unqualified").length;

  return (
    <section className="grouped-workspace">
      <div className="grouped-intro">
        <div>
          <span className="eyebrow">Relationship workspace</span>
          <h2>Keep conversations moving.</h2>
          <p>Follow up first, update what changed, and search the full network only when you need to.</p>
        </div>
        <div className="grouped-summary">
          <span><strong>{due}</strong><small>due now</small></span>
          <span><strong>{active}</strong><small>active</small></span>
          <span><strong>{contacts.length}</strong><small>total</small></span>
        </div>
      </div>
      <div className="hub-tabs" role="tablist" aria-label="Relationship tools">
        <button className={tab === "follow-ups" ? "active" : ""} onClick={() => setTab("follow-ups")}>
          <ListChecks size={15} /> Follow-ups {due > 0 && <b>{due}</b>}
        </button>
        <button className={tab === "pipeline" ? "active" : ""} onClick={() => setTab("pipeline")}>
          <LayoutGrid size={15} /> Pipeline
        </button>
        <button className={tab === "contacts" ? "active" : ""} onClick={() => setTab("contacts")}>
          <Users size={15} /> All contacts
        </button>
      </div>
      {tab === "follow-ups" && (
        <>
          <PageGuide text="Start at the top. Create a draft, review it, send it yourself, then record the follow-up." />
          <FollowUpSection contacts={contacts} onUpdate={onUpdate} onSelect={onSelect} onEmail={onEmail} />
        </>
      )}
      {tab === "pipeline" && (
        <>
          <PageGuide text="Choose one stage, then update contacts only when a real conversation moves forward." />
          <OpportunitySection contacts={contacts} onUpdate={onUpdate} onSelect={onSelect} />
        </>
      )}
      {tab === "contacts" && (
        <>
          <PageGuide text="Search first, then narrow the list with filters. Open a card to edit the complete relationship record." />
          <DirectorySection
            contacts={contacts}
            search={search}
            onSearch={onSearch}
            categoryFilter={categoryFilter}
            onCategoryFilter={onCategoryFilter}
            temperatureFilter={temperatureFilter}
            onTemperatureFilter={onTemperatureFilter}
            priorityFilter={priorityFilter}
            onPriorityFilter={onPriorityFilter}
            sourceFilter={sourceFilter}
            onSourceFilter={onSourceFilter}
            onSelect={onSelect}
          />
        </>
      )}
    </section>
  );
}

function DiscoverWorkspace({
  contacts,
  profile,
  opportunities,
  onOpportunityChange,
  campaigns,
  onCampaignsChange,
  acts,
  assets,
  workspace,
  onSelect,
  mapFilter,
  onMapFilter,
  mapHoverId,
  onMapHover,
}: {
  contacts: Contact[];
  profile: ArtistProfile;
  opportunities: ResearchOpportunity[];
  onOpportunityChange: (opportunities: ResearchOpportunity[]) => void;
  campaigns: Campaign[];
  onCampaignsChange: React.Dispatch<React.SetStateAction<Campaign[]>>;
  acts: ActProfile[];
  assets: ArtistAsset[];
  workspace: ArtistWorkspace;
  onSelect: (id: string) => void;
  mapFilter: MapFilter;
  onMapFilter: (filter: MapFilter) => void;
  mapHoverId: string | null;
  onMapHover: (id: string | null) => void;
}) {
  const [tab, setTab] = useState<"scout" | "map" | "ask">("scout");
  const saved = opportunities.filter(
    (opportunity) => opportunity.status === "Saved" || opportunity.status === "In progress",
  ).length;

  return (
    <section className="grouped-workspace">
      <div className="grouped-intro">
        <div>
          <span className="eyebrow">Find work</span>
          <h2>Find the next realistic opening.</h2>
          <p>Review campaign opportunities first. Use the map or questions only when you need more context.</p>
        </div>
        <div className="grouped-summary">
          <span><strong>{saved}</strong><small>saved</small></span>
          <span><strong>{opportunities.filter((item) => item.sourceType === "web").length}</strong><small>live sources</small></span>
        </div>
      </div>
      <div className="hub-tabs" role="tablist" aria-label="Opportunity tools">
        <button className={tab === "scout" ? "active" : ""} onClick={() => setTab("scout")}>
          <ScanSearch size={15} /> Opportunity inbox {saved > 0 && <b>{saved}</b>}
        </button>
        <button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}>
          <MapIcon size={15} /> Warm paths
        </button>
        <button className={tab === "ask" ? "active" : ""} onClick={() => setTab("ask")}>
          <Bot size={15} /> Ask the network
        </button>
      </div>
      {tab === "scout" && (
        <OpportunityScout
          contacts={contacts}
          profile={profile}
          opportunities={opportunities}
          onChange={onOpportunityChange}
          onSelectContact={onSelect}
          campaigns={campaigns}
          onCampaignsChange={onCampaignsChange}
          acts={acts}
          assets={assets}
          workspace={workspace}
        />
      )}
      {tab === "map" && (
        <>
          <PageGuide text="Filter the map, then select a signal to open that contact’s full record." />
          <RelationshipSection
            contacts={contacts}
            filter={mapFilter}
            onFilter={onMapFilter}
            hoverId={mapHoverId}
            onHover={onMapHover}
            onSelect={onSelect}
          />
        </>
      )}
      {tab === "ask" && (
        <>
          <PageGuide text="Ask one focused question. The answer uses information already stored in your contact network." />
          <AskNetwork contacts={contacts} onSelect={onSelect} />
        </>
      )}
    </section>
  );
}

function StudioWorkspace({
  profile,
  onProfileChange,
  workspace,
  acts,
  assets,
  campaigns,
}: {
  profile: ArtistProfile;
  onProfileChange: (profile: ArtistProfile) => void;
  workspace: ArtistWorkspace;
  acts: ActProfile[];
  assets: ArtistAsset[];
  campaigns: Campaign[];
}) {
  const [tab, setTab] = useState<"create" | "profile">("create");
  return (
    <section className="grouped-workspace">
      <div className="hub-tabs" role="tablist" aria-label="Pitch Room">
        <button className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}>
          <WandSparkles size={15} /> Create
        </button>
        <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>
          <Music2 size={15} /> Artist profile
        </button>
      </div>
      {tab === "create" ? (
        <CreativeStudio
          profile={profile}
          workspace={workspace}
          acts={acts}
          assets={assets}
          campaigns={campaigns}
          onOpenProfile={() => setTab("profile")}
        />
      ) : (
        <>
          <PageGuide text="Complete this once. Tours, research, drafts, and creative tools reuse the same factual context." />
          <ArtistProfileEditor profile={profile} onChange={onProfileChange} />
        </>
      )}
    </section>
  );
}

function DashboardOverview({
  contacts,
  opportunities,
  projects,
  bookingDeals,
  campaigns,
  assets,
  profile,
  completedTodayIds,
  onCompleteToday,
  onResetToday,
  onNavigate,
  onSelect,
  onEmail,
  onAdd,
}: {
  contacts: Contact[];
  opportunities: ResearchOpportunity[];
  projects: WorkProject[];
  bookingDeals: BookingDeal[];
  campaigns: Campaign[];
  assets: ArtistAsset[];
  profile: ArtistProfile;
  completedTodayIds: string[];
  onCompleteToday: (id: string) => void;
  onResetToday: () => void;
  onNavigate: (view: AppView) => void;
  onSelect: (id: string) => void;
  onEmail: (id: string) => void;
  onAdd: () => void;
}) {
  const [activeAction, setActiveAction] = useState<ManagerAction | null>(null);
  const due = contacts
    .filter((contact) => isDue(contact.next_follow_up_date))
    .sort((a, b) => followUpUrgency(b) - followUpUrgency(a));
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "Active");
  const suggestedCampaigns = campaigns.filter((campaign) => campaign.status === "Suggested");
  const managerActions = buildManagerActions({
    contacts,
    campaigns,
    opportunities,
    assets,
    bookingDeals,
    completedIds: completedTodayIds,
  });
  const dealSummary = summarizeBookingDeals(bookingDeals, campaigns);
  const primaryCampaign = activeCampaigns[0] || suggestedCampaigns[0] || campaigns[0];
  const campaignAssets = primaryCampaign
    ? assets.filter((asset) => asset.actId === primaryCampaign.actId)
    : assets;
  const missingMaterials = primaryCampaign
    ? primaryCampaign.requiredAssetKinds.filter(
        (required) => !campaignAssets.some((asset) => asset.kind === required),
      )
    : [];
  const routeGaps = activeCampaigns.flatMap((campaign) =>
    campaign.routeStops.filter((routeDate) => routeDate.status === "Available"),
  );
  const completedCount = completedTodayIds.length;
  const planReady = managerActions.length > 0;

  const moduleCards = [
    {
      title: "Deals",
      copy: "Move gig leads, fees, and follow-ups forward.",
      icon: CircleDollarSign,
      view: "deals" as AppView,
      stat: formatMoney(dealSummary.projectedIncome),
    },
    {
      title: "Campaigns",
      copy: "Choose the active tour, release, or commission push.",
      icon: FolderKanban,
      view: "work" as AppView,
      stat: `${activeCampaigns.length || suggestedCampaigns.length} ready`,
    },
    {
      title: "People",
      copy: "Send follow-ups and update contact status.",
      icon: Users,
      view: "relationships" as AppView,
      stat: `${due.length} due`,
    },
    {
      title: "Pitch Room",
      copy: "Prepare pitches and outreach for approval.",
      icon: WandSparkles,
      view: "studio" as AppView,
      stat: "Draft only",
    },
  ];
  const newModuleCards = [
    {
      title: "Calendar view",
      copy: "See all confirmed and pending dates. Spot route gaps instantly.",
      icon: CalendarClock,
      color: "#712B13",
      view: "calendar" as AppView,
      badge: "New",
    },
    {
      title: "Radar",
      copy: "Weekly AI scan of festivals, venues, and labels ranked by fit.",
      icon: Radio,
      color: "#3C3489",
      view: "radar" as AppView,
      badge: "New",
    },
    {
      title: "Income tracker",
      copy: "Confirmed vs projected fees per campaign. Break-even by route.",
      icon: ChartBar,
      color: "#085041",
      view: "income" as AppView,
      badge: "New",
    },
    {
      title: "Press & EPK",
      copy: "Bio, photos, live links - always pitch-ready. Attach to any outreach draft.",
      icon: FileText,
      color: "#633806",
      view: "studio" as AppView,
      badge: "",
    },
  ];

  return (
    <section className="manager-plan-workspace">
      <div className="manager-plan-hero">
        <div>
          <span className="eyebrow">Today</span>
          <h2>Move the bookings that matter.</h2>
          <p>
            A short manager plan for income, follow-ups, route gaps, and pitch readiness.
            No hunting through the whole app.
          </p>
        </div>
        <div className="manager-plan-hero-actions">
          {completedCount > 0 && (
            <button className="button button-ghost" onClick={onResetToday}>
              Restore hidden moves
            </button>
          )}
          <button className="button button-secondary" onClick={onAdd}><Plus size={15} /> Add contact</button>
        </div>
      </div>

      <div className="manager-plan-summary">
        <article>
          <span><CircleDollarSign size={17} /></span>
          <div><strong>{formatMoney(dealSummary.projectedIncome)}</strong><small>Projected income</small></div>
          <HelpTip text="Estimated value of active deals still being worked. It is not confirmed income." />
        </article>
        <article>
          <span><Target size={17} /></span>
          <div><strong>{dealSummary.mostImportantDeal?.title || "No deal yet"}</strong><small>Best booking move</small></div>
          <HelpTip text="The deal most likely to deserve attention first based on follow-up urgency, value, and fit." />
        </article>
        <article>
          <span><Mail size={17} /></span>
          <div><strong>{dealSummary.followUpsDue + due.length}</strong><small>Follow-ups due</small></div>
          <HelpTip text="Booking deals and relationships whose follow-up date is today or earlier." />
        </article>
        <article>
          <span><Sparkles size={17} /></span>
          <div><strong>{missingMaterials.length}</strong><small>Pitch blockers</small></div>
          <HelpTip text="Campaign assets that are required before confident outreach." />
        </article>
      </div>

      <div className="manager-plan-grid">
        <article className="panel manager-action-card">
          <div className="overview-card-heading">
            <div>
              <span className="eyebrow">This week</span>
              <h3>{planReady ? "Your next five useful moves" : "Everything urgent is clear"}</h3>
            </div>
            <span className={`friendly-label${planReady ? "" : " calm"}`}>
              {planReady ? "Do these in order" : "No pressure"}
            </span>
          </div>
          <div className="manager-action-list">
            {managerActions.map((action, index) => (
              <ManagerActionRow
                key={action.id}
                action={action}
                index={index}
                onAction={() => setActiveAction(action)}
                onComplete={() => onCompleteToday(action.id)}
              />
            ))}
            {!managerActions.length && (
              <div className="manager-plan-empty">
                <span><Check size={19} /></span>
                <div>
                  <strong>No urgent move is waiting.</strong>
                  <small>Open Deals to add a booking lead, or Pitch Room to prepare outreach.</small>
                </div>
              </div>
            )}
          </div>
          <div className="today-module-grid" aria-label="New manager modules">
            {newModuleCards.map(({ title, copy, icon: Icon, color, view, badge }) => (
                <button type="button" className="today-module-card" key={title} onClick={() => onNavigate(view)}>
                <span className="today-module-icon" style={{ color }}><Icon size={18} /></span>
                <span>
                  <strong>{title}{badge && <b>{badge}</b>}</strong>
                  <small>{copy}</small>
                </span>
              </button>
            ))}
          </div>
        </article>

        <aside className="manager-side-stack">
          <article className="panel manager-focus-card">
            <span className="manager-focus-icon"><Target size={18} /></span>
            <div>
              <span className="eyebrow">One focus</span>
              <h3>{primaryCampaign ? primaryCampaign.name : "Choose a campaign"}</h3>
              <p>{primaryCampaign ? primaryCampaign.goal : "Activate a campaign so the app can rank contacts and opportunities properly."}</p>
            </div>
            <button className="button button-secondary" onClick={() => onNavigate("work")}>
              Open campaigns <ArrowRight size={13} />
            </button>
          </article>

          <div className="manager-health-grid">
            <article>
              <strong>{bookingDeals.filter((deal) => deal.status !== "confirmed" && deal.status !== "passed").length}</strong>
              <span>open deals</span>
            </article>
            <article>
              <strong>{routeGaps.length}</strong>
              <span>route gaps</span>
            </article>
            <article>
              <strong>{suggestedCampaigns.length}</strong>
              <span>need review</span>
            </article>
          </div>

          <article className="panel manager-modules-card">
            <div className="overview-card-heading">
              <div><span className="eyebrow">Modules</span><h3>Where to go next</h3></div>
            </div>
            <div className="manager-module-list">
              {moduleCards.map(({ title, copy, icon: Icon, view, stat }) => (
                <button key={title} onClick={() => onNavigate(view)}>
                  <span><Icon size={16} /></span>
                  <div><strong>{title}</strong><small>{copy}</small></div>
                  <b>{stat}</b>
                </button>
              ))}
            </div>
          </article>
        </aside>
      </div>

      {activeAction && (
        <TodayActionPanel
          action={activeAction}
          deal={activeAction.dealId ? bookingDeals.find((deal) => deal.id === activeAction.dealId) : undefined}
          contact={activeAction.contactId ? contacts.find((contact) => contact.id === activeAction.contactId) : undefined}
          opportunity={activeAction.opportunityId ? opportunities.find((opportunity) => opportunity.id === activeAction.opportunityId) : undefined}
          campaign={activeAction.campaignId ? campaigns.find((campaign) => campaign.id === activeAction.campaignId) : primaryCampaign}
          onClose={() => setActiveAction(null)}
          onNavigate={(view) => {
            setActiveAction(null);
            onNavigate(view);
          }}
          onSelect={(id) => {
            setActiveAction(null);
            onSelect(id);
          }}
          onEmail={(id) => {
            setActiveAction(null);
            onEmail(id);
          }}
        />
      )}

    </section>
  );
}

function TodayActionPanel({
  action,
  deal,
  contact,
  opportunity,
  campaign,
  onClose,
  onNavigate,
  onSelect,
  onEmail,
}: {
  action: ManagerAction;
  deal?: BookingDeal;
  contact?: Contact;
  opportunity?: ResearchOpportunity;
  campaign?: Campaign;
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  onSelect: (id: string) => void;
  onEmail: (id: string) => void;
}) {
  return (
    <aside className="today-action-panel" aria-label="Today action details">
      <div className="today-action-panel-head">
        <div>
          <span className="eyebrow">Action detail</span>
          <h3>{action.title}</h3>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close action detail"><X size={18} /></button>
      </div>
      <div className="today-action-panel-body">
        <section>
          <small>Why this matters</small>
          <p>{action.reason}</p>
          <strong>{action.detail}</strong>
        </section>
        {deal && (
          <section>
            <small>Booking deal</small>
            <h4>{deal.title}</h4>
            <dl>
              <div><dt>Status</dt><dd>{deal.status.replaceAll("_", " ")}</dd></div>
              <div><dt>Value</dt><dd>{formatMoney(deal.projectedValue || deal.targetFee || 0)}</dd></div>
              <div><dt>Place</dt><dd>{[deal.city, deal.country].filter(Boolean).join(", ") || "Not set"}</dd></div>
              <div><dt>Pitch blockers</dt><dd>{deal.missingMaterials.length ? deal.missingMaterials.join(", ") : "None"}</dd></div>
            </dl>
          </section>
        )}
        {contact && (
          <section>
            <small>Person</small>
            <h4>{contactLabel(contact)}</h4>
            <p>{contact.company} · {contact.city}{contact.country ? `, ${contact.country}` : ""}</p>
            <strong>{contact.recommended_next_action || "Choose the next relationship move."}</strong>
          </section>
        )}
        {opportunity && (
          <section>
            <small>Opportunity</small>
            <h4>{opportunity.title}</h4>
            <p>{opportunity.organisation} · {opportunity.confidence}% fit</p>
            <strong>{opportunity.nextAction}</strong>
          </section>
        )}
        {campaign && (
          <section>
            <small>Campaign</small>
            <h4>{campaign.name}</h4>
            <p>{campaign.goal}</p>
          </section>
        )}
      </div>
      <div className="today-action-panel-actions">
        {contact && <button type="button" className="button button-primary" onClick={() => onEmail(contact.id)}><Mail size={14} /> Draft email</button>}
        {contact && <button type="button" className="button button-secondary" onClick={() => onSelect(contact.id)}><Users size={14} /> Open person</button>}
        <button type="button" className="button button-ghost" onClick={() => onNavigate(action.targetView)}>
          Open module <ArrowRight size={13} />
        </button>
      </div>
    </aside>
  );
}

function ManagerActionRow({
  action,
  index,
  onAction,
  onComplete,
}: {
  action: ManagerAction;
  index: number;
  onAction: () => void;
  onComplete: () => void;
}) {
  const icons: Record<ManagerAction["type"], typeof Check> = {
    confirm: Check,
    deal: CircleDollarSign,
    opportunity: ScanSearch,
    "follow-up": Mail,
    material: Sparkles,
    route: Route,
    relationship: Users,
  };
  const Icon = icons[action.type];
  return (
    <div className={`manager-action-row priority-${Math.min(5, Math.max(1, action.urgency))}`}>
      <span className="manager-action-number">{String(index + 1).padStart(2, "0")}</span>
      <span className={`manager-action-icon ${action.type}`}><Icon size={16} /></span>
      <div className="manager-action-copy">
        <span>
          <strong>{action.title}</strong>
          {action.relatedLabel && <b>{action.relatedLabel}</b>}
        </span>
        <p>{action.reason}</p>
        <small>{action.detail}</small>
      </div>
      <div className="manager-action-actions">
        <button type="button" className="button button-primary" onMouseDown={onAction} onClick={onAction}>
          {action.primaryActionLabel} <ArrowRight size={12} />
        </button>
        <button type="button" className="today-task-done" onClick={onComplete} title="Hide this move for now">
          <Check size={13} /> Done
        </button>
      </div>
    </div>
  );
}

function CalendarWorkspace({
  contacts,
  campaigns,
  deals,
  opportunities,
  onNavigate,
}: {
  contacts: Contact[];
  campaigns: Campaign[];
  deals: BookingDeal[];
  opportunities: ResearchOpportunity[];
  onNavigate: (view: AppView) => void;
}) {
  const today = TODAY();
  const routeItems = campaigns.flatMap((campaign) =>
    campaign.routeStops.map((stop) => ({
      id: `${campaign.id}-${stop.id}`,
      kind: stop.status,
      title: stop.venue || `${stop.city || "Open route window"}${stop.country ? `, ${stop.country}` : ""}`,
      detail: campaign.name,
      date: stop.startDate || campaign.startDate,
      secondaryDate: stop.endDate,
    })),
  );
  const followUpItems = [
    ...deals
      .filter((deal) => deal.followUpDate)
      .map((deal) => ({
        id: `deal-${deal.id}`,
        kind: "Follow-up",
        title: deal.title,
        detail: deal.nextStep,
        date: deal.followUpDate || "",
        secondaryDate: "",
      })),
    ...contacts
      .filter((contact) => contact.next_follow_up_date)
      .map((contact) => ({
        id: `contact-${contact.id}`,
        kind: "Follow-up",
        title: contactLabel(contact),
        detail: contact.recommended_next_action || contact.company,
        date: contact.next_follow_up_date,
        secondaryDate: "",
      })),
  ];
  const deadlineItems = opportunities
    .filter((opportunity) => opportunity.deadline)
    .map((opportunity) => ({
      id: `opportunity-${opportunity.id}`,
      kind: "Deadline",
      title: opportunity.title,
      detail: opportunity.organisation,
      date: opportunity.deadline,
      secondaryDate: "",
    }));
  const items = [...routeItems, ...followUpItems, ...deadlineItems]
    .filter((item) => item.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = items.filter((item) => item.date >= today).slice(0, 10);
  const routeGaps = campaigns.flatMap((campaign) =>
    campaign.routeStops
      .filter((stop) => stop.status === "Available")
      .map((stop) => ({ ...stop, campaignName: campaign.name })),
  );

  return (
    <section className="simple-module-workspace">
      <div className="simple-module-hero">
        <div>
          <span className="eyebrow">Calendar</span>
          <h2>Dates and route gaps in one place.</h2>
          <p>Confirmed dates, pending windows, deal follow-ups, and application deadlines without spreadsheet hunting.</p>
        </div>
        <button className="button button-primary" onClick={() => onNavigate("work")}>Edit campaigns <ArrowRight size={13} /></button>
      </div>
      <div className="simple-stat-grid">
        <article><strong>{routeItems.filter((item) => item.kind === "Confirmed").length}</strong><span>confirmed dates</span></article>
        <article><strong>{routeItems.filter((item) => item.kind === "Tentative").length}</strong><span>tentative dates</span></article>
        <article><strong>{routeGaps.length}</strong><span>route gaps</span></article>
        <article><strong>{followUpItems.filter((item) => item.date <= today).length}</strong><span>follow-ups due</span></article>
      </div>
      <div className="simple-module-grid">
        <article className="panel simple-list-card">
          <div className="simple-card-heading"><CalendarClock size={16} /><span><strong>Upcoming</strong><small>Next dates and deadlines</small></span></div>
          {upcoming.map((item) => (
            <div className="simple-list-row" key={item.id}>
              <time>{formatDate(item.date)}</time>
              <span><strong>{item.title}</strong><small>{item.kind} · {item.detail}</small></span>
            </div>
          ))}
          {!upcoming.length && <p>No upcoming dates recorded yet.</p>}
        </article>
        <article className="panel simple-list-card">
          <div className="simple-card-heading"><Route size={16} /><span><strong>Route gaps</strong><small>Open windows that need prospects</small></span></div>
          {routeGaps.slice(0, 8).map((gap) => (
            <div className="simple-list-row" key={gap.id}>
              <time>{formatDate(gap.startDate)}</time>
              <span><strong>{gap.city || "Open window"}</strong><small>{gap.campaignName} · {formatDate(gap.endDate)}</small></span>
            </div>
          ))}
          {!routeGaps.length && <p>No open route gaps recorded.</p>}
        </article>
      </div>
    </section>
  );
}

function IncomeWorkspace({
  campaigns,
  deals,
  workspace,
  onNavigate,
}: {
  campaigns: Campaign[];
  deals: BookingDeal[];
  workspace: ArtistWorkspace;
  onNavigate: (view: AppView) => void;
}) {
  const summary = summarizeBookingDeals(deals, campaigns);
  const campaignRows = campaigns.map((campaign) => {
    const campaignDeals = deals.filter((deal) => deal.campaignId === campaign.id);
    const confirmed = campaignDeals
      .filter((deal) => deal.status === "confirmed")
      .reduce((sum, deal) => sum + (deal.confirmedValue || deal.targetFee || 0), 0);
    const projected = campaignDeals
      .filter((deal) => deal.status !== "confirmed" && deal.status !== "passed")
      .reduce((sum, deal) => sum + (deal.projectedValue || 0), 0);
    const costs = campaign.expenses.reduce((sum, expense) => sum + Number(expense.amount.replace(/[^0-9.-]/g, "")) || sum, 0);
    return { campaign, confirmed, projected, costs, balance: confirmed + projected - costs };
  });

  return (
    <section className="simple-module-workspace">
      <div className="simple-module-hero">
        <div>
          <span className="eyebrow">Income</span>
          <h2>Know what is booked, likely, and missing.</h2>
          <p>Use recorded deals and campaign costs to see where each route stands before committing more outreach.</p>
        </div>
        <button className="button button-primary" onClick={() => onNavigate("deals")}>Work deals <ArrowRight size={13} /></button>
      </div>
      <div className="simple-stat-grid">
        <article><strong>{formatMoney(summary.confirmedIncome, workspace.defaultCurrency)}</strong><span>confirmed</span></article>
        <article><strong>{formatMoney(summary.projectedIncome, workspace.defaultCurrency)}</strong><span>projected</span></article>
        <article><strong>{formatMoney(summary.openDealValue, workspace.defaultCurrency)}</strong><span>open value</span></article>
        <article><strong>{summary.highestValueDeals.length}</strong><span>priority deals</span></article>
      </div>
      <article className="panel income-table-card">
        <div className="simple-card-heading"><ChartBar size={16} /><span><strong>Campaign break-even</strong><small>Recorded estimates only</small></span></div>
        <div className="income-table">
          {campaignRows.map(({ campaign, confirmed, projected, costs, balance }) => (
            <div className="income-row" key={campaign.id}>
              <span><strong>{campaign.name}</strong><small>{campaign.type}</small></span>
              <span><small>Confirmed</small>{formatMoney(confirmed, workspace.defaultCurrency)}</span>
              <span><small>Projected</small>{formatMoney(projected, workspace.defaultCurrency)}</span>
              <span><small>Costs</small>{formatMoney(costs, workspace.defaultCurrency)}</span>
              <span className={balance >= 0 ? "positive" : "negative"}><small>Balance</small>{formatMoney(Math.abs(balance), workspace.defaultCurrency)}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function SettingsWorkspace({
  contacts,
  workspace,
  acts,
  assets,
  campaigns,
  opportunities,
  onWorkspaceChange,
  onActsChange,
  onAssetsChange,
  onSelectContact,
  onReset,
  onExportWorkspace,
  onImportWorkspace,
  onExportJson,
  onExportCsv,
}: {
  contacts: Contact[];
  workspace: ArtistWorkspace;
  acts: ActProfile[];
  assets: ArtistAsset[];
  campaigns: Campaign[];
  opportunities: ResearchOpportunity[];
  onWorkspaceChange: (workspace: ArtistWorkspace) => void;
  onActsChange: (acts: ActProfile[]) => void;
  onAssetsChange: (assets: ArtistAsset[]) => void;
  onSelectContact: (id: string) => void;
  onReset: () => void;
  onExportWorkspace: () => void;
  onImportWorkspace: (file: File) => Promise<void>;
  onExportJson: () => void;
  onExportCsv: () => void;
}) {
  const [tab, setTab] = useState<"portfolio" | "quality" | "data">("portfolio");
  const [importError, setImportError] = useState("");
  return (
    <section className="settings-workspace">
      <div className="hub-tabs" role="tablist" aria-label="Setup">
        <button className={tab === "portfolio" ? "active" : ""} onClick={() => setTab("portfolio")}>
          <Music2 size={15} /> Portfolio & assets
        </button>
        <button className={tab === "quality" ? "active" : ""} onClick={() => setTab("quality")}>
          <Check size={15} /> Data quality
        </button>
        <button className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}>
          <Download size={15} /> Backups & automation
        </button>
      </div>
      {tab === "portfolio" ? (
        <PortfolioSettings
          workspace={workspace}
          acts={acts}
          assets={assets}
          campaigns={campaigns}
          onWorkspaceChange={onWorkspaceChange}
          onActsChange={onActsChange}
          onAssetsChange={onAssetsChange}
        />
      ) : tab === "quality" ? (
        <>
          <PageGuide text="Improve the details that have the greatest practical effect on outreach and follow-up." />
          <DataReadinessPanel contacts={contacts} onSelect={onSelectContact} />
        </>
      ) : (
        <>
          <PageGuide text="Create a backup before major changes. Reset only when you intend to clear this browser’s workspace." />
          <div className="settings-grid">
            <article className="panel settings-card">
              <span className="icon-box"><Download size={18} /></span>
              <h2>Back up your workspace</h2>
              <p>Save contacts, projects, bookings, costs, opportunities, profile, relationship history, and local drafts in one file. Treat the downloaded file as private.</p>
              <div className="settings-actions">
                <button className="button button-secondary" onClick={onExportWorkspace}><FileJson size={15} /> Full backup</button>
                <label
                  className="button button-ghost workspace-import-button"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.currentTarget.querySelector("input")?.click();
                    }
                  }}
                >
                  <Upload size={15} /> Restore backup
                  <input
                    className="workspace-import-input"
                    type="file"
                    accept=".json,application/json"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      setImportError("");
                      try {
                        await onImportWorkspace(file);
                      } catch (error) {
                        setImportError(
                          error instanceof Error ? error.message : "The backup could not be restored.",
                        );
                      }
                    }}
                  />
                </label>
              </div>
              <div className="settings-actions secondary-exports">
                <button className="text-button" onClick={onExportJson}>Contacts JSON</button>
                <button className="text-button" onClick={onExportCsv}>Contacts CSV</button>
              </div>
              {importError && <div className="form-error">{importError}</div>}
            </article>
            <article className="panel settings-card caution">
              <span className="icon-box"><RefreshCcw size={18} /></span>
              <h2>Reset local data</h2>
              <p>Clear browser edits and lock the private contact bundle again.</p>
              <button className="button button-ghost" onClick={onReset}><RefreshCcw size={15} /> Reset local data</button>
            </article>
          </div>
          <AutomationBlueprint />
          <IntegrationPanel
            contacts={contacts}
            acts={acts}
            assets={assets}
            campaigns={campaigns}
            opportunities={opportunities}
          />
        </>
      )}
    </section>
  );
}

function IntegrationPanel({
  contacts,
  acts,
  assets,
  campaigns,
  opportunities,
}: {
  contacts: Contact[];
  acts: ActProfile[];
  assets: ArtistAsset[];
  campaigns: Campaign[];
  opportunities: ResearchOpportunity[];
}) {
  const [status, setStatus] = useState<{
    airtable: boolean;
    make: boolean;
    googleCalendar: boolean;
    gmailMode: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetch("/api/integrations/status")
      .then((response) => response.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const sync = async () => {
    setSyncing(true);
    setMessage("");
    try {
      const response = await fetch("/api/airtable/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts, acts, assets, campaigns, opportunities }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Airtable sync failed.");
      setMessage(`Synced ${Object.values(payload.counts as Record<string, number>).reduce((sum, value) => sum + value, 0)} operational records to Airtable.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Airtable sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section className="panel integration-panel">
      <div className="campaign-section-heading">
        <div><Zap size={16} /><span><strong>Connected workflow</strong><small>Airtable holds operations; Gmail remains drafts-only.</small></span></div>
      </div>
      <div className="integration-status-grid">
        <article className={status?.airtable ? "ready" : ""}><span>Airtable</span><strong>{status?.airtable ? "Connected" : "Needs keys"}</strong><small>Acts, campaigns, assets and opportunities</small></article>
        <article className={status?.make ? "ready" : ""}><span>Make</span><strong>{status?.make ? "Connected" : "Not connected"}</strong><small>Controlled automation hand-offs</small></article>
        <article className={status?.googleCalendar ? "ready" : ""}><span>Calendar</span><strong>{status?.googleCalendar ? "Configured" : "Not configured"}</strong><small>Shows, deadlines and follow-ups</small></article>
        <article className="ready"><span>Gmail</span><strong>Drafts only</strong><small>Nothing is ever auto-sent</small></article>
      </div>
      <div className="integration-actions">
        <button className="button button-primary" onClick={sync} disabled={!status?.airtable || syncing}>
          <RefreshCcw size={14} className={syncing ? "spin" : ""} /> {syncing ? "Syncing..." : "Sync operational data"}
        </button>
        <span>Private raw notes and unapproved drafts are excluded.</span>
      </div>
      {message && <div className="scout-message"><Check size={14} /><span>{message}</span></div>}
    </section>
  );
}

function PortfolioSettings({
  workspace,
  acts,
  assets,
  campaigns,
  onWorkspaceChange,
  onActsChange,
  onAssetsChange,
}: {
  workspace: ArtistWorkspace;
  acts: ActProfile[];
  assets: ArtistAsset[];
  campaigns: Campaign[];
  onWorkspaceChange: (workspace: ArtistWorkspace) => void;
  onActsChange: (acts: ActProfile[]) => void;
  onAssetsChange: (assets: ArtistAsset[]) => void;
}) {
  const [selectedActId, setSelectedActId] = useState(acts[0]?.id || "");
  const [budgetSnapshot, setBudgetSnapshot] = useState<{
    limitUsd: number;
    usedUsd: number;
    remainingUsd: number;
  } | null>(null);
  useEffect(() => {
    fetch("/api/ai-budget")
      .then((response) => response.json())
      .then((payload) => setBudgetSnapshot(payload))
      .catch(() => setBudgetSnapshot(null));
  }, []);
  const act = acts.find((item) => item.id === selectedActId) || acts[0];
  if (!act) return null;
  const updateAct = (patch: Partial<ActProfile>) =>
    onActsChange(acts.map((item) => item.id === act.id ? { ...item, ...patch } : item));
  const actAssets = assets.filter((asset) => asset.actId === act.id);

  return (
    <section className="portfolio-settings">
      <div className="portfolio-settings-intro">
        <div>
          <span className="eyebrow">Hamed's portfolio</span>
          <h2>One career, several distinct artistic products.</h2>
          <p>Edit any public-site detail before it is used in outreach. Website-sourced information is labelled rather than silently treated as fact.</p>
        </div>
        <div className="ai-budget-card">
          <span><Sparkles size={17} /></span>
          <div>
            <small>AI budget remaining</small>
            <strong>US${(budgetSnapshot?.remainingUsd ?? workspace.monthlyAiBudgetUsd).toFixed(2)}</strong>
            {budgetSnapshot && <small>US${budgetSnapshot.usedUsd.toFixed(2)} used of US${budgetSnapshot.limitUsd.toFixed(2)}</small>}
          </div>
          <span className="source-pill network"><Check size={12} /> Hard stop</span>
        </div>
      </div>
      <div className="portfolio-settings-layout">
        <aside className="portfolio-act-list">
          {acts.map((item) => (
            <button key={item.id} className={item.id === act.id ? "active" : ""} onClick={() => setSelectedActId(item.id)}>
              <span>{item.name.slice(0, 1)}</span>
              <span><strong>{item.name}</strong><small>{campaigns.filter((campaign) => campaign.actId === item.id).length} campaigns</small></span>
            </button>
          ))}
        </aside>
        <article className="panel portfolio-editor">
          <div className="portfolio-editor-head">
            <div><span className="source-pill web"><Globe2 size={12} /> Website sourced</span><h3>{act.name}</h3></div>
            <a href={act.sourceUrl} target="_blank" rel="noreferrer">View source <ExternalLink size={12} /></a>
          </div>
          <div className="profile-form-grid">
            <label className="profile-field"><span>Act name</span><input value={act.name} onChange={(event) => updateAct({ name: event.target.value })} /></label>
            <label className="profile-field"><span>Format</span><input value={act.format} onChange={(event) => updateAct({ format: event.target.value })} /></label>
            <label className="profile-field wide"><span>Genre and positioning</span><textarea rows={2} value={act.genres} onChange={(event) => updateAct({ genres: event.target.value })} /></label>
            <label className="profile-field wide"><span>One-line pitch</span><textarea rows={2} value={act.oneLinePitch} onChange={(event) => updateAct({ oneLinePitch: event.target.value })} /></label>
            <label className="profile-field wide"><span>Biography</span><textarea rows={5} value={act.shortBio} onChange={(event) => updateAct({ shortBio: event.target.value })} /></label>
          </div>
          <label className="portfolio-confirm">
            <input type="checkbox" checked={act.confirmed} onChange={(event) => updateAct({ confirmed: event.target.checked })} />
            <span><strong>Hamed has reviewed these facts</strong><small>Confirmed copy can be used confidently in generated drafts.</small></span>
          </label>
          <div className="portfolio-assets">
            <div className="campaign-section-heading"><div><FileJson size={16} /><span><strong>Saved materials</strong><small>{actAssets.length} currently attached</small></span></div></div>
            {actAssets.map((asset) => (
              <label key={asset.id}>
                <select value={asset.kind} onChange={(event) => onAssetsChange(assets.map((item) => item.id === asset.id ? { ...item, kind: event.target.value as ArtistAsset["kind"] } : item))}>
                  <option>Website</option><option>EPK</option><option>Biography</option><option>Music</option><option>Live video</option><option>Press quote</option><option>Technical rider</option>
                </select>
                <input value={asset.label} onChange={(event) => onAssetsChange(assets.map((item) => item.id === asset.id ? { ...item, label: event.target.value } : item))} />
                <input value={asset.value} onChange={(event) => onAssetsChange(assets.map((item) => item.id === asset.id ? { ...item, value: event.target.value } : item))} />
              </label>
            ))}
            <button
              className="button button-secondary"
              onClick={() => onAssetsChange([...assets, {
                id: `ASSET-${Date.now()}`,
                actId: act.id,
                kind: "EPK",
                label: "New material",
                value: "",
                source: "user",
                verified: false,
              }])}
            >
              <Plus size={14} /> Add material
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

function DataReadinessPanel({
  contacts,
  onSelect,
}: {
  contacts: Contact[];
  onSelect: (id: string) => void;
}) {
  const summary = buildDataHealthSummary(contacts);
  const metricIcons: Record<DataHealthMetric["id"], typeof Mail> = {
    email: Mail,
    location: MapPin,
    "next-action": Target,
    "follow-up": CalendarClock,
  };
  return (
    <section className="panel data-readiness-card">
      <div className="data-readiness-heading">
        <div>
          <span className="eyebrow">Contact data readiness</span>
          <h2>Know what is usable before outreach starts.</h2>
          <p>The app prioritises the missing details that have the biggest practical impact.</p>
        </div>
        <div className="readiness-score">
          <strong>{summary.score}</strong>
          <span>/100</span>
          <small>overall readiness</small>
        </div>
      </div>

      <div className="readiness-metrics">
        {summary.metrics.map((metric) => {
          const Icon = metricIcons[metric.id];
          return (
            <article key={metric.id}>
              <span><Icon size={15} /></span>
              <div>
                <strong>{metric.value}% {metric.label}</strong>
                <small>{metric.detail}</small>
                <i><b style={{ width: `${metric.value}%` }} /></i>
              </div>
            </article>
          );
        })}
      </div>

      <div className="readiness-queue-heading">
        <div><strong>Best details to improve next</strong><small>Start at the top; one useful fix at a time.</small></div>
        <span>{summary.tasks.length} suggested</span>
      </div>
      <div className="readiness-task-list">
        {summary.tasks.map((task) => (
          <button key={task.id} onClick={() => onSelect(task.contactId)}>
            <span className="avatar">{task.contactName.slice(0, 1)}</span>
            <span>
              <strong>{task.title}</strong>
              <small>{task.contactName}{task.company && task.company !== task.contactName ? ` · ${task.company}` : ""}</small>
              <em>{task.reason}</em>
            </span>
            <b className={task.priority === "Important" ? "important" : ""}>{task.priority}</b>
            <ArrowRight size={13} />
          </button>
        ))}
        {!summary.tasks.length && (
          <div className="readiness-complete"><Check size={17} /><span>Your core contact data is ready to work with.</span></div>
        )}
      </div>
      <div className="readiness-safety">
        <Check size={13} />
        <span>Only verified public details or user-confirmed relationship information should be added.</span>
      </div>
    </section>
  );
}

function UnlockScreen({
  onUnlock,
}: {
  onUnlock: (passphrase: string) => Promise<void>;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const unlock = async () => {
    if (!passphrase.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onUnlock(passphrase.trim());
    } catch {
      setError("That passphrase could not unlock the contact bundle.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="unlock-screen">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="unlock-card">
        <span className="brand-mark unlock-mark"><Music2 size={28} /></span>
        <span className="eyebrow">Private network access</span>
        <h1>Unlock Jazz Network Navigator</h1>
        <p>
          The contact dataset is AES-256 encrypted. Enter the separately shared
          passphrase to decrypt it only in this browser.
        </p>
        <label className="unlock-input">
          <Target size={19} />
          <input
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && unlock()}
            placeholder="Enter contact bundle passphrase"
            autoFocus
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button
          className="button button-primary unlock-button"
          onClick={unlock}
          disabled={!passphrase.trim() || loading}
        >
          <Zap size={16} /> {loading ? "Decrypting…" : "Unlock network"}
        </button>
        <div className="unlock-note">
          <Check size={14} />
          <span>The passphrase is never sent to the server or stored in the repository.</span>
        </div>
      </section>
    </main>
  );
}

function Header({
  onAdd,
  onReset,
  onExportJson,
  onExportCsv,
}: {
  onAdd: () => void;
  onReset: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
}) {
  return (
    <header className="topbar">
      <a className="brand" href="#top">
        <span className="brand-mark"><Music2 size={20} /></span>
        <span>
          Jazz Network
          <strong>Navigator</strong>
        </span>
      </a>
      <nav>
        <a href="#radar">Radar</a>
        <a href="#follow-ups">Follow-ups</a>
        <a href="#tour-builder">Tour Builder</a>
        <a href="#directory">Directory</a>
        <a href="#ask">Ask network</a>
      </nav>
      <div className="header-actions">
        <button className="button button-ghost hide-mobile" onClick={onReset}>
          <RefreshCcw size={15} /> Reset
        </button>
        <div className="export-menu">
          <button className="button button-ghost"><Download size={15} /> Export</button>
          <div className="export-popover">
            <button onClick={onExportJson}><FileJson size={15} /> Export JSON</button>
            <button onClick={onExportCsv}><Download size={15} /> Export CSV</button>
          </div>
        </div>
        <button className="button button-primary" onClick={onAdd}>
          <Plus size={16} /> Add contact
        </button>
      </div>
    </header>
  );
}

function Hero({ contacts }: { contacts: Contact[] }) {
  const cityCount = new Set(
    contacts
      .filter((contact) => contact.city && contact.city !== "Unknown")
      .map((contact) => `${contact.city}|${contact.country}`),
  ).size;
  const kpis = [
    { label: "Total contacts", value: contacts.length, icon: Users, tone: "violet" },
    {
      label: "Hot relationships",
      value: contacts.filter((contact) => contact.relationship_temperature === "Hot").length,
      icon: Flame,
      tone: "red",
    },
    {
      label: "Follow-ups due",
      value: contacts.filter((contact) => isDue(contact.next_follow_up_date)).length,
      icon: CalendarClock,
      tone: "amber",
    },
    { label: "Cities covered", value: cityCount, icon: Globe2, tone: "cyan" },
    {
      label: "Demo contacts",
      value: contacts.filter((contact) => contact.is_dummy === "TRUE").length,
      icon: Sparkles,
      tone: "pink",
    },
  ];

  const strongest = [...contacts].sort((a, b) => b.relationship_score - a.relationship_score)[0];

  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <span className="live-pill"><span /> Relationship intelligence, tuned for music</span>
        <h1>Your network has a <em>next move.</em></h1>
        <p>
          AI-powered relationship radar for booking, festivals, labels, venues and press.
          See the signal, make the follow-up, keep the momentum.
        </p>
        <div className="hero-prompt">
          <Bot size={20} />
          <span>
            Strongest signal today: <strong>{contactLabel(strongest)}</strong>
            {strongest?.company ? ` at ${strongest.company}` : ""}.
          </span>
          <a href="#follow-ups">See the move <ArrowRight size={15} /></a>
        </div>
      </div>
      <div className="hero-visual" aria-hidden="true">
        <div className="vinyl vinyl-one" />
        <div className="vinyl vinyl-two" />
        <div className="signal-orbit orbit-one"><span /></div>
        <div className="signal-orbit orbit-two"><span /></div>
        <div className="hero-score">
          <small>NETWORK PULSE</small>
          <strong>{Math.round(contacts.reduce((sum, c) => sum + c.relationship_score, 0) / contacts.length)}</strong>
          <span>average relationship score</span>
        </div>
      </div>
      <div className="kpi-grid">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <article className="kpi-card" key={label}>
            <span className={`kpi-icon kpi-${tone}`}><Icon size={18} /></span>
            <div><strong>{value}</strong><span>{label}</span></div>
            <Activity size={16} className="kpi-trend" />
          </article>
        ))}
      </div>
    </section>
  );
}

function RelationshipSection({
  contacts,
  filter,
  onFilter,
  hoverId,
  onHover,
  onSelect,
}: {
  contacts: Contact[];
  filter: MapFilter;
  onFilter: (filter: MapFilter) => void;
  hoverId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const plotted = contacts.filter(
    (contact) =>
      contact.lat !== "" && contact.lng !== "" && contactMatchesMapFilter(contact, filter),
  );
  const unknown = contacts.filter(
    (contact) => contact.lat === "" || contact.lng === "",
  ).length;
  const hovered = contacts.find((contact) => contact.id === hoverId);

  const clusters = useMemo(() => {
    const grouped = new Map<string, Contact[]>();
    contacts
      .filter((contact) => contact.city && contact.city !== "Unknown")
      .forEach((contact) => {
        const key = `${contact.city}, ${contact.country}`;
        grouped.set(key, [...(grouped.get(key) || []), contact]);
      });
    return [...grouped.entries()]
      .map(([location, members]) => {
        const categories = new Map<string, number>();
        members.forEach((member) =>
          categories.set(member.category, (categories.get(member.category) || 0) + 1),
        );
        return {
          location,
          count: members.length,
          average: Math.round(members.reduce((sum, member) => sum + member.relationship_score, 0) / members.length),
          category: [...categories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown",
          strongest: [...members].sort((a, b) => b.relationship_score - a.relationship_score)[0],
        };
      })
      .sort((a, b) => b.average * Math.log2(b.count + 1) - a.average * Math.log2(a.count + 1))
      .slice(0, 8);
  }, [contacts]);

  return (
    <section id="radar" className="section-block">
      <SectionHeading
        eyebrow="Relationship radar"
        title="See your network by location."
        copy="Filter contacts by relationship warmth or role, then select any signal for details."
        action={<Badge tone="success"><CircleDot size={11} /> {plotted.length} visible signals</Badge>}
      />
      <div className="radar-layout">
        <article className="panel map-panel">
          <div className="filter-chips">
            {mapFilters.map((item) => (
              <button
                className={filter === item ? "active" : ""}
                key={item}
                onClick={() => onFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="map-canvas">
            <div className="map-label label-americas">AMERICAS</div>
            <div className="map-label label-europe">EUROPE</div>
            <div className="map-label label-asia">ASIA · PACIFIC</div>
            <svg viewBox="0 0 1000 500" role="img" aria-label="Contact relationship map">
              <defs>
                <radialGradient id="ocean" cx="50%" cy="50%" r="75%">
                  <stop offset="0%" stopColor="#17213c" stopOpacity=".8" />
                  <stop offset="100%" stopColor="#080b17" stopOpacity=".2" />
                </radialGradient>
                <filter id="glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              <rect width="1000" height="500" fill="url(#ocean)" rx="24" />
              {Array.from({ length: 12 }).map((_, index) => (
                <line key={`v-${index}`} x1={index * 90} x2={index * 90} y1="0" y2="500" className="map-gridline" />
              ))}
              {Array.from({ length: 7 }).map((_, index) => (
                <line key={`h-${index}`} x1="0" x2="1000" y1={index * 83} y2={index * 83} className="map-gridline" />
              ))}
              <path className="continent" d="M95 89l70-48 91 24 49 66-29 51 18 45-47 52-31 104-44-18-18-102-49-41-38-83z" />
              <path className="continent" d="M294 301l48 20 38 66-29 81-38-13-15-80-30-40z" />
              <path className="continent" d="M482 94l75-48 64 24 43-16 120 43 92 74-33 48-93 20-23 94-57 83-45-21-15-108-66-35-42-61-73-29z" />
              <path className="continent" d="M795 341l74-24 58 48-39 53-83-18z" />
              {plotted.map((contact) => {
                const x = ((Number(contact.lng) + 180) / 360) * 1000;
                const y = ((90 - Number(contact.lat)) / 180) * 500;
                const radius = 4 + contact.relationship_score / 14;
                const color = temperatureColors[contact.relationship_temperature];
                return (
                  <g
                    key={contact.id}
                    className="map-node"
                    onMouseEnter={() => onHover(contact.id)}
                    onMouseLeave={() => onHover(null)}
                    onClick={() => onSelect(contact.id)}
                  >
                    <circle cx={x} cy={y} r={radius + 7} fill={color} opacity=".12" filter="url(#glow)" />
                    <circle cx={x} cy={y} r={radius} fill={color} opacity=".9" />
                    <circle cx={x} cy={y} r={Math.max(2, radius - 4)} fill="#fff" opacity=".8" />
                  </g>
                );
              })}
            </svg>
            {hovered && (
              <div className="map-tooltip">
                <div>
                  <strong>{contactLabel(hovered)}</strong>
                  {hovered.is_dummy === "TRUE" && <Badge tone="demo">Demo</Badge>}
                </div>
                <span>{hovered.company || hovered.category}</span>
                <span><MapPin size={12} /> {hovered.city}, {hovered.country}</span>
                <p>{hovered.recommended_next_action}</p>
                <b>{hovered.relationship_score}/100</b>
              </div>
            )}
            <div className="map-legend">
              {(["Hot", "Warm", "Cooling", "Cold"] as Temperature[]).map((temp) => (
                <span key={temp}><i style={{ background: temperatureColors[temp] }} />{temp}</span>
              ))}
              <span className="unknown-locations">{unknown} unknown locations</span>
            </div>
          </div>
        </article>
        <article className="panel cluster-panel">
          <div className="panel-title">
            <div><span className="icon-box"><MapPin size={17} /></span><div><strong>City clusters</strong><small>Network density + strength</small></div></div>
          </div>
          <div className="cluster-chart">
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={clusters.slice(0, 5)} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                <XAxis dataKey="location" hide />
                <ChartTooltip
                  cursor={{ fill: "rgba(255,255,255,.03)" }}
                  contentStyle={{ background: "#11172a", border: "1px solid #2b3350", borderRadius: 12 }}
                />
                <Bar dataKey="average" fill="#8f7cff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="cluster-list">
            {clusters.map((cluster, index) => (
              <button key={cluster.location} onClick={() => onSelect(cluster.strongest.id)}>
                <span className="cluster-rank">{String(index + 1).padStart(2, "0")}</span>
                <span className="cluster-copy">
                  <strong>{cluster.location}</strong>
                  <small>{cluster.count} contacts · {cluster.category}</small>
                </span>
                <span className="cluster-score">{cluster.average}<small>avg</small></span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function FollowUpSection({
  contacts,
  onUpdate,
  onSelect,
  onEmail,
}: {
  contacts: Contact[];
  onUpdate: (contact: Contact) => void;
  onSelect: (id: string) => void;
  onEmail: (id: string) => void;
}) {
  const prioritized = [...contacts]
    .filter(
      (contact) =>
        contact.next_follow_up_date ||
        contact.priority === "High" ||
        contact.relationship_stage !== "Unqualified",
    )
    .sort((a, b) => followUpUrgency(b) - followUpUrgency(a))
    .slice(0, 8);

  const markFollowedUp = (contact: Contact) => {
    const next = new Date();
    next.setDate(next.getDate() + 14);
    onUpdate({
      ...contact,
      latest_interaction: `Followed up from prototype app on ${TODAY()}`,
      last_contact_date: TODAY(),
      next_follow_up_date: next.toISOString().slice(0, 10),
      relationship_stage: "Awaiting reply",
    });
  };

  return (
    <section id="follow-ups" className="section-block">
      <SectionHeading
        eyebrow="Priority queue"
        title="Who needs a follow-up?"
        copy="The most important relationships appear first, based on timing, strength, and opportunity."
        action={<a className="text-link" href="#directory">View directory <ArrowRight size={15} /></a>}
      />
      <div className="followup-list panel">
        <div className="followup-head">
          <span>Contact</span><span>Signal</span><span>Recommended move</span><span>Actions</span>
        </div>
        {prioritized.map((contact, index) => (
          <div className="followup-row" key={contact.id}>
            <div className="contact-cell" onClick={() => onSelect(contact.id)}>
              <span className="avatar">{(contact.first_name || contact.full_name || "?").slice(0, 1)}</span>
              <div>
                <strong>{contactLabel(contact)}</strong>
                <small>{contact.company || contact.category}</small>
                <div className="micro-badges">
                  {contact.is_dummy === "TRUE" && <Badge tone="demo">Demo</Badge>}
                  <Badge>{contact.category}</Badge>
                </div>
              </div>
            </div>
            <div className="signal-cell">
              <div className="score-ring" style={{ "--score": `${contact.relationship_score * 3.6}deg` } as React.CSSProperties}>
                <span>{contact.relationship_score}</span>
              </div>
              <div>
                <TemperatureBadge value={contact.relationship_temperature} />
                <small className={isDue(contact.next_follow_up_date) ? "due-date overdue" : "due-date"}>
                  {contact.next_follow_up_date ? (isDue(contact.next_follow_up_date) ? "Due " : "Next ") + formatDate(contact.next_follow_up_date) : "No date set"}
                </small>
              </div>
            </div>
            <div className="move-cell">
              <strong>{contact.recommended_next_action}</strong>
              <small><Sparkles size={12} /> {getSuggestedOutreachAngle(contact)}</small>
            </div>
            <div className="row-actions">
              <button className="icon-button" title="Generate email draft" onClick={() => onEmail(contact.id)}><Mail size={16} /></button>
              <button className="button button-secondary" onClick={() => markFollowedUp(contact)}>
                <Check size={15} /> Mark followed up
              </button>
            </div>
            <span className="followup-index">{String(index + 1).padStart(2, "0")}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function OpportunitySection({
  contacts,
  onUpdate,
  onSelect,
}: {
  contacts: Contact[];
  onUpdate: (contact: Contact) => void;
  onSelect: (id: string) => void;
}) {
  const [selectedStage, setSelectedStage] = useState("Follow-up needed");
  const stageContacts = contacts
    .filter((contact) => contact.relationship_stage === selectedStage)
    .sort((a, b) => b.relationship_score - a.relationship_score);

  return (
    <section className="section-block pipeline-workspace">
      <SectionHeading
        eyebrow="Relationship pipeline"
        title="Focus on one stage at a time."
        copy="Choose a stage, review its contacts, and update their status as conversations develop."
      />
      <div className="pipeline-stage-tabs" role="tablist" aria-label="Relationship stages">
        {opportunityStages.map((stage) => {
          const count = contacts.filter((contact) => contact.relationship_stage === stage).length;
          return (
            <button
              role="tab"
              aria-selected={selectedStage === stage}
              className={selectedStage === stage ? "active" : ""}
              key={stage}
              onClick={() => setSelectedStage(stage)}
              title={`Show ${count} contacts in ${stage}`}
            >
              <span className={`stage-dot stage-${stage.toLowerCase().replace(/[^a-z]+/g, "-")}`} />
              <span>{stage}</span>
              <b>{count}</b>
            </button>
          );
        })}
      </div>
      <div className="pipeline-list panel">
        <div className="pipeline-list-head">
          <span>Contact</span><span>Opportunity</span><span>Relationship</span><span>Move to</span>
        </div>
        {stageContacts.map((contact) => (
          <div className="pipeline-list-row" key={contact.id}>
            <button className="pipeline-person" onClick={() => onSelect(contact.id)}>
              <span className="avatar">{(contact.first_name || contact.full_name || "?").slice(0, 1)}</span>
              <span><strong>{contactLabel(contact)}</strong><small>{contact.company || contact.category}</small></span>
            </button>
            <div className="pipeline-opportunity">
              <strong>{contact.opportunity_summary || "Relationship to develop"}</strong>
              {(contact.introduced_by || contact.connected_to) && (
                <small><Users size={12} /> {contact.introduced_by ? `Introduced by ${contact.introduced_by}` : contact.connected_to}</small>
              )}
            </div>
            <div className="pipeline-signal">
              <TemperatureBadge value={contact.relationship_temperature} />
              <span>{contact.relationship_score}/100</span>
              {contact.is_dummy === "TRUE" && <Badge tone="demo">Demo</Badge>}
            </div>
            <select
              value={contact.relationship_stage}
              aria-label={`Change stage for ${contactLabel(contact)}`}
              onChange={(event) => onUpdate({ ...contact, relationship_stage: event.target.value })}
            >
              {opportunityStages.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
        ))}
        {!stageContacts.length && <div className="overview-empty"><Check size={18} /> No contacts are in this stage.</div>}
      </div>
    </section>
  );
}

function DirectorySection({
  contacts,
  search,
  onSearch,
  categoryFilter,
  onCategoryFilter,
  temperatureFilter,
  onTemperatureFilter,
  priorityFilter,
  onPriorityFilter,
  sourceFilter,
  onSourceFilter,
  onSelect,
}: {
  contacts: Contact[];
  search: string;
  onSearch: (value: string) => void;
  categoryFilter: string;
  onCategoryFilter: (value: string) => void;
  temperatureFilter: string;
  onTemperatureFilter: (value: string) => void;
  priorityFilter: string;
  onPriorityFilter: (value: string) => void;
  sourceFilter: string;
  onSourceFilter: (value: string) => void;
  onSelect: (id: string) => void;
}) {
  const categories = [...new Set(contacts.map((contact) => contact.category))].sort();
  const query = search.toLowerCase();
  const filtered = contacts
    .filter((contact) =>
      [contact.full_name, contact.company, contact.city, contact.email, contact.notes]
        .join(" ")
        .toLowerCase()
        .includes(query),
    )
    .filter((contact) => categoryFilter === "All" || contact.category === categoryFilter)
    .filter((contact) => temperatureFilter === "All" || contact.relationship_temperature === temperatureFilter)
    .filter((contact) => priorityFilter === "All" || contact.priority === priorityFilter)
    .filter(
      (contact) =>
        sourceFilter === "All" ||
        (sourceFilter === "Demo" ? contact.is_dummy === "TRUE" : contact.is_dummy === "FALSE"),
    )
    .sort((a, b) => b.relationship_score - a.relationship_score);

  return (
    <section id="directory" className="section-block">
      <SectionHeading
        eyebrow="Contact directory"
        title="Find and update a contact."
        copy="Search the network, narrow the results, and open a card to view the full record."
        action={<Badge>{filtered.length} results</Badge>}
      />
      <div className="directory-toolbar panel">
        <label className="search-box">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search name, company, city, email or notes…"
          />
        </label>
        <div className="directory-filters">
          <Filter size={15} />
          <select value={categoryFilter} onChange={(event) => onCategoryFilter(event.target.value)}>
            <option>All</option>{categories.map((category) => <option key={category}>{category}</option>)}
          </select>
          <select value={temperatureFilter} onChange={(event) => onTemperatureFilter(event.target.value)}>
            <option>All</option><option>Hot</option><option>Warm</option><option>Cooling</option><option>Cold</option>
          </select>
          <select value={priorityFilter} onChange={(event) => onPriorityFilter(event.target.value)}>
            <option>All</option><option>High</option><option>Medium</option><option>Low</option>
          </select>
          <select value={sourceFilter} onChange={(event) => onSourceFilter(event.target.value)}>
            <option>All</option><option>Real</option><option>Demo</option>
          </select>
        </div>
      </div>
      <div className="directory-grid">
        {filtered.map((contact) => (
          <button className="contact-card" key={contact.id} onClick={() => onSelect(contact.id)}>
            <div className="contact-card-top">
              <span className="avatar large">{(contact.first_name || contact.full_name || "?").slice(0, 1)}</span>
              <div>
                <strong>{contactLabel(contact)}</strong>
                <span>{contact.position || contact.category}</span>
                <small>{contact.company || "Independent"}</small>
              </div>
              <span className="card-score">{contact.relationship_score}</span>
            </div>
            <div className="contact-card-location"><MapPin size={13} /> {contact.city || "Unknown"}, {contact.country || "Unknown"}</div>
            <p>{contact.ai_summary || contact.opportunity_summary || "Relationship to qualify."}</p>
            <div className="contact-card-badges">
              <TemperatureBadge value={contact.relationship_temperature} />
              <Badge>{contact.priority}</Badge>
              {contact.is_dummy === "TRUE" && <Badge tone="demo">Demo</Badge>}
            </div>
            <span className="open-contact">Open profile <ArrowRight size={14} /></span>
          </button>
        ))}
      </div>
      {!filtered.length && <div className="empty-state"><Search /><strong>No contacts found</strong><span>Try widening the filters or changing the search.</span></div>}
    </section>
  );
}

function AskNetwork({ contacts, onSelect }: { contacts: Contact[]; onSelect: (id: string) => void }) {
  const examples = [
    "Who should I contact for Berlin?",
    "Which labels should I prioritise?",
    "Who asked for materials?",
    "Build me a September Europe outreach plan.",
  ];
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"local" | "ai">("local");

  const ask = async (question = query) => {
    if (!question.trim()) return;
    setQuery(question);
    setLoading(true);
    setAnswer("");
    try {
      const response = await fetch("/api/ask-network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question, contacts }),
      });
      const data = await response.json();
      if (response.ok && data.available && data.answer) {
        setMode("ai");
        setAnswer(data.answer);
      } else {
        setMode("local");
        setAnswer(answerNetworkQuestion(question, contacts));
      }
    } catch {
      setMode("local");
      setAnswer(answerNetworkQuestion(question, contacts));
    } finally {
      setLoading(false);
    }
  };

  const related = answer
    ? contacts
        .filter(
          (contact) =>
            contact.full_name.trim() &&
            answer.toLowerCase().includes(contact.full_name.toLowerCase()),
        )
        .slice(0, 5)
    : [];

  return (
    <section id="ask" className="ask-section section-block">
      <div className="ask-glow" />
      <SectionHeading
        eyebrow="Ask your network"
        title={`Turn ${contacts.length} contacts into one useful answer.`}
        copy="Ask naturally. The answer is grounded in your saved contact information."
        action={<Badge tone={mode === "ai" ? "success" : "neutral"}><Bot size={12} /> {mode === "ai" ? "OpenAI" : "Local intelligence"}</Badge>}
      />
      <div className="ask-layout">
        <div className="ask-console panel">
          <div className="chat-message assistant-message">
            <span className="chat-avatar"><Music2 size={18} /></span>
            <div>
              <strong>Network Navigator</strong>
              <p>Ask me about a city, territory, category, opportunity stage, or who deserves the next email.</p>
            </div>
          </div>
          {answer && (
            <div className="chat-message answer-message">
              <span className="chat-avatar"><Sparkles size={18} /></span>
              <div><strong>{mode === "ai" ? "AI answer" : "Network answer"}</strong><p className="answer-copy">{answer.replace(/\*\*/g, "")}</p></div>
            </div>
          )}
          {loading && <div className="thinking"><span /><span /><span /> Reading the room</div>}
          <div className="ask-input">
            <MessageSquareText size={19} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && ask()}
              placeholder="Ask: who can help with a Germany run?"
            />
            <button onClick={() => ask()} disabled={loading || !query.trim()}><Send size={17} /></button>
          </div>
        </div>
        <div className="ask-sidebar">
          <span className="sidebar-label">Try asking</span>
          {examples.map((example) => (
            <button key={example} onClick={() => ask(example)}>
              <Sparkles size={14} /><span>{example}</span><ChevronRight size={14} />
            </button>
          ))}
          {related.length > 0 && (
            <div className="answer-contacts">
              <span className="sidebar-label">Contacts in answer</span>
              {related.map((contact) => (
                <button key={contact.id} onClick={() => onSelect(contact.id)}>
                  <span className="avatar tiny">{contact.first_name.slice(0, 1)}</span>
                  <span>{contactLabel(contact)}</span>
                  <strong>{contact.relationship_score}</strong>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AutomationBlueprint() {
  const automations = [
    {
      number: "01",
      title: "New Contact Enrichment",
      trigger: "New Airtable row",
      action: "Categorise, locate, score and recommend the next action.",
      icon: WandSparkles,
      color: "violet",
    },
    {
      number: "02",
      title: "Weekly Relationship Digest",
      trigger: "Every Monday",
      action: "Send hot leads and stale relationships to email or Slack.",
      icon: Radio,
      color: "cyan",
    },
    {
      number: "03",
      title: "Follow-Up Reminder",
      trigger: "Follow-up date due",
      action: "Generate a draft email and notify the relationship owner.",
      icon: CalendarClock,
      color: "amber",
    },
    {
      number: "04",
      title: "Post-Meeting Note Parser",
      trigger: "New note added",
      action: "Extract tasks, opportunities, promises and the next date.",
      icon: MessageSquareText,
      color: "pink",
    },
  ];

  return (
    <section className="section-block automation-section">
      <SectionHeading
        eyebrow="Automation blueprint"
        title="From good intentions to a working rhythm."
        copy="A practical Make.com layer for keeping relationship data alive."
        action={<a className="button button-ghost" href="https://www.make.com/" target="_blank" rel="noreferrer">Make.com <ExternalLink size={14} /></a>}
      />
      <div className="automation-grid">
        {automations.map(({ number, title, trigger, action, icon: Icon, color }) => (
          <article className="automation-card" key={title}>
            <span className="automation-number">{number}</span>
            <span className={`automation-icon automation-${color}`}><Icon size={21} /></span>
            <h3>{title}</h3>
            <div className="flow-line">
              <span><small>TRIGGER</small>{trigger}</span>
              <ArrowRight size={16} />
              <span><small>ACTION</small>{action}</span>
            </div>
            <div className="automation-status"><Zap size={13} /> Blueprint ready</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ContactDrawer({
  contact,
  onClose,
  onUpdate,
  onEmail,
  projects,
  onProjectsChange,
  activities,
  onAddActivity,
  onRemoveActivity,
}: {
  contact: Contact;
  onClose: () => void;
  onUpdate: (contact: Contact) => void;
  onEmail: () => void;
  projects: WorkProject[];
  onProjectsChange: React.Dispatch<React.SetStateAction<WorkProject[]>>;
  activities: ContactActivity[];
  onAddActivity: (
    contactId: string,
    kind: ContactActivityKind,
    title: string,
    detail: string,
  ) => void;
  onRemoveActivity: (activityId: string) => void;
}) {
  const [draft, setDraft] = useState(contact);
  const [drawerTab, setDrawerTab] = useState<"profile" | "activity">("profile");
  const [activityNote, setActivityNote] = useState("");
  const [noteSuggestion, setNoteSuggestion] = useState<RelationshipNoteSuggestion | null>(null);
  const linkedProjectId =
    projects.find((project) => project.contactIds.includes(contact.id))?.id || "";

  useEffect(() => {
    setDraft(contact);
    setDrawerTab("profile");
    setActivityNote("");
    setNoteSuggestion(null);
  }, [contact]);

  const save = () => {
    const names = draft.full_name.trim().split(/\s+/);
    const updated = {
      ...draft,
      first_name: draft.first_name || names[0] || "",
      last_name: draft.last_name || names.slice(1).join(" "),
    };
    onUpdate(updated);
    onClose();
  };

  const enrich = () => {
    const enriched = simulateMakeEnrichment(draft);
    setDraft(enriched);
    onUpdate(enriched);
  };

  const linkContact = (projectId: string) => {
    const previousProject = projects.find((project) => project.id === linkedProjectId);
    const nextProject = projects.find((project) => project.id === projectId);
    onProjectsChange((current) =>
      current.map((project) => ({
        ...project,
        contactIds:
          project.id === projectId
            ? [...new Set([...project.contactIds, contact.id])]
            : project.contactIds.filter((id) => id !== contact.id),
      })),
    );
    if (projectId && nextProject?.id !== previousProject?.id) {
      onAddActivity(
        contact.id,
        "project",
        "Linked to project",
        `${contactLabel(contact)} was linked to ${nextProject?.name}.`,
      );
    } else if (!projectId && previousProject) {
      onAddActivity(
        contact.id,
        "project",
        "Removed from project",
        `${contactLabel(contact)} was removed from ${previousProject.name}.`,
      );
    }
  };

  const addNote = () => {
    if (!activityNote.trim()) return;
    const note = activityNote.trim();
    onAddActivity(contact.id, "note", "Note added", note);
    setNoteSuggestion(suggestRelationshipNextStep(note, draft));
    setActivityNote("");
  };

  const applyNoteSuggestion = () => {
    if (!noteSuggestion) return;
    setDraft({
      ...draft,
      relationship_stage: noteSuggestion.stage,
      next_follow_up_date: noteSuggestion.followUpDate,
      recommended_next_action: noteSuggestion.nextAction,
    });
    setDrawerTab("profile");
  };

  const latestInteraction = contact.latest_interaction.trim();
  const latestAlreadyRecorded = activities.some((activity) =>
    activity.detail.includes(latestInteraction),
  );
  const legacyActivity: ContactActivity | null = latestInteraction && !latestAlreadyRecorded
    ? {
        id: `LEGACY-${contact.id}`,
        contactId: contact.id,
        kind: "relationship",
        title: "Latest known interaction",
        detail: latestInteraction,
        createdAt: contact.last_contact_date
          ? new Date(`${contact.last_contact_date}T12:00:00`).toISOString()
          : "",
      }
    : null;
  const activityItems = [...activities, ...(legacyActivity ? [legacyActivity] : [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <div className="modal-layer" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <span className="eyebrow">Contact intelligence</span>
            <h2>{contactLabel(contact)}</h2>
            <div className="contact-card-badges">
              <TemperatureBadge value={draft.relationship_temperature} />
              {draft.is_dummy === "TRUE" && <Badge tone="demo">Demo contact</Badge>}
            </div>
          </div>
          <button className="icon-button" onClick={onClose}><X size={19} /></button>
        </div>
        <div className="drawer-score">
          <div className="score-ring large-ring" style={{ "--score": `${draft.relationship_score * 3.6}deg` } as React.CSSProperties}>
            <span>{draft.relationship_score}</span>
          </div>
          <div><strong>Relationship score</strong><span>{draft.priority} priority · {draft.relationship_stage}</span></div>
        </div>
        <div className="drawer-actions">
          <button className="button button-primary" onClick={onEmail}><Mail size={15} /> Generate email</button>
          <button className="button button-secondary" onClick={enrich}><WandSparkles size={15} /> Simulate Make enrichment</button>
        </div>
        {projects.length > 0 && (
          <label className={`drawer-project-link${linkedProjectId ? " linked" : ""}`}>
            <span><FolderKanban size={15} /><strong>Project</strong></span>
            <select value={linkedProjectId} onChange={(event) => linkContact(event.target.value)} aria-label={`Project for ${contactLabel(contact)}`}>
              <option value="">Not linked to a project</option>
              {projects
                .filter((project) => project.status !== "Complete")
                .map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}
            </select>
          </label>
        )}
        <div className="drawer-tabs" role="tablist" aria-label="Contact details">
          <button className={drawerTab === "profile" ? "active" : ""} onClick={() => setDrawerTab("profile")}>
            <Users size={14} /> Profile
          </button>
          <button className={drawerTab === "activity" ? "active" : ""} onClick={() => setDrawerTab("activity")}>
            <Activity size={14} /> Activity {activityItems.length > 0 && <b>{activityItems.length}</b>}
          </button>
        </div>
        {drawerTab === "profile" ? (
          <div className="drawer-body">
            <div className="insight-card">
              <span><Sparkles size={14} /> AI summary</span>
              <p>{draft.ai_summary || "No summary yet. Run enrichment to create one."}</p>
            </div>
            <div className="form-grid two-col">
              <Field label="Full name" value={draft.full_name} onChange={(value) => setDraft({ ...draft, full_name: value })} />
              <Field label="Company" value={draft.company} onChange={(value) => setDraft({ ...draft, company: value })} />
              <Field label="Position" value={draft.position} onChange={(value) => setDraft({ ...draft, position: value })} />
              <Field label="Email" value={draft.email} type="email" onChange={(value) => setDraft({ ...draft, email: value })} />
              <Field label="City" value={draft.city} onChange={(value) => setDraft({ ...draft, city: value })} />
              <Field label="Country" value={draft.country} onChange={(value) => setDraft({ ...draft, country: value })} />
              <SelectField label="Category" value={draft.category} options={["Booking Agent", "Promoter/Programmer", "Venue", "Journalist / Media", "Record Label", "Publisher", "Other", "Unknown"]} onChange={(value) => setDraft({ ...draft, category: value })} />
              <SelectField label="Stage" value={draft.relationship_stage} options={opportunityStages} onChange={(value) => setDraft({ ...draft, relationship_stage: value })} />
              <SelectField label="Temperature" value={draft.relationship_temperature} options={["Hot", "Warm", "Cooling", "Cold"]} onChange={(value) => setDraft({ ...draft, relationship_temperature: value as Temperature })} />
              <SelectField label="Priority" value={draft.priority} options={["High", "Medium", "Low"]} onChange={(value) => setDraft({ ...draft, priority: value as Priority })} />
              <Field label="Relationship score" value={String(draft.relationship_score)} type="number" onChange={(value) => setDraft({ ...draft, relationship_score: Math.min(100, Math.max(0, Number(value))) })} />
              <Field label="Next follow-up" value={draft.next_follow_up_date} type="date" onChange={(value) => setDraft({ ...draft, next_follow_up_date: value })} />
            </div>
            <Field label="Opportunity summary" value={draft.opportunity_summary} onChange={(value) => setDraft({ ...draft, opportunity_summary: value })} />
            <TextArea label="Recommended next action" value={draft.recommended_next_action} onChange={(value) => setDraft({ ...draft, recommended_next_action: value })} />
            <TextArea label="Original notes" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: value })} />
            <TextArea label="Latest interaction" value={draft.latest_interaction} onChange={(value) => setDraft({ ...draft, latest_interaction: value })} />
            <div className="form-grid two-col">
              <Field label="Introduced by" value={draft.introduced_by} onChange={(value) => setDraft({ ...draft, introduced_by: value })} />
              <Field label="Connected to" value={draft.connected_to} onChange={(value) => setDraft({ ...draft, connected_to: value })} />
            </div>
            <Field label="Tags" value={draft.tags} onChange={(value) => setDraft({ ...draft, tags: value })} />
          </div>
        ) : (
          <div className="drawer-body activity-body">
            <section className="activity-composer">
              <div>
                <span className="eyebrow">Relationship note</span>
                <strong>Record what matters next.</strong>
                <small>Notes stay in this browser and are never treated as sent messages.</small>
              </div>
              <textarea
                value={activityNote}
                onChange={(event) => setActivityNote(event.target.value)}
                placeholder="e.g. Asked for the new live video and September availability."
                rows={3}
                aria-label="New relationship note"
              />
              <button className="button button-secondary" onClick={addNote} disabled={!activityNote.trim()}>
                <Sparkles size={14} /> Add note and suggest next step
              </button>
            </section>
            {noteSuggestion && (
              <section className="activity-suggestion">
                <div className="activity-suggestion-head">
                  <span><Sparkles size={14} /> Suggested update</span>
                  <Badge tone="neutral">Not applied</Badge>
                </div>
                <strong>{noteSuggestion.nextAction}</strong>
                <p>{noteSuggestion.reason}</p>
                <div className="activity-suggestion-meta">
                  <span><small>Stage</small>{noteSuggestion.stage}</span>
                  <span><small>Follow up</small>{formatDate(noteSuggestion.followUpDate)}</span>
                </div>
                <button className="button button-primary" onClick={applyNoteSuggestion}>
                  Review in profile <ArrowRight size={14} />
                </button>
                <small>Nothing changes until you review the profile and select Save changes.</small>
              </section>
            )}
            <section className="activity-timeline">
              <div className="activity-heading">
                <div><span className="eyebrow">History</span><strong>What has happened</strong></div>
                <small>{activityItems.length} recorded {activityItems.length === 1 ? "event" : "events"}</small>
              </div>
              {activityItems.map((item) => (
                <article className={`activity-item activity-${item.kind}`} key={item.id}>
                  <span className="activity-marker">
                    {item.kind === "follow-up" ? <CalendarClock size={14} /> :
                      item.kind === "project" ? <FolderKanban size={14} /> :
                      item.kind === "note" ? <MessageSquareText size={14} /> :
                      item.kind === "enrichment" ? <WandSparkles size={14} /> :
                      <Activity size={14} />}
                  </span>
                  <div>
                    <div className="activity-item-title">
                      <strong>{item.title}</strong>
                      {item.kind === "note" && (
                        <button
                          className="activity-remove"
                          onClick={() => onRemoveActivity(item.id)}
                          aria-label={`Remove note: ${item.detail}`}
                          title="Remove note"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <p>{item.detail}</p>
                    <small>{formatActivityDate(item.createdAt)}</small>
                  </div>
                </article>
              ))}
              {!activityItems.length && (
                <div className="activity-empty">
                  <Activity size={20} />
                  <strong>No recorded activity yet.</strong>
                  <p>Add a note or update this relationship to start a clear history.</p>
                </div>
              )}
            </section>
          </div>
        )}
        <div className="drawer-footer">
          <button className="button button-ghost" onClick={onClose}>Cancel</button>
          <button className="button button-primary" onClick={save}><Check size={15} /> Save changes</button>
        </div>
      </aside>
    </div>
  );
}

function AddContactModal({ onClose, onAdd }: { onClose: () => void; onAdd: (contact: Contact) => void }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("Booking Agent");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (![name, company, email, notes].some((value) => value.trim())) {
      setError("Add at least a name, company, email, or note.");
      return;
    }
    const parts = name.trim().split(/\s+/);
    const base: Contact = {
      id: `LOCAL-${Date.now()}`,
      source_type: "added_in_prototype",
      is_dummy: "FALSE",
      full_name: name.trim(),
      first_name: parts[0] || "",
      last_name: parts.slice(1).join(" "),
      position: "",
      email: email.trim(),
      company: company.trim(),
      city: city.trim() || "Unknown",
      country: country.trim() || "Unknown",
      lat: "",
      lng: "",
      category,
      address: "",
      notes: notes.trim(),
      latest_interaction: `Added in Jazz Network Navigator on ${TODAY()}`,
      relationship_stage: "Unqualified",
      relationship_score: 25,
      priority: "Medium",
      relationship_temperature: "Cold",
      opportunity_summary: "New relationship to qualify",
      recommended_next_action: "Research the contact and choose a specific first outreach angle.",
      last_contact_date: "",
      next_follow_up_date: "",
      tags: "",
      introduced_by: "",
      connected_to: "",
      make_automation_status: "needs_review",
      ai_summary: "",
    };
    onAdd(simulateMakeEnrichment(base));
  };

  return (
    <div className="modal-layer" onMouseDown={onClose}>
      <div className="modal-card compact-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><span className="eyebrow">Grow the network</span><h2>Add contact</h2></div>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="form-grid two-col">
          <Field label="Full name" value={name} onChange={setName} />
          <Field label="Company" value={company} onChange={setCompany} />
          <Field label="Email" value={email} type="email" onChange={setEmail} />
          <SelectField label="Category" value={category} options={["Booking Agent", "Promoter/Programmer", "Venue", "Journalist / Media", "Record Label", "Publisher", "Other", "Unknown"]} onChange={setCategory} />
          <Field label="City" value={city} onChange={setCity} />
          <Field label="Country" value={country} onChange={setCountry} />
        </div>
        <TextArea label="Notes" value={notes} onChange={setNotes} />
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button className="button button-ghost" onClick={onClose}>Cancel</button>
          <button className="button button-primary" onClick={submit}><Plus size={15} /> Add contact</button>
        </div>
      </div>
    </div>
  );
}

function EmailDraftModal({
  contact,
  profile,
  onClose,
}: {
  contact: Contact;
  profile: ArtistProfile;
  onClose: () => void;
}) {
  const [intent, setIntent] = useState<EmailIntent>("Follow up after meeting");
  const [draft, setDraft] = useState<EmailDraft>(() => generateLocalEmailDraft(contact, intent, profile));
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"local" | "ai">("local");
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, intent, profile }),
      });
      const data = await response.json();
      if (response.ok && data.available && data.draft) {
        setDraft(data.draft);
        setSource("ai");
      } else {
        setDraft(generateLocalEmailDraft(contact, intent, profile));
        setSource("local");
      }
    } catch {
      setDraft(generateLocalEmailDraft(contact, intent, profile));
      setSource("local");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDraft(generateLocalEmailDraft(contact, intent, profile));
    setSource("local");
  }, [contact, intent, profile]);

  const copyDraft = async () => {
    await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="modal-layer" onMouseDown={onClose}>
      <div className="modal-card email-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">Email draft generator</span>
            <h2>Write to {contact.first_name || contactLabel(contact)}</h2>
            <p>{contact.company || contact.category}</p>
          </div>
          <button className="icon-button" onClick={onClose}><X size={18} /></button>
        </div>
        <label className="field">
          <span>Outreach intent</span>
          <select value={intent} onChange={(event) => setIntent(event.target.value as EmailIntent)}>
            {emailIntents.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <div className="draft-paper">
          <div className="draft-meta">
            <Badge tone={source === "ai" ? "success" : "neutral"}><Sparkles size={11} /> {source === "ai" ? "AI drafted" : "Smart template"}</Badge>
            <span>Not sent · review before use</span>
          </div>
          <label><span>Subject</span><input value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} /></label>
          <label><span>Body</span><textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} rows={14} /></label>
        </div>
        <div className="modal-actions spread">
          <button className="button button-secondary" onClick={generate} disabled={loading}>
            <WandSparkles size={15} /> {loading ? "Generating…" : "Generate fresh draft"}
          </button>
          <button className="button button-primary" onClick={copyDraft}>
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea rows={4} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

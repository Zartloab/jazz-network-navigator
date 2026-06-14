"use client";

import {
  Activity,
  ArrowRight,
  Bell,
  Bot,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDot,
  Copy,
  Download,
  ExternalLink,
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
} from "@/lib/local-ai";
import {
  buildAppNotifications,
  buildLocalOpportunityScan,
} from "@/lib/opportunity-scout";
import {
  AppNotification,
  AppView,
  ArtistProfile,
  Contact,
  EmailDraft,
  EmailIntent,
  Priority,
  ResearchOpportunity,
  TodayTask,
  Temperature,
} from "@/lib/types";
import TourBuilder from "@/components/TourBuilder";
import OpportunityScout from "@/components/OpportunityScout";
import ArtistProfileEditor from "@/components/ArtistProfileEditor";
import CreativeStudio from "@/components/CreativeStudio";
import WorkHub from "@/components/WorkHub";
import { emptyArtistProfile } from "@/lib/creative-studio";
import { buildTodayTasks } from "@/lib/today";
import {
  buildDataHealthSummary,
  DataHealthMetric,
} from "@/lib/data-health";

const STORAGE_KEY = "jazz-network-navigator-contacts-v1";
const OPPORTUNITY_STORAGE_KEY = "jazz-network-navigator-opportunities-v1";
const NOTIFICATION_READ_KEY = "jazz-network-navigator-notifications-read-v1";
const ARTIST_PROFILE_KEY = "jazz-network-navigator-artist-profile-v1";
const TODAY_COMPLETED_KEY = "jazz-network-navigator-today-completed-v1";
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
    description: "A simple view of what needs your attention today.",
    help: "Start here. Choose one recommended action, or use the shortcuts to plan a tour, follow up, find a contact, or ask AI.",
  },
  work: {
    title: "Projects",
    description: "Plan and track tours, releases, campaigns, and collaborations.",
    help: "Create a project to keep its goal, dates, related work, deadlines, and outcomes in one place.",
  },
  relationships: {
    title: "Relationships",
    description: "Follow up, move conversations forward, and find anyone in your network.",
    help: "Use the tabs to work through follow-ups, update the relationship pipeline, or search all contacts.",
  },
  discover: {
    title: "Opportunities",
    description: "Research openings and find the strongest route through your network.",
    help: "Scout for opportunities first, then use the network map or Ask AI when you need a different view.",
  },
  tour: {
    title: "Tour Builder",
    description: "Turn a tour idea into contacts, drafts, and a follow-up plan.",
    help: "Enter the places and goal for your tour, then review the suggested contacts. Nothing is sent automatically.",
  },
  research: {
    title: "Opportunity Scout",
    description: "Find warm routes and current openings worth acting on.",
    help: "Start with a simple brief. Scout checks your saved network first and uses clearly linked web sources when live research is available.",
  },
  studio: {
    title: "Creative Studio",
    description: "Create useful pitches, story angles, and campaign material.",
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
    title: "Network Map",
    description: "Understand where your strongest relationships are located.",
    help: "Use the filters above the map to focus on relationship warmth or contact type, then select a point for details.",
  },
  ask: {
    title: "Ask AI",
    description: "Ask a plain-language question about your existing contacts.",
    help: "Ask one specific question, such as who to contact in a city or which relationships deserve attention this week.",
  },
  settings: {
    title: "Settings",
    description: "Check data quality, create backups, and prepare future automations.",
    help: "Your contact edits stay in this browser. Export a backup before resetting local data.",
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
    setResearchHydrated(true);
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
    if (!researchHydrated || !contacts.length || opportunities.length) return;
    setOpportunities(
      buildLocalOpportunityScan(
        {
          locations: "",
          genres: "Jazz, improvised music",
          goals: "Paid shows, festivals, press, funding",
          notes: "",
        },
        contacts,
      ),
    );
  }, [contacts, opportunities.length, researchHydrated]);

  const selectedContact = contacts.find((contact) => contact.id === selectedId) || null;
  const emailContact = contacts.find((contact) => contact.id === emailContactId) || null;
  const notifications = useMemo(
    () => buildAppNotifications(contacts, opportunities, readNotificationIds),
    [contacts, opportunities, readNotificationIds],
  );

  const updateContact = (updated: Contact) => {
    setContacts((current) => current.map((contact) => (contact.id === updated.id ? updated : contact)));
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
      "jazz-network-navigator-projects-v1",
    ].forEach((key) => window.localStorage.removeItem(key));
    setContacts([]);
    setOpportunities([]);
    setReadNotificationIds([]);
    setArtistProfile(emptyArtistProfile);
    setCompletedTodayIds([]);
    setSelectedId(null);
    setLocked(true);
  };

  const exportJson = () =>
    downloadFile("jazz-network-contacts.json", JSON.stringify(contacts, null, 2), "application/json");
  const exportCsv = () =>
    downloadFile("jazz-network-contacts.csv", contactsToCsv(contacts), "text/csv;charset=utf-8");
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
            {activeView === "work" && (
              <WorkHub
                contacts={contacts}
                opportunities={opportunities}
                profile={artistProfile}
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
            {activeView === "discover" && (
              <DiscoverWorkspace
                contacts={contacts}
                profile={artistProfile}
                opportunities={opportunities}
                onOpportunityChange={setOpportunities}
                onSelect={setSelectedId}
                mapFilter={mapFilter}
                onMapFilter={setMapFilter}
                mapHoverId={mapHoverId}
                onMapHover={setMapHoverId}
              />
            )}
            {activeView === "radar" && (
              <>
                <PageGuide text="Filter the map, then select any signal to open that contact’s full record." />
                <RelationshipSection
                  contacts={contacts}
                  filter={mapFilter}
                  onFilter={setMapFilter}
                  hoverId={mapHoverId}
                  onHover={setMapHoverId}
                  onSelect={setSelectedId}
                />
              </>
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
              />
            )}
            {activeView === "studio" && (
              <StudioWorkspace
                profile={artistProfile}
                onProfileChange={setArtistProfile}
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
                onSelectContact={setSelectedId}
                onReset={resetData}
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
        />
      )}
      {showAdd && (
        <AddContactModal
          onClose={() => setShowAdd(false)}
          onAdd={(contact) => {
            setContacts((current) => [contact, ...current]);
            setShowAdd(false);
            setSelectedId(contact.id);
          }}
        />
      )}
      {emailContact && (
        <EmailDraftModal contact={emailContact} profile={artistProfile} onClose={() => setEmailContactId(null)} />
      )}
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
    { view: "home" as AppView, label: "Today", icon: Home, hint: "What needs attention" },
    { view: "work" as AppView, label: "Projects", icon: FolderKanban, hint: "Tours, releases, campaigns" },
    { view: "relationships" as AppView, label: "Relationships", icon: Users, hint: "Follow-ups and contacts" },
    { view: "discover" as AppView, label: "Opportunities", icon: ScanSearch, hint: "Research and network insight" },
    { view: "studio" as AppView, label: "Studio", icon: WandSparkles, hint: "Pitches and creative work" },
  ];
  const activeGroup: AppView =
    activeView === "tour"
      ? "work"
      : ["follow-ups", "directory", "pipeline"].includes(activeView)
        ? "relationships"
        : ["research", "radar", "ask"].includes(activeView)
          ? "discover"
          : activeView;

  const renderItem = ({ view, label, icon: Icon, hint }: (typeof primary)[number]) => {
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
      <span><strong>{label}</strong><small>{hint}</small></span>
    </button>
    );
  };

  return (
    <aside className={`app-sidebar${open ? "" : " collapsed"}${mobileOpen ? " mobile-open" : ""}`}>
      <div className="sidebar-brand">
        <span className="brand-mark"><Music2 size={20} /></span>
        <span className="sidebar-brand-copy">Jazz Network<strong>Navigator</strong></span>
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
          data-tooltip="Settings, exports, and automation readiness"
        >
          <Settings size={19} />
          <span><strong>Settings</strong><small>Data, backups, automation</small></span>
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
  onAdd,
  notifications,
  onMarkAllRead,
  onOpenNotification,
}: {
  view: AppView;
  onOpenMobile: () => void;
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
                Open Opportunity Scout <ArrowRight size={13} />
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
          <span className="eyebrow">Research workspace</span>
          <h2>Find openings with a reason to act.</h2>
          <p>Search for opportunities, understand where your network is strongest, or ask a focused question.</p>
        </div>
        <div className="grouped-summary">
          <span><strong>{saved}</strong><small>saved</small></span>
          <span><strong>{opportunities.filter((item) => item.sourceType === "web").length}</strong><small>live sources</small></span>
        </div>
      </div>
      <div className="hub-tabs" role="tablist" aria-label="Opportunity tools">
        <button className={tab === "scout" ? "active" : ""} onClick={() => setTab("scout")}>
          <ScanSearch size={15} /> Scout {saved > 0 && <b>{saved}</b>}
        </button>
        <button className={tab === "map" ? "active" : ""} onClick={() => setTab("map")}>
          <MapIcon size={15} /> Network map
        </button>
        <button className={tab === "ask" ? "active" : ""} onClick={() => setTab("ask")}>
          <Bot size={15} /> Ask AI
        </button>
      </div>
      {tab === "scout" && (
        <OpportunityScout
          contacts={contacts}
          profile={profile}
          opportunities={opportunities}
          onChange={onOpportunityChange}
          onSelectContact={onSelect}
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
}: {
  profile: ArtistProfile;
  onProfileChange: (profile: ArtistProfile) => void;
}) {
  const [tab, setTab] = useState<"create" | "profile">("create");
  return (
    <section className="grouped-workspace">
      <div className="hub-tabs" role="tablist" aria-label="Creative Studio">
        <button className={tab === "create" ? "active" : ""} onClick={() => setTab("create")}>
          <WandSparkles size={15} /> Create
        </button>
        <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>
          <Music2 size={15} /> Artist profile
        </button>
      </div>
      {tab === "create" ? (
        <CreativeStudio profile={profile} onOpenProfile={() => setTab("profile")} />
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
  profile: ArtistProfile;
  completedTodayIds: string[];
  onCompleteToday: (id: string) => void;
  onResetToday: () => void;
  onNavigate: (view: AppView) => void;
  onSelect: (id: string) => void;
  onEmail: (id: string) => void;
  onAdd: () => void;
}) {
  const due = contacts
    .filter((contact) => isDue(contact.next_follow_up_date))
    .sort((a, b) => followUpUrgency(b) - followUpUrgency(a));
  const hot = contacts.filter((contact) => contact.relationship_temperature === "Hot").length;
  const active = contacts.filter((contact) => contact.relationship_stage !== "Unqualified").length;
  const cityCount = new Set(
    contacts.filter((contact) => contact.city && contact.city !== "Unknown").map((contact) => `${contact.city}|${contact.country}`),
  ).size;
  const todayTasks = buildTodayTasks(
    contacts,
    opportunities,
    profile,
    completedTodayIds,
  );
  const urgentToday = todayTasks.filter((task) => task.priority === "High").length;

  const quickActions = [
    { title: "Open projects", copy: "Run a tour, release, campaign, or collaboration.", icon: FolderKanban, view: "work" as AppView },
    { title: "Find opportunities", copy: "Research openings and warm routes.", icon: ScanSearch, view: "discover" as AppView },
    { title: "Manage relationships", copy: `${due.length} follow-ups currently need attention.`, icon: Users, view: "relationships" as AppView },
    { title: "Create a pitch", copy: "Build booking, press, and campaign material.", icon: WandSparkles, view: "studio" as AppView },
  ];

  return (
    <section className="dashboard-overview">
      <div className="dashboard-welcome">
        <div>
          <span className="eyebrow">Today’s workspace</span>
          <h2>Here’s what needs attention.</h2>
          <p>Choose one task below. You do not need to work through the whole app.</p>
        </div>
        <button className="button button-secondary" onClick={onAdd}><Plus size={15} /> Add someone new</button>
      </div>

      <div className="overview-stats">
        <article><span className="overview-stat-icon due"><CalendarClock size={18} /></span><div><strong>{due.length}</strong><small>Follow-ups due</small></div><HelpTip text="Contacts whose next follow-up date is today or earlier." /></article>
        <article><span className="overview-stat-icon hot"><Flame size={18} /></span><div><strong>{hot}</strong><small>Hot relationships</small></div><HelpTip text="Your strongest, most active relationships." /></article>
        <article><span className="overview-stat-icon active"><Target size={18} /></span><div><strong>{active}</strong><small>Active opportunities</small></div><HelpTip text="Contacts that have moved beyond the unqualified stage." /></article>
        <article><span className="overview-stat-icon cities"><Globe2 size={18} /></span><div><strong>{cityCount}</strong><small>Cities covered</small></div><HelpTip text="Unique cities represented in your contact network." /></article>
      </div>

      <div className="overview-grid">
        <article className="panel start-card">
          <div className="overview-card-heading">
            <div><span className="eyebrow">Start here</span><h3>What would you like to do?</h3></div>
            <span className="friendly-label">Pick one</span>
          </div>
          <div className="quick-action-grid">
            {quickActions.map(({ title, copy, icon: Icon, view }) => (
              <button key={title} onClick={() => onNavigate(view)}>
                <span><Icon size={19} /></span>
                <div><strong>{title}</strong><small>{copy}</small></div>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </article>

        <article className="panel today-plan-card">
          <div className="overview-card-heading">
            <div>
              <span className="eyebrow">Your daily brief</span>
              <h3>
                {todayTasks.length
                  ? `${todayTasks.length} useful next ${todayTasks.length === 1 ? "move" : "moves"}`
                  : "You’re clear for today"}
              </h3>
            </div>
            <div className="today-plan-heading-actions">
              {completedTodayIds.length > 0 && (
                <button onClick={onResetToday}>Restore hidden</button>
              )}
              {todayTasks.length > 0 && (
                <span className={`today-plan-count${urgentToday ? " urgent" : ""}`}>
                  {urgentToday ? `${urgentToday} important` : "Plan ready"}
                </span>
              )}
            </div>
          </div>
          <div className="today-plan-list">
            {todayTasks.map((task) => (
              <TodayTaskRow
                key={task.id}
                task={task}
                onAction={() => {
                  if (task.kind === "follow-up" && task.contactId) {
                    onEmail(task.contactId);
                  } else if (task.kind === "relationship" && task.contactId) {
                    onSelect(task.contactId);
                  } else {
                    onNavigate(task.actionView);
                  }
                }}
                onComplete={() => onCompleteToday(task.id)}
              />
            ))}
            {!todayTasks.length && (
              <div className="today-plan-empty">
                <span><Check size={19} /></span>
                <div><strong>Nothing urgent is waiting.</strong><small>Use the shortcuts when you’re ready to build momentum.</small></div>
              </div>
            )}
          </div>
        </article>
      </div>

      <article className="panel workflow-explainer">
        <div><span className="eyebrow">How the app works</span><h3>A simple rhythm for managing relationships.</h3></div>
        <div className="workflow-steps">
          <span><b>1</b><strong>Choose a goal</strong><small>Plan a tour or decide who needs attention.</small></span>
          <ArrowRight size={17} />
          <span><b>2</b><strong>Review a draft</strong><small>AI helps write it. You stay in control.</small></span>
          <ArrowRight size={17} />
          <span><b>3</b><strong>Record the outcome</strong><small>Update the stage and follow-up date.</small></span>
        </div>
      </article>
    </section>
  );
}

function TodayTaskRow({
  task,
  onAction,
  onComplete,
}: {
  task: TodayTask;
  onAction: () => void;
  onComplete: () => void;
}) {
  const icons = {
    "follow-up": Mail,
    opportunity: ScanSearch,
    relationship: Users,
    profile: Sparkles,
  };
  const Icon = icons[task.kind];
  return (
    <div className={`today-task${task.priority === "High" ? " important" : ""}`}>
      <span className={`today-task-icon ${task.kind}`}><Icon size={16} /></span>
      <div className="today-task-copy">
        <span>
          <strong>{task.title}</strong>
          {task.priority === "High" && <b>Important</b>}
        </span>
        <small>{task.body}</small>
      </div>
      <div className="today-task-actions">
        <button className="button button-secondary" onClick={onAction}>{task.actionLabel} <ArrowRight size={12} /></button>
        <button className="today-task-done" onClick={onComplete} title="Hide this item until tomorrow"><Check size={13} /> Done for today</button>
      </div>
    </div>
  );
}

function SettingsWorkspace({
  contacts,
  onSelectContact,
  onReset,
  onExportJson,
  onExportCsv,
}: {
  contacts: Contact[];
  onSelectContact: (id: string) => void;
  onReset: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
}) {
  const [tab, setTab] = useState<"quality" | "data">("quality");
  return (
    <section className="settings-workspace">
      <div className="hub-tabs" role="tablist" aria-label="Settings">
        <button className={tab === "quality" ? "active" : ""} onClick={() => setTab("quality")}>
          <Check size={15} /> Data quality
        </button>
        <button className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}>
          <Download size={15} /> Backups & automation
        </button>
      </div>
      {tab === "quality" ? (
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
              <h2>Back up your contacts</h2>
              <p>Download your current contact data before making major changes.</p>
              <div className="settings-actions">
                <button className="button button-secondary" onClick={onExportJson}><FileJson size={15} /> Export JSON</button>
                <button className="button button-ghost" onClick={onExportCsv}><Download size={15} /> Export CSV</button>
              </div>
            </article>
            <article className="panel settings-card caution">
              <span className="icon-box"><RefreshCcw size={18} /></span>
              <h2>Reset local data</h2>
              <p>Clear browser edits and lock the private contact bundle again.</p>
              <button className="button button-ghost" onClick={onReset}><RefreshCcw size={15} /> Reset local data</button>
            </article>
          </div>
          <AutomationBlueprint />
        </>
      )}
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
}: {
  contact: Contact;
  onClose: () => void;
  onUpdate: (contact: Contact) => void;
  onEmail: () => void;
}) {
  const [draft, setDraft] = useState(contact);

  useEffect(() => setDraft(contact), [contact]);

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

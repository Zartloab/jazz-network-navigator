"use client";

import {
  Activity,
  ArrowRight,
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
  Globe2,
  Mail,
  MapPin,
  MessageSquareText,
  Music2,
  Plus,
  Radio,
  RefreshCcw,
  Search,
  Send,
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
import { Contact, EmailDraft, EmailIntent, Priority, Temperature } from "@/lib/types";

const STORAGE_KEY = "jazz-network-navigator-contacts-v1";
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

function cleanContact(contact: Contact): Contact {
  return {
    ...contact,
    relationship_score: Number(contact.relationship_score) || 0,
    lat: contact.lat === "" ? "" : Number(contact.lat),
    lng: contact.lng === "" ? "" : Number(contact.lng),
  };
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

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setContacts((JSON.parse(stored) as Contact[]).map(cleanContact));
    } else {
      setLocked(true);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
  }, [contacts, hydrated]);

  const selectedContact = contacts.find((contact) => contact.id === selectedId) || null;
  const emailContact = contacts.find((contact) => contact.id === emailContactId) || null;

  const updateContact = (updated: Contact) => {
    setContacts((current) => current.map((contact) => (contact.id === updated.id ? updated : contact)));
  };

  const resetData = () => {
    if (!window.confirm("Clear local edits and lock the encrypted contact dataset?")) return;
    window.localStorage.removeItem(STORAGE_KEY);
    setContacts([]);
    setSelectedId(null);
    setLocked(true);
  };

  const exportJson = () =>
    downloadFile("jazz-network-contacts.json", JSON.stringify(contacts, null, 2), "application/json");
  const exportCsv = () =>
    downloadFile("jazz-network-contacts.csv", contactsToCsv(contacts), "text/csv;charset=utf-8");

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
    <main>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <Header
        onAdd={() => setShowAdd(true)}
        onReset={resetData}
        onExportJson={exportJson}
        onExportCsv={exportCsv}
      />
      <div className="page-shell">
        <Hero contacts={contacts} />
        <RelationshipSection
          contacts={contacts}
          filter={mapFilter}
          onFilter={setMapFilter}
          hoverId={mapHoverId}
          onHover={setMapHoverId}
          onSelect={setSelectedId}
        />
        <FollowUpSection
          contacts={contacts}
          onUpdate={updateContact}
          onSelect={setSelectedId}
          onEmail={setEmailContactId}
        />
        <OpportunitySection contacts={contacts} onUpdate={updateContact} onSelect={setSelectedId} />
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
        <AskNetwork contacts={contacts} onSelect={setSelectedId} />
        <AutomationBlueprint />
        <footer>
          <div className="brand-mark small"><Music2 size={17} /></div>
          <span>Jazz Network Navigator</span>
          <span className="footer-muted">Local-first prototype · your edits stay in this browser</span>
        </footer>
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
        <EmailDraftModal contact={emailContact} onClose={() => setEmailContactId(null)} />
      )}
    </main>
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
        title="See where the signal is strongest."
        copy="Explore your network by geography, category and relationship temperature."
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
        eyebrow="This week"
        title="The right follow-up, before the moment cools."
        copy="Prioritised from urgency, relationship strength, stage and opportunity."
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
  return (
    <section className="section-block">
      <SectionHeading
        eyebrow="Opportunity radar"
        title="Every relationship has a current state."
        copy="Move contacts through the pipeline as conversations develop."
      />
      <div className="kanban">
        {opportunityStages.map((stage) => {
          const stageContacts = contacts
            .filter((contact) => contact.relationship_stage === stage)
            .sort((a, b) => b.relationship_score - a.relationship_score);
          return (
            <article className="kanban-column" key={stage}>
              <div className="kanban-title">
                <span className={`stage-dot stage-${stage.toLowerCase().replace(/[^a-z]+/g, "-")}`} />
                <strong>{stage}</strong>
                <span>{stageContacts.length}</span>
              </div>
              <div className="kanban-cards">
                {stageContacts.slice(0, 6).map((contact) => (
                  <div className="kanban-card" key={contact.id}>
                    <button className="kanban-contact" onClick={() => onSelect(contact.id)}>
                      <span>{contactLabel(contact)}</span>
                      <small>{contact.company || contact.category}</small>
                    </button>
                    <p>{contact.opportunity_summary || "Relationship to develop"}</p>
                    <div className="kanban-meta">
                      <TemperatureBadge value={contact.relationship_temperature} />
                      <span>{contact.relationship_score}</span>
                      {contact.is_dummy === "TRUE" && <Badge tone="demo">Demo</Badge>}
                    </div>
                    {(contact.introduced_by || contact.connected_to) && (
                      <small className="connection-note">
                        <Users size={11} /> {contact.introduced_by ? `Via ${contact.introduced_by}` : contact.connected_to}
                      </small>
                    )}
                    <select
                      value={contact.relationship_stage}
                      aria-label={`Change stage for ${contactLabel(contact)}`}
                      onChange={(event) => onUpdate({ ...contact, relationship_stage: event.target.value })}
                    >
                      {opportunityStages.map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </div>
                ))}
                {stageContacts.length > 6 && <div className="more-card">+ {stageContacts.length - 6} more in directory</div>}
              </div>
            </article>
          );
        })}
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
        title="The whole network, without the spreadsheet fog."
        copy="Search, filter and open any contact to edit the relationship record."
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
        .filter((contact) => answer.toLowerCase().includes(contact.full_name.toLowerCase()))
        .slice(0, 5)
    : [];

  return (
    <section id="ask" className="ask-section section-block">
      <div className="ask-glow" />
      <SectionHeading
        eyebrow="Ask your network"
        title="Turn 106 contacts into one useful answer."
        copy="Search the relationship context, not just the rows."
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
              <div><strong>{mode === "ai" ? "AI answer" : "Network answer"}</strong><p className="answer-copy">{answer}</p></div>
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

function EmailDraftModal({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const [intent, setIntent] = useState<EmailIntent>("Follow up after meeting");
  const [draft, setDraft] = useState<EmailDraft>(() => generateLocalEmailDraft(contact, intent));
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"local" | "ai">("local");
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact, intent }),
      });
      const data = await response.json();
      if (response.ok && data.available && data.draft) {
        setDraft(data.draft);
        setSource("ai");
      } else {
        setDraft(generateLocalEmailDraft(contact, intent));
        setSource("local");
      }
    } catch {
      setDraft(generateLocalEmailDraft(contact, intent));
      setSource("local");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDraft(generateLocalEmailDraft(contact, intent));
    setSource("local");
  }, [contact, intent]);

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

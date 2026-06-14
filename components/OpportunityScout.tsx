"use client";

import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  ExternalLink,
  Globe2,
  Lightbulb,
  MapPin,
  Radar,
  RefreshCcw,
  Search,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildLocalOpportunityScan,
  mergeOpportunities,
} from "@/lib/opportunity-scout";
import {
  ArtistProfile,
  Contact,
  OpportunityStatus,
  OpportunityType,
  ResearchBrief,
  ResearchOpportunity,
} from "@/lib/types";

const DEFAULT_BRIEF: ResearchBrief = {
  locations: "",
  genres: "Jazz, improvised music",
  goals: "Paid shows, festivals, press, funding",
  notes: "",
};
const BRIEF_STORAGE_KEY = "jazz-network-navigator-research-brief-v1";

const filters: Array<OpportunityStatus | "All"> = ["New", "Saved", "In progress", "All"];

function formatDeadline(value: string): string {
  if (!value) return "No stated deadline";
  const time = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(time.getTime())) return value;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(time);
}

function personLabel(contact: Contact): string {
  return contact.full_name || contact.company || "Unnamed contact";
}

function typeTone(type: OpportunityType): string {
  if (type === "Festival") return "festival";
  if (type === "Press") return "press";
  if (type === "Funding") return "funding";
  if (type === "Collaboration") return "collaboration";
  if (type === "Release") return "release";
  return "booking";
}

export default function OpportunityScout({
  contacts,
  profile,
  opportunities,
  onChange,
  onSelectContact,
}: {
  contacts: Contact[];
  profile: ArtistProfile;
  opportunities: ResearchOpportunity[];
  onChange: (opportunities: ResearchOpportunity[]) => void;
  onSelectContact: (id: string) => void;
}) {
  const [brief, setBrief] = useState<ResearchBrief>(DEFAULT_BRIEF);
  const [filter, setFilter] = useState<(typeof filters)[number]>("New");
  const [loading, setLoading] = useState(false);
  const [lastMode, setLastMode] = useState<"network" | "web" | "">("");
  const [message, setMessage] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(6);
  const [briefHydrated, setBriefHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(BRIEF_STORAGE_KEY);
    if (stored) {
      setBrief(JSON.parse(stored) as ResearchBrief);
    } else {
      setBrief({
        locations: profile.baseCity,
        genres: profile.genres || DEFAULT_BRIEF.genres,
        goals: profile.careerGoals || DEFAULT_BRIEF.goals,
        notes: profile.currentProject,
      });
    }
    setBriefHydrated(true);
  }, [profile]);

  useEffect(() => {
    if (briefHydrated) window.localStorage.setItem(BRIEF_STORAGE_KEY, JSON.stringify(brief));
  }, [brief, briefHydrated]);

  const visible = useMemo(
    () =>
      opportunities
        .filter((opportunity) => opportunity.status !== "Dismissed")
        .filter((opportunity) => filter === "All" || opportunity.status === filter)
        .sort((a, b) => b.confidence - a.confidence),
    [filter, opportunities],
  );

  const stats = useMemo(() => {
    const active = opportunities.filter((opportunity) => opportunity.status !== "Dismissed");
    return {
      newCount: active.filter((opportunity) => opportunity.status === "New").length,
      saved: active.filter((opportunity) => opportunity.status === "Saved").length,
      live: active.filter((opportunity) => opportunity.sourceType === "web").length,
      warmPaths: active.filter((opportunity) => opportunity.contactIds.length > 0).length,
    };
  }, [opportunities]);

  const updateStatus = (id: string, status: OpportunityStatus) => {
    onChange(
      opportunities.map((opportunity) =>
        opportunity.id === id ? { ...opportunity, status } : opportunity,
      ),
    );
  };

  const runScan = async () => {
    setLoading(true);
    setMessage("");
    let scanMessage = "";
    const networkMatches = buildLocalOpportunityScan(brief, contacts);
    let combined = mergeOpportunities(opportunities, networkMatches);
    let usedWeb = false;
    onChange(combined);
    setLastMode("network");
    setMessage("Network scan complete. Checking current official sources...");
    setFilter("New");
    setVisibleLimit(6);

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 30_000);
      const response = await fetch("/api/research-opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ brief }),
      });
      window.clearTimeout(timeout);
      const payload = (await response.json()) as {
        available?: boolean;
        opportunities?: ResearchOpportunity[];
        error?: string;
      };
      if (response.ok && payload.available && payload.opportunities?.length) {
        combined = mergeOpportunities(combined, payload.opportunities, true);
        usedWeb = true;
      } else if (payload.error) {
        scanMessage = `${payload.error} Your network scan is still ready.`;
      }
    } catch {
      scanMessage = "Live research took too long or is unavailable. Your network scan is ready.";
    }

    onChange(combined);
    setLastMode(usedWeb ? "web" : "network");
    if (!scanMessage) {
      scanMessage =
        usedWeb
          ? "Scan complete. Live web findings and network signals are clearly labelled."
          : "Network scan complete. Add an OpenAI key to include current web opportunities.";
    }
    setMessage(scanMessage);
    setLoading(false);
  };

  return (
    <section className="scout-workspace">
      <div className="scout-intro">
        <div>
          <span className="eyebrow">Opportunity Scout</span>
          <h2>Find the next useful opening.</h2>
          <p>
            Scout your network for warm routes, then check current official sources when live
            research is available.
          </p>
        </div>
        <div className="scout-trust-note">
          <Check size={15} />
          <span><strong>Evidence first.</strong> Network signals and web findings are never mixed together.</span>
        </div>
      </div>

      <div className="scout-layout">
        <aside className="panel scout-brief">
          <div className="scout-panel-heading">
            <span className="scout-icon"><Radar size={19} /></span>
            <div><strong>What should Scout look for?</strong><small>A rough brief is enough.</small></div>
          </div>
          <label>
            <span>Places</span>
            <input
              value={brief.locations}
              onChange={(event) => setBrief({ ...brief, locations: event.target.value })}
              placeholder="e.g. Berlin, Sydney, Europe"
            />
          </label>
          <label>
            <span>Genre or project</span>
            <input
              value={brief.genres}
              onChange={(event) => setBrief({ ...brief, genres: event.target.value })}
              placeholder="e.g. contemporary jazz trio"
            />
          </label>
          <label>
            <span>What would help?</span>
            <input
              value={brief.goals}
              onChange={(event) => setBrief({ ...brief, goals: event.target.value })}
              placeholder="e.g. festivals, paid shows, grants"
            />
          </label>
          <label>
            <span>Extra context</span>
            <textarea
              value={brief.notes}
              onChange={(event) => setBrief({ ...brief, notes: event.target.value })}
              placeholder="Dates, fee expectations, new release, preferred venue size..."
              rows={4}
            />
          </label>
          <button className="button button-primary scout-run" onClick={runScan} disabled={loading}>
            {loading ? <RefreshCcw className="spin" size={17} /> : <Search size={17} />}
            {loading ? "Researching opportunities..." : "Run Opportunity Scan"}
          </button>
          <div className="scout-mode-explainer">
            <span><Users size={14} /><b>Network scan</b> uses only saved relationship data.</span>
            <span><Globe2 size={14} /><b>Live research</b> links directly to current sources.</span>
          </div>
        </aside>

        <div className="scout-results">
          <div className="scout-stats">
            <article><span><Sparkles size={16} /></span><div><strong>{stats.newCount}</strong><small>New signals</small></div></article>
            <article><span><Bookmark size={16} /></span><div><strong>{stats.saved}</strong><small>Saved</small></div></article>
            <article><span><Globe2 size={16} /></span><div><strong>{stats.live}</strong><small>Live sources</small></div></article>
            <article><span><Users size={16} /></span><div><strong>{stats.warmPaths}</strong><small>Warm paths</small></div></article>
          </div>

          {message && (
            <div className={`scout-message ${lastMode === "web" ? "live" : ""}`}>
              {lastMode === "web" ? <Globe2 size={15} /> : <Lightbulb size={15} />}
              <span>{message}</span>
            </div>
          )}

          <div className="scout-result-toolbar">
            <div>
              <h3>Opportunity inbox</h3>
              <p>Keep only the openings worth acting on.</p>
            </div>
            <div className="scout-filters">
              {filters.map((option) => (
                <button
                  key={option}
                  className={filter === option ? "active" : ""}
                  onClick={() => {
                    setFilter(option);
                    setVisibleLimit(6);
                  }}
                >
                  {option}
                  {option !== "All" && (
                    <b>{opportunities.filter((item) => item.status === option).length}</b>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="scout-opportunity-list">
            {visible.slice(0, visibleLimit).map((opportunity) => {
              const relatedContacts = opportunity.contactIds
                .map((id) => contacts.find((contact) => contact.id === id))
                .filter((contact): contact is Contact => Boolean(contact));
              return (
                <article className="panel scout-opportunity-card" key={opportunity.id}>
                  <div className="scout-card-topline">
                    <span className={`opportunity-type type-${typeTone(opportunity.type)}`}>
                      {opportunity.type}
                    </span>
                    <span className={`source-pill ${opportunity.sourceType}`}>
                      {opportunity.sourceType === "web" ? <Globe2 size={12} /> : <Users size={12} />}
                      {opportunity.sourceType === "web" ? "Live web source" : "From your network"}
                    </span>
                    <span className="confidence-pill">{opportunity.confidence}% fit</span>
                  </div>
                  <div className="scout-card-heading">
                    <div>
                      <h4>{opportunity.title}</h4>
                      <span>
                        {opportunity.organisation}
                        {opportunity.location && <><MapPin size={12} />{opportunity.location}</>}
                      </span>
                    </div>
                    {opportunity.status !== "New" && (
                      <span className={`status-pill status-${opportunity.status.toLowerCase().replace(" ", "-")}`}>
                        {opportunity.status}
                      </span>
                    )}
                  </div>
                  <p className="scout-summary">{opportunity.summary}</p>
                  <div className="scout-reason-grid">
                    <div><span>Why it matters</span><p>{opportunity.whyNow}</p></div>
                    <div><span>Suggested next step</span><p>{opportunity.nextAction}</p></div>
                  </div>
                  <div className="scout-card-meta">
                    <span><Clock3 size={13} /> {formatDeadline(opportunity.deadline)}</span>
                    {opportunity.sourceUrl ? (
                      <a href={opportunity.sourceUrl} target="_blank" rel="noreferrer">
                        {opportunity.sourceLabel || "Open official source"} <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span><CircleDot size={13} /> {opportunity.sourceLabel}</span>
                    )}
                  </div>
                  {relatedContacts.length > 0 && (
                    <div className="scout-warm-paths">
                      <span>People who can help</span>
                      <div>
                        {relatedContacts.slice(0, 4).map((contact) => (
                          <button key={contact.id} onClick={() => onSelectContact(contact.id)}>
                            <i>{personLabel(contact).slice(0, 1)}</i>
                            <span>{personLabel(contact)}</span>
                            <ChevronRight size={13} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="scout-card-actions">
                    {opportunity.status !== "Saved" && (
                      <button
                        className="button button-secondary"
                        onClick={() => updateStatus(opportunity.id, "Saved")}
                      >
                        <Bookmark size={14} /> Save
                      </button>
                    )}
                    {opportunity.status !== "In progress" && (
                      <button
                        className="button button-primary"
                        onClick={() => updateStatus(opportunity.id, "In progress")}
                      >
                        <Target size={14} /> Start working on it
                      </button>
                    )}
                    <button
                      className="button button-ghost"
                      onClick={() => updateStatus(opportunity.id, "Dismissed")}
                    >
                      <X size={14} /> Not for me
                    </button>
                  </div>
                </article>
              );
            })}
            {visible.length > visibleLimit && (
              <button
                className="scout-load-more"
                onClick={() => setVisibleLimit((current) => current + 6)}
              >
                Show {Math.min(6, visible.length - visibleLimit)} more opportunities
                <ArrowRight size={14} />
              </button>
            )}
            {!visible.length && (
              <div className="panel scout-empty">
                <span><Radar size={24} /></span>
                <h3>{opportunities.length ? "Nothing in this view." : "Your opportunity inbox is ready."}</h3>
                <p>
                  {opportunities.length
                    ? "Choose another filter or run a fresh scan."
                    : "Add a few preferences, then run Scout. It will begin with the relationships you already have."}
                </p>
                {!opportunities.length && (
                  <button className="button button-secondary" onClick={runScan}>
                    Start with my network <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

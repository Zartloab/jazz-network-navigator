"use client";

import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  ExternalLink,
  Filter,
  FolderKanban,
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
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import {
  buildLocalOpportunityScan,
  mergeOpportunities,
} from "@/lib/opportunity-scout";
import {
  ArtistProfile,
  ActProfile,
  ArtistAsset,
  ArtistWorkspace,
  Campaign,
  Contact,
  OpportunityStatus,
  OpportunityType,
  ResearchBrief,
  ResearchOpportunity,
} from "@/lib/types";
import { actToArtistProfile } from "@/lib/hamed-portfolio";

const DEFAULT_BRIEF: ResearchBrief = {
  locations: "",
  genres: "Jazz, improvised music",
  goals: "Paid shows, festivals, press, funding",
  notes: "",
};
const BRIEF_STORAGE_KEY = "jazz-network-navigator-research-brief-v1";
const WEEKLY_SCAN_STORAGE_KEY = "jazz-network-navigator-weekly-scans-v1";

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
  campaigns,
  onCampaignsChange,
  acts,
  assets,
  workspace,
}: {
  contacts: Contact[];
  profile: ArtistProfile;
  opportunities: ResearchOpportunity[];
  onChange: (opportunities: ResearchOpportunity[]) => void;
  onSelectContact: (id: string) => void;
  campaigns: Campaign[];
  onCampaignsChange: Dispatch<SetStateAction<Campaign[]>>;
  acts: ActProfile[];
  assets: ArtistAsset[];
  workspace: ArtistWorkspace;
}) {
  const initialCampaignId =
    campaigns.find((campaign) => campaign.status === "Active")?.id ||
    campaigns[0]?.id ||
    "";
  const [campaignId, setCampaignId] = useState(initialCampaignId);
  const [brief, setBrief] = useState<ResearchBrief>(DEFAULT_BRIEF);
  const [filter, setFilter] = useState<(typeof filters)[number]>("New");
  const [loading, setLoading] = useState(false);
  const [lastMode, setLastMode] = useState<"network" | "web" | "">("");
  const [message, setMessage] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(6);
  const [briefHydrated, setBriefHydrated] = useState(false);
  const [lastWeeklyScan, setLastWeeklyScan] = useState("");
  const [briefOpen, setBriefOpen] = useState(false);
  const campaign = campaigns.find((item) => item.id === campaignId) || campaigns[0];
  const act = campaign ? acts.find((item) => item.id === campaign.actId) : undefined;
  const campaignProfile =
    campaign && act ? actToArtistProfile(workspace, act, campaign, assets) : profile;

  useEffect(() => {
    const stored = window.localStorage.getItem(BRIEF_STORAGE_KEY);
    if (stored) {
      try {
        setBrief({ ...DEFAULT_BRIEF, ...(JSON.parse(stored) as ResearchBrief) });
      } catch {
        window.localStorage.removeItem(BRIEF_STORAGE_KEY);
      }
    } else {
      setBrief({
        campaignId: campaign?.id,
        locations: campaign?.targetRegions.join(", ") || campaignProfile.baseCity,
        genres: campaignProfile.genres || DEFAULT_BRIEF.genres,
        goals: campaign?.goal || campaignProfile.careerGoals || DEFAULT_BRIEF.goals,
        notes: campaign
          ? `${campaign.name}. ${campaign.notes} Ensemble size: ${campaign.ensembleSize}. Minimum fee: ${campaign.minimumFee || "not confirmed"}.`
          : campaignProfile.currentProject,
      });
    }
    setBriefHydrated(true);
  }, [campaign?.id]);

  useEffect(() => {
    if (!campaign || !act || !briefHydrated) return;
    setBrief({
      campaignId: campaign.id,
      locations: campaign.targetRegions.join(", "),
      genres: act.genres,
      goals: campaign.goal,
      notes: `${campaign.name}. ${campaign.notes} Ensemble size: ${campaign.ensembleSize}. Minimum fee: ${campaign.minimumFee || "not confirmed"}.`,
    });
  }, [act, briefHydrated, campaign]);

  useEffect(() => {
    if (briefHydrated) window.localStorage.setItem(BRIEF_STORAGE_KEY, JSON.stringify(brief));
  }, [brief, briefHydrated]);

  useEffect(() => {
    if (!campaign || !act || !briefHydrated) return;
    let scans: Record<string, string> = {};
    try {
      scans = JSON.parse(window.localStorage.getItem(WEEKLY_SCAN_STORAGE_KEY) || "{}");
    } catch {
      scans = {};
    }
    const last = scans[campaign.id] || "";
    setLastWeeklyScan(last);
    const stale = !last || Date.now() - new Date(last).getTime() >= 7 * 24 * 60 * 60 * 1000;
    if (!stale) return;
    const weeklyBrief: ResearchBrief = {
      campaignId: campaign.id,
      locations: campaign.targetRegions.join(", "),
      genres: act.genres,
      goals: campaign.goal,
      notes: campaign.notes,
    };
    const matches = buildLocalOpportunityScan(weeklyBrief, contacts)
      .map((opportunity) => ({ ...opportunity, campaignId: campaign.id }))
      .slice(0, 10);
    onChange(mergeOpportunities(opportunities, matches, true));
    const scannedAt = new Date().toISOString();
    scans[campaign.id] = scannedAt;
    window.localStorage.setItem(WEEKLY_SCAN_STORAGE_KEY, JSON.stringify(scans));
    setLastWeeklyScan(scannedAt);
  }, [act, briefHydrated, campaign, contacts]);

  const visible = useMemo(
    () =>
      opportunities
        .filter((opportunity) => opportunity.status !== "Dismissed")
        .filter((opportunity) => !campaign || opportunity.campaignId === campaign.id)
        .filter((opportunity) => filter === "All" || opportunity.status === filter)
        .sort((a, b) => b.confidence - a.confidence),
    [campaign, filter, opportunities],
  );

  const stats = useMemo(() => {
    const active = opportunities
      .filter((opportunity) => opportunity.status !== "Dismissed")
      .filter((opportunity) => !campaign || opportunity.campaignId === campaign.id);
    return {
      newCount: active.filter((opportunity) => opportunity.status === "New").length,
      saved: active.filter((opportunity) => opportunity.status === "Saved").length,
      live: active.filter((opportunity) => opportunity.sourceType === "web").length,
      warmPaths: active.filter((opportunity) => opportunity.contactIds.length > 0).length,
    };
  }, [campaign, opportunities]);

  const updateStatus = (id: string, status: OpportunityStatus) => {
    onChange(
      opportunities.map((opportunity) =>
        opportunity.id === id ? { ...opportunity, status } : opportunity,
      ),
    );
  };

  const linkToCampaign = (opportunityId: string, nextCampaignId: string) => {
    onCampaignsChange((current) =>
      current.map((item) => ({
        ...item,
        opportunityIds:
          item.id === nextCampaignId
            ? [...new Set([...item.opportunityIds, opportunityId])]
            : item.opportunityIds.filter((id) => id !== opportunityId),
        contactIds:
          item.id === nextCampaignId
            ? [
                ...new Set([
                  ...item.contactIds,
                  ...(opportunities.find((opportunity) => opportunity.id === opportunityId)?.contactIds || []),
                ]),
              ]
            : item.contactIds,
      })),
    );
    onChange(
      opportunities.map((opportunity) =>
        opportunity.id === opportunityId
          ? { ...opportunity, campaignId: nextCampaignId || undefined, status: nextCampaignId ? "In progress" : opportunity.status }
          : opportunity,
      ),
    );
  };

  const runScan = async () => {
    setLoading(true);
    setMessage("");
    let scanMessage = "";
    if (!campaign) {
      setMessage("Choose a campaign before searching for work.");
      setLoading(false);
      return;
    }
    const campaignBrief = { ...brief, campaignId: campaign.id };
    const networkMatches = buildLocalOpportunityScan(campaignBrief, contacts)
      .map((opportunity) => ({ ...opportunity, campaignId: campaign.id }))
      .slice(0, 10);
    let combined = mergeOpportunities(opportunities, networkMatches);
    let usedWeb = false;
    onChange(combined);
    setLastMode("network");
    setMessage("Network scan complete. Review the shortlist before using paid live research.");
    setFilter("New");
    setVisibleLimit(6);

    const shouldResearch = window.confirm(
      `Use live AI research for “${campaign.name}”? This may use your OpenAI budget. Network results are already ready.`,
    );
    if (!shouldResearch) {
      setMessage("Network scan ready. Live research was not used.");
      setLoading(false);
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 30_000);
      const response = await fetch("/api/research-opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          brief: campaignBrief,
          campaign: {
            name: campaign.name,
            type: campaign.type,
            goal: campaign.goal,
            regions: campaign.targetRegions,
            dates: [campaign.startDate, campaign.endDate],
            ensembleSize: campaign.ensembleSize,
            minimumFee: campaign.minimumFee,
            routeStops: campaign.routeStops,
            availableAssets: assets
              .filter((asset) => asset.actId === campaign.actId)
              .map((asset) => asset.kind),
          },
        }),
      });
      window.clearTimeout(timeout);
      const payload = (await response.json()) as {
        available?: boolean;
        opportunities?: ResearchOpportunity[];
        error?: string;
        budgetBlocked?: boolean;
      };
      if (response.ok && payload.available && payload.opportunities?.length) {
        combined = mergeOpportunities(
          combined,
          payload.opportunities
            .map((opportunity) => ({ ...opportunity, campaignId: campaign.id }))
            .slice(0, 10),
          true,
        ).slice(0, 10);
        usedWeb = true;
      } else if (payload.budgetBlocked) {
        scanMessage = "The monthly AI limit has been reached. Your network shortlist is ready and no paid search was made.";
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
          <span className="eyebrow">Opportunity inbox</span>
          <h2>Best openings for this campaign.</h2>
          <p>
            Start with the strongest matches. Adjust the search only when the campaign or route changes.
          </p>
        </div>
        <div className="scout-trust-note">
          <Check size={15} />
          <span><strong>Evidence first.</strong> Network signals and web findings are never mixed together.</span>
        </div>
      </div>

      <div className="scout-layout">
        {briefOpen && (
          <button
            className="scout-drawer-backdrop"
            aria-label="Close search settings"
            onClick={() => setBriefOpen(false)}
          />
        )}
        <aside className={`panel scout-brief${briefOpen ? " open" : ""}`}>
          <div className="scout-panel-heading">
            <span className="scout-icon"><Radar size={19} /></span>
            <div><strong>What should Scout look for?</strong><small>A rough brief is enough.</small></div>
            <button className="scout-close" onClick={() => setBriefOpen(false)} aria-label="Close search settings">
              <X size={16} />
            </button>
          </div>
          <label>
            <span>Campaign</span>
            <select value={campaign?.id || ""} onChange={(event) => setCampaignId(event.target.value)}>
              {campaigns.filter((item) => item.status !== "Complete").map((item) => {
                const itemAct = acts.find((candidate) => candidate.id === item.actId);
                return <option value={item.id} key={item.id}>{item.name} · {itemAct?.shortName}</option>;
              })}
            </select>
          </label>
          {campaign && (
            <div className="scout-campaign-context">
              <span className={campaign.confirmed ? "confirmed" : ""}>
                {campaign.confirmed ? <Check size={13} /> : <Clock3 size={13} />}
                {campaign.confirmed ? "Campaign facts confirmed" : "Review campaign facts before outreach"}
              </span>
              <p>{campaign.goal}</p>
              <small>{lastWeeklyScan ? `Weekly network scan: ${formatDeadline(lastWeeklyScan)}` : "Weekly network scan not run yet"}</small>
            </div>
          )}
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
            <div className="scout-toolbar-actions">
              <button className="button button-secondary" onClick={() => setBriefOpen(true)}>
                <Filter size={14} /> Adjust search
              </button>
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
          </div>

          <div className="scout-opportunity-list">
            {visible.slice(0, visibleLimit).map((opportunity) => {
              const relatedContacts = opportunity.contactIds
                .map((id) => contacts.find((contact) => contact.id === id))
                .filter((contact): contact is Contact => Boolean(contact));
              const linkedCampaignId =
                opportunity.campaignId ||
                campaigns.find((item) => item.opportunityIds.includes(opportunity.id))?.id ||
                "";
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
                    {campaigns.length > 0 && (
                      <label className={`scout-project-link${linkedCampaignId ? " linked" : ""}`}>
                        <FolderKanban size={14} />
                        <select
                          value={linkedCampaignId}
                          onChange={(event) => linkToCampaign(opportunity.id, event.target.value)}
                          aria-label={`Campaign for ${opportunity.title}`}
                        >
                          <option value="">Add to campaign...</option>
                          {campaigns
                            .filter((item) => item.status !== "Complete")
                            .map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                        </select>
                      </label>
                    )}
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
                    {opportunity.status !== "New" && (
                      <button
                        className="button button-ghost"
                        onClick={() => updateStatus(opportunity.id, "New")}
                      >
                        <RefreshCcw size={14} /> Return to inbox
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
                  <button className="button button-secondary" onClick={() => setBriefOpen(true)}>
                    Adjust search brief <ArrowRight size={14} />
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

"use client";

import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileCheck2,
  Flag,
  MapPin,
  Music2,
  Plus,
  Route,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Dispatch, SetStateAction, useMemo, useState } from "react";
import {
  ActProfile,
  AppView,
  ArtistAsset,
  Campaign,
  CampaignRouteStop,
  Contact,
  ResearchOpportunity,
} from "@/lib/types";

function formatDate(value: string): string {
  if (!value) return "Open";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

function amount(value: string): number {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function nextAction(campaign: Campaign, assets: ArtistAsset[]): string {
  if (!campaign.confirmed) return "Confirm the campaign facts before outreach begins.";
  const openTask = campaign.tasks.find((task) => task.status !== "Done");
  if (openTask) return openTask.title;
  const missingAsset = campaign.requiredAssetKinds.find(
    (kind) => !assets.some((asset) => asset.actId === campaign.actId && asset.kind === kind),
  );
  if (missingAsset) return `Add or confirm the ${missingAsset.toLowerCase()}.`;
  if (!campaign.opportunityIds.length) return "Run a focused Find Work scan for this campaign.";
  if (!campaign.contactIds.length) return "Choose the first relationship to approach.";
  return "Review the strongest opportunity and prepare one outreach draft.";
}

function RouteTimeline({
  stops,
  onAdd,
  onSync,
  syncing,
}: {
  stops: CampaignRouteStop[];
  onAdd: () => void;
  onSync: () => void;
  syncing: boolean;
}) {
  return (
    <div className="campaign-route">
      <div className="campaign-section-heading">
        <div><Route size={16} /><span><strong>Route and date windows</strong><small>Website plans are not treated as confirmed bookings.</small></span></div>
        <div className="route-actions">
          <button onClick={onSync} disabled={!stops.some((stop) => stop.status === "Confirmed" && stop.startDate) || syncing}>
            <CalendarDays size={13} /> {syncing ? "Syncing..." : "Sync confirmed"}
          </button>
          <button onClick={onAdd}><Plus size={13} /> Add date</button>
        </div>
      </div>
      <div className="route-track">
        {stops.map((stop) => (
          <article className={`route-stop ${stop.status.toLowerCase()}`} key={stop.id}>
            <span className="route-stop-dot" />
            <div>
              <b>{stop.status}</b>
              <strong>{stop.city}{stop.country ? `, ${stop.country}` : ""}</strong>
              <small>{formatDate(stop.startDate)}{stop.endDate && stop.endDate !== stop.startDate ? ` - ${formatDate(stop.endDate)}` : ""}</small>
              <p>{stop.venue || stop.notes || "No venue recorded"}</p>
            </div>
          </article>
        ))}
        {!stops.length && (
          <button className="route-empty" onClick={onAdd}>
            <MapPin size={18} /><span><strong>Add the first date or open window</strong><small>This makes routing gaps visible.</small></span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function CampaignHub({
  acts,
  assets,
  campaigns,
  onCampaignsChange,
  contacts,
  opportunities,
  onNavigate,
}: {
  acts: ActProfile[];
  assets: ArtistAsset[];
  campaigns: Campaign[];
  onCampaignsChange: Dispatch<SetStateAction<Campaign[]>>;
  contacts: Contact[];
  opportunities: ResearchOpportunity[];
  onNavigate: (view: AppView) => void;
}) {
  const initial = campaigns.find((campaign) => campaign.status === "Active")?.id || campaigns[0]?.id || "";
  const [selectedId, setSelectedId] = useState(initial);
  const [newTask, setNewTask] = useState("");
  const [showRouteForm, setShowRouteForm] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState("");
  const [routeDraft, setRouteDraft] = useState({
    city: "",
    country: "",
    startDate: "",
    endDate: "",
    status: "Available" as CampaignRouteStop["status"],
    venue: "",
  });
  const selected = campaigns.find((campaign) => campaign.id === selectedId) || campaigns[0] || null;
  const act = selected ? acts.find((item) => item.id === selected.actId) : null;
  const campaignAssets = selected ? assets.filter((asset) => asset.actId === selected.actId) : [];
  const campaignContacts = selected
    ? selected.contactIds.map((id) => contacts.find((contact) => contact.id === id)).filter((item): item is Contact => Boolean(item))
    : [];
  const campaignOpportunities = selected
    ? opportunities.filter(
        (opportunity) =>
          opportunity.campaignId === selected.id || selected.opportunityIds.includes(opportunity.id),
      )
    : [];

  const update = (patch: Partial<Campaign>) => {
    if (!selected) return;
    onCampaignsChange((current) =>
      current.map((campaign) => campaign.id === selected.id ? { ...campaign, ...patch } : campaign),
    );
  };

  const progress = useMemo(() => {
    if (!selected) return 0;
    const checks = [
      selected.confirmed,
      selected.tasks.some((task) => task.status === "Done"),
      selected.opportunityIds.length > 0 || campaignOpportunities.length > 0,
      selected.contactIds.length > 0,
      selected.requiredAssetKinds.every((kind) => campaignAssets.some((asset) => asset.kind === kind)),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [campaignAssets, campaignOpportunities.length, selected]);

  if (!selected || !act) return null;

  const confirmedIncome = selected.deals
    .filter((deal) => ["Confirmed", "Paid"].includes(deal.status))
    .reduce((sum, deal) => sum + amount(deal.amount), 0);
  const projectedCosts = selected.expenses.reduce((sum, expense) => sum + amount(expense.amount), 0);
  const openTasks = selected.tasks.filter((task) => task.status !== "Done");
  const missingAssets = selected.requiredAssetKinds.filter(
    (kind) => !campaignAssets.some((asset) => asset.kind === kind),
  );

  const addTask = () => {
    if (!newTask.trim()) return;
    update({
      tasks: [
        ...selected.tasks,
        {
          id: `TASK-${Date.now()}`,
          title: newTask.trim(),
          status: "To do",
          dueDate: "",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setNewTask("");
  };

  const addRouteStop = () => {
    if (!routeDraft.city.trim()) return;
    update({
      routeStops: [
        ...selected.routeStops,
        {
          id: `ROUTE-${Date.now()}`,
          ...routeDraft,
          city: routeDraft.city.trim(),
          country: routeDraft.country.trim(),
          notes: "",
        },
      ],
    });
    setRouteDraft({ city: "", country: "", startDate: "", endDate: "", status: "Available", venue: "" });
    setShowRouteForm(false);
  };

  const syncCalendar = async () => {
    setSyncingCalendar(true);
    setCalendarMessage("");
    try {
      const response = await fetch("/api/automation/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: selected.id,
          campaignName: selected.name,
          events: selected.routeStops.map((stop) => ({
            id: stop.id,
            title: `${selected.name}${stop.venue ? ` - ${stop.venue}` : ""}`,
            startDate: stop.startDate,
            endDate: stop.endDate || stop.startDate,
            location: [stop.city, stop.country].filter(Boolean).join(", "),
            status: stop.status,
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Calendar sync failed.");
      setCalendarMessage(`${payload.synced} confirmed calendar ${payload.synced === 1 ? "event" : "events"} synced.`);
    } catch (error) {
      setCalendarMessage(error instanceof Error ? error.message : "Calendar sync failed.");
    } finally {
      setSyncingCalendar(false);
    }
  };

  return (
    <section className="campaign-workspace">
      <div className="campaign-intro">
        <div>
          <span className="eyebrow">Campaign manager</span>
          <h2>Run the work, not the software.</h2>
          <p>Each campaign keeps its dates, opportunities, relationships, materials and money in one calm view.</p>
        </div>
        <div className="campaign-trust"><Check size={14} /><span>Public website details stay editable until Hamed confirms them.</span></div>
      </div>

      <div className="campaign-layout">
        <aside className="campaign-list">
          <span className="campaign-list-label">Campaigns</span>
          {campaigns.map((campaign) => {
            const campaignAct = acts.find((item) => item.id === campaign.actId);
            return (
              <button
                key={campaign.id}
                className={campaign.id === selected.id ? "active" : ""}
                onClick={() => setSelectedId(campaign.id)}
              >
                <span className={`campaign-status-dot ${campaign.status.toLowerCase()}`} />
                <span><strong>{campaign.name}</strong><small>{campaignAct?.shortName} · {campaign.type}</small></span>
                {!campaign.confirmed && <b>Review</b>}
              </button>
            );
          })}
        </aside>

        <div className="campaign-main">
          <article className="panel campaign-hero">
            <div className="campaign-hero-top">
              <div>
                <div className="campaign-kicker">
                  <span><Music2 size={13} />{act.name}</span>
                  <span>{selected.type}</span>
                  <span className={selected.confirmed ? "confirmed" : "unconfirmed"}>
                    {selected.confirmed ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}
                    {selected.confirmed ? "Facts confirmed" : "Needs Hamed's review"}
                  </span>
                </div>
                <h3>{selected.name}</h3>
                <p>{selected.goal}</p>
              </div>
              <label className="campaign-status-select">
                <span>Status</span>
                <select value={selected.status} onChange={(event) => update({ status: event.target.value as Campaign["status"] })}>
                  <option>Suggested</option><option>Active</option><option>Paused</option><option>Complete</option>
                </select>
              </label>
            </div>
            <div className="campaign-progress">
              <div><span style={{ width: `${progress}%` }} /></div>
              <strong>{progress}% campaign ready</strong>
            </div>
            <div className="campaign-next-action">
              <span><Sparkles size={17} /></span>
              <div><small>Best next action</small><strong>{nextAction(selected, assets)}</strong></div>
              {!selected.confirmed ? (
                <button onClick={() => update({ confirmed: true, status: "Active" })}>Confirm campaign facts <ArrowRight size={13} /></button>
              ) : (
                <button onClick={() => onNavigate("discover")}>Find work <ArrowRight size={13} /></button>
              )}
            </div>
          </article>

          <div className="campaign-metrics">
            <article><Target size={17} /><span><strong>{campaignOpportunities.length}</strong><small>Opportunities</small></span></article>
            <article><Users size={17} /><span><strong>{campaignContacts.length}</strong><small>Linked people</small></span></article>
            <article><FileCheck2 size={17} /><span><strong>{selected.requiredAssetKinds.filter((kind) => campaignAssets.some((asset) => asset.kind === kind)).length}/{selected.requiredAssetKinds.length}</strong><small>Materials ready</small></span></article>
            <article><CircleDollarSign size={17} /><span><strong>{confirmedIncome.toLocaleString()}</strong><small>Confirmed income</small></span></article>
            <article><Flag size={17} /><span><strong>{projectedCosts.toLocaleString()}</strong><small>Projected costs</small></span></article>
          </div>

          {selected.type === "Tour" && (
            <>
              <RouteTimeline
                stops={selected.routeStops}
                onAdd={() => setShowRouteForm((current) => !current)}
                onSync={syncCalendar}
                syncing={syncingCalendar}
              />
              {calendarMessage && <div className="campaign-inline-message"><CalendarDays size={13} />{calendarMessage}</div>}
              {showRouteForm && (
                <div className="panel route-form">
                  <input value={routeDraft.city} onChange={(event) => setRouteDraft({ ...routeDraft, city: event.target.value })} placeholder="City or route area" />
                  <input value={routeDraft.country} onChange={(event) => setRouteDraft({ ...routeDraft, country: event.target.value })} placeholder="Country" />
                  <input type="date" value={routeDraft.startDate} onChange={(event) => setRouteDraft({ ...routeDraft, startDate: event.target.value })} />
                  <input type="date" value={routeDraft.endDate} onChange={(event) => setRouteDraft({ ...routeDraft, endDate: event.target.value })} />
                  <select value={routeDraft.status} onChange={(event) => setRouteDraft({ ...routeDraft, status: event.target.value as CampaignRouteStop["status"] })}>
                    <option>Available</option><option>Tentative</option><option>Confirmed</option>
                  </select>
                  <input value={routeDraft.venue} onChange={(event) => setRouteDraft({ ...routeDraft, venue: event.target.value })} placeholder="Venue or note" />
                  <button className="button button-primary" onClick={addRouteStop}>Add to route</button>
                </div>
              )}
            </>
          )}

          <div className="campaign-detail-grid">
            <article className="panel campaign-task-card">
              <div className="campaign-section-heading">
                <div><CalendarDays size={16} /><span><strong>Next moves</strong><small>{openTasks.length} still open</small></span></div>
              </div>
              <div className="campaign-task-entry">
                <input value={newTask} onChange={(event) => setNewTask(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addTask()} placeholder="Add one practical next step" />
                <button onClick={addTask}><Plus size={15} /> Add</button>
              </div>
              <div className="campaign-task-list">
                {selected.tasks.map((task) => (
                  <label key={task.id}>
                    <input
                      type="checkbox"
                      checked={task.status === "Done"}
                      onChange={(event) =>
                        update({
                          tasks: selected.tasks.map((item) =>
                            item.id === task.id ? { ...item, status: event.target.checked ? "Done" : "To do" } : item,
                          ),
                        })
                      }
                    />
                    <span><strong>{task.title}</strong><small>{task.dueDate ? formatDate(task.dueDate) : "No deadline"}</small></span>
                  </label>
                ))}
                {!selected.tasks.length && <p>No tasks yet. Add the smallest useful next move.</p>}
              </div>
            </article>

            <article className="panel campaign-material-card">
              <div className="campaign-section-heading">
                <div><FileCheck2 size={16} /><span><strong>Outreach materials</strong><small>Only confirmed facts should enter a pitch.</small></span></div>
              </div>
              <div className="campaign-material-list">
                {selected.requiredAssetKinds.map((kind) => {
                  const asset = campaignAssets.find((item) => item.kind === kind);
                  return (
                    <div key={kind} className={asset ? "ready" : "missing"}>
                      {asset ? <Check size={14} /> : <Clock3 size={14} />}
                      <span><strong>{kind}</strong><small>{asset?.label || "Still needed"}</small></span>
                      {asset?.value.startsWith("http") && <a href={asset.value} target="_blank" rel="noreferrer" aria-label={`Open ${asset.label}`}><ExternalLink size={13} /></a>}
                    </div>
                  );
                })}
              </div>
              {missingAssets.length > 0 && <p className="campaign-warning">{missingAssets.length} material {missingAssets.length === 1 ? "item needs" : "items need"} attention before broad outreach.</p>}
            </article>
          </div>

          <article className="panel campaign-shortlist">
            <div className="campaign-section-heading">
              <div><Target size={16} /><span><strong>Opportunity shortlist</strong><small>Ranked evidence and warm routes for this campaign</small></span></div>
              <button onClick={() => onNavigate("discover")}>Open Find Work <ArrowRight size={13} /></button>
            </div>
            <div className="campaign-shortlist-grid">
              {campaignOpportunities
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, 4)
                .map((opportunity) => (
                  <article key={opportunity.id}>
                    <div><span>{opportunity.type}</span><b>{opportunity.confidence}% fit</b></div>
                    <strong>{opportunity.title}</strong>
                    <small>{opportunity.location || opportunity.organisation}</small>
                    <p>{opportunity.nextAction}</p>
                  </article>
                ))}
              {!campaignOpportunities.length && (
                <button className="campaign-shortlist-empty" onClick={() => onNavigate("discover")}>
                  <Sparkles size={20} />
                  <span><strong>Find work for this campaign</strong><small>Find official opportunities and warm contacts without mixing projects.</small></span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
            {campaignContacts.length > 0 && (
              <div className="campaign-contact-strip">
                <span>People connected to this work</span>
                <div>
                  {campaignContacts.slice(0, 6).map((contact) => (
                    <span key={contact.id}><i>{(contact.full_name || contact.company).slice(0, 1)}</i>{contact.full_name || contact.company}</span>
                  ))}
                </div>
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}

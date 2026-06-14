"use client";

import {
  ArrowRight,
  CalendarClock,
  Check,
  Download,
  Edit3,
  Mail,
  MapPin,
  Music2,
  Route,
  Send,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { downloadFile } from "@/lib/csv";
import {
  buildLocalTourPlan,
  getAutomationPayloads,
  isTourFollowUpDue,
  tourStatuses,
  updateTourStatus,
} from "@/lib/tour-builder";
import {
  ArtistProfile,
  Contact,
  TourBrief,
  TourContactStatus,
  TourDraft,
  TourGoal,
  TourPlan,
  TourRecommendation,
} from "@/lib/types";

const TOUR_STORAGE_KEY = "jazz-network-navigator-tour-plan-v1";
const goals: TourGoal[] = ["Paid gigs", "Festivals", "Press", "Label meetings", "Networking"];

const emptyBrief: TourBrief = {
  name: "",
  locations: "",
  startDate: "",
  endDate: "",
  genre: "",
  goal: "Paid gigs",
  minimumFee: "",
  maxEmailsPerWeek: 8,
  notes: "",
};

function contactName(contact: Contact | undefined): string {
  return contact?.full_name || contact?.company || "Unknown contact";
}

function locationLabel(contact: Contact | undefined): string {
  if (!contact) return "Unknown location";
  return [contact.city, contact.country]
    .filter((value) => value && value !== "Unknown")
    .join(", ") || "Unknown location";
}

function statusClass(status: TourContactStatus): string {
  return status.toLowerCase().replace(/[^a-z]+/g, "-");
}

export default function TourBuilder({
  contacts,
  profile,
}: {
  contacts: Contact[];
  profile: ArtistProfile;
}) {
  const [brief, setBrief] = useState<TourBrief>(emptyBrief);
  const [plan, setPlan] = useState<TourPlan | null>(null);
  const [building, setBuilding] = useState(false);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(TOUR_STORAGE_KEY);
    if (!stored) {
      setBrief({
        ...emptyBrief,
        name: profile.projectName ? `${profile.projectName} tour` : "",
        locations: profile.baseCity,
        genre: profile.genres,
        minimumFee: profile.defaultFee,
        notes: profile.currentProject,
      });
      return;
    }
    try {
      const parsed = JSON.parse(stored) as TourPlan;
      setPlan(parsed);
      setBrief(parsed.brief);
    } catch {
      window.localStorage.removeItem(TOUR_STORAGE_KEY);
    }
  }, [profile]);

  useEffect(() => {
    if (plan) window.localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(plan));
  }, [plan]);

  const contactsById = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, contact])),
    [contacts],
  );

  const updateRecommendation = (
    contactId: string,
    updater: (recommendation: TourRecommendation) => TourRecommendation,
  ) => {
    setPlan((current) =>
      current
        ? {
            ...current,
            recommendations: current.recommendations.map((recommendation) =>
              recommendation.contactId === contactId ? updater(recommendation) : recommendation,
            ),
          }
        : current,
    );
  };

  const moveContact = (contactId: string, status: TourContactStatus) => {
    updateRecommendation(contactId, (recommendation) => updateTourStatus(recommendation, status));
  };

  const buildPlan = async () => {
    if (!brief.name.trim() || !brief.locations.trim()) {
      setMessage("Add a tour name and at least one city or country to get started.");
      return;
    }
    setMessage("");
    setBuilding(true);
    const localPlan = buildLocalTourPlan(brief, contacts);
    setPlan(localPlan);

    try {
      const recommendationBatches: TourRecommendation[][] = [];
      for (let index = 0; index < localPlan.recommendations.length; index += 6) {
        recommendationBatches.push(localPlan.recommendations.slice(index, index + 6));
      }
      const responses = await Promise.all(
        recommendationBatches.map(async (batch) => {
          const response = await fetch("/api/tour-outreach", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              brief,
              profile,
              contacts: batch.map((recommendation) => ({
                contact: contactsById.get(recommendation.contactId),
                why: recommendation.why,
                suggestedAction: recommendation.suggestedAction,
              })),
            }),
          });
          const data = (await response.json()) as {
            available?: boolean;
            drafts?: Array<TourDraft & { contactId: string }>;
          };
          return response.ok && data.available ? data.drafts || [] : [];
        }),
      );
      const aiDrafts = responses.flat();
      if (aiDrafts.length) {
        const drafts = new Map(aiDrafts.map((draft) => [draft.contactId, draft]));
        setPlan((current) =>
          current
            ? {
                ...current,
                recommendations: current.recommendations.map((recommendation) => {
                  const aiDraft = drafts.get(recommendation.contactId);
                  return aiDraft
                    ? { ...recommendation, draft: aiDraft, draftSource: "ai" }
                    : recommendation;
                }),
              }
            : current,
        );
        setMessage(
          aiDrafts.length === localPlan.recommendations.length
            ? "Your contact shortlist and AI outreach drafts are ready."
            : "Your plan is ready. AI enhanced the drafts it could, with private smart drafts for the rest.",
        );
      } else {
        setMessage("Your tour plan is ready with private, locally generated drafts.");
      }
    } catch {
      setMessage("Your tour plan is ready with private, locally generated drafts.");
    } finally {
      setBuilding(false);
    }
  };

  const summary = useMemo(() => {
    if (!plan) return null;
    const locationCounts = new Map<string, number>();
    plan.recommendations.forEach((recommendation) => {
      const location = locationLabel(contactsById.get(recommendation.contactId));
      locationCounts.set(location, (locationCounts.get(location) || 0) + 1);
    });
    return {
      recommended: plan.recommendations.length,
      drafts: plan.recommendations.filter((item) => item.status !== "Suggested").length,
      contacted: plan.recommendations.filter((item) =>
        ["Contacted", "Replied", "Interested", "Booked"].includes(item.status),
      ).length,
      followUps: plan.recommendations.filter(isTourFollowUpDue).length,
      strongest:
        [...locationCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "No location yet",
      top: [...plan.recommendations].sort((a, b) => b.score - a.score).slice(0, 5),
    };
  }, [plan, contactsById]);

  const grouped = useMemo(() => {
    if (!plan) return [];
    const groups = new Map<string, TourRecommendation[]>();
    plan.recommendations.forEach((recommendation) => {
      const location = locationLabel(contactsById.get(recommendation.contactId));
      groups.set(location, [...(groups.get(location) || []), recommendation]);
    });
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [plan, contactsById]);

  const dueFollowUps = plan?.recommendations.filter(isTourFollowUpDue) || [];

  const exportPack = () => {
    if (!plan) return;
    const automationPayload = getAutomationPayloads(plan, contacts);
    if (!automationPayload.length) {
      setMessage("Approve at least one draft before exporting the outreach pack.");
      return;
    }
    downloadFile(
      `${plan.brief.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "tour"}-outreach-pack.json`,
      JSON.stringify({ tour: plan.brief, automationPayload }, null, 2),
      "application/json",
    );
    setMessage(`Exported ${automationPayload.length} approved outreach draft${automationPayload.length === 1 ? "" : "s"}.`);
  };

  const startNewPlan = () => {
    window.localStorage.removeItem(TOUR_STORAGE_KEY);
    setPlan(null);
    setBrief(emptyBrief);
    setMessage("");
    setEditingId(null);
  };

  return (
    <section id="tour-builder" className="section-block tour-builder-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">AI Tour Builder</span>
          <h2>Tell us the tour. We’ll map the next moves.</h2>
          <p>Describe the run in plain language, review the shortlist, approve drafts, then stay on top of follow-ups.</p>
        </div>
        <span className="tour-safety"><Check size={14} /> Drafts only. Nothing is ever sent automatically.</span>
      </div>

      <div className="tour-flow">
        <span><strong>1</strong> Tell us your idea</span>
        <ArrowRight size={15} />
        <span><strong>2</strong> Review contacts</span>
        <ArrowRight size={15} />
        <span><strong>3</strong> Approve drafts</span>
        <ArrowRight size={15} />
        <span><strong>4</strong> Follow up</span>
      </div>

      <div className="tour-builder-layout">
        <article className="panel tour-form-card">
          <div className="tour-card-title">
            <span className="icon-box"><Route size={18} /></span>
            <div><strong>Your tour idea</strong><small>A rough plan is enough. You can edit everything later.</small></div>
          </div>
          <div className="form-grid two-col">
            <Field label="Tour name" value={brief.name} placeholder="Autumn Europe run" onChange={(name) => setBrief({ ...brief, name })} />
            <Field label="Countries or cities" value={brief.locations} placeholder="Berlin, Paris, Belgium" onChange={(locations) => setBrief({ ...brief, locations })} />
            <Field label="Start date" type="date" value={brief.startDate} onChange={(startDate) => setBrief({ ...brief, startDate })} />
            <Field label="End date" type="date" value={brief.endDate} onChange={(endDate) => setBrief({ ...brief, endDate })} />
            <Field label="Genre / style" value={brief.genre} placeholder="Contemporary jazz" onChange={(genre) => setBrief({ ...brief, genre })} />
            <label className="field">
              <span>Tour goal</span>
              <select value={brief.goal} onChange={(event) => setBrief({ ...brief, goal: event.target.value as TourGoal })}>
                {goals.map((goal) => <option key={goal}>{goal}</option>)}
              </select>
            </label>
            <Field label="Minimum fee" value={brief.minimumFee} placeholder="€750 or negotiable" onChange={(minimumFee) => setBrief({ ...brief, minimumFee })} />
            <Field label="Max outreach emails per week" type="number" value={String(brief.maxEmailsPerWeek)} onChange={(value) => setBrief({ ...brief, maxEmailsPerWeek: Math.max(1, Math.min(30, Number(value) || 1)) })} />
          </div>
          <label className="field">
            <span>Notes / extra context</span>
            <textarea rows={4} value={brief.notes} placeholder="We have a new live video, prefer Thursday to Sunday dates, and want warm introductions first." onChange={(event) => setBrief({ ...brief, notes: event.target.value })} />
          </label>
          {message && <div className="tour-message"><Sparkles size={14} /> {message}</div>}
          <button className="button button-primary tour-build-button" onClick={buildPlan} disabled={building}>
            <Sparkles size={18} /> {building ? "Building your tour plan…" : "Build My Tour Plan"}
          </button>
        </article>

        <article className="panel tour-helper-card">
          <span className="tour-helper-icon"><Music2 size={28} /></span>
          <span className="eyebrow">Your assistant is listening</span>
          <h3>What happens next?</h3>
          <p>We rank your existing contacts by location, relevance, relationship strength and timing.</p>
          <div className="tour-helper-list">
            <span><MapPin size={15} /> Best people in each place</span>
            <span><Mail size={15} /> First email and follow-up drafts</span>
            <span><Users size={15} /> A simple relationship board</span>
            <span><CalendarClock size={15} /> Follow-up reminders after 7 days</span>
          </div>
        </article>
      </div>

      {plan && summary && (
        <>
          <div className="tour-results-heading">
            <div>
              <span className="eyebrow">Your tour plan</span>
              <h3>{plan.brief.name}</h3>
              <p>{plan.brief.locations} · {plan.brief.goal} · {plan.brief.genre || "Style open"}</p>
            </div>
            <div className="tour-results-actions">
              <button className="button button-ghost" onClick={startNewPlan}><Route size={15} /> Start New Plan</button>
              <button className="button button-secondary" onClick={exportPack}><Download size={15} /> Export Outreach Pack</button>
            </div>
          </div>

          <div className="tour-summary-grid">
            <SummaryCard label="Recommended" value={summary.recommended} />
            <SummaryCard label="Drafts ready" value={summary.drafts} />
            <SummaryCard label="Contacted" value={summary.contacted} />
            <SummaryCard label="Needs follow-up" value={summary.followUps} />
            <SummaryCard label="Strongest place" value={summary.strongest} wide />
          </div>

          <article className="panel tour-top-priorities">
            <div className="tour-card-title">
              <span className="icon-box"><Sparkles size={18} /></span>
              <div><strong>Top 5 priority contacts</strong><small>Start here and stay within your weekly outreach limit.</small></div>
            </div>
            <div className="tour-priority-list">
              {summary.top.map((recommendation, index) => {
                const contact = contactsById.get(recommendation.contactId);
                return (
                  <button key={recommendation.contactId} onClick={() => document.getElementById(`tour-contact-${recommendation.contactId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>
                    <span>{index + 1}</span>
                    <div><strong>{contactName(contact)}</strong><small>{locationLabel(contact)} · {contact?.category}</small></div>
                    <b>{recommendation.score}</b>
                  </button>
                );
              })}
            </div>
          </article>

          {dueFollowUps.length > 0 && (
            <article className="panel tour-followups">
              <div className="tour-card-title">
                <span className="icon-box"><CalendarClock size={18} /></span>
                <div><strong>Needs Follow-Up</strong><small>These contacts reached their 7-day reminder.</small></div>
              </div>
              {dueFollowUps.map((recommendation) => {
                const contact = contactsById.get(recommendation.contactId);
                return (
                  <div className="tour-followup-row" key={recommendation.contactId}>
                    <div><strong>{contactName(contact)}</strong><small>Due {recommendation.followUpDate}</small></div>
                    <p>{recommendation.draft.followUpBody}</p>
                    <button className="button button-secondary" onClick={() => setEditingId(recommendation.contactId)}><Edit3 size={14} /> Review follow-up</button>
                  </div>
                );
              })}
            </article>
          )}

          <div className="tour-section-title">
            <span className="eyebrow">Recommended contacts</span>
            <h3>Strong matches, grouped by place.</h3>
          </div>
          <div className="tour-location-groups">
            {grouped.map(([location, recommendations]) => (
              <article className="tour-location-group" key={location}>
                <div className="tour-location-heading"><MapPin size={17} /><strong>{location}</strong><span>{recommendations.length}</span></div>
                <div className="tour-contact-grid">
                  {recommendations.map((recommendation) => (
                    <RecommendationCard
                      key={recommendation.contactId}
                      recommendation={recommendation}
                      contact={contactsById.get(recommendation.contactId)}
                      editing={editingId === recommendation.contactId}
                      onEdit={() => setEditingId(editingId === recommendation.contactId ? null : recommendation.contactId)}
                      onDraftChange={(draft) => updateRecommendation(recommendation.contactId, (current) => ({ ...current, draft }))}
                      onStatus={(status) => moveContact(recommendation.contactId, status)}
                    />
                  ))}
                </div>
              </article>
            ))}
          </div>

          <div className="tour-section-title">
            <span className="eyebrow">Tour CRM board</span>
            <h3>Move each relationship forward at your pace.</h3>
            <p>Drag cards between columns or use the status menu. “Contacted” means you sent it yourself outside this app.</p>
          </div>
          <div className="tour-kanban">
            {tourStatuses.map((status) => {
              const items = plan.recommendations.filter((item) => item.status === status);
              return (
                <article
                  className="tour-kanban-column"
                  key={status}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const contactId = event.dataTransfer.getData("text/plain");
                    if (contactId) moveContact(contactId, status);
                  }}
                >
                  <div className="tour-kanban-title"><i className={`tour-status-${statusClass(status)}`} /><strong>{status}</strong><span>{items.length}</span></div>
                  <div className="tour-kanban-cards">
                    {items.map((recommendation) => {
                      const contact = contactsById.get(recommendation.contactId);
                      return (
                        <div className="tour-kanban-card" draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", recommendation.contactId)} key={recommendation.contactId}>
                          <strong>{contactName(contact)}</strong>
                          <small>{locationLabel(contact)}</small>
                          <span>{recommendation.score} priority</span>
                          <select value={status} aria-label={`Status for ${contactName(contact)}`} onChange={(event) => moveContact(recommendation.contactId, event.target.value as TourContactStatus)}>
                            {tourStatuses.map((option) => <option key={option}>{option}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function RecommendationCard({
  recommendation,
  contact,
  editing,
  onEdit,
  onDraftChange,
  onStatus,
}: {
  recommendation: TourRecommendation;
  contact: Contact | undefined;
  editing: boolean;
  onEdit: () => void;
  onDraftChange: (draft: TourDraft) => void;
  onStatus: (status: TourContactStatus) => void;
}) {
  return (
    <article className="panel tour-contact-card" id={`tour-contact-${recommendation.contactId}`}>
      <div className="tour-contact-top">
        <span className="avatar">{contactName(contact).slice(0, 1)}</span>
        <div><strong>{contactName(contact)}</strong><small>{contact?.company || "Independent"} · {contact?.category}</small></div>
        <span className="tour-priority-score">{recommendation.score}<small>priority</small></span>
      </div>
      <div className="tour-contact-badges">
        <span>{contact?.relationship_temperature || "Cold"}</span>
        <span>{recommendation.status}</span>
        <span>{recommendation.draftSource === "ai" ? "AI draft" : "Smart draft"}</span>
      </div>
      <div className="tour-reason">
        <strong>Why this contact</strong>
        <p>{recommendation.why}</p>
      </div>
      <div className="tour-reason">
        <strong>Suggested action</strong>
        <p>{recommendation.suggestedAction}</p>
      </div>
      <div className="tour-draft-label"><Mail size={14} /><strong>Draft only</strong><span>Review before using</span></div>
      {editing ? (
        <div className="tour-draft-editor">
          <label><span>Subject</span><input value={recommendation.draft.subject} onChange={(event) => onDraftChange({ ...recommendation.draft, subject: event.target.value })} /></label>
          <label><span>First outreach email</span><textarea rows={10} value={recommendation.draft.body} onChange={(event) => onDraftChange({ ...recommendation.draft, body: event.target.value })} /></label>
          <label><span>Polite follow-up email</span><textarea rows={8} value={recommendation.draft.followUpBody} onChange={(event) => onDraftChange({ ...recommendation.draft, followUpBody: event.target.value })} /></label>
          <label><span>Why they are useful</span><textarea rows={3} value={recommendation.draft.usefulReason} onChange={(event) => onDraftChange({ ...recommendation.draft, usefulReason: event.target.value })} /></label>
        </div>
      ) : (
        <div className="tour-draft-preview">
          <strong>{recommendation.draft.subject}</strong>
          <p>{recommendation.draft.body}</p>
          <small>{recommendation.draft.usefulReason}</small>
        </div>
      )}
      {recommendation.followUpDate && (
        <div className="tour-followup-date"><CalendarClock size={13} /> Follow-up set for {recommendation.followUpDate}</div>
      )}
      <div className="tour-card-actions">
        <button className="button button-ghost" onClick={onEdit}>{editing ? <Check size={14} /> : <Edit3 size={14} />} {editing ? "Done" : "Edit"}</button>
        <button className="button button-secondary" onClick={() => onStatus("Approved")}><Check size={14} /> Approve</button>
        <button className="button button-ghost" onClick={() => onStatus("Not a Fit")}><X size={14} /> Skip</button>
        <button className="button button-primary" onClick={() => onStatus("Contacted")}><Send size={14} /> Mark as Contacted</button>
      </div>
      <span className="tour-never-sent">This app never sends email. “Contacted” is a record you control.</span>
    </article>
  );
}

function SummaryCard({ label, value, wide = false }: { label: string; value: string | number; wide?: boolean }) {
  return <article className={`panel tour-summary-card${wide ? " wide" : ""}`}><strong>{value}</strong><span>{label}</span></article>;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

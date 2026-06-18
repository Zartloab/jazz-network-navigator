"use client";

import {
  ArrowRight,
  CalendarClock,
  Check,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  MapPin,
  Plus,
  Route,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Dispatch, SetStateAction, useMemo, useState } from "react";
import {
  BOOKING_DEAL_COLUMNS,
  BOOKING_DEAL_LABELS,
  addDaysIso,
  createBookingDealFromContact,
  createBookingDealFromOpportunity,
  formatMoney,
  summarizeBookingDeals,
  todayIso,
} from "@/lib/booking-deals";
import {
  ActProfile,
  AppView,
  ArtistAsset,
  BookingDeal,
  BookingDealStatus,
  Campaign,
  Contact,
  ResearchOpportunity,
} from "@/lib/types";

function formatDate(value?: string): string {
  if (!value) return "Not set";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatPlace(deal: BookingDeal): string {
  return [deal.city, deal.country].filter(Boolean).join(", ") || "Place not set";
}

function statusTone(status: BookingDealStatus): string {
  if (status === "confirmed") return "confirmed";
  if (status === "passed") return "passed";
  if (status === "follow_up_due") return "due";
  if (status === "interested" || status === "negotiating") return "warm";
  if (status === "pitch_ready") return "ready";
  return "lead";
}

function updateForStatus(deal: BookingDeal, status: BookingDealStatus): BookingDeal {
  const next: BookingDeal = {
    ...deal,
    status,
    updatedAt: new Date().toISOString(),
  };
  if (status === "contacted" && !next.followUpDate) {
    next.followUpDate = addDaysIso(todayIso(), 7);
    next.nextStep = "Wait one week, then send a polite follow-up if there is no reply.";
  }
  if (status === "follow_up_due" && !next.followUpDate) {
    next.followUpDate = todayIso();
  }
  if (status === "confirmed") {
    next.confirmedValue = next.confirmedValue || next.targetFee || next.projectedValue || 0;
    next.nextStep = "Record the booking details, fee, calendar date, and any production needs.";
  }
  if (status === "passed") {
    next.projectedValue = 0;
    next.nextStep = "Keep the note for context, but stop chasing this for now.";
  }
  return next;
}

function DealCard({
  deal,
  campaign,
  contact,
  onStatus,
  onContacted,
}: {
  deal: BookingDeal;
  campaign?: Campaign;
  contact?: Contact;
  onStatus: (status: BookingDealStatus) => void;
  onContacted: () => void;
}) {
  const totalChecks = deal.missingMaterials.length + 6;
  const readyChecks = totalChecks - deal.missingMaterials.length;
  const readyPercent = Math.round((readyChecks / totalChecks) * 100);

  return (
    <article className={`booking-deal-card ${statusTone(deal.status)}`}>
      <div className="booking-deal-topline">
        <span>{deal.dealType}</span>
        <b>{deal.confidenceScore}% fit</b>
      </div>
      <h4>{deal.title}</h4>
      <p>{deal.organisation || contact?.company || campaign?.name || "Booking opportunity"}</p>
      <div className="booking-deal-meta">
        <span><MapPin size={12} />{formatPlace(deal)}</span>
        <span><CircleDollarSign size={12} />{formatMoney(deal.projectedValue || deal.targetFee || 0)}</span>
        <span><CalendarClock size={12} />{deal.followUpDate ? `Follow up ${formatDate(deal.followUpDate)}` : deal.dateWindow || "Date open"}</span>
      </div>

      <div className="pitch-readiness">
        <div>
          <strong>{deal.missingMaterials.length ? "Pitch nearly ready" : "Pitch ready"}</strong>
          <small>{readyPercent}% ready</small>
        </div>
        <span><i style={{ width: `${readyPercent}%` }} /></span>
      </div>

      {deal.missingMaterials.length > 0 ? (
        <div className="deal-missing">
          <FileCheck2 size={13} />
          <span>
            Add {deal.missingMaterials.slice(0, 2).join(" and ").toLowerCase()}
            {deal.missingMaterials.length > 2 ? ` + ${deal.missingMaterials.length - 2} more` : ""}.
          </span>
        </div>
      ) : (
        <div className="deal-ready"><Check size={13} />Ready to draft. Nothing will be sent automatically.</div>
      )}

      <div className="booking-next-step">
        <small>Next step</small>
        <strong>{deal.nextStep}</strong>
      </div>

      <div className="booking-deal-controls">
        <select value={deal.status} onChange={(event) => onStatus(event.target.value as BookingDealStatus)}>
          {BOOKING_DEAL_COLUMNS.map((column) => (
            <option value={column.status} key={column.status}>{column.label}</option>
          ))}
        </select>
        {deal.status !== "contacted" && deal.status !== "confirmed" && deal.status !== "passed" && (
          <button onClick={onContacted}>Mark contacted</button>
        )}
      </div>
    </article>
  );
}

export default function DealsWorkspace({
  deals,
  onDealsChange,
  contacts,
  campaigns,
  acts,
  assets,
  opportunities,
  onNavigate,
}: {
  deals: BookingDeal[];
  onDealsChange: Dispatch<SetStateAction<BookingDeal[]>>;
  contacts: Contact[];
  campaigns: Campaign[];
  acts: ActProfile[];
  assets: ArtistAsset[];
  opportunities: ResearchOpportunity[];
  onNavigate: (view: AppView) => void;
}) {
  const [message, setMessage] = useState("");
  const summary = useMemo(() => summarizeBookingDeals(deals, campaigns), [campaigns, deals]);
  const activeCampaign = campaigns.find((campaign) => campaign.status === "Active") || campaigns[0];
  const activeAct = activeCampaign ? acts.find((act) => act.id === activeCampaign.actId) : undefined;
  const activeDealIds = new Set(deals.map((deal) => deal.opportunityId || deal.contactId || deal.id));

  const setDealStatus = (dealId: string, status: BookingDealStatus) => {
    onDealsChange((current) =>
      current.map((deal) => (deal.id === dealId ? updateForStatus(deal, status) : deal)),
    );
  };

  const addBestOpportunity = () => {
    if (!activeCampaign) return;
    const best = opportunities
      .filter((opportunity) => opportunity.status !== "Dismissed" && !activeDealIds.has(opportunity.id))
      .sort((a, b) => b.confidence - a.confidence)[0];
    if (!best) {
      setMessage("No unused opportunity is waiting. Open Find Work to scout more options.");
      return;
    }
    onDealsChange((current) => [
      createBookingDealFromOpportunity({
        opportunity: best,
        campaign: activeCampaign,
        act: activeAct,
        assets,
        contacts,
      }),
      ...current,
    ]);
    setMessage(`Added ${best.title} to Deals.`);
  };

  const addWarmContact = () => {
    if (!activeCampaign) return;
    const best = contacts
      .filter((contact) => !activeDealIds.has(contact.id))
      .sort((a, b) => {
        const tempA = a.relationship_temperature === "Hot" ? 20 : a.relationship_temperature === "Warm" ? 10 : 0;
        const tempB = b.relationship_temperature === "Hot" ? 20 : b.relationship_temperature === "Warm" ? 10 : 0;
        return b.relationship_score + tempB - (a.relationship_score + tempA);
      })[0];
    if (!best) {
      setMessage("No unused warm contact is waiting.");
      return;
    }
    onDealsChange((current) => [
      createBookingDealFromContact({
        contact: best,
        campaign: activeCampaign,
        act: activeAct,
        assets,
      }),
      ...current,
    ]);
    setMessage(`Added ${best.full_name || best.company} to Deals.`);
  };

  const mostImportant = summary.mostImportantDeal;

  return (
    <section className="deals-workspace">
      <div className="deals-intro">
        <div>
          <span className="eyebrow">Booking pipeline</span>
          <h2>Turn opportunities into booked work.</h2>
          <p>
            Track the gig, the person, the fee, the next step, and whether the pitch is actually ready.
          </p>
        </div>
        <div className="deals-safety"><Check size={14} />Drafts only. Nothing is ever sent automatically.</div>
      </div>

      <div className="booking-money-grid">
        <article><CircleDollarSign size={18} /><span><strong>{formatMoney(summary.confirmedIncome)}</strong><small>Confirmed income</small></span></article>
        <article><Sparkles size={18} /><span><strong>{formatMoney(summary.projectedIncome)}</strong><small>Projected income</small></span></article>
        <article><Target size={18} /><span><strong>{formatMoney(summary.openDealValue)}</strong><small>Open deal value</small></span></article>
        <article><Clock3 size={18} /><span><strong>{summary.followUpsDue}</strong><small>Follow-ups due</small></span></article>
        <article><Route size={18} /><span><strong>{summary.routeGaps.length}</strong><small>Route gaps</small></span></article>
      </div>

      <div className="deals-command-row">
        <article className="panel booking-next-card">
          <span><Target size={18} /></span>
          <div>
            <small>Most important booking move today</small>
            <strong>{mostImportant ? mostImportant.title : "Create the first booking deal"}</strong>
            <p>{mostImportant ? mostImportant.nextStep : "Start by adding the strongest opportunity or warmest contact to the pipeline."}</p>
          </div>
          {mostImportant ? (
            <button className="button button-primary" onClick={() => setDealStatus(mostImportant.id, "contacted")}>
              Mark contacted <ArrowRight size={13} />
            </button>
          ) : (
            <button className="button button-primary" onClick={addBestOpportunity}>
              Add best opportunity <ArrowRight size={13} />
            </button>
          )}
        </article>

        <article className="panel booking-create-card">
          <strong>Create a deal</strong>
          <p>Add one practical booking target from the strongest things already in the app.</p>
          <div>
            <button onClick={addBestOpportunity}><Plus size={13} /> Best opportunity</button>
            <button onClick={addWarmContact}><Users size={13} /> Warm contact</button>
            <button onClick={() => onNavigate("discover")}><Sparkles size={13} /> Find work</button>
          </div>
          {message && <small>{message}</small>}
        </article>
      </div>

      <div className="deals-layout">
        <aside className="deals-side-panel">
          <article className="panel">
            <div className="deals-side-heading">
              <span><CircleDollarSign size={15} /></span>
              <strong>Highest-value active deals</strong>
            </div>
            <div className="deal-priority-list">
              {summary.highestValueDeals.map((deal) => (
                <button key={deal.id} onClick={() => setDealStatus(deal.id, deal.status === "lead" ? "pitch_ready" : deal.status)}>
                  <span>{BOOKING_DEAL_LABELS[deal.status]}</span>
                  <strong>{deal.title}</strong>
                  <small>{formatMoney(deal.projectedValue || deal.targetFee || 0)} · {formatPlace(deal)}</small>
                </button>
              ))}
              {!summary.highestValueDeals.length && <p>No active deal value yet. Add one warm opportunity to begin.</p>}
            </div>
          </article>

          <article className="panel">
            <div className="deals-side-heading">
              <span><Route size={15} /></span>
              <strong>Route gaps</strong>
            </div>
            <div className="route-gap-list">
              {summary.routeGaps.slice(0, 5).map((gap) => (
                <div key={gap.id}>
                  <strong>{gap.city || "Open window"}</strong>
                  <small>{formatDate(gap.startDate)} - {formatDate(gap.endDate)}</small>
                </div>
              ))}
              {!summary.routeGaps.length && <p>No obvious unfilled route window.</p>}
            </div>
          </article>
        </aside>

        <div className="booking-pipeline" aria-label="Booking pipeline">
          {BOOKING_DEAL_COLUMNS.map((column) => {
            const columnDeals = deals.filter((deal) => deal.status === column.status);
            return (
              <section className="booking-column" key={column.status}>
                <div className="booking-column-heading">
                  <span><strong>{column.label}</strong><small>{column.helper}</small></span>
                  <b>{columnDeals.length}</b>
                </div>
                <div className="booking-column-cards">
                  {columnDeals.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      campaign={campaigns.find((campaign) => campaign.id === deal.campaignId)}
                      contact={contacts.find((contact) => contact.id === deal.contactId)}
                      onStatus={(status) => setDealStatus(deal.id, status)}
                      onContacted={() => setDealStatus(deal.id, "contacted")}
                    />
                  ))}
                  {!columnDeals.length && (
                    <div className="booking-column-empty">No deals here yet.</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}

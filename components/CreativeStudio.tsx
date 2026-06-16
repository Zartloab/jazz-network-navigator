"use client";

import {
  ArrowRight,
  Check,
  Copy,
  FileText,
  History,
  Lightbulb,
  MessageSquareText,
  PenLine,
  Sparkles,
  Target,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  generateLocalCreativePack,
  profileCompleteness,
} from "@/lib/creative-studio";
import {
  ActProfile,
  ArtistAsset,
  ArtistProfile,
  ArtistWorkspace,
  Campaign,
  CreativeBrief,
  CreativeGoal,
  CreativePack,
} from "@/lib/types";
import { actToArtistProfile } from "@/lib/hamed-portfolio";

const PACK_STORAGE_KEY = "jazz-network-navigator-creative-packs-v1";

const goals: CreativeGoal[] = [
  "Booking pitch",
  "Festival application",
  "Press story",
  "Release campaign",
  "Collaboration idea",
  "Composer commission",
  "Funding introduction",
];

const defaultBrief: CreativeBrief = {
  goal: "Booking pitch",
  audience: "",
  tone: "Warm",
  context: "",
};

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button className="studio-copy" onClick={copy}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied" : label}
    </button>
  );
}

function TextAsset({
  label,
  value,
  large = false,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  return (
    <article className={`studio-asset${large ? " large" : ""}`}>
      <div><span>{label}</span><CopyButton value={value} /></div>
      <p>{value}</p>
    </article>
  );
}

export default function CreativeStudio({
  profile,
  workspace,
  acts,
  assets,
  campaigns,
  onOpenProfile,
}: {
  profile: ArtistProfile;
  workspace: ArtistWorkspace;
  acts: ActProfile[];
  assets: ArtistAsset[];
  campaigns: Campaign[];
  onOpenProfile: () => void;
}) {
  const initialCampaignId =
    campaigns.find((campaign) => campaign.status === "Active")?.id ||
    campaigns[0]?.id ||
    "";
  const [campaignId, setCampaignId] = useState(initialCampaignId);
  const [brief, setBrief] = useState<CreativeBrief>(defaultBrief);
  const [packs, setPacks] = useState<CreativePack[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const campaign = campaigns.find((item) => item.id === campaignId) || campaigns[0];
  const act = campaign ? acts.find((item) => item.id === campaign.actId) : undefined;
  const activeProfile =
    campaign && act ? actToArtistProfile(workspace, act, campaign, assets) : profile;
  const completeness = profileCompleteness(activeProfile);
  const selectedPack = packs.find((pack) => pack.id === selectedId) || packs[0] || null;

  useEffect(() => {
    const stored = window.localStorage.getItem(PACK_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CreativePack[];
        setPacks(parsed);
        setSelectedId(parsed[0]?.id || "");
      } catch {
        window.localStorage.removeItem(PACK_STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(PACK_STORAGE_KEY, JSON.stringify(packs));
  }, [hydrated, packs]);

  const completePackText = useMemo(() => {
    if (!selectedPack) return "";
    return [
      selectedPack.title,
      `One-liner\n${selectedPack.oneLiner}`,
      `Subject line\n${selectedPack.subjectLine}`,
      `Short pitch\n${selectedPack.shortPitch}`,
      `Long pitch\n${selectedPack.longPitch}`,
      `Story angles\n${selectedPack.storyAngles.map((item) => `- ${item}`).join("\n")}`,
      `Calls to action\n${selectedPack.callsToAction.map((item) => `- ${item}`).join("\n")}`,
      `Content ideas\n${selectedPack.contentIdeas.map((item) => `- ${item}`).join("\n")}`,
    ].join("\n\n");
  }, [selectedPack]);

  const generate = async () => {
    if (!campaign || !act) {
      setMessage("Choose a campaign before creating a draft kit.");
      return;
    }
    if (!campaign.confirmed || !act.confirmed) {
      setMessage("Review and confirm the act and campaign facts in Setup before generating outreach.");
      return;
    }
    const campaignBrief = {
      ...brief,
      campaignId: campaign.id,
      actId: act.id,
      context: [brief.context, campaign.goal, campaign.notes].filter(Boolean).join(" "),
    };
    const localPack = generateLocalCreativePack(activeProfile, campaignBrief);
    setPacks((current) => [localPack, ...current].slice(0, 6));
    setSelectedId(localPack.id);
    setLoading(true);
    setMessage("A usable local draft is ready. Checking whether AI can sharpen it...");

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 22_000);
      const response = await fetch("/api/creative-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          profile: activeProfile,
          brief: campaignBrief,
          act,
          campaign,
          assets: assets.filter((asset) => asset.actId === act.id && asset.verified),
        }),
      });
      window.clearTimeout(timeout);
      const payload = (await response.json()) as {
        available?: boolean;
        pack?: CreativePack;
        error?: string;
        budgetBlocked?: boolean;
      };
      if (response.ok && payload.pack) {
        setPacks((current) => [payload.pack!, ...current.filter((pack) => pack.id !== localPack.id)].slice(0, 6));
        setSelectedId(payload.pack.id);
        setMessage("AI draft ready. Everything remains editable and nothing has been sent.");
      } else {
        setMessage(
          payload.budgetBlocked
            ? "The monthly AI limit has been reached. Your local draft is ready and no paid request was made."
            : payload.error
              ? `${payload.error} The local draft is ready.`
              : "Local draft ready. Add an OpenAI key for an AI refinement.",
        );
      }
    } catch {
      setMessage("AI refinement is unavailable right now. The local draft is ready.");
    } finally {
      setLoading(false);
    }
  };

  const removeSelectedPack = () => {
    if (!selectedPack) return;
    setPacks((current) => {
      const remaining = current.filter((pack) => pack.id !== selectedPack.id);
      setSelectedId(remaining[0]?.id || "");
      return remaining;
    });
    setMessage("");
  };

  const updateSelectedPack = (patch: Partial<CreativePack>) => {
    if (!selectedPack) return;
    setPacks((current) =>
      current.map((pack) => pack.id === selectedPack.id ? { ...pack, ...patch } : pack),
    );
  };

  const createGmailDraft = async () => {
    if (!selectedPack || selectedPack.approvalStatus !== "Approved") return;
    setLoading(true);
    setMessage("Creating a Gmail draft through the approved automation...");
    try {
      const response = await fetch("/api/automation/gmail-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved: true,
          campaignId: selectedPack.campaignId,
          actId: selectedPack.actId,
          subject: selectedPack.subjectLine,
          body: selectedPack.longPitch,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The Gmail draft could not be created.");
      updateSelectedPack({ gmailDraftId: payload.gmailDraftId });
      setMessage("Gmail draft created. It has not been sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The Gmail draft could not be created.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="creative-studio-workspace">
      <div className="studio-intro">
        <div>
          <span className="eyebrow">Pitch Room</span>
          <h2>Turn your project into material people can use.</h2>
          <p>Create a focused pitch kit without starting from a blank page. Every result is a draft.</p>
        </div>
        <div className="studio-profile-status">
          <div><span style={{ width: `${completeness}%` }} /></div>
          <strong>{completeness}% profile complete</strong>
          <button onClick={onOpenProfile}>{completeness < 75 ? "Improve profile" : "Edit profile"} <ArrowRight size={12} /></button>
        </div>
      </div>

      <div className="studio-layout">
        <aside className="panel studio-brief">
          <div className="studio-panel-heading">
            <span><WandSparkles size={19} /></span>
            <div><strong>What are you making?</strong><small>Choose one useful output.</small></div>
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
          {campaign && act && (
            <div className={`studio-campaign-context${campaign.confirmed && act.confirmed ? " confirmed" : ""}`}>
              <span>{campaign.confirmed && act.confirmed ? <Check size={13} /> : <FileText size={13} />}{act.name}</span>
              <p>{campaign.goal}</p>
              {(!campaign.confirmed || !act.confirmed) && <small>Confirm the website-sourced facts in Setup before generating.</small>}
            </div>
          )}
          <label>
            <span>Type of kit</span>
            <select value={brief.goal} onChange={(event) => setBrief({ ...brief, goal: event.target.value as CreativeGoal })}>
              {goals.map((goal) => <option key={goal}>{goal}</option>)}
            </select>
          </label>
          <label>
            <span>Who is it for?</span>
            <input
              value={brief.audience}
              onChange={(event) => setBrief({ ...brief, audience: event.target.value })}
              placeholder="e.g. a 300-cap venue, jazz media, a label"
            />
          </label>
          <div className="studio-tone-field">
            <span>Tone</span>
            <div>
              {(["Warm", "Direct", "Bold", "Thoughtful"] as const).map((tone) => (
                <button key={tone} className={brief.tone === tone ? "active" : ""} onClick={() => setBrief({ ...brief, tone })}>{tone}</button>
              ))}
            </div>
          </div>
          <label>
            <span>Anything specific?</span>
            <textarea
              rows={5}
              value={brief.context}
              onChange={(event) => setBrief({ ...brief, context: event.target.value })}
              placeholder="A deadline, new release, event, collaboration, or detail to emphasise..."
            />
          </label>
          <button className="button button-primary studio-generate" onClick={generate} disabled={loading}>
            <Sparkles size={16} /> {loading ? "Improving your draft..." : "Create My Draft Kit"}
          </button>
          <div className="studio-safety"><Check size={13} /><span>Drafts only. Facts are limited to your saved profile.</span></div>
        </aside>

        <div className="studio-output">
          {message && <div className="studio-message"><Lightbulb size={14} /><span>{message}</span></div>}
          {selectedPack ? (
            <>
              <div className="studio-output-heading">
                <div>
                  <span className={`source-pill ${selectedPack.source === "ai" ? "web" : "network"}`}>
                    {selectedPack.source === "ai" ? <Sparkles size={12} /> : <PenLine size={12} />}
                    {selectedPack.source === "ai" ? "AI-refined draft" : "Local draft"}
                  </span>
                  <h3>{selectedPack.title}</h3>
                  <p>{selectedPack.goal} · created {new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(selectedPack.createdAt))}</p>
                </div>
                <div className="studio-output-actions">
                  {selectedPack.approvalStatus !== "Approved" ? (
                    <button className="studio-approve" onClick={() => {
                      updateSelectedPack({ approvalStatus: "Approved" });
                      setMessage("Draft approved. Nothing has been sent.");
                    }}><Check size={13} /> Approve draft</button>
                  ) : selectedPack.gmailDraftId ? (
                    <span className="studio-approved"><Check size={13} /> Gmail draft created, not sent</span>
                  ) : (
                    <button className="studio-approve" onClick={createGmailDraft} disabled={loading}><FileText size={13} /> Create Gmail draft</button>
                  )}
                  <CopyButton value={completePackText} label="Copy complete kit" />
                  <button className="studio-delete" onClick={removeSelectedPack}><Trash2 size={13} /> Delete draft</button>
                </div>
              </div>
              <div className="studio-primary-assets">
                <TextAsset label="One-line pitch" value={selectedPack.oneLiner} />
                <TextAsset label="Subject line" value={selectedPack.subjectLine} />
                <TextAsset label="Short pitch" value={selectedPack.shortPitch} large />
                <TextAsset label="Long pitch" value={selectedPack.longPitch} large />
              </div>
              <div className="studio-idea-grid">
                <IdeaList icon={MessageSquareText} title="Story angles" items={selectedPack.storyAngles} />
                <IdeaList icon={Target} title="Calls to action" items={selectedPack.callsToAction} />
                <IdeaList icon={Lightbulb} title="Content ideas" items={selectedPack.contentIdeas} />
              </div>
            </>
          ) : (
            <div className="panel studio-empty">
              <span><FileText size={25} /></span>
              <h3>Your first draft kit starts here.</h3>
              <p>Choose an output on the left. You will get practical copy, story angles, calls to action, and content ideas.</p>
              {completeness < 25 && <button className="button button-secondary" onClick={onOpenProfile}>Add your artist profile first</button>}
            </div>
          )}
        </div>

        {packs.length > 1 && (
          <aside className="panel studio-history">
            <div><History size={15} /><strong>Recent kits</strong></div>
            {packs.map((pack) => (
              <button key={pack.id} className={pack.id === selectedPack?.id ? "active" : ""} onClick={() => setSelectedId(pack.id)}>
                <span>{pack.title}</span><small>{pack.source === "ai" ? "AI draft" : "Local draft"}</small>
              </button>
            ))}
          </aside>
        )}
      </div>
    </section>
  );
}

function IdeaList({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof Lightbulb;
  title: string;
  items: string[];
}) {
  return (
    <article className="panel studio-idea-list">
      <div><Icon size={15} /><strong>{title}</strong></div>
      <ol>
        {items.map((item, index) => (
          <li key={`${title}-${index}`}><span>{index + 1}</span><p>{item}</p><CopyButton value={item} /></li>
        ))}
      </ol>
    </article>
  );
}

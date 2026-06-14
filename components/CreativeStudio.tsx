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
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  generateLocalCreativePack,
  profileCompleteness,
} from "@/lib/creative-studio";
import {
  ArtistProfile,
  CreativeBrief,
  CreativeGoal,
  CreativePack,
} from "@/lib/types";

const PACK_STORAGE_KEY = "jazz-network-navigator-creative-packs-v1";

const goals: CreativeGoal[] = [
  "Booking pitch",
  "Festival application",
  "Press story",
  "Release campaign",
  "Collaboration idea",
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
  onOpenProfile,
}: {
  profile: ArtistProfile;
  onOpenProfile: () => void;
}) {
  const [brief, setBrief] = useState<CreativeBrief>(defaultBrief);
  const [packs, setPacks] = useState<CreativePack[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const completeness = profileCompleteness(profile);
  const selectedPack = packs.find((pack) => pack.id === selectedId) || packs[0] || null;

  useEffect(() => {
    const stored = window.localStorage.getItem(PACK_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as CreativePack[];
      setPacks(parsed);
      setSelectedId(parsed[0]?.id || "");
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
    const localPack = generateLocalCreativePack(profile, brief);
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
        body: JSON.stringify({ profile, brief }),
      });
      window.clearTimeout(timeout);
      const payload = (await response.json()) as {
        available?: boolean;
        pack?: CreativePack;
        error?: string;
      };
      if (response.ok && payload.pack) {
        setPacks((current) => [payload.pack!, ...current.filter((pack) => pack.id !== localPack.id)].slice(0, 6));
        setSelectedId(payload.pack.id);
        setMessage("AI draft ready. Everything remains editable and nothing has been sent.");
      } else {
        setMessage(payload.error ? `${payload.error} The local draft is ready.` : "Local draft ready. Add an OpenAI key for an AI refinement.");
      }
    } catch {
      setMessage("AI refinement is unavailable right now. The local draft is ready.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="creative-studio-workspace">
      <div className="studio-intro">
        <div>
          <span className="eyebrow">AI Creative Studio</span>
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
                <CopyButton value={completePackText} label="Copy complete kit" />
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

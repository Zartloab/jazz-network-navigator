"use client";

import {
  Check,
  FileText,
  Link as LinkIcon,
  MapPin,
  Music2,
  UserRound,
} from "lucide-react";
import { profileCompleteness } from "@/lib/creative-studio";
import { ArtistProfile } from "@/lib/types";

function ProfileField({
  label,
  value,
  placeholder,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className={multiline ? "profile-field wide" : "profile-field"}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

export default function ArtistProfileEditor({
  profile,
  onChange,
}: {
  profile: ArtistProfile;
  onChange: (profile: ArtistProfile) => void;
}) {
  const completeness = profileCompleteness(profile);
  const update = (field: keyof ArtistProfile, value: string) =>
    onChange({ ...profile, [field]: value });

  return (
    <section className="panel artist-profile-card">
      <div className="artist-profile-heading">
        <div>
          <span className="icon-box"><UserRound size={18} /></span>
          <div>
            <span className="eyebrow">Your artist profile</span>
            <h2>Give the assistant the right context once.</h2>
            <p>Tour plans, research, drafts, and creative tools can reuse this information.</p>
          </div>
        </div>
        <div className="profile-completeness">
          <div><span style={{ width: `${completeness}%` }} /></div>
          <strong>{completeness}% ready</strong>
          <small><Check size={11} /> Saved automatically</small>
        </div>
      </div>

      <div className="profile-section-label"><Music2 size={14} /><span>Identity and positioning</span></div>
      <div className="profile-form-grid">
        <ProfileField label="Artist name" value={profile.artistName} placeholder="Your artist name" onChange={(value) => update("artistName", value)} />
        <ProfileField label="Project name" value={profile.projectName} placeholder="Band, ensemble, or project" onChange={(value) => update("projectName", value)} />
        <ProfileField label="Base city" value={profile.baseCity} placeholder="e.g. Sydney, Berlin" onChange={(value) => update("baseCity", value)} />
        <ProfileField label="Genre / style" value={profile.genres} placeholder="e.g. contemporary jazz, oud, electronics" onChange={(value) => update("genres", value)} />
        <ProfileField label="One-line pitch" value={profile.oneLinePitch} placeholder="What makes the project distinct in one sentence?" onChange={(value) => update("oneLinePitch", value)} multiline />
        <ProfileField label="Short bio" value={profile.shortBio} placeholder="A factual, editable paragraph about the artist and work" onChange={(value) => update("shortBio", value)} multiline />
        <ProfileField label="Current project or release" value={profile.currentProject} placeholder="What are you actively promoting?" onChange={(value) => update("currentProject", value)} multiline />
        <ProfileField label="Current goals" value={profile.careerGoals} placeholder="Touring, festivals, press, label, funding..." onChange={(value) => update("careerGoals", value)} multiline />
      </div>

      <div className="profile-section-label"><LinkIcon size={14} /><span>Useful materials</span></div>
      <div className="profile-form-grid">
        <ProfileField label="Website" value={profile.websiteUrl} placeholder="https://..." onChange={(value) => update("websiteUrl", value)} />
        <ProfileField label="Music link" value={profile.musicUrl} placeholder="Streaming or private listening link" onChange={(value) => update("musicUrl", value)} />
        <ProfileField label="Live video" value={profile.liveVideoUrl} placeholder="Your strongest live video" onChange={(value) => update("liveVideoUrl", value)} />
        <ProfileField label="Press kit / EPK" value={profile.pressKitUrl} placeholder="EPK or downloadable materials" onChange={(value) => update("pressKitUrl", value)} />
        <ProfileField label="Email signature name" value={profile.signatureName} placeholder="How drafts should be signed" onChange={(value) => update("signatureName", value)} />
        <ProfileField label="Typical minimum fee" value={profile.defaultFee} placeholder="e.g. €1,000 plus travel" onChange={(value) => update("defaultFee", value)} />
      </div>

      <div className="profile-privacy-note">
        <FileText size={14} />
        <span>This profile stays in this browser. Only a requested AI generation sends these fields to the configured OpenAI API.</span>
      </div>
    </section>
  );
}

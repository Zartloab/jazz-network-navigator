import {
  ArtistProfile,
  CreativeBrief,
  CreativePack,
} from "@/lib/types";

export const emptyArtistProfile: ArtistProfile = {
  artistName: "",
  projectName: "",
  baseCity: "",
  genres: "",
  oneLinePitch: "",
  shortBio: "",
  currentProject: "",
  careerGoals: "",
  websiteUrl: "",
  musicUrl: "",
  liveVideoUrl: "",
  pressKitUrl: "",
  signatureName: "",
  defaultFee: "",
};

export function profileCompleteness(profile: ArtistProfile): number {
  const important = [
    profile.artistName || profile.projectName,
    profile.baseCity,
    profile.genres,
    profile.oneLinePitch,
    profile.shortBio,
    profile.currentProject,
    profile.musicUrl,
    profile.liveVideoUrl,
  ];
  return Math.round((important.filter((value) => value.trim()).length / important.length) * 100);
}

function projectName(profile: ArtistProfile): string {
  return profile.projectName || profile.artistName || "The project";
}

function basePitch(profile: ArtistProfile): string {
  if (profile.oneLinePitch) return profile.oneLinePitch;
  const name = projectName(profile);
  const genre = profile.genres || "independent music";
  const location = profile.baseCity ? ` from ${profile.baseCity}` : "";
  return `${name} is a ${genre} project${location}.`;
}

function goalCopy(brief: CreativeBrief, profile: ArtistProfile) {
  const name = projectName(profile);
  const project = profile.currentProject || "the current live project";
  const audience = brief.audience || "the right music-industry partner";
  const copy = {
    "Booking pitch": {
      title: `${name} live booking kit`,
      subject: `${name}: live programming idea`,
      short: `${basePitch(profile)} The current live set centres on ${project} and could be a strong fit for ${audience}.`,
      action: "Would it be useful if I sent one live video and a short availability window?",
    },
    "Festival application": {
      title: `${name} festival application kit`,
      subject: `${name}: festival proposal`,
      short: `${basePitch(profile)} The festival proposal is built around ${project}, with a clear live arc and room for the audience to discover something distinct.`,
      action: "May I send the concise artistic proposal, live video, and technical overview?",
    },
    "Press story": {
      title: `${name} press story kit`,
      subject: `${name}: a timely story and listening angle`,
      short: `${basePitch(profile)} The timely hook is ${project}, supported by the artist’s wider story and current direction.`,
      action: "Would a private listen and a short interview outline be useful?",
    },
    "Release campaign": {
      title: `${name} release campaign kit`,
      subject: `${name}: release campaign direction`,
      short: `${basePitch(profile)} This campaign gives ${project} one recognisable story across press, live moments, and direct audience communication.`,
      action: "Which part of the campaign should we turn into the first concrete asset?",
    },
    "Collaboration idea": {
      title: `${name} collaboration concept`,
      subject: `${name}: a focused collaboration idea`,
      short: `${basePitch(profile)} The collaboration would connect ${project} with ${audience} around a specific creative exchange rather than a vague networking ask.`,
      action: "Would you be open to a short conversation to test the creative fit?",
    },
  } satisfies Record<CreativeBrief["goal"], {
    title: string;
    subject: string;
    short: string;
    action: string;
  }>;
  return copy[brief.goal];
}

export function generateLocalCreativePack(
  profile: ArtistProfile,
  brief: CreativeBrief,
): CreativePack {
  const copy = goalCopy(brief, profile);
  const name = projectName(profile);
  const context = brief.context ? ` ${brief.context.trim()}` : "";
  const bio = profile.shortBio || basePitch(profile);
  const project = profile.currentProject || "the current project";

  return {
    id: `CREATIVE-${Date.now()}`,
    createdAt: new Date().toISOString(),
    source: "local",
    goal: brief.goal,
    title: copy.title,
    oneLiner: basePitch(profile),
    subjectLine: copy.subject,
    shortPitch: `${copy.short}${context}`,
    longPitch: `${bio}\n\nThe immediate focus is ${project}.${context}\n\n${copy.action}`,
    storyAngles: [
      `The creative idea behind ${project}`,
      `${name}${profile.baseCity ? ` and the scene around ${profile.baseCity}` : ""}`,
      `How the live experience turns the project into something audiences can feel`,
    ],
    callsToAction: [
      copy.action,
      "Would a short call next week be useful?",
      "I can send the smallest useful version of the materials first.",
    ],
    contentIdeas: [
      `A 30-second explanation of the central idea behind ${project}`,
      "A live-performance moment paired with one sentence of context",
      "A short behind-the-scenes note about a decision that shaped the work",
    ],
  };
}

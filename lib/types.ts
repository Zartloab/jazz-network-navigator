export type Priority = "High" | "Medium" | "Low";
export type Temperature = "Hot" | "Warm" | "Cooling" | "Cold";

export type Contact = {
  id: string;
  source_type: string;
  is_dummy: "TRUE" | "FALSE";
  full_name: string;
  first_name: string;
  last_name: string;
  position: string;
  email: string;
  company: string;
  city: string;
  country: string;
  lat: number | "";
  lng: number | "";
  category: string;
  address: string;
  notes: string;
  latest_interaction: string;
  relationship_stage: string;
  relationship_score: number;
  priority: Priority;
  relationship_temperature: Temperature;
  opportunity_summary: string;
  recommended_next_action: string;
  last_contact_date: string;
  next_follow_up_date: string;
  tags: string;
  introduced_by: string;
  connected_to: string;
  make_automation_status: string;
  ai_summary: string;
};

export type ContactActivityKind =
  | "note"
  | "relationship"
  | "follow-up"
  | "project"
  | "enrichment";

export type ContactActivity = {
  id: string;
  contactId: string;
  kind: ContactActivityKind;
  title: string;
  detail: string;
  createdAt: string;
};

export type RelationshipNoteSuggestion = {
  stage: string;
  followUpDate: string;
  nextAction: string;
  reason: string;
};

export type EmailIntent =
  | "Follow up after meeting"
  | "Send music / EPK"
  | "Ask for introduction"
  | "Ask about venue dates"
  | "Label/release pitch"
  | "Press/radio pitch";

export type EmailDraft = {
  subject: string;
  body: string;
  cta: string;
};

export type TourGoal =
  | "Paid gigs"
  | "Festivals"
  | "Press"
  | "Label meetings"
  | "Networking";

export type TourContactStatus =
  | "Suggested"
  | "Drafted"
  | "Approved"
  | "Contacted"
  | "Replied"
  | "Interested"
  | "Booked"
  | "Not a Fit";

export type TourBrief = {
  name: string;
  locations: string;
  startDate: string;
  endDate: string;
  genre: string;
  goal: TourGoal;
  minimumFee: string;
  maxEmailsPerWeek: number;
  notes: string;
};

export type TourDraft = {
  subject: string;
  body: string;
  followUpBody: string;
  usefulReason: string;
};

export type TourRecommendation = {
  contactId: string;
  score: number;
  why: string;
  suggestedAction: string;
  status: TourContactStatus;
  draft: TourDraft;
  draftSource: "local" | "ai";
  followUpDate: string;
  approvedAt: string;
  contactedAt: string;
};

export type TourPlan = {
  id: string;
  createdAt: string;
  brief: TourBrief;
  recommendations: TourRecommendation[];
};

export type AutomationPayload = {
  tour_id: string;
  contact_id: string;
  contact_name: string;
  email: string;
  subject: string;
  body: string;
  follow_up_date: string;
  status: TourContactStatus;
};

export type AppView =
  | "home"
  | "deals"
  | "work"
  | "relationships"
  | "calendar"
  | "discover"
  | "tour"
  | "research"
  | "studio"
  | "follow-ups"
  | "directory"
  | "pipeline"
  | "radar"
  | "income"
  | "ask"
  | "settings";

export type WorkProjectType =
  | "Tour"
  | "Release"
  | "Campaign"
  | "Collaboration";

export type WorkProjectStatus = "Idea" | "Planning" | "Active" | "Complete";

export type WorkTaskStatus = "To do" | "Doing" | "Done";

export type WorkTask = {
  id: string;
  title: string;
  status: WorkTaskStatus;
  dueDate: string;
  createdAt: string;
};

export type DealStatus =
  | "Lead"
  | "Offered"
  | "Negotiating"
  | "Confirmed"
  | "Paid"
  | "Lost";

export type WorkDeal = {
  id: string;
  title: string;
  contactId: string;
  amount: string;
  currency: string;
  status: DealStatus;
  eventDate: string;
  notes: string;
  createdAt: string;
};

export type BookingDealType =
  | "festival"
  | "venue"
  | "agent"
  | "press"
  | "commission"
  | "funding"
  | "other";

export type BookingDealStatus =
  | "lead"
  | "pitch_ready"
  | "contacted"
  | "follow_up_due"
  | "interested"
  | "negotiating"
  | "confirmed"
  | "passed";

export type BookingDealSource = "contact" | "opportunity" | "manual" | "demo";

export type BookingDeal = {
  id: string;
  campaignId: string;
  actId: string;
  contactId?: string;
  opportunityId?: string;
  title: string;
  organisation?: string;
  city?: string;
  country?: string;
  dealType: BookingDealType;
  status: BookingDealStatus;
  targetFee?: number;
  projectedValue?: number;
  confirmedValue?: number;
  dateWindow?: string;
  nextStep: string;
  followUpDate?: string;
  confidenceScore: number;
  missingMaterials: string[];
  notes?: string;
  source: BookingDealSource;
  createdAt: string;
  updatedAt?: string;
};

export type BookingDealSummary = {
  confirmedIncome: number;
  projectedIncome: number;
  openDealValue: number;
  followUpsDue: number;
  highestValueDeals: BookingDeal[];
  routeGaps: CampaignRouteStop[];
  mostImportantDeal?: BookingDeal;
};

export type ExpenseStatus = "Planned" | "Committed" | "Paid";

export type ExpenseCategory =
  | "Travel"
  | "Accommodation"
  | "Production"
  | "Musicians"
  | "Marketing"
  | "Other";

export type WorkExpense = {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: string;
  currency: string;
  status: ExpenseStatus;
  dueDate: string;
  notes: string;
  createdAt: string;
};

export type WorkProject = {
  id: string;
  name: string;
  type: WorkProjectType;
  status: WorkProjectStatus;
  startDate: string;
  endDate: string;
  goal: string;
  targetValue: string;
  notes: string;
  contactIds: string[];
  opportunityIds: string[];
  tasks: WorkTask[];
  deals: WorkDeal[];
  expenses: WorkExpense[];
  createdAt: string;
};

export type OpportunityType =
  | "Booking"
  | "Festival"
  | "Press"
  | "Funding"
  | "Collaboration"
  | "Release";

export type OpportunityStatus = "New" | "Saved" | "In progress" | "Dismissed";

export type ResearchBrief = {
  campaignId?: string;
  locations: string;
  genres: string;
  goals: string;
  notes: string;
};

export type ResearchOpportunity = {
  id: string;
  campaignId?: string;
  title: string;
  organisation: string;
  location: string;
  type: OpportunityType;
  summary: string;
  whyNow: string;
  nextAction: string;
  deadline: string;
  confidence: number;
  sourceType: "network" | "web";
  sourceLabel: string;
  sourceUrl: string;
  contactIds: string[];
  createdAt: string;
  status: OpportunityStatus;
};

export type AppNotification = {
  id: string;
  kind: "follow-up" | "opportunity" | "relationship";
  title: string;
  body: string;
  createdAt: string;
  priority: "High" | "Normal";
  actionView: AppView;
  contactId?: string;
  opportunityId?: string;
  read: boolean;
};

export type TodayTask = {
  id: string;
  kind: "follow-up" | "opportunity" | "relationship" | "profile";
  title: string;
  body: string;
  actionLabel: string;
  actionView: AppView;
  priority: "High" | "Normal";
  contactId?: string;
  opportunityId?: string;
};

export type ManagerActionType =
  | "confirm"
  | "deal"
  | "opportunity"
  | "follow-up"
  | "material"
  | "route"
  | "relationship";

export type ManagerAction = {
  id: string;
  campaignId?: string;
  type: ManagerActionType;
  title: string;
  reason: string;
  detail: string;
  primaryActionLabel: string;
  targetView: AppView;
  urgency: number;
  contactId?: string;
  opportunityId?: string;
  dealId?: string;
  relatedLabel?: string;
};

export type ArtistProfile = {
  artistName: string;
  projectName: string;
  baseCity: string;
  genres: string;
  oneLinePitch: string;
  shortBio: string;
  currentProject: string;
  careerGoals: string;
  websiteUrl: string;
  musicUrl: string;
  liveVideoUrl: string;
  pressKitUrl: string;
  signatureName: string;
  defaultFee: string;
};

export type CreativeGoal =
  | "Booking pitch"
  | "Festival application"
  | "Press story"
  | "Release campaign"
  | "Collaboration idea"
  | "Composer commission"
  | "Funding introduction";

export type CreativeBrief = {
  campaignId?: string;
  actId?: string;
  goal: CreativeGoal;
  audience: string;
  tone: "Warm" | "Direct" | "Bold" | "Thoughtful";
  context: string;
};

export type CreativePack = {
  id: string;
  createdAt: string;
  source: "local" | "ai";
  goal: CreativeGoal;
  title: string;
  oneLiner: string;
  subjectLine: string;
  shortPitch: string;
  longPitch: string;
  storyAngles: string[];
  callsToAction: string[];
  contentIdeas: string[];
  campaignId?: string;
  actId?: string;
  approvalStatus?: "Draft" | "Approved" | "Skipped";
  gmailDraftId?: string;
};

export type SourceProvenance = "website" | "user" | "imported";

export type ArtistWorkspace = {
  id: string;
  ownerName: string;
  businessName: string;
  baseCity: string;
  timezone: string;
  signatureName: string;
  defaultCurrency: string;
  monthlyAiBudgetUsd: number;
};

export type AssetKind =
  | "Website"
  | "EPK"
  | "Biography"
  | "Music"
  | "Live video"
  | "Press quote"
  | "Technical rider";

export type ArtistAsset = {
  id: string;
  actId: string;
  kind: AssetKind;
  label: string;
  value: string;
  source: SourceProvenance;
  verified: boolean;
};

export type ActProfile = {
  id: string;
  name: string;
  shortName: string;
  format: string;
  genres: string;
  baseCity: string;
  oneLinePitch: string;
  shortBio: string;
  achievements: string[];
  websiteUrl: string;
  source: SourceProvenance;
  sourceUrl: string;
  confirmed: boolean;
};

export type CampaignType =
  | "Tour"
  | "Release"
  | "Bookings"
  | "Commissions"
  | "Funding";

export type CampaignStatus = "Suggested" | "Active" | "Paused" | "Complete";

export type RouteStopStatus = "Confirmed" | "Tentative" | "Available";

export type CampaignRouteStop = {
  id: string;
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  status: RouteStopStatus;
  venue: string;
  notes: string;
};

export type Campaign = {
  id: string;
  actId: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  goal: string;
  startDate: string;
  endDate: string;
  targetRegions: string[];
  minimumFee: string;
  ensembleSize: number;
  notes: string;
  source: SourceProvenance;
  confirmed: boolean;
  contactIds: string[];
  opportunityIds: string[];
  tasks: WorkTask[];
  deals: WorkDeal[];
  expenses: WorkExpense[];
  routeStops: CampaignRouteStop[];
  requiredAssetKinds: AssetKind[];
  createdAt: string;
};

export type AIUsageRecord = {
  id: string;
  feature: string;
  estimatedCostUsd: number;
  createdAt: string;
  cacheKey: string;
  status: "used" | "cached" | "blocked";
};

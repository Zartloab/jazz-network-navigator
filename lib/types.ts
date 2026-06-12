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

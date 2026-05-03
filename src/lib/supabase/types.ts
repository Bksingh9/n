// Lightweight Database types. Generated types from `supabase gen types` can
// replace this once the project is connected, but a hand-rolled subset keeps
// dev unblocked and the surface area honest about which columns we use.

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  brand_tone: string | null;
  city: string | null;
  contact_email: string | null;
  event_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export interface EventRow {
  id: string;
  organization_id: string;
  host_id: string | null;
  title: string;
  description: string | null;
  event_type: string | null;
  venue_name: string | null;
  city: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  public_slug: string | null;
  age_min: number | null;
  age_max: number | null;
  max_attendees: number | null;
  application_deadline: string | null;
  relationship_goal: string | null;
  current_round: number | null;
  round_started_at: string | null;
  round_ends_at: string | null;
  brand_id: string | null;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
  post_event_links_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandRow {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  tagline: string | null;
  primary_color: string | null;
  logo_url: string | null;
  support_email: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationInviteRow {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  invited_by: string | null;
  token_hash: string;
  status: string;
  accepted_by: string | null;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

export interface EventQuestionRow {
  id: string;
  organization_id: string;
  event_id: string;
  question: string;
  type: string;
  options: Json | null;
  required: boolean;
  sort_order: number;
  created_at: string;
}

export interface AttendeeRow {
  id: string;
  organization_id: string;
  event_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  age: number | null;
  gender: string | null;
  interested_in: string | null;
  relationship_goal: string | null;
  bio: string | null;
  hobbies: string | null;
  conversation_topics: string | null;
  dealbreakers: string | null;
  preferred_age_min: number | null;
  preferred_age_max: number | null;
  status: string;
  checked_in: boolean;
  checked_in_at: string | null;
  consent_to_contact: boolean;
  safety_flag: boolean;
  private_token_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendeeAnswerRow {
  id: string;
  organization_id: string;
  event_id: string;
  attendee_id: string;
  question_id: string;
  answer: string | null;
  created_at: string;
}

export interface CompatibilityScoreRow {
  id: string;
  organization_id: string;
  event_id: string;
  attendee_a_id: string;
  attendee_b_id: string;
  score: number;
  summary: string | null;
  reasons: Json | null;
  preference_conflict: boolean;
  created_at: string;
}

export interface RotationRoundRow {
  id: string;
  organization_id: string;
  event_id: string;
  round_number: number;
  table_number: number;
  attendee_a_id: string | null;
  attendee_b_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  created_at: string;
}

export interface PostEventInterestRow {
  id: string;
  organization_id: string;
  event_id: string;
  from_attendee_id: string;
  to_attendee_id: string;
  interest_type: string;
  consent_to_share_contact: boolean;
  created_at: string;
}

export interface MutualMatchRow {
  id: string;
  organization_id: string;
  event_id: string;
  attendee_a_id: string;
  attendee_b_id: string;
  match_type: string;
  intro_email_sent: boolean;
  intro_email_sent_at: string | null;
  created_at: string;
}

export interface ActivityEventRow {
  id: string;
  organization_id: string;
  event_id: string | null;
  actor_type: string | null;
  actor_id: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Json | null;
  created_at: string;
}

export interface UsageEventRow {
  id: string;
  organization_id: string;
  user_id: string | null;
  event_type: string;
  quantity: number;
  metadata: Json | null;
  created_at: string;
}

export interface EmailEventRow {
  id: string;
  organization_id: string;
  event_id: string | null;
  recipient_email: string | null;
  email_type: string | null;
  status: string | null;
  provider_message_id: string | null;
  created_at: string;
}

type TableDef<R, IRequired extends keyof R> = {
  Row: R;
  Insert: Partial<R> & Pick<R, IRequired>;
  Update: Partial<R>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, 'id'>;
      organizations: TableDef<OrganizationRow, 'name'>;
      organization_members: TableDef<OrganizationMemberRow, 'organization_id' | 'user_id'>;
      events: TableDef<EventRow, 'organization_id' | 'title'>;
      brands: TableDef<BrandRow, 'organization_id' | 'name' | 'slug'>;
      organization_invites: TableDef<OrganizationInviteRow, 'organization_id' | 'email' | 'token_hash'>;
      event_questions: TableDef<EventQuestionRow, 'organization_id' | 'event_id' | 'question'>;
      attendees: TableDef<AttendeeRow, 'organization_id' | 'event_id'>;
      attendee_answers: TableDef<AttendeeAnswerRow, 'organization_id' | 'event_id' | 'attendee_id' | 'question_id'>;
      compatibility_scores: TableDef<CompatibilityScoreRow, 'organization_id' | 'event_id' | 'attendee_a_id' | 'attendee_b_id' | 'score'>;
      rotation_rounds: TableDef<RotationRoundRow, 'organization_id' | 'event_id' | 'round_number' | 'table_number'>;
      post_event_interests: TableDef<PostEventInterestRow, 'organization_id' | 'event_id' | 'from_attendee_id' | 'to_attendee_id' | 'interest_type'>;
      mutual_matches: TableDef<MutualMatchRow, 'organization_id' | 'event_id' | 'attendee_a_id' | 'attendee_b_id' | 'match_type'>;
      activity_events: TableDef<ActivityEventRow, 'organization_id' | 'event_type'>;
      usage_events: TableDef<UsageEventRow, 'organization_id' | 'event_type'>;
      email_events: TableDef<EmailEventRow, 'organization_id'>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

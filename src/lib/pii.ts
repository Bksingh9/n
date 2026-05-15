// Centralized PII redaction. Apply BEFORE sending any attendee-derived
// content to a third-party model (Anthropic, future providers). The goal
// is not perfection — it's predictable, auditable scrubbing so we never
// rely on prompt-side instructions to keep PII out of provider logs.

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// Phone: 7+ digits in a run separated by spaces, dashes, dots, parens, with
// an optional leading +. Permissive on purpose — false positives on long
// numeric strings are safer than letting a phone number through.
const PHONE_RE = /\+?\d(?:[\s\-.()]*\d){6,}/g;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
const HANDLE_RE = /(^|\s)@[A-Za-z0-9_]{3,}\b/g;

export interface RedactOptions {
  // If provided, the value will be removed even when it doesn't match the
  // standard regexes (e.g. an attendee's last name).
  extras?: Array<string | null | undefined>;
}

export const redactPii = (input: string | null | undefined, opts: RedactOptions = {}): string => {
  if (!input) return '';
  let out = input;

  // Run structural patterns FIRST. Otherwise an "extras" pass on a first
  // name can damage a containing email/handle and the regex pass below
  // would no longer recognize it.
  out = out.replace(EMAIL_RE, '[email]');
  out = out.replace(URL_RE, '[link]');
  out = out.replace(PHONE_RE, '[phone]');
  out = out.replace(HANDLE_RE, '$1[handle]');

  for (const term of opts.extras ?? []) {
    if (!term) continue;
    const cleaned = term.trim();
    if (cleaned.length < 2) continue;
    // Word-boundary case-insensitive removal of the literal term.
    const escaped = cleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '[redacted]');
  }

  return out;
};

export const initialOnly = (name: string | null | undefined): string => {
  if (!name) return '';
  const trimmed = name.trim();
  if (!trimmed) return '';
  return `${trimmed[0].toUpperCase()}.`;
};

// Build the safe shape we send to an AI model for compatibility analysis.
// No last names, no contact info, no free-text URLs/handles.
export interface PiiAttendee {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  age?: number | null;
  gender?: string | null;
  interested_in?: string | null;
  relationship_goal?: string | null;
  preferred_age_min?: number | null;
  preferred_age_max?: number | null;
  bio?: string | null;
  hobbies?: string | null;
  conversation_topics?: string | null;
  dealbreakers?: string | null;
}

export interface RedactedAttendee {
  display_name: string;
  age: number | null;
  gender: string | null;
  interested_in: string | null;
  relationship_goal: string | null;
  preferred_age_min: number | null;
  preferred_age_max: number | null;
  bio: string | null;
  hobbies: string | null;
  conversation_topics: string | null;
  dealbreakers: string | null;
}

export const redactAttendeeForAi = (a: PiiAttendee): RedactedAttendee => {
  const extras = [a.first_name, a.last_name, a.email, a.phone];
  return {
    display_name: a.first_name ? initialOnly(a.first_name) : 'A.',
    age: a.age ?? null,
    gender: a.gender ?? null,
    interested_in: a.interested_in ?? null,
    relationship_goal: a.relationship_goal ?? null,
    preferred_age_min: a.preferred_age_min ?? null,
    preferred_age_max: a.preferred_age_max ?? null,
    bio: redactPii(a.bio, { extras }) || null,
    hobbies: redactPii(a.hobbies, { extras }) || null,
    conversation_topics: redactPii(a.conversation_topics, { extras }) || null,
    dealbreakers: redactPii(a.dealbreakers, { extras }) || null,
  };
};

// Anthropic-backed compatibility summary. Runs entirely server-side.
// We never send PII (last name, email, phone) to the model.

import Anthropic from '@anthropic-ai/sdk';
import { serverEnv } from '@/lib/env';
import { computeDeterministicScore, type ScoringAttendee } from '@/lib/matching/scoring';

export interface CompatibilityResult {
  score: number;
  summary: string;
  reasons: string[];
  preference_conflict: boolean;
  host_note: string;
}

const SYSTEM_PROMPT = `You are an event-host assistant that summarizes compatibility between two anonymized attendees at a singles event.

STRICT RULES:
- Use ONLY the information provided. Do not infer sensitive traits.
- Never rank attractiveness or make discriminatory recommendations.
- Never guarantee romantic success.
- Respect explicit consent and stated preferences.
- Output STRICT JSON only — no prose outside the JSON object.

Output schema:
{
  "score": <integer 0-100>,
  "summary": "<short, neutral, host-friendly summary, <= 240 chars>",
  "reasons": ["<short bullet>", ...up to 5],
  "preference_conflict": <boolean>,
  "host_note": "<one helpful note for the host>"
}`;

export const generateCompatibilityScore = async (
  attendeeA: ScoringAttendee & { first_name?: string | null },
  attendeeB: ScoringAttendee & { first_name?: string | null },
  event: { title: string; relationship_goal?: string | null },
): Promise<CompatibilityResult> => {
  const deterministic = computeDeterministicScore(attendeeA, attendeeB);
  const env = serverEnv();

  // Fallback if AI is not configured: return deterministic result.
  if (!env.ANTHROPIC_API_KEY) {
    return {
      ...deterministic,
      summary: deterministic.preference_conflict
        ? 'Stated preferences conflict; consider seating apart.'
        : 'Reasonable conversational fit based on shared answers.',
      host_note: deterministic.preference_conflict
        ? 'Skip pairing this round.'
        : 'Good candidate pairing.',
    };
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const safeA = anonymize(attendeeA);
  const safeB = anonymize(attendeeB);

  const userMessage = `Event: ${event.title}
Event goal: ${event.relationship_goal ?? 'unspecified'}

Deterministic baseline (system-computed):
- score: ${deterministic.score}
- preference_conflict: ${deterministic.preference_conflict}
- reasons: ${JSON.stringify(deterministic.reasons)}

Attendee A:
${JSON.stringify(safeA, null, 2)}

Attendee B:
${JSON.stringify(safeB, null, 2)}

Return strict JSON matching the schema. Use the deterministic baseline as a guardrail (do not exceed +15 from it).`;

  try {
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    const text = resp.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text)
      .join('\n');
    const parsed = parseJsonStrict(text);
    return {
      score: clampScore(parsed.score, deterministic.score),
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 280) : 'Compatibility summary unavailable.',
      reasons: Array.isArray(parsed.reasons)
        ? parsed.reasons.filter((r): r is string => typeof r === 'string').slice(0, 5)
        : deterministic.reasons,
      preference_conflict: deterministic.preference_conflict || Boolean(parsed.preference_conflict),
      host_note: typeof parsed.host_note === 'string' ? parsed.host_note.slice(0, 240) : '',
    };
  } catch (err) {
    console.error('[ai] compatibility generation failed', err);
    return {
      ...deterministic,
      summary: 'AI summary unavailable; deterministic score returned.',
      host_note: '',
    };
  }
};

const anonymize = (a: ScoringAttendee & { first_name?: string | null }) => ({
  display_name: a.first_name ? a.first_name[0] + '.' : 'A',
  age: a.age,
  gender: a.gender,
  interested_in: a.interested_in,
  relationship_goal: a.relationship_goal,
  preferred_age_min: a.preferred_age_min,
  preferred_age_max: a.preferred_age_max,
  hobbies: a.hobbies,
  conversation_topics: a.conversation_topics,
});

const clampScore = (raw: unknown, baseline: number): number => {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return baseline;
  const ceiling = Math.min(100, baseline + 15);
  const floor = Math.max(0, baseline - 15);
  return Math.round(Math.max(floor, Math.min(ceiling, n)));
};

export const parseJsonStrict = (text: string): Record<string, unknown> => {
  const trimmed = text.trim();
  // Tolerate fenced code blocks.
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '');
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    throw new Error('Response is not a JSON object');
  } catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) {
      const slice = cleaned.slice(first, last + 1);
      const parsed = JSON.parse(slice);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    }
    throw new Error('Could not parse compatibility JSON');
  }
};

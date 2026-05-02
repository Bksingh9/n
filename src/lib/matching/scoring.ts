// Deterministic compatibility scoring. Pure function — easy to test.
// Input is attendee-provided information only. We do not infer sensitive
// traits or rank attractiveness.

export interface ScoringAttendee {
  id: string;
  age: number | null;
  gender: string | null;
  interested_in: string | null;
  relationship_goal: string | null;
  preferred_age_min: number | null;
  preferred_age_max: number | null;
  hobbies: string | null;
  conversation_topics: string | null;
}

export interface DeterministicScore {
  score: number;
  reasons: string[];
  preference_conflict: boolean;
}

const tokenize = (s: string | null | undefined): Set<string> => {
  if (!s) return new Set();
  return new Set(
    s
      .toLowerCase()
      .split(/[,\n;|/]+|\s+and\s+|\s+&\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1),
  );
};

const setOverlap = (a: Set<string>, b: Set<string>): { count: number; samples: string[] } => {
  const matches: string[] = [];
  a.forEach((token) => {
    if (b.has(token)) matches.push(token);
  });
  return { count: matches.length, samples: matches.slice(0, 3) };
};

const normalizeOrientation = (s: string | null | undefined): Set<string> => {
  if (!s) return new Set();
  const lower = s.toLowerCase();
  if (/(everyone|all|any)/.test(lower)) return new Set(['men', 'women', 'nonbinary']);
  const out = new Set<string>();
  if (/(men|man|male|guys)/.test(lower)) out.add('men');
  if (/(women|woman|female|gals)/.test(lower)) out.add('women');
  if (/(nonbinary|non-binary|enby)/.test(lower)) out.add('nonbinary');
  return out;
};

const normalizeGender = (s: string | null | undefined): string | null => {
  if (!s) return null;
  const lower = s.toLowerCase();
  if (/(woman|female|she)/.test(lower)) return 'women';
  if (/(man|male|he)/.test(lower)) return 'men';
  if (/(nonbinary|non-binary|enby|they)/.test(lower)) return 'nonbinary';
  return null;
};

export const computeDeterministicScore = (
  a: ScoringAttendee,
  b: ScoringAttendee,
): DeterministicScore => {
  if (a.id === b.id) {
    return { score: 0, reasons: ['Same attendee'], preference_conflict: true };
  }

  const reasons: string[] = [];
  let score = 50; // neutral baseline
  let conflict = false;

  // Age preference compatibility (mutual)
  if (a.age != null && b.preferred_age_min != null && a.age < b.preferred_age_min) conflict = true;
  if (a.age != null && b.preferred_age_max != null && a.age > b.preferred_age_max) conflict = true;
  if (b.age != null && a.preferred_age_min != null && b.age < a.preferred_age_min) conflict = true;
  if (b.age != null && a.preferred_age_max != null && b.age > a.preferred_age_max) conflict = true;
  if (!conflict && a.age != null && b.age != null) {
    const gap = Math.abs(a.age - b.age);
    score += Math.max(0, 10 - gap);
    if (gap <= 5) reasons.push('Close in age');
  } else if (conflict) {
    reasons.push('Age preference mismatch');
  }

  // Orientation compatibility
  const aGender = normalizeGender(a.gender);
  const bGender = normalizeGender(b.gender);
  const aLikes = normalizeOrientation(a.interested_in);
  const bLikes = normalizeOrientation(b.interested_in);
  if (aLikes.size && bGender && !aLikes.has(bGender)) conflict = true;
  if (bLikes.size && aGender && !bLikes.has(aGender)) conflict = true;
  if (!conflict && aLikes.size && bLikes.size && aGender && bGender) {
    score += 10;
    reasons.push('Mutual interest match');
  } else if (conflict) {
    reasons.push('Orientation/preference mismatch');
  }

  // Relationship goal alignment
  if (a.relationship_goal && b.relationship_goal) {
    const overlap = setOverlap(tokenize(a.relationship_goal), tokenize(b.relationship_goal));
    if (overlap.count > 0) {
      score += 8;
      reasons.push('Aligned relationship goals');
    } else {
      score -= 4;
      reasons.push('Different stated goals');
    }
  }

  // Hobbies & topics overlap
  const hobbyOverlap = setOverlap(tokenize(a.hobbies), tokenize(b.hobbies));
  if (hobbyOverlap.count > 0) {
    score += Math.min(15, hobbyOverlap.count * 4);
    reasons.push(`Shared interests: ${hobbyOverlap.samples.join(', ')}`);
  }
  const topicOverlap = setOverlap(tokenize(a.conversation_topics), tokenize(b.conversation_topics));
  if (topicOverlap.count > 0) {
    score += Math.min(10, topicOverlap.count * 3);
    reasons.push(`Topics in common: ${topicOverlap.samples.join(', ')}`);
  }

  if (conflict) score = Math.min(score, 35);
  score = Math.max(0, Math.min(100, score));

  return { score: Math.round(score), reasons, preference_conflict: conflict };
};

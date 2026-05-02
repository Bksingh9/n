// Speed-dating rotation generator.
// Output: an array of rounds; each round has table assignments where each
// attendee appears at most once. Across all rounds, no pair repeats.
//
// Approach: per round, build a maximum matching greedily ordered by
// compatibility score, skipping pairs that already met or that conflict.
// Odd attendees get a 'rest' slot.

export interface RotationAttendee {
  id: string;
  interested_in?: string | null;
  gender?: string | null;
}

export interface RotationOptions {
  table_count: number;
  round_count: number;
  round_duration_minutes: number;
  break_duration_minutes: number;
  start_time: Date;
}

export interface CompatibilityLookup {
  // Map "minId|maxId" -> { score, conflict }
  pairKey: (a: string, b: string) => string;
  get: (a: string, b: string) => { score: number; conflict: boolean } | undefined;
}

export interface RotationAssignment {
  round_number: number;
  table_number: number;
  attendee_a_id: string | null;
  attendee_b_id: string | null;
  starts_at: Date;
  ends_at: Date;
  status: 'scheduled' | 'rest';
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export const buildCompatLookup = (
  scores: Array<{ attendee_a_id: string; attendee_b_id: string; score: number; preference_conflict: boolean }>,
): CompatibilityLookup => {
  const map = new Map<string, { score: number; conflict: boolean }>();
  for (const s of scores) {
    map.set(pairKey(s.attendee_a_id, s.attendee_b_id), {
      score: s.score,
      conflict: s.preference_conflict,
    });
  }
  return {
    pairKey,
    get: (a, b) => map.get(pairKey(a, b)),
  };
};

export const generateRotations = (
  attendees: RotationAttendee[],
  options: RotationOptions,
  compat: CompatibilityLookup,
): RotationAssignment[] => {
  if (attendees.length < 2) return [];
  const result: RotationAssignment[] = [];
  const seenPairs = new Set<string>();

  let cursor = new Date(options.start_time);

  for (let round = 1; round <= options.round_count; round++) {
    // Build candidate pairs for this round, ranked by compatibility desc.
    const candidates: Array<{ a: string; b: string; score: number }> = [];
    for (let i = 0; i < attendees.length; i++) {
      for (let j = i + 1; j < attendees.length; j++) {
        const a = attendees[i].id;
        const b = attendees[j].id;
        const key = pairKey(a, b);
        if (seenPairs.has(key)) continue;
        const meta = compat.get(a, b);
        if (meta?.conflict) continue;
        candidates.push({ a, b, score: meta?.score ?? 50 });
      }
    }
    candidates.sort((x, y) => y.score - x.score);

    const used = new Set<string>();
    const tablesThisRound: Array<{ a: string; b: string }> = [];
    for (const c of candidates) {
      if (tablesThisRound.length >= options.table_count) break;
      if (used.has(c.a) || used.has(c.b)) continue;
      used.add(c.a);
      used.add(c.b);
      tablesThisRound.push({ a: c.a, b: c.b });
      seenPairs.add(pairKey(c.a, c.b));
    }

    const startsAt = new Date(cursor);
    const endsAt = new Date(cursor.getTime() + options.round_duration_minutes * 60_000);

    tablesThisRound.forEach((pair, idx) => {
      result.push({
        round_number: round,
        table_number: idx + 1,
        attendee_a_id: pair.a,
        attendee_b_id: pair.b,
        starts_at: startsAt,
        ends_at: endsAt,
        status: 'scheduled',
      });
    });

    // Rest slots: attendees not assigned this round get a rest entry so the
    // host UI can show them. Self-pair is never produced because we always
    // need two distinct attendees.
    const resters = attendees.filter((a) => !used.has(a.id));
    if (resters.length > 0) {
      // pair resters together; if odd, last one gets rest alone.
      for (let i = 0; i + 1 < resters.length; i += 2) {
        const pair = { a: resters[i].id, b: resters[i + 1].id };
        const key = pairKey(pair.a, pair.b);
        if (seenPairs.has(key)) continue;
        const meta = compat.get(pair.a, pair.b);
        if (meta?.conflict) continue;
        seenPairs.add(key);
        result.push({
          round_number: round,
          table_number: tablesThisRound.length + Math.floor(i / 2) + 1,
          attendee_a_id: pair.a,
          attendee_b_id: pair.b,
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'scheduled',
        });
      }
      if (resters.length % 2 === 1) {
        result.push({
          round_number: round,
          table_number: 0,
          attendee_a_id: resters[resters.length - 1].id,
          attendee_b_id: null,
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'rest',
        });
      }
    }

    cursor = new Date(endsAt.getTime() + options.break_duration_minutes * 60_000);
  }

  return result;
};

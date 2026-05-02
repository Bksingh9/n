import { describe, expect, it } from 'vitest';
import { generateRotations, buildCompatLookup } from '@/lib/matching/rotation';

const mkAttendees = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `a${i + 1}` }));

describe('generateRotations', () => {
  it('produces no duplicate pairings across rounds', () => {
    const attendees = mkAttendees(8);
    const lookup = buildCompatLookup([]);
    const rounds = generateRotations(attendees, {
      table_count: 4,
      round_count: 5,
      round_duration_minutes: 6,
      break_duration_minutes: 2,
      start_time: new Date('2030-01-01T18:00:00Z'),
    }, lookup);

    const seen = new Set<string>();
    for (const r of rounds) {
      if (!r.attendee_a_id || !r.attendee_b_id) continue;
      const key = [r.attendee_a_id, r.attendee_b_id].sort().join('|');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('never schedules an attendee twice in the same round', () => {
    const attendees = mkAttendees(10);
    const lookup = buildCompatLookup([]);
    const rounds = generateRotations(attendees, {
      table_count: 5,
      round_count: 4,
      round_duration_minutes: 6,
      break_duration_minutes: 2,
      start_time: new Date('2030-01-01T18:00:00Z'),
    }, lookup);
    const byRound = new Map<number, string[]>();
    for (const r of rounds) {
      const list = byRound.get(r.round_number) ?? [];
      if (r.attendee_a_id) list.push(r.attendee_a_id);
      if (r.attendee_b_id) list.push(r.attendee_b_id);
      byRound.set(r.round_number, list);
    }
    for (const list of byRound.values()) {
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it('skips conflicting pairs', () => {
    const attendees = mkAttendees(4);
    const lookup = buildCompatLookup([
      { attendee_a_id: 'a1', attendee_b_id: 'a2', score: 90, preference_conflict: true },
    ]);
    const rounds = generateRotations(attendees, {
      table_count: 2,
      round_count: 3,
      round_duration_minutes: 6,
      break_duration_minutes: 2,
      start_time: new Date('2030-01-01T18:00:00Z'),
    }, lookup);
    const a1a2 = rounds.some((r) => {
      if (!r.attendee_a_id || !r.attendee_b_id) return false;
      const k = [r.attendee_a_id, r.attendee_b_id].sort().join('|');
      return k === 'a1|a2';
    });
    expect(a1a2).toBe(false);
  });

  it('handles odd attendee counts with a rest slot', () => {
    const attendees = mkAttendees(5);
    const rounds = generateRotations(attendees, {
      table_count: 3,
      round_count: 2,
      round_duration_minutes: 6,
      break_duration_minutes: 2,
      start_time: new Date('2030-01-01T18:00:00Z'),
    }, buildCompatLookup([]));
    const restCount = rounds.filter((r) => r.status === 'rest').length;
    expect(restCount).toBeGreaterThanOrEqual(1);
  });
});

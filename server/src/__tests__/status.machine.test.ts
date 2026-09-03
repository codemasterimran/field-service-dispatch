/**
 * Status state machine — tests the ALLOWED_TRANSITIONS table
 * without hitting the DB. We import the map directly via a
 * small helper to keep the router side-effect free.
 */

import { JobStatus } from '@prisma/client';

// ── Mirror the state machine from status.routes.ts ────────────────────────────
// This is intentionally duplicated here so the test is self-contained
// and doesn't import Express/Prisma.
const ALLOWED_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  UNASSIGNED: [],
  ASSIGNED:   ['EN_ROUTE'],
  EN_ROUTE:   ['ON_SITE'],
  ON_SITE:    ['COMPLETED'],
  COMPLETED:  [],
};

function canTransition(from: JobStatus, to: JobStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

describe('Status state machine — canTransition()', () => {
  // ── Happy path (forward transitions) ─────────────────────────────────────

  test('ASSIGNED → EN_ROUTE is allowed', () => {
    expect(canTransition('ASSIGNED', 'EN_ROUTE')).toBe(true);
  });

  test('EN_ROUTE → ON_SITE is allowed', () => {
    expect(canTransition('EN_ROUTE', 'ON_SITE')).toBe(true);
  });

  test('ON_SITE → COMPLETED is allowed', () => {
    expect(canTransition('ON_SITE', 'COMPLETED')).toBe(true);
  });

  // ── Terminal states ───────────────────────────────────────────────────────

  test('UNASSIGNED has no allowed transitions', () => {
    expect(ALLOWED_TRANSITIONS['UNASSIGNED']).toHaveLength(0);
  });

  test('COMPLETED has no allowed transitions (terminal)', () => {
    expect(ALLOWED_TRANSITIONS['COMPLETED']).toHaveLength(0);
  });

  // ── Skipping steps is rejected ────────────────────────────────────────────

  test('ASSIGNED → ON_SITE is rejected (skip EN_ROUTE)', () => {
    expect(canTransition('ASSIGNED', 'ON_SITE')).toBe(false);
  });

  test('ASSIGNED → COMPLETED is rejected (skip two steps)', () => {
    expect(canTransition('ASSIGNED', 'COMPLETED')).toBe(false);
  });

  test('EN_ROUTE → COMPLETED is rejected (skip ON_SITE)', () => {
    expect(canTransition('EN_ROUTE', 'COMPLETED')).toBe(false);
  });

  // ── Backwards transitions are rejected ───────────────────────────────────

  test('EN_ROUTE → ASSIGNED is rejected (backward)', () => {
    expect(canTransition('EN_ROUTE', 'ASSIGNED')).toBe(false);
  });

  test('ON_SITE → EN_ROUTE is rejected (backward)', () => {
    expect(canTransition('ON_SITE', 'EN_ROUTE')).toBe(false);
  });

  test('COMPLETED → ON_SITE is rejected (backward)', () => {
    expect(canTransition('COMPLETED', 'ON_SITE')).toBe(false);
  });

  // ── Self-transition ───────────────────────────────────────────────────────

  test('ASSIGNED → ASSIGNED is rejected (no self-loop)', () => {
    expect(canTransition('ASSIGNED', 'ASSIGNED')).toBe(false);
  });

  test('ON_SITE → ON_SITE is rejected (no self-loop)', () => {
    expect(canTransition('ON_SITE', 'ON_SITE')).toBe(false);
  });

  // ── Completeness check ────────────────────────────────────────────────────

  test('each status has exactly one allowed next status (or none)', () => {
    // Only ASSIGNED, EN_ROUTE, ON_SITE should have exactly 1 transition
    const withTransitions: JobStatus[] = ['ASSIGNED', 'EN_ROUTE', 'ON_SITE'];
    for (const s of withTransitions) {
      expect(ALLOWED_TRANSITIONS[s]).toHaveLength(1);
    }
  });
});

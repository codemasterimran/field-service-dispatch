import { findOverlap } from '../../src/services/overlap.service';

// Helper: build a TimeWindow
const win = (
  date: string,
  startTime: string,
  durationMins: number
) => ({
  scheduledDate: new Date(date),
  startTime,
  estimatedDurationMinutes: durationMins,
});

describe('overlap.service — findOverlap()', () => {
  // ── No conflict cases ────────────────────────────────────────────────────

  test('returns null when existing list is empty', () => {
    expect(findOverlap([], win('2025-01-01', '09:00', 60))).toBeNull();
  });

  test('returns null when proposed is on a different day', () => {
    const existing = [win('2025-01-01', '09:00', 60)];
    const proposed  =  win('2025-01-02', '09:00', 60);
    expect(findOverlap(existing, proposed)).toBeNull();
  });

  test('returns null when proposed ends exactly when existing starts (edge — no overlap)', () => {
    // existing: 10:00 – 11:00, proposed: 09:00 – 10:00
    const existing = [win('2025-01-01', '10:00', 60)];
    const proposed  =  win('2025-01-01', '09:00', 60);
    expect(findOverlap(existing, proposed)).toBeNull();
  });

  test('returns null when proposed starts exactly when existing ends (edge — no overlap)', () => {
    // existing: 09:00 – 10:00, proposed: 10:00 – 11:00
    const existing = [win('2025-01-01', '09:00', 60)];
    const proposed  =  win('2025-01-01', '10:00', 60);
    expect(findOverlap(existing, proposed)).toBeNull();
  });

  test('returns null when proposed is entirely before existing', () => {
    const existing = [win('2025-01-01', '14:00', 120)];
    const proposed  =  win('2025-01-01', '09:00', 60);
    expect(findOverlap(existing, proposed)).toBeNull();
  });

  test('returns null when proposed is entirely after existing', () => {
    const existing = [win('2025-01-01', '09:00', 60)];
    const proposed  =  win('2025-01-01', '14:00', 120);
    expect(findOverlap(existing, proposed)).toBeNull();
  });

  // ── Conflict cases ───────────────────────────────────────────────────────

  test('returns conflict when proposed is identical to existing', () => {
    const existing = [win('2025-01-01', '09:00', 60)];
    const proposed  =  win('2025-01-01', '09:00', 60);
    expect(findOverlap(existing, proposed)).not.toBeNull();
  });

  test('returns conflict when proposed starts inside existing window', () => {
    // existing: 09:00 – 10:00, proposed: 09:30 – 11:00
    const existing = [win('2025-01-01', '09:00', 60)];
    const proposed  =  win('2025-01-01', '09:30', 90);
    expect(findOverlap(existing, proposed)).not.toBeNull();
  });

  test('returns conflict when proposed completely contains existing', () => {
    // existing: 09:30 – 10:00, proposed: 09:00 – 11:00
    const existing = [win('2025-01-01', '09:30', 30)];
    const proposed  =  win('2025-01-01', '09:00', 120);
    expect(findOverlap(existing, proposed)).not.toBeNull();
  });

  test('returns conflict when proposed ends inside existing window', () => {
    // existing: 10:00 – 12:00, proposed: 09:00 – 10:30
    const existing = [win('2025-01-01', '10:00', 120)];
    const proposed  =  win('2025-01-01', '09:00', 90);
    expect(findOverlap(existing, proposed)).not.toBeNull();
  });

  test('returns the conflicting window, not null', () => {
    const conflicting = win('2025-01-01', '09:00', 60);
    const existing = [
      win('2025-01-01', '07:00', 30), // no conflict
      conflicting,                     // conflict
      win('2025-01-01', '11:00', 60), // no conflict
    ];
    const proposed = win('2025-01-01', '09:30', 30);
    const result = findOverlap(existing, proposed);
    expect(result).toBe(conflicting);
  });

  // ── Multi-window ─────────────────────────────────────────────────────────

  test('returns null when proposed fits between two existing windows', () => {
    const existing = [
      win('2025-01-01', '08:00', 60), // 08:00 – 09:00
      win('2025-01-01', '10:00', 60), // 10:00 – 11:00
    ];
    const proposed = win('2025-01-01', '09:00', 60); // 09:00 – 10:00 exact gap
    expect(findOverlap(existing, proposed)).toBeNull();
  });

  test('returns conflict when proposed clips second window in a list', () => {
    const existing = [
      win('2025-01-01', '08:00', 60), // 08:00 – 09:00
      win('2025-01-01', '10:00', 60), // 10:00 – 11:00
    ];
    const proposed = win('2025-01-01', '09:30', 60); // 09:30 – 10:30 → clips second
    expect(findOverlap(existing, proposed)).not.toBeNull();
  });
});

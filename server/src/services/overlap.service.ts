/**
 * overlap.service.ts
 * Pure, testable function — no DB calls, no side effects.
 * Given a technician's existing active assignments and a proposed new window,
 * returns true if there is any time overlap.
 */

interface TimeWindow {
  scheduledDate: Date;
  startTime: string; // "HH:MM"
  estimatedDurationMinutes: number;
}

/**
 * Convert a scheduled window to [startMinutes, endMinutes] since epoch (in minutes).
 * We use date + time together so we only overlap within the same calendar day.
 */
function toMinuteRange(window: TimeWindow): [number, number] {
  const dateMs = new Date(window.scheduledDate).setHours(0, 0, 0, 0);
  const dateMins = dateMs / 60000;

  const [hh, mm] = window.startTime.split(':').map(Number);
  const startMins = dateMins + hh * 60 + mm;
  const endMins = startMins + window.estimatedDurationMinutes;

  return [startMins, endMins];
}

/**
 * Check whether proposedWindow overlaps with any of the existingWindows.
 * Two windows overlap if one starts before the other ends (exclusive boundary).
 * Returns the conflicting window if found, null otherwise.
 */
export function findOverlap(
  existingWindows: TimeWindow[],
  proposedWindow: TimeWindow
): TimeWindow | null {
  const [propStart, propEnd] = toMinuteRange(proposedWindow);

  for (const existing of existingWindows) {
    const [exStart, exEnd] = toMinuteRange(existing);

    // Overlap: not (proposed ends before existing starts OR proposed starts after existing ends)
    const overlaps = propStart < exEnd && propEnd > exStart;
    if (overlaps) return existing;
  }

  return null;
}

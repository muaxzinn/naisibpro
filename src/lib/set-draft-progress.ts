'use client';

export interface SetDraftRecord {
  setId: string;
  mode: 'real' | 'practice';
  questionIds: number[];
  answers: (number | null)[];
  cur: number;
  answeredCount: number;
  total: number;
  updatedAt: string;
}

const SET_DRAFTS_KEY = 'gp:set-drafts:v1';

export function readAllSetDrafts(): Record<string, SetDraftRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SET_DRAFTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, SetDraftRecord>;
    }
  } catch {
    // ignore
  }
  return {};
}

export function readSetDraft(setId: string): SetDraftRecord | null {
  const all = readAllSetDrafts();
  return all[setId] || null;
}

export function writeSetDraft(record: SetDraftRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const all = readAllSetDrafts();
    all[record.setId] = record;
    window.localStorage.setItem(SET_DRAFTS_KEY, JSON.stringify(all));
  } catch {
    // ignore storage quota errors
  }
}

export function clearSetDraft(setId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const all = readAllSetDrafts();
    if (setId in all) {
      delete all[setId];
      window.localStorage.setItem(SET_DRAFTS_KEY, JSON.stringify(all));
    }
  } catch {
    // ignore
  }
}

export function isFixedDraftSupportedSet(setId: string): boolean {
  return (
    /^\d+$/.test(setId) ||
    setId === 'real-1' ||
    setId === 'real-2' ||
    setId === 'real-3' ||
    setId === 'real-4'
  );
}

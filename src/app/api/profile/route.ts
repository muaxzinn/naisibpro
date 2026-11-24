import { NextRequest, NextResponse } from 'next/server';
import {
  applyQuestionOutcomes,
  applyRealExamOutcomes,
  getAllQuestionsMerged,
  readRuntimeState,
  resetCompletedHistory,
  resetRealExamHistory,
  writeRuntimeState,
  type CompletedPoolMode,
  type RuntimeState,
} from '@/lib/server-db';
import type { SubjectKey } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  const runtime = readRuntimeState();
  return NextResponse.json({
    profile: runtime.profile,
    leaderboard: runtime.leaderboard,
    attemptsCount: runtime.attempts.length,
    attempts: runtime.attempts.slice(0, 10),
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const runtime = readRuntimeState();

  if (typeof body.track === 'string' && body.track.trim()) {
    runtime.profile.track = body.track.trim();
  }
  if (typeof body.excludeCompleted === 'boolean') {
    runtime.profile.excludeCompleted = body.excludeCompleted;
  }
  if (body.toggleBookmarkId !== undefined) {
    const bid = Number(body.toggleBookmarkId);
    const set = new Set(runtime.profile.bookmarks || []);
    if (set.has(bid)) set.delete(bid);
    else set.add(bid);
    runtime.profile.bookmarks = Array.from(set);
  }
  if (Array.isArray(body.questionOutcomes)) {
    const sanitized = body.questionOutcomes
      .filter(
        (item: unknown): item is { id: number; correct: boolean } =>
          Boolean(item && typeof item === 'object' && 'id' in item)
      )
      .map((item: { id: unknown; correct: unknown }) => ({
        id: Number(item.id),
        correct: Boolean(item.correct),
      }));
    applyQuestionOutcomes(runtime.profile, sanitized);
  }
  if (Array.isArray(body.realExamOutcomes)) {
    const sanitized = body.realExamOutcomes
      .filter(
        (item: unknown): item is { id: number; correct: boolean } =>
          Boolean(item && typeof item === 'object' && 'id' in item)
      )
      .map((item: { id: unknown; correct: unknown }) => ({
        id: Number(item.id),
        correct: Boolean(item.correct),
      }));
    applyRealExamOutcomes(runtime.profile, sanitized);
  }
  if (body.resetRealExam) {
    resetRealExamHistory(runtime.profile);
  }
  if (body.clearMistakes) {
    runtime.profile.mistakeIds = [];
  }
  if (body.clearCorrect) {
    runtime.profile.correctIds = [];
  }
  if (body.clearBookmarks) {
    runtime.profile.bookmarks = [];
  }
  if (body.resetCompleted && typeof body.resetCompleted === 'object') {
    const rc = body.resetCompleted as {
      scope?: 'all' | 'subject' | 'topic';
      subject?: SubjectKey;
      topic?: string;
      pool?: CompletedPoolMode;
    };
    resetCompletedHistory(runtime.profile, rc, getAllQuestionsMerged());
  }
  if (body.importSync && typeof body.importSync === 'object') {
    const imp = body.importSync as Partial<RuntimeState>;
    if (imp.profile && typeof imp.profile === 'object') {
      runtime.profile = {
        ...runtime.profile,
        ...imp.profile,
        bookmarks: Array.isArray(imp.profile.bookmarks)
          ? imp.profile.bookmarks.map(Number)
          : runtime.profile.bookmarks,
        mistakeIds: Array.isArray(imp.profile.mistakeIds)
          ? imp.profile.mistakeIds.map(Number)
          : runtime.profile.mistakeIds,
        correctIds: Array.isArray(imp.profile.correctIds)
          ? imp.profile.correctIds.map(Number)
          : runtime.profile.correctIds || [],
        excludeCompleted:
          typeof imp.profile.excludeCompleted === 'boolean'
            ? imp.profile.excludeCompleted
            : runtime.profile.excludeCompleted ?? true,
      };
    }
    if (Array.isArray(imp.attempts)) {
      runtime.attempts = imp.attempts;
    }
    if (imp.examProgress !== undefined) {
      runtime.examProgress = imp.examProgress;
    }
  }

  writeRuntimeState(runtime);
  return NextResponse.json({ ok: true, profile: runtime.profile });
}


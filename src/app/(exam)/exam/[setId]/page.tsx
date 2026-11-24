import React from 'react';
import { ExamRunnerClient } from '@/components/ExamRunnerClient';
import { SUBJECTS, TRACKS } from '@/lib/constants';
import { getStore, readRuntimeState } from '@/lib/server-db';

export function generateStaticParams() {
  const store = getStore();
  const runtime = readRuntimeState();
  const ids = new Set<string>([
    ...store.examSets.map((s) => String(s.id)),
    ...(runtime.customSets || []).map((s) => String(s.id)),
    ...Array.from({ length: 10 }, (_, i) => String(301 + i)),
    'random',
    ...TRACKS.map((t) => `random-${t.id}`),
    ...SUBJECTS.map((s) => `subject-${s.key}`),
    'mistakes',
    'bookmarks',
    'repack-form',
    'real-1',
    'real-2',
    'real-3',
    'real-4',
    'real-mistakes',
    'real-mix',
    'real-completed',
    'review-form',
    'review-subject',
    'review-topic',
    'topic',
    'completed-form',
    'completed-subject',
    'completed-topic',
  ]);
  return Array.from(ids).map((setId) => ({ setId }));
}

export default function ExamRunnerPage() {
  return <ExamRunnerClient />;
}

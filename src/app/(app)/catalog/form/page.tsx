import React from 'react';
import Link from 'next/link';
import { ArrowLeft, BookmarkCheck, FileSpreadsheet } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { CatalogFormClient } from '@/components/CatalogFormClient';
import { ACTIVE_SUBJECTS, HIDDEN_SUBJECT_KEYS, SUBJECTS, type SubjectKey } from '@/lib/constants';
import { REAL_EXAM_ID_SET, REAL_EXAM_SETS } from '@/lib/real-exam-sets';
import { getAllQuestionsMerged, getStore, readRuntimeState } from '@/lib/server-db';
import type { RealExamSetCardMeta } from '@/components/CatalogRealExamClient';

export default function CatalogFormPage() {
  const store = getStore();
  const runtime = readRuntimeState();
  const sets = [
    ...store.examSets.filter((s) => s.kind === 'form'),
    ...(runtime.customSets || []).filter((s) => s.kind === 'form'),
  ];

  // Compact subject -> [topicTitle, sortedIds[]] payload (~36 KB, preserves exact sub-topic buckets!)
  const allQuestions = getAllQuestionsMerged();
  const topicMaps = new Map<SubjectKey, Map<string, number[]>>();
  for (const s of SUBJECTS) {
    topicMaps.set(s.key, new Map());
  }
  for (const q of allQuestions) {
    if (REAL_EXAM_ID_SET.has(q.id) || HIDDEN_SUBJECT_KEYS.has(q.subject_key)) continue;
    const m = topicMaps.get(q.subject_key);
    if (!m) continue;
    const topicLabel = q.title || 'อื่นๆ';
    const arr = m.get(topicLabel);
    if (arr) arr.push(q.id);
    else m.set(topicLabel, [q.id]);
  }
  const subjectTopicGroups = {} as Record<SubjectKey, Array<[string, number[]]>>;
  for (const s of SUBJECTS) {
    const entries = Array.from(topicMaps.get(s.key)?.entries() || []).map(
      ([label, ids]): [string, number[]] => [label, ids.sort((a, b) => a - b)]
    );
    subjectTopicGroups[s.key] = entries;
  }
  void ACTIVE_SUBJECTS;

  const fixedSetIds: Record<string, number[]> = {};
  for (const s of sets) {
    const key = String(s.id);
    fixedSetIds[key] = runtime.customSetQuestionIds?.[key] || store.setsMap.get(key) || [];
  }

  const realExamSets: RealExamSetCardMeta[] = REAL_EXAM_SETS.map((s) => {
    const subjectBreakdown: Partial<Record<SubjectKey, number>> = {};
    let svgCount = 0;
    for (const id of s.questionIds) {
      const q = store.questionsById.get(id);
      if (!q) continue;
      subjectBreakdown[q.subject_key] = (subjectBreakdown[q.subject_key] || 0) + 1;
      if (q.img || q.explanation_img || q.opt_imgs?.some(Boolean)) svgCount++;
    }
    return {
      id: s.id,
      index: s.index,
      title: s.title,
      subtitle: s.subtitle,
      badge: s.badge,
      questionIds: [...s.questionIds],
      subjectBreakdown,
      svgCount,
    };
  });

  return (
    <div className="min-h-screen bg-bg text-ink pb-24 md:pb-12">
      <SiteHeader mode="app" />
      <main className="mx-auto max-w-4xl px-4 py-7 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div>
            <Link
              href="/catalog"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-brand"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>กลับไปหน้าเลือกโหมด</span>
            </Link>

            <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              <FileSpreadsheet className="h-6 w-6 text-brand shrink-0" />
              <span>ข้อสอบจำลองเป็นชุด (150 ข้อ)</span>
            </h1>
            <p className="mt-1 text-sm text-muted">
              สลับได้อิสระระหว่างโหมดจัดระเบียบใหม่ (3 กอง) และโหมดชุดเดิมมาตรฐาน โดยไม่ต้องรีเซ็ตประวัติ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/catalog/completed?tab=review"
              className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-panel px-3 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand"
            >
              <BookmarkCheck className="h-4 w-4 text-gold-ink" />
              <span>คลังทบทวนรายข้อ</span>
            </Link>
          </div>
        </div>

        <CatalogFormClient
          sets={sets}
          attempts={runtime.attempts}
          subjectTopicGroups={subjectTopicGroups}
          fixedSetIds={fixedSetIds}
          realExamSets={realExamSets}
          initialExamSettings={runtime.profile.examSettings}
        />
      </main>
    </div>
  );
}

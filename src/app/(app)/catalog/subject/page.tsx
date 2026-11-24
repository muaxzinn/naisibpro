import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Layers } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { CatalogSubjectClient, type SubjectOverviewItem } from '@/components/CatalogSubjectClient';
import { ACTIVE_SUBJECTS } from '@/lib/constants';
import { REAL_EXAM_ID_SET } from '@/lib/real-exam-sets';
import { getAllQuestionsMerged, getStore } from '@/lib/server-db';

function buildOverviewItems(
  pool: ReturnType<typeof getAllQuestionsMerged>,
  storeTopics: ReturnType<typeof getStore>['topics']
): SubjectOverviewItem[] {
  return ACTIVE_SUBJECTS.map((s) => {
    const subjectQs = pool.filter((q) => q.subject_key === s.key);
    const count = subjectQs.length;
    const topicCounts = new Map<string, number>();
    for (const q of subjectQs) {
      if (!q.title) continue;
      topicCounts.set(q.title, (topicCounts.get(q.title) || 0) + 1);
    }
    const topics = storeTopics
      .filter((t) => t.subjectKey === s.key && (topicCounts.get(t.title) || 0) > 0)
      .map((t) => ({ title: t.title, count: topicCounts.get(t.title) || 0 }));

    return {
      key: s.key,
      count,
      subSetCount: Math.max(1, Math.ceil(count / 20)),
      questionIds: subjectQs.map((q) => q.id),
      topics,
    };
  });
}

export default function CatalogSubjectPage() {
  const merged = getAllQuestionsMerged();
  const store = getStore();
  const practiceItems = buildOverviewItems(
    merged.filter((q) => !REAL_EXAM_ID_SET.has(q.id)),
    store.topics
  );
  const realExamItems = buildOverviewItems(
    merged.filter((q) => REAL_EXAM_ID_SET.has(q.id)),
    store.topics
  );

  return (
    <div className="min-h-screen bg-bg text-ink pb-24 md:pb-12">
      <SiteHeader mode="app" />
      <main className="mx-auto max-w-5xl px-4 py-7 space-y-5">
        <div className="border-b border-line pb-5">
          <Link href="/catalog" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-brand">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>กลับไปหน้าเลือกโหมด</span>
          </Link>

          <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            <Layers className="h-6 w-6 text-brand shrink-0" />
            <span>ชุดข้อสอบแยกรายวิชา ({ACTIVE_SUBJECTS.length} วิชา)</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            ฝึกเป็นชุดย่อยเรียงลำดับ (ชุดละ 20 หรือ 50 ข้อ) หรือสุ่มฝึกเข้มข้นรายวิชา — สลับโหมดฝึกปกติ/สนามจริงได้จากแถบด้านบน
          </p>
        </div>

        <CatalogSubjectClient items={practiceItems} realExamItems={realExamItems} />
      </main>
    </div>
  );
}

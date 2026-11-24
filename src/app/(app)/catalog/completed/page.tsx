import React from 'react';
import Link from 'next/link';
import { Archive, ArrowLeft, BookOpenCheck, Layers } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { CatalogCompletedClient } from '@/components/CatalogCompletedClient';
import { HIDDEN_SUBJECT_KEYS } from '@/lib/constants';
import { REAL_EXAM_ID_SET } from '@/lib/real-exam-sets';
import { buildSubTopicsCatalog } from '@/lib/topic-catalog';
import { getAllQuestionsMerged } from '@/lib/server-db';

export default function CatalogCompletedPage() {
  const activeQuestions = getAllQuestionsMerged().filter(
    (q) => !HIDDEN_SUBJECT_KEYS.has(q.subject_key)
  );
  const practiceQuestions = activeQuestions.filter((q) => !REAL_EXAM_ID_SET.has(q.id));
  const realExamQuestions = activeQuestions.filter((q) => REAL_EXAM_ID_SET.has(q.id));

  const practiceCat = buildSubTopicsCatalog(practiceQuestions);
  const realExamCat = buildSubTopicsCatalog(realExamQuestions);

  return (
    <div className="min-h-screen bg-bg text-ink pb-24 md:pb-12">
      <SiteHeader mode="app" />
      <main className="mx-auto max-w-6xl px-4 py-7 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div>
            <Link
              href="/catalog"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-brand"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>กลับหน้าเลือกโหมดข้อสอบ</span>
            </Link>
            <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
              <Archive className="h-6 w-6 text-brand shrink-0" />
              <span>ชุดข้อสอบที่เคยทำแล้ว</span>
            </h1>
            <p className="mt-1 text-sm text-muted">
              ทบทวนข้อที่เคยทำ แยกรวมทั้งหมด ทำถูกอย่างเดียว หรือทำผิดอย่างเดียว — เปลี่ยนตามโหมดฝึกปกติ/สนามจริงด้านบน
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/catalog/topics"
              className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-panel px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-brand/50 hover:text-brand"
            >
              <BookOpenCheck className="h-4 w-4 text-brand" />
              <span>หัวข้อย่อย (ข้อใหม่)</span>
            </Link>
            <Link
              href="/catalog/subject"
              className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-panel px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-brand/50 hover:text-brand"
            >
              <Layers className="h-4 w-4 text-teal-ink" />
              <span>แยกรายวิชา</span>
            </Link>
          </div>
        </div>

        <CatalogCompletedClient
          topicsBySubject={practiceCat.topicsBySubject}
          totalCatalogQuestions={practiceQuestions.length}
          realExamTopicsBySubject={realExamCat.topicsBySubject}
          realExamTotalQuestions={realExamQuestions.length}
        />
      </main>
    </div>
  );
}

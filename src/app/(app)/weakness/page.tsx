import React, { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, BookmarkCheck, Flame } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { WeaknessSummaryClient } from '@/components/WeaknessSummaryClient';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { HIDDEN_SUBJECT_KEYS } from '@/lib/constants';
import { REAL_EXAM_ID_SET } from '@/lib/real-exam-sets';
import { buildSyllabusTree } from '@/lib/syllabus-taxonomy';
import { getAllQuestionsMerged } from '@/lib/server-db';

export default function WeaknessPage() {
  const allActive = getAllQuestionsMerged().filter(
    (q) => !HIDDEN_SUBJECT_KEYS.has(q.subject_key)
  );
  const practiceQuestions = allActive.filter((q) => !REAL_EXAM_ID_SET.has(q.id));
  const realExamQuestions = allActive.filter((q) => REAL_EXAM_ID_SET.has(q.id));

  const practiceTree = buildSyllabusTree(practiceQuestions);
  const realExamTree = buildSyllabusTree(realExamQuestions);

  return (
    <div className="min-h-screen bg-bg text-ink pb-24 md:pb-12">
      <SiteHeader mode="app" />
      <main className="mx-auto max-w-5xl px-4 py-7 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-brand"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>กลับแดชบอร์ด</span>
            </Link>
            <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
              <BarChart3 className="h-6 w-6 text-brand shrink-0" />
              <span>ศูนย์วิเคราะห์จุดอ่อน 3 ระดับตามโครงคอร์ส</span>
            </h1>
            <p className="mt-1 text-sm text-muted">
              เจาะลึกทีละชั้น (ภาพรวม 7 หมวด → บทเรียนในคอร์ส → หัวข้อย่อย &amp; รายข้อที่ผิด) แยกขาดระหว่างคลังฝึกปกติกับสนามข้อสอบจริง 4 ชุด
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/catalog/form"
              className="inline-flex items-center gap-1.5 rounded-btn border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/15"
            >
              <Flame className="h-4 w-4" />
              <span>ชุดข้อสอบ (ฝึกปกติ / สนามจริง)</span>
            </Link>
            <Link
              href="/catalog/completed?tab=review"
              className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-panel px-3 py-2 text-xs font-semibold text-ink hover:border-brand/50 hover:text-brand"
            >
              <BookmarkCheck className="h-4 w-4 text-gold-ink" />
              <span>คลังทบทวน</span>
            </Link>
          </div>
        </div>

        <Suspense
          fallback={
            <AppLoadingScreen
              variant="catalog"
              includeHeader={false}
              title="กำลังวิเคราะห์จุดอ่อนรายบทเรียน..."
              subtitle="จัดกลุ่มข้อสอบตามโครงสร้าง 7 หมวดคอร์สเรียน"
            />
          }
        >
          <WeaknessSummaryClient
            practiceTree={practiceTree}
            realExamTree={realExamTree}
          />
        </Suspense>
      </main>
    </div>
  );
}

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, BookmarkCheck, FileSpreadsheet, Flame } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { CatalogRealExamClient } from '@/components/CatalogRealExamClient';
import { REAL_EXAM_SETS } from '@/lib/real-exam-sets';
import { getStore } from '@/lib/server-db';
import type { SubjectKey } from '@/lib/constants';

export default function CatalogRealExamPage() {
  const store = getStore();

  const setsMeta = REAL_EXAM_SETS.map((s) => {
    const subjectBreakdown: Partial<Record<SubjectKey, number>> = {};
    let svgCount = 0;
    for (const id of s.questionIds) {
      const q = store.questionsById.get(id);
      if (!q) continue;
      subjectBreakdown[q.subject_key] = (subjectBreakdown[q.subject_key] || 0) + 1;
      if (q.img || q.explanation_img || q.opt_imgs?.some(Boolean)) {
        svgCount++;
      }
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
              <span>กลับหน้าเลือกโหมดข้อสอบ</span>
            </Link>
            <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
              <Flame className="h-6 w-6 text-accent shrink-0" />
              <span>สนามข้อสอบจริง (โค้งสุดท้าย · 4 ชุดล็อกแยก)</span>
            </h1>
            <p className="mt-1 text-sm text-muted">
              3 ชุดเรียงข้อ 1–150 รุ่น 2569 เป๊ะ + ชุดที่ 4 ครบทุกหัวข้อย่อย (รวม 643 ข้อ) แยกขาดจากคลังฝึกปกติ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/catalog/form"
              className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-panel px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-brand/50 hover:text-brand"
            >
              <FileSpreadsheet className="h-4 w-4 text-brand" />
              <span>ชุดจำลองปกติ</span>
            </Link>
            <Link
              href="/catalog/review"
              className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-panel px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-brand/50 hover:text-brand"
            >
              <BookmarkCheck className="h-4 w-4 text-gold-ink" />
              <span>คลังทบทวน</span>
            </Link>
          </div>
        </div>

        <CatalogRealExamClient sets={setsMeta} />
      </main>
    </div>
  );
}

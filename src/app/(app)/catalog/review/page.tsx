import React from 'react';
import Link from 'next/link';
import { ArrowLeft, BookmarkCheck, FileSpreadsheet, Layers } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { CatalogReviewClient } from '@/components/CatalogReviewClient';
import { buildSubTopicsCatalog } from '@/lib/topic-catalog';
import { getAllQuestionsMerged, getStore, readRuntimeState } from '@/lib/server-db';

export default function CatalogReviewPage() {
  const store = getStore();
  const runtime = readRuntimeState();
  const hasCustom = Boolean(runtime.customQuestions?.length);
  const allQuestions = hasCustom ? getAllQuestionsMerged() : store.questions;
  const { topicsBySubject } = hasCustom
    ? buildSubTopicsCatalog(allQuestions)
    : store.subTopicsCatalog;

  return (
    <div className="min-h-screen bg-bg text-ink pb-24 md:pb-12">
      <SiteHeader mode="app" />
      <main className="mx-auto max-w-5xl px-4 py-7 space-y-5">
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
              <BookmarkCheck className="h-6 w-6 text-gold-ink shrink-0" />
              <span>คลังทบทวนรายข้อ</span>
            </h1>
            <p className="mt-1 text-sm text-muted">
              รวมทุกข้อที่คุณกด &ldquo;ต้องการทบทวน&rdquo; ฝึกได้ครบทั้งแบบรวม แยกวิชา แยกหัวข้อย่อย และดูแบบรายข้อ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/catalog/form"
              className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-panel px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-brand/50 hover:text-brand"
            >
              <FileSpreadsheet className="h-4 w-4 text-brand" />
              <span>ชุดจำลอง 150 ข้อ</span>
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

        <CatalogReviewClient topicsBySubject={topicsBySubject} />
      </main>
    </div>
  );
}

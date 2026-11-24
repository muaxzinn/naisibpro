'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Database,
  FileSpreadsheet,
  Layers,
  Shuffle,
  X,
} from 'lucide-react';
import { ACTIVE_SUBJECTS, TRACKS } from '@/lib/constants';
import { SubjectIcon } from '@/components/SubjectIcon';

export function StartExamModalButton({
  defaultTrack,
  label = 'เริ่มทำข้อสอบ',
  excludeCompleted = false,
}: {
  defaultTrack?: string;
  label?: string;
  excludeCompleted?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const initialTrack = TRACKS.find((t) => t.name === defaultTrack)?.id ?? 0;
  const [trackId, setTrackId] = useState<number>(initialTrack);
  const excludeParam = excludeCompleted ? '&excludeCompleted=1' : '';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-btn bg-brand px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:-translate-y-0.5 hover:bg-brand-dark"
      >
        <span>{label}</span>
        <ArrowRight className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-card border border-line bg-panel p-6 shadow-card"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-ink">เลือกโหมดการฝึกทำข้อสอบ</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-muted hover:bg-bg2 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-brand/30 bg-brand/5 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-brand">
                <Shuffle className="h-4 w-4" />
                <span>สุ่มข้อสอบครบทุกวิชา · 150 ข้อ (จับเวลา 3 ชม.)</span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {TRACKS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTrackId(t.id)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                      trackId === t.id
                        ? 'border-brand bg-brand text-white'
                        : 'border-line bg-panel text-muted hover:text-ink'
                    }`}
                  >
                    {t.shortName}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/exam/random-${trackId}?mode=real${excludeParam}`}
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand-dark"
                >
                  <span>โหมดสอบจริง</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href={`/exam/random-${trackId}?mode=practice${excludeParam}`}
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-panel px-4 py-2 text-xs font-bold text-ink hover:border-brand/50"
                >
                  <span>โหมดฝึกซ้อมเฉลยทีละข้อ</span>
                </Link>
              </div>
            </div>

            {/* Quick Subject Drill Picker */}
            <div className="mt-4 rounded-2xl border border-line bg-bg2/50 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-extrabold text-ink">
                  <Layers className="h-4 w-4 text-teal-ink" />
                  <span>ฝึกทำข้อสอบแยกรายวิชา ({ACTIVE_SUBJECTS.length} วิชา)</span>
                </div>
                <Link
                  href="/catalog/subject"
                  onClick={() => setOpen(false)}
                  className="text-[11px] font-bold text-brand hover:underline"
                >
                  ดูทุกชุดย่อย →
                </Link>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ACTIVE_SUBJECTS.map((s) => (
                  <Link
                    key={s.key}
                    href={`/exam/subject-${s.key}?set=1&count=20&mode=practice&fresh=1${excludeParam}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl border border-line bg-panel px-2.5 py-2 text-xs font-bold text-ink transition-colors hover:border-brand/50 hover:text-brand"
                  >
                    <SubjectIcon subjectKey={s.key} size="sm" />
                    <span className="truncate">{s.shortName}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              <Link
                href="/catalog/form"
                onClick={() => setOpen(false)}
                className="rounded-2xl border border-line bg-bg2/60 p-3.5 transition-colors hover:border-brand/50"
              >
                <FileSpreadsheet className="h-5 w-5 text-brand" />
                <div className="mt-2 text-xs font-bold text-ink">ชุดข้อสอบ 15 ชุด</div>
                <div className="mt-0.5 text-[11px] text-muted">ทำเต็มชุดหรือเลือกเฉพาะวิชา</div>
              </Link>
              <Link
                href="/catalog/subject"
                onClick={() => setOpen(false)}
                className="rounded-2xl border border-line bg-bg2/60 p-3.5 transition-colors hover:border-brand/50"
              >
                <Layers className="h-5 w-5 text-teal-ink" />
                <div className="mt-2 text-xs font-bold text-ink">ชุดข้อสอบแยกรายวิชา</div>
                <div className="mt-0.5 text-[11px] text-muted">จัดชุดละ 20 ข้อ &amp; 50/100 ข้อ</div>
              </Link>
              <Link
                href="/bank"
                onClick={() => setOpen(false)}
                className="rounded-2xl border border-line bg-bg2/60 p-3.5 transition-colors hover:border-brand/50"
              >
                <Database className="h-5 w-5 text-gold-ink" />
                <div className="mt-2 text-xs font-bold text-ink">เจาะลึก 132 บท</div>
                <div className="mt-0.5 text-[11px] text-muted">คลัง 7,038 ข้อ</div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BarChart3,
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  Lock,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { SUBJECT_MAP, type SubjectKey } from '@/lib/constants';
import { REAL_EXAM_ALL_IDS, type RealExamSetId } from '@/lib/real-exam-sets';
import { useProfileHistory } from '@/lib/use-profile-history';
import { readAllSetDrafts, type SetDraftRecord } from '@/lib/set-draft-progress';
import { SubjectIcon } from '@/components/SubjectIcon';

export interface RealExamSetCardMeta {
  id: RealExamSetId;
  index: 1 | 2 | 3 | 4;
  title: string;
  subtitle: string;
  badge?: string;
  questionIds: number[];
  subjectBreakdown: Partial<Record<SubjectKey, number>>;
  svgCount: number;
}

export function CatalogRealExamClient({
  sets,
  hideTopToggle = false,
}: {
  sets: RealExamSetCardMeta[];
  hideTopToggle?: boolean;
}) {
  const {
    realCorrectSet,
    realMistakeSet,
    saving,
    resetRealExam,
  } = useProfileHistory();

  const [setDrafts, setSetDrafts] = useState<Record<string, SetDraftRecord>>({});

  useEffect(() => {
    setSetDrafts(readAllSetDrafts());
    const onRefresh = () => setSetDrafts(readAllSetDrafts());
    window.addEventListener('pageshow', onRefresh);
    window.addEventListener('gp:runtime-updated', onRefresh);
    return () => {
      window.removeEventListener('pageshow', onRefresh);
      window.removeEventListener('gp:runtime-updated', onRefresh);
    };
  }, []);

  const totalReal = REAL_EXAM_ALL_IDS.length; // 450
  const masteredCount = realCorrectSet.size;
  const wrongCount = realMistakeSet.size;
  const unseenCount = Math.max(0, totalReal - masteredCount - wrongCount);
  const masteryPct = totalReal > 0 ? Math.round((masteredCount / totalReal) * 100) : 0;
  const isPerfectMastery = masteredCount === totalReal && wrongCount === 0;
  const priorityMixCount = Math.min(150, wrongCount + unseenCount);

  return (
    <div className="space-y-6">
      {/* Unified 2-World Toggle: Remaining Practice Sets vs 3 Isolated Real-Exam Sets */}
      {!hideTopToggle && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 rounded-card border border-line bg-panel p-2 shadow-card">
          <Link
            href="/catalog/form"
            className="flex items-center justify-between gap-2 rounded-xl border border-line bg-bg2/60 px-4 py-3 text-ink transition-colors hover:border-brand/50 hover:bg-brand/8"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Layers className="h-4 w-4 shrink-0 text-brand" />
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">ชุดฝึกปกติที่เหลือ</div>
                <div className="text-[11px] text-muted tabular-nums">
                  5,348 ข้อ · 35 ชุดเต็ม + เศษ 98 ข้อ
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-brand" />
          </Link>

          <div className="flex items-center justify-between gap-2 rounded-xl bg-accent px-4 py-3 text-white">
            <div className="flex items-center gap-2.5 min-w-0">
              <Flame className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">สนามข้อสอบจริง (4 ชุดแยก)</div>
                <div className="text-[11px] text-white/85 tabular-nums">
                  {totalReal} ข้อ · 3 ชุดรุ่น 2569 + ชุดที่ 4 ครบทุกหัวข้อย่อย
                </div>
              </div>
            </div>
            <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-bold shrink-0">
              กำลังดูอยู่
            </span>
          </div>
        </div>
      )}

      {/* Mastery Progress Hero */}
      <div className="rounded-card border border-line bg-panel p-5 shadow-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-bold text-accent">
              <Lock className="h-3 w-3" />
              <span>แยกขาดจากคลังฝึกปกติ 100% · สำหรับโค้งสุดท้ายก่อนสอบ</span>
            </div>
            <h2 className="mt-2 text-lg font-bold text-ink">
              ความเชี่ยวชาญสนามจริงทั้ง {sets.length} ชุด ({masteredCount}/{totalReal} ข้อ · {masteryPct}%)
            </h2>
          </div>

          {(masteredCount > 0 || wrongCount > 0) && (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (
                  window.confirm(
                    `ต้องการรีเซ็ตประวัติเฉพาะสนามข้อสอบจริงทั้ง ${sets.length} ชุดนี้ (${totalReal} ข้อ) เพื่อเริ่มวัดผลใหม่ใช่หรือไม่? (ประวัติคลังฝึกปกติจะไม่ถูกลบ)`
                  )
                ) {
                  void resetRealExam();
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg2 px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>รีเซ็ตเฉพาะ {sets.length} ชุดนี้</span>
            </button>
          )}
        </div>

        {/* Mastery Bar */}
        <div className="space-y-1.5">
          <div className="h-3 w-full overflow-hidden rounded-full bg-bg2 flex">
            <div
              className="h-full bg-teal transition-all"
              style={{ width: `${(masteredCount / totalReal) * 100}%` }}
            />
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${(wrongCount / totalReal) * 100}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold tabular-nums">
            <span className="inline-flex items-center gap-1.5 text-teal-ink">
              <CheckCircle2 className="h-4 w-4" />
              ตอบถูกแล้ว {masteredCount} ข้อ
            </span>
            <span className="inline-flex items-center gap-1.5 text-accent">
              <XCircle className="h-4 w-4" />
              ยังทำผิด {wrongCount} ข้อ
            </span>
            <span className="text-muted">ยังไม่เคยทำ {unseenCount} ข้อ</span>
          </div>
        </div>

        {isPerfectMastery && (
          <div className="flex items-center gap-2.5 rounded-xl border border-teal/40 bg-teal/10 px-4 py-3 text-xs font-bold text-teal-ink">
            <Award className="h-5 w-5 shrink-0" />
            <span>
              ผ่านสมบูรณ์ 100% ครบทั้ง {totalReal} ข้อ ไม่มีข้อผิดเหลือเลย! พร้อมลงสนามสอบจริงแล้วครับ
            </span>
          </div>
        )}
      </div>

      {/* Adaptive Mastery Loop Box (Auto-Fill Mix 150 + Wrong Only) */}
      <div className="rounded-card border border-brand/30 bg-brand/[0.04] p-5 shadow-card space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-ink">
              โหมดซ่อมวนจนกว่าจะถูก 100% (เฉพาะ {sets.length} ชุดนี้)
            </h2>
            <p className="mt-0.5 text-xs text-muted leading-relaxed">
              ระบบจะดึง<strong>ข้อที่ทำผิด</strong>และ<strong>ข้อที่ยังไม่เคยทำ</strong>ใน {sets.length} ชุดนี้มาขึ้นก่อน ถ้าเหลือไม่ครบ 150 ข้อจะสุ่มข้อที่เคยถูกจากใน {sets.length} ชุดนี้มาผสมเติมให้ครบ 150 ข้ออัตโนมัติ (เรียงลำดับข้อ 1–150 ตามสนามจริง)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/exam/real-mix?mode=practice&fresh=1"
            className="inline-flex items-center gap-1.5 rounded-btn bg-brand px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            <Flame className="h-4 w-4" />
            <span>
              ชุดผสมซ่อมวน 150 ข้อ (ฝึกเฉลยทันที · ข้อต้องเก็บ {priorityMixCount})
            </span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          <Link
            href="/exam/real-mix?mode=real&fresh=1"
            className="inline-flex items-center gap-1.5 rounded-btn border border-brand/40 bg-panel px-4 py-2.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/10"
          >
            <Clock className="h-4 w-4" />
            <span>ชุดผสม 150 ข้อ (จับเวลาสอบจริง)</span>
          </Link>

          {wrongCount > 0 && (
            <Link
              href="/exam/real-mistakes?mode=practice&fresh=1"
              className="inline-flex items-center gap-1.5 rounded-btn border border-accent/40 bg-accent/10 px-4 py-2.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/15"
            >
              <XCircle className="h-4 w-4" />
              <span>ซ่อมเฉพาะข้อที่ผิด ({wrongCount} ข้อ)</span>
            </Link>
          )}

          <Link
            href="/weakness?scope=real-exam"
            className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-panel px-4 py-2.5 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand"
          >
            <BarChart3 className="h-4 w-4 text-brand" />
            <span>วิเคราะห์จุดอ่อน {sets.length} ชุดนี้แบบเจาะลึก</span>
          </Link>
        </div>
      </div>

      {/* 3 Fixed Isolated Real-Exam Sets */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand" />
            <span>ชุดข้อสอบสนามจริงล็อกตายตัว ({sets.length} ชุด · {totalReal} ข้อ)</span>
          </h2>
          <span className="text-xs text-muted">จำคำตอบค้างแยกแต่ละชุด</span>
        </div>

        <div className="space-y-3.5">
          {sets.map((s) => {
            let setRight = 0;
            let setWrong = 0;
            for (const qid of s.questionIds) {
              if (realCorrectSet.has(qid)) setRight++;
              else if (realMistakeSet.has(qid)) setWrong++;
            }
            const setUnseen = Math.max(0, s.questionIds.length - setRight - setWrong);
            const setPct = Math.round((setRight / s.questionIds.length) * 100);
            const draft = setDrafts[s.id];

            return (
              <div
                key={s.id}
                className="rounded-card border border-line bg-panel p-5 shadow-card transition-colors hover:border-brand/40"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-accent/12 px-2.5 py-0.5 text-xs font-bold text-accent">
                        {s.badge || `ข้อสอบจริง ชุดที่ ${s.index}`}
                      </span>
                      <span className="text-xs font-medium text-muted tabular-nums">
                        {s.questionIds.length} ข้อ · {s.questionIds.length === 150 ? '180 นาที' : `${s.questionIds.length} นาที`}
                      </span>
                      <span className="rounded-md bg-bg2 border border-line px-2 py-0.5 text-[11px] font-medium text-muted tabular-nums">
                        มีภาพ SVG {s.svgCount} ข้อ + ข้อความ {s.questionIds.length - s.svgCount} ข้อ
                      </span>
                      {draft && draft.answeredCount > 0 && (
                        <span className="rounded-md bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold-ink tabular-nums">
                          ทำค้างไว้ {draft.answeredCount}/{draft.total} ข้อ
                        </span>
                      )}
                    </div>

                    <h3 className="mt-2 text-base font-bold text-ink">{s.title}</h3>

                    {/* Per-set Mastery Bar */}
                    <div className="mt-2.5 max-w-md space-y-1">
                      <div className="flex items-center justify-between text-[11px] tabular-nums">
                        <span className="font-semibold text-ink">
                          ถูกแล้ว {setRight}/{s.questionIds.length} ข้อ ({setPct}%)
                        </span>
                        <span className="text-muted">
                          ผิด <strong className="text-accent">{setWrong}</strong> · ยังไม่ทำ {setUnseen}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg2 flex">
                        <div
                          className="h-full bg-teal transition-all"
                          style={{ width: `${(setRight / s.questionIds.length) * 100}%` }}
                        />
                        <div
                          className="h-full bg-accent transition-all"
                          style={{ width: `${(setWrong / s.questionIds.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Subject Breakdown */}
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {Object.entries(s.subjectBreakdown).map(([k, count]) => {
                        const sk = k as SubjectKey;
                        const subMeta = SUBJECT_MAP[sk];
                        if (!subMeta || !count) return null;
                        return (
                          <span
                            key={sk}
                            className="inline-flex items-center gap-1 rounded-md border border-line bg-bg2/60 px-2 py-0.5 text-[11px] font-medium text-muted tabular-nums"
                          >
                            <SubjectIcon subjectKey={sk} size="sm" />
                            <span>
                              {subMeta.shortName} {count}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap shrink-0 items-center gap-2">
                    {draft && draft.answeredCount > 0 && (
                      <Link
                        href={`/exam/${s.id}?mode=${draft.mode}`}
                        className="inline-flex items-center gap-1.5 rounded-btn bg-gold px-3.5 py-2 text-xs font-bold text-ink hover:opacity-90"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        <span>ทำต่อ ({draft.answeredCount}/{draft.total})</span>
                      </Link>
                    )}
                    {setWrong > 0 && (
                      <Link
                        href={`/exam/${s.id}?pool=wrong&mode=practice&fresh=1`}
                        className="inline-flex items-center gap-1.5 rounded-btn border border-accent/40 bg-accent/10 px-3.5 py-2 text-xs font-semibold text-accent hover:bg-accent/15"
                      >
                        <span>ซ่อมข้อผิด ({setWrong})</span>
                      </Link>
                    )}
                    <Link
                      href={`/exam/${s.id}?mode=practice&fresh=1`}
                      className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-panel px-4 py-2 text-xs font-semibold text-ink hover:border-brand/50 hover:text-brand"
                    >
                      <span>ฝึกซ้อม</span>
                    </Link>
                    <Link
                      href={`/exam/${s.id}?mode=real&fresh=1`}
                      className="inline-flex items-center gap-1.5 rounded-btn bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
                    >
                      <span>สอบจริง</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

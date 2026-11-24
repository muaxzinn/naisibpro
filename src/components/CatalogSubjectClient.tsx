'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Layers,
  RotateCcw,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import { SUBJECT_MAP, SUBJECTS, type SubjectKey } from '@/lib/constants';
import { useProfileHistory } from '@/lib/use-profile-history';
import { SubjectIcon } from '@/components/SubjectIcon';
import { QuestionPoolSettingsBar } from '@/components/QuestionPoolSettingsBar';
import { useWorkspaceMode } from '@/components/WorkspaceModeProvider';

export interface SubjectOverviewItem {
  key: SubjectKey;
  count: number;
  subSetCount: number;
  questionIds: number[];
  topics: Array<{ title: string; count: number }>;
}

interface CatalogSubjectClientProps {
  items: SubjectOverviewItem[];
  realExamItems?: SubjectOverviewItem[];
}

export function CatalogSubjectClient({
  items: practiceItems,
  realExamItems,
}: CatalogSubjectClientProps) {
  const { workspaceMode } = useWorkspaceMode();
  const isRealMode = workspaceMode === 'real-exam' && Boolean(realExamItems?.length);
  const items = isRealMode && realExamItems ? realExamItems : practiceItems;

  const [activeKey, setActiveKey] = useState<SubjectKey>(items[0]?.key || 'math');
  const [chunkSize, setChunkSize] = useState<20 | 50>(20);
  const [showAllSets, setShowAllSets] = useState(false);

  const {
    correctSet: mainCorrectSet,
    mistakeSet: mainMistakeSet,
    allCompletedSet: mainCompletedSet,
    realCorrectSet,
    realMistakeSet,
    realAttemptedSet,
    excludeCompleted,
    saving,
    toggleExcludeCompleted,
    resetCompleted,
    resetRealExam,
    resetForSubject,
  } = useProfileHistory();

  const correctSet = isRealMode ? realCorrectSet : mainCorrectSet;
  const mistakeSet = isRealMode ? realMistakeSet : mainMistakeSet;
  const allCompletedSet = isRealMode ? realAttemptedSet : mainCompletedSet;
  void resetRealExam;

  const totalCatalogQuestions = useMemo(
    () => items.reduce((sum, it) => sum + it.count, 0),
    [items]
  );

  const activeMeta = SUBJECT_MAP[activeKey] || SUBJECTS[0];
  const activeData = useMemo(
    () => items.find((i) => i.key === activeKey) || items[0],
    [items, activeKey]
  );

  const activeProgress = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    for (const qid of activeData?.questionIds || []) {
      if (correctSet.has(qid)) correct++;
      else if (mistakeSet.has(qid)) wrong++;
    }
    const done = correct + wrong;
    const total = activeData?.count || 0;
    const remaining = Math.max(0, total - done);
    return { correct, wrong, done, total, remaining };
  }, [activeData, correctSet, mistakeSet]);

  const effectiveTotal = excludeCompleted ? activeProgress.remaining : activeProgress.total;
  const excludeParam = excludeCompleted ? '&excludeCompleted=1' : '&excludeCompleted=0';

  const totalSets = effectiveTotal > 0 ? Math.max(1, Math.ceil(effectiveTotal / chunkSize)) : 0;
  const setsArray = useMemo(() => {
    if (effectiveTotal <= 0) return [];
    return Array.from({ length: totalSets }, (_, idx) => {
      const setNum = idx + 1;
      const startQ = idx * chunkSize + 1;
      const endQ = Math.min(effectiveTotal, setNum * chunkSize);
      const qCount = Math.max(0, endQ - startQ + 1);
      return { setNum, startQ, endQ, qCount };
    });
  }, [effectiveTotal, chunkSize, totalSets]);

  const visibleSets = showAllSets ? setsArray : setsArray.slice(0, 12);

  return (
    <div className="space-y-6">
      <QuestionPoolSettingsBar
        totalQuestions={totalCatalogQuestions}
        correctCount={correctSet.size}
        wrongCount={mistakeSet.size}
        excludeCompleted={excludeCompleted}
        onToggleExclude={toggleExcludeCompleted}
        saving={saving}
        onOpenReset={() => {
          if (
            window.confirm(
              `ต้องการรีเซ็ตประวัติข้อสอบที่เคยทำทั้งหมด (${allCompletedSet.size} ข้อ) เพื่อให้นำกลับมาฝึกใหม่ทุกวิชาใช่หรือไม่?`
            )
          ) {
            void resetCompleted({ scope: 'all', pool: 'all' });
          }
        }}
      />

      {/* 7 Subject Selector Tabs */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
        {SUBJECTS.map((sub) => {
          const info = items.find((it) => it.key === sub.key);
          const selected = sub.key === activeKey;
          const doneInSub = (info?.questionIds || []).filter((id) => allCompletedSet.has(id)).length;
          const totalInSub = info?.count || 0;
          const remInSub = Math.max(0, totalInSub - doneInSub);
          return (
            <button
              key={sub.key}
              type="button"
              onClick={() => {
                setActiveKey(sub.key);
                setShowAllSets(false);
              }}
              className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors ${
                selected
                  ? 'border-brand bg-brand/10'
                  : 'border-line bg-panel hover:border-brand/50'
              }`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <SubjectIcon subjectKey={sub.key} size="sm" />
                <span className="text-[11px] font-medium text-muted tabular-nums">
                  {excludeCompleted && doneInSub > 0
                    ? `ใหม่ ${remInSub}/${totalInSub}`
                    : `${totalInSub.toLocaleString('en-US')} ข้อ`}
                </span>
              </div>
              <div className={`text-xs leading-snug ${selected ? 'font-semibold text-brand' : 'font-medium text-ink'}`}>
                {sub.shortName}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Subject Banner & Random Intense Drill */}
      <section className="rounded-card border border-line bg-panel p-5 shadow-card">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3.5">
            <SubjectIcon subjectKey={activeMeta.key} size="lg" />
            <div>
              <div className="text-xs font-medium text-muted">
                {activeMeta.grp === 'general' ? 'ภาคความรู้ความสามารถทั่วไป' : 'ภาคความรู้เฉพาะตำแหน่ง'}
              </div>
              <h2 className="mt-0.5 text-xl font-bold text-ink sm:text-2xl">
                {activeMeta.name}
              </h2>
              <p className="mt-1 text-xs text-muted tabular-nums">
                ทั้งหมด <strong className="font-semibold text-ink">{activeProgress.total.toLocaleString('en-US')} ข้อ</strong> ·{' '}
                ทำแล้ว <strong className="font-semibold text-ink">{activeProgress.done}</strong> (ถูก{' '}
                <strong className="font-semibold text-teal-ink">{activeProgress.correct}</strong> · ผิด{' '}
                <strong className="font-semibold text-accent">{activeProgress.wrong}</strong>) · เหลือใหม่{' '}
                <strong className="font-semibold text-brand">{activeProgress.remaining.toLocaleString('en-US')} ข้อ</strong>
              </p>
            </div>
          </div>

          {/* Quick Random Subject Drills */}
          {effectiveTotal > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {[20, 50, 100].map((qty) => (
                <Link
                  key={qty}
                  href={
                    isRealMode
                      ? `/exam/real-mix?subject=${activeMeta.key}&count=${Math.min(qty, effectiveTotal)}&mode=practice&fresh=1`
                      : `/exam/subject-${activeMeta.key}?count=${Math.min(qty, effectiveTotal)}&mode=practice&fresh=1${excludeParam}`
                  }
                  className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-bg2/50 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-brand/50 hover:text-brand tabular-nums"
                >
                  <Shuffle className="h-3.5 w-3.5 text-brand" />
                  <span>สุ่มฝึก {Math.min(qty, effectiveTotal)} ข้อ</span>
                </Link>
              ))}
              <Link
                href={
                  isRealMode
                    ? `/exam/real-mix?subject=${activeMeta.key}&count=${Math.min(50, effectiveTotal)}&mode=real&fresh=1`
                    : `/exam/subject-${activeMeta.key}?count=${Math.min(50, effectiveTotal)}&mode=real&fresh=1${excludeParam}`
                }
                className="inline-flex items-center gap-1.5 rounded-btn bg-brand px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-dark tabular-nums"
              >
                <span>สอบจับเวลา {Math.min(50, effectiveTotal)} ข้อ</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/catalog/completed"
                className="inline-flex items-center gap-1.5 rounded-btn bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
              >
                <span>ทบทวนข้อที่เคยทำแล้ว</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Structured Ordered Sub-Sets */}
      <section className="rounded-card border border-line bg-panel p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Layers className="h-4 w-4 text-brand" />
              <span>
                {excludeCompleted && activeProgress.done > 0
                  ? `ชุดข้อสอบเฉพาะข้อใหม่ที่ยังไม่เคยทำ (${totalSets} ชุด · ${effectiveTotal} ข้อ)`
                  : `ชุดข้อสอบแยกรายวิชา (เรียงลำดับ · ${totalSets} ชุด)`}
              </span>
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              ทำไล่ทีละชุดเพื่อให้ครบทุกข้อในวิชา {activeMeta.name}
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-line bg-bg2/60 p-0.5 text-xs font-medium">
            {([20, 50] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => {
                  setChunkSize(sz);
                  setShowAllSets(false);
                }}
                className={`rounded-md px-3 py-1 transition-colors tabular-nums ${
                  chunkSize === sz ? 'bg-panel text-brand font-semibold shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                ชุดละ {sz} ข้อ
              </button>
            ))}
          </div>
        </div>

        {setsArray.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-teal/40 bg-teal/10 p-6 text-center space-y-3">
            <p className="text-sm font-extrabold text-teal-ink inline-flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              <span>ยอดเยี่ยม! คุณทำข้อสอบวิชา{activeMeta.name} ครบทุกข้อแล้ว</span>
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <Link
                href="/catalog/completed"
                className="rounded-btn bg-brand px-4 py-2 text-xs font-extrabold text-white hover:bg-brand-dark"
              >
                ไปจัดชุดข้อสอบที่เคยทำแล้ว
              </Link>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (window.confirm(`ต้องการรีเซ็ตประวัติวิชา${activeMeta.name} เพื่อเริ่มนับใหม่หรือไม่?`)) {
                    void resetForSubject(activeMeta.key, 'all');
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-panel px-4 py-2 text-xs font-bold text-ink hover:border-accent/50 hover:text-accent"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>รีเซ็ตประวัติวิชานี้</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleSets.map(({ setNum, startQ, endQ, qCount }) => (
                <div
                  key={`${activeMeta.key}-${chunkSize}-${setNum}`}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-line bg-bg2/60 p-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-extrabold text-brand">
                        {activeMeta.shortName} · ชุดที่ {setNum}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-muted">
                        <Clock className="h-3 w-3" />
                        {qCount} นาที
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted">
                      ช่วงข้อที่ <span className="font-mono font-bold text-ink">{startQ}–{endQ}</span> ({qCount} ข้อ)
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href={
                        isRealMode
                          ? `/exam/real-mix?subject=${activeMeta.key}&count=${chunkSize}&mode=practice&fresh=1`
                          : `/exam/subject-${activeMeta.key}?set=${setNum}&count=${chunkSize}&mode=practice&fresh=1${excludeParam}`
                      }
                      className="flex-1 rounded-xl border border-line bg-panel py-2 text-center text-xs font-bold text-ink transition-colors hover:border-brand/50 hover:text-brand"
                    >
                      โหมดฝึกซ้อม
                    </Link>
                    <Link
                      href={
                        isRealMode
                          ? `/exam/real-mix?subject=${activeMeta.key}&count=${chunkSize}&mode=real&fresh=1`
                          : `/exam/subject-${activeMeta.key}?set=${setNum}&count=${chunkSize}&mode=real&fresh=1${excludeParam}`
                      }
                      className="flex-1 rounded-xl bg-brand py-2 text-center text-xs font-bold text-white transition-colors hover:bg-brand-dark"
                    >
                      จับเวลาจริง
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {setsArray.length > 12 && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowAllSets((v) => !v)}
                  className="rounded-btn border border-line bg-bg2 px-5 py-2 text-xs font-bold text-ink transition-colors hover:border-brand/50 hover:text-brand"
                >
                  {showAllSets
                    ? 'ย่อรายการชุดข้อสอบ'
                    : `แสดงชุดที่ 13 – ${setsArray.length} เพิ่มเติม (อีก ${setsArray.length - 12} ชุด)`}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Sub-Topics Drill List */}
      {activeData?.topics.length > 0 && (
        <section className="rounded-card border border-line bg-panel p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-base font-extrabold text-ink">
              <BookOpen className="h-4 w-4 text-teal-ink" />
              <span>เจาะลึกตามหัวข้อย่อยในวิชา {activeMeta.shortName} ({activeData.topics.length} หัวข้อ)</span>
            </div>
            <Link
              href="/catalog/topics"
              className="text-xs font-bold text-brand hover:underline"
            >
              เปิดหน้าแยกหัวข้อย่อยเต็มรูปแบบ →
            </Link>
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {activeData.topics.map((t) => (
              <Link
                key={t.title}
                href={
                  isRealMode
                    ? `/exam/real-mix?subject=${activeMeta.key}&topic=${encodeURIComponent(t.title)}&mode=practice&fresh=1`
                    : `/exam/topic?subject=${activeMeta.key}&topic=${encodeURIComponent(t.title)}&count=30&mode=practice&fresh=1${excludeParam}`
                }
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-bg2/60 px-3.5 py-2.5 text-xs transition-colors hover:border-brand/50 hover:text-brand"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-teal-ink" />
                  <span className="truncate font-semibold text-ink">{t.title}</span>
                </div>
                <span className="shrink-0 font-mono font-bold text-brand">{t.count} ข้อ</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

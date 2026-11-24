'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  Search,
  Shuffle,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { ACTIVE_SUBJECTS, SUBJECT_MAP, type SubjectKey } from '@/lib/constants';
import type { CompletedPoolMode } from '@/lib/question-pool';
import type { SubTopicCatalogItem } from '@/lib/topic-catalog';
import { useProfileHistory } from '@/lib/use-profile-history';
import { SubjectIcon } from '@/components/SubjectIcon';
import { QuestionPoolSettingsBar } from '@/components/QuestionPoolSettingsBar';
import { useWorkspaceMode } from '@/components/WorkspaceModeProvider';

type StructureMode = 'form150' | 'subject' | 'topic';

interface CatalogCompletedClientProps {
  topicsBySubject: Record<SubjectKey, SubTopicCatalogItem[]>;
  totalCatalogQuestions: number;
  realExamTopicsBySubject?: Record<SubjectKey, SubTopicCatalogItem[]>;
  realExamTotalQuestions?: number;
}

export function CatalogCompletedClient({
  topicsBySubject: practiceTopicsBySubject,
  totalCatalogQuestions: practiceTotalQuestions,
  realExamTopicsBySubject,
  realExamTotalQuestions,
}: CatalogCompletedClientProps) {
  const { workspaceMode } = useWorkspaceMode();
  const isRealMode =
    workspaceMode === 'real-exam' && Boolean(realExamTopicsBySubject);
  const topicsBySubject =
    isRealMode && realExamTopicsBySubject ? realExamTopicsBySubject : practiceTopicsBySubject;
  const totalCatalogQuestions =
    isRealMode && typeof realExamTotalQuestions === 'number'
      ? realExamTotalQuestions
      : practiceTotalQuestions;

  const formRoute = isRealMode ? 'real-completed' : 'completed-form';
  const subjectRoute = isRealMode ? 'real-completed' : 'completed-subject';
  const topicRoute = isRealMode ? 'real-completed' : 'completed-topic';

  const {
    correctSet: mainCorrectSet,
    mistakeSet: mainMistakeSet,
    allCompletedSet: mainCompletedSet,
    realCorrectSet,
    realMistakeSet,
    realAttemptedSet,
    excludeCompleted,
    loading,
    saving,
    toggleExcludeCompleted,
    resetCompleted,
    resetRealExam,
    resetForSubject,
    resetForTopic,
  } = useProfileHistory();

  const correctSet = isRealMode ? realCorrectSet : mainCorrectSet;
  const mistakeSet = isRealMode ? realMistakeSet : mainMistakeSet;
  const allCompletedSet = isRealMode ? realAttemptedSet : mainCompletedSet;
  void resetRealExam;

  const [poolMode, setPoolMode] = useState<CompletedPoolMode>('all');
  const [structureMode, setStructureMode] = useState<StructureMode>('form150');
  const [subjectChunkSize, setSubjectChunkSize] = useState<20 | 50>(20);
  const [topicChunkSize, setTopicChunkSize] = useState<15 | 20 | 30>(20);
  const [topicSubjectFilter, setTopicSubjectFilter] = useState<SubjectKey | 'all'>('all');
  const [topicQuery, setTopicQuery] = useState('');
  const [selectedCompletedTopicKey, setSelectedCompletedTopicKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const activeIdSet = useMemo(() => {
    if (poolMode === 'correct') return correctSet;
    if (poolMode === 'wrong') return mistakeSet;
    return allCompletedSet;
  }, [poolMode, correctSet, mistakeSet, allCompletedSet]);

  const poolLabel =
    poolMode === 'correct'
      ? 'เฉพาะข้อที่ทำถูกอย่างเดียว'
      : poolMode === 'wrong'
        ? 'เฉพาะข้อที่ทำผิดอย่างเดียว'
        : 'รวมที่เคยทำทั้งหมด';

  const subjectStats = useMemo(() => {
    return ACTIVE_SUBJECTS.map((sub) => {
      const topics = topicsBySubject[sub.key] || [];
      let totalInSubject = 0;
      let matchCount = 0;
      let correctCount = 0;
      let wrongCount = 0;
      for (const tp of topics) {
        totalInSubject += tp.questionIds.length;
        for (const qid of tp.questionIds) {
          if (activeIdSet.has(qid)) matchCount++;
          if (correctSet.has(qid)) correctCount++;
          if (mistakeSet.has(qid)) wrongCount++;
        }
      }
      return {
        meta: sub,
        totalInSubject,
        matchCount,
        correctCount,
        wrongCount,
      };
    });
  }, [topicsBySubject, activeIdSet, correctSet, mistakeSet]);

  const activeTotalCount = useMemo(
    () => Math.max(activeIdSet.size, subjectStats.reduce((sum, s) => sum + s.matchCount, 0)),
    [activeIdSet.size, subjectStats]
  );

  const form150Sets = useMemo(() => {
    const count = activeTotalCount;
    if (count === 0) return [];
    const chunk = 150;
    const totalSets = Math.ceil(count / chunk);
    return Array.from({ length: totalSets }, (_, idx) => {
      const setNum = idx + 1;
      const startQ = idx * chunk + 1;
      const endQ = Math.min(count, setNum * chunk);
      const qCount = endQ - startQ + 1;
      return { setNum, startQ, endQ, qCount };
    });
  }, [activeTotalCount]);

  const matchingTopics = useMemo(() => {
    const qLower = topicQuery.trim().toLowerCase();
    const list: Array<
      SubTopicCatalogItem & {
        matchCount: number;
        correctInTopic: number;
        wrongInTopic: number;
      }
    > = [];

    for (const sub of ACTIVE_SUBJECTS) {
      if (topicSubjectFilter !== 'all' && sub.key !== topicSubjectFilter) continue;
      for (const item of topicsBySubject[sub.key] || []) {
        let matchCount = 0;
        let correctInTopic = 0;
        let wrongInTopic = 0;
        for (const qid of item.questionIds) {
          if (activeIdSet.has(qid)) matchCount++;
          if (correctSet.has(qid)) correctInTopic++;
          if (mistakeSet.has(qid)) wrongInTopic++;
        }
        if (matchCount === 0) continue;
        if (qLower) {
          const hit =
            item.displayTitle.toLowerCase().includes(qLower) ||
            item.title.toLowerCase().includes(qLower) ||
            item.category.toLowerCase().includes(qLower) ||
            SUBJECT_MAP[item.subjectKey].name.toLowerCase().includes(qLower);
          if (!hit) continue;
        }
        list.push({
          ...item,
          matchCount,
          correctInTopic,
          wrongInTopic,
        });
      }
    }
    return list.sort((a, b) => b.matchCount - a.matchCount);
  }, [topicsBySubject, topicSubjectFilter, topicQuery, activeIdSet, correctSet, mistakeSet]);

  const pushNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => {
      setNotice((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const handleResetAllInTab = async () => {
    if (activeIdSet.size === 0 || saving) return;
    if (
      !window.confirm(
        `ต้องการรีเซ็ตประวัติข้อสอบในหมวด "${poolLabel}" (${activeIdSet.size} ข้อ) เพื่อให้นับเป็นข้อใหม่ทั้งหมดหรือไม่?`
      )
    ) {
      return;
    }
    await resetCompleted({ scope: 'all', pool: poolMode });
    pushNotice(`รีเซ็ตประวัติในหมวด "${poolLabel}" เรียบร้อยแล้ว`);
  };

  return (
    <div className="space-y-6">
      <QuestionPoolSettingsBar
        totalQuestions={totalCatalogQuestions}
        correctCount={correctSet.size}
        wrongCount={mistakeSet.size}
        excludeCompleted={excludeCompleted}
        onToggleExclude={toggleExcludeCompleted}
        saving={saving}
        compact={true}
      />

      {notice && (
        <div className="rounded-2xl border border-teal/40 bg-teal/10 px-4 py-2.5 text-xs font-bold text-teal-ink flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* 3 Pool Status Tabs + Reset Button */}
      <section className="rounded-card border border-line bg-panel p-4 sm:p-5 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-ink flex items-center gap-2">
              <Archive className="h-4 w-4 text-brand" />
              <span>1. เลือกกลุ่มข้อสอบที่เคยทำแล้ว</span>
            </h2>
            <p className="text-xs text-muted mt-0.5">
              แยกจัดชุดใหม่ได้ทั้งแบบรวมทั้งหมด ทำถูกอย่างเดียว หรือทำผิดอย่างเดียว
            </p>
          </div>

          {activeIdSet.size > 0 && (
            <button
              type="button"
              disabled={saving}
              onClick={handleResetAllInTab}
              className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-extrabold text-accent transition hover:bg-accent hover:text-white disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>ล้างประวัติหมวดนี้ ({activeIdSet.size} ข้อ)</span>
            </button>
          )}
        </div>

        <div
          role="tablist"
          aria-label="แท็บกลุ่มข้อสอบที่เคยทำแล้ว"
          className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
        >
          {(
            [
              {
                key: 'all',
                label: 'รวมที่เคยทำทั้งหมด',
                count: allCompletedSet.size,
                desc: 'รวมทุกข้อที่เคยตอบแล้ว (ทั้งถูกและผิด)',
                icon: Layers,
                accent: 'brand',
              },
              {
                key: 'correct',
                label: 'ทำถูกอย่างเดียว',
                count: correctSet.size,
                desc: 'เฉพาะข้อที่ตอบถูกครั้งล่าสุด ทบทวนย้ำความจำ',
                icon: CheckCircle2,
                accent: 'teal',
              },
              {
                key: 'wrong',
                label: 'ทำผิดอย่างเดียว',
                count: mistakeSet.size,
                desc: 'เฉพาะข้อที่ตอบผิดครั้งล่าสุด เจาะซ่อมจุดอ่อน',
                icon: XCircle,
                accent: 'accent',
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = poolMode === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setPoolMode(tab.key);
                  setSelectedCompletedTopicKey(null);
                }}
                className={`flex flex-col justify-between gap-2 rounded-2xl border p-4 text-left transition ${
                  active
                    ? 'border-brand bg-brand/10 ring-2 ring-brand/25'
                    : 'border-line bg-bg2/60 hover:border-brand/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold ${
                      active ? 'text-brand' : 'text-ink'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        tab.accent === 'teal'
                          ? 'text-teal-ink'
                          : tab.accent === 'accent'
                            ? 'text-accent'
                            : 'text-brand'
                      }`}
                    />
                    <span>{tab.label}</span>
                  </span>
                  <span className="font-mono text-sm font-extrabold text-brand">
                    {tab.count.toLocaleString('en-US')} ข้อ
                  </span>
                </div>
                <p className="text-[11px] text-muted leading-snug">{tab.desc}</p>
              </button>
            );
          })}
        </div>

        {/* 3 Structure Mode Tabs */}
        <div className="pt-2 border-t border-line space-y-2.5">
          <div className="text-xs font-extrabold text-muted">
            2. เลือกรูปแบบการจัดชุดข้อสอบใหม่จากกลุ่มนี้ ({poolLabel}):
          </div>
          <div
            role="tablist"
            aria-label="รูปแบบการจัดชุดข้อสอบที่เคยทำแล้ว"
            className="grid grid-cols-1 sm:grid-cols-3 gap-2"
          >
            {(
              [
                {
                  key: 'form150',
                  label: 'ชุดข้อสอบรวม 150 ข้อ',
                  sub: `${form150Sets.length || 0} ชุดใหญ่`,
                  icon: FileSpreadsheet,
                },
                {
                  key: 'subject',
                  label: 'แยกรายวิชา (7 วิชา)',
                  sub: `${subjectStats.filter((s) => s.matchCount > 0).length} วิชาที่มีข้อมูล`,
                  icon: Layers,
                },
                {
                  key: 'topic',
                  label: 'แยกหัวข้อย่อยรายบท',
                  sub: 'Word, Excel, อาญา, อนุกรม ฯลฯ',
                  icon: BookOpenCheck,
                },
              ] as const
            ).map((view) => {
              const Icon = view.icon;
              const active = structureMode === view.key;
              return (
                <button
                  key={view.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStructureMode(view.key)}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition ${
                    active
                      ? 'border-brand bg-brand text-white shadow-sm'
                      : 'border-line bg-bg2 text-ink hover:border-brand/50'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 text-xs font-extrabold">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{view.label}</span>
                  </span>
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      active ? 'text-white/90' : 'text-muted'
                    }`}
                  >
                    {view.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      {loading ? (
        <div className="rounded-card border border-line bg-panel p-12 flex flex-col items-center gap-3 shadow-card">
          <Loader2 className="h-7 w-7 animate-spin text-brand" />
          <p className="text-xs font-bold text-muted">กำลังโหลดประวัติข้อสอบที่เคยทำ...</p>
        </div>
      ) : activeTotalCount === 0 ? (
        <div className="rounded-card border border-line bg-panel p-10 text-center space-y-4 shadow-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-extrabold text-ink">
              ยังไม่มีข้อสอบในกลุ่ม &ldquo;{poolLabel}&rdquo;
            </h3>
            <p className="text-xs sm:text-sm text-muted max-w-md mx-auto">
              เมื่อคุณทำข้อสอบในหน้าหัวข้อย่อย แยกรายวิชา หรือข้อสอบจำลอง 150 ข้อ ระบบจะรวบรวมข้อที่เคยทำมาจัดเป็นชุดใหม่ให้ที่นี่โดยอัตโนมัติ
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2.5 pt-1">
            <Link
              href="/catalog/topics"
              className="inline-flex items-center gap-1.5 rounded-btn bg-brand px-4 py-2.5 text-xs font-extrabold text-white hover:bg-brand-dark"
            >
              <BookOpenCheck className="h-4 w-4" />
              <span>ไปฝึกตามหัวข้อย่อย</span>
            </Link>
            <Link
              href="/catalog/subject"
              className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-bg2 px-4 py-2.5 text-xs font-bold text-ink hover:border-brand/50"
            >
              <Layers className="h-4 w-4 text-teal-ink" />
              <span>ไปฝึกแยกรายวิชา</span>
            </Link>
          </div>
        </div>
      ) : structureMode === 'form150' ? (
        /* Structure 1: 150-Question Master Sets */
        <section className="space-y-4">
          <div className="rounded-card border border-line bg-panel p-5 shadow-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-ink flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-brand" />
                  <span>
                    ชุดข้อสอบรวม 150 ข้อ จากกลุ่ม &ldquo;{poolLabel}&rdquo; ({activeTotalCount.toLocaleString('en-US')} ข้อ)
                  </span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  แบ่งเรียงตามลำดับชุดละ 150 ข้อ หรือเลือกสุ่มจำนวนข้อจากคลังที่เคยทำทั้งหมด
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[50, 100, 150].map((qty) => (
                  <Link
                    key={qty}
                    href={`/exam/${formRoute}?pool=${poolMode}&count=${qty}&shuffle=1&mode=practice&fresh=1`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-bg2 px-3 py-2 text-xs font-bold text-ink transition hover:border-brand/50 hover:text-brand"
                  >
                    <Shuffle className="h-3.5 w-3.5 text-brand" />
                    <span>สุ่มฝึก {Math.min(qty, activeTotalCount)} ข้อ</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Subject distribution chips */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-line/70">
              {subjectStats
                .filter((s) => s.matchCount > 0)
                .map((s) => (
                  <Link
                    key={s.meta.key}
                    href={`/exam/${formRoute}?pool=${poolMode}&subject=${s.meta.key}&count=150&mode=practice&fresh=1`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-bg2/60 px-2.5 py-1 text-xs font-bold text-ink transition hover:border-brand/50 hover:text-brand"
                  >
                    <SubjectIcon subjectKey={s.meta.key} size="sm" />
                    <span>{s.meta.shortName}</span>
                    <span className="font-mono text-[11px] text-brand">{s.matchCount} ข้อ</span>
                  </Link>
                ))}
            </div>
          </div>

          <div className="space-y-3">
            {form150Sets.map((setItem) => (
              <div
                key={setItem.setNum}
                className="rounded-card border border-line bg-panel p-5 shadow-card flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand font-mono text-sm font-extrabold text-white">
                    {setItem.setNum}
                  </span>
                  <div>
                    <h4 className="text-base font-extrabold text-ink">
                      ชุดข้อสอบรวม {poolLabel} · ชุดที่ {setItem.setNum}
                    </h4>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span className="font-mono font-semibold">
                        ช่วงข้อที่ {setItem.startQ}–{setItem.endQ} ({setItem.qCount} ข้อ)
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Clock className="h-3.5 w-3.5" />
                        {Math.max(10, setItem.qCount)} นาที
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/exam/${formRoute}?pool=${poolMode}&set=${setItem.setNum}&count=150&mode=practice&fresh=1`}
                    className="rounded-xl border border-line bg-bg2 px-3.5 py-2 text-xs font-bold text-ink transition hover:border-brand/50 hover:text-brand"
                  >
                    โหมดฝึกซ้อม
                  </Link>
                  <Link
                    href={`/exam/${formRoute}?pool=${poolMode}&set=${setItem.setNum}&count=150&mode=real&fresh=1`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-extrabold text-white transition hover:bg-brand-dark"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>เริ่มจับเวลาทำชุดนี้</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : structureMode === 'subject' ? (
        /* Structure 2: By 7 Subjects */
        <section className="space-y-4">
          <div className="rounded-card border border-line bg-panel p-4 shadow-card flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-ink flex items-center gap-2">
                <Layers className="h-4 w-4 text-brand" />
                <span>จัดชุดแยกรายวิชา 7 วิชา ({poolLabel})</span>
              </h3>
              <p className="text-xs text-muted mt-0.5">
                เลือกทำเฉพาะข้อสอบในแต่ละวิชาที่ตรงกับหมวด &ldquo;{poolLabel}&rdquo; แบ่งชุดเรียงข้อหรือสุ่มฝึกได้ทันที
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-line bg-bg2 p-1 text-xs font-bold">
              {([20, 50] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSubjectChunkSize(sz)}
                  className={`rounded-lg px-3 py-1 transition-colors ${
                    subjectChunkSize === sz ? 'bg-panel text-brand shadow-sm' : 'text-muted hover:text-ink'
                  }`}
                >
                  ชุดละ {sz} ข้อ
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {subjectStats.map(({ meta, totalInSubject, matchCount, correctCount, wrongCount }) => {
              const totalSets = matchCount > 0 ? Math.ceil(matchCount / subjectChunkSize) : 0;
              return (
                <article
                  key={meta.key}
                  className="rounded-card border border-line bg-panel p-5 shadow-card flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <SubjectIcon subjectKey={meta.key} size="md" />
                        <div className="min-w-0">
                          <h4 className="text-base font-extrabold text-ink truncate">{meta.name}</h4>
                          <p className="text-xs text-muted mt-0.5">
                            ทำแล้วในระบบ{' '}
                            <span className="font-mono font-bold text-ink">
                              {correctCount + wrongCount}/{totalInSubject}
                            </span>{' '}
                            (ถูก <span className="text-teal-ink font-bold">{correctCount}</span> · ผิด{' '}
                            <span className="text-accent font-bold">{wrongCount}</span>)
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-sm font-extrabold text-brand shrink-0">
                        {matchCount} ข้อ
                      </span>
                    </div>

                    {matchCount > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {Array.from({ length: Math.min(totalSets, 9) }, (_, idx) => {
                          const setNum = idx + 1;
                          const startQ = idx * subjectChunkSize + 1;
                          const endQ = Math.min(matchCount, setNum * subjectChunkSize);
                          return (
                            <Link
                              key={setNum}
                              href={`/exam/${subjectRoute}?pool=${poolMode}&subject=${meta.key}&set=${setNum}&count=${subjectChunkSize}&mode=practice&fresh=1`}
                              className="flex items-center justify-between gap-1 rounded-xl border border-line bg-bg2/60 px-2.5 py-1.5 text-[11px] font-bold text-ink transition hover:border-brand/50 hover:text-brand"
                            >
                              <span>ชุดที่ {setNum}</span>
                              <span className="font-mono text-[10px] text-muted">
                                {startQ}–{endQ}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="rounded-xl border border-dashed border-line bg-bg2/40 py-4 text-center text-xs text-muted">
                        ยังไม่มีข้อสอบวิชานี้ในหมวด &ldquo;{poolLabel}&rdquo;
                      </p>
                    )}
                  </div>

                  {matchCount > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/exam/${subjectRoute}?pool=${poolMode}&subject=${meta.key}&set=1&count=${subjectChunkSize}&mode=practice&fresh=1`}
                          className="inline-flex items-center gap-1 rounded-xl bg-brand px-3 py-1.5 text-xs font-extrabold text-white hover:bg-brand-dark"
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span>เริ่มชุดที่ 1</span>
                        </Link>
                        <Link
                          href={`/exam/${subjectRoute}?pool=${poolMode}&subject=${meta.key}&count=20&shuffle=1&mode=practice&fresh=1`}
                          className="inline-flex items-center gap-1 rounded-xl border border-line bg-bg2 px-3 py-1.5 text-xs font-bold text-ink hover:border-brand/50 hover:text-brand"
                        >
                          <Shuffle className="h-3.5 w-3.5 text-brand" />
                          <span>สุ่ม {Math.min(20, matchCount)} ข้อ</span>
                        </Link>
                      </div>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={async () => {
                          if (!window.confirm(`รีเซ็ตประวัติวิชา "${meta.name}" ในหมวด ${poolLabel}?`)) return;
                          await resetForSubject(meta.key, poolMode);
                          pushNotice(`รีเซ็ตประวัติวิชา${meta.shortName} เรียบร้อยแล้ว`);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-muted hover:text-accent"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>รีเซ็ตวิชานี้</span>
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        /* Structure 3: Block-Card Drill-Down by Sub-Topics */
        (() => {
          const selectedTopicItem = selectedCompletedTopicKey
            ? matchingTopics.find((t) => `${t.subjectKey}::${t.title}` === selectedCompletedTopicKey) || null
            : null;
          const isTopicLevel1 =
            topicSubjectFilter === 'all' && !topicQuery.trim() && !selectedTopicItem;
          const isTopicLevel3 = selectedTopicItem !== null;

          return (
            <section className="space-y-4">
              <div className="rounded-card border border-line bg-panel p-4 sm:p-5 shadow-card space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
                    <input
                      value={topicQuery}
                      onChange={(e) => {
                        setTopicQuery(e.target.value);
                        setSelectedCompletedTopicKey(null);
                      }}
                      placeholder="ค้นหาหัวข้อย่อยที่เคยทำ เช่น Word, Excel, อาญา, อนุกรม..."
                      className="w-full rounded-xl border border-line bg-bg2/60 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 rounded-xl border border-line bg-bg2 p-1 text-xs font-bold shrink-0">
                    {([15, 20, 30] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setTopicChunkSize(sz)}
                        className={`rounded-lg px-2.5 py-1 transition-colors ${
                          topicChunkSize === sz ? 'bg-panel text-brand shadow-sm' : 'text-muted hover:text-ink'
                        }`}
                      >
                        ชุดละ {sz} ข้อ
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {!isTopicLevel1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setTopicSubjectFilter('all');
                        setTopicQuery('');
                        setSelectedCompletedTopicKey(null);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand/35 bg-brand/10 px-3 py-1 text-xs font-extrabold text-brand transition hover:bg-brand hover:text-white"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>กลับไปเลือกการ์ดวิชาหลัก (7 วิชา)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setTopicSubjectFilter('all');
                      setSelectedCompletedTopicKey(null);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                      topicSubjectFilter === 'all'
                        ? 'border-brand bg-brand text-white'
                        : 'border-line bg-bg2 text-muted hover:text-ink'
                    }`}
                  >
                    ทุกวิชา
                  </button>
                  {subjectStats.map(({ meta, matchCount }) => (
                    <button
                      key={meta.key}
                      type="button"
                      onClick={() => {
                        setTopicSubjectFilter(meta.key);
                        setSelectedCompletedTopicKey(null);
                      }}
                      className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                        topicSubjectFilter === meta.key
                          ? 'border-brand bg-brand text-white'
                          : 'border-line bg-bg2 text-muted hover:text-ink'
                      }`}
                    >
                      {meta.shortName} ({matchCount})
                    </button>
                  ))}
                </div>
              </div>

              {isTopicLevel1 ? (
                /* Level 1: 7 Main Subject Block Cards */
                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                  {subjectStats.map(({ meta, matchCount, correctCount, wrongCount }) => {
                    const topicsWithMatches = (topicsBySubject[meta.key] || []).filter((tp) =>
                      tp.questionIds.some((qid) => activeIdSet.has(qid))
                    );

                    return (
                      <button
                        key={meta.key}
                        type="button"
                        onClick={() => {
                          setTopicSubjectFilter(meta.key);
                          setSelectedCompletedTopicKey(null);
                        }}
                        className="group flex flex-col justify-between gap-4 rounded-card border border-line bg-panel p-5 text-left shadow-card card-hover"
                      >
                        <div className="space-y-2.5 w-full">
                          <div className="flex items-center justify-between gap-2">
                            <SubjectIcon subjectKey={meta.key} size="md" />
                            <span className="text-xs font-medium text-muted tabular-nums">
                              {topicsWithMatches.length} หัวข้อย่อย
                            </span>
                          </div>

                          <div>
                            <h3 className="text-base font-semibold text-ink group-hover:text-brand transition-colors">
                              {meta.name}
                            </h3>
                            <p className="mt-1 text-xs text-muted tabular-nums">
                              {matchCount > 0 ? (
                                <>
                                  {poolLabel} <strong className="font-semibold text-brand">{matchCount} ข้อ</strong> · ถูก{' '}
                                  <span className="font-medium text-teal-ink">{correctCount}</span> · ผิด{' '}
                                  <span className="font-medium text-accent">{wrongCount}</span>
                                </>
                              ) : (
                                <span>ยังไม่มีข้อสอบในกลุ่ม &ldquo;{poolLabel}&rdquo;</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex w-full items-center justify-between gap-2 border-t border-line pt-3 text-xs font-semibold text-brand">
                          <span>เปิดดูการ์ดหัวข้อย่อย ({topicsWithMatches.length} บท)</span>
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : isTopicLevel3 && selectedTopicItem ? (
                /* Level 3: Set Block Cards for Selected Completed Sub-Topic */
                (() => {
                  const item = selectedTopicItem;
                  const subMeta = SUBJECT_MAP[item.subjectKey];
                  const totalSets = Math.max(1, Math.ceil(item.matchCount / topicChunkSize));
                  const topicParam = encodeURIComponent(item.rawTitles.join('||'));

                  return (
                    <div className="space-y-4">
                      <div className="rounded-card border border-line bg-panel p-5 shadow-card space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedCompletedTopicKey(null)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-brand/35 bg-brand/10 px-3.5 py-2 text-xs font-extrabold text-brand transition hover:bg-brand hover:text-white"
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                              <span>กลับไปเลือกการ์ดหัวข้อย่อย</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCompletedTopicKey(null);
                                setTopicSubjectFilter('all');
                                setTopicQuery('');
                              }}
                              className="inline-flex items-center gap-1 rounded-xl border border-line bg-bg2 px-3 py-2 text-xs font-bold text-muted hover:text-ink"
                            >
                              <span>กลับไปการ์ดวิชาหลัก</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={async () => {
                              if (!window.confirm(`รีเซ็ตประวัติหัวข้อ "${item.displayTitle}" ในหมวด ${poolLabel}?`)) {
                                return;
                              }
                              await resetForTopic(item.subjectKey, item.rawTitles.join('||'), poolMode);
                              setSelectedCompletedTopicKey(null);
                              pushNotice(`รีเซ็ตประวัติหัวข้อ "${item.displayTitle}" เรียบร้อยแล้ว`);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent transition hover:bg-accent hover:text-white"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>รีเซ็ตบทนี้ ({item.matchCount} ข้อ)</span>
                          </button>
                        </div>

                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <SubjectIcon subjectKey={item.subjectKey} size="md" />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs font-extrabold text-brand">{subMeta.name}</span>
                                <span className="rounded-full border border-line bg-bg2 px-2 py-0.5 text-[11px] font-bold text-muted">
                                  {item.category}
                                </span>
                              </div>
                              <h3 className="mt-1 text-lg sm:text-xl font-extrabold text-ink break-words">
                                {item.displayTitle.replace(/_/g, ' ')}
                              </h3>
                              <p className="mt-0.5 text-xs text-muted">
                                พบ {item.matchCount}/{item.count} ข้อในหมวด &ldquo;{poolLabel}&rdquo; · ถูก{' '}
                                <strong className="text-teal-ink">{item.correctInTopic}</strong> · ผิด{' '}
                                <strong className="text-accent">{item.wrongInTopic}</strong>
                              </p>
                            </div>
                          </div>

                          <Link
                            href={`/exam/${topicRoute}?pool=${poolMode}&subject=${item.subjectKey}&topic=${topicParam}&count=${item.matchCount}&set=1&mode=practice&fresh=1`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-bg2 px-3.5 py-2 text-xs font-bold text-ink hover:border-brand/50 hover:text-brand"
                          >
                            <Sparkles className="h-3.5 w-3.5 text-teal-ink" />
                            <span>ทำครบทั้งหมด ({item.matchCount} ข้อ)</span>
                          </Link>
                        </div>
                      </div>

                      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: totalSets }, (_, idx) => {
                          const setNum = idx + 1;
                          const startQ = idx * topicChunkSize + 1;
                          const endQ = Math.min(item.matchCount, setNum * topicChunkSize);
                          const qCount = Math.max(0, endQ - startQ + 1);
                          return (
                            <div
                              key={setNum}
                              className="flex flex-col justify-between gap-3 rounded-2xl border border-line bg-panel p-4 shadow-card transition hover:border-brand/50"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="rounded-xl bg-brand/10 px-2.5 py-1 font-mono text-xs font-extrabold text-brand">
                                    ชุดที่ {setNum}
                                  </span>
                                  <span className="inline-flex items-center gap-1 font-mono text-xs text-muted">
                                    <Clock className="h-3.5 w-3.5" />
                                    <span>{Math.max(10, qCount)} นาที</span>
                                  </span>
                                </div>
                                <div className="text-sm font-extrabold text-ink">
                                  ช่วงข้อที่ <span className="font-mono">{startQ}–{endQ}</span> ({qCount} ข้อ)
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-1">
                                <Link
                                  href={`/exam/${topicRoute}?pool=${poolMode}&subject=${item.subjectKey}&topic=${topicParam}&set=${setNum}&count=${topicChunkSize}&mode=practice&fresh=1`}
                                  className="rounded-xl border border-line bg-bg2 py-2 text-center text-xs font-bold text-ink transition hover:border-brand/50 hover:text-brand"
                                >
                                  โหมดฝึกซ้อม
                                </Link>
                                <Link
                                  href={`/exam/${topicRoute}?pool=${poolMode}&subject=${item.subjectKey}&topic=${topicParam}&set=${setNum}&count=${topicChunkSize}&mode=real&fresh=1`}
                                  className="rounded-xl bg-brand py-2 text-center text-xs font-extrabold text-white transition hover:bg-brand-dark"
                                >
                                  จับเวลาจริง
                                </Link>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              ) : matchingTopics.length === 0 ? (
                <div className="rounded-card border border-line bg-panel p-10 text-center space-y-2 shadow-card">
                  <p className="text-base font-extrabold text-ink">ไม่พบหัวข้อย่อยในเงื่อนไขที่เลือก</p>
                  <p className="text-xs text-muted">ลองกดกลับไปเลือกการ์ดวิชาหลักหรือเปลี่ยนคำค้นหาใหม่อีกครั้ง</p>
                </div>
              ) : (
                /* Level 2: Sub-Topic Block Cards */
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {matchingTopics.map((item) => {
                    const subMeta = SUBJECT_MAP[item.subjectKey];
                    const totalSets = Math.max(1, Math.ceil(item.matchCount / topicChunkSize));
                    const topicParam = encodeURIComponent(item.rawTitles.join('||'));
                    const cardId = `${item.subjectKey}::${item.title}`;

                    return (
                      <article
                        key={cardId}
                        className="flex flex-col justify-between gap-4 overflow-hidden rounded-card border border-line bg-panel p-5 shadow-card card-hover"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <SubjectIcon subjectKey={item.subjectKey} size="sm" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-extrabold text-brand">
                                  {subMeta.shortName}
                                </span>
                                <span className="max-w-full truncate rounded-full border border-line bg-bg2 px-2 py-0.5 text-[11px] font-bold text-muted">
                                  {item.category}
                                </span>
                              </div>
                              <h4 className="mt-1 text-base font-extrabold text-ink leading-snug break-words">
                                {item.displayTitle.replace(/_/g, ' ')}
                              </h4>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-line bg-bg2/60 p-2.5">
                              <div className="text-[11px] font-bold text-muted">ข้อในกลุ่มนี้</div>
                              <div className="mt-0.5 font-mono text-sm font-extrabold text-brand">
                                {item.matchCount}/{item.count} ข้อ
                              </div>
                              <div className="font-mono text-[10px] text-muted">
                                ถูก {item.correctInTopic} · ผิด {item.wrongInTopic}
                              </div>
                            </div>
                            <div className="rounded-xl border border-line bg-bg2/60 p-2.5">
                              <div className="text-[11px] font-bold text-muted">จำนวนชุดบล็อก</div>
                              <div className="mt-0.5 font-mono text-sm font-extrabold text-ink">
                                {totalSets} ชุดย่อย
                              </div>
                              <div className="font-mono text-[10px] text-muted">
                                ชุดละ {topicChunkSize} ข้อ
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 border-t border-line pt-3">
                          <button
                            type="button"
                            onClick={() => {
                              setTopicSubjectFilter(item.subjectKey);
                              setSelectedCompletedTopicKey(cardId);
                            }}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2.5 text-xs font-extrabold text-white transition hover:bg-brand-dark"
                          >
                            <Layers className="h-3.5 w-3.5" />
                            <span>เปิดบล็อกชุดข้อสอบ ({totalSets} ชุด)</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1.5">
                              <Link
                                href={`/exam/${topicRoute}?pool=${poolMode}&subject=${item.subjectKey}&topic=${topicParam}&set=1&count=${topicChunkSize}&mode=practice&fresh=1`}
                                className="inline-flex items-center gap-1 rounded-xl border border-line bg-bg2 px-3 py-1.5 text-xs font-bold text-ink hover:border-brand/50 hover:text-brand"
                              >
                                <Play className="h-3.5 w-3.5 text-brand" />
                                <span>เริ่มชุดที่ 1</span>
                              </Link>
                              <Link
                                href={`/exam/${topicRoute}?pool=${poolMode}&subject=${item.subjectKey}&topic=${topicParam}&count=${item.matchCount}&set=1&mode=practice&fresh=1`}
                                className="inline-flex items-center gap-1 rounded-xl border border-line bg-bg2 px-3 py-1.5 text-xs font-bold text-ink hover:border-brand/50 hover:text-brand"
                              >
                                <Sparkles className="h-3.5 w-3.5 text-teal-ink" />
                                <span>ครบ {item.matchCount}</span>
                              </Link>
                            </div>

                            <button
                              type="button"
                              disabled={saving}
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    `รีเซ็ตประวัติหัวข้อ "${item.displayTitle}" ในหมวด ${poolLabel}?`
                                  )
                                ) {
                                  return;
                                }
                                await resetForTopic(item.subjectKey, item.rawTitles.join('||'), poolMode);
                                pushNotice(`รีเซ็ตประวัติหัวข้อ "${item.displayTitle}" เรียบร้อยแล้ว`);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-muted hover:text-accent"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>รีเซ็ต</span>
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })()
      )}
    </div>
  );
}

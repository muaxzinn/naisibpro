'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Flame,
  Layers,
  ListChecks,
  Sparkles,
  Target,
  TrendingDown,
  XCircle,
} from 'lucide-react';
import { CHOICE_LABELS, SUBJECT_MAP } from '@/lib/constants';
import type { QuestionRecord } from '@/lib/question-pool';
import {
  computePriorityScore,
  type SyllabusChapterNode,
  type SyllabusGroupKey,
  type SyllabusGroupNode,
} from '@/lib/syllabus-taxonomy';
import { useProfileHistory } from '@/lib/use-profile-history';
import { SubjectIcon } from '@/components/SubjectIcon';
import { ImageLightbox, isImageUrlString } from '@/components/ImageLightbox';
import { RichExamContent } from '@/components/RichExamContent';
import { useWorkspaceMode } from '@/components/WorkspaceModeProvider';

interface WeaknessSummaryClientProps {
  practiceTree: SyllabusGroupNode[];
  realExamTree: SyllabusGroupNode[];
}

type ScopeMode = 'practice' | 'real-exam';
type ChapterFilter = 'all' | 'weak' | 'wrong' | 'unseen' | 'strong';
type SortOrder = 'weakest' | 'syllabus';

interface ComputedChapter {
  node: SyllabusChapterNode;
  groupKey: SyllabusGroupKey;
  groupName: string;
  groupShortName: string;
  examWeight: number;
  total: number;
  correct: number;
  wrong: number;
  wrongIds: number[];
  unseenCount: number;
  attempted: number;
  accuracy: number | null;
  priorityScore: number;
}

interface ComputedGroup {
  node: SyllabusGroupNode;
  total: number;
  correct: number;
  wrong: number;
  attempted: number;
  accuracy: number | null;
  weakChapterCount: number;
  chapters: ComputedChapter[];
}

function getTier(accuracy: number | null): {
  label: string;
  badgeClass: string;
  barClass: string;
} {
  if (accuracy === null) {
    return {
      label: 'ยังไม่เคยทำ',
      badgeClass: 'bg-bg2 text-muted border border-line',
      barClass: 'bg-line',
    };
  }
  if (accuracy < 60) {
    return {
      label: 'ต้องเร่งแก้',
      badgeClass: 'bg-accent/15 text-accent',
      barClass: 'bg-accent',
    };
  }
  if (accuracy < 80) {
    return {
      label: 'กำลังพัฒนา',
      badgeClass: 'bg-gold/15 text-gold-ink',
      barClass: 'bg-gold',
    };
  }
  return {
    label: 'แกร่งแล้ว',
    badgeClass: 'bg-teal/15 text-teal-ink',
    barClass: 'bg-teal',
  };
}

export function WeaknessSummaryClient({
  practiceTree,
  realExamTree,
}: WeaknessSummaryClientProps) {
  const searchParams = useSearchParams();
  const { workspaceMode, setWorkspaceMode } = useWorkspaceMode();
  const scope: ScopeMode = workspaceMode;

  const {
    correctSet,
    mistakeSet,
    realCorrectSet,
    realMistakeSet,
    bookmarkSet,
    toggleBookmark,
  } = useProfileHistory();

  const [selectedGroupKey, setSelectedGroupKey] = useState<SyllabusGroupKey | null>(null);
  const [selectedChapterKey, setSelectedChapterKey] = useState<string | null>(null);
  const [chapterFilter, setChapterFilter] = useState<ChapterFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('weakest');

  // Level 3 Flashcard wrong-questions loader
  const [showWrongFlashcards, setShowWrongFlashcards] = useState(false);
  const [wrongQuestions, setWrongQuestions] = useState<QuestionRecord[]>([]);
  const [loadingWrong, setLoadingWrong] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const param = searchParams.get('scope');
    if (param === 'real-exam' || param === 'practice') {
      setWorkspaceMode(param);
    }
  }, [searchParams, setWorkspaceMode]);

  useEffect(() => {
    setSelectedGroupKey(null);
    setSelectedChapterKey(null);
    setShowWrongFlashcards(false);
  }, [workspaceMode]);

  const activeCorrect = scope === 'real-exam' ? realCorrectSet : correctSet;
  const activeWrong = scope === 'real-exam' ? realMistakeSet : mistakeSet;
  const activeTree = scope === 'real-exam' ? realExamTree : practiceTree;

  const { computedGroups, priorityChapters, overallStats } = useMemo(() => {
    const groups: ComputedGroup[] = [];
    const allChapters: ComputedChapter[] = [];

    let sumTotal = 0;
    let sumCorrect = 0;
    let sumWrong = 0;

    for (const gNode of activeTree) {
      let gCorrect = 0;
      let gWrong = 0;
      let weakCount = 0;
      const chapters: ComputedChapter[] = [];

      for (const ch of gNode.chapters) {
        let c = 0;
        let w = 0;
        const wrongIds: number[] = [];
        for (const qid of ch.questionIds) {
          if (activeCorrect.has(qid)) c++;
          else if (activeWrong.has(qid)) {
            w++;
            wrongIds.push(qid);
          }
        }
        const total = ch.questionIds.length;
        const attempted = c + w;
        const accuracy = attempted > 0 ? Math.round((c / attempted) * 100) : null;
        if (accuracy !== null && accuracy < 60) weakCount++;

        const computedCh: ComputedChapter = {
          node: ch,
          groupKey: gNode.groupKey,
          groupName: gNode.name,
          groupShortName: gNode.shortName,
          examWeight: gNode.examWeight,
          total,
          correct: c,
          wrong: w,
          wrongIds,
          unseenCount: Math.max(0, total - attempted),
          attempted,
          accuracy,
          priorityScore: computePriorityScore(accuracy, w, gNode.examWeight),
        };
        chapters.push(computedCh);
        allChapters.push(computedCh);
        gCorrect += c;
        gWrong += w;
      }

      const gTotal = gNode.questionIds.length;
      const gAttempted = gCorrect + gWrong;
      const gAcc = gAttempted > 0 ? Math.round((gCorrect / gAttempted) * 100) : null;

      groups.push({
        node: gNode,
        total: gTotal,
        correct: gCorrect,
        wrong: gWrong,
        attempted: gAttempted,
        accuracy: gAcc,
        weakChapterCount: weakCount,
        chapters,
      });

      sumTotal += gTotal;
      sumCorrect += gCorrect;
      sumWrong += gWrong;
    }

    const priority = allChapters
      .filter((ch) => ch.wrong > 0)
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 5);

    const attemptedTotal = sumCorrect + sumWrong;
    return {
      computedGroups: groups,
      priorityChapters: priority,
      overallStats: {
        total: sumTotal,
        correct: sumCorrect,
        wrong: sumWrong,
        attempted: attemptedTotal,
        accuracy:
          attemptedTotal > 0 ? Math.round((sumCorrect / attemptedTotal) * 100) : null,
      },
    };
  }, [activeTree, activeCorrect, activeWrong]);

  const sortedGroups = useMemo(() => {
    if (sortOrder === 'syllabus') return computedGroups;
    return computedGroups.slice().sort((a, b) => {
      if (a.accuracy === null && b.accuracy === null) return 0;
      if (a.accuracy === null) return 1;
      if (b.accuracy === null) return -1;
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return b.wrong - a.wrong;
    });
  }, [computedGroups, sortOrder]);

  const activeGroup = useMemo(
    () => computedGroups.find((g) => g.node.groupKey === selectedGroupKey) || null,
    [computedGroups, selectedGroupKey]
  );

  const activeChapter = useMemo(
    () =>
      activeGroup?.chapters.find((c) => c.node.chapterKey === selectedChapterKey) || null,
    [activeGroup, selectedChapterKey]
  );

  const visibleChapters = useMemo(() => {
    if (!activeGroup) return [];
    const filtered = activeGroup.chapters.filter((ch) => {
      if (chapterFilter === 'weak') return ch.accuracy !== null && ch.accuracy < 60;
      if (chapterFilter === 'wrong') return ch.wrong > 0;
      if (chapterFilter === 'unseen') return ch.attempted === 0;
      if (chapterFilter === 'strong') return ch.accuracy !== null && ch.accuracy >= 80;
      return true;
    });
    if (sortOrder === 'syllabus') {
      return filtered.slice().sort((a, b) => a.node.chapterNumber - b.node.chapterNumber);
    }
    return filtered.slice().sort((a, b) => {
      if (a.accuracy === null && b.accuracy === null) {
        return a.node.chapterNumber - b.node.chapterNumber;
      }
      if (a.accuracy === null) return 1;
      if (b.accuracy === null) return -1;
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return b.wrong - a.wrong;
    });
  }, [activeGroup, chapterFilter, sortOrder]);

  // Fetch wrong questions for Level 3 Flashcard view when toggled open
  const activeWrongIdsKey = useMemo(
    () => (activeChapter ? activeChapter.wrongIds.slice(0, 120).join(',') : ''),
    [activeChapter]
  );

  useEffect(() => {
    if (!showWrongFlashcards || !activeWrongIdsKey) {
      setWrongQuestions([]);
      return;
    }
    let active = true;
    const fetchWrong = async () => {
      setLoadingWrong(true);
      try {
        const res = await fetch(
          `/api/questions?ids=${encodeURIComponent(activeWrongIdsKey)}&limit=150`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (active && Array.isArray(data.items)) {
          setWrongQuestions(data.items as QuestionRecord[]);
        }
      } catch {
        // ignore transient error
      } finally {
        if (active) setLoadingWrong(false);
      }
    };
    void fetchWrong();
    return () => {
      active = false;
    };
  }, [showWrongFlashcards, activeWrongIdsKey]);

  const buildChapterFixWrongHref = (ch: ComputedChapter) => {
    const topicParam = encodeURIComponent(ch.node.rawTitles.join('||'));
    if (scope === 'real-exam') {
      return `/exam/real-mistakes?subject=${ch.node.subjectKey}&topic=${topicParam}&mode=practice&fresh=1`;
    }
    return `/exam/completed-topic?pool=wrong&subject=${ch.node.subjectKey}&topic=${topicParam}&mode=practice&fresh=1`;
  };

  const buildChapterPracticeNewHref = (ch: ComputedChapter) => {
    const topicParam = encodeURIComponent(ch.node.rawTitles.join('||'));
    if (scope === 'real-exam') {
      return `/exam/real-mix?subject=${ch.node.subjectKey}&topic=${topicParam}&mode=practice&fresh=1`;
    }
    return `/exam/topic?subject=${ch.node.subjectKey}&topic=${topicParam}&mode=practice&fresh=1&excludeCompleted=1`;
  };

  const jumpToChapter = (groupKey: SyllabusGroupKey, chapterKey: string) => {
    setSelectedGroupKey(groupKey);
    setSelectedChapterKey(chapterKey);
    setShowWrongFlashcards(false);
    setRevealedIds({});
  };

  return (
    <div className="space-y-5">
      {/* Scope Switcher: Isolated Practice Pool vs 3 Real-Exam Sets */}
      <div className="rounded-card border border-line bg-panel p-4 shadow-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setWorkspaceMode('practice');
              setSelectedGroupKey(null);
              setSelectedChapterKey(null);
              setShowWrongFlashcards(false);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
              scope === 'practice'
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-bg2 text-ink hover:border-brand/50'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>คลังฝึกปกติ (7 หมวดคอร์ส)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setWorkspaceMode('real-exam');
              setSelectedGroupKey(null);
              setSelectedChapterKey(null);
              setShowWrongFlashcards(false);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
              scope === 'real-exam'
                ? 'border-accent bg-accent text-white'
                : 'border-line bg-bg2 text-ink hover:border-accent/50'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            <span>สนามข้อสอบจริง 4 ชุด (643 ข้อ)</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold tabular-nums">
          <span className="text-muted">
            ทำแล้ว {overallStats.attempted.toLocaleString()}/{overallStats.total.toLocaleString()}
          </span>
          <span className="text-teal-ink">ถูก {overallStats.correct.toLocaleString()}</span>
          <span className="text-accent">ผิด {overallStats.wrong.toLocaleString()}</span>
          {overallStats.accuracy !== null && (
            <span className="rounded-md bg-brand/10 px-2 py-0.5 text-brand">
              แม่นยำ {overallStats.accuracy}%
            </span>
          )}
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <nav
        aria-label="ลำดับชั้นการวิเคราะห์"
        className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-bg2/60 px-3.5 py-2 text-xs"
      >
        <button
          type="button"
          onClick={() => {
            setSelectedGroupKey(null);
            setSelectedChapterKey(null);
            setShowWrongFlashcards(false);
          }}
          className={`font-semibold transition-colors ${
            !selectedGroupKey ? 'text-brand' : 'text-muted hover:text-ink'
          }`}
        >
          ชั้นที่ 1 · ภาพรวม 7 หมวด
        </button>

        {activeGroup && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted" />
            <button
              type="button"
              onClick={() => {
                setSelectedChapterKey(null);
                setShowWrongFlashcards(false);
              }}
              className={`font-semibold transition-colors ${
                !selectedChapterKey ? 'text-brand' : 'text-muted hover:text-ink'
              }`}
            >
              ชั้นที่ 2 · {activeGroup.node.shortName}
            </button>
          </>
        )}

        {activeChapter && (
          <>
            <ChevronRight className="h-3.5 w-3.5 text-muted" />
            <span className="font-bold text-brand truncate max-w-xs">
              ชั้นที่ 3 · {activeChapter.node.title}
            </span>
          </>
        )}
      </nav>

      {/* ====================================================================
          LEVEL 1: PRIORITY FIX PLAN + 7 COURSE_SYLLABUS.md SUBJECT GROUPS
      ==================================================================== */}
      {!activeGroup && (
        <div className="space-y-6">
          {/* Automated Priority Fix Plan */}
          <section className="rounded-card border border-line bg-panel p-5 shadow-card space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-ink">
                  แผนการอ่านและซ่อมเร่งด่วนอัตโนมัติ (
                  {scope === 'real-exam' ? 'สนามข้อสอบจริง 4 ชุด' : 'คลังฝึกปกติ'})
                </h2>
                {priorityChapters.length === 0 ? (
                  <p className="mt-1 text-xs sm:text-sm text-muted leading-relaxed">
                    {overallStats.attempted === 0
                      ? 'ยังไม่มีประวัติการทำข้อสอบในสนามนี้ เริ่มทำข้อสอบสัก 1 ชุดแล้วระบบจะจัดลำดับ 3–5 บทที่ควรรีบซ่อมก่อนให้อัตโนมัติครับ'
                      : 'เยี่ยมมาก! ตอนนี้ไม่มีข้อที่ตอบผิดค้างอยู่ในสนามนี้เลย สามารถกดเลือกหมวดวิชาด้านล่างเพื่อเก็บข้อใหม่ต่อได้ทันที'}
                  </p>
                ) : (
                  <p className="mt-1 text-xs sm:text-sm text-muted leading-relaxed">
                    จัดอันดับจาก <strong>น้ำหนักคะแนนออกสอบจริง × อัตราการทำผิด × จำนวนข้อที่ผิด</strong> แนะนำให้เก็บตามลำดับนี้ก่อนเพื่อดึงคะแนนขึ้นเร็วที่สุด:
                  </p>
                )}
              </div>
            </div>

            {priorityChapters.length > 0 && (
              <div className="space-y-2 border-t border-line pt-4">
                {priorityChapters.map((ch, idx) => (
                  <div
                    key={ch.node.chapterKey}
                    className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-accent/25 bg-accent/[0.03] px-4 py-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-ink truncate">
                            {ch.node.title}
                          </span>
                          <span className="rounded-md bg-bg2 px-2 py-0.5 text-[11px] font-medium text-muted">
                            {ch.groupShortName} (น้ำหนัก {ch.examWeight} ข้อ)
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted tabular-nums">
                          ผิด <strong className="text-accent">{ch.wrong}</strong> ข้อ · ถูก{' '}
                          <strong className="text-teal-ink">{ch.correct}</strong> ข้อ · แม่นยำ{' '}
                          <strong className="text-accent">{ch.accuracy ?? 0}%</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => jumpToChapter(ch.groupKey, ch.node.chapterKey)}
                        className="rounded-btn border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand/50 hover:text-brand"
                      >
                        เจาะดูรายข้อ
                      </button>
                      <Link
                        href={buildChapterFixWrongHref(ch)}
                        className="inline-flex items-center gap-1 rounded-btn bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        <span>ซ่อมทันที ({ch.wrong})</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 7 Syllabus Subject Group Cards */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-brand" />
                <span>ชั้นที่ 1 · ภาพรวม 7 หมวดตามโครงคอร์ส (คลิกเพื่อเจาะรายบท)</span>
              </h2>
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSortOrder('weakest')}
                  className={`rounded-lg border px-2.5 py-1 font-semibold transition-colors ${
                    sortOrder === 'weakest'
                      ? 'border-brand bg-brand text-white'
                      : 'border-line bg-panel text-muted hover:text-ink'
                  }`}
                >
                  เรียงอ่อนสุดก่อน
                </button>
                <button
                  type="button"
                  onClick={() => setSortOrder('syllabus')}
                  className={`rounded-lg border px-2.5 py-1 font-semibold transition-colors ${
                    sortOrder === 'syllabus'
                      ? 'border-brand bg-brand text-white'
                      : 'border-line bg-panel text-muted hover:text-ink'
                  }`}
                >
                  เรียงตามลำดับคอร์ส
                </button>
              </div>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {sortedGroups.map((g) => {
                const tier = getTier(g.accuracy);
                return (
                  <button
                    key={g.node.groupKey}
                    type="button"
                    onClick={() => {
                      setSelectedGroupKey(g.node.groupKey);
                      setSelectedChapterKey(null);
                      setChapterFilter('all');
                    }}
                    className="card-hover rounded-card border border-line bg-panel p-5 text-left shadow-card space-y-3.5 transition-colors hover:border-brand/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <SubjectIcon subjectKey={g.node.subjectKey} size="md" />
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-ink truncate">
                            {g.node.shortName}
                          </h3>
                          <div className="text-[11px] text-muted tabular-nums">
                            {g.chapters.length} บท · {g.total.toLocaleString()} ข้อ
                          </div>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${tier.badgeClass}`}
                      >
                        {g.accuracy !== null ? `${g.accuracy}%` : tier.label}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-bg2">
                        <div
                          className={`h-full rounded-full transition-all ${tier.barClass}`}
                          style={{ width: `${g.accuracy ?? 0}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] tabular-nums text-muted">
                        <span>
                          ถูก <strong className="text-teal-ink">{g.correct}</strong> · ผิด{' '}
                          <strong className="text-accent">{g.wrong}</strong>
                        </span>
                        {g.weakChapterCount > 0 ? (
                          <span className="font-semibold text-accent">
                            ต้องเร่งแก้ {g.weakChapterCount} บท
                          </span>
                        ) : (
                          <span>{tier.label}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-line pt-2.5 text-xs font-semibold text-brand">
                      <span>เจาะดูรายบท ({g.chapters.length} บท)</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ====================================================================
          LEVEL 2: CHAPTERS INSIDE SELECTED SUBJECT GROUP
      ==================================================================== */}
      {activeGroup && !activeChapter && (
        <div className="space-y-4">
          <div className="rounded-card border border-line bg-panel p-5 shadow-card flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedGroupKey(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-bg2 text-ink hover:border-brand/50 hover:text-brand"
                title="กลับไปภาพรวม 7 หมวด"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <SubjectIcon subjectKey={activeGroup.node.subjectKey} size="md" />
              <div>
                <h2 className="text-base font-bold text-ink">{activeGroup.node.name}</h2>
                <p className="text-xs text-muted tabular-nums">
                  {activeGroup.chapters.length} บทเรียน · ทำแล้ว {activeGroup.attempted}/{activeGroup.total} ข้อ · ถูก {activeGroup.correct} · ผิด {activeGroup.wrong}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setSortOrder('weakest')}
                className={`rounded-lg border px-2.5 py-1 font-semibold ${
                  sortOrder === 'weakest'
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-bg2 text-muted hover:text-ink'
                }`}
              >
                อ่อนสุดก่อน
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('syllabus')}
                className={`rounded-lg border px-2.5 py-1 font-semibold ${
                  sortOrder === 'syllabus'
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-bg2 text-muted hover:text-ink'
                }`}
              >
                เรียงบทที่ 1→N
              </button>
            </div>
          </div>

          {/* Filter Strip */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', `ทุกบท (${activeGroup.chapters.length})`],
                ['weak', 'ต้องเร่งแก้ (<60%)'],
                ['wrong', 'มีข้อผิด'],
                ['unseen', 'ยังไม่เคยทำ'],
                ['strong', 'แกร่งแล้ว (≥80%)'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setChapterFilter(key)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  chapterFilter === key
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-panel text-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {visibleChapters.length === 0 ? (
            <div className="rounded-card border border-dashed border-line bg-panel p-8 text-center text-sm text-muted">
              ไม่มีบทเรียนที่ตรงกับตัวกรองนี้
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleChapters.map((ch) => {
                const tier = getTier(ch.accuracy);
                return (
                  <div
                    key={ch.node.chapterKey}
                    className="rounded-card border border-line bg-panel p-4 shadow-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between transition-colors hover:border-brand/40"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChapterKey(ch.node.chapterKey);
                        setShowWrongFlashcards(false);
                        setRevealedIds({});
                      }}
                      className="min-w-0 flex-1 text-left space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-ink hover:text-brand">
                          {ch.node.title}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${tier.badgeClass}`}
                        >
                          {ch.accuracy !== null ? `${ch.accuracy}% · ${tier.label}` : tier.label}
                        </span>
                        {ch.node.subTopics.length > 1 && (
                          <span className="rounded-md bg-bg2 border border-line px-2 py-0.5 text-[11px] text-muted">
                            {ch.node.subTopics.length} หัวข้อย่อย
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 max-w-md">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg2 flex">
                          <div
                            className="h-full bg-teal"
                            style={{
                              width: `${ch.total > 0 ? (ch.correct / ch.total) * 100 : 0}%`,
                            }}
                          />
                          <div
                            className="h-full bg-accent"
                            style={{
                              width: `${ch.total > 0 ? (ch.wrong / ch.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-muted tabular-nums shrink-0 inline-flex items-center gap-2">
                          <span className="text-teal-ink font-semibold">ถูก {ch.correct}</span>
                          <span className="text-accent font-semibold">ผิด {ch.wrong}</span>
                          <span>/ {ch.total} ข้อ</span>
                        </span>
                      </div>
                    </button>

                    <div className="flex flex-wrap shrink-0 items-center gap-2">
                      {ch.wrong > 0 && (
                        <Link
                          href={buildChapterFixWrongHref(ch)}
                          className="rounded-btn border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/15"
                        >
                          ซ่อมข้อผิด ({ch.wrong})
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedChapterKey(ch.node.chapterKey);
                          setShowWrongFlashcards(false);
                          setRevealedIds({});
                        }}
                        className="inline-flex items-center gap-1 rounded-btn bg-brand px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
                      >
                        <span>เจาะลึกบทนี้</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          LEVEL 3: CHAPTER DEEP-DIVE (SUB-TOPICS + 3 ACTIONS + WRONG FLASHCARDS)
      ==================================================================== */}
      {activeGroup && activeChapter && (
        <div className="space-y-5">
          {/* Chapter Header + 3 Instant Actions */}
          <div className="rounded-card border border-line bg-panel p-5 shadow-card space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChapterKey(null);
                    setShowWrongFlashcards(false);
                  }}
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-bg2 text-ink hover:border-brand/50 hover:text-brand"
                  title="กลับรายการบทเรียน"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-bg2 px-2 py-0.5 text-[11px] font-semibold text-muted">
                      <SubjectIcon subjectKey={activeChapter.node.subjectKey} size="sm" />
                      {activeGroup.node.shortName}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${getTier(activeChapter.accuracy).badgeClass}`}
                    >
                      {activeChapter.accuracy !== null
                        ? `แม่นยำ ${activeChapter.accuracy}% · ${getTier(activeChapter.accuracy).label}`
                        : 'ยังไม่เคยทำ'}
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-lg font-bold text-ink">
                    {activeChapter.node.title}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-semibold tabular-nums">
                    <span className="inline-flex items-center gap-1 text-teal-ink">
                      <CheckCircle2 className="h-3.5 w-3.5" /> ถูก {activeChapter.correct}
                    </span>
                    <span className="inline-flex items-center gap-1 text-accent">
                      <XCircle className="h-3.5 w-3.5" /> ผิด {activeChapter.wrong}
                    </span>
                    <span className="text-muted">
                      ยังไม่เคยทำ {activeChapter.unseenCount} / ทั้งหมด {activeChapter.total} ข้อ
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Immediate Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-4">
              {activeChapter.wrong > 0 && (
                <Link
                  href={buildChapterFixWrongHref(activeChapter)}
                  className="inline-flex items-center gap-1.5 rounded-btn bg-accent px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span>ซ่อมเฉพาะข้อที่ผิด ({activeChapter.wrong} ข้อ)</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}

              <Link
                href={buildChapterPracticeNewHref(activeChapter)}
                className="inline-flex items-center gap-1.5 rounded-btn bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
              >
                <Target className="h-4 w-4" />
                <span>
                  {scope === 'real-exam'
                    ? `ฝึกบทนี้ในสนามจริง (${activeChapter.total} ข้อ)`
                    : `ฝึกข้อใหม่ที่ยังไม่ทำ (${activeChapter.unseenCount} ข้อ)`}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>

              {activeChapter.wrong > 0 && (
                <button
                  type="button"
                  onClick={() => setShowWrongFlashcards((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-btn border px-4 py-2 text-xs font-semibold transition-colors ${
                    showWrongFlashcards
                      ? 'border-gold bg-gold/15 text-gold-ink'
                      : 'border-line bg-bg2 text-ink hover:border-brand/50 hover:text-brand'
                  }`}
                >
                  <ListChecks className="h-4 w-4" />
                  <span>
                    {showWrongFlashcards
                      ? 'ซ่อนรายข้อที่ผิด'
                      : `ดูรายข้อที่ผิดแบบ Flashcard (${activeChapter.wrong} ข้อ)`}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Sub-topics inside Chapter */}
          {activeChapter.node.subTopics.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-sm font-bold text-ink">
                หัวข้อย่อยภายในบทนี้ ({activeChapter.node.subTopics.length} หัวข้อย่อย)
              </h3>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {activeChapter.node.subTopics.map((st) => {
                  let c = 0;
                  let w = 0;
                  for (const qid of st.questionIds) {
                    if (activeCorrect.has(qid)) c++;
                    else if (activeWrong.has(qid)) w++;
                  }
                  const att = c + w;
                  const acc = att > 0 ? Math.round((c / att) * 100) : null;
                  const tier = getTier(acc);
                  const subTopicParam = encodeURIComponent(st.rawTitle);
                  const subFixHref =
                    scope === 'real-exam'
                      ? `/exam/real-mistakes?subject=${activeChapter.node.subjectKey}&topic=${subTopicParam}&mode=practice&fresh=1`
                      : `/exam/completed-topic?pool=wrong&subject=${activeChapter.node.subjectKey}&topic=${subTopicParam}&mode=practice&fresh=1`;
                  const subDrillHref =
                    scope === 'real-exam'
                      ? `/exam/real-mix?subject=${activeChapter.node.subjectKey}&topic=${subTopicParam}&mode=practice&fresh=1`
                      : `/exam/topic?subject=${activeChapter.node.subjectKey}&topic=${subTopicParam}&mode=practice&fresh=1&excludeCompleted=1`;

                  return (
                    <div
                      key={st.rawTitle}
                      className="rounded-card border border-line bg-panel p-4 shadow-card flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-ink">
                            {st.displayTitle}
                          </span>
                          <span
                            className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${tier.badgeClass}`}
                          >
                            {acc !== null ? `${acc}%` : tier.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted tabular-nums">
                          ถูก <strong className="text-teal-ink">{c}</strong> · ผิด{' '}
                          <strong className="text-accent">{w}</strong> · ทั้งหมด{' '}
                          {st.questionIds.length} ข้อ
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {w > 0 && (
                          <Link
                            href={subFixHref}
                            className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/15"
                          >
                            ซ่อมข้อผิด ({w})
                          </Link>
                        )}
                        <Link
                          href={subDrillHref}
                          className="inline-flex items-center gap-1 rounded-lg border border-line bg-bg2 px-2.5 py-1 text-[11px] font-semibold text-ink hover:border-brand/50 hover:text-brand"
                        >
                          <span>ฝึกหัวข้อย่อยนี้</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Level 3 Inline Flashcard Review of Wrong Questions */}
          {showWrongFlashcards && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-accent">
                  รายข้อที่เคยตอบผิดในบทนี้ ({activeChapter.wrong} ข้อ)
                </h3>
                <span className="text-xs text-muted">
                  กดเปิดเฉลยหรือเพิ่มเข้าคลังทบทวนได้ทีละข้อ
                </span>
              </div>

              {loadingWrong ? (
                <div className="rounded-card border border-line bg-panel p-8 text-center text-sm text-muted">
                  กำลังโหลดรายละเอียดข้อที่ตอบผิด...
                </div>
              ) : wrongQuestions.length === 0 ? (
                <div className="rounded-card border border-line bg-panel p-6 text-center text-sm text-muted">
                  ไม่พบข้อที่ตอบผิดในบทนี้
                </div>
              ) : (
                <div className="space-y-3">
                  {wrongQuestions.map((q) => {
                    const revealed = Boolean(revealedIds[q.id]);
                    const inVault = bookmarkSet.has(q.id);
                    const stemIsRaw = isImageUrlString(q.stem || '');
                    const stemImg = q.img || (stemIsRaw ? (q.stem || '').trim() : null);
                    const stemText = stemIsRaw
                      ? 'พิจารณารูปภาพต่อไปนี้แล้วเลือกคำตอบที่ถูกต้อง'
                      : q.stem || '';

                    return (
                      <article
                        key={q.id}
                        className="rounded-card border border-accent/30 bg-panel p-5 shadow-card space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-mono font-bold text-accent">#{q.id}</span>
                            <span className="text-muted">
                              {SUBJECT_MAP[q.subject_key]?.shortName}
                              {q.title ? ` · ${q.title}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void toggleBookmark(q.id)}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                                inVault
                                  ? 'border-gold bg-gold/20 text-gold-ink'
                                  : 'border-line bg-bg2 text-muted hover:border-gold/50 hover:text-ink'
                              }`}
                            >
                              <Bookmark
                                className={`h-3.5 w-3.5 ${inVault ? 'fill-current' : ''}`}
                              />
                              <span>{inVault ? 'อยู่ในคลังทบทวน' : 'ต้องการทบทวน'}</span>
                            </button>
                            <Link
                              href={`/exam/bookmarks?qid=${q.id}&mode=practice&fresh=1`}
                              className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-dark"
                            >
                              <span>ฝึกข้อนี้</span>
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>

                        <div className="font-exam space-y-2.5">
                          <RichExamContent
                            text={stemText}
                            className="text-sm sm:text-base font-semibold text-ink"
                          />
                          {stemImg && (
                            <ImageLightbox
                              src={stemImg}
                              alt={`ภาพข้อ ${q.id}`}
                              className="max-h-56 rounded-xl border border-line object-contain bg-bg2 p-1.5"
                            />
                          )}

                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {q.opts.map((opt, idx) => {
                              const isAns = revealed && idx === q.correct_index;
                              return (
                                <div
                                  key={idx}
                                  className={`rounded-xl border px-3 py-2 text-xs sm:text-sm ${
                                    isAns
                                      ? 'border-teal bg-teal/10 font-semibold text-teal-ink'
                                      : 'border-line bg-bg2/40 text-ink'
                                  }`}
                                >
                                  <span className="font-bold mr-1.5">
                                    {CHOICE_LABELS[idx] || idx + 1}.
                                  </span>
                                  <RichExamContent text={opt} className="inline" />
                                </div>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setRevealedIds((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                          >
                            {revealed ? (
                              <>
                                <EyeOff className="h-3.5 w-3.5" />
                                <span>ซ่อนเฉลย</span>
                              </>
                            ) : (
                              <>
                                <Eye className="h-3.5 w-3.5" />
                                <span>ดูเฉลยและคำอธิบาย</span>
                              </>
                            )}
                          </button>

                          {revealed && (
                            <div className="rounded-xl border border-teal/30 bg-teal/[0.05] p-3.5 text-xs sm:text-sm space-y-2">
                              <div className="font-bold text-teal-ink">
                                คำตอบที่ถูกต้อง: ข้อ{' '}
                                {CHOICE_LABELS[q.correct_index] || q.correct_index + 1}
                              </div>
                              {q.explanation && (
                                <RichExamContent
                                  text={q.explanation}
                                  className="text-ink/90 leading-relaxed"
                                />
                              )}
                              {q.explanation_img && (
                                <ImageLightbox
                                  src={q.explanation_img}
                                  alt={`ภาพเฉลยข้อ ${q.id}`}
                                  className="max-h-56 rounded-lg border border-line object-contain bg-panel p-1"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

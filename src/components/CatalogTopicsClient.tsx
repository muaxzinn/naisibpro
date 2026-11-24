'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Database,
  Layers,
  Play,
  RotateCcw,
  Search,
  Shuffle,
  Sparkles,
} from 'lucide-react';
import { ACTIVE_SUBJECTS, SUBJECT_MAP, type SubjectKey } from '@/lib/constants';
import type { SubTopicCatalogItem } from '@/lib/topic-catalog';
import { useProfileHistory } from '@/lib/use-profile-history';
import { SubjectIcon } from '@/components/SubjectIcon';
import { QuestionPoolSettingsBar } from '@/components/QuestionPoolSettingsBar';
import { useWorkspaceMode } from '@/components/WorkspaceModeProvider';

export type { SubTopicCatalogItem };

interface CatalogTopicsClientProps {
  topicsBySubject: Record<SubjectKey, SubTopicCatalogItem[]>;
  subjectTotals: Record<SubjectKey, number>;
  realExamTopicsBySubject?: Record<SubjectKey, SubTopicCatalogItem[]>;
  realExamSubjectTotals?: Record<SubjectKey, number>;
}

export function CatalogTopicsClient({
  topicsBySubject: practiceTopicsBySubject,
  subjectTotals: practiceSubjectTotals,
  realExamTopicsBySubject,
  realExamSubjectTotals,
}: CatalogTopicsClientProps) {
  const { workspaceMode } = useWorkspaceMode();
  const isRealMode =
    workspaceMode === 'real-exam' &&
    Boolean(realExamTopicsBySubject) &&
    Boolean(realExamSubjectTotals);
  const topicsBySubject =
    isRealMode && realExamTopicsBySubject ? realExamTopicsBySubject : practiceTopicsBySubject;
  const subjectTotals =
    isRealMode && realExamSubjectTotals ? realExamSubjectTotals : practiceSubjectTotals;
  const topicRoute = isRealMode ? 'real-mix' : 'topic';

  const [selectedSubject, setSelectedSubject] = useState<SubjectKey | null>(null);
  const [selectedTopicCard, setSelectedTopicCard] = useState<SubTopicCatalogItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [query, setQuery] = useState<string>('');
  const [chunkSize, setChunkSize] = useState<15 | 20 | 30>(20);
  const [showAllTopicsFlat, setShowAllTopicsFlat] = useState(false);

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
    resetForTopic,
  } = useProfileHistory();

  const correctSet = isRealMode ? realCorrectSet : mainCorrectSet;
  const mistakeSet = isRealMode ? realMistakeSet : mainMistakeSet;
  const allCompletedSet = isRealMode ? realAttemptedSet : mainCompletedSet;

  const totalCatalogQuestions = useMemo(
    () => ACTIVE_SUBJECTS.reduce((sum, s) => sum + (subjectTotals[s.key] || 0), 0),
    [subjectTotals]
  );

  const allTopics = useMemo(
    () => ACTIVE_SUBJECTS.flatMap((s) => topicsBySubject[s.key] || []),
    [topicsBySubject]
  );

  const categoriesForSubject = useMemo(() => {
    if (!selectedSubject) return [];
    const list = topicsBySubject[selectedSubject] || [];
    const seen = new Map<string, number>();
    for (const item of list) {
      seen.set(item.category, (seen.get(item.category) || 0) + 1);
    }
    return Array.from(seen.entries()).map(([name, count]) => ({ name, count }));
  }, [selectedSubject, topicsBySubject]);

  const filteredTopics = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTopics.filter((item) => {
      if (selectedSubject !== null && item.subjectKey !== selectedSubject) return false;
      if (selectedSubject !== null && selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.displayTitle.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.rawTitles.some((rt) => rt.toLowerCase().includes(q)) ||
        SUBJECT_MAP[item.subjectKey].name.toLowerCase().includes(q)
      );
    });
  }, [allTopics, selectedSubject, selectedCategory, query]);

  const totalQuestionsFiltered = useMemo(
    () => filteredTopics.reduce((sum, t) => sum + t.count, 0),
    [filteredTopics]
  );

  const isLevel1 =
    selectedTopicCard === null &&
    selectedSubject === null &&
    !query.trim() &&
    !showAllTopicsFlat;
  const isLevel2 = selectedTopicCard === null && !isLevel1;
  const isLevel3 = selectedTopicCard !== null;

  const excludeParam = excludeCompleted ? '&excludeCompleted=1' : '&excludeCompleted=0';

  const getTopicStats = (item: SubTopicCatalogItem) => {
    let doneCorrect = 0;
    let doneWrong = 0;
    for (const qid of item.questionIds) {
      if (correctSet.has(qid)) doneCorrect++;
      else if (mistakeSet.has(qid)) doneWrong++;
    }
    const doneTotal = doneCorrect + doneWrong;
    const remainingCount = Math.max(0, item.count - doneTotal);
    const activeCount = excludeCompleted ? remainingCount : item.count;
    const totalSets = activeCount > 0 ? Math.max(1, Math.ceil(activeCount / chunkSize)) : 0;
    return { doneCorrect, doneWrong, doneTotal, remainingCount, activeCount, totalSets };
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

      {/* Step Indicator / Breadcrumb Bar */}
      <nav
        aria-label="ขั้นตอนการเลือกชุดข้อสอบ"
        className="rounded-card border border-line bg-panel p-3.5 shadow-card space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setSelectedSubject(null);
                setSelectedTopicCard(null);
                setSelectedCategory('all');
                setShowAllTopicsFlat(false);
                setQuery('');
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors ${
                isLevel1
                  ? 'bg-brand text-white font-semibold'
                  : 'text-muted font-medium hover:bg-bg2 hover:text-ink'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>1. เลือกการ์ดวิชาหลัก (7 วิชา)</span>
            </button>

            <ArrowRight className="h-3.5 w-3.5 text-muted/60 shrink-0" />

            <button
              type="button"
              disabled={isLevel1}
              onClick={() => {
                setSelectedTopicCard(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-45 ${
                isLevel2
                  ? 'bg-brand text-white font-semibold'
                  : 'text-muted font-medium hover:bg-bg2 hover:text-ink'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>
                2. เลือกการ์ดหัวข้อย่อย
                {selectedSubject ? ` · ${SUBJECT_MAP[selectedSubject].shortName}` : ''}
              </span>
            </button>

            <ArrowRight className="h-3.5 w-3.5 text-muted/60 shrink-0" />

            <span
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${
                isLevel3
                  ? 'bg-brand text-white font-semibold'
                  : 'text-muted font-medium'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="max-w-[200px] truncate">
                {selectedTopicCard
                  ? `3. ${selectedTopicCard.displayTitle.replace(/_/g, ' ')}`
                  : '3. เลือกบล็อกชุดข้อสอบ'}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-line bg-bg2/60 p-0.5 text-xs font-medium">
            <span className="px-2 text-muted hidden sm:inline">แบ่งชุด:</span>
            {([15, 20, 30] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setChunkSize(sz)}
                className={`rounded-md px-2.5 py-1 transition-colors tabular-nums ${
                  chunkSize === sz ? 'bg-panel text-brand font-semibold shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {sz} ข้อ
              </button>
            ))}
          </div>
        </div>

        {/* Search Input & Quick Flat View Toggle */}
        {!isLevel3 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-line/70">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedTopicCard(null);
                }}
                placeholder="ค้นหาหัวข้อย่อย เช่น Word, Excel, เครือข่าย, แพ่ง, อาญา, อนุกรม..."
                className="w-full rounded-lg border border-line bg-bg2/50 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-brand focus:bg-panel"
              />
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              {isLevel1 && (
                <button
                  type="button"
                  onClick={() => setShowAllTopicsFlat(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand/50 hover:text-ink"
                >
                  <span>ดูรวมทั้ง {allTopics.length} บท</span>
                </button>
              )}
              <div className="text-xs text-muted tabular-nums">
                {isLevel1 ? (
                  <>
                    7 วิชาหลัก · <strong className="font-semibold text-brand">{allTopics.length} บท</strong>
                  </>
                ) : (
                  <>
                    พบ <strong className="font-semibold text-ink">{filteredTopics.length}</strong> บท ·{' '}
                    <strong className="font-semibold text-brand">{totalQuestionsFiltered.toLocaleString('en-US')}</strong> ข้อ
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* LEVEL 1: 7 Main Subject Block Cards */}
      {isLevel1 && (
        <section aria-label="การ์ดวิชาหลักทั้ง 7 วิชา" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {ACTIVE_SUBJECTS.map((sub) => {
            const subTopics = topicsBySubject[sub.key] || [];
            const doneInSub = subTopics.reduce(
              (acc, t) => acc + t.questionIds.filter((id) => allCompletedSet.has(id)).length,
              0
            );
            const totalInSub = subjectTotals[sub.key] || 0;
            const remainingInSub = Math.max(0, totalInSub - doneInSub);
            const progressPct = totalInSub > 0 ? Math.round((doneInSub / totalInSub) * 100) : 0;

            return (
              <button
                key={sub.key}
                type="button"
                onClick={() => {
                  setSelectedSubject(sub.key);
                  setSelectedTopicCard(null);
                  setSelectedCategory('all');
                }}
                className="group flex flex-col justify-between gap-4 rounded-card border border-line bg-panel p-5 text-left shadow-card card-hover"
              >
                <div className="space-y-3 w-full">
                  <div className="flex items-center justify-between gap-2">
                    <SubjectIcon subjectKey={sub.key} size="md" />
                    <span className="text-xs font-medium text-muted">
                      {sub.grp === 'general' ? 'ภาคทั่วไป' : 'ภาคเฉพาะตำแหน่ง'}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-[17px] font-semibold text-ink leading-snug group-hover:text-brand transition-colors">
                      {sub.name}
                    </h2>
                    <p className="mt-1 text-xs text-muted tabular-nums">
                      {totalInSub.toLocaleString('en-US')} ข้อ · {subTopics.length} หัวข้อย่อย
                      {doneInSub > 0 && ` · เหลือใหม่ ${remainingInSub} ข้อ`}
                    </p>
                  </div>

                  {doneInSub > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted tabular-nums">
                        <span>ความคืบหน้า</span>
                        <span className="font-semibold text-brand">{progressPct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg2">
                        <div
                          className="h-full rounded-full bg-brand transition-all"
                          style={{ width: `${Math.min(100, progressPct)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex w-full items-center justify-between border-t border-line pt-3 text-xs font-semibold text-brand">
                  <span>เลือกหัวข้อย่อย ({subTopics.length} บท)</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </section>
      )}

      {/* LEVEL 2: Sub-Topic Block Cards (inside selected subject or search) */}
      {isLevel2 && (
        <section className="space-y-4">
          <div className="rounded-card border border-line bg-panel p-4 shadow-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedSubject(null);
                  setSelectedTopicCard(null);
                  setSelectedCategory('all');
                  setQuery('');
                  setShowAllTopicsFlat(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>กลับไปเลือกการ์ดวิชาหลัก (7 วิชา)</span>
              </button>

              {selectedSubject && (
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <SubjectIcon subjectKey={selectedSubject} size="sm" />
                  <span>{SUBJECT_MAP[selectedSubject].name}</span>
                </div>
              )}
            </div>

            {/* Quick Subject Switcher */}
            <div className="flex flex-wrap gap-1.5">
              {ACTIVE_SUBJECTS.map((sub) => {
                const active = selectedSubject === sub.key;
                const count = (topicsBySubject[sub.key] || []).length;
                return (
                  <button
                    key={sub.key}
                    type="button"
                    onClick={() => {
                      setSelectedSubject(sub.key);
                      setSelectedCategory('all');
                      setShowAllTopicsFlat(false);
                    }}
                    className={`rounded-lg border px-2.5 py-1 text-xs transition-colors tabular-nums ${
                      active
                        ? 'border-brand bg-brand text-white font-semibold'
                        : 'border-line bg-bg2/60 text-muted font-medium hover:text-ink'
                    }`}
                  >
                    {sub.shortName} ({count})
                  </button>
                );
              })}
            </div>

            {/* Category Filter Pills inside Selected Subject */}
            {categoriesForSubject.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-line/70">
                <span className="text-xs font-medium text-muted mr-1">หมวด:</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`rounded-lg border px-2.5 py-1 text-xs transition-colors tabular-nums ${
                    selectedCategory === 'all'
                      ? 'border-brand bg-brand/10 text-brand font-semibold'
                      : 'border-line bg-panel text-muted font-medium hover:text-ink'
                  }`}
                >
                  ทั้งหมด ({(topicsBySubject[selectedSubject as SubjectKey] || []).length})
                </button>
                {categoriesForSubject.map((cat) => (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`rounded-lg border px-2.5 py-1 text-xs transition-colors tabular-nums ${
                      selectedCategory === cat.name
                        ? 'border-brand bg-brand/10 text-brand font-semibold'
                        : 'border-line bg-panel text-muted font-medium hover:text-ink'
                    }`}
                  >
                    {cat.name} ({cat.count})
                  </button>
                ))}
              </div>
            )}
          </div>

          {filteredTopics.length === 0 ? (
            <div className="rounded-card border border-line bg-panel p-10 text-center space-y-2 shadow-card">
              <p className="text-base font-semibold text-ink">ไม่พบหัวข้อย่อยที่ตรงกับคำค้นหา</p>
              <p className="text-xs text-muted">ลองเปลี่ยนคำค้นหาหรือกดกลับไปเลือกการ์ดวิชาหลักอีกครั้ง</p>
            </div>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTopics.map((item) => {
                const subMeta = SUBJECT_MAP[item.subjectKey];
                const stats = getTopicStats(item);
                const topicParam = encodeURIComponent(item.rawTitles.join('||'));
                const cardId = `${item.subjectKey}::${item.title}`;

                return (
                  <article
                    key={cardId}
                    className="flex flex-col justify-between gap-4 overflow-hidden rounded-card border border-line bg-panel p-5 shadow-card card-hover"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <SubjectIcon subjectKey={item.subjectKey} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted">
                            <span className="font-semibold text-brand">{subMeta.shortName}</span>
                            <span>·</span>
                            <span className="truncate">{item.category}</span>
                          </div>
                          <h3 className="mt-0.5 text-base font-semibold text-ink leading-snug break-words">
                            {item.displayTitle.replace(/_/g, ' ')}
                          </h3>
                        </div>
                      </div>

                      <p className="text-[13px] text-muted leading-relaxed line-clamp-2">
                        {item.description}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted tabular-nums">
                        <span>
                          <strong className="font-semibold text-ink">
                            {excludeCompleted ? `${stats.remainingCount} ข้อใหม่` : `${item.count} ข้อ`}
                          </strong>{' '}
                          · {stats.totalSets} ชุดย่อย (ชุดละ {chunkSize} ข้อ)
                        </span>
                        {stats.doneTotal > 0 && (
                          <span>
                            ทำแล้ว {stats.doneTotal}/{item.count}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Block Card Actions */}
                    <div className="border-t border-line pt-3">
                      {stats.activeCount > 0 ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubject(item.subjectKey);
                              setSelectedTopicCard(item);
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-btn bg-brand px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-dark"
                          >
                            <Layers className="h-3.5 w-3.5" />
                            <span>เปิดบล็อกชุดข้อสอบ ({stats.totalSets})</span>
                          </button>
                          <Link
                            href={`/exam/${topicRoute}?subject=${item.subjectKey}&topic=${topicParam}&set=1&count=${chunkSize}&mode=practice&fresh=1${excludeParam}`}
                            className="inline-flex items-center justify-center gap-1 rounded-btn border border-line bg-bg2/60 px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-brand/50 hover:text-brand"
                          >
                            <Play className="h-3.5 w-3.5 text-brand" />
                            <span>ชุดที่ 1</span>
                          </Link>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-teal/35 bg-teal/5 px-3 py-2">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-ink">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>ทำครบทุกข้อแล้ว</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/exam/${topicRoute}?subject=${item.subjectKey}&topic=${topicParam}&set=1&count=${chunkSize}&mode=practice&fresh=1&excludeCompleted=0`}
                              className="rounded-md border border-line bg-panel px-2.5 py-1 text-xs font-medium text-ink hover:border-brand/50"
                            >
                              ฝึกซ้ำ
                            </Link>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `รีเซ็ตประวัติบท "${item.displayTitle}" เพื่อทำใหม่ทั้งหมดหรือไม่?`
                                  )
                                ) {
                                  void resetForTopic(item.subjectKey, item.rawTitles.join('||'), 'all');
                                }
                              }}
                              className="rounded-md border border-line bg-panel px-2.5 py-1 text-xs font-medium text-muted hover:text-accent"
                            >
                              รีเซ็ต
                            </button>
                          </div>
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

      {/* LEVEL 3: Set Block Cards inside Selected Sub-Topic */}
      {isLevel3 && selectedTopicCard && (() => {
        const item = selectedTopicCard;
        const subMeta = SUBJECT_MAP[item.subjectKey];
        const stats = getTopicStats(item);
        const topicParam = encodeURIComponent(item.rawTitles.join('||'));

        return (
          <section aria-label="บล็อกชุดข้อสอบย่อย" className="space-y-4">
            <div className="rounded-card border border-line bg-panel p-5 shadow-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTopicCard(null)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>กลับไปการ์ดหัวข้อย่อยวิชา{subMeta.shortName}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTopicCard(null);
                      setSelectedSubject(null);
                      setSelectedCategory('all');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-bg2/60 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand/50 hover:text-ink"
                  >
                    <span>กลับไปการ์ดวิชาหลัก (7 วิชา)</span>
                  </button>
                </div>

                {stats.doneTotal > 0 && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      if (
                        window.confirm(
                          `รีเซ็ตประวัติบท "${item.displayTitle}" เพื่อทำใหม่ทั้งหมดหรือไม่?`
                        )
                      ) {
                        void resetForTopic(item.subjectKey, item.rawTitles.join('||'), 'all');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-accent/35 bg-accent/5 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>รีเซ็ตบทนี้ ({stats.doneTotal} ข้อ)</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <SubjectIcon subjectKey={item.subjectKey} size="md" />
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <span className="font-semibold text-brand">{subMeta.name}</span>
                      <span>·</span>
                      <span>{item.category}</span>
                    </div>
                    <h2 className="text-xl font-bold text-ink leading-snug break-words">
                      {item.displayTitle.replace(/_/g, ' ')}
                    </h2>
                    <p className="text-[13px] text-muted">{item.description}</p>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0 tabular-nums">
                  <div className="text-lg font-bold text-brand">
                    {excludeCompleted ? `${stats.remainingCount} ข้อใหม่` : `${item.count} ข้อ`}
                  </div>
                  <div className="text-xs text-muted">
                    ทั้งหมด {item.count} ข้อ · {stats.totalSets} ชุดย่อย
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-line/70">
                {stats.activeCount > 0 && (
                  <>
                    <Link
                      href={`/exam/${topicRoute}?subject=${item.subjectKey}&topic=${topicParam}&count=20&mode=practice&fresh=1${excludeParam}`}
                      className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-bg2/60 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-brand/50 hover:text-brand"
                    >
                      <Shuffle className="h-3.5 w-3.5 text-brand" />
                      <span>สุ่มฝึก {Math.min(20, stats.activeCount)} ข้อ</span>
                    </Link>
                    <Link
                      href={`/exam/${topicRoute}?subject=${item.subjectKey}&topic=${topicParam}&set=1&count=${stats.activeCount}&mode=practice&fresh=1${excludeParam}`}
                      className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-bg2/60 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-teal/60 hover:text-teal-ink"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-teal-ink" />
                      <span>ทำครบทั้งบท ({stats.activeCount} ข้อ)</span>
                    </Link>
                  </>
                )}
                <Link
                  href={`/bank?subject=${item.subjectKey}&topic=${topicParam}`}
                  className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-bg2/60 px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand/50 hover:text-ink"
                >
                  <Database className="h-3.5 w-3.5" />
                  <span>ดูโจทย์ในคลัง</span>
                </Link>
              </div>
            </div>

            {stats.totalSets === 0 ? (
              <div className="rounded-card border border-teal/35 bg-teal/5 p-8 text-center space-y-3">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-teal-ink">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>ทำครบทุกข้อในบทนี้แล้ว</span>
                </div>
                <p className="text-xs text-muted">
                  คุณสามารถทบทวนข้อที่เคยทำได้ในหน้าชุดที่เคยทำแล้ว หรือเลือกฝึกซ้ำชุดที่ 1
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Link
                    href="/catalog/completed"
                    className="rounded-btn bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
                  >
                    ไปหน้าชุดข้อสอบที่เคยทำแล้ว
                  </Link>
                  <Link
                    href={`/exam/${topicRoute}?subject=${item.subjectKey}&topic=${topicParam}&set=1&count=${chunkSize}&mode=practice&fresh=1&excludeCompleted=0`}
                    className="rounded-btn border border-line bg-panel px-4 py-2 text-xs font-medium text-ink hover:border-brand/50"
                  >
                    ฝึกซ้ำชุดที่ 1
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: stats.totalSets }, (_, idx) => {
                  const setNum = idx + 1;
                  const startQ = idx * chunkSize + 1;
                  const endQ = Math.min(stats.activeCount, setNum * chunkSize);
                  const qCount = Math.max(0, endQ - startQ + 1);
                  return (
                    <div
                      key={setNum}
                      className="flex flex-col justify-between gap-3 rounded-card border border-line bg-panel p-4 shadow-card card-hover"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-brand tabular-nums">
                            ชุดที่ {setNum}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-muted tabular-nums">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{Math.max(10, qCount)} นาที</span>
                          </span>
                        </div>
                        <div className="text-xs text-muted tabular-nums">
                          ข้อที่ {startQ}–{endQ} ({qCount} ข้อ)
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Link
                          href={`/exam/${topicRoute}?subject=${item.subjectKey}&topic=${topicParam}&set=${setNum}&count=${chunkSize}&mode=practice&fresh=1${excludeParam}`}
                          className="rounded-btn border border-line bg-bg2/60 py-2 text-center text-xs font-medium text-ink transition-colors hover:border-brand/50 hover:text-brand"
                        >
                          โหมดฝึกซ้อม
                        </Link>
                        <Link
                          href={`/exam/${topicRoute}?subject=${item.subjectKey}&topic=${topicParam}&set=${setNum}&count=${chunkSize}&mode=real&fresh=1${excludeParam}`}
                          className="rounded-btn bg-brand py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-brand-dark"
                        >
                          จับเวลาจริง
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })()}
    </div>
  );
}

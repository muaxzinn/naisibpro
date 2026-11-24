'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookmarkCheck,
  BookOpenCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  Layers,
  List,
  Package,
  Search,
  Shuffle,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  ACTIVE_SUBJECTS,
  CHOICE_LABELS,
  SUBJECT_MAP,
  type SubjectKey,
} from '@/lib/constants';
import type { QuestionRecord } from '@/lib/question-pool';
import type { SubTopicCatalogItem } from '@/lib/topic-catalog';
import { useProfileHistory } from '@/lib/use-profile-history';
import { SubjectIcon } from '@/components/SubjectIcon';
import { ImageLightbox, isImageUrlString } from '@/components/ImageLightbox';
import { RichExamContent } from '@/components/RichExamContent';

interface CatalogReviewClientProps {
  topicsBySubject: Record<SubjectKey, SubTopicCatalogItem[]>;
}

type ReviewTab = 'all' | 'subject' | 'topic' | 'list';

export function CatalogReviewClient({ topicsBySubject }: CatalogReviewClientProps) {
  const {
    bookmarks,
    correctSet,
    mistakeSet,
    loading: profileLoading,
    saving,
    toggleBookmark,
    clearBookmarks,
  } = useProfileHistory();

  const [tab, setTab] = useState<ReviewTab>('all');
  const [chunkSize, setChunkSize] = useState<number>(20);
  const [selectedSubject, setSelectedSubject] = useState<SubjectKey | ''>('');
  const [searchText, setSearchText] = useState('');
  const [items, setItems] = useState<QuestionRecord[]>([]);
  const [fetching, setFetching] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Record<number, boolean>>({});

  // Fetch full details for all bookmarked questions
  const bookmarksKey = useMemo(
    () => bookmarks.slice().sort((a, b) => a - b).join(','),
    [bookmarks]
  );

  useEffect(() => {
    let active = true;
    if (!bookmarksKey) {
      setItems([]);
      return;
    }

    const loadQuestions = async () => {
      setFetching(true);
      try {
        const idList = bookmarksKey.split(',');
        const fetched: QuestionRecord[] = [];
        // Fetch in chunks of 150 IDs to keep query URLs compact
        for (let i = 0; i < idList.length; i += 150) {
          const slice = idList.slice(i, i + 150).join(',');
          const res = await fetch(
            `/api/questions?ids=${encodeURIComponent(slice)}&limit=200`,
            { cache: 'no-store' }
          );
          if (!res.ok) continue;
          const data = await res.json();
          if (Array.isArray(data.items)) {
            fetched.push(...(data.items as QuestionRecord[]));
          }
        }
        if (active) {
          fetched.sort((a, b) => a.id - b.id);
          setItems(fetched);
        }
      } catch {
        // keep current items
      } finally {
        if (active) setFetching(false);
      }
    };

    void loadQuestions();
    return () => {
      active = false;
    };
  }, [bookmarksKey]);

  const stats = useMemo(() => {
    let right = 0;
    let wrong = 0;
    let unseen = 0;
    for (const id of bookmarks) {
      if (correctSet.has(id)) right++;
      else if (mistakeSet.has(id)) wrong++;
      else unseen++;
    }
    return { total: bookmarks.length, right, wrong, unseen };
  }, [bookmarks, correctSet, mistakeSet]);

  const bySubject = useMemo(() => {
    const map = new Map<SubjectKey, QuestionRecord[]>();
    for (const q of items) {
      const arr = map.get(q.subject_key);
      if (arr) arr.push(q);
      else map.set(q.subject_key, [q]);
    }
    return ACTIVE_SUBJECTS.map((sub) => {
      const list = map.get(sub.key) || [];
      let right = 0;
      let wrong = 0;
      for (const q of list) {
        if (correctSet.has(q.id)) right++;
        else if (mistakeSet.has(q.id)) wrong++;
      }
      return {
        subject: sub,
        questions: list,
        right,
        wrong,
        unseen: Math.max(0, list.length - right - wrong),
      };
    }).filter((entry) => entry.questions.length > 0);
  }, [items, correctSet, mistakeSet]);

  const byTopic = useMemo(() => {
    const bookmarkIdSet = new Set(bookmarks);
    const groups: Array<{
      subject: (typeof ACTIVE_SUBJECTS)[number];
      topics: Array<{ topic: string; displayTitle: string; count: number }>;
    }> = [];

    for (const sub of ACTIVE_SUBJECTS) {
      const topicDefs = topicsBySubject[sub.key] || [];
      const matchedTopics: Array<{ topic: string; displayTitle: string; count: number }> = [];
      for (const td of topicDefs) {
        let count = 0;
        for (const qid of td.questionIds) {
          if (bookmarkIdSet.has(qid)) count++;
        }
        if (count > 0) {
          matchedTopics.push({ topic: td.title, displayTitle: td.displayTitle, count });
        }
      }
      if (matchedTopics.length > 0) {
        matchedTopics.sort((a, b) => b.count - a.count);
        groups.push({ subject: sub, topics: matchedTopics });
      }
    }
    return groups;
  }, [bookmarks, topicsBySubject]);

  const filteredList = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    return items.filter((q) => {
      if (selectedSubject && q.subject_key !== selectedSubject) return false;
      if (!needle) return true;
      return (
        String(q.id).includes(needle) ||
        (q.stem || '').toLowerCase().includes(needle) ||
        (q.title || '').toLowerCase().includes(needle) ||
        q.opts.some((o) => o.toLowerCase().includes(needle))
      );
    });
  }, [items, selectedSubject, searchText]);

  const totalCombinedSets = Math.max(1, Math.ceil(items.length / chunkSize));

  if (profileLoading && bookmarks.length === 0) {
    return (
      <div className="rounded-card border border-line bg-panel p-8 text-center text-sm text-muted">
        กำลังโหลดคลังทบทวนของคุณ...
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-panel p-10 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/15 text-gold-ink">
          <BookmarkCheck className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-ink">คลังทบทวนยังว่างอยู่</h2>
          <p className="mt-1 text-sm text-muted max-w-md mx-auto">
            ระหว่างทำข้อสอบหรือตรวจผลสอบ กดปุ่ม &ldquo;ต้องการทบทวน&rdquo; ในข้อที่อยากเก็บไว้ ข้อนั้นจะมาอยู่ในคลังนี้ทันที
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          <Link
            href="/catalog/form"
            className="inline-flex items-center gap-1.5 rounded-btn bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
          >
            <span>ไปทำชุดข้อสอบ 150 ข้อ</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/bank"
            className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-bg2 px-4 py-2 text-xs font-semibold text-ink hover:border-brand/50"
          >
            <span>เลือกข้อจากคลังข้อสอบ</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Summary & Clear Action */}
      <div className="rounded-card border border-line bg-panel p-4 shadow-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold tabular-nums">
          <span className="inline-flex items-center gap-1.5 text-ink">
            <BookmarkCheck className="h-4 w-4 text-gold-ink" />
            ทั้งหมด <strong className="text-base">{stats.total.toLocaleString()}</strong> ข้อ
          </span>
          <span className="inline-flex items-center gap-1 text-teal-ink">
            <CheckCircle2 className="h-3.5 w-3.5" />
            เคยถูก {stats.right}
          </span>
          <span className="inline-flex items-center gap-1 text-accent">
            <XCircle className="h-3.5 w-3.5" />
            เคยผิด {stats.wrong}
          </span>
          <span className="text-muted">ยังไม่เคยตอบ {stats.unseen}</span>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => {
            if (
              window.confirm(
                `ต้องการล้างข้อสอบทั้งหมดในคลังทบทวน (${stats.total} ข้อ) ใช่หรือไม่?`
              )
            ) {
              void clearBookmarks();
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg2 px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>ล้างคลังทบทวน</span>
        </button>
      </div>

      {/* 4 Mode Tabs: Combined, Subject, Topic, Individual List */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { key: 'all' as const, label: 'แบบรวมชุด', icon: Package },
          { key: 'subject' as const, label: 'แยกตามวิชา', icon: Layers },
          { key: 'topic' as const, label: 'แยกหัวข้อย่อย', icon: BookOpenCheck },
          { key: 'list' as const, label: 'ดูแบบรายข้อ', icon: List },
        ].map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                active
                  ? 'border-brand bg-brand text-white shadow-sm'
                  : 'border-line bg-panel text-ink hover:border-brand/50 hover:text-brand'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: COMBINED SETS */}
      {tab === 'all' && (
        <div className="space-y-4">
          <div className="rounded-card border border-line bg-panel p-5 shadow-card space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-ink">
                  ฝึกทบทวนแบบรวมทุกวิชา ({stats.total} ข้อ)
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  ทำรวดเดียวทั้งหมด หรือแบ่งเป็นชุดย่อยทีละ 20 / 50 / 150 ข้อ
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/exam/review-form?mode=practice&fresh=1"
                  className="inline-flex items-center gap-1.5 rounded-btn bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
                >
                  <span>ฝึกทั้งหมด ({stats.total} ข้อ)</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href={`/exam/review-form?shuffle=1&count=${Math.min(stats.total, chunkSize)}&mode=practice&fresh=1`}
                  className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-bg2 px-3.5 py-2 text-xs font-semibold text-ink hover:border-brand/50 hover:text-brand"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  <span>สุ่มทบทวน ({Math.min(stats.total, chunkSize)} ข้อ)</span>
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
              <span className="text-xs font-medium text-muted">ขนาดชุดย่อย:</span>
              {[20, 50, 150].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setChunkSize(size)}
                  className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
                    chunkSize === size
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-line bg-bg2 text-muted hover:text-ink'
                  }`}
                >
                  ชุดละ {size} ข้อ
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: totalCombinedSets }, (_, idx) => {
              const setNo = idx + 1;
              const start = idx * chunkSize;
              const end = Math.min(items.length || stats.total, start + chunkSize);
              const countInSet = Math.max(0, end - start);
              if (countInSet === 0) return null;
              return (
                <div
                  key={setNo}
                  className="rounded-card border border-line bg-panel p-4 shadow-card flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-bold text-ink">
                      ชุดทบทวนรวมที่ {setNo}/{totalCombinedSets}
                    </div>
                    <div className="mt-0.5 text-xs text-muted tabular-nums">
                      ข้อที่ {start + 1}–{end} ({countInSet} ข้อ)
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/exam/review-form?set=${setNo}&count=${chunkSize}&mode=practice&fresh=1`}
                      className="rounded-btn border border-line bg-bg2 px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand/50 hover:text-brand"
                    >
                      ฝึกซ้อม
                    </Link>
                    <Link
                      href={`/exam/review-form?set=${setNo}&count=${chunkSize}&mode=real&fresh=1`}
                      className="rounded-btn bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
                    >
                      สอบจับเวลา
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: BY SUBJECT */}
      {tab === 'subject' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {bySubject.map(({ subject, questions, right, wrong, unseen }) => (
            <div
              key={subject.key}
              className="rounded-card border border-line bg-panel p-5 shadow-card flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <SubjectIcon subjectKey={subject.key} size="md" />
                    <div>
                      <h3 className="text-sm font-bold text-ink">{subject.name}</h3>
                      <div className="text-xs text-muted tabular-nums">
                        {questions.length} ข้อในคลังทบทวน
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold tabular-nums">
                  <span className="rounded-md bg-teal/15 px-2 py-0.5 text-teal-ink">
                    เคยถูก {right}
                  </span>
                  <span className="rounded-md bg-accent/15 px-2 py-0.5 text-accent">
                    เคยผิด {wrong}
                  </span>
                  <span className="rounded-md bg-bg2 px-2 py-0.5 text-muted">
                    ยังไม่ตอบ {unseen}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/exam/review-subject?subject=${subject.key}&mode=practice&fresh=1`}
                  className="inline-flex items-center gap-1.5 rounded-btn bg-brand px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
                >
                  <span>ฝึกวิชานี้ ({questions.length} ข้อ)</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href={`/exam/review-subject?subject=${subject.key}&shuffle=1&mode=practice&fresh=1`}
                  className="inline-flex items-center gap-1 rounded-btn border border-line bg-bg2 px-3 py-2 text-xs font-semibold text-ink hover:border-brand/50 hover:text-brand"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  <span>สุ่ม</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: BY SUB-TOPIC */}
      {tab === 'topic' && (
        <div className="space-y-4">
          {byTopic.length === 0 ? (
            <div className="rounded-card border border-line bg-panel p-6 text-center text-sm text-muted">
              ไม่พบหัวข้อย่อยสำหรับข้อสอบในคลังทบทวน
            </div>
          ) : (
            byTopic.map(({ subject, topics }) => (
              <div
                key={subject.key}
                className="rounded-card border border-line bg-panel p-5 shadow-card space-y-3"
              >
                <div className="flex items-center gap-2.5 border-b border-line pb-3">
                  <SubjectIcon subjectKey={subject.key} size="sm" />
                  <h3 className="text-sm font-bold text-ink">{subject.name}</h3>
                  <span className="text-xs text-muted">({topics.length} หัวข้อ)</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {topics.map((t) => (
                    <Link
                      key={t.topic}
                      href={`/exam/review-topic?subject=${subject.key}&topic=${encodeURIComponent(t.topic)}&mode=practice&fresh=1`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-line bg-bg2/40 px-3.5 py-2.5 text-xs transition-colors hover:border-brand/50 hover:text-brand"
                    >
                      <span className="font-semibold text-ink truncate">{t.displayTitle}</span>
                      <span className="inline-flex items-center gap-1 shrink-0 font-bold text-brand tabular-nums">
                        {t.count} ข้อ
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 4: INDIVIDUAL QUESTION LIST */}
      {tab === 'list' && (
        <div className="space-y-4">
          <div className="rounded-card border border-line bg-panel p-4 shadow-card space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="ค้นหาตามคำในโจทย์ หัวข้อ หรือเลขข้อ..."
                className="w-full rounded-xl border border-line bg-bg2 py-2 pl-9 pr-3 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedSubject('')}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  selectedSubject === ''
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-bg2 text-muted hover:text-ink'
                }`}
              >
                ทุกวิชา ({items.length})
              </button>
              {bySubject.map(({ subject, questions }) => (
                <button
                  key={subject.key}
                  type="button"
                  onClick={() =>
                    setSelectedSubject(selectedSubject === subject.key ? '' : subject.key)
                  }
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    selectedSubject === subject.key
                      ? 'border-brand bg-brand text-white'
                      : 'border-line bg-bg2 text-ink hover:border-brand/50'
                  }`}
                >
                  <SubjectIcon subjectKey={subject.key} size="sm" />
                  <span>
                    {subject.shortName} ({questions.length})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {fetching && items.length === 0 ? (
            <div className="rounded-card border border-line bg-panel p-8 text-center text-sm text-muted">
              กำลังโหลดรายละเอียดข้อสอบรายข้อ...
            </div>
          ) : filteredList.length === 0 ? (
            <div className="rounded-card border border-line bg-panel p-8 text-center text-sm text-muted">
              ไม่พบข้อสอบที่ตรงกับคำค้นหา
            </div>
          ) : (
            <div className="space-y-3">
              {filteredList.map((q) => {
                const isRight = correctSet.has(q.id);
                const isWrong = mistakeSet.has(q.id);
                const revealed = Boolean(revealedIds[q.id]);
                const stemIsRaw = isImageUrlString(q.stem || '');
                const stemImg = q.img || (stemIsRaw ? (q.stem || '').trim() : null);
                const stemText = stemIsRaw
                  ? 'พิจารณารูปภาพต่อไปนี้แล้วเลือกคำตอบที่ถูกต้อง'
                  : q.stem || '';

                return (
                  <article
                    key={q.id}
                    className="rounded-card border border-line bg-panel p-5 shadow-card space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-brand">#{q.id}</span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-bg2 px-2 py-0.5 font-semibold text-ink">
                          <SubjectIcon subjectKey={q.subject_key} size="sm" />
                          {SUBJECT_MAP[q.subject_key]?.shortName || q.subject_key}
                        </span>
                        {q.title && (
                          <span className="text-muted truncate max-w-[220px] sm:max-w-xs">
                            {q.title}
                          </span>
                        )}
                        {isRight ? (
                          <span className="rounded-md bg-teal/15 px-2 py-0.5 font-semibold text-teal-ink">
                            เคยทำถูก
                          </span>
                        ) : isWrong ? (
                          <span className="rounded-md bg-accent/15 px-2 py-0.5 font-semibold text-accent">
                            เคยทำผิด
                          </span>
                        ) : (
                          <span className="rounded-md bg-bg2 px-2 py-0.5 font-medium text-muted">
                            ยังไม่เคยตอบ
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/exam/bookmarks?qid=${q.id}&mode=practice&fresh=1`}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-dark"
                        >
                          <span>ฝึกข้อนี้</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => void toggleBookmark(q.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-line bg-bg2 px-2.5 py-1 text-xs font-semibold text-muted hover:border-accent/50 hover:text-accent"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>นำออก</span>
                        </button>
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

                      <div className="pt-1">
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
                          <div className="mt-2.5 rounded-xl border border-teal/30 bg-teal/[0.05] p-3.5 text-xs sm:text-sm space-y-2">
                            <div className="font-bold text-teal-ink">
                              คำตอบที่ถูกต้อง: ข้อ {CHOICE_LABELS[q.correct_index] || q.correct_index + 1}
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
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

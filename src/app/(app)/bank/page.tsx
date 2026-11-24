'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Database,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  Play,
  Search,
  X,
} from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { SubjectIcon } from '@/components/SubjectIcon';
import { ImageLightbox, isImageUrlString } from '@/components/ImageLightbox';
import { RichExamContent } from '@/components/RichExamContent';
import { primeProfileHistoryCache } from '@/lib/use-profile-history';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import {
  ACTIVE_SUBJECTS,
  CHOICE_LABELS,
  resolveTopicSelection,
  SUBJECT_MAP,
  type SubjectKey,
} from '@/lib/constants';
import type { QuestionRecord } from '@/lib/server-db';

interface TopicOption {
  title: string;
  subjectKey: SubjectKey;
  count: number;
}

function QuestionBankInner() {
  const searchParams = useSearchParams();
  const [subject, setSubject] = useState<string>(() => searchParams.get('subject') || '');
  const [topic, setTopic] = useState<string>(() => searchParams.get('topic') || '');
  const [batch, setBatch] = useState<string>(() => searchParams.get('batch') || '');
  const [query, setQuery] = useState<string>(() => searchParams.get('q') || '');
  const [hasImage, setHasImage] = useState<boolean>(() => searchParams.get('hasImage') === '1');
  const [page, setPage] = useState(1);

  const searchKey = searchParams.toString();
  const prevSearchKeyRef = useRef(searchKey);
  useEffect(() => {
    if (prevSearchKeyRef.current === searchKey) return;
    prevSearchKeyRef.current = searchKey;
    const sp = new URLSearchParams(searchKey);
    setSubject(sp.get('subject') || '');
    setTopic(sp.get('topic') || '');
    setBatch(sp.get('batch') || '');
    setQuery(sp.get('q') || '');
    setHasImage(sp.get('hasImage') === '1');
    setPage(1);
  }, [searchKey]);

  const hasActiveFilters = Boolean(subject || topic || batch || query.trim() || hasImage);
  const resetFilters = () => {
    setSubject('');
    setTopic('');
    setBatch('');
    setQuery('');
    setHasImage(false);
    setPage(1);
  };

  const [items, setItems] = useState<QuestionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [batches, setBatches] = useState<Array<{ batch: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [revealedIds, setRevealedIds] = useState<Record<number, boolean>>({});
  const [bookmarks, setBookmarks] = useState<number[]>([]);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => {
        if (d.profile?.bookmarks) setBookmarks(d.profile.bookmarks);
      })
      .catch(() => {});
  }, []);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (subject) params.set('subject', subject);
    if (topic) params.set('topic', topic);
    if (batch) params.set('batch', batch);
    if (query.trim()) params.set('q', query.trim());
    if (hasImage) params.set('hasImage', '1');
    params.set('page', String(page));
    params.set('limit', '15');

    try {
      const res = await fetch(`/api/questions?${params.toString()}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setTopics(data.topics || []);
      setBatches(data.batches || []);
    } finally {
      setLoading(false);
    }
  }, [subject, topic, batch, query, hasImage, page]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadQuestions();
    }, 180);
    return () => clearTimeout(t);
  }, [loadQuestions]);

  const toggleBookmark = async (qid: number) => {
    setBookmarks((prev) =>
      prev.includes(qid) ? prev.filter((id) => id !== qid) : [...prev, qid]
    );
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toggleBookmarkId: qid }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d?.profile) primeProfileHistoryCache(d.profile);
      }
    } catch {
      // ignore network error
    }
  };

  const buildTopicDrillHref = () => {
    const p = new URLSearchParams();
    if (subject) p.set('subject', subject);
    if (topic) p.set('topic', topic);
    p.set('mode', 'practice');
    p.set('count', '30');
    return `/exam/topic?${p.toString()}`;
  };

  return (
    <div className="min-h-screen bg-bg text-ink pb-24 md:pb-12">
      <SiteHeader mode="app" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-brand">
              <Database className="h-4 w-4" />
              <span>คลังข้อสอบเชิงลึก · 7,038 ข้อ</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              ค้นหาข้อสอบ 132 หัวข้อ
            </h1>
          </div>

          {(subject || topic) && (
            <Link
              href={buildTopicDrillHref()}
              className="inline-flex items-center gap-2 rounded-btn bg-brand px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              <Play className="h-3.5 w-3.5" />
              <span>ฝึกทำเฉพาะหัวข้อที่กรองอยู่ (สูงสุด 30 ข้อ)</span>
            </Link>
          )}
        </div>

        {/* Filter Bar */}
        <section className="mt-5 rounded-card border border-line bg-panel p-4 shadow-card overflow-hidden">
          <div className="grid gap-2.5 md:grid-cols-4 min-w-0">
            <div className="relative md:col-span-2 min-w-0">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="ค้นหาคำถาม ตัวเลือก คำอธิบาย หรือ ID ข้อสอบ..."
                className="w-full min-w-0 rounded-lg border border-line bg-bg2/50 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-brand focus:bg-panel"
              />
            </div>

            <select
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setTopic('');
                setPage(1);
              }}
              className="w-full min-w-0 max-w-full truncate rounded-lg border border-line bg-bg2/50 px-3 py-2 text-sm outline-none transition-colors focus:border-brand focus:bg-panel"
            >
              <option value="">ทุกรายวิชา ({ACTIVE_SUBJECTS.length} วิชา)</option>
              {ACTIVE_SUBJECTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setPage(1);
              }}
              className="w-full min-w-0 max-w-full truncate rounded-lg border border-line bg-bg2/50 px-3 py-2 text-sm outline-none transition-colors focus:border-brand focus:bg-panel"
            >
              <option value="">ทุกหัวข้อย่อย ({topics.length} หัวข้อ)</option>
              {topic && !topics.some((t) => t.title === topic) && (
                <option value={topic}>{resolveTopicSelection(topic).displayTopic.replace(/_/g, ' ')}</option>
              )}
              {topics.map((t) => (
                <option key={`${t.subjectKey}-${t.title}`} value={t.title}>
                  {t.title.replace(/_/g, ' ')} ({t.count})
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 min-w-0 pt-2.5 border-t border-line/70">
            <div className="flex flex-wrap items-center gap-2.5 min-w-0 w-full sm:w-auto">
              <select
                value={batch}
                onChange={(e) => {
                  setBatch(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-auto min-w-0 max-w-full truncate rounded-lg border border-line bg-bg2/50 px-2.5 py-1.5 text-xs font-medium outline-none focus:border-brand"
              >
                <option value="">ทุกชุดนำเข้า</option>
                {batches.map((b) => (
                  <option key={b.batch} value={b.batch}>
                    {b.batch} ({b.count})
                  </option>
                ))}
              </select>

              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-bg2/50 px-2.5 py-1.5 text-xs font-medium text-ink">
                <input
                  type="checkbox"
                  checked={hasImage}
                  onChange={(e) => {
                    setHasImage(e.target.checked);
                    setPage(1);
                  }}
                />
                <ImageIcon className="h-3.5 w-3.5 text-brand" />
                <span>เฉพาะข้อที่มีรูปภาพ</span>
              </label>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand/50 hover:text-brand"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>ล้างตัวกรอง</span>
                </button>
              )}
            </div>

            <div className="text-xs text-muted tabular-nums">
              พบ <span className="font-semibold text-ink">{total.toLocaleString()}</span> ข้อ · หน้า {page}/{totalPages}
            </div>
          </div>
        </section>

        {/* Block-Card Topic Browser (7 Main Subject Cards -> Sub-Topic Cards) */}
        <section
          aria-label="เลือกจากการ์ดวิชาหลักและหัวข้อย่อย"
          className="mt-4 rounded-card border border-line bg-panel p-4 shadow-card overflow-hidden space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink min-w-0">
              <Layers className="h-4 w-4 text-brand shrink-0" />
              <span className="truncate">
                {subject
                  ? `หัวข้อย่อย · ${SUBJECT_MAP[subject as SubjectKey]?.name || subject}`
                  : 'เลือกดูตามการ์ดวิชาหลัก'}
              </span>
            </div>

            {subject && (
              <div className="flex flex-wrap items-center gap-1.5">
                {topic && (
                  <button
                    type="button"
                    onClick={() => {
                      setTopic('');
                      setPage(1);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-line bg-bg2/60 px-2.5 py-1 text-xs font-medium text-muted hover:text-ink"
                  >
                    <X className="h-3 w-3" />
                    <span>แสดงทุกหัวข้อในวิชานี้</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSubject('');
                    setTopic('');
                    setPage(1);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand/30 bg-brand/5 px-2.5 py-1 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>กลับไปการ์ดวิชาหลัก (7 วิชา)</span>
                </button>
              </div>
            )}
          </div>

          {!subject ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 min-w-0">
              {ACTIVE_SUBJECTS.map((s) => {
                const subTopics = topics.filter((t) => t.subjectKey === s.key);
                const subQuestionCount = subTopics.reduce((sum, t) => sum + t.count, 0);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setSubject(s.key);
                      setTopic('');
                      setPage(1);
                    }}
                    className="flex min-w-0 flex-col items-start justify-between gap-2 rounded-xl border border-line bg-bg2/40 p-3 text-left transition-colors hover:border-brand/50 hover:bg-brand/5"
                  >
                    <div className="flex w-full items-center justify-between gap-1">
                      <SubjectIcon subjectKey={s.key} size="sm" />
                      <span className="text-[11px] font-medium text-brand tabular-nums shrink-0">
                        {subTopics.length} บท
                      </span>
                    </div>
                    <div className="w-full min-w-0 space-y-0.5">
                      <div className="truncate text-xs font-semibold text-ink">{s.shortName}</div>
                      {subQuestionCount > 0 && (
                        <div className="text-[11px] text-muted tabular-nums">
                          {subQuestionCount.toLocaleString()} ข้อ
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            (() => {
              const subjectTopics = topics.filter((t) => t.subjectKey === subject);
              const activeMatcher = topic ? resolveTopicSelection(topic) : null;
              return (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 min-w-0">
                  {subjectTopics.map((t) => {
                    const active = activeMatcher ? activeMatcher.matches(t.title) : false;
                    return (
                      <button
                        key={`${t.subjectKey}-${t.title}`}
                        type="button"
                        onClick={() => {
                          setTopic(t.title);
                          setPage(1);
                        }}
                        className={`flex min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                          active
                            ? 'border-brand bg-brand/10 font-semibold text-brand'
                            : 'border-line bg-bg2/40 font-medium text-ink hover:border-brand/50'
                        }`}
                      >
                        <span className="min-w-0 truncate">{t.title.replace(/_/g, ' ')}</span>
                        <span className="shrink-0 text-[11px] font-semibold text-brand tabular-nums">
                          {t.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()
          )}
        </section>

        {/* Questions List */}
        <div className="mt-5 space-y-4">
          {loading ? (
            <AppLoadingScreen
              variant="bank"
              includeHeader={false}
              title="กำลังดึงรายการข้อสอบจากคลัง..."
              subtitle="คัดกรองโจทย์ ตัวเลือก เฉลยละเอียด และภาพประกอบ SVG ความคมชัดสูง"
            />
          ) : items.length === 0 ? (
            <div className="rounded-card border border-line bg-panel p-10 text-center text-sm text-muted">
              ไม่พบข้อสอบที่ตรงกับเงื่อนไขการค้นหา
            </div>
          ) : (
            items.map((q) => {
              const revealed = Boolean(revealedIds[q.id]);
              const bookmarked = bookmarks.includes(q.id);
              const meta = SUBJECT_MAP[q.subject_key];

              return (
                <article
                  key={q.id}
                  className="overflow-hidden break-words rounded-card border border-line bg-panel p-5 shadow-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <SubjectIcon subjectKey={q.subject_key} size="sm" />
                      <span className="text-xs font-bold text-ink">{meta?.name || q.subject_key}</span>
                      {q.title && (
                        <span className="max-w-full truncate rounded-full bg-bg2 px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                          {q.title.replace(/_/g, ' ')}
                        </span>
                      )}
                      <span className="font-mono text-[11px] text-muted">#{q.id}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleBookmark(q.id)}
                        className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-bold transition-colors ${
                          bookmarked
                            ? 'border-gold bg-gold/15 text-gold-ink'
                            : 'border-line text-muted hover:text-ink'
                        }`}
                      >
                        <Bookmark className={`h-3.5 w-3.5 ${bookmarked ? 'fill-current' : ''}`} />
                        <span>{bookmarked ? 'อยู่ในคลังทบทวน' : 'ต้องการทบทวน'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setRevealedIds((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                        }
                        className="inline-flex items-center gap-1 rounded-xl border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-bold text-brand"
                      >
                        {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        <span>{revealed ? 'ซ่อนเฉลย' : 'ดูเฉลย'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 font-exam text-[16px] leading-relaxed text-ink">
                    {q.stem && isImageUrlString(q.stem) ? (
                      <ImageLightbox src={q.stem.trim()} alt={`ภาพโจทย์ #${q.id}`} />
                    ) : (
                      <RichExamContent text={q.stem} />
                    )}
                    {q.img && (
                      <div className="mt-3">
                        <ImageLightbox src={q.img} alt={`ภาพประกอบ #${q.id}`} />
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {q.opts.map((opt, idx) => {
                      const isCorrect = revealed && idx === q.correct_index;
                      const optImg = q.opt_imgs?.[idx];
                      return (
                        <div
                          key={idx}
                          className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 text-sm ${
                            isCorrect
                              ? 'border-teal bg-teal/15 font-bold text-ink'
                              : 'border-line bg-bg2/40 text-ink'
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                              isCorrect ? 'bg-teal-ink text-white' : 'bg-line text-muted'
                            }`}
                          >
                            {CHOICE_LABELS[idx] || idx + 1}
                          </span>
                          <div className="min-w-0 font-exam">
                            {opt && isImageUrlString(opt) ? (
                              <ImageLightbox src={opt.trim()} alt={`ตัวเลือก ${CHOICE_LABELS[idx]}`} className="max-h-24 rounded-lg bg-white" />
                            ) : (
                              <RichExamContent text={opt} inline={true} />
                            )}
                            {optImg && (
                              <div className="mt-1">
                                <ImageLightbox src={optImg} alt={`ภาพตัวเลือก ${CHOICE_LABELS[idx]}`} className="max-h-24 rounded-lg bg-white" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {revealed && (
                    <div className="mt-3 rounded-2xl border border-teal/35 bg-teal/10 p-3.5 text-sm">
                      <div className="font-bold text-teal-ink">
                        เฉลยข้อ {q.correct_label}
                      </div>
                      {q.explanation && (
                        <div className="mt-1 font-exam leading-relaxed text-ink">
                          {isImageUrlString(q.explanation) ? (
                            <ImageLightbox src={q.explanation.trim()} alt="ภาพคำอธิบายเฉลย" />
                          ) : (
                            <RichExamContent text={q.explanation} />
                          )}
                        </div>
                      )}
                      {q.explanation_img && (
                        <div className="mt-2">
                          <ImageLightbox src={q.explanation_img} alt="ภาพประกอบคำอธิบาย" />
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 rounded-xl border border-line bg-panel px-4 py-2 text-xs font-bold disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>ก่อนหน้า</span>
          </button>
          <span className="font-mono text-xs font-bold text-muted">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-1 rounded-xl border border-line bg-panel px-4 py-2 text-xs font-bold disabled:opacity-40"
          >
            <span>ถัดไป</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    </div>
  );
}

export default function QuestionBankPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg text-ink pb-24 md:pb-12">
          <SiteHeader mode="app" />
          <main className="mx-auto max-w-5xl px-4 py-8">
            <AppLoadingScreen
              variant="bank"
              includeHeader={false}
              title="กำลังโหลดคลังข้อสอบเชิงลึก..."
              subtitle="เตรียมตัวกรอง 132 หัวข้อ และคลังข้อสอบ 7,038 ข้อ"
            />
          </main>
        </div>
      }
    >
      <QuestionBankInner />
    </Suspense>
  );
}


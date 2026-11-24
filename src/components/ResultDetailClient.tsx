'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Bookmark,
  CheckCircle2,
  Clock,
  Filter,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { CHOICE_LABELS, SUBJECT_MAP } from '@/lib/constants';
import type { AttemptRecord, RunnerQuestion } from '@/lib/server-db';
import { SiteHeader } from '@/components/SiteHeader';
import { SubjectIcon } from '@/components/SubjectIcon';
import { ImageLightbox, isImageUrlString } from '@/components/ImageLightbox';
import { RichExamContent } from '@/components/RichExamContent';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { computeAttemptXp } from '@/lib/gamification';
import { useProfileHistory } from '@/lib/use-profile-history';

type ReviewFilter = 'all' | 'wrong' | 'correct' | 'unanswered';

export function ResultDetailClient() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<AttemptRecord | null>(null);
  const [questions, setQuestions] = useState<RunnerQuestion[]>([]);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const { bookmarkSet, toggleBookmark } = useProfileHistory();

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/attempts/${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('ไม่พบผลคะแนนของการสอบรายการนี้');
        }
        const data = await res.json();
        if (!active) return;
        setAttempt(data.attempt);
        setQuestions(data.questions || []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'โหลดผลสอบไม่สำเร็จ');
      } finally {
        if (active) setLoading(false);
      }
    }
    if (id) load();
    return () => {
      active = false;
    };
  }, [id]);

  const sortedTopics = useMemo(() => {
    if (!attempt?.perTopic) return [];
    return [...attempt.perTopic].sort((a, b) => a.pct - b.pct);
  }, [attempt]);

  const sortedSubjects = useMemo(() => {
    if (!attempt?.perSubject) return [];
    return [...attempt.perSubject].sort((a, b) => a.pct - b.pct);
  }, [attempt]);

  const earnedXp = useMemo(() => (attempt ? computeAttemptXp(attempt) : 0), [attempt]);

  const reviewItems = useMemo(() => {
    if (!attempt) return [];
    return questions
      .map((q, idx) => ({
        q,
        idx,
        userAns: attempt.answers[idx] ?? null,
        isCorrect: attempt.answers[idx] === q.c,
        isUnanswered: attempt.answers[idx] === null || attempt.answers[idx] === undefined,
      }))
      .filter((row) => {
        if (filter === 'wrong') return !row.isCorrect;
        if (filter === 'correct') return row.isCorrect;
        if (filter === 'unanswered') return row.isUnanswered;
        return true;
      });
  }, [attempt, questions, filter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-ink pb-24 md:pb-16">
        <SiteHeader mode="app" />
        <AppLoadingScreen
          variant="result"
          includeHeader={false}
          title="กำลังวิเคราะห์ผลคะแนนและจุดอ่อนรายหัวข้อ..."
          subtitle="คำนวณเกณฑ์ผ่าน 2 ภาค (60%) และจัดลำดับบทที่ควรซ่อมด่วน"
        />
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="min-h-screen bg-bg text-ink">
        <SiteHeader mode="app" />
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <div className="bg-panel border border-line rounded-card p-6 shadow-card space-y-3">
            <AlertCircle className="w-10 h-10 text-accent mx-auto" />
            <h1 className="text-lg font-extrabold">{error || 'ไม่พบผลคะแนน'}</h1>
            <p className="text-sm text-muted">ตรวจสอบจากหน้าประวัติการทำข้อสอบของคุณ</p>
            <div className="pt-2 flex justify-center gap-3">
              <Link href="/history" className="px-4 py-2.5 rounded-btn bg-brand text-white font-bold text-sm">
                ไปที่ประวัติการสอบ
              </Link>
              <Link href="/dashboard" className="px-4 py-2.5 rounded-btn border border-line font-bold text-sm">
                กลับแดชบอร์ด
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const mins = Math.floor(attempt.durationSec / 60);
  const secs = attempt.durationSec % 60;
  const wrongCount = attempt.wrongIndices.length;
  const weakestSubject = sortedSubjects[0] ?? null;
  const urgentWeakTopics = sortedTopics.filter((t) => t.pct < 60).slice(0, 3);
  const topWeakTopics = urgentWeakTopics.length > 0 ? urgentWeakTopics : sortedTopics.slice(0, 3);

  return (
    <div className="min-h-screen bg-bg text-ink pb-24 md:pb-16">
      <SiteHeader mode="app" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/history"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-ink"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ประวัติการสอบทั้งหมด</span>
          </Link>
          <span className="text-xs font-mono text-muted">
            รหัสผลสอบ #{attempt.id} · ส่งเมื่อ {new Date(attempt.submittedAt).toLocaleString('th-TH')}
          </span>
        </div>

        {/* Top Diagnostic Summary Hero */}
        <section className="bg-panel border border-line rounded-card p-6 sm:p-8 shadow-card">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold ${
                    attempt.passed ? 'bg-teal/15 text-teal-ink' : 'bg-accent/15 text-accent'
                  }`}
                >
                  {attempt.passed ? <Award className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                  <span>{attempt.passed ? 'ผ่านเกณฑ์มาตรฐาน 60%' : 'ยังไม่ผ่านเกณฑ์มาตรฐาน 60%'}</span>
                </span>
                <span className="px-2.5 py-1 rounded-full bg-bg2 border border-line text-xs font-bold text-muted">
                  {attempt.mode === 'real' ? 'โหมดจับเวลาจริง' : 'โหมดฝึกซ้อม'}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gold/15 border border-gold/40 text-xs font-extrabold font-mono text-gold-ink">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>+{earnedXp} XP</span>
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{attempt.setTitle}</h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted pt-1">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-ink" />
                  ถูก <strong className="text-ink">{attempt.score}</strong> / {attempt.total} ข้อ
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-accent" />
                  ผิด/ข้าม <strong className="text-ink">{wrongCount}</strong> ข้อ
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-brand" />
                  ใช้เวลา <strong className="text-ink">{mins} นาที {secs} วินาที</strong>
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex flex-wrap gap-2.5">
                {wrongCount > 0 && (
                  <Link
                    href="/exam/mistakes?fresh=1"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-btn bg-accent hover:bg-accent-dark text-white font-extrabold text-sm shadow-sm transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>ทำเฉพาะข้อที่ผิดซ้ำ</span>
                  </Link>
                )}
                <Link
                  href={`/exam/${encodeURIComponent(attempt.setId)}?mode=practice&fresh=1`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-btn bg-brand hover:bg-brand-dark text-white font-bold text-sm transition"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>ทำชุดนี้ใหม่อีกครั้ง</span>
                </Link>
                <Link
                  href="/bank"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-btn border border-line bg-bg2 font-bold text-sm hover:border-brand/50 transition"
                >
                  <span>เปิดคลังข้อสอบ 7,038 ข้อ</span>
                </Link>
              </div>
            </div>

            {/* Score Gauge */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-3">
              <div className="col-span-2 p-5 rounded-2xl border border-line bg-bg2 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-muted uppercase">คะแนนรวมสุทธิ</p>
                  <p className="text-4xl font-extrabold font-mono text-brand mt-1">{attempt.pct}%</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-muted">อัตราส่วน</p>
                  <p className="text-xl font-extrabold font-mono mt-1">
                    {attempt.score}/{attempt.total}
                  </p>
                </div>
              </div>

              {/* 2-Part Official Pass Rule */}
              {attempt.groups.map((grp) => (
                <div
                  key={grp.grp}
                  className={`p-4 rounded-2xl border ${
                    grp.pass ? 'border-teal/40 bg-teal/5' : 'border-accent/40 bg-accent/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-muted line-clamp-1">{grp.label}</span>
                    {grp.pass ? (
                      <ShieldCheck className="w-4 h-4 text-teal-ink shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-accent shrink-0" />
                    )}
                  </div>
                  <p className="text-2xl font-extrabold font-mono mt-1">{grp.pct}%</p>
                  <p className="text-xs text-muted mt-0.5">
                    {grp.correct}/{grp.total} ข้อ · {grp.pass ? 'ผ่าน 60%' : 'ต่ำกว่าเกณฑ์ 60%'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Personal Weakness Diagnostic Banner */}
        {(weakestSubject || topWeakTopics.length > 0) && (
          <section className="bg-panel border border-accent/35 rounded-card p-5 sm:p-6 shadow-card space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2 text-ink">
                  <Target className="w-5 h-5 text-accent" />
                  <span>วิเคราะห์จุดอ่อนจากชุดนี้ (สิ่งที่ยังไม่ถนัด &amp; ต้องซ่อมด่วน)</span>
                </h2>
                <p className="text-xs sm:text-sm text-muted">
                  ระบบคัดเฉพาะวิชาและหัวข้อที่คุณทำได้น้อยที่สุดในชุดนี้ พร้อมปุ่มเจาะฝึกแก้จุดอ่อนทันที
                </p>
              </div>
              {weakestSubject && (
                <Link
                  href={`/exam/subject-${encodeURIComponent(weakestSubject.key)}?set=1&count=20&mode=practice&fresh=1`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-btn bg-accent hover:bg-accent-dark text-white text-xs sm:text-sm font-extrabold transition shrink-0"
                >
                  <span>ซ่อมด่วนวิชา{SUBJECT_MAP[weakestSubject.key]?.shortName || weakestSubject.key}</span>
                  <span className="font-mono text-xs opacity-90">({weakestSubject.pct}%)</span>
                </Link>
              )}
            </div>

            {topWeakTopics.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {topWeakTopics.map((tp, idx) => (
                  <div
                    key={tp.subjectKey + '-' + tp.title + '-' + idx}
                    className="p-3.5 rounded-2xl border border-line bg-bg2/70 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-brand truncate">
                          {SUBJECT_MAP[tp.subjectKey]?.shortName || tp.subjectKey}
                        </span>
                        <span
                          className={`font-mono font-extrabold ${
                            tp.pct >= 60 ? 'text-teal-ink' : 'text-accent'
                          }`}
                        >
                          {tp.pct}% ({tp.correct}/{tp.total})
                        </span>
                      </div>
                      <p className="text-sm font-bold text-ink line-clamp-2">{tp.title}</p>
                    </div>
                    <Link
                      href={`/exam/topic?subject=${encodeURIComponent(tp.subjectKey)}&topic=${encodeURIComponent(tp.title)}&count=20&mode=practice&fresh=1`}
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-brand/10 hover:bg-brand hover:text-white text-brand text-xs font-extrabold transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>เจาะฝึกซ่อมหัวข้อนี้</span>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Subject & Topic Breakdown */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Per Subject */}
          <div className="lg:col-span-6 bg-panel border border-line rounded-card p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-brand" />
                <span>วิเคราะห์คะแนนรายวิชา</span>
              </h2>
              <span className="text-xs text-muted">เกณฑ์แนะนำ 60%+</span>
            </div>
            <div className="space-y-3.5">
              {attempt.perSubject.map((sub) => {
                const meta = SUBJECT_MAP[sub.key];
                return (
                  <div key={sub.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <SubjectIcon subjectKey={sub.key} size="sm" />
                        <span className="font-bold truncate">{meta?.name || sub.key}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                        <span className="text-muted">
                          {sub.correct}/{sub.total}
                        </span>
                        <span className={`font-extrabold ${sub.pct >= 60 ? 'text-teal-ink' : 'text-accent'}`}>
                          {sub.pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-bg2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${sub.pct >= 60 ? 'bg-teal' : 'bg-accent'}`}
                        style={{ width: `${Math.min(100, sub.pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weak Sub-topics Drill Suggestions */}
          <div className="lg:col-span-6 bg-panel border border-line rounded-card p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold flex items-center gap-2">
                <Target className="w-5 h-5 text-accent" />
                <span>เจาะลึกหัวข้อย่อยที่ควรทบทวน</span>
              </h2>
              <span className="text-xs text-muted">เรียงจากคะแนนน้อยที่สุด</span>
            </div>
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {sortedTopics.map((tp, idx) => (
                <div
                  key={tp.subjectKey + '-' + tp.title + '-' + idx}
                  className="p-3 rounded-2xl border border-line bg-bg2/60 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{tp.title}</p>
                    <p className="text-xs text-muted">
                      {SUBJECT_MAP[tp.subjectKey]?.shortName || tp.subjectKey} · ถูก {tp.correct}/{tp.total} ข้อ (
                      <span className={tp.pct >= 60 ? 'text-teal-ink font-bold' : 'text-accent font-bold'}>
                        {tp.pct}%
                      </span>
                      )
                    </p>
                  </div>
                  <Link
                    href={`/exam/topic?subject=${encodeURIComponent(tp.subjectKey)}&topic=${encodeURIComponent(tp.title)}&count=20&mode=practice&fresh=1`}
                    className="px-3 py-1.5 rounded-xl bg-brand/10 hover:bg-brand hover:text-white text-brand text-xs font-extrabold shrink-0 transition"
                  >
                    เจาะฝึกหัวข้อนี้
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Full Question Review */}
        <section className="bg-panel border border-line rounded-card p-6 shadow-card space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-line">
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <Filter className="w-5 h-5 text-brand" />
              <span>เฉลยและคำอธิบายรายข้อ ({reviewItems.length} ข้อ)</span>
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['all', `ทั้งหมด (${questions.length})`],
                  ['wrong', `ตอบผิด/ข้าม (${wrongCount})`],
                  ['correct', `ตอบถูก (${attempt.score})`],
                  ['unanswered', 'ไม่ได้ตอบ'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
                    filter === key
                      ? 'bg-brand border-brand text-white'
                      : 'border-line bg-bg2 text-muted hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            {reviewItems.map(({ q, idx, userAns, isCorrect }) => {
              const isInVault = bookmarkSet.has(q.id);
              return (
                <article
                  key={q.id + '-' + idx}
                  className={`p-5 rounded-2xl border ${
                    isCorrect ? 'border-teal/30 bg-teal/[0.03]' : 'border-accent/30 bg-accent/[0.03]'
                  } space-y-3 font-exam`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                          isCorrect ? 'bg-teal/20 text-teal-ink' : 'bg-accent/15 text-accent'
                        }`}
                      >
                        {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>ข้อ {idx + 1} · {isCorrect ? 'ถูกต้อง' : userAns === null ? 'ไม่ได้ตอบ' : 'ตอบผิด'}</span>
                      </span>
                      <span className="text-xs font-mono text-muted">
                        #{q.id} · {SUBJECT_MAP[q.subject]?.shortName || q.subject}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void toggleBookmark(q.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        isInVault
                          ? 'border-gold bg-gold/20 text-gold-ink'
                          : 'border-line bg-panel text-muted hover:border-gold/50 hover:text-ink'
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${isInVault ? 'fill-current' : ''}`} />
                      <span>{isInVault ? 'อยู่ในคลังทบทวน' : 'ต้องการทบทวน'}</span>
                    </button>
                  </div>

                  {(() => {
                    const stemIsRaw = isImageUrlString(q.b);
                    const stemImg = q.img || (stemIsRaw ? q.b.trim() : null);
                    const stemText = stemIsRaw
                      ? 'พิจารณารูปภาพต่อไปนี้แล้วเลือกคำตอบที่ถูกต้อง'
                      : q.b;
                    return (
                      <>
                        <RichExamContent
                          text={stemText}
                          className="text-base font-semibold text-ink"
                        />
                        {stemImg && (
                          <ImageLightbox
                            src={stemImg}
                            alt={`ภาพข้อ ${q.id}`}
                            className="max-h-64 rounded-xl border border-line object-contain bg-panel p-1.5"
                          />
                        )}
                      </>
                    );
                  })()}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {q.opts.map((opt, optIdx) => {
                      const label = CHOICE_LABELS[optIdx] || String(optIdx + 1);
                      const isTarget = q.c === optIdx;
                      const isPicked = userAns === optIdx;
                      const optIsRaw = isImageUrlString(opt);
                      const optImg = q.optImgs?.[optIdx] || (optIsRaw ? opt.trim() : null);
                      const optDisplayText = optIsRaw ? '' : opt;
                      let cls = 'border-line bg-panel text-ink/85';
                      if (isTarget) cls = 'border-teal bg-teal/15 text-ink font-bold';
                      else if (isPicked && !isTarget) cls = 'border-accent bg-accent/15 text-accent font-bold';

                      return (
                        <div key={optIdx} className={`p-3 rounded-xl border text-sm flex items-start gap-2 ${cls}`}>
                          <span className="font-mono font-extrabold shrink-0">{label}.</span>
                          <div className="flex-1 min-w-0">
                            {optDisplayText && <RichExamContent text={optDisplayText} inline={true} />}
                            {optImg && (
                              <div className={optDisplayText ? 'mt-1.5' : ''}>
                                <ImageLightbox
                                  src={optImg}
                                  alt={`ภาพตัวเลือก ${label}`}
                                  className="max-h-28 rounded-lg border border-line object-contain bg-panel p-1"
                                />
                              </div>
                            )}
                          </div>
                          {isTarget && <CheckCircle2 className="w-4 h-4 text-teal-ink shrink-0 mt-0.5" />}
                          {isPicked && !isTarget && <XCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />}
                        </div>
                      );
                    })}
                  </div>

                  {(() => {
                    const eIsRaw = isImageUrlString(q.e);
                    const eImg = q.eImg || (eIsRaw ? (q.e || '').trim() : null);
                    const eText = eIsRaw ? '' : q.e;
                    return (
                      <div className="p-3.5 rounded-xl bg-panel border border-line text-sm space-y-2">
                        <p className="font-extrabold text-teal-ink text-xs">
                          คำอธิบายเฉลย (ตอบ {CHOICE_LABELS[q.c] || q.c + 1})
                        </p>
                        {(eText || !eImg) && (
                          <RichExamContent
                            text={eText || 'เฉลยตามคลังข้อมูลข้อสอบมาตรฐาน นายสิบ โปร'}
                            className="text-ink/90 leading-relaxed"
                          />
                        )}
                        {eImg && (
                          <ImageLightbox
                            src={eImg}
                            alt={`ภาพเฉลยข้อ ${q.id}`}
                            className="max-h-64 rounded-xl border border-line object-contain bg-bg2 p-1.5"
                          />
                        )}
                      </div>
                    );
                  })()}
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

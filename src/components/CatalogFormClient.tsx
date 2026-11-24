'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  ArrowRight,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  Layers,
  Lock,
  Package,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';
import { ACTIVE_SUBJECTS, SUBJECT_MAP, TRACKS, type SubjectKey } from '@/lib/constants';
import type { AttemptRecord, ExamSetSummary } from '@/lib/server-db';
import {
  buildDynamicFormPacks,
  type DynamicPackMode,
} from '@/lib/question-pool';
import { useProfileHistory } from '@/lib/use-profile-history';
import { readAllSetDrafts, type SetDraftRecord } from '@/lib/set-draft-progress';
import { SubjectIcon } from '@/components/SubjectIcon';
import { useWorkspaceMode } from '@/components/WorkspaceModeProvider';
import {
  CatalogRealExamClient,
  type RealExamSetCardMeta,
} from '@/components/CatalogRealExamClient';

interface CatalogFormClientProps {
  sets: ExamSetSummary[];
  attempts: AttemptRecord[];
  subjectQuestionIds: Record<SubjectKey, number[]>;
  fixedSetIds: Record<string, number[]>;
  realExamSets: RealExamSetCardMeta[];
}

type FormViewMode = 'repack' | 'fixed';
type BucketFilter = 'all' | 'full' | 'remainder' | 'completed';

const FORM_PREF_KEY = 'gp:catalog-form-pref:v1';

export function CatalogFormClient({
  sets: initialSets,
  attempts: initialAttempts,
  subjectQuestionIds,
  fixedSetIds,
  realExamSets,
}: CatalogFormClientProps) {
  const { workspaceMode } = useWorkspaceMode();
  const [sets, setSets] = useState<ExamSetSummary[]>(initialSets);
  const [attempts, setAttempts] = useState<AttemptRecord[]>(initialAttempts);
  const [selectedSubject, setSelectedSubject] = useState<SubjectKey | ''>('');
  const [setDrafts, setSetDrafts] = useState<Record<string, SetDraftRecord>>({});

  const [viewMode, setViewMode] = useState<FormViewMode>('repack');
  const [packMode, setPackMode] = useState<DynamicPackMode>('fill');
  const [selectedTrack, setSelectedTrack] = useState<string>(TRACKS[0].name);
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>('all');

  const {
    correctSet,
    mistakeSet,
    allCompletedSet,
    bookmarkSet,
    saving,
    resetCompleted,
  } = useProfileHistory();

  // Expand compact subjectQuestionIds -> array for buildDynamicFormPacks
  const questionMeta = useMemo(() => {
    const list: Array<{ id: number; subject_key: SubjectKey }> = [];
    for (const s of ACTIVE_SUBJECTS) {
      const ids = subjectQuestionIds[s.key] || [];
      for (const id of ids) {
        list.push({ id, subject_key: s.key });
      }
    }
    return list;
  }, [subjectQuestionIds]);

  const totalPoolQuestions = questionMeta.length;

  // Load persisted view preferences & per-set drafts
  useEffect(() => {
    setSetDrafts(readAllSetDrafts());
    try {
      const raw = window.localStorage.getItem(FORM_PREF_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        viewMode: FormViewMode;
        packMode: DynamicPackMode;
        selectedTrack: string;
      }>;
      if (parsed.viewMode === 'repack' || parsed.viewMode === 'fixed') {
        setViewMode(parsed.viewMode);
      }
      if (parsed.packMode === 'fill' || parsed.packMode === 'strict') {
        setPackMode(parsed.packMode);
      }
      if (parsed.selectedTrack && TRACKS.some((t) => t.name === parsed.selectedTrack)) {
        setSelectedTrack(parsed.selectedTrack);
      }
    } catch {
      // ignore
    }
  }, []);

  const persistPrefs = (next: {
    viewMode?: FormViewMode;
    packMode?: DynamicPackMode;
    selectedTrack?: string;
  }) => {
    const merged = {
      viewMode: next.viewMode ?? viewMode,
      packMode: next.packMode ?? packMode,
      selectedTrack: next.selectedTrack ?? selectedTrack,
    };
    try {
      window.localStorage.setItem(FORM_PREF_KEY, JSON.stringify(merged));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let active = true;
    const syncData = async () => {
      try {
        const [setsRes, attRes] = await Promise.all([
          fetch('/api/admin/sets', { cache: 'no-store' }),
          fetch('/api/attempts', { cache: 'no-store' }),
        ]);
        if (!active) return;
        if (setsRes.ok) {
          const d = await setsRes.json();
          if (Array.isArray(d.sets)) {
            setSets(d.sets.filter((s: ExamSetSummary) => s.kind === 'form'));
          }
        }
        if (attRes.ok) {
          const a = await attRes.json();
          if (Array.isArray(a.attempts)) setAttempts(a.attempts);
        }
      } catch {
        // keep initial snapshot
      }
    };
    void syncData();
    const onRefreshDrafts = () => setSetDrafts(readAllSetDrafts());
    window.addEventListener('pageshow', onRefreshDrafts);
    window.addEventListener('gp:runtime-updated', onRefreshDrafts);
    return () => {
      active = false;
      window.removeEventListener('pageshow', onRefreshDrafts);
      window.removeEventListener('gp:runtime-updated', onRefreshDrafts);
    };
  }, []);

  const dynamicPacks = useMemo(
    () =>
      buildDynamicFormPacks(questionMeta, allCompletedSet, {
        packMode,
        trackName: selectedTrack,
        chunkSize: 150,
      }),
    [questionMeta, allCompletedSet, packMode, selectedTrack]
  );

  const availableSubjects = useMemo(() => {
    const keys = new Set<SubjectKey>();
    for (const s of sets) {
      for (const [k, count] of Object.entries(s.subjectBreakdown || {})) {
        if ((count || 0) > 0) keys.add(k as SubjectKey);
      }
    }
    return ACTIVE_SUBJECTS.filter((sub) => keys.has(sub.key));
  }, [sets]);

  const visibleFixedSets = useMemo(() => {
    if (!selectedSubject) return sets;
    return sets.filter((s) => (s.subjectBreakdown?.[selectedSubject] || 0) > 0);
  }, [sets, selectedSubject]);

  const visibleFullPacks = useMemo(() => {
    if (!selectedSubject) return dynamicPacks.fullSets;
    return dynamicPacks.fullSets.filter(
      (p) => (p.subjectBreakdown[selectedSubject] || 0) > 0
    );
  }, [dynamicPacks.fullSets, selectedSubject]);

  const subjectParam = selectedSubject ? `&subject=${selectedSubject}` : '';
  const trackParam = `&track=${encodeURIComponent(selectedTrack)}`;

  return (
    <div className="space-y-5">
      {workspaceMode === 'real-exam' ? (
        <CatalogRealExamClient sets={realExamSets} hideTopToggle />
      ) : (
        <>
          {/* Compact Pool Status Bar (No duplicate conflicting toggle) */}
      <div className="rounded-card border border-line bg-panel p-4 shadow-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs tabular-nums">
          <span className="font-semibold text-ink">
            คลังฝึกปกติ <strong className="text-brand">{totalPoolQuestions.toLocaleString()}</strong> ข้อ
          </span>
          <span className="text-muted">
            ยังไม่ทำ <strong className="text-ink">{dynamicPacks.remainingCount.toLocaleString()}</strong>
          </span>
          <span className="inline-flex items-center gap-1 text-teal-ink font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" />
            ถูก {correctSet.size.toLocaleString()}
          </span>
          <span className="inline-flex items-center gap-1 text-accent font-semibold">
            <XCircle className="h-3.5 w-3.5" />
            ผิด {mistakeSet.size.toLocaleString()}
          </span>
          <span className="text-[11px] text-muted">
            (กันชุดสนามจริง 4 ชุด · 643 ข้อแยกไว้ต่างหากแล้ว)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {allCompletedSet.size > 0 && (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (
                  window.confirm(
                    `ต้องการรีเซ็ตประวัติข้อสอบที่เคยทำทั้งหมด (${allCompletedSet.size} ข้อ) เพื่อให้นำกลับมาฝึกใหม่ใช่หรือไม่?`
                  )
                ) {
                  void resetCompleted({ scope: 'all', pool: 'all' });
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-line bg-bg2 px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>รีเซ็ตประวัติ</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Mode Switcher: Dynamic Re-pack vs Fixed Standard Sets */}
      <div className="rounded-card border border-line bg-panel p-4 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <SlidersHorizontal className="h-4 w-4 text-brand" />
            <span>เลือกรูปแบบการจัดชุดข้อสอบ (สลับได้ตลอด ไม่ต้องรีเซ็ตประวัติ)</span>
          </div>
          <Link
            href="/catalog/review"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold-ink transition-colors hover:bg-gold/20"
          >
            <BookmarkCheck className="h-3.5 w-3.5" />
            <span>คลังทบทวน ({bookmarkSet.size} ข้อ)</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setViewMode('repack');
              persistPrefs({ viewMode: 'repack' });
            }}
            className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
              viewMode === 'repack'
                ? 'border-brand bg-brand/8 ring-1 ring-brand/30'
                : 'border-line bg-bg2/40 hover:border-brand/40'
            }`}
          >
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                viewMode === 'repack'
                  ? 'bg-brand text-white'
                  : 'bg-panel text-muted border border-line'
              }`}
            >
              <RefreshCw className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink">
                จัดระเบียบใหม่ (3 กอง · ไม่ซ้ำข้อเดิม)
              </div>
              <p className="mt-0.5 text-xs text-muted leading-relaxed">
                ดึงข้อที่ยังไม่ทำมาจัดชุดเต็ม 150 ข้อใหม่เสมอ แยกกองเศษเก็บตกและกองที่ทำไปแล้วชัดเจน
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setViewMode('fixed');
              persistPrefs({ viewMode: 'fixed' });
            }}
            className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
              viewMode === 'fixed'
                ? 'border-brand bg-brand/8 ring-1 ring-brand/30'
                : 'border-line bg-bg2/40 hover:border-brand/40'
            }`}
          >
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                viewMode === 'fixed'
                  ? 'bg-brand text-white'
                  : 'bg-panel text-muted border border-line'
              }`}
            >
              <Lock className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink">
                ชุดเดิมมาตรฐาน (ล็อกชุด 1–{sets.length} · จำคำตอบค้างรายชุด)
              </div>
              <p className="mt-0.5 text-xs text-muted leading-relaxed">
                คงข้อสอบชุดเดิมไว้ทุกชุด จำว่าตอบข้อไหนค้างไว้ ทำต่อหรือทำซ้ำทั้งชุดได้โดยไม่รีเซ็ต
              </p>
            </div>
          </button>
        </div>

        {/* Sub-options when in Dynamic Re-pack Mode */}
        {viewMode === 'repack' && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted">กติกาจัดชุด 150 ข้อ:</span>
              <button
                type="button"
                onClick={() => {
                  setPackMode('fill');
                  persistPrefs({ packMode: 'fill' });
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  packMode === 'fill'
                    ? 'border-brand bg-brand text-white font-semibold'
                    : 'border-line bg-bg2/50 text-ink font-medium hover:border-brand/50'
                }`}
              >
                เติมให้ครบ 150 ข้อ (ยืดหยุ่น)
              </button>
              <button
                type="button"
                onClick={() => {
                  setPackMode('strict');
                  persistPrefs({ packMode: 'strict' });
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  packMode === 'strict'
                    ? 'border-brand bg-brand text-white font-semibold'
                    : 'border-line bg-bg2/50 text-ink font-medium hover:border-brand/50'
                }`}
              >
                เป๊ะตามสัดส่วนสายสอบ
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="track-pack-select" className="text-xs font-medium text-muted">
                สัดส่วนสายสอบ:
              </label>
              <select
                id="track-pack-select"
                value={selectedTrack}
                onChange={(e) => {
                  setSelectedTrack(e.target.value);
                  persistPrefs({ selectedTrack: e.target.value });
                }}
                className="rounded-lg border border-line bg-bg2 px-2.5 py-1.5 text-xs font-semibold text-ink focus:border-brand focus:outline-none"
              >
                {TRACKS.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Subject Filter Strip */}
      <div className="rounded-card border border-line bg-panel p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <Layers className="h-4 w-4 text-brand" />
            <span>กรองวิชาภายในชุด:</span>
          </div>
          {selectedSubject && (
            <span className="text-xs font-medium text-brand">
              กำลังกรอง: {SUBJECT_MAP[selectedSubject]?.name}
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedSubject('')}
            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              selectedSubject === ''
                ? 'border-brand bg-brand text-white font-semibold'
                : 'border-line bg-bg2/50 text-muted font-medium hover:border-brand/50 hover:text-ink'
            }`}
          >
            ครบทุกวิชา (150 ข้อ)
          </button>

          {availableSubjects.map((sub) => {
            const active = selectedSubject === sub.key;
            return (
              <button
                key={sub.key}
                type="button"
                onClick={() => setSelectedSubject(active ? '' : sub.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? 'border-brand bg-brand text-white font-semibold'
                    : 'border-line bg-bg2/50 text-ink font-medium hover:border-brand/50 hover:text-brand'
                }`}
              >
                <SubjectIcon subjectKey={sub.key} size="sm" />
                <span>เฉพาะ {sub.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================================================================
          VIEW 1: DYNAMIC 3-BUCKET RE-PACK VIEW
      ================================================================ */}
      {viewMode === 'repack' ? (
        <div className="space-y-5">
          {/* 3-Bucket Summary Bar */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setBucketFilter(bucketFilter === 'full' ? 'all' : 'full')}
              className={`rounded-card border p-4 text-left transition-colors shadow-card ${
                bucketFilter === 'full'
                  ? 'border-brand bg-brand/8'
                  : 'border-line bg-panel hover:border-brand/40'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-brand">
                <span>1. กองชุดเต็ม (150 ข้อ)</span>
                <Package className="h-4 w-4" />
              </div>
              <div className="mt-1.5 text-2xl font-bold tabular-nums text-ink">
                {dynamicPacks.fullSets.length} ชุด
              </div>
              <div className="mt-0.5 text-xs text-muted tabular-nums">
                รวม {(dynamicPacks.fullSets.length * 150).toLocaleString()} ข้อที่ยังไม่เคยทำ
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setBucketFilter(bucketFilter === 'remainder' ? 'all' : 'remainder')
              }
              className={`rounded-card border p-4 text-left transition-colors shadow-card ${
                bucketFilter === 'remainder'
                  ? 'border-gold bg-gold/10'
                  : 'border-line bg-panel hover:border-gold/50'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-gold-ink">
                <span>2. กองชุดเศษ / เก็บตก</span>
                <Layers className="h-4 w-4" />
              </div>
              <div className="mt-1.5 text-2xl font-bold tabular-nums text-ink">
                {(dynamicPacks.remainderSet?.total || 0).toLocaleString()} ข้อ
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {dynamicPacks.remainderSet
                  ? packMode === 'strict'
                    ? 'ข้อที่เหลือไม่ครบสัดส่วนสายสอบ'
                    : 'เศษที่เหลือไม่ครบ 150 ข้อ'
                  : 'ลงตัวพอดี ไม่มีเศษคงเหลือ'}
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                setBucketFilter(bucketFilter === 'completed' ? 'all' : 'completed')
              }
              className={`rounded-card border p-4 text-left transition-colors shadow-card ${
                bucketFilter === 'completed'
                  ? 'border-teal bg-teal/10'
                  : 'border-line bg-panel hover:border-teal/50'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-teal-ink">
                <span>3. กองข้อสอบที่ทำไปแล้ว</span>
                <Archive className="h-4 w-4" />
              </div>
              <div className="mt-1.5 text-2xl font-bold tabular-nums text-ink">
                {allCompletedSet.size.toLocaleString()} ข้อ
              </div>
              <div className="mt-0.5 text-xs text-muted tabular-nums">
                ถูก {correctSet.size.toLocaleString()} · ผิด {mistakeSet.size.toLocaleString()}
              </div>
            </button>
          </div>

          {bucketFilter !== 'all' && (
            <div className="flex items-center justify-between rounded-lg border border-line bg-bg2/50 px-3.5 py-2 text-xs">
              <span className="text-muted">
                กำลังแสดงเฉพาะ:{' '}
                <strong className="text-ink">
                  {bucketFilter === 'full'
                    ? 'กองชุดเต็ม 150 ข้อ'
                    : bucketFilter === 'remainder'
                      ? 'กองชุดเศษ / เก็บตก'
                      : 'กองข้อสอบที่ทำไปแล้ว'}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setBucketFilter('all')}
                className="font-semibold text-brand hover:underline"
              >
                แสดงครบทั้ง 3 กอง
              </button>
            </div>
          )}

          {/* BUCKET 1: FULL 150-QUESTION RE-PACKED SETS */}
          {(bucketFilter === 'all' || bucketFilter === 'full') && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-ink">
                  กองที่ 1 · ชุดเต็ม 150 ข้อจัดระเบียบใหม่ ({visibleFullPacks.length} ชุด)
                </h2>
                <span className="text-xs text-muted">
                  จัดใหม่ทุกครั้งเมื่อกดออกจากหน้าสอบ
                </span>
              </div>

              {visibleFullPacks.length === 0 ? (
                <div className="rounded-card border border-dashed border-line bg-panel p-6 text-center text-sm text-muted">
                  ไม่มีชุดเต็ม 150 ข้อคงเหลือในกติกานี้ ลองตรวจดูที่กองชุดเศษหรือสลับเป็นโหมด &ldquo;เติมให้ครบ 150 ข้อ&rdquo;
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleFullPacks.map((pack) => {
                    const effectiveCount = selectedSubject
                      ? pack.subjectBreakdown[selectedSubject] || 0
                      : pack.total;
                    const practiceHref = `/exam/repack-form?set=${pack.setIndex}&packMode=${packMode}${trackParam}&mode=practice&fresh=1${subjectParam}`;
                    const realHref = `/exam/repack-form?set=${pack.setIndex}&packMode=${packMode}${trackParam}&mode=real&fresh=1${subjectParam}`;

                    return (
                      <div
                        key={pack.setIndex}
                        className="rounded-card border border-line bg-panel p-5 shadow-card transition-colors hover:border-brand/40"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                                ชุดจัดใหม่ #{pack.setIndex}
                              </span>
                              <span className="text-xs font-medium text-muted tabular-nums">
                                {effectiveCount} ข้อ
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs text-muted">
                                <Clock className="h-3.5 w-3.5" />
                                {selectedSubject ? `${effectiveCount} นาที` : '180 นาที'}
                              </span>
                              <span
                                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                  pack.isTrackExact
                                    ? 'bg-teal/15 text-teal-ink'
                                    : 'bg-bg2 text-muted border border-line'
                                }`}
                              >
                                {pack.isTrackExact ? 'สัดส่วนสายสอบเป๊ะ' : 'เติมเต็ม 150 ข้อ'}
                              </span>
                            </div>

                            <h3 className="mt-2 text-base font-semibold text-ink">
                              ชุดจัดระเบียบใหม่ ชุดที่ {pack.setIndex} (ยังไม่เคยทำทั้งชุด)
                            </h3>

                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {Object.entries(pack.subjectBreakdown).map(([k, count]) => {
                                const sk = k as SubjectKey;
                                const subMeta = SUBJECT_MAP[sk];
                                if (!subMeta || !count) return null;
                                const isSel = selectedSubject === sk;
                                return (
                                  <span
                                    key={sk}
                                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums ${
                                      isSel
                                        ? 'border-brand bg-brand/10 text-brand font-semibold'
                                        : 'border-line bg-bg2/60 text-muted'
                                    }`}
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

                          <div className="flex shrink-0 items-center gap-2">
                            <Link
                              href={practiceHref}
                              className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-panel px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand"
                            >
                              <span>ฝึกซ้อม</span>
                            </Link>
                            <Link
                              href={realHref}
                              className="inline-flex items-center gap-1.5 rounded-btn bg-brand px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-dark"
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
              )}
            </section>
          )}

          {/* BUCKET 2: REMAINDER / PARTIAL SET */}
          {(bucketFilter === 'all' || bucketFilter === 'remainder') && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-ink">
                กองที่ 2 · ชุดเศษ / เก็บตก (ยังไม่ครบ 150 ข้อ)
              </h2>

              {!dynamicPacks.remainderSet ? (
                <div className="rounded-card border border-dashed border-line bg-panel p-5 text-sm text-muted">
                  ไม่มีข้อสอบเศษคงเหลือ ข้อสอบที่ยังไม่ได้ทำทั้งหมดถูกจัดลงชุดเต็ม 150 ข้อครบแล้ว
                </div>
              ) : (
                <div className="rounded-card border border-gold/40 bg-panel p-5 shadow-card">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-gold-ink">
                          ชุดเก็บตก (ไม่ครบ 150 ข้อ)
                        </span>
                        <span className="text-xs font-semibold text-ink tabular-nums">
                          {selectedSubject
                            ? dynamicPacks.remainderSet.subjectBreakdown[selectedSubject] || 0
                            : dynamicPacks.remainderSet.total}{' '}
                          ข้อ
                        </span>
                      </div>

                      <h3 className="mt-2 text-base font-semibold text-ink">
                        ข้อสอบที่เหลือเก็บตก ({dynamicPacks.remainderSet.total.toLocaleString()} ข้อ)
                      </h3>
                      <p className="mt-0.5 text-xs text-muted">
                        รวมข้อสอบที่ยังไม่ได้ทำแต่เหลือไม่พอจัดเป็นชุดเต็ม 150 ข้อ แยกไว้ให้เก็บตกโดยเฉพาะ
                      </p>

                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {Object.entries(dynamicPacks.remainderSet.subjectBreakdown).map(
                          ([k, count]) => {
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
                          }
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/exam/repack-form?set=0&packMode=${packMode}${trackParam}&mode=practice&fresh=1${subjectParam}`}
                        className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-panel px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand"
                      >
                        <span>ฝึกเก็บตก</span>
                      </Link>
                      <Link
                        href={`/exam/repack-form?set=0&packMode=${packMode}${trackParam}&mode=real&fresh=1${subjectParam}`}
                        className="inline-flex items-center gap-1.5 rounded-btn bg-brand px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-dark"
                      >
                        <span>ทำชุดเก็บตก</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* BUCKET 3: COMPLETED POOL */}
          {(bucketFilter === 'all' || bucketFilter === 'completed') && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-ink">
                กองที่ 3 · ข้อสอบที่ทำไปแล้ว ({allCompletedSet.size.toLocaleString()} ข้อ)
              </h2>

              <div className="rounded-card border border-line bg-panel p-5 shadow-card">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold tabular-nums">
                      <span className="inline-flex items-center gap-1 text-teal-ink">
                        <CheckCircle2 className="h-4 w-4" />
                        ทำถูก {correctSet.size.toLocaleString()} ข้อ
                      </span>
                      <span className="inline-flex items-center gap-1 text-accent">
                        <XCircle className="h-4 w-4" />
                        ทำผิด {mistakeSet.size.toLocaleString()} ข้อ
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted leading-relaxed">
                      ข้อที่กดตอบไปแล้วจากทุกโหมดจะถูกย้ายมาไว้กองนี้โดยอัตโนมัติ คุณสามารถกดฝึกซ้ำเฉพาะข้อผิด หรือเปิดดูแยกตามชุด/วิชา/หัวข้อได้ตลอดเวลา
                    </p>
                  </div>

                  <div className="flex flex-wrap shrink-0 items-center gap-2">
                    {mistakeSet.size > 0 && (
                      <Link
                        href="/exam/completed-form?pool=wrong&mode=practice&fresh=1"
                        className="inline-flex items-center gap-1.5 rounded-btn border border-accent/40 bg-accent/10 px-3.5 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/15"
                      >
                        <span>ซ่อมข้อผิด ({mistakeSet.size})</span>
                      </Link>
                    )}
                    <Link
                      href="/catalog/completed"
                      className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-bg2 px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand"
                    >
                      <span>เปิดกองที่ทำไปแล้วทั้งหมด</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      ) : (
        /* ================================================================
           VIEW 2: FIXED STANDARD SETS (201..215 — PER-SET RESUME + NO RESET)
        ================================================================ */
        <div className="space-y-3.5">
          {visibleFixedSets.map((s, idx) => {
            const bestAttempt = attempts
              .filter((a) => a.setId === String(s.id))
              .sort((a, b) => b.score - a.score)[0];

            const draft = setDrafts[String(s.id)];
            const idsInSet = fixedSetIds[String(s.id)] || [];
            let doneCount = 0;
            let rightCount = 0;
            let wrongCount = 0;
            for (const qid of idsInSet) {
              if (correctSet.has(qid)) {
                doneCount++;
                rightCount++;
              } else if (mistakeSet.has(qid)) {
                doneCount++;
                wrongCount++;
              }
            }
            const totalInSet = idsInSet.length || s.total;
            const remainingInSet = Math.max(0, totalInSet - doneCount);
            const progressPct =
              totalInSet > 0 ? Math.min(100, Math.round((doneCount / totalInSet) * 100)) : 0;

            const effectiveCount = selectedSubject
              ? s.subjectBreakdown?.[selectedSubject] || 0
              : s.total;
            const resumeHref = `/exam/${s.id}?mode=${draft?.mode || 'practice'}${subjectParam}&excludeCompleted=0`;
            const fullSetPracticeHref = `/exam/${s.id}?mode=practice&fresh=1${subjectParam}&excludeCompleted=0`;
            const fullSetRealHref = `/exam/${s.id}?mode=real&fresh=1${subjectParam}&excludeCompleted=0`;
            const remainingOnlyHref = `/exam/${s.id}?mode=practice&fresh=1${subjectParam}&excludeCompleted=1`;

            return (
              <div
                key={s.id}
                className="rounded-card border border-line bg-panel p-5 shadow-card transition-colors hover:border-brand/40"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                        ชุดเดิม #{idx + 1}
                      </span>
                      <span className="text-xs font-medium text-muted tabular-nums">
                        {effectiveCount} ข้อ
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted">
                        <Clock className="h-3.5 w-3.5" />
                        {selectedSubject ? `${effectiveCount} นาที` : `${s.timeMinutes} นาที`}
                      </span>
                      {draft && draft.answeredCount > 0 && (
                        <span className="rounded-md bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold-ink tabular-nums">
                          ทำค้างไว้ {draft.answeredCount}/{draft.total} ข้อ
                        </span>
                      )}
                      {bestAttempt && (
                        <span className="rounded-md bg-teal/15 px-2 py-0.5 text-xs font-semibold text-teal-ink tabular-nums">
                          สูงสุด {bestAttempt.score}/{bestAttempt.total} ({bestAttempt.pct}%)
                        </span>
                      )}
                    </div>

                    <h2 className="mt-2 text-base font-semibold text-ink">{s.title}</h2>

                    {/* Per-set progress bar without resetting */}
                    <div className="mt-2.5 max-w-md space-y-1">
                      <div className="flex items-center justify-between text-[11px] tabular-nums">
                        <span className="font-medium text-ink">
                          ประวัติชุดนี้: ตอบแล้ว {doneCount}/{totalInSet} ข้อ ({progressPct}%)
                        </span>
                        {doneCount > 0 && (
                          <span className="text-muted">
                            ถูก <strong className="text-teal-ink">{rightCount}</strong> · ผิด{' '}
                            <strong className="text-accent">{wrongCount}</strong>
                          </span>
                        )}
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg2">
                        <div
                          className="h-full rounded-full bg-brand transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {Object.entries(s.subjectBreakdown || {}).map(([k, count]) => {
                        const sk = k as SubjectKey;
                        const subMeta = SUBJECT_MAP[sk];
                        if (!subMeta || !count) return null;
                        const isSel = selectedSubject === sk;
                        return (
                          <span
                            key={sk}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums ${
                              isSel
                                ? 'border-brand bg-brand/10 text-brand font-semibold'
                                : 'border-line bg-bg2/60 text-muted'
                            }`}
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
                    {draft && draft.answeredCount > 0 && !selectedSubject && (
                      <Link
                        href={resumeHref}
                        className="inline-flex items-center gap-1.5 rounded-btn bg-gold px-3.5 py-2 text-xs font-bold text-ink transition-opacity hover:opacity-90"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        <span>ทำต่อ ({draft.answeredCount}/{draft.total})</span>
                      </Link>
                    )}
                    {doneCount > 0 && remainingInSet > 0 && !selectedSubject && (
                      <Link
                        href={remainingOnlyHref}
                        className="inline-flex items-center gap-1.5 rounded-btn border border-brand/40 bg-brand/8 px-3.5 py-2 text-xs font-semibold text-brand transition-colors hover:bg-brand/15"
                      >
                        <span>ทำที่เหลือ ({remainingInSet})</span>
                      </Link>
                    )}
                    <Link
                      href={fullSetPracticeHref}
                      className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-panel px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-brand/50 hover:text-brand"
                    >
                      <span>ฝึกซ้อมทั้งชุด</span>
                    </Link>
                    <Link
                      href={fullSetRealHref}
                      className="inline-flex items-center gap-1.5 rounded-btn bg-brand px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-dark"
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
      )}
        </>
      )}
    </div>
  );
}

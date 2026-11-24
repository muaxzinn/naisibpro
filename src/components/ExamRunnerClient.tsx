'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Flag,
  Flame,
  Grid2X2,
  HelpCircle,
  Keyboard,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Scissors,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Target,
  Timer,
  X,
  XCircle,
} from 'lucide-react';
import { AWAY_TIMEOUT_MINUTES, CHOICE_LABELS, SUBJECT_MAP, SUBJECTS, type SubjectKey } from '@/lib/constants';
import { safeTruncateThai } from '@/lib/utf8-thai';
import { invalidateProfileHistoryCache, primeProfileHistoryCache } from '@/lib/use-profile-history';
import {
  clearSetDraft,
  isFixedDraftSupportedSet,
  readSetDraft,
  writeSetDraft,
} from '@/lib/set-draft-progress';
import type { ExamProgressRecord, RunnerQuestion } from '@/lib/server-db';
import { SubjectIcon } from '@/components/SubjectIcon';
import { ImageLightbox, isImageUrlString } from '@/components/ImageLightbox';
import { RichExamContent } from '@/components/RichExamContent';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';

const LOCAL_PROGRESS_KEY = 'gp:progress:v2';
const LOCAL_PREFS_KEY = 'gp:exam-prefs:v2';

type ExamMode = 'real' | 'practice' | 'review';
type RevealMode = 'instant' | 'end';
type TimerMode = 'timed' | 'elapsed';
type PaletteFilter = 'all' | 'unanswered' | 'bookmarked';
type FontScale = 'sm' | 'md' | 'lg';

interface ExamPayload {
  setId: string;
  title: string;
  durationSec: number;
  passRule: 'groups' | 'overall';
  items: RunnerQuestion[];
  total: number;
}

const REPORT_REASONS = [
  'โจทย์ไม่ครบถ้วน หรือพิมพ์ผิด',
  'ตัวเลือกซ้ำกัน หรือไม่มีคำตอบที่ถูกต้อง',
  'เฉลยคำตอบไม่ถูกต้อง',
  'รูปภาพประกอบไม่ชัด หรือแสดงผลผิดพลาด',
  'จัดหมวดหมู่วิชา หรือหัวข้อผิดพลาด',
];

function isMatchingProgress(
  prog: ExamProgressRecord | null | undefined,
  setId: string,
  mode: string,
  items: RunnerQuestion[]
): prog is ExamProgressRecord {
  return Boolean(
    prog &&
      prog.setId === setId &&
      prog.mode === mode &&
      Array.isArray(prog.list) &&
      prog.list.length === items.length &&
      prog.list.every((it, idx) => it.id === items[idx]?.id)
  );
}

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function ExamRunnerInner() {
  const params = useParams<{ setId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const setId = decodeURIComponent(String(params?.setId || '107'));
  const rawMode = searchParams.get('mode');
  const mode: ExamMode = rawMode === 'real' ? 'real' : rawMode === 'review' ? 'review' : 'practice';
  const track = searchParams.get('track') || '';
  const count = searchParams.get('count') || '';
  const subject = searchParams.get('subject') || '';
  const topic = searchParams.get('topic') || '';
  const shuffle = searchParams.get('shuffle') || '';
  const setParam = searchParams.get('set') || '';
  const urlExcludeParam = searchParams.get('excludeCompleted');
  const poolParam = searchParams.get('pool') || '';
  const packModeParam = searchParams.get('packMode') || '';
  const qidParam = searchParams.get('qid') || '';
  const isRealExamSet = setId.startsWith('real-');
  const isCompletedReviewSet =
    setId.startsWith('completed-') ||
    setId.startsWith('review-') ||
    setId === 'repack-form' ||
    isRealExamSet ||
    setId === 'mistakes' ||
    setId === 'bookmarks';
  const fresh = searchParams.get('fresh') === '1';
  const autostart = searchParams.get('autostart') === '1';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exam, setExam] = useState<ExamPayload | null>(null);

  const [revealMode, setRevealMode] = useState<RevealMode>(mode === 'real' ? 'end' : 'instant');
  const [timerMode, setTimerMode] = useState<TimerMode>(mode === 'real' ? 'timed' : 'elapsed');
  const [draftReveal, setDraftReveal] = useState<RevealMode>(mode === 'real' ? 'end' : 'instant');
  const [draftTimer, setDraftTimer] = useState<TimerMode>(mode === 'real' ? 'timed' : 'elapsed');
  const [excludeCompletedState, setExcludeCompletedState] = useState<boolean>(
    urlExcludeParam === '1'
  );
  const [draftExcludeCompleted, setDraftExcludeCompleted] = useState<boolean>(
    urlExcludeParam === '1'
  );
  const loadedExcludeRef = useRef<boolean>(urlExcludeParam === '1');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [setupConfigured, setSetupConfigured] = useState(mode === 'review' || autostart);
  const [unansweredOnlyMode, setUnansweredOnlyMode] = useState(false);
  const [showMobilePalette, setShowMobilePalette] = useState(false);

  const [combo, setCombo] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);

  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [cur, setCur] = useState(0);
  const [eliminated, setEliminated] = useState<Record<number, number[]>>({});
  const [bookmarkedIds, setBookmarkedIds] = useState<number[]>([]);
  const [startedAt, setStartedAt] = useState<string>(() => new Date().toISOString());
  const [endAt, setEndAt] = useState<number>(0);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [activeSec, setActiveSec] = useState<number>(0);

  const [paletteFilter, setPaletteFilter] = useState<PaletteFilter>('all');
  const [subjectFilter, setSubjectFilter] = useState<SubjectKey | 'all'>('all');
  const [focusMode, setFocusMode] = useState(false);
  const [cutMode, setCutMode] = useState(false);
  const [fontScale, setFontScale] = useState<FontScale>('md');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportNote, setReportNote] = useState('');
  const [reportSending, setReportSending] = useState(false);

  const autoSubmitLock = useRef(false);
  const awayAtRef = useRef<number | null>(null);
  const lastSavedRef = useRef<number>(0);

  const pushToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Load exam items, bookmarks & resumable progress
  useEffect(() => {
    let active = true;
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (track) qs.set('track', track);
        if (count) qs.set('count', count);
        if (subject) qs.set('subject', subject);
        if (topic) qs.set('topic', topic);
        if (shuffle) qs.set('shuffle', shuffle);
        if (setParam) qs.set('set', setParam);
        if (poolParam) qs.set('pool', poolParam);
        if (packModeParam) qs.set('packMode', packModeParam);
        if (qidParam) qs.set('qid', qidParam);
        if (urlExcludeParam === '1' || urlExcludeParam === '0') {
          qs.set('excludeCompleted', urlExcludeParam);
        }
        const initialExclude = urlExcludeParam === '1';
        loadedExcludeRef.current = initialExclude;
        setExcludeCompletedState(initialExclude);
        setDraftExcludeCompleted(initialExclude);

        const [examRes, profRes, progRes] = await Promise.all([
          fetch(`/api/exam/${encodeURIComponent(setId)}?${qs.toString()}`, { cache: 'no-store' }),
          fetch('/api/profile', { cache: 'no-store' }),
          fresh ? Promise.resolve(null) : fetch('/api/progress', { cache: 'no-store' }),
        ]);

        if (!examRes.ok) {
          throw new Error('ไม่สามารถโหลดชุดข้อสอบได้');
        }
        const examData = (await examRes.json()) as ExamPayload;
        if (!active) return;

        if (profRes.ok) {
          const profData = await profRes.json();
          const bms = Array.isArray(profData?.profile?.bookmarks) ? profData.profile.bookmarks : [];
          setBookmarkedIds(bms.map(Number));
          if (profData?.profile) primeProfileHistoryCache(profData.profile);
        }

        const total = examData.items.length;
        const now = Date.now();
        let restored: ExamProgressRecord | null = null;

        if (
          !fresh &&
          mode !== 'review' &&
          setId !== 'mistakes' &&
          setId !== 'bookmarks' &&
          setId !== 'repack-form' &&
          !setId.startsWith('review-')
        ) {
          try {
            const rawLocal = window.localStorage.getItem(LOCAL_PROGRESS_KEY);
            if (rawLocal) {
              const parsed = JSON.parse(rawLocal) as ExamProgressRecord;
              if (isMatchingProgress(parsed, setId, mode, examData.items)) {
                restored = parsed;
              }
            }
          } catch {
            // ignore storage parse error
          }
          if (!restored && isFixedDraftSupportedSet(setId)) {
            const setDraft = readSetDraft(setId);
            if (
              setDraft &&
              setDraft.questionIds.length === examData.items.length &&
              setDraft.questionIds.every((id, i) => examData.items[i]?.id === id)
            ) {
              restored = {
                setId,
                mode: setDraft.mode,
                list: examData.items.map((q) => ({ id: q.id, subject: q.subject })),
                answers: setDraft.answers,
                cur: setDraft.cur,
                startedAt: new Date(now).toISOString(),
                endAt: now + examData.durationSec * 1000,
                updatedAt: now,
                activeSec: 0,
                awayAt: null,
              };
            }
          }
          if (!restored && progRes && progRes.ok) {
            const pJson = await progRes.json();
            const serverProg = pJson?.progress as ExamProgressRecord | null;
            if (isMatchingProgress(serverProg, setId, mode, examData.items)) {
              restored = serverProg;
            }
          }
        }

        setSubjectFilter('all');
        setUnansweredOnlyMode(false);
        setCombo(0);
        setSessionXp(0);
        setExam(examData);

        let initialReveal: RevealMode = mode === 'real' ? 'end' : 'instant';
        let initialTimer: TimerMode = mode === 'real' ? 'timed' : 'elapsed';
        try {
          const rawPrefs = window.localStorage.getItem(LOCAL_PREFS_KEY);
          if (rawPrefs) {
            const parsedPrefs = JSON.parse(rawPrefs) as Partial<{
              revealMode: RevealMode;
              timerMode: TimerMode;
            }>;
            if (parsedPrefs.revealMode === 'instant' || parsedPrefs.revealMode === 'end') {
              initialReveal = parsedPrefs.revealMode;
            }
            if (parsedPrefs.timerMode === 'timed' || parsedPrefs.timerMode === 'elapsed') {
              initialTimer = parsedPrefs.timerMode;
            }
          }
        } catch {
          // ignore prefs parse errors
        }
        if (mode === 'review') {
          initialReveal = 'instant';
        }
        setRevealMode(initialReveal);
        setTimerMode(initialTimer);
        setDraftReveal(initialReveal);
        setDraftTimer(initialTimer);

        if (restored) {
          setAnswers(restored.answers);
          setCur(Math.min(Math.max(0, restored.cur || 0), Math.max(0, total - 1)));
          setStartedAt(restored.startedAt || new Date().toISOString());
          const nextEndAt = restored.endAt > now ? restored.endAt : now + examData.durationSec * 1000;
          setEndAt(nextEndAt);
          setRemainingSec(Math.max(1, Math.floor((nextEndAt - now) / 1000)));
          setActiveSec(restored.activeSec || 0);
          setShowSetupModal(false);
          setSetupConfigured(true);
          pushToast('กู้คืนความคืบหน้าเดิมจากการบันทึกล่าสุดเรียบร้อย');
        } else {
          setAnswers(new Array(total).fill(null));
          setCur(0);
          setStartedAt(new Date().toISOString());
          const targetEnd = now + examData.durationSec * 1000;
          setEndAt(targetEnd);
          setRemainingSec(examData.durationSec);
          setActiveSec(0);
          if (mode !== 'review' && !autostart && total > 0) {
            setShowSetupModal(true);
            setSetupConfigured(false);
          } else {
            setShowSetupModal(false);
            setSetupConfigured(true);
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อสอบ');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [
    setId,
    mode,
    track,
    count,
    subject,
    topic,
    shuffle,
    setParam,
    poolParam,
    urlExcludeParam,
    fresh,
    autostart,
    pushToast,
  ]);

  const currentQuestion = exam?.items[cur] ?? null;
  const answeredCount = useMemo(() => answers.filter((a) => a !== null).length, [answers]);
  const unansweredIndices = useMemo(
    () =>
      answers.reduce<number[]>((acc, ans, idx) => {
        if (ans === null || ans === undefined) acc.push(idx);
        return acc;
      }, []),
    [answers]
  );

  // Persist progress helper
  const saveProgressNow = useCallback(
    async (forceServer = false) => {
      if (!exam || exam.items.length === 0 || mode === 'review') return;
      const now = Date.now();
      const payload: ExamProgressRecord = {
        setId,
        mode: mode === 'real' ? 'real' : 'practice',
        list: exam.items.map((q) => ({ id: q.id, subject: q.subject })),
        answers,
        cur,
        startedAt,
        endAt,
        updatedAt: now,
        activeSec,
        awayAt: awayAtRef.current,
      };
      try {
        window.localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(payload));
        if (isFixedDraftSupportedSet(setId)) {
          writeSetDraft({
            setId,
            mode: mode === 'real' ? 'real' : 'practice',
            questionIds: exam.items.map((q) => q.id),
            answers,
            cur,
            answeredCount: answers.filter((a) => a !== null && a !== undefined).length,
            total: exam.items.length,
            updatedAt: new Date(now).toISOString(),
          });
        }
      } catch {
        // ignore quota errors
      }
      if (forceServer || now - lastSavedRef.current > 4000) {
        lastSavedRef.current = now;
        fetch('/api/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress: payload }),
        }).catch(() => {});
      }
    },
    [exam, mode, setId, answers, cur, startedAt, endAt, activeSec]
  );

  // Submit attempt to server
  const handleSubmit = useCallback(
    async (reasonMsg?: string) => {
      if (!exam || submitting) return;
      setSubmitting(true);
      setShowSubmitModal(false);
      if (reasonMsg) pushToast(reasonMsg);
      try {
        const effectiveMode = revealMode === 'end' && timerMode === 'timed' ? 'real' : 'practice';
        const res = await fetch('/api/attempts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            setId,
            setTitle: exam.title,
            mode: effectiveMode,
            passRule: exam.passRule,
            durationSec: Math.max(1, activeSec),
            startedAt,
            questionIds: exam.items.map((q) => q.id),
            answers,
            bookmarkedIds,
          }),
        });
        if (!res.ok) {
          throw new Error('ส่งคำตอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        }
        const data = await res.json();
        try {
          window.localStorage.removeItem(LOCAL_PROGRESS_KEY);
          if (isFixedDraftSupportedSet(setId)) {
            clearSetDraft(setId);
          }
        } catch {
          // ignore
        }
        invalidateProfileHistoryCache();
        await fetch('/api/progress', { method: 'DELETE' }).catch(() => {});
        router.push(`/result/${data.id}`);
      } catch (err) {
        setSubmitting(false);
        autoSubmitLock.current = false;
        pushToast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งข้อสอบ');
      }
    },
    [exam, submitting, revealMode, timerMode, setId, activeSec, startedAt, answers, bookmarkedIds, router, pushToast]
  );

  const openSubmitConfirmation = useCallback(() => {
    if (!exam) return;
    if (unansweredIndices.length > 0) {
      setCur(unansweredIndices[0]);
      setPaletteFilter('unanswered');
      pushToast(`ตรวจพบข้อที่ยังไม่ได้ทำ ${unansweredIndices.length} ข้อ ระบบพาไปที่ข้อ ${unansweredIndices[0] + 1}`);
    }
    setShowSubmitModal(true);
  }, [exam, unansweredIndices, pushToast]);

  const openSetupModal = useCallback(() => {
    setDraftReveal(revealMode);
    setDraftTimer(timerMode);
    setDraftExcludeCompleted(excludeCompletedState);
    setShowSetupModal(true);
  }, [revealMode, timerMode, excludeCompletedState]);

  const applySetupAndStart = useCallback(
    async (nextReveal: RevealMode, nextTimer: TimerMode, nextExclude: boolean) => {
      setRevealMode(nextReveal);
      setTimerMode(nextTimer);
      try {
        window.localStorage.setItem(
          LOCAL_PREFS_KEY,
          JSON.stringify({ revealMode: nextReveal, timerMode: nextTimer })
        );
      } catch {
        // ignore storage failure
      }

      if (!isCompletedReviewSet && nextExclude !== loadedExcludeRef.current) {
        setDraftExcludeCompleted(nextExclude);
        setExcludeCompletedState(nextExclude);
        loadedExcludeRef.current = nextExclude;
        fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ excludeCompleted: nextExclude }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.profile) primeProfileHistoryCache(d.profile);
          })
          .catch(() => {});

        try {
          setLoading(true);
          const qs = new URLSearchParams();
          if (track) qs.set('track', track);
          if (count) qs.set('count', count);
          if (subject) qs.set('subject', subject);
          if (topic) qs.set('topic', topic);
          if (shuffle) qs.set('shuffle', shuffle);
          if (setParam) qs.set('set', setParam);
          qs.set('excludeCompleted', nextExclude ? '1' : '0');

          const res = await fetch(`/api/exam/${encodeURIComponent(setId)}?${qs.toString()}`, {
            cache: 'no-store',
          });
          if (res.ok) {
            const nextExam = (await res.json()) as ExamPayload;
            setExam(nextExam);
            setAnswers(new Array(nextExam.items.length).fill(null));
            setCur(0);
            setEliminated({});
            setUnansweredOnlyMode(false);
            setStartedAt(new Date().toISOString());
            const targetEnd = Date.now() + nextExam.durationSec * 1000;
            setEndAt(targetEnd);
            setRemainingSec(nextExam.durationSec);
            setActiveSec(0);
          }
        } catch {
          // keep existing exam on failure
        } finally {
          setLoading(false);
        }
      } else if (!setupConfigured && exam) {
        const targetEnd = Date.now() + exam.durationSec * 1000;
        setEndAt(targetEnd);
        setRemainingSec(exam.durationSec);
        setActiveSec(0);
      }

      setSetupConfigured(true);
      setShowSetupModal(false);
      pushToast(
        nextReveal === 'instant'
          ? 'เปิดโหมดเฉลยข้อต่อข้อทันทีแล้ว'
          : 'เปิดโหมดเฉลยย้อนหลัง + วิเคราะห์จุดอ่อนเมื่อส่งข้อสอบ'
      );
    },
    [
      setupConfigured,
      exam,
      isCompletedReviewSet,
      setId,
      track,
      count,
      subject,
      topic,
      shuffle,
      setParam,
      pushToast,
    ]
  );

  // Countdown & active clock
  useEffect(() => {
    if (!exam || exam.items.length === 0 || mode === 'review' || showSetupModal) return;
    const timer = window.setInterval(() => {
      setActiveSec((s) => s + 1);
      if (timerMode === 'timed' && endAt > 0) {
        const diff = Math.max(0, Math.floor((endAt - Date.now()) / 1000));
        setRemainingSec(diff);
        if (diff <= 0 && !autoSubmitLock.current) {
          autoSubmitLock.current = true;
          handleSubmit('หมดเวลาทำข้อสอบ ระบบกำลังส่งคำตอบอัตโนมัติ...');
        }
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [exam, mode, timerMode, showSetupModal, endAt, handleSubmit]);

  // Away-timeout guard for real exam mode
  useEffect(() => {
    if (mode !== 'real' || !exam || exam.items.length === 0) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        awayAtRef.current = Date.now();
        saveProgressNow(true);
      } else if (document.visibilityState === 'visible' && awayAtRef.current) {
        const awayMin = (Date.now() - awayAtRef.current) / 60000;
        awayAtRef.current = null;
        if (awayMin >= AWAY_TIMEOUT_MINUTES && !autoSubmitLock.current) {
          autoSubmitLock.current = true;
          handleSubmit(`ออกจากหน้าสอบเกิน ${AWAY_TIMEOUT_MINUTES} นาที ระบบส่งคำตอบอัตโนมัติ`);
        } else {
          pushToast('กลับมาในสนามสอบจริงแล้ว เวลาสอบยังคงเดินต่อเนื่อง');
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [mode, exam, handleSubmit, saveProgressNow, pushToast]);

  // Periodic server autosave every 15s
  useEffect(() => {
    if (!exam || exam.items.length === 0 || mode === 'review') return;
    const id = window.setInterval(() => {
      saveProgressNow(true);
    }, 15000);
    return () => window.clearInterval(id);
  }, [exam, mode, saveProgressNow]);

  const selectAnswer = useCallback(
    (choiceIdx: number) => {
      if (!exam || mode === 'review') return;
      const q = exam.items[cur];
      if (!q) return;
      if (cutMode) {
        setEliminated((prev) => {
          const curList = prev[q.id] || [];
          const next = curList.includes(choiceIdx)
            ? curList.filter((i) => i !== choiceIdx)
            : [...curList, choiceIdx];
          return { ...prev, [q.id]: next };
        });
        return;
      }
      const wasUnanswered = answers[cur] === null || answers[cur] === undefined;
      const toggledOff = answers[cur] === choiceIdx;
      setAnswers((prev) => {
        const next = prev.slice();
        next[cur] = prev[cur] === choiceIdx ? null : choiceIdx;
        return next;
      });

      if (!toggledOff && revealMode === 'instant') {
        const outcomePayload = isRealExamSet
          ? { realExamOutcomes: [{ id: q.id, correct: choiceIdx === q.c }] }
          : { questionOutcomes: [{ id: q.id, correct: choiceIdx === q.c }] };
        fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(outcomePayload),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.profile) primeProfileHistoryCache(d.profile);
          })
          .catch(() => {});
      }

      if (!toggledOff && wasUnanswered) {
        if (revealMode === 'instant') {
          if (choiceIdx === q.c) {
            setCombo((c) => {
              const nextCombo = c + 1;
              setSessionXp((xp) => xp + 10 + (nextCombo >= 2 ? 5 : 0));
              return nextCombo;
            });
          } else {
            setCombo(0);
            setSessionXp((xp) => xp + 2);
          }
        } else {
          setSessionXp((xp) => xp + 5);
        }
      }

      setTimeout(() => saveProgressNow(false), 50);
    },
    [exam, mode, cur, cutMode, answers, revealMode, saveProgressNow]
  );

  const goPrevQuestion = useCallback(() => {
    if (!exam) return;
    if (unansweredOnlyMode && unansweredIndices.length > 0) {
      const prevSkipped = [...unansweredIndices].reverse().find((idx) => idx < cur);
      if (prevSkipped !== undefined) setCur(prevSkipped);
      else setCur(unansweredIndices[0]);
      return;
    }
    setCur((c) => Math.max(0, c - 1));
  }, [exam, unansweredOnlyMode, unansweredIndices, cur]);

  const goNextQuestion = useCallback(() => {
    if (!exam) return;
    if (unansweredOnlyMode && unansweredIndices.length > 0) {
      const nextSkipped = unansweredIndices.find((idx) => idx > cur);
      if (nextSkipped !== undefined) {
        setCur(nextSkipped);
      } else {
        setCur(unansweredIndices[0]);
      }
      return;
    }
    setCur((c) => Math.min(exam.total - 1, c + 1));
  }, [exam, unansweredOnlyMode, unansweredIndices, cur]);

  const toggleEliminate = useCallback((qid: number, choiceIdx: number) => {
    setEliminated((prev) => {
      const curList = prev[qid] || [];
      const next = curList.includes(choiceIdx)
        ? curList.filter((i) => i !== choiceIdx)
        : [...curList, choiceIdx];
      return { ...prev, [qid]: next };
    });
  }, []);

  const toggleBookmark = useCallback(
    async (qid: number) => {
      const willAdd = !bookmarkedIds.includes(qid);
      setBookmarkedIds((prev) =>
        prev.includes(qid) ? prev.filter((x) => x !== qid) : [...prev, qid]
      );
      pushToast(
        willAdd
          ? `เพิ่มข้อ #${qid} เข้าคลังทบทวนแล้ว`
          : `นำข้อ #${qid} ออกจากคลังทบทวนแล้ว`
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
        // ignore network hiccup
      }
    },
    [bookmarkedIds, pushToast]
  );

  const [exiting, setExiting] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  const getExitDestination = useCallback(() => {
    if (setId.startsWith('real-')) return '/catalog/form';
    if (setId.startsWith('review-') || setId === 'bookmarks') return '/catalog/completed?tab=review';
    if (setId.startsWith('completed-')) return '/catalog/completed';
    if (setId.startsWith('subject-')) return '/catalog/subject';
    if (setId === 'topic') return '/catalog/topics';
    if (setId === 'repack-form' || /^\d+$/.test(setId)) return '/catalog/form';
    return '/dashboard';
  }, [setId]);

  const performExit = useCallback(
    async (flushOutcomes: boolean) => {
      if (exiting) return;
      setExiting(true);
      setShowExitModal(false);
      try {
        saveProgressNow(true);
        if (flushOutcomes && exam && mode !== 'review') {
          const outcomes = exam.items
            .map((q, idx) => {
              const ans = answers[idx];
              if (ans === null || ans === undefined) return null;
              return { id: q.id, correct: ans === q.c };
            })
            .filter((x): x is { id: number; correct: boolean } => x !== null);

          if (outcomes.length > 0) {
            const payload = isRealExamSet
              ? { realExamOutcomes: outcomes }
              : { questionOutcomes: outcomes };
            const res = await fetch('/api/profile', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (res.ok) {
              const d = await res.json();
              if (d?.profile) {
                primeProfileHistoryCache(d.profile);
              } else {
                invalidateProfileHistoryCache();
              }
            } else {
              invalidateProfileHistoryCache();
            }
          }
        }
      } catch {
        invalidateProfileHistoryCache();
      } finally {
        router.push(getExitDestination());
      }
    },
    [exiting, saveProgressNow, exam, mode, answers, isRealExamSet, router, getExitDestination]
  );

  const handleExitExam = useCallback(() => {
    if (exiting) return;
    if (mode !== 'review' && revealMode === 'end' && answeredCount > 0) {
      setShowExitModal(true);
      return;
    }
    void performExit(true);
  }, [exiting, mode, revealMode, answeredCount, performExit]);

  // Keyboard shortcuts: 1-4, ArrowLeft, ArrowRight, B, F, E
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showReportModal || showSubmitModal || showShortcuts || showSetupModal || showMobilePalette) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (!exam || exam.items.length === 0) return;

      if (e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        selectAnswer(Number(e.key) - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNextQuestion();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrevQuestion();
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        const q = exam.items[cur];
        if (q) toggleBookmark(q.id);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFocusMode((f) => !f);
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setCutMode((m) => !m);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    exam,
    cur,
    showReportModal,
    showSubmitModal,
    showShortcuts,
    showSetupModal,
    showMobilePalette,
    selectAnswer,
    toggleBookmark,
    goNextQuestion,
    goPrevQuestion,
  ]);

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQuestion || reportSending) return;
    setReportSending(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: currentQuestion.id,
          question_text: safeTruncateThai(currentQuestion.b, 140),
          category: 'question',
          reason: reportReason,
          note: reportNote.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'ส่งรายงานไม่สำเร็จ');
      }
      setShowReportModal(false);
      setReportNote('');
      pushToast('ส่งแจ้งปัญหาข้อนี้ไปยังทีมวิชาการเรียบร้อยแล้ว');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'ไม่สามารถส่งรายงานได้');
    } finally {
      setReportSending(false);
    }
  };

  const subjectsInExam = useMemo(() => {
    if (!exam) return [];
    const grouped = new Map<SubjectKey, { count: number; answered: number; firstIdx: number }>();
    exam.items.forEach((q, idx) => {
      const prev = grouped.get(q.subject);
      const isAns = answers[idx] !== null && answers[idx] !== undefined;
      if (prev) {
        prev.count += 1;
        if (isAns) prev.answered += 1;
      } else {
        grouped.set(q.subject, { count: 1, answered: isAns ? 1 : 0, firstIdx: idx });
      }
    });
    return SUBJECTS.filter((s) => grouped.has(s.key)).map((s) => ({
      meta: s,
      ...grouped.get(s.key)!,
    }));
  }, [exam, answers]);

  const filteredIndices = useMemo(() => {
    if (!exam) return [];
    return exam.items
      .map((q, idx) => ({ q, idx }))
      .filter(({ q, idx }) => {
        if (subjectFilter !== 'all' && q.subject !== subjectFilter) return false;
        if (paletteFilter === 'unanswered') return answers[idx] === null;
        if (paletteFilter === 'bookmarked') return bookmarkedIds.includes(q.id);
        return true;
      })
      .map(({ idx }) => idx);
  }, [exam, subjectFilter, paletteFilter, answers, bookmarkedIds]);

  const stemSizeClass =
    fontScale === 'sm' ? 'text-[15px] leading-relaxed' : fontScale === 'lg' ? 'text-[19px] leading-relaxed' : 'text-[17px] leading-relaxed';

  if (loading) {
    return (
      <AppLoadingScreen
        variant="exam"
        includeHeader={false}
        title="กำลังจัดเตรียมชุดข้อสอบและกระดาษคำตอบ..."
        subtitle="ตรวจสอบประวัติข้อที่เคยทำและกู้คืนความคืบหน้าล่าสุด"
      />
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-ink px-4">
        <div className="max-w-md w-full bg-panel border border-line rounded-card p-6 text-center shadow-card">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-extrabold">{error || 'ไม่พบชุดข้อสอบ'}</h1>
          <p className="text-sm text-muted mt-2">กรุณากลับไปเลือกชุดข้อสอบหรือหัวข้อฝึกหัดใหม่อีกครั้ง</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/catalog" className="px-4 py-2.5 rounded-btn bg-brand text-white font-bold text-sm">
              เลือกชุดข้อสอบ
            </Link>
            <Link href="/dashboard" className="px-4 py-2.5 rounded-btn border border-line font-semibold text-sm">
              กลับหน้าหลัก
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (exam.items.length === 0 || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-ink px-4">
        <div className="max-w-md w-full bg-panel border border-line rounded-card p-6 text-center shadow-card">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-teal/15 text-teal-ink flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-extrabold">
            {excludeCompletedState && !isCompletedReviewSet
              ? 'ทำข้อสอบในชุดนี้ครบทุกข้อแล้ว!'
              : 'ยังไม่มีข้อสอบในรายการนี้'}
          </h1>
          <p className="text-sm text-muted mt-2">
            {setId === 'mistakes'
              ? 'ยอดเยี่ยมมาก! คุณยังไม่มีข้อที่ตอบผิดค้างอยู่ ลองทำข้อสอบชุดใหม่เพื่อสะสมสถิติได้เลย'
              : setId === 'bookmarks'
              ? 'คุณยังไม่ได้ติดดาวข้อสอบข้อใด กดติดดาวระหว่างทำข้อสอบเพื่อกลับมาทบทวนได้ที่นี่'
              : setId.startsWith('completed-')
              ? 'ยังไม่มีข้อสอบที่ตรงกับกลุ่มและวิชาที่เลือก ลองฝึกทำข้อสอบใหม่ก่อนกลับมาทบทวนที่นี่'
              : excludeCompletedState
              ? 'คุณได้ทำข้อสอบทุกข้อในหมวดนี้ไปแล้ว หากต้องการฝึกซ้ำสามารถเปิดดูข้อทั้งหมดหรือไปที่หน้าข้อที่เคยทำแล้ว'
              : 'ไม่พบข้อสอบที่ตรงกับเงื่อนไขที่เลือก'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {excludeCompletedState && !isCompletedReviewSet && (
              <button
                type="button"
                onClick={() => void applySetupAndStart(revealMode, timerMode, false)}
                className="px-4 py-2.5 rounded-btn bg-brand text-white font-bold text-sm"
              >
                แสดงข้อสอบทั้งหมดในชุดนี้
              </button>
            )}
            <Link href="/catalog/completed" className="px-4 py-2.5 rounded-btn bg-teal text-white font-bold text-sm">
              ชุดข้อสอบที่เคยทำแล้ว
            </Link>
            <Link href="/catalog/topics" className="px-4 py-2.5 rounded-btn border border-line font-semibold text-sm">
              กลับหน้าแคตตาล็อก
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const userChoice = answers[cur];
  const isAnswered = userChoice !== null;
  const showInstantFeedback = (revealMode === 'instant' && isAnswered) || mode === 'review';
  const isBookmarked = bookmarkedIds.includes(currentQuestion.id);
  const currentEliminated = eliminated[currentQuestion.id] || [];
  const subjMeta = SUBJECT_MAP[currentQuestion.subject];
  const urgentClock = timerMode === 'timed' && remainingSec <= 300;

  const stemIsRawUrl = isImageUrlString(currentQuestion.b);
  const effectiveStemImg = currentQuestion.img || (stemIsRawUrl ? (currentQuestion.b || '').trim() : null);
  const effectiveStemText =
    stemIsRawUrl || (!String(currentQuestion.b || '').trim() && Boolean(effectiveStemImg))
      ? 'พิจารณารูปภาพต่อไปนี้แล้วเลือกคำตอบที่ถูกต้อง'
      : currentQuestion.b;

  const expIsRawUrl = isImageUrlString(currentQuestion.e);
  const effectiveExpImg = currentQuestion.eImg || (expIsRawUrl ? (currentQuestion.e || '').trim() : null);
  const effectiveExpText = expIsRawUrl ? '' : currentQuestion.e;

  const palettePanelContent = (
    <div className="bg-panel border border-line rounded-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold">แผนผังข้อสอบ</h2>
        <span className="text-xs font-mono text-muted">
          {answeredCount}/{exam.total} ข้อ
        </span>
      </div>

      {subjectsInExam.length > 1 && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <select
            aria-label="กรองแผนผังตามวิชา"
            value={subjectFilter}
            onChange={(e) => {
              const val = e.target.value as SubjectKey | 'all';
              setSubjectFilter(val);
              if (val !== 'all') {
                const target = subjectsInExam.find((s) => s.meta.key === val);
                if (target) setCur(target.firstIdx);
              }
            }}
            className="w-full rounded-xl border border-line bg-bg2 px-2.5 py-1.5 text-xs font-bold text-ink outline-none focus:border-brand"
          >
            <option value="all">แสดงทุกวิชา ({exam.total} ข้อ)</option>
            {subjectsInExam.map(({ meta, count: subCount, answered: subAns }) => (
              <option key={meta.key} value={meta.key}>
                {meta.shortName} ({subAns}/{subCount})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mt-3 grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-bg2 border border-line text-xs font-bold">
        {(
          [
            ['all', `ทั้งหมด (${exam.total})`],
            ['unanswered', `ยังไม่ตอบ (${exam.total - answeredCount})`],
            ['bookmarked', `คลังทบทวน (${exam.items.filter((q) => bookmarkedIds.includes(q.id)).length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPaletteFilter(key)}
            className={`py-1.5 px-2 rounded-lg transition truncate ${
              paletteFilter === key ? 'bg-panel text-brand shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="mt-4 grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-6 gap-2 max-h-[340px] overflow-y-auto pr-1">
        {filteredIndices.length === 0 ? (
          <p className="col-span-full text-center text-xs text-muted py-6">ไม่มีข้อสอบในตัวกรองนี้</p>
        ) : (
          filteredIndices.map((idx) => {
            const q = exam.items[idx];
            const ans = answers[idx];
            const isCur = idx === cur;
            const isStar = bookmarkedIds.includes(q.id);

            let btnClass = 'bg-bg2 border-line text-muted hover:border-brand/50';
            if (isCur) {
              btnClass = 'bg-brand border-brand text-white ring-2 ring-brand/30';
            } else if (ans !== null) {
              if (revealMode === 'instant' || mode === 'review') {
                btnClass =
                  ans === q.c
                    ? 'bg-teal/15 border-teal text-teal-ink'
                    : 'bg-accent/15 border-accent text-accent';
              } else {
                btnClass = 'bg-brand/15 border-brand/50 text-brand';
              }
            }

            return (
              <button
                key={q.id + '-' + idx}
                type="button"
                onClick={() => {
                  setCur(idx);
                  setShowMobilePalette(false);
                }}
                className={`relative h-9 rounded-xl border font-mono text-xs font-bold transition ${btnClass}`}
              >
                {idx + 1}
                {isStar && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-gold border border-panel" />
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-line flex flex-wrap gap-3 text-[11px] text-muted font-medium">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-brand" /> ข้อปัจจุบัน
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-brand/20 border border-brand/50" /> ตอบแล้ว
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gold" /> คลังทบทวน
        </span>
      </div>

      {mode !== 'review' && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm('ต้องการล้างคำตอบทั้งหมดในชุดนี้เพื่อเริ่มทำใหม่หรือไม่?')) {
              setAnswers(new Array(exam.total).fill(null));
              setEliminated({});
              setUnansweredOnlyMode(false);
              setCombo(0);
              setSessionXp(0);
              setCur(0);
              setShowMobilePalette(false);
            }
          }}
          className="mt-4 w-full py-2 rounded-xl border border-line bg-bg2 text-xs font-bold text-muted hover:text-ink flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>ล้างคำตอบเริ่มทำชุดนี้ใหม่</span>
        </button>
      )}
    </div>
  );

  return (
    <div
      className="min-h-screen bg-bg text-ink flex flex-col"
      onCopy={(e) => {
        if (mode === 'real') {
          e.preventDefault();
          pushToast('โหมดสนามสอบจริงไม่อนุญาตให้คัดลอกข้อความโจทย์');
        }
      }}
      onCut={(e) => {
        if (mode === 'real') {
          e.preventDefault();
        }
      }}
    >
      {/* Top Exam Bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-panel/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={handleExitExam}
              disabled={exiting}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-line bg-bg2 px-2.5 text-xs font-semibold text-ink hover:border-brand/50 hover:text-brand transition shrink-0 disabled:opacity-60"
              title="ออกและบันทึกข้อที่ทำแล้วเพื่อจัดระเบียบชุดใหม่"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{exiting ? 'กำลังบันทึก...' : 'ออก'}</span>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand/10 text-brand shrink-0">
                  {mode === 'review'
                    ? 'ทบทวนเฉลย'
                    : revealMode === 'instant'
                    ? 'เฉลยทีละข้อ'
                    : 'เฉลยหลังส่ง'}
                </span>
                <h1 className="text-sm sm:text-base font-extrabold truncate">{exam.title}</h1>
              </div>
              <p className="text-xs text-muted truncate">
                ข้อที่ {cur + 1} จาก {exam.total} · ตอบแล้ว {answeredCount}/{exam.total} ข้อ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Live Combo & XP HUD */}
            {mode !== 'review' && (sessionXp > 0 || combo >= 2) && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-gold/40 bg-gold/10 text-xs font-extrabold text-gold-ink">
                {combo >= 2 && (
                  <span className="inline-flex items-center gap-1 text-accent">
                    <Flame className="w-3.5 h-3.5" />
                    <span>Combo x{combo}</span>
                  </span>
                )}
                {combo >= 2 && sessionXp > 0 && <span className="text-line">|</span>}
                <span className="inline-flex items-center gap-1 font-mono">
                  <Sparkles className="w-3.5 h-3.5 text-gold-ink" />
                  +{sessionXp} XP
                </span>
              </div>
            )}

            {/* Timer Pill */}
            {mode !== 'review' && (
              <div
                title={timerMode === 'timed' ? 'จับเวลาถอยหลังตามจริง' : 'นับเวลาสะสม (ไม่จำกัดเวลา)'}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border font-mono text-xs sm:text-sm font-bold ${
                  urgentClock
                    ? 'bg-accent/15 border-accent/40 text-accent animate-pulse'
                    : 'bg-bg2 border-line text-ink'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{timerMode === 'timed' ? formatClock(remainingSec) : formatClock(activeSec)}</span>
              </div>
            )}

            {/* Settings Button */}
            {mode !== 'review' && (
              <button
                type="button"
                onClick={openSetupModal}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-line bg-bg2 text-muted hover:text-ink hover:border-brand/50 text-xs font-bold transition"
                title="ตั้งค่าวิธีเฉลยและเวลาสอบ"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden md:inline">ตั้งค่า</span>
              </button>
            )}

            {/* Font Scaler */}
            <div className="hidden lg:flex items-center border border-line rounded-xl bg-bg2 p-0.5">
              {(['sm', 'md', 'lg'] as FontScale[]).map((sz, i) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setFontScale(sz)}
                  className={`px-2 py-1 text-xs font-bold rounded-lg transition ${
                    fontScale === sz ? 'bg-panel text-brand shadow-sm' : 'text-muted hover:text-ink'
                  }`}
                  title={`ขนาดตัวอักษร ${i === 0 ? 'เล็ก' : i === 1 ? 'ปกติ' : 'ใหญ่'}`}
                >
                  {i === 0 ? 'A-' : i === 1 ? 'A' : 'A+'}
                </button>
              ))}
            </div>

            {/* Cut Choice Mode Toggle */}
            <button
              type="button"
              onClick={() => setCutMode((v) => !v)}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition ${
                cutMode
                  ? 'bg-gold/20 border-gold text-gold-ink'
                  : 'border-line bg-bg2 text-muted hover:text-ink'
              }`}
              title="เปิดโหมดขีดฆ่าตัวเลือก (คีย์ลัด E)"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">ตัดช้อยส์</span>
            </button>

            {/* Focus Mode */}
            <button
              type="button"
              onClick={() => setFocusMode((v) => !v)}
              className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition ${
                focusMode ? 'bg-brand/15 border-brand text-brand' : 'border-line bg-bg2 text-muted hover:text-ink'
              }`}
              title="โหมดโฟกัส (คีย์ลัด F)"
            >
              {focusMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden xl:inline">โฟกัส</span>
            </button>

            {/* Shortcuts Help */}
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              className="hidden lg:flex w-9 h-9 rounded-xl border border-line bg-bg2 items-center justify-center text-muted hover:text-ink"
              title="คีย์ลัดการทำข้อสอบ"
            >
              <Keyboard className="w-4 h-4" />
            </button>

            {/* Submit Button */}
            {mode !== 'review' && (
              <button
                type="button"
                onClick={openSubmitConfirmation}
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-xs sm:text-sm font-extrabold shadow-sm transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>ส่งข้อสอบ</span>
              </button>
            )}
          </div>
        </div>
        {/* Subtle progress bar */}
        <div className="h-1 w-full bg-bg2">
          <div
            className="h-full bg-brand transition-all duration-300"
            style={{ width: `${Math.round((answeredCount / Math.max(1, exam.total)) * 100)}%` }}
          />
        </div>
      </header>

      {toast && (
        <div className="fixed bottom-20 lg:bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink text-panel text-xs sm:text-sm font-bold shadow-xl flex items-center gap-2 max-w-[92vw]">
          <ShieldAlert className="w-4 h-4 text-gold shrink-0" />
          <span className="truncate">{toast}</span>
        </div>
      )}

      {/* Subject Filter & Jump Bar for Multi-Subject Sets */}
      {subjectsInExam.length > 1 && (
        <div className="border-b border-line bg-panel/70">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-muted mr-1">
                <Layers className="w-3.5 h-3.5 text-brand" />
                <span>แยกรายวิชา:</span>
              </span>
              <button
                type="button"
                onClick={() => setSubjectFilter('all')}
                className={`px-2.5 py-1 rounded-xl border text-xs font-bold transition ${
                  subjectFilter === 'all'
                    ? 'bg-brand border-brand text-white'
                    : 'bg-bg2 border-line text-muted hover:text-ink'
                }`}
              >
                ทุกวิชา ({exam.total})
              </button>
              {subjectsInExam.map(({ meta, count: subCount, answered: subAns, firstIdx }) => {
                const active = subjectFilter === meta.key;
                return (
                  <button
                    key={meta.key}
                    type="button"
                    onClick={() => {
                      setSubjectFilter(meta.key);
                      setCur(firstIdx);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold transition ${
                      active
                        ? 'bg-brand border-brand text-white'
                        : 'bg-bg2 border-line text-ink hover:border-brand/50'
                    }`}
                  >
                    <SubjectIcon subjectKey={meta.key} size="sm" />
                    <span>{meta.shortName}</span>
                    <span className={`font-mono text-[11px] ${active ? 'text-white/85' : 'text-muted'}`}>
                      {subAns}/{subCount}
                    </span>
                  </button>
                );
              })}
            </div>

            {mode !== 'review' && (
              <Link
                href={
                  subjectFilter !== 'all'
                    ? `/exam/${encodeURIComponent(setId)}?subject=${subjectFilter}&mode=${mode}&fresh=1`
                    : `/exam/subject-${currentQuestion.subject}?set=1&count=20&mode=practice&fresh=1`
                }
                className="inline-flex items-center gap-1 text-xs font-extrabold text-brand hover:underline shrink-0"
              >
                <span>
                  แยกทำเฉพาะวิชา{subjectFilter !== 'all' ? SUBJECT_MAP[subjectFilter]?.shortName : subjMeta?.shortName}
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Main Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-5 pb-24 lg:pb-8 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Question Card Column */}
        <section className={`${focusMode ? 'lg:col-span-12 max-w-4xl mx-auto w-full' : 'lg:col-span-8'} space-y-4`}>
          {unansweredOnlyMode && mode !== 'review' && (
            <div className="rounded-card border border-gold/40 bg-gold/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-gold-ink">
                <Target className="w-4 h-4 shrink-0" />
                {unansweredIndices.length > 0 ? (
                  <span>
                    โหมดเก็บข้อที่ยังไม่ได้ทำ: เหลืออีก {unansweredIndices.length} ข้อ
                  </span>
                ) : (
                  <span>ตอบครบทุกข้อที่ข้ามไว้แล้ว พร้อมส่งข้อสอบได้ทันที</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unansweredIndices.length === 0 ? (
                  <button
                    type="button"
                    onClick={openSubmitConfirmation}
                    className="px-3 py-1.5 rounded-xl bg-brand text-white text-xs font-extrabold"
                  >
                    ส่งข้อสอบเลย
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goNextQuestion}
                    className="px-3 py-1.5 rounded-xl bg-gold/20 border border-gold/40 text-gold-ink text-xs font-extrabold hover:bg-gold/30 transition"
                  >
                    ข้อที่ข้ามถัดไป
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setUnansweredOnlyMode(false);
                    setPaletteFilter('all');
                  }}
                  className="px-3 py-1.5 rounded-xl border border-line bg-panel text-xs font-bold text-muted hover:text-ink transition"
                >
                  ดูข้อสอบทั้งหมด
                </button>
              </div>
            </div>
          )}

          <div className="bg-panel border border-line rounded-card p-5 sm:p-7 shadow-card">
            {/* Subject + Actions Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-line">
              <div className="flex items-center gap-2.5 min-w-0">
                <SubjectIcon subjectKey={currentQuestion.subject} size="sm" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-brand">
                      {subjMeta?.shortName || currentQuestion.subject}
                    </span>
                    <span className="text-xs font-mono text-muted">#{currentQuestion.id}</span>
                  </div>
                  {currentQuestion.title && (
                    <p className="text-xs text-muted truncate max-w-[240px] sm:max-w-md">
                      หัวข้อ: {currentQuestion.title}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleBookmark(currentQuestion.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
                    isBookmarked
                      ? 'bg-gold/20 border-gold text-gold-ink'
                      : 'border-line bg-bg2 text-muted hover:text-ink hover:border-gold/50'
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                  <span>{isBookmarked ? 'อยู่ในคลังทบทวน' : 'ต้องการทบทวน'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowReportModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-bg2 text-muted hover:text-accent hover:border-accent/40 text-xs font-bold transition"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">แจ้งข้อผิดพลาด</span>
                </button>
              </div>
            </div>

            {cutMode && (
              <div className="mt-4 px-3.5 py-2 rounded-xl bg-gold/15 border border-gold/40 text-xs font-semibold text-gold-ink flex items-center justify-between gap-2">
                <span>โหมดตัดช้อยส์เปิดอยู่: คลิกที่ตัวเลือกเพื่อขีดฆ่า/ยกเลิกขีดฆ่า (กด E เพื่อกลับเป็นเลือกตอบ)</span>
                <button type="button" onClick={() => setCutMode(false)} className="underline font-bold shrink-0">
                  ปิดโหมดตัด
                </button>
              </div>
            )}

            {/* Question Stem */}
            <div className="mt-5 font-exam">
              <div className={`font-semibold text-ink ${stemSizeClass}`}>
                <span className="inline-block font-mono text-brand font-extrabold mr-2">
                  ข้อที่ {cur + 1}.
                </span>
                <RichExamContent text={effectiveStemText} className="mt-1.5" />
              </div>

              {effectiveStemImg && (
                <div className="mt-4">
                  <ImageLightbox
                    src={effectiveStemImg}
                    alt={`ภาพประกอบข้อ ${currentQuestion.id}`}
                    className="max-h-72 rounded-2xl border border-line object-contain bg-bg2 p-2"
                  />
                </div>
              )}
            </div>

            {/* Choices */}
            <div className="mt-6 space-y-3 font-exam">
              {currentQuestion.opts.map((optText, idx) => {
                const label = CHOICE_LABELS[idx] || String(idx + 1);
                const selected = userChoice === idx;
                const isCorrectOpt = currentQuestion.c === idx;
                const isEliminated = currentEliminated.includes(idx);
                const optIsRawUrl = isImageUrlString(optText);
                const optImg = currentQuestion.optImgs?.[idx] || (optIsRawUrl ? optText.trim() : null);
                const displayOptText = optIsRawUrl ? '' : optText;

                let cardStyle =
                  'border-line bg-bg2/60 hover:border-brand/50 hover:bg-brand/5 text-ink';
                let badgeStyle = 'bg-panel border-line text-muted';

                if (showInstantFeedback) {
                  if (isCorrectOpt) {
                    cardStyle = 'border-teal bg-teal/10 text-ink';
                    badgeStyle = 'bg-teal border-teal text-white';
                  } else if (selected && !isCorrectOpt) {
                    cardStyle = 'border-accent bg-accent/10 text-ink';
                    badgeStyle = 'bg-accent border-accent text-white';
                  }
                } else if (selected) {
                  cardStyle = 'border-brand bg-brand/10 text-ink ring-2 ring-brand/25';
                  badgeStyle = 'bg-brand border-brand text-white';
                }

                return (
                  <div
                    key={idx}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      toggleEliminate(currentQuestion.id, idx);
                    }}
                    className={`group relative flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer ${cardStyle} ${
                      isEliminated ? 'opacity-45' : ''
                    }`}
                    onClick={() => selectAnswer(idx)}
                  >
                    <span
                      className={`w-8 h-8 rounded-xl border font-bold text-sm flex items-center justify-center shrink-0 mt-0.5 transition ${badgeStyle}`}
                    >
                      {label}
                    </span>
                    <div className="flex-1 min-w-0">
                      {displayOptText && (
                        <div
                          className={`${stemSizeClass} ${
                            isEliminated ? 'line-through decoration-2' : ''
                          }`}
                        >
                          <RichExamContent text={displayOptText} inline={true} />
                        </div>
                      )}
                      {optImg && (
                        <div className={displayOptText ? 'mt-2' : ''}>
                          <ImageLightbox
                            src={optImg}
                            alt={`ภาพตัวเลือก ${label}`}
                            className="max-h-36 rounded-xl border border-line object-contain bg-panel p-1"
                            selectOnImageClick={true}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {showInstantFeedback && isCorrectOpt && (
                        <CheckCircle2 className="w-5 h-5 text-teal-ink" />
                      )}
                      {showInstantFeedback && selected && !isCorrectOpt && (
                        <XCircle className="w-5 h-5 text-accent" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleEliminate(currentQuestion.id, idx);
                        }}
                        title={isEliminated ? 'ยกเลิกตัดช้อยส์' : 'ตัดช้อยส์ข้อนี้'}
                        className={`p-1.5 rounded-lg border transition ${
                          isEliminated
                            ? 'bg-gold/20 border-gold text-gold-ink'
                            : 'border-transparent text-muted opacity-70 hover:opacity-100 hover:bg-panel'
                        }`}
                      >
                        <Scissors className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Instant Explanation (Instant mode & Review) */}
            {showInstantFeedback && (
              <div className="mt-6 p-4 sm:p-5 rounded-2xl border border-teal/35 bg-teal/5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-extrabold text-sm text-teal-ink">
                    <Sparkles className="w-4 h-4" />
                    <span>
                      เฉลยที่ถูกต้อง: ข้อ {CHOICE_LABELS[currentQuestion.c] || currentQuestion.c + 1}
                    </span>
                  </div>
                  {userChoice !== null && (
                    <span
                      className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                        userChoice === currentQuestion.c
                          ? 'bg-teal/20 text-teal-ink'
                          : 'bg-accent/15 text-accent'
                      }`}
                    >
                      {userChoice === currentQuestion.c ? 'ตอบถูกต้อง' : 'ตอบผิด'}
                    </span>
                  )}
                </div>
                {effectiveExpText ? (
                  <RichExamContent
                    text={effectiveExpText}
                    className="text-sm text-ink/90 font-exam leading-relaxed"
                  />
                ) : !effectiveExpImg ? (
                  <p className="text-sm text-ink/90 font-exam leading-relaxed">
                    ข้อนี้เฉลยตามตัวเลือกที่ระบุไว้ในระบบคลังข้อสอบ
                  </p>
                ) : null}
                {effectiveExpImg && (
                  <div className="pt-2">
                    <ImageLightbox
                      src={effectiveExpImg}
                      alt={`ภาพเฉลยข้อ ${currentQuestion.id}`}
                      className="max-h-72 rounded-xl border border-line object-contain bg-panel p-1.5"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Navigation Footer (Desktop/Tablet) */}
            <div className="mt-6 pt-5 border-t border-line hidden sm:flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={!unansweredOnlyMode && cur === 0}
                onClick={goPrevQuestion}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-btn border border-line bg-bg2 font-bold text-sm disabled:opacity-40 hover:border-brand/50 transition"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>ข้อก่อนหน้า</span>
              </button>

              {(!unansweredOnlyMode && cur < exam.total - 1) ||
              (unansweredOnlyMode && unansweredIndices.length > 0) ? (
                <button
                  type="button"
                  onClick={goNextQuestion}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-btn bg-brand hover:bg-brand-dark text-white font-bold text-sm transition"
                >
                  <span>{unansweredOnlyMode ? 'ข้อที่ข้ามถัดไป' : 'ข้อถัดไป'}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : mode !== 'review' ? (
                <button
                  type="button"
                  onClick={openSubmitConfirmation}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-btn bg-teal hover:opacity-90 text-white font-extrabold text-sm transition"
                >
                  <Check className="w-4 h-4" />
                  <span>ตรวจคำตอบและส่งข้อสอบ</span>
                </button>
              ) : (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-btn bg-brand text-white font-bold text-sm"
                >
                  <span>เสร็จสิ้นการทบทวน</span>
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Navigator Palette Column */}
        {!focusMode && (
          <aside className="hidden lg:block lg:col-span-4 space-y-4 lg:sticky lg:top-20">
            {palettePanelContent}
          </aside>
        )}
      </main>

      {/* Sticky Mobile Bottom Action Bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-panel/95 backdrop-blur-xl px-3 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={!unansweredOnlyMode && cur === 0}
            onClick={goPrevQuestion}
            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-line bg-bg2 text-xs font-bold disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>ก่อนหน้า</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMobilePalette(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-line bg-bg2 text-xs font-extrabold text-ink"
          >
            <Grid2X2 className="w-4 h-4 text-brand" />
            <span className="font-mono">
              {cur + 1}/{exam.total}
            </span>
          </button>

          {mode !== 'review' && (
            <button
              type="button"
              onClick={openSetupModal}
              aria-label="ตั้งค่าข้อสอบ"
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl border border-line bg-bg2 text-muted hover:text-ink shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          )}

          {(!unansweredOnlyMode && cur < exam.total - 1) ||
          (unansweredOnlyMode && unansweredIndices.length > 0) ? (
            <button
              type="button"
              onClick={goNextQuestion}
              className="inline-flex items-center justify-center gap-1 px-4 py-2 rounded-xl bg-brand text-white text-xs font-extrabold"
            >
              <span>{unansweredOnlyMode ? 'ข้ามถัดไป' : 'ข้อถัดไป'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : mode !== 'review' ? (
            <button
              type="button"
              onClick={openSubmitConfirmation}
              className="inline-flex items-center justify-center gap-1 px-4 py-2 rounded-xl bg-teal text-white text-xs font-extrabold"
            >
              <Check className="w-4 h-4" />
              <span>ส่งข้อสอบ</span>
            </button>
          ) : (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-1 px-4 py-2 rounded-xl bg-brand text-white text-xs font-extrabold"
            >
              <span>เสร็จสิ้น</span>
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Palette Slide-up Drawer */}
      {showMobilePalette && !focusMode && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setShowMobilePalette(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl bg-panel border-t border-line p-4 pb-6 shadow-2xl max-h-[82vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-extrabold">เลือกข้อสอบและตัวกรอง</span>
              <button
                type="button"
                aria-label="ปิดแผนผังข้อสอบ"
                onClick={() => setShowMobilePalette(false)}
                className="p-1.5 rounded-xl border border-line bg-bg2 text-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-bg2/60 p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted px-1">ขนาดตัวอักษร:</span>
                <div className="flex items-center border border-line rounded-xl bg-panel p-0.5">
                  {(['sm', 'md', 'lg'] as FontScale[]).map((sz, i) => (
                    <button
                      key={sz}
                      type="button"
                      aria-label={`ขนาดตัวอักษรมือถือ ${i === 0 ? 'เล็ก' : i === 1 ? 'ปกติ' : 'ใหญ่'}`}
                      onClick={() => setFontScale(sz)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                        fontScale === sz ? 'bg-brand text-white shadow-sm' : 'text-muted hover:text-ink'
                      }`}
                    >
                      {i === 0 ? 'A-' : i === 1 ? 'A' : 'A+'}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCutMode((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition ${
                  cutMode
                    ? 'bg-gold/20 border-gold text-gold-ink'
                    : 'border-line bg-panel text-muted hover:text-ink'
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>{cutMode ? 'ปิดโหมดตัดช้อยส์' : 'ตัดช้อยส์'}</span>
              </button>
            </div>
            {palettePanelContent}
          </div>
        </div>
      )}

      {/* Pre-Exam / Mid-Exam Setup Modal */}
      {showSetupModal && mode !== 'review' && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-panel border border-line rounded-card max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-ink">ตั้งค่ารูปแบบการทำข้อสอบ</h3>
                  <p className="text-xs text-muted mt-0.5">
                    เลือกวิธีเฉลยคำตอบและการจับเวลาได้ตามต้องการ ({exam.total} ข้อ)
                  </p>
                </div>
              </div>
              {setupConfigured && (
                <button
                  type="button"
                  onClick={() => setShowSetupModal(false)}
                  className="p-1.5 rounded-xl text-muted hover:text-ink"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
                1. รูปแบบการเฉลยคำตอบ
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => setDraftReveal('instant')}
                  className={`text-left p-4 rounded-2xl border transition ${
                    draftReveal === 'instant'
                      ? 'border-brand bg-brand/10 ring-2 ring-brand/20'
                      : 'border-line bg-bg2 hover:border-brand/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-sm text-ink inline-flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-brand" />
                      <span>เฉลยข้อต่อข้อทันที</span>
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        draftReveal === 'instant' ? 'bg-brand text-white' : 'bg-panel text-muted'
                      }`}
                    >
                      แนะนำสำหรับฝึกจำ
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1.5 leading-relaxed">
                    คลิกตอบแล้วแสดงเฉลยพร้อมคำอธิบายและภาพประกอบทันที พร้อมสะสม Combo และ +XP
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setDraftReveal('end')}
                  className={`text-left p-4 rounded-2xl border transition ${
                    draftReveal === 'end'
                      ? 'border-teal bg-teal/10 ring-2 ring-teal/20'
                      : 'border-line bg-bg2 hover:border-teal/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-sm text-ink inline-flex items-center gap-2">
                      <Target className="w-4 h-4 text-teal-ink" />
                      <span>เฉลยย้อนหลังเมื่อส่งข้อสอบ + วิเคราะห์จุดอ่อน</span>
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        draftReveal === 'end' ? 'bg-teal text-white' : 'bg-panel text-muted'
                      }`}
                    >
                      วัดผลสมจริง
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1.5 leading-relaxed">
                    ซ่อนเฉลยทั้งหมดระหว่างทำข้อสอบ เพื่อวัดความแม่นยำจริงและวิเคราะห์ว่าไม่ถนัดวิชาหรือหัวข้อใด
                  </p>
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
                2. การจับเวลาสอบ
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setDraftTimer('timed')}
                  className={`text-left p-3.5 rounded-2xl border transition ${
                    draftTimer === 'timed'
                      ? 'border-brand bg-brand/10 ring-2 ring-brand/20'
                      : 'border-line bg-bg2 hover:border-brand/40'
                  }`}
                >
                  <div className="flex items-center gap-2 font-extrabold text-sm text-ink">
                    <Timer className="w-4 h-4 text-brand" />
                    <span>จับเวลาจริง</span>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    นับถอยหลัง {Math.max(1, Math.round(exam.durationSec / 60))} นาที
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setDraftTimer('elapsed')}
                  className={`text-left p-3.5 rounded-2xl border transition ${
                    draftTimer === 'elapsed'
                      ? 'border-brand bg-brand/10 ring-2 ring-brand/20'
                      : 'border-line bg-bg2 hover:border-brand/40'
                  }`}
                >
                  <div className="flex items-center gap-2 font-extrabold text-sm text-ink">
                    <Clock className="w-4 h-4 text-teal-ink" />
                    <span>ไม่จำกัดเวลา</span>
                  </div>
                  <p className="text-xs text-muted mt-1">นับเวลาทำสะสมแบบไม่กดดัน</p>
                </button>
              </div>
            </div>

            {!isCompletedReviewSet && (
              <div className="space-y-2.5">
                <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
                  3. การคัดกรองข้อสอบที่เคยทำแล้ว
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDraftExcludeCompleted(true)}
                    className={`text-left p-3.5 rounded-2xl border transition ${
                      draftExcludeCompleted
                        ? 'border-brand bg-brand/10 ring-2 ring-brand/20'
                        : 'border-line bg-bg2 hover:border-brand/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-extrabold text-sm text-ink">
                      <Sparkles className="w-4 h-4 text-brand" />
                      <span>ไม่นำข้อที่เคยทำมาขึ้นซ้ำ</span>
                    </div>
                    <p className="text-xs text-muted mt-1">คัดเฉพาะข้อใหม่ที่ยังไม่เคยตอบมาก่อน</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDraftExcludeCompleted(false)}
                    className={`text-left p-3.5 rounded-2xl border transition ${
                      !draftExcludeCompleted
                        ? 'border-brand bg-brand/10 ring-2 ring-brand/20'
                        : 'border-line bg-bg2 hover:border-brand/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-extrabold text-sm text-ink">
                      <Layers className="w-4 h-4 text-teal-ink" />
                      <span>ใช้ข้อสอบรวมตามเดิม</span>
                    </div>
                    <p className="text-xs text-muted mt-1">แสดงครบทุกข้อรวมข้อที่เคยทำแล้ว</p>
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-1">
              {setupConfigured && (
                <button
                  type="button"
                  onClick={() => setShowSetupModal(false)}
                  className="px-4 py-2.5 rounded-btn border border-line font-bold text-sm"
                >
                  ยกเลิก
                </button>
              )}
              <button
                type="button"
                onClick={() => void applySetupAndStart(draftReveal, draftTimer, draftExcludeCompleted)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-btn bg-brand hover:bg-brand-dark text-white font-extrabold text-sm shadow-sm transition"
              >
                {setupConfigured ? 'บันทึกการตั้งค่า' : 'เริ่มทำข้อสอบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-panel border border-line rounded-card max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="w-11 h-11 rounded-2xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                <HelpCircle className="w-6 h-6" />
              </div>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="p-1.5 rounded-xl text-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <h3 className="text-lg font-extrabold">แน่ใจแล้วใช่ไหมที่จะส่งข้อสอบ?</h3>
              <p className="text-sm text-muted mt-1">
                คุณทำข้อสอบไปแล้ว{' '}
                <span className="font-bold text-ink">
                  {answeredCount} / {exam.total} ข้อ
                </span>
                {unansweredIndices.length > 0 && (
                  <span className="text-accent font-semibold">
                    {' '}
                    (ยังไม่ได้ทำ {unansweredIndices.length} ข้อ)
                  </span>
                )}
              </p>

              {unansweredIndices.length > 0 && (
                <div className="mt-3 p-3 rounded-2xl border border-accent/30 bg-accent/5 space-y-2">
                  <p className="text-xs font-bold text-accent">
                    ระบบพาข้ามมาที่ข้อที่ยังไม่ได้ทำแล้ว คลิกเลขข้อหรือปุ่มด้านล่างเพื่อย้อนทำได้:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {unansweredIndices.slice(0, 12).map((uIdx) => (
                      <button
                        key={uIdx}
                        type="button"
                        onClick={() => {
                          setCur(uIdx);
                          setShowSubmitModal(false);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-accent/40 bg-panel text-xs font-mono font-bold text-accent hover:bg-accent hover:text-white transition"
                      >
                        ข้อ {uIdx + 1}
                      </button>
                    ))}
                    {unansweredIndices.length > 12 && (
                      <span className="px-2 py-1 text-xs font-bold text-muted">
                        +{unansweredIndices.length - 12} ข้อ
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              {unansweredIndices.length > 0 && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setUnansweredOnlyMode(true);
                    setPaletteFilter('unanswered');
                    setCur(unansweredIndices[0]);
                    setShowSubmitModal(false);
                  }}
                  className="w-full px-4 py-2.5 rounded-btn border border-gold/50 bg-gold/15 text-gold-ink font-extrabold text-sm hover:bg-gold/25 transition"
                >
                  ย้อนทำเฉพาะข้อที่ยังไม่ได้ทำ ({unansweredIndices.length} ข้อ)
                </button>
              )}
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setUnansweredOnlyMode(false);
                  setPaletteFilter('all');
                  setShowSubmitModal(false);
                }}
                className="w-full px-4 py-2.5 rounded-btn border border-line bg-bg2 font-bold text-sm hover:border-brand/50 transition"
              >
                ย้อนดูข้อสอบทั้งหมด ({exam.total} ข้อ)
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmit()}
                className="w-full px-5 py-2.5 rounded-btn bg-brand hover:bg-brand-dark text-white font-extrabold text-sm flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{submitting ? 'กำลังตรวจคะแนน...' : 'ยืนยันส่งข้อสอบทันที'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Question Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSendReport}
            className="bg-panel border border-line rounded-card max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <Flag className="w-4 h-4 text-accent" />
                <span>แจ้งข้อผิดพลาดข้อ #{currentQuestion.id}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-xl text-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted block">ประเภทปัญหาที่พบ</label>
              <div className="space-y-2">
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                      reportReason === r ? 'border-brand bg-brand/5 text-brand' : 'border-line bg-bg2'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      checked={reportReason === r}
                      onChange={() => setReportReason(r)}
                      className="accent-brand"
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted block mb-1.5">
                รายละเอียดเพิ่มเติม (ไม่บังคับ)
              </label>
              <textarea
                rows={3}
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                placeholder="เช่น ควรเฉลยข้อ ข เพราะตาม พ.ร.บ. ฉบับแก้ไข..."
                className="w-full rounded-xl border border-line bg-bg2 px-3 py-2 text-sm focus:outline-none focus:border-brand"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 rounded-btn border border-line text-sm font-bold"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={reportSending}
                className="px-4 py-2 rounded-btn bg-accent text-white text-sm font-extrabold flex items-center gap-1.5"
              >
                {reportSending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>ส่งรายงาน</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Shortcuts Help Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-panel border border-line rounded-card max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-brand" />
                <span>คีย์ลัดระหว่างทำข้อสอบ</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                className="p-1.5 rounded-xl text-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-sm">
              {[
                ['1 – 4', 'เลือกตอบ ก, ข, ค, ง'],
                ['← / →', 'เลื่อนข้อก่อนหน้า / ถัดไป'],
                ['E', 'สลับโหมดตัดช้อยส์ (หรือคลิกขวาที่ตัวเลือก)'],
                ['B', 'ติดดาว / ยกเลิกติดดาวข้อนี้'],
                ['F', 'เปิด / ปิด โหมดโฟกัส'],
              ].map(([k, desc]) => (
                <div key={k} className="flex items-center justify-between gap-3 py-1 border-b border-line/60">
                  <span className="text-muted text-xs">{desc}</span>
                  <kbd className="px-2 py-0.5 rounded-lg bg-bg2 border border-line font-mono text-xs font-bold">
                    {k}
                  </kbd>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <Eye className="w-4 h-4 shrink-0" />
              <span>ระบบบันทึกคำตอบอัตโนมัติทุกการเลือกและทุก 15 วินาที</span>
            </div>
          </div>
        </div>
      )}

      {/* Smart Exit Modal for Exam Mode (revealMode === 'end') */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-card border border-line bg-panel p-5 shadow-card space-y-4">
            <div>
              <h3 className="text-base font-bold text-ink">
                ออกจากหน้าสอบ ({answeredCount}/{exam.total} ข้อที่เลือกไว้)
              </h3>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                คุณอยู่ในโหมดเฉลยหลังส่ง เลือกวิธีจัดการคำตอบที่เลือกค้างไว้ก่อนออก:
              </p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                disabled={exiting}
                onClick={() => void performExit(false)}
                className="w-full rounded-xl border border-line bg-bg2 px-4 py-3 text-left transition-colors hover:border-brand/50"
              >
                <div className="text-xs font-bold text-ink">
                  พักไว้ทำต่อภายหลัง (ยังไม่ตัดข้อเข้าประวัติ)
                </div>
                <div className="mt-0.5 text-[11px] text-muted">
                  บันทึกคำตอบค้างไว้กลับมาทำต่อได้ โดยยังไม่ตรวจถูก/ผิดตอนนี้
                </div>
              </button>
              <button
                type="button"
                disabled={exiting}
                onClick={() => void performExit(true)}
                className="w-full rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 text-left transition-colors hover:bg-brand/15"
              >
                <div className="text-xs font-bold text-brand">
                  บันทึกข้อที่ตอบแล้ว ({answeredCount} ข้อ) และจัดระเบียบชุดใหม่ทันที
                </div>
                <div className="mt-0.5 text-[11px] text-muted">
                  นับผลถูก/ผิดของข้อที่ตอบไปแล้วและอัปเดตชุดข้อสอบทันที
                </div>
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink"
              >
                กลับไปทำต่อ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ExamRunnerClient() {
  return (
    <Suspense
      fallback={
        <AppLoadingScreen
          variant="exam"
          includeHeader={false}
          title="กำลังจัดเตรียมชุดข้อสอบและกระดาษคำตอบ..."
          subtitle="ตรวจสอบประวัติข้อที่เคยทำและกู้คืนความคืบหน้าล่าสุด"
        />
      }
    >
      <ExamRunnerInner />
    </Suspense>
  );
}

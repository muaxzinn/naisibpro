import { NextRequest, NextResponse } from 'next/server';
import {
  applyQuestionOutcomes,
  applyRealExamOutcomes,
  findQuestionById,
  readRuntimeState,
  writeRuntimeState,
  type AttemptGroupStat,
  type AttemptRecord,
  type AttemptSubjectStat,
  type AttemptTopicStat,
  type QuestionOutcome,
} from '@/lib/server-db';
import { SUBJECT_MAP, type SubjectKey } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET() {
  const runtime = readRuntimeState();
  return NextResponse.json({ attempts: runtime.attempts });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const questionIds: number[] = Array.isArray(body.questionIds) ? body.questionIds.map(Number) : [];
  const answers: (number | null)[] = Array.isArray(body.answers) ? body.answers : [];
  const bookmarkedIds: number[] = Array.isArray(body.bookmarkedIds) ? body.bookmarkedIds.map(Number) : [];
  const setId = String(body.setId || 'custom');
  const setTitle = String(body.setTitle || `ชุดข้อสอบ #${setId}`);
  const mode = body.mode === 'practice' ? 'practice' : 'real';
  const passRule = body.passRule === 'overall' ? 'overall' : 'groups';
  const durationSec = Math.max(1, Number(body.durationSec || 0));
  const startedAt = String(body.startedAt || new Date().toISOString());

  if (!questionIds.length) {
    return NextResponse.json({ error: 'ไม่มีรายการข้อสอบที่จะตรวจ' }, { status: 400 });
  }

  const subjectMap = new Map<SubjectKey, { correct: number; total: number }>();
  const topicMap = new Map<string, { title: string; subjectKey: SubjectKey; correct: number; total: number }>();
  const wrongIndices: number[] = [];
  const outcomes: QuestionOutcome[] = [];
  let score = 0;

  questionIds.forEach((qid, idx) => {
    const q = findQuestionById(qid);
    if (!q) return;
    const picked = answers[idx] ?? null;
    const isCorrect = picked !== null && picked === q.correct_index;

    const sStat = subjectMap.get(q.subject_key) || { correct: 0, total: 0 };
    sStat.total++;
    if (isCorrect) {
      score++;
      sStat.correct++;
    } else {
      wrongIndices.push(idx);
    }
    if (picked !== null && picked !== undefined) {
      outcomes.push({ id: qid, correct: isCorrect });
    }
    subjectMap.set(q.subject_key, sStat);

    if (q.title) {
      const tKey = `${q.subject_key}::${q.title}`;
      const tStat = topicMap.get(tKey) || { title: q.title, subjectKey: q.subject_key, correct: 0, total: 0 };
      tStat.total++;
      if (isCorrect) tStat.correct++;
      topicMap.set(tKey, tStat);
    }
  });

  const total = questionIds.length;
  const pct = total ? Math.round((score / total) * 100) : 0;

  const perSubject: AttemptSubjectStat[] = Array.from(subjectMap.entries()).map(([key, v]) => ({
    key,
    correct: v.correct,
    total: v.total,
    pct: v.total ? Math.round((v.correct / v.total) * 100) : 0,
  }));

  const groups: AttemptGroupStat[] =
    passRule === 'overall'
      ? []
      : (['general', 'specific'] as const).flatMap((grp) => {
          const matched = perSubject.filter((s) => SUBJECT_MAP[s.key]?.grp === grp);
          const gTotal = matched.reduce((a, b) => a + b.total, 0);
          if (!gTotal) return [];
          const gCorrect = matched.reduce((a, b) => a + b.correct, 0);
          const gPct = Math.round((gCorrect / gTotal) * 100);
          return [
            {
              grp,
              label: grp === 'general' ? 'ภาคความรู้ความสามารถทั่วไป' : 'ภาคความรู้เฉพาะตำแหน่ง',
              correct: gCorrect,
              total: gTotal,
              pct: gPct,
              pass: gPct >= 60,
            },
          ];
        });

  const passed = pct >= 60 && groups.every((g) => g.pass);

  const perTopic: AttemptTopicStat[] = Array.from(topicMap.values())
    .map((t) => ({
      ...t,
      pct: t.total ? Math.round((t.correct / t.total) * 100) : 0,
    }))
    .sort((a, b) => a.pct - b.pct);

  const runtime = readRuntimeState();
  const nextId = (runtime.attempts[0]?.id || 1000) + 1;
  const submittedAt = new Date().toISOString();

  const attempt: AttemptRecord = {
    id: nextId,
    setId,
    setTitle,
    mode,
    startedAt,
    submittedAt,
    durationSec,
    score,
    total,
    pct,
    passed,
    perSubject,
    groups,
    perTopic,
    wrongIndices,
    questionIds,
    answers,
    bookmarkedIds,
  };

  runtime.attempts = [attempt, ...runtime.attempts];
  runtime.examProgress = null;

  // Isolated Real-Exam Pool vs Global Question History
  if (setId.startsWith('real-')) {
    applyRealExamOutcomes(runtime.profile, outcomes);
  } else {
    applyQuestionOutcomes(runtime.profile, outcomes);
  }

  // Persist any newly bookmarked questions
  if (bookmarkedIds.length > 0) {
    const bSet = new Set(runtime.profile.bookmarks || []);
    for (const bid of bookmarkedIds) bSet.add(bid);
    runtime.profile.bookmarks = Array.from(bSet);
  }

  // Update daily streak
  const todayStr = submittedAt.slice(0, 10);
  if (runtime.profile.lastActiveDate !== todayStr) {
    runtime.profile.streakDays = (runtime.profile.streakDays || 0) + 1;
    runtime.profile.lastActiveDate = todayStr;
  }

  writeRuntimeState(runtime);

  return NextResponse.json({ ok: true, id: attempt.id, attempt }, { status: 201 });
}


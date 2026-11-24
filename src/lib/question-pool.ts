import {
  HIDDEN_SUBJECT_KEYS,
  normalizeTopicTitleKey,
  resolveTopicSelection,
  SUBJECT_MAP,
  SUBJECTS,
  TRACKS,
  type SubjectKey,
} from './constants';
import { getRealExamSetById, REAL_EXAM_ALL_IDS, REAL_EXAM_ID_SET } from './real-exam-sets';

export const OFFICIAL_EXAM_SUBJECT_ORDER: readonly SubjectKey[] = [
  'math',
  'thai',
  'com',
  'doc',
  'law',
  'eng',
];

export type MaxQuestionsPerTopic = 2 | 3;

export interface ExamUserSettings {
  viewMode: 'repack' | 'fixed';
  packMode: 'fill' | 'strict';
  maxPerTopic: MaxQuestionsPerTopic;
  selectedTrack: string;
  workspaceMode: 'practice' | 'real-exam';
  revealMode: 'instant' | 'end';
  timerMode: 'timed' | 'elapsed';
  updatedAt?: string;
}

export const DEFAULT_EXAM_SETTINGS: ExamUserSettings = {
  viewMode: 'repack',
  packMode: 'fill',
  maxPerTopic: 3,
  selectedTrack: TRACKS[0].name,
  workspaceMode: 'practice',
  revealMode: 'instant',
  timerMode: 'timed',
};

export function sanitizeExamSettings(
  raw?: Partial<ExamUserSettings> | null,
  fallback: ExamUserSettings = DEFAULT_EXAM_SETTINGS
): ExamUserSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...fallback };
  }
  const validTrack =
    typeof raw.selectedTrack === 'string' && TRACKS.some((t) => t.name === raw.selectedTrack)
      ? raw.selectedTrack
      : fallback.selectedTrack;
  return {
    viewMode: raw.viewMode === 'fixed' ? 'fixed' : raw.viewMode === 'repack' ? 'repack' : fallback.viewMode,
    packMode: raw.packMode === 'strict' ? 'strict' : raw.packMode === 'fill' ? 'fill' : fallback.packMode,
    maxPerTopic: raw.maxPerTopic === 2 ? 2 : raw.maxPerTopic === 3 ? 3 : fallback.maxPerTopic,
    selectedTrack: validTrack,
    workspaceMode:
      raw.workspaceMode === 'real-exam'
        ? 'real-exam'
        : raw.workspaceMode === 'practice'
          ? 'practice'
          : fallback.workspaceMode,
    revealMode:
      raw.revealMode === 'end' ? 'end' : raw.revealMode === 'instant' ? 'instant' : fallback.revealMode,
    timerMode:
      raw.timerMode === 'elapsed'
        ? 'elapsed'
        : raw.timerMode === 'timed'
          ? 'timed'
          : fallback.timerMode,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : fallback.updatedAt,
  };
}

export interface QuestionRecord {
  id: number;
  subject_key: SubjectKey;
  set_id: number | null;
  title: string | null;
  batch: string | null;
  stem: string | null;
  img: string | null;
  opts: string[];
  opt_imgs: (string | null)[] | null;
  correct_index: number;
  correct_label: string;
  explanation: string | null;
  explanation_img: string | null;
}

export interface RunnerQuestion {
  id: number;
  subject: SubjectKey;
  title: string | null;
  b: string;
  img: string | null;
  opts: string[];
  optImgs: (string | null)[] | null;
  c: number;
  e: string | null;
  eImg: string | null;
}

export type CompletedPoolMode = 'all' | 'correct' | 'wrong';

export interface QuestionOutcome {
  id: number;
  correct: boolean;
}

export interface ResetCompletedFilter {
  scope?: 'all' | 'subject' | 'topic';
  subject?: SubjectKey;
  topic?: string;
  pool?: CompletedPoolMode;
  target?: 'practice' | 'real-exam';
}

export interface PoolQuestionMeta {
  id: number;
  subject_key: SubjectKey;
  title: string | null;
}

export interface ProfileHistoryFields {
  correctIds?: number[];
  mistakeIds?: number[];
  realExamCorrectIds?: number[];
  realExamMistakeIds?: number[];
  excludeCompleted?: boolean;
  examSettings?: ExamUserSettings;
}

export function getRealExamStatusSets(profile: ProfileHistoryFields): {
  realCorrectSet: Set<number>;
  realMistakeSet: Set<number>;
  realAttemptedSet: Set<number>;
} {
  const realMistakeSet = new Set<number>();
  for (const id of profile.realExamMistakeIds || []) {
    const n = Number(id);
    if (Number.isFinite(n) && REAL_EXAM_ID_SET.has(n)) realMistakeSet.add(n);
  }
  const realCorrectSet = new Set<number>();
  for (const id of profile.realExamCorrectIds || []) {
    const n = Number(id);
    if (Number.isFinite(n) && REAL_EXAM_ID_SET.has(n) && !realMistakeSet.has(n)) {
      realCorrectSet.add(n);
    }
  }
  const realAttemptedSet = new Set<number>([...realCorrectSet, ...realMistakeSet]);
  return { realCorrectSet, realMistakeSet, realAttemptedSet };
}

export function applyRealExamOutcomes(
  profile: ProfileHistoryFields,
  outcomes: QuestionOutcome[]
): void {
  const { realCorrectSet, realMistakeSet } = getRealExamStatusSets(profile);
  for (const item of outcomes) {
    const id = Number(item.id);
    if (!Number.isFinite(id) || !REAL_EXAM_ID_SET.has(id)) continue;
    if (item.correct) {
      realCorrectSet.add(id);
      realMistakeSet.delete(id);
    } else {
      realMistakeSet.add(id);
      realCorrectSet.delete(id);
    }
  }
  profile.realExamCorrectIds = Array.from(realCorrectSet);
  profile.realExamMistakeIds = Array.from(realMistakeSet);
}

export function resetRealExamHistory(profile: ProfileHistoryFields): void {
  profile.realExamCorrectIds = [];
  profile.realExamMistakeIds = [];
}

export function computeSubjectBreakdown(
  questionIds: number[],
  lookup: (id: number) => Pick<QuestionRecord, 'subject_key'> | undefined
): Partial<Record<SubjectKey, number>> {
  const breakdown: Partial<Record<SubjectKey, number>> = {};
  for (const id of questionIds) {
    const q = lookup(id);
    if (!q) continue;
    breakdown[q.subject_key] = (breakdown[q.subject_key] || 0) + 1;
  }
  return breakdown;
}

export function toRunnerQuestion(q: QuestionRecord): RunnerQuestion {
  return {
    id: q.id,
    subject: q.subject_key,
    title: q.title,
    b: q.stem || '',
    img: q.img,
    opts: q.opts,
    optImgs: q.opt_imgs,
    c: q.correct_index,
    e: q.explanation,
    eImg: q.explanation_img,
  };
}

export function shufflePool<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getCompletedIdSets(profile: ProfileHistoryFields): {
  correctSet: Set<number>;
  mistakeSet: Set<number>;
  allCompletedSet: Set<number>;
} {
  const mistakeSet = new Set<number>();
  for (const raw of profile.mistakeIds || []) {
    const id = Number(raw);
    if (Number.isFinite(id) && id > 0) mistakeSet.add(id);
  }

  const correctSet = new Set<number>();
  for (const raw of profile.correctIds || []) {
    const id = Number(raw);
    if (Number.isFinite(id) && id > 0 && !mistakeSet.has(id)) {
      correctSet.add(id);
    }
  }

  const allCompletedSet = new Set<number>([...correctSet, ...mistakeSet]);
  return { correctSet, mistakeSet, allCompletedSet };
}

export function applyQuestionOutcomes(
  profile: ProfileHistoryFields,
  outcomes: QuestionOutcome[]
): void {
  const { correctSet, mistakeSet } = getCompletedIdSets(profile);
  for (const entry of outcomes) {
    const qid = Number(entry?.id);
    if (!Number.isFinite(qid) || qid <= 0) continue;
    if (entry.correct) {
      correctSet.add(qid);
      mistakeSet.delete(qid);
    } else {
      mistakeSet.add(qid);
      correctSet.delete(qid);
    }
  }
  profile.correctIds = Array.from(correctSet);
  profile.mistakeIds = Array.from(mistakeSet);
}

export function backfillProfileHistoryFromAttempts(
  profile: ProfileHistoryFields,
  attempts: Array<{ questionIds?: number[]; answers?: (number | null)[] }>,
  lookupCorrectIndex: (qid: number) => number | null | undefined
): void {
  const { correctSet, mistakeSet } = getCompletedIdSets(profile);
  const chronological = [...attempts].reverse();
  for (const att of chronological) {
    const qIds = Array.isArray(att.questionIds) ? att.questionIds : [];
    const ansList = Array.isArray(att.answers) ? att.answers : [];
    for (let i = 0; i < qIds.length; i++) {
      const qid = Number(qIds[i]);
      const picked = ansList[i];
      if (!Number.isFinite(qid) || picked === null || picked === undefined) continue;
      const correctIdx = lookupCorrectIndex(qid);
      if (correctIdx === null || correctIdx === undefined) continue;
      if (picked === correctIdx) {
        correctSet.add(qid);
        mistakeSet.delete(qid);
      } else {
        mistakeSet.add(qid);
        correctSet.delete(qid);
      }
    }
  }
  profile.correctIds = Array.from(correctSet);
  profile.mistakeIds = Array.from(mistakeSet);
}

export function resetCompletedHistory(
  profile: ProfileHistoryFields,
  filter: ResetCompletedFilter | undefined,
  allQuestions: PoolQuestionMeta[]
): void {
  const isRealTarget = filter?.target === 'real-exam';
  const pool: CompletedPoolMode =
    filter?.pool === 'correct' || filter?.pool === 'wrong' ? filter.pool : 'all';
  const scopeAll = filter?.scope === 'all' || (!filter?.subject && !filter?.topic);

  if (isRealTarget) {
    if (scopeAll) {
      if (pool === 'all' || pool === 'correct') {
        profile.realExamCorrectIds = [];
      }
      if (pool === 'all' || pool === 'wrong') {
        profile.realExamMistakeIds = [];
      }
      return;
    }

    const hasSubject = Boolean(filter?.subject);
    const hasTopic = filter?.scope === 'topic' || Boolean(filter?.topic);
    const topicMatcher = hasTopic && filter?.topic ? resolveTopicSelection(filter.topic) : null;

    const targetIds = new Set<number>();
    for (const q of allQuestions) {
      if (!REAL_EXAM_ID_SET.has(q.id)) continue;
      if (hasSubject && q.subject_key !== filter?.subject) continue;
      if (topicMatcher && !topicMatcher.matches(q.title)) continue;
      targetIds.add(q.id);
    }

    const { realCorrectSet, realMistakeSet } = getRealExamStatusSets(profile);
    if (pool === 'all' || pool === 'correct') {
      for (const id of targetIds) realCorrectSet.delete(id);
    }
    if (pool === 'all' || pool === 'wrong') {
      for (const id of targetIds) realMistakeSet.delete(id);
    }
    profile.realExamCorrectIds = Array.from(realCorrectSet);
    profile.realExamMistakeIds = Array.from(realMistakeSet);
    return;
  }

  if (scopeAll) {
    if (pool === 'all' || pool === 'correct') {
      profile.correctIds = [];
    }
    if (pool === 'all' || pool === 'wrong') {
      profile.mistakeIds = [];
    }
    return;
  }

  const hasSubject = Boolean(filter?.subject);
  const hasTopic = filter?.scope === 'topic' || Boolean(filter?.topic);
  const topicMatcher = hasTopic && filter?.topic ? resolveTopicSelection(filter.topic) : null;

  const targetIds = new Set<number>();
  for (const q of allQuestions) {
    if (hasSubject && q.subject_key !== filter?.subject) continue;
    if (topicMatcher && !topicMatcher.matches(q.title)) continue;
    targetIds.add(q.id);
  }

  const { correctSet, mistakeSet } = getCompletedIdSets(profile);
  if (pool === 'all' || pool === 'correct') {
    for (const id of targetIds) correctSet.delete(id);
  }
  if (pool === 'all' || pool === 'wrong') {
    for (const id of targetIds) mistakeSet.delete(id);
  }
  profile.correctIds = Array.from(correctSet);
  profile.mistakeIds = Array.from(mistakeSet);
}

function withSubjectFilter(
  picked: QuestionRecord[],
  baseTitle: string,
  durationMin: number,
  passRule: 'groups' | 'overall',
  subjectFilter?: string
): { title: string; durationSec: number; passRule: 'groups' | 'overall'; items: RunnerQuestion[] } {
  const validSubject =
    subjectFilter && Object.prototype.hasOwnProperty.call(SUBJECT_MAP, subjectFilter)
      ? (subjectFilter as SubjectKey)
      : null;

  if (validSubject) {
    const filtered = picked.filter((q) => q.subject_key === validSubject);
    const meta = SUBJECT_MAP[validSubject];
    return {
      title: `${baseTitle} · เฉพาะวิชา${meta.name} (${filtered.length} ข้อ)`,
      durationSec: Math.max(5, filtered.length) * 60,
      passRule: 'overall',
      items: filtered.map(toRunnerQuestion),
    };
  }

  return {
    title: baseTitle,
    durationSec: durationMin * 60,
    passRule,
    items: picked.map(toRunnerQuestion),
  };
}

export type DynamicPackMode = 'fill' | 'strict';

export interface DynamicFormPack {
  setIndex: number; // 1..N for full sets, 0 for remainder
  ids: number[];
  total: number;
  subjectBreakdown: Partial<Record<SubjectKey, number>>;
  isTrackExact: boolean;
  isRemainder: boolean;
}

export interface DynamicFormPackResult {
  fullSets: DynamicFormPack[];
  remainderSet: DynamicFormPack | null;
  completedCount: number;
  remainingCount: number;
  trackName: string;
  maxPerTopic: MaxQuestionsPerTopic;
}

function interleaveByTopicOrder<T extends { tk: string }>(items: T[]): T[] {
  if (items.length <= 2) return items;
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const g = groups.get(it.tk);
    if (g) g.push(it);
    else groups.set(it.tk, [it]);
  }
  const out: T[] = [];
  let lastTk = '';
  while (out.length < items.length) {
    const cands = Array.from(groups.entries()).filter(([, arr]) => arr.length > 0);
    if (cands.length === 0) break;
    cands.sort((a, b) => {
      const aSame = a[0] === lastTk && cands.length > 1 ? 1 : 0;
      const bSame = b[0] === lastTk && cands.length > 1 ? 1 : 0;
      if (aSame !== bSame) return aSame - bSame;
      if (b[1].length !== a[1].length) return b[1].length - a[1].length;
      return a[0].localeCompare(b[0]);
    });
    const [tk, arr] = cands[0];
    out.push(arr.shift()!);
    lastTk = tk;
  }
  return out;
}

function orderSubjectPoolIntoMixedChunks<T extends { id: number; title?: string | null }>(
  pool: T[],
  chunkSize: number,
  maxCap: number
): T[] {
  const topicMap = new Map<string, T[]>();
  const sorted = pool.slice().sort((a, b) => a.id - b.id);
  for (const q of sorted) {
    const tk = normalizeTopicTitleKey(q.title || 'อื่นๆ');
    const arr = topicMap.get(tk);
    if (arr) arr.push(q);
    else topicMap.set(tk, [q]);
  }

  const ordered: T[] = [];
  while (ordered.length < sorted.length) {
    const used = new Map<string, number>();
    const chunk: T[] = [];
    let lastTk = '';

    // Pass 1: strictly <= maxCap per sub-topic
    while (chunk.length < chunkSize) {
      const cands: Array<{ tk: string; arr: T[]; u: number }> = [];
      for (const [tk, arr] of topicMap.entries()) {
        const u = used.get(tk) || 0;
        if (arr.length > 0 && u < maxCap) cands.push({ tk, arr, u });
      }
      if (cands.length === 0) break;
      cands.sort((a, b) => {
        const aSame = a.tk === lastTk && cands.length > 1 ? 1 : 0;
        const bSame = b.tk === lastTk && cands.length > 1 ? 1 : 0;
        if (aSame !== bSame) return aSame - bSame;
        if (b.arr.length !== a.arr.length) return b.arr.length - a.arr.length;
        if (a.u !== b.u) return a.u - b.u;
        return a.tk.localeCompare(b.tk);
      });
      const best = cands[0];
      chunk.push(best.arr.shift()!);
      used.set(best.tk, best.u + 1);
      lastTk = best.tk;
    }

    // Pass 2: only for tail-end chunks when remaining distinct topics * maxCap < chunkSize
    while (chunk.length < chunkSize) {
      const cands: Array<{ tk: string; arr: T[]; u: number }> = [];
      for (const [tk, arr] of topicMap.entries()) {
        if (arr.length > 0) cands.push({ tk, arr, u: used.get(tk) || 0 });
      }
      if (cands.length === 0) break;
      cands.sort((a, b) => {
        const aSame = a.tk === lastTk && cands.length > 1 ? 1 : 0;
        const bSame = b.tk === lastTk && cands.length > 1 ? 1 : 0;
        if (aSame !== bSame) return aSame - bSame;
        if (b.arr.length !== a.arr.length) return b.arr.length - a.arr.length;
        if (a.u !== b.u) return a.u - b.u;
        return a.tk.localeCompare(b.tk);
      });
      const best = cands[0];
      chunk.push(best.arr.shift()!);
      used.set(best.tk, best.u + 1);
      lastTk = best.tk;
    }

    if (chunk.length === 0) break;
    ordered.push(...chunk);
  }
  return ordered;
}

export function buildDynamicFormPacks<
  T extends { id: number; subject_key: SubjectKey; title?: string | null },
>(
  allQuestions: T[],
  completedSet: Set<number>,
  options?: {
    packMode?: DynamicPackMode;
    trackName?: string;
    chunkSize?: number;
    maxPerTopic?: MaxQuestionsPerTopic;
  }
): DynamicFormPackResult {
  const packMode: DynamicPackMode = options?.packMode === 'strict' ? 'strict' : 'fill';
  const maxPerTopic: MaxQuestionsPerTopic = options?.maxPerTopic === 2 ? 2 : 3;
  const track = TRACKS.find((t) => t.name === options?.trackName) || TRACKS[0];
  const activeWeightSum = OFFICIAL_EXAM_SUBJECT_ORDER.reduce(
    (sum, sk) => sum + (HIDDEN_SUBJECT_KEYS.has(sk) ? 0 : track.weights[sk] || 0),
    0
  );
  const chunkSize = options?.chunkSize || 150;
  void activeWeightSum;

  const nonReserved = allQuestions.filter(
    (q) => !REAL_EXAM_ID_SET.has(q.id) && !HIDDEN_SUBJECT_KEYS.has(q.subject_key)
  );
  const remaining = nonReserved.filter((q) => !completedSet.has(q.id));
  const completedCount = nonReserved.length - remaining.length;

  // Group remaining questions by Subject -> Normalized Sub-Topic -> Sorted Question IDs
  const subjTopics = new Map<SubjectKey, Map<string, number[]>>();
  for (const sk of OFFICIAL_EXAM_SUBJECT_ORDER) {
    subjTopics.set(sk, new Map());
  }
  for (const q of remaining) {
    if (HIDDEN_SUBJECT_KEYS.has(q.subject_key)) continue;
    let m = subjTopics.get(q.subject_key);
    if (!m) {
      m = new Map();
      subjTopics.set(q.subject_key, m);
    }
    const tk = normalizeTopicTitleKey(q.title || 'อื่นๆ');
    const arr = m.get(tk);
    if (arr) arr.push(q.id);
    else m.set(tk, [q.id]);
  }
  for (const [, m] of subjTopics) {
    for (const [, arr] of m) arr.sort((a, b) => a - b);
  }

  const weightEntries: SubjectKey[] = OFFICIAL_EXAM_SUBJECT_ORDER.filter(
    (sk) => !HIDDEN_SUBJECT_KEYS.has(sk) && (track.weights[sk] || 0) > 0
  );
  const allSubjectOrder: SubjectKey[] = [
    ...weightEntries,
    ...OFFICIAL_EXAM_SUBJECT_ORDER.filter(
      (sk) => !HIDDEN_SUBJECT_KEYS.has(sk) && !weightEntries.includes(sk)
    ),
  ];

  const makePack = (
    setIndex: number,
    pairs: Array<{ id: number; subject: SubjectKey }>,
    isTrackExact: boolean,
    isRemainder: boolean
  ): DynamicFormPack => {
    const subjectBreakdown: Partial<Record<SubjectKey, number>> = {};
    const ids: number[] = [];
    for (const p of pairs) {
      ids.push(p.id);
      subjectBreakdown[p.subject] = (subjectBreakdown[p.subject] || 0) + 1;
    }
    return {
      setIndex,
      ids,
      total: ids.length,
      subjectBreakdown,
      isTrackExact,
      isRemainder,
    };
  };

  const pickCappedFromSubject = (
    sk: SubjectKey,
    want: number,
    usedTopic: Map<string, number>,
    lastTopicBySubj: Map<SubjectKey, string>
  ): Array<{ id: number; subject: SubjectKey; tk: string }> => {
    const m = subjTopics.get(sk);
    if (!m || want <= 0) return [];
    const out: Array<{ id: number; subject: SubjectKey; tk: string }> = [];
    let lastTk = lastTopicBySubj.get(sk) || '';

    while (out.length < want) {
      const cands: Array<{ tk: string; arr: number[]; u: number }> = [];
      for (const [tk, arr] of m.entries()) {
        const u = usedTopic.get(`${sk}::${tk}`) || 0;
        if (arr.length > 0 && u < maxPerTopic) {
          cands.push({ tk, arr, u });
        }
      }
      if (cands.length === 0) break;
      cands.sort((a, b) => {
        const aSame = a.tk === lastTk && cands.length > 1 ? 1 : 0;
        const bSame = b.tk === lastTk && cands.length > 1 ? 1 : 0;
        if (aSame !== bSame) return aSame - bSame;
        if (b.arr.length !== a.arr.length) return b.arr.length - a.arr.length;
        if (a.u !== b.u) return a.u - b.u;
        return a.tk.localeCompare(b.tk);
      });
      const best = cands[0];
      const qid = best.arr.shift()!;
      out.push({ id: qid, subject: sk, tk: best.tk });
      usedTopic.set(`${sk}::${best.tk}`, best.u + 1);
      lastTk = best.tk;
    }
    if (lastTk) lastTopicBySubj.set(sk, lastTk);
    return out;
  };

  const rollbackPicked = (
    pickedBySubj: Map<SubjectKey, Array<{ id: number; subject: SubjectKey; tk: string }>>
  ) => {
    for (const [sk, list] of pickedBySubj.entries()) {
      const m = subjTopics.get(sk);
      if (!m) continue;
      for (let i = list.length - 1; i >= 0; i--) {
        const item = list[i];
        m.get(item.tk)?.unshift(item.id);
      }
    }
  };

  const fullSets: DynamicFormPack[] = [];
  const totalRemainingInBuckets = () => {
    let sum = 0;
    for (const [, m] of subjTopics) {
      for (const [, arr] of m) sum += arr.length;
    }
    return sum;
  };

  while (totalRemainingInBuckets() >= chunkSize) {
    const usedTopic = new Map<string, number>();
    const lastTopicBySubj = new Map<SubjectKey, string>();
    const pickedBySubj = new Map<
      SubjectKey,
      Array<{ id: number; subject: SubjectKey; tk: string }>
    >();
    for (const sk of OFFICIAL_EXAM_SUBJECT_ORDER) pickedBySubj.set(sk, []);

    let totalPicked = 0;
    let metAllTrackWeights = true;

    for (const sk of weightEntries) {
      const want = Math.min(track.weights[sk] || 0, Math.max(0, chunkSize - totalPicked));
      const got = pickCappedFromSubject(sk, want, usedTopic, lastTopicBySubj);
      pickedBySubj.get(sk)!.push(...got);
      totalPicked += got.length;
      if (got.length < (track.weights[sk] || 0)) {
        metAllTrackWeights = false;
      }
    }

    if (packMode === 'strict') {
      if (!metAllTrackWeights || totalPicked < chunkSize) {
        rollbackPicked(pickedBySubj);
        break;
      }
    } else {
      // fill mode: top up remaining slots to `chunkSize` while strictly respecting `<= maxPerTopic`
      let guard = 0;
      while (totalPicked < chunkSize && guard < 600) {
        guard++;
        let progressed = false;
        for (const sk of allSubjectOrder) {
          if (totalPicked >= chunkSize) break;
          const extra = pickCappedFromSubject(sk, 1, usedTopic, lastTopicBySubj);
          if (extra.length > 0) {
            pickedBySubj.get(sk)!.push(...extra);
            totalPicked += extra.length;
            progressed = true;
          }
        }
        if (!progressed) break;
      }

      if (totalPicked < chunkSize) {
        rollbackPicked(pickedBySubj);
        break;
      }
    }

    // Emit in strict official 1-150 subject order with interleaved sub-topics inside each subject
    const orderedPairs: Array<{ id: number; subject: SubjectKey }> = [];
    for (const sk of OFFICIAL_EXAM_SUBJECT_ORDER) {
      const subItems = interleaveByTopicOrder(pickedBySubj.get(sk) || []);
      for (const it of subItems) {
        orderedPairs.push({ id: it.id, subject: sk });
      }
    }
    fullSets.push(
      makePack(
        fullSets.length + 1,
        orderedPairs,
        metAllTrackWeights && totalPicked === chunkSize,
        false
      )
    );
  }

  // Build mixed remainder set (interleaved per subject in official subject order)
  const leftoverPairs: Array<{ id: number; subject: SubjectKey }> = [];
  for (const sk of OFFICIAL_EXAM_SUBJECT_ORDER) {
    const m = subjTopics.get(sk);
    if (!m) continue;
    const rawSub: Array<{ id: number; tk: string }> = [];
    for (const [tk, arr] of m.entries()) {
      for (const id of arr) rawSub.push({ id, tk });
    }
    const mixedSub = interleaveByTopicOrder(rawSub);
    for (const it of mixedSub) leftoverPairs.push({ id: it.id, subject: sk });
  }

  const remainderSet =
    leftoverPairs.length > 0 ? makePack(0, leftoverPairs, false, true) : null;

  return {
    fullSets,
    remainderSet,
    completedCount,
    remainingCount: remaining.length,
    trackName: track.name,
    maxPerTopic,
  };
}

export interface BuildExamOptions {
  trackName?: string;
  count?: number;
  subject?: string;
  topic?: string;
  shuffleMode?: boolean;
  setIndex?: number;
  excludeCompleted?: boolean;
  pool?: CompletedPoolMode;
  packMode?: DynamicPackMode;
  maxPerTopic?: MaxQuestionsPerTopic;
  qid?: number;
}

export interface ExamBuildSource {
  allQuestions: QuestionRecord[];
  findById: (id: number) => QuestionRecord | undefined;
  fixedIdsForSet: (setId: string) => number[] | undefined;
  setMetaForSet: (setId: string) =>
    | {
        id: number;
        kind: 'form' | 'subject';
        title: string;
        timeMinutes: number;
        subjectKey: SubjectKey | null;
      }
    | undefined;
  profile: ProfileHistoryFields & { bookmarks: number[]; mistakeIds: number[] };
}

export function buildExamFromSource(
  source: ExamBuildSource,
  setId: string,
  options?: BuildExamOptions
): { title: string; durationSec: number; passRule: 'groups' | 'overall'; items: RunnerQuestion[] } {
  const all = source.allQuestions;
  const { correctSet, mistakeSet, allCompletedSet } = getCompletedIdSets(source.profile);

  // 0. Isolated Final-Days Real-Exam Sets (4 fixed sets: 3x150 + Set 4 all sub-topics + mastery mix loop)
  if (
    setId === 'real-1' ||
    setId === 'real-2' ||
    setId === 'real-3' ||
    setId === 'real-4' ||
    setId === 'real-mistakes' ||
    setId === 'real-mix' ||
    setId === 'real-completed'
  ) {
    const { realCorrectSet, realMistakeSet, realAttemptedSet } = getRealExamStatusSets(
      source.profile
    );
    const officialSubjRank: Record<SubjectKey, number> = {
      math: 0,
      thai: 1,
      com: 2,
      doc: 3,
      law: 4,
      eng: 5,
      soc: 6,
    };

    if (setId === 'real-completed') {
      const poolMode: CompletedPoolMode =
        options?.pool === 'correct' ? 'correct' : options?.pool === 'wrong' ? 'wrong' : 'all';
      const targetSet =
        poolMode === 'correct'
          ? realCorrectSet
          : poolMode === 'wrong'
            ? realMistakeSet
            : realAttemptedSet;
      const topicMatcher = options?.topic ? resolveTopicSelection(options.topic) : null;
      let filtered = REAL_EXAM_ALL_IDS.filter((id) => targetSet.has(id))
        .map((id) => source.findById(id))
        .filter((q): q is QuestionRecord => Boolean(q));
      if (options?.subject && Object.prototype.hasOwnProperty.call(SUBJECT_MAP, options.subject)) {
        filtered = filtered.filter((q) => q.subject_key === options.subject);
      }
      if (topicMatcher) filtered = filtered.filter((q) => topicMatcher.matches(q.title));
      filtered.sort(
        (a, b) => officialSubjRank[a.subject_key] - officialSubjRank[b.subject_key] || a.id - b.id
      );

      const poolLabel =
        poolMode === 'correct'
          ? 'ทำถูกอย่างเดียว'
          : poolMode === 'wrong'
            ? 'ทำผิดอย่างเดียว'
            : 'ที่ทำแล้วทั้งหมด';
      const chunkSize = Math.max(5, Math.min(200, options?.count || 150));

      if (options?.shuffleMode) {
        const picked = shufflePool(filtered).slice(0, chunkSize);
        return {
          title: `สนามจริง · สุ่มข้อสอบ${poolLabel} (${picked.length} ข้อ)`,
          durationSec: Math.max(5, picked.length) * 60,
          passRule: 'overall',
          items: picked.map(toRunnerQuestion),
        };
      }

      if (options?.setIndex && Number.isFinite(options.setIndex) && options.setIndex >= 1) {
        const totalSets = Math.max(1, Math.ceil(filtered.length / chunkSize));
        const safeSetIdx = Math.min(Math.floor(options.setIndex), totalSets);
        const start = (safeSetIdx - 1) * chunkSize;
        const picked = filtered.slice(start, start + chunkSize);
        return {
          title: `สนามจริง · ข้อสอบ${poolLabel} ชุดที่ ${safeSetIdx}/${totalSets} (${picked.length} ข้อ)`,
          durationSec: Math.max(5, picked.length) * 60,
          passRule: 'overall',
          items: picked.map(toRunnerQuestion),
        };
      }

      const picked = options?.count ? filtered.slice(0, chunkSize) : filtered;
      return {
        title: `สนามจริง · ข้อสอบ${poolLabel} (${picked.length} ข้อ)`,
        durationSec: Math.max(5, picked.length) * 60,
        passRule: 'overall',
        items: picked.map(toRunnerQuestion),
      };
    }

    if (setId === 'real-mistakes') {
      const topicMatcher = options?.topic ? resolveTopicSelection(options.topic) : null;
      const wrongIds = REAL_EXAM_ALL_IDS.filter((id) => realMistakeSet.has(id));
      let picked = wrongIds
        .map((id) => source.findById(id))
        .filter((q): q is QuestionRecord => Boolean(q));
      if (topicMatcher) {
        picked = picked.filter((q) => topicMatcher.matches(q.title));
      }
      const topicLabel = topicMatcher ? ` · ${topicMatcher.displayTopic}` : '';
      return withSubjectFilter(
        options?.shuffleMode ? shufflePool(picked) : picked,
        `ซ่อมข้อผิด · สนามข้อสอบจริง${topicLabel} (${picked.length} ข้อ)`,
        Math.max(10, picked.length),
        'overall',
        options?.subject
      );
    }

    if (setId === 'real-mix') {
      const topicMatcher = options?.topic ? resolveTopicSelection(options.topic) : null;
      const hasSubject =
        Boolean(options?.subject) &&
        Object.prototype.hasOwnProperty.call(SUBJECT_MAP, options!.subject!);
      const candidateQuestions = REAL_EXAM_ALL_IDS.map((id) => source.findById(id)).filter(
        (q): q is QuestionRecord => {
          if (!q) return false;
          if (hasSubject && q.subject_key !== options!.subject) return false;
          if (topicMatcher && !topicMatcher.matches(q.title)) return false;
          return true;
        }
      );

      // Deterministic sequential sub-set slicing when `set=1..N` is passed from /catalog/subject or /catalog/topics
      if (options?.setIndex && Number.isFinite(options.setIndex) && options.setIndex >= 1) {
        const pool = options.excludeCompleted
          ? candidateQuestions.filter((q) => !realAttemptedSet.has(q.id))
          : candidateQuestions;
        pool.sort(
          (a, b) => officialSubjRank[a.subject_key] - officialSubjRank[b.subject_key] || a.id - b.id
        );
        const chunkSize = Math.max(5, Math.min(150, options?.count || 20));
        const totalSets = Math.max(1, Math.ceil(pool.length / chunkSize));
        const safeSetIdx = Math.min(Math.floor(options.setIndex), totalSets);
        const start = (safeSetIdx - 1) * chunkSize;
        const picked = pool.slice(start, start + chunkSize);
        const scopeTitle = topicMatcher
          ? topicMatcher.displayTopic
          : hasSubject
            ? `วิชา${SUBJECT_MAP[options!.subject as SubjectKey].name}`
            : 'รวมสนามจริง';
        return {
          title: `สนามจริง · ${scopeTitle} ชุดที่ ${safeSetIdx}/${totalSets}`,
          durationSec: Math.max(5, picked.length) * 60,
          passRule: 'overall',
          items: picked.map(toRunnerQuestion),
        };
      }

      const candidateIds = candidateQuestions.map((q) => q.id);

      const targetSize = Math.max(
        1,
        Math.min(150, options?.count || (topicMatcher ? candidateIds.length : 150))
      );
      const wrongIds = candidateIds.filter((id) => realMistakeSet.has(id));
      const unseenIds = candidateIds.filter(
        (id) => !realMistakeSet.has(id) && !realCorrectSet.has(id)
      );
      const correctIds = candidateIds.filter((id) => realCorrectSet.has(id));

      // Priority: wrong first -> unseen -> fill remainder from shuffled correct in the 3 real sets
      const selectedIds: number[] = [];
      for (const id of shufflePool(wrongIds)) {
        if (selectedIds.length >= targetSize) break;
        selectedIds.push(id);
      }
      for (const id of shufflePool(unseenIds)) {
        if (selectedIds.length >= targetSize) break;
        selectedIds.push(id);
      }
      if (selectedIds.length < targetSize) {
        for (const id of shufflePool(correctIds)) {
          if (selectedIds.length >= targetSize) break;
          selectedIds.push(id);
        }
      }
      const picked = selectedIds
        .map((id) => source.findById(id))
        .filter((q): q is QuestionRecord => Boolean(q))
        .sort((a, b) => officialSubjRank[a.subject_key] - officialSubjRank[b.subject_key]);
      const priorityCount = Math.min(targetSize, wrongIds.length + unseenIds.length);
      const title = topicMatcher
        ? `ฝึกบทเรียน (สนามข้อสอบจริง) · ${topicMatcher.displayTopic} (${picked.length} ข้อ)`
        : `ชุดผสมซ่อมวน 150 ข้อ · สนามข้อสอบจริง (เน้นข้อผิด/ยังไม่ผ่าน ${priorityCount} ข้อ)`;
      return withSubjectFilter(
        picked,
        title,
        picked.length >= 150 ? 180 : Math.max(10, picked.length),
        picked.length >= 150 ? 'groups' : 'overall',
        options?.subject
      );
    }

    const fixedRealSet = getRealExamSetById(setId);
    let ids = fixedRealSet ? [...fixedRealSet.questionIds] : [];
    if (options?.pool === 'wrong') {
      ids = ids.filter((id) => realMistakeSet.has(id));
    }
    const picked = ids
      .map((id) => source.findById(id))
      .filter((q): q is QuestionRecord => Boolean(q));
    const titleSuffix = options?.pool === 'wrong' ? ' · เฉพาะข้อที่ผิด' : '';
    return withSubjectFilter(
      picked,
      `${fixedRealSet?.title || `ชุดข้อสอบจริง #${setId}`}${titleSuffix}`,
      picked.length >= 150 ? 180 : Math.max(15, picked.length),
      picked.length >= 150 ? 'groups' : 'overall',
      options?.subject
    );
  }

  // 1. Mistake notebook drill
  if (setId === 'mistakes') {
    const ids = source.profile.mistakeIds || [];
    const picked = ids.map((id) => source.findById(id)).filter((q): q is QuestionRecord => Boolean(q));
    return withSubjectFilter(picked, 'ซ่อมข้อสอบที่ตอบผิด', Math.max(10, picked.length), 'overall', options?.subject);
  }

  // 2. Bookmarked / Review Vault questions drill
  if (setId === 'bookmarks' || setId === 'review-form' || setId === 'review-subject' || setId === 'review-topic') {
    const bookmarkIds = source.profile.bookmarks || [];
    if (options?.qid && Number.isFinite(options.qid)) {
      const single = source.findById(options.qid);
      const picked = single ? [single] : [];
      return {
        title: `คลังทบทวนรายข้อ · ข้อ #${options.qid}`,
        durationSec: 5 * 60,
        passRule: 'overall',
        items: picked.map(toRunnerQuestion),
      };
    }

    const reviewPool = bookmarkIds
      .map((id) => source.findById(id))
      .filter((q): q is QuestionRecord => Boolean(q))
      .sort((a, b) => a.id - b.id);

    if (setId === 'review-subject') {
      const sk = (options?.subject || 'math') as SubjectKey;
      const meta = SUBJECT_MAP[sk] || SUBJECTS[0];
      const subjPool = reviewPool.filter((q) => q.subject_key === meta.key);
      const chunkSize = Math.max(1, Math.min(200, options?.count || 20));
      if (options?.setIndex && Number.isFinite(options.setIndex) && options.setIndex >= 1) {
        const totalSets = Math.max(1, Math.ceil(subjPool.length / chunkSize));
        const safeSetIdx = Math.min(Math.floor(options.setIndex), totalSets);
        const start = (safeSetIdx - 1) * chunkSize;
        const picked = subjPool.slice(start, start + chunkSize);
        return {
          title: `คลังทบทวน · วิชา${meta.name} ชุดที่ ${safeSetIdx}/${totalSets}`,
          durationSec: Math.max(5, picked.length) * 60,
          passRule: 'overall',
          items: picked.map(toRunnerQuestion),
        };
      }
      const picked = options?.shuffleMode ? shufflePool(subjPool).slice(0, chunkSize) : subjPool;
      return {
        title: `คลังทบทวน · วิชา${meta.name} (${picked.length} ข้อ)`,
        durationSec: Math.max(5, picked.length) * 60,
        passRule: 'overall',
        items: picked.map(toRunnerQuestion),
      };
    }

    if (setId === 'review-topic') {
      const topicMatcher = resolveTopicSelection(options?.topic);
      const topicPool = reviewPool.filter(
        (q) =>
          (!options?.subject || q.subject_key === options.subject) &&
          topicMatcher.matches(q.title)
      );
      const picked = options?.shuffleMode ? shufflePool(topicPool) : topicPool;
      return {
        title: `คลังทบทวน · ${topicMatcher.displayTopic} (${picked.length} ข้อ)`,
        durationSec: Math.max(5, picked.length) * 60,
        passRule: 'overall',
        items: picked.map(toRunnerQuestion),
      };
    }

    if (setId === 'review-form') {
      const chunkSize = Math.max(5, Math.min(200, options?.count || 150));
      if (options?.shuffleMode) {
        const picked = shufflePool(reviewPool).slice(0, chunkSize);
        return withSubjectFilter(
          picked,
          `คลังทบทวน · สุ่มรวม ${picked.length} ข้อ`,
          Math.max(10, picked.length),
          'overall',
          options?.subject
        );
      }
      if (options?.setIndex && Number.isFinite(options.setIndex) && options.setIndex >= 1) {
        const totalSets = Math.max(1, Math.ceil(reviewPool.length / chunkSize));
        const safeSetIdx = Math.min(Math.floor(options.setIndex), totalSets);
        const start = (safeSetIdx - 1) * chunkSize;
        const picked = reviewPool.slice(start, start + chunkSize);
        return withSubjectFilter(
          picked,
          `คลังทบทวนรวม · ชุดที่ ${safeSetIdx}/${totalSets}`,
          Math.max(10, picked.length),
          'overall',
          options?.subject
        );
      }
    }

    const picked = options?.shuffleMode ? shufflePool(reviewPool) : reviewPool;
    return withSubjectFilter(
      picked,
      `คลังทบทวนรายข้อ (${picked.length} ข้อ)`,
      Math.max(10, picked.length),
      'overall',
      options?.subject
    );
  }

  const savedMaxPerTopic: MaxQuestionsPerTopic =
    options?.maxPerTopic === 2
      ? 2
      : options?.maxPerTopic === 3
        ? 3
        : source.profile.examSettings?.maxPerTopic === 2
          ? 2
          : 3;

  // 2b. Dynamic Re-packed 150-Question Form Sets (`repack-form`)
  if (setId === 'repack-form') {
    const packMode: DynamicPackMode = options?.packMode === 'strict' ? 'strict' : 'fill';
    const packs = buildDynamicFormPacks(all, allCompletedSet, {
      packMode,
      trackName: options?.trackName || source.profile.examSettings?.selectedTrack,
      chunkSize: options?.count || 150,
      maxPerTopic: savedMaxPerTopic,
    });
    const isRemainderReq = options?.setIndex === 0;
    const chosenPack = isRemainderReq
      ? packs.remainderSet
      : packs.fullSets[
          Math.min(
            Math.max(0, Math.floor((options?.setIndex || 1) - 1)),
            Math.max(0, packs.fullSets.length - 1)
          )
        ] || packs.remainderSet;

    const rawIds = chosenPack?.ids || [];
    const effectiveIds = chosenPack?.isRemainder
      ? rawIds.slice(0, Math.max(10, Math.min(200, options?.count || 150)))
      : rawIds;
    const picked = effectiveIds
      .map((id) => source.findById(id))
      .filter((q): q is QuestionRecord => Boolean(q));

    const modeSuffix = `${packMode === 'strict' ? 'สัดส่วนสายสอบ' : 'เติมเต็ม 150 ข้อ'} · ไม่เกิน ${savedMaxPerTopic} ข้อ/บท`;
    const baseTitle = chosenPack?.isRemainder
      ? `ชุดเก็บตก (ข้อที่เหลือ ${picked.length} ข้อ) · ${modeSuffix}`
      : `ชุดจัดระเบียบใหม่ ชุดที่ ${chosenPack?.setIndex || 1}/${Math.max(1, packs.fullSets.length)} · ${modeSuffix}`;

    return withSubjectFilter(
      picked,
      baseTitle,
      picked.length >= 150 ? 180 : Math.max(15, picked.length),
      picked.length >= 150 ? 'groups' : 'overall',
      options?.subject
    );
  }

  // 3. Completed-Question Review Sets (/catalog/completed)
  if (setId === 'completed-form' || setId === 'completed-subject' || setId === 'completed-topic') {
    const poolMode: CompletedPoolMode =
      options?.pool === 'correct' ? 'correct' : options?.pool === 'wrong' ? 'wrong' : 'all';
    const targetIdSet =
      poolMode === 'correct' ? correctSet : poolMode === 'wrong' ? mistakeSet : allCompletedSet;
    const poolLabel =
      poolMode === 'correct'
        ? 'ทำถูกอย่างเดียว'
        : poolMode === 'wrong'
          ? 'ทำผิดอย่างเดียว'
          : 'รวมที่เคยทำทั้งหมด';

    const completedPool = all
      .filter((q) => targetIdSet.has(q.id))
      .slice()
      .sort((a, b) => a.id - b.id);

    if (setId === 'completed-form') {
      const chunkSize = Math.max(5, Math.min(200, options?.count || 150));
      if (options?.shuffleMode) {
        const picked = shufflePool(completedPool).slice(0, chunkSize);
        return withSubjectFilter(
          picked,
          `ชุดข้อสอบที่เคยทำ (${poolLabel}) · สุ่ม ${picked.length} ข้อ`,
          Math.max(10, picked.length),
          'overall',
          options?.subject
        );
      }
      const totalSets = Math.max(1, Math.ceil(completedPool.length / chunkSize));
      const safeSetIdx = Math.min(Math.max(1, Math.floor(options?.setIndex || 1)), totalSets);
      const start = (safeSetIdx - 1) * chunkSize;
      const picked = completedPool.slice(start, start + chunkSize);
      return withSubjectFilter(
        picked,
        `ชุดข้อสอบที่เคยทำ (${poolLabel}) · ชุดใหญ่ 150 ข้อ ชุดที่ ${safeSetIdx}/${totalSets}`,
        Math.max(10, picked.length),
        'overall',
        options?.subject
      );
    }

    if (setId === 'completed-subject') {
      const sk = (options?.subject || 'math') as SubjectKey;
      const meta = SUBJECT_MAP[sk] || SUBJECTS[0];
      const subjPool = completedPool.filter((q) => q.subject_key === meta.key);
      const chunkSize = Math.max(5, Math.min(150, options?.count || 20));
      if (options?.setIndex && Number.isFinite(options.setIndex) && options.setIndex >= 1) {
        const totalSets = Math.max(1, Math.ceil(subjPool.length / chunkSize));
        const safeSetIdx = Math.min(Math.floor(options.setIndex), totalSets);
        const start = (safeSetIdx - 1) * chunkSize;
        const picked = subjPool.slice(start, start + chunkSize);
        return {
          title: `ข้อสอบที่เคยทำ (${poolLabel}) · วิชา${meta.name} ชุดที่ ${safeSetIdx}/${totalSets}`,
          durationSec: Math.max(5, picked.length) * 60,
          passRule: 'overall',
          items: picked.map(toRunnerQuestion),
        };
      }
      const picked = shufflePool(subjPool).slice(0, chunkSize);
      return {
        title: `ข้อสอบที่เคยทำ (${poolLabel}) · สุ่มวิชา${meta.name} (${picked.length} ข้อ)`,
        durationSec: Math.max(5, picked.length) * 60,
        passRule: 'overall',
        items: picked.map(toRunnerQuestion),
      };
    }

    // completed-topic
    const topicMatcher = resolveTopicSelection(options?.topic);
    const topicPool = completedPool.filter(
      (q) =>
        (!options?.subject || q.subject_key === options.subject) &&
        topicMatcher.matches(q.title)
    );
    const chunkSize = Math.max(5, Math.min(500, options?.count || 20));
    if (options?.setIndex && Number.isFinite(options.setIndex) && options.setIndex >= 1) {
      const totalSets = Math.max(1, Math.ceil(topicPool.length / chunkSize));
      const safeSetIdx = Math.min(Math.floor(options.setIndex), totalSets);
      const start = (safeSetIdx - 1) * chunkSize;
      const picked = topicPool.slice(start, start + chunkSize);
      return {
        title: `ข้อสอบที่เคยทำ (${poolLabel}) · ${topicMatcher.displayTopic} ชุดที่ ${safeSetIdx}/${totalSets}`,
        durationSec: Math.max(5, picked.length) * 60,
        passRule: 'overall',
        items: picked.map(toRunnerQuestion),
      };
    }
    const picked = shufflePool(topicPool).slice(0, chunkSize);
    return {
      title: `ข้อสอบที่เคยทำ (${poolLabel}) · ${topicMatcher.displayTopic} (${picked.length} ข้อ)`,
      durationSec: Math.max(5, picked.length) * 60,
      passRule: 'overall',
      items: picked.map(toRunnerQuestion),
    };
  }

  const shouldExcludeCompleted =
    options?.excludeCompleted !== undefined ? options.excludeCompleted : false;
  const nonRealExamPool = all.filter(
    (q) => !REAL_EXAM_ID_SET.has(q.id) && !HIDDEN_SUBJECT_KEYS.has(q.subject_key)
  );
  const activePool = shouldExcludeCompleted
    ? nonRealExamPool.filter((q) => !allCompletedSet.has(q.id))
    : nonRealExamPool;

  // 4. Specific Sub-Topic drill (supports ordered sets set=1..N and normalized/aliased topic names)
  if (setId === 'topic') {
    const topicMatcher = resolveTopicSelection(options?.topic);
    const filtered = activePool
      .filter(
        (q) =>
          (!options?.subject || q.subject_key === options.subject) &&
          topicMatcher.matches(q.title)
      )
      .slice()
      .sort((a, b) => a.id - b.id);

    if (options?.setIndex && Number.isFinite(options.setIndex) && options.setIndex >= 1) {
      const chunkSize = Math.max(5, Math.min(500, options?.count || 20));
      const totalSets = Math.max(1, Math.ceil(filtered.length / chunkSize));
      const safeSetIdx = Math.min(Math.floor(options.setIndex), totalSets);
      const start = (safeSetIdx - 1) * chunkSize;
      const picked = filtered.slice(start, start + chunkSize);
      const rangeText = picked.length > 0 ? ` (ข้อ ${start + 1}–${start + picked.length})` : '';
      return {
        title: `เจาะลึกหัวข้อ · ${topicMatcher.displayTopic} · ชุดที่ ${safeSetIdx}/${totalSets}${rangeText}`,
        durationSec: Math.max(10, picked.length) * 60,
        passRule: 'overall',
        items: picked.map(toRunnerQuestion),
      };
    }

    const limit = Math.min(options?.count || 30, filtered.length);
    const picked = shufflePool(filtered).slice(0, limit);
    return {
      title: `เจาะลึกหัวข้อ · ${topicMatcher.displayTopic}`,
      durationSec: Math.max(10, picked.length) * 60,
      passRule: 'overall',
      items: picked.map(toRunnerQuestion),
    };
  }

  // 5. Random track-weighted mock exam (official 1-150 order, strictly <= savedMaxPerTopic per sub-topic)
  if (setId.startsWith('random')) {
    const idxMatch = /^random-(\d+)$/.exec(setId);
    const track =
      (idxMatch && TRACKS[Number(idxMatch[1])]) ||
      TRACKS.find((t) => t.name === (options?.trackName || source.profile.examSettings?.selectedTrack)) ||
      TRACKS[0];

    const entries: SubjectKey[] = OFFICIAL_EXAM_SUBJECT_ORDER.filter(
      (sk) => !HIDDEN_SUBJECT_KEYS.has(sk) && (track.weights[sk] || 0) > 0
    );
    const activeWeightTotal =
      entries.reduce((acc, sk) => acc + (track.weights[sk] || 0), 0) || 150;
    const desiredTotal =
      options?.count && options.count > 0 && options.count <= 150 ? options.count : 150;

    // Build shuffled sub-topic buckets per active subject
    const shuffledBySubj = new Map<SubjectKey, Map<string, QuestionRecord[]>>();
    for (const sk of OFFICIAL_EXAM_SUBJECT_ORDER) {
      if (HIDDEN_SUBJECT_KEYS.has(sk)) continue;
      const m = new Map<string, QuestionRecord[]>();
      const subPool = shufflePool(activePool.filter((q) => q.subject_key === sk));
      for (const q of subPool) {
        const tk = normalizeTopicTitleKey(q.title || 'อื่นๆ');
        const arr = m.get(tk);
        if (arr) arr.push(q);
        else m.set(tk, [q]);
      }
      shuffledBySubj.set(sk, m);
    }

    const usedTopic = new Map<string, number>();
    const pickedBySubj = new Map<SubjectKey, Array<{ q: QuestionRecord; tk: string }>>();
    for (const sk of OFFICIAL_EXAM_SUBJECT_ORDER) pickedBySubj.set(sk, []);

    const pickRandomCapped = (sk: SubjectKey, want: number): number => {
      const m = shuffledBySubj.get(sk);
      if (!m || want <= 0) return 0;
      let got = 0;
      let lastTk = '';
      while (got < want) {
        const cands: Array<{ tk: string; arr: QuestionRecord[]; u: number }> = [];
        for (const [tk, arr] of m.entries()) {
          const u = usedTopic.get(`${sk}::${tk}`) || 0;
          if (arr.length > 0 && u < savedMaxPerTopic) cands.push({ tk, arr, u });
        }
        if (cands.length === 0) break;
        const shuffledCands = shufflePool(cands).sort((a, b) => {
          const aSame = a.tk === lastTk && cands.length > 1 ? 1 : 0;
          const bSame = b.tk === lastTk && cands.length > 1 ? 1 : 0;
          if (aSame !== bSame) return aSame - bSame;
          return a.u - b.u;
        });
        const best = shuffledCands[0];
        const q = best.arr.shift()!;
        pickedBySubj.get(sk)!.push({ q, tk: best.tk });
        usedTopic.set(`${sk}::${best.tk}`, best.u + 1);
        lastTk = best.tk;
        got++;
      }
      return got;
    };

    let totalCollected = 0;
    for (let i = 0; i < entries.length; i++) {
      const sk = entries[i];
      const weight = track.weights[sk] || 0;
      const targetCount =
        i === entries.length - 1
          ? Math.max(0, desiredTotal - totalCollected)
          : Math.max(1, Math.round((weight / activeWeightTotal) * desiredTotal));
      totalCollected += pickRandomCapped(sk, Math.min(targetCount, desiredTotal - totalCollected));
    }

    // Top up to desiredTotal across active subjects while still enforcing <= savedMaxPerTopic
    let guard = 0;
    while (totalCollected < desiredTotal && guard < 400) {
      guard++;
      let prog = false;
      for (const sk of OFFICIAL_EXAM_SUBJECT_ORDER) {
        if (HIDDEN_SUBJECT_KEYS.has(sk) || totalCollected >= desiredTotal) continue;
        if (pickRandomCapped(sk, 1) > 0) {
          totalCollected++;
          prog = true;
        }
      }
      if (!prog) break;
    }

    const finalItems: QuestionRecord[] = [];
    for (const sk of OFFICIAL_EXAM_SUBJECT_ORDER) {
      const mixed = interleaveByTopicOrder(pickedBySubj.get(sk) || []);
      for (const item of mixed) finalItems.push(item.q);
    }

    return withSubjectFilter(
      finalItems.slice(0, desiredTotal),
      `ข้อสอบสุ่มครบทุกวิชา · ${track.name}`,
      desiredTotal === 150 ? 180 : Math.max(15, desiredTotal),
      'groups',
      options?.subject
    );
  }

  // 6. Dynamic Subject Drill (`subject-math`, mixed sub-topics <= savedMaxPerTopic per set!)
  if (setId.startsWith('subject-')) {
    const sk = setId.replace('subject-', '') as SubjectKey;
    const meta = SUBJECT_MAP[sk] || SUBJECTS[0];
    const chunkSize = Math.max(5, Math.min(150, options?.count || 20));
    const rawSubjectPool = activePool.filter((q) => q.subject_key === meta.key);

    if (options?.setIndex && Number.isFinite(options.setIndex) && options.setIndex >= 1) {
      const mixedSubjectPool = orderSubjectPoolIntoMixedChunks(
        rawSubjectPool,
        chunkSize,
        savedMaxPerTopic
      );
      const totalSets = Math.max(1, Math.ceil(mixedSubjectPool.length / chunkSize));
      const safeSetIdx = Math.min(Math.floor(options.setIndex), totalSets);
      const start = (safeSetIdx - 1) * chunkSize;
      const picked = mixedSubjectPool.slice(start, start + chunkSize);
      return {
        title: `ชุดข้อสอบแยกวิชา · ${meta.name} ชุดที่ ${safeSetIdx}`,
        durationSec: Math.max(5, picked.length) * 60,
        passRule: 'overall',
        items: picked.map(toRunnerQuestion),
      };
    }

    // Random drill on a single subject: also cap sub-topics at savedMaxPerTopic first, then interleave
    const shuffledMap = new Map<string, QuestionRecord[]>();
    for (const q of shufflePool(rawSubjectPool)) {
      const tk = normalizeTopicTitleKey(q.title || 'อื่นๆ');
      const arr = shuffledMap.get(tk);
      if (arr) arr.push(q);
      else shuffledMap.set(tk, [q]);
    }
    const used = new Map<string, number>();
    const pool: QuestionRecord[] = [];
    let lastTk = '';
    while (pool.length < Math.min(chunkSize, rawSubjectPool.length)) {
      let cands = Array.from(shuffledMap.entries()).filter(
        ([tk, arr]) => arr.length > 0 && (used.get(tk) || 0) < savedMaxPerTopic
      );
      if (cands.length === 0) {
        cands = Array.from(shuffledMap.entries()).filter(([, arr]) => arr.length > 0);
      }
      if (cands.length === 0) break;
      cands = shufflePool(cands).sort((a, b) => {
        const aSame = a[0] === lastTk && cands.length > 1 ? 1 : 0;
        const bSame = b[0] === lastTk && cands.length > 1 ? 1 : 0;
        if (aSame !== bSame) return aSame - bSame;
        return (used.get(a[0]) || 0) - (used.get(b[0]) || 0);
      });
      const [tk, arr] = cands[0];
      pool.push(arr.shift()!);
      used.set(tk, (used.get(tk) || 0) + 1);
      lastTk = tk;
    }
    return {
      title: `ฝึกรายวิชา · ${meta.name} (${pool.length} ข้อ)`,
      durationSec: Math.max(5, pool.length) * 60,
      passRule: 'overall',
      items: pool.map(toRunnerQuestion),
    };
  }

  // 7. Custom admin set or built-in catalog set (`101..107`, `201..215`)
  const fixedIds = source.fixedIdsForSet(setId);
  const setMeta = source.setMetaForSet(setId);
  if (fixedIds && fixedIds.length > 0) {
    let picked = fixedIds
      .map((id) => source.findById(id))
      .filter((q): q is QuestionRecord => Boolean(q));
    if (shouldExcludeCompleted) {
      picked = picked.filter((q) => !allCompletedSet.has(q.id));
    }
    if (options?.shuffleMode && setMeta?.subjectKey) {
      picked = shufflePool(activePool.filter((q) => q.subject_key === setMeta.subjectKey)).slice(
        0,
        options?.count || 20
      );
    }
    return withSubjectFilter(
      picked,
      setMeta?.title || `ชุดข้อสอบ #${setId}`,
      setMeta?.timeMinutes || picked.length,
      setMeta?.kind === 'subject' ? 'overall' : 'groups',
      options?.subject
    );
  }

  const fallback = shufflePool(activePool).slice(0, 20);
  return {
    title: `ชุดข้อสอบฝึกหัด #${setId}`,
    durationSec: 20 * 60,
    passRule: 'overall',
    items: fallback.map(toRunnerQuestion),
  };
}

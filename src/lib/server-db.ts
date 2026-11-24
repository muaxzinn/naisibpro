import fs from 'node:fs';
import path from 'node:path';
import { SUBJECTS, type SubjectKey } from './constants';
import {
  applyQuestionOutcomes,
  applyRealExamOutcomes,
  backfillProfileHistoryFromAttempts,
  buildExamFromSource,
  computeSubjectBreakdown,
  DEFAULT_EXAM_SETTINGS,
  getCompletedIdSets,
  getRealExamStatusSets,
  resetCompletedHistory,
  resetRealExamHistory,
  sanitizeExamSettings,
  toRunnerQuestion,
  type BuildExamOptions,
  type CompletedPoolMode,
  type ExamUserSettings,
  type MaxQuestionsPerTopic,
  type QuestionOutcome,
  type QuestionRecord,
  type ResetCompletedFilter,
  type RunnerQuestion,
} from './question-pool';
import { IMAGE_URL_ONLY_RE } from './rich-text-parser';
import { buildSubTopicsCatalog } from './topic-catalog';

export {
  applyQuestionOutcomes,
  applyRealExamOutcomes,
  computeSubjectBreakdown,
  DEFAULT_EXAM_SETTINGS,
  getCompletedIdSets,
  getRealExamStatusSets,
  resetCompletedHistory,
  resetRealExamHistory,
  sanitizeExamSettings,
  toRunnerQuestion,
  type BuildExamOptions,
  type CompletedPoolMode,
  type ExamUserSettings,
  type MaxQuestionsPerTopic,
  type QuestionOutcome,
  type QuestionRecord,
  type ResetCompletedFilter,
  type RunnerQuestion,
};

export interface ArticleRecord {
  kind: 'article' | 'news';
  slug: string;
  url: string;
  title: string;
  description: string;
  h1: string;
  headings: string[];
  images: string[];
  text: string;
}

export interface ExamSetSummary {
  id: number;
  kind: 'form' | 'subject';
  title: string;
  subtitle: string;
  total: number;
  timeMinutes: number;
  subjectKey: SubjectKey | null;
  track: string | null;
  subjectBreakdown: Partial<Record<SubjectKey, number>>;
}

export interface AttemptSubjectStat {
  key: SubjectKey;
  correct: number;
  total: number;
  pct: number;
}

export interface AttemptTopicStat {
  title: string;
  subjectKey: SubjectKey;
  correct: number;
  total: number;
  pct: number;
}

export interface AttemptGroupStat {
  grp: 'general' | 'specific';
  label: string;
  correct: number;
  total: number;
  pct: number;
  pass: boolean;
}

export interface AttemptRecord {
  id: number;
  setId: string;
  setTitle: string;
  mode: 'real' | 'practice';
  startedAt: string;
  submittedAt: string;
  durationSec: number;
  score: number;
  total: number;
  pct: number;
  passed: boolean;
  perSubject: AttemptSubjectStat[];
  groups: AttemptGroupStat[];
  perTopic: AttemptTopicStat[];
  wrongIndices: number[];
  questionIds: number[];
  answers: (number | null)[];
  bookmarkedIds: number[];
}

export interface ReportRecord {
  id: number;
  questionId: number | null;
  questionText: string;
  category: 'question' | 'system';
  reason: string;
  note: string | null;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface ExamProgressRecord {
  setId: string;
  mode: 'real' | 'practice';
  list: Array<{ id: number; subject: SubjectKey }>;
  answers: (number | null)[];
  cur: number;
  startedAt: string;
  endAt: number;
  updatedAt: number;
  activeSec: number;
  awayAt: number | null;
}

export interface UserProfile {
  track: string;
  bookmarks: number[];
  mistakeIds: number[];
  correctIds?: number[];
  realExamCorrectIds?: number[];
  realExamMistakeIds?: number[];
  excludeCompleted?: boolean;
  examSettings?: ExamUserSettings;
  streakDays: number;
  lastActiveDate: string | null;
}

export interface RuntimeState {
  profile: UserProfile;
  attempts: AttemptRecord[];
  examProgress: ExamProgressRecord | null;
  reports: ReportRecord[];
  customSets: ExamSetSummary[];
  customSetQuestionIds: Record<string, number[]>;
  customQuestions: QuestionRecord[];
  leaderboard: Array<{
    track: string;
    nameMasked: string;
    score: number;
    total: number;
    durationFormatted: string;
    isChampion?: boolean;
  }>;
}

const KB_DATASET_DIR = path.join(process.cwd(), 'data', 'dataset');
const KB_Q_IMAGES_DIR = path.join(process.cwd(), 'public', 'question-images');
const KB_Q_SVGS_DIR = path.join(process.cwd(), 'public', 'question-svgs');
const RUNTIME_STATE_PATH = path.join(process.cwd(), 'data', 'runtime-state.json');
const TMP_RUNTIME_STATE_PATH = '/tmp/guru-runtime-state.json';

interface StoreCache {
  questions: QuestionRecord[];
  questionsById: Map<number, QuestionRecord>;
  setsMap: Map<string, number[]>;
  examSets: ExamSetSummary[];
  articles: ArticleRecord[];
  news: ArticleRecord[];
  imageCount: number;
  topics: Array<{ title: string; subjectKey: SubjectKey; count: number }>;
  batches: Array<{ batch: string; count: number }>;
  subTopicsCatalog: ReturnType<typeof buildSubTopicsCatalog>;
}

const searchBlobCache = new WeakMap<QuestionRecord, string>();

export function getQuestionSearchBlob(q: QuestionRecord): string {
  const cached = searchBlobCache.get(q);
  if (cached !== undefined) return cached;
  const blob = `${q.id}\n${q.stem || ''}\n${q.title || ''}\n${q.explanation || ''}\n${(q.opts || []).join('\n')}`.toLowerCase();
  searchBlobCache.set(q, blob);
  return blob;
}

const globalForStore = globalThis as typeof globalThis & {
  __guruStore?: StoreCache;
  __guruRuntime?: RuntimeState;
};

function resolveLocalImageUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/question-images/') || trimmed.startsWith('/question-svgs/')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return null;
}

function buildStore(): StoreCache {
  if (globalForStore.__guruStore) return globalForStore.__guruStore;

  const rawQuestions: QuestionRecord[] = JSON.parse(
    fs.readFileSync(path.join(KB_DATASET_DIR, 'all-questions.json'), 'utf8')
  );

  const questions: QuestionRecord[] = rawQuestions.map((q) => {
    const stemTrim = typeof q.stem === 'string' ? q.stem.trim() : '';
    const stemIsImg = Boolean(stemTrim && IMAGE_URL_ONLY_RE.test(stemTrim));
    const resolvedStemImg = stemIsImg ? resolveLocalImageUrl(stemTrim) || stemTrim : null;

    const expTrim = typeof q.explanation === 'string' ? q.explanation.trim() : '';
    const expIsImg = Boolean(expTrim && IMAGE_URL_ONLY_RE.test(expTrim));
    const resolvedExpImg = expIsImg ? resolveLocalImageUrl(expTrim) || expTrim : null;

    const rawOpts = Array.isArray(q.opts) ? q.opts : [];
    const existingOptImgs = Array.isArray(q.opt_imgs) ? q.opt_imgs : [];
    const normalizedOptImgs: (string | null)[] = rawOpts.map((opt, idx) => {
      const existing = resolveLocalImageUrl(existingOptImgs[idx]);
      if (existing) return existing;
      const optTrim = typeof opt === 'string' ? opt.trim() : '';
      if (optTrim && IMAGE_URL_ONLY_RE.test(optTrim)) {
        return resolveLocalImageUrl(optTrim) || optTrim;
      }
      return null;
    });
    const normalizedOpts: string[] = rawOpts.map((opt) => {
      const optTrim = typeof opt === 'string' ? opt.trim() : '';
      if (optTrim && IMAGE_URL_ONLY_RE.test(optTrim)) return '';
      return opt;
    });

    return {
      ...q,
      stem: stemIsImg ? 'พิจารณารูปภาพต่อไปนี้แล้วเลือกคำตอบที่ถูกต้อง' : q.stem,
      img: resolveLocalImageUrl(q.img) || resolvedStemImg,
      opts: normalizedOpts,
      opt_imgs: normalizedOptImgs.some(Boolean) ? normalizedOptImgs : null,
      explanation: expIsImg ? '' : q.explanation,
      explanation_img: resolveLocalImageUrl(q.explanation_img) || resolvedExpImg,
    };
  });

  const questionsById = new Map<number, QuestionRecord>();
  const topicCounter = new Map<string, { title: string; subjectKey: SubjectKey; count: number }>();
  const batchCounter = new Map<string, number>();

  for (const q of questions) {
    questionsById.set(q.id, q);
    getQuestionSearchBlob(q);
    if (q.title) {
      const tKey = `${q.subject_key}::${q.title}`;
      const existing = topicCounter.get(tKey);
      if (existing) existing.count++;
      else topicCounter.set(tKey, { title: q.title, subjectKey: q.subject_key, count: 1 });
    }
    if (q.batch) {
      batchCounter.set(q.batch, (batchCounter.get(q.batch) || 0) + 1);
    }
  }

  // Load 22 sets (101..107, 201..215)
  const setsMap = new Map<string, number[]>();
  const examSets: ExamSetSummary[] = [];

  for (let i = 0; i < SUBJECTS.length; i++) {
    const s = SUBJECTS[i];
    const sid = String(101 + i);
    const setFile = path.join(KB_DATASET_DIR, 'questions', 'by-set', `set-${sid}.json`);
    let qIds: number[] = [];
    if (fs.existsSync(setFile)) {
      const items = JSON.parse(fs.readFileSync(setFile, 'utf8'));
      qIds = items.map((it: { id: number }) => it.id).filter((id: number) => questionsById.has(id));
    }
    setsMap.set(sid, qIds);
    examSets.push({
      id: Number(sid),
      kind: 'subject',
      title: `ฝึกรายวิชา · ${s.name}`,
      subtitle: 'เจาะลึกรายวิชา พร้อมเฉลยละเอียด',
      total: qIds.length || 20,
      timeMinutes: qIds.length || 20,
      subjectKey: s.key,
      track: 'ฝึกรายวิชา',
      subjectBreakdown: computeSubjectBreakdown(qIds, (id) => questionsById.get(id)),
    });
  }

  for (let i = 1; i <= 15; i++) {
    const sid = String(200 + i);
    const setFile = path.join(KB_DATASET_DIR, 'questions', 'by-set', `set-${sid}.json`);
    let qIds: number[] = [];
    if (fs.existsSync(setFile)) {
      const items = JSON.parse(fs.readFileSync(setFile, 'utf8'));
      qIds = items.map((it: { id: number }) => it.id).filter((id: number) => questionsById.has(id));
    }
    setsMap.set(sid, qIds);
    examSets.push({
      id: Number(sid),
      kind: 'form',
      title: `ข้อสอบจำลองนายสิบตำรวจ ชุดที่ ${i}`,
      subtitle: 'แนวข้อสอบเสมือนจริง 150 ข้อ · เวลา 180 นาที',
      total: qIds.length || 150,
      timeMinutes: 180,
      subjectKey: null,
      track: 'ข้อสอบจำลอง 150 ข้อ',
      subjectBreakdown: computeSubjectBreakdown(qIds, (id) => questionsById.get(id)),
    });
  }

  const articlesData = JSON.parse(fs.readFileSync(path.join(KB_DATASET_DIR, 'articles-and-news.json'), 'utf8'));
  const svgCount = fs.existsSync(KB_Q_SVGS_DIR)
    ? fs.readdirSync(KB_Q_SVGS_DIR).filter((f) => f.endsWith('.svg')).length
    : 0;
  const rasterCount = fs.existsSync(KB_Q_IMAGES_DIR)
    ? fs.readdirSync(KB_Q_IMAGES_DIR).filter((f) => !f.startsWith('.')).length
    : 0;
  const imageCount = svgCount + rasterCount;

  const subTopicsCatalog = buildSubTopicsCatalog(questions);

  const store: StoreCache = {
    questions,
    questionsById,
    setsMap,
    examSets,
    articles: articlesData.articles || [],
    news: articlesData.news || [],
    imageCount,
    topics: Array.from(topicCounter.values()).sort((a, b) => b.count - a.count),
    batches: Array.from(batchCounter.entries())
      .map(([batch, count]) => ({ batch, count }))
      .sort((a, b) => b.count - a.count),
    subTopicsCatalog,
  };

  globalForStore.__guruStore = store;
  return store;
}

export function getStore(): StoreCache {
  return buildStore();
}

function getDefaultRuntimeState(): RuntimeState {
  return {
    profile: {
      track: 'สายอำนวยการ / พิสูจน์หลักฐาน',
      bookmarks: [],
      mistakeIds: [],
      correctIds: [],
      realExamCorrectIds: [],
      realExamMistakeIds: [],
      excludeCompleted: true,
      examSettings: { ...DEFAULT_EXAM_SETTINGS },
      streakDays: 1,
      lastActiveDate: null,
    },
    attempts: [],
    examProgress: null,
    reports: [],
    customSets: [],
    customSetQuestionIds: {},
    customQuestions: [],
    leaderboard: [
      { track: 'สายอำนวยการ / พิสูจน์หลักฐาน', nameMasked: 'พงษ*** ถูก***', score: 150, total: 150, durationFormatted: '1:02:50 ชม.', isChampion: true },
      { track: 'สายอำนวยการ / พิสูจน์หลักฐาน', nameMasked: 'ศศิ*** สกุ***', score: 150, total: 150, durationFormatted: '1:03:09 ชม.' },
      { track: 'สายอำนวยการ / พิสูจน์หลักฐาน', nameMasked: 'วาร*** คำ***', score: 150, total: 150, durationFormatted: '1:23:43 ชม.' },
      { track: 'สายอำนวยการ / พิสูจน์หลักฐาน', nameMasked: 'ชัย*** นิร***', score: 150, total: 150, durationFormatted: '2:04:43 ชม.' },
      { track: 'สายอำนวยการ / พิสูจน์หลักฐาน', nameMasked: 'Pho*** Lhu***', score: 147, total: 150, durationFormatted: '1:53:49 ชม.' },
      { track: 'ปราบปราม (บุคคลทั่วไป)', nameMasked: 'กิต*** พง***', score: 146, total: 150, durationFormatted: '1:18:12 ชม.', isChampion: true },
      { track: 'ปราบปราม (บุคคลทั่วไป)', nameMasked: 'ธน*** สุข***', score: 142, total: 150, durationFormatted: '1:29:44 ชม.' },
      { track: 'ปราบปราม (ทหารเกณฑ์)', nameMasked: 'ณัฐ*** ชัย***', score: 145, total: 150, durationFormatted: '1:11:05 ชม.', isChampion: true },
      { track: 'ปราบปราม (ทหารเกณฑ์)', nameMasked: 'อร*** มี***', score: 139, total: 150, durationFormatted: '1:34:20 ชม.' },
    ],
  };
}

export function readRuntimeState(): RuntimeState {
  if (globalForStore.__guruRuntime) {
    return globalForStore.__guruRuntime;
  }

  let raw: Partial<RuntimeState> | null = null;
  const sourcePath = fs.existsSync(TMP_RUNTIME_STATE_PATH)
    ? TMP_RUNTIME_STATE_PATH
    : fs.existsSync(RUNTIME_STATE_PATH)
      ? RUNTIME_STATE_PATH
      : null;

  if (sourcePath) {
    try {
      raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as Partial<RuntimeState>;
    } catch {
      raw = null;
    }
  }

  if (!raw) {
    const initial = getDefaultRuntimeState();
    writeRuntimeState(initial);
    return initial;
  }

  const defaults = getDefaultRuntimeState();
  const rawProf = raw?.profile;
  const customSetQuestionIds: Record<string, number[]> = raw?.customSetQuestionIds || {};
  let lazyStore: StoreCache | null = null;
  const ensureStore = () => {
    if (!lazyStore) lazyStore = getStore();
    return lazyStore;
  };
  const customSets: ExamSetSummary[] = Array.isArray(raw?.customSets)
    ? raw.customSets.map((s: ExamSetSummary) => {
        if (s.subjectBreakdown && Object.keys(s.subjectBreakdown).length > 0) return s;
        const ids = customSetQuestionIds[String(s.id)] || [];
        return {
          ...s,
          subjectBreakdown: computeSubjectBreakdown(ids, (id) => ensureStore().questionsById.get(id)),
        };
      })
    : [];

  const attempts = Array.isArray(raw?.attempts) ? raw.attempts : [];
  const profile: UserProfile = {
    track: typeof rawProf?.track === 'string' && rawProf.track ? rawProf.track : defaults.profile.track,
    bookmarks: Array.isArray(rawProf?.bookmarks) ? rawProf.bookmarks.map(Number) : [],
    mistakeIds: Array.isArray(rawProf?.mistakeIds) ? rawProf.mistakeIds.map(Number) : [],
    correctIds: Array.isArray(rawProf?.correctIds) ? rawProf.correctIds.map(Number) : [],
    realExamCorrectIds: Array.isArray(rawProf?.realExamCorrectIds)
      ? rawProf.realExamCorrectIds.map(Number)
      : [],
    realExamMistakeIds: Array.isArray(rawProf?.realExamMistakeIds)
      ? rawProf.realExamMistakeIds.map(Number)
      : [],
    excludeCompleted:
      typeof rawProf?.excludeCompleted === 'boolean' ? rawProf.excludeCompleted : true,
    examSettings: sanitizeExamSettings(rawProf?.examSettings),
    streakDays: typeof rawProf?.streakDays === 'number' ? rawProf.streakDays : 1,
    lastActiveDate: typeof rawProf?.lastActiveDate === 'string' ? rawProf.lastActiveDate : null,
  };

  if (!Array.isArray(rawProf?.correctIds) && attempts.length > 0) {
    const st = ensureStore();
    backfillProfileHistoryFromAttempts(
      profile,
      attempts,
      (qid) => st.questionsById.get(qid)?.correct_index
    );
  } else {
    const sets = getCompletedIdSets(profile);
    profile.correctIds = Array.from(sets.correctSet);
    profile.mistakeIds = Array.from(sets.mistakeSet);
  }

  const normalized: RuntimeState = {
    profile,
    attempts,
    examProgress: raw?.examProgress || null,
    reports: Array.isArray(raw?.reports) ? raw.reports : [],
    customSets,
    customSetQuestionIds,
    customQuestions: Array.isArray(raw?.customQuestions) ? raw.customQuestions : [],
    leaderboard:
      Array.isArray(raw?.leaderboard) && raw.leaderboard.length > 0
        ? raw.leaderboard
        : defaults.leaderboard,
  };
  globalForStore.__guruRuntime = normalized;
  return normalized;
}

export function writeRuntimeState(state: RuntimeState): void {
  globalForStore.__guruRuntime = state;
  const serialized = JSON.stringify(state, null, 2);
  try {
    fs.mkdirSync(path.dirname(RUNTIME_STATE_PATH), { recursive: true });
    const tmpPath = `${RUNTIME_STATE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, serialized);
    fs.renameSync(tmpPath, RUNTIME_STATE_PATH);
  } catch {
    try {
      fs.writeFileSync(TMP_RUNTIME_STATE_PATH, serialized);
    } catch {
      // ignore read-only environments without /tmp writable access
    }
  }
}

export function getAllQuestionsMerged(): QuestionRecord[] {
  const store = getStore();
  const runtime = readRuntimeState();
  if (!runtime.customQuestions?.length) return store.questions;
  return [...runtime.customQuestions, ...store.questions];
}

export function findQuestionById(id: number): QuestionRecord | undefined {
  const store = getStore();
  const found = store.questionsById.get(id);
  if (found) return found;
  const runtime = readRuntimeState();
  return runtime.customQuestions?.find((q) => q.id === id);
}

export function buildExamForSetId(
  setId: string,
  options?: BuildExamOptions
): { title: string; durationSec: number; passRule: 'groups' | 'overall'; items: RunnerQuestion[] } {
  const store = getStore();
  const runtime = readRuntimeState();
  const all = getAllQuestionsMerged();

  return buildExamFromSource(
    {
      allQuestions: all,
      findById: (id) => store.questionsById.get(id) || runtime.customQuestions?.find((q) => q.id === id),
      fixedIdsForSet: (sid) => runtime.customSetQuestionIds[sid] || store.setsMap.get(sid),
      setMetaForSet: (sid) =>
        runtime.customSets.find((s) => String(s.id) === sid) ||
        store.examSets.find((s) => String(s.id) === sid),
      profile: runtime.profile,
    },
    setId,
    options
  );
}

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllQuestionsMerged,
  getQuestionSearchBlob,
  getStore,
  readRuntimeState,
  writeRuntimeState,
} from '@/lib/server-db';
import { CHOICE_LABELS, HIDDEN_SUBJECT_KEYS, resolveTopicSelection, type SubjectKey } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const subject = searchParams.get('subject') || '';
  const topic = searchParams.get('topic') || '';
  const batch = searchParams.get('batch') || '';
  const query = (searchParams.get('q') || '').trim().toLowerCase();
  const hasImage = searchParams.get('hasImage') === '1';
  const rawIds = searchParams.get('ids') || '';
  const idFilterSet = rawIds
    ? new Set(
        rawIds
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n) && n > 0)
      )
    : null;
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 24)));

  const store = getStore();
  let filtered = getAllQuestionsMerged();

  if (idFilterSet) {
    filtered = filtered.filter((q) => idFilterSet.has(q.id));
  }

  if (subject) {
    filtered = filtered.filter((q) => q.subject_key === subject);
  } else if (!idFilterSet) {
    filtered = filtered.filter((q) => !HIDDEN_SUBJECT_KEYS.has(q.subject_key));
  }
  if (topic) {
    const matcher = resolveTopicSelection(topic);
    filtered = filtered.filter((q) => matcher.matches(q.title));
  }
  if (batch) {
    filtered = filtered.filter((q) => q.batch === batch);
  }
  if (hasImage) {
    filtered = filtered.filter(
      (q) =>
        Boolean(q.img) ||
        Boolean(q.explanation_img) ||
        Boolean(q.opt_imgs?.some(Boolean))
    );
  }
  if (query) {
    filtered = filtered.filter((q) => getQuestionSearchBlob(q).includes(query) || String(q.id) === query);
  }

  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  return NextResponse.json({
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    items,
    topics: subject ? store.topics.filter((t) => t.subjectKey === subject) : store.topics,
    batches: store.batches,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const stem = String(body.stem || '').trim();
  const subjectKey = String(body.subject_key || 'math') as SubjectKey;
  const opts = Array.isArray(body.opts) ? body.opts.map((v: unknown) => String(v || '').trim()) : [];
  const correctIndex = Number(body.correct_index ?? 0);

  if (!stem || opts.length < 4 || opts.some((o: string) => !o)) {
    return NextResponse.json({ error: 'กรุณากรอกโจทย์และตัวเลือกให้ครบ 4 ข้อ' }, { status: 400 });
  }

  const runtime = readRuntimeState();
  const all = getAllQuestionsMerged();
  const maxId = all.reduce((acc, q) => Math.max(acc, q.id), 15000);
  const newId = maxId + 1;

  const created = {
    id: newId,
    subject_key: subjectKey,
    set_id: body.set_id ? Number(body.set_id) : null,
    title: body.title ? String(body.title).trim() : 'เพิ่มโดยแอดมิน',
    batch: 'admin_manual',
    stem,
    img: body.img ? String(body.img).trim() : null,
    opts: opts.slice(0, 4),
    opt_imgs: null,
    correct_index: correctIndex,
    correct_label: CHOICE_LABELS[correctIndex] || 'ก',
    explanation: body.explanation ? String(body.explanation).trim() : null,
    explanation_img: null,
  };

  runtime.customQuestions = [created, ...(runtime.customQuestions || [])];
  writeRuntimeState(runtime);

  return NextResponse.json({ ok: true, question: created }, { status: 201 });
}


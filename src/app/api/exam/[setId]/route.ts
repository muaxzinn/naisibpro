import { NextRequest, NextResponse } from 'next/server';
import { buildExamForSetId, type CompletedPoolMode } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ setId: string }> }
) {
  const { setId } = await context.params;
  const { searchParams } = new URL(req.url);
  const trackName = searchParams.get('track') || undefined;
  const count = searchParams.get('count') ? Number(searchParams.get('count')) : undefined;
  const subject = searchParams.get('subject') || undefined;
  const topic = searchParams.get('topic') || undefined;
  const shuffleMode = searchParams.get('shuffle') === '1';
  const rawSet = searchParams.get('set');
  const setIndex = rawSet ? Number(rawSet) : undefined;
  const excludeParam = searchParams.get('excludeCompleted');
  const excludeCompleted =
    excludeParam === '1' ? true : excludeParam === '0' ? false : undefined;
  const rawPool = searchParams.get('pool');
  const pool: CompletedPoolMode | undefined =
    rawPool === 'correct' || rawPool === 'wrong' || rawPool === 'all' ? rawPool : undefined;
  const rawPackMode = searchParams.get('packMode');
  const packMode = rawPackMode === 'strict' ? 'strict' : rawPackMode === 'fill' ? 'fill' : undefined;
  const rawMaxTopic = searchParams.get('maxPerTopic');
  const maxPerTopic = rawMaxTopic === '2' ? 2 : rawMaxTopic === '3' ? 3 : undefined;
  const rawQid = searchParams.get('qid');
  const qid = rawQid ? Number(rawQid) : undefined;

  const result = buildExamForSetId(setId, {
    trackName,
    count,
    subject,
    topic,
    shuffleMode,
    setIndex,
    excludeCompleted,
    pool,
    packMode,
    maxPerTopic,
    qid,
  });

  return NextResponse.json({
    setId,
    ...result,
    total: result.items.length,
  });
}


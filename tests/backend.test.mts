import './register-ts.mjs';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  ACTIVE_SUBJECTS,
  HIDDEN_SUBJECT_KEYS,
  isNavItemActive,
  normalizeTopicTitleKey,
  resolveTopicSelection,
  SUBJECT_MAP,
  SUBJECTS,
  TRACKS,
} = await import('../src/lib/constants.ts');
const { safeTruncateThai } = await import('../src/lib/utf8-thai.ts');
const { computeAttemptXp, computePlayerStats, POLICE_RANKS } = await import('../src/lib/gamification.ts');
const {
  applyQuestionOutcomes,
  buildExamForSetId,
  getQuestionSearchBlob,
  getStore,
  readRuntimeState,
  resetCompletedHistory,
} = await import('../src/lib/server-db.ts');
const {
  applyRealExamOutcomes,
  buildDynamicFormPacks,
  buildExamFromSource,
  DEFAULT_EXAM_SETTINGS,
  getCompletedIdSets,
  getRealExamStatusSets,
  OFFICIAL_EXAM_SUBJECT_ORDER,
  resetRealExamHistory,
  sanitizeExamSettings,
} = await import('../src/lib/question-pool.ts');
const { REAL_EXAM_ALL_IDS, REAL_EXAM_ID_SET, REAL_EXAM_SETS } = await import(
  '../src/lib/real-exam-sets.ts'
);
const { buildSyllabusTree, computePriorityScore } = await import(
  '../src/lib/syllabus-taxonomy.ts'
);
const { isImageUrlString, normalizeLatexDelimiters } = await import(
  '../src/lib/rich-text-parser.ts'
);

test('constants: SUBJECTS, TRACKS weights, topic normalization & navigation active states', () => {
  assert.equal(SUBJECTS.length, 7);
  for (const s of SUBJECTS) {
    assert.equal(SUBJECT_MAP[s.key].name, s.name);
  }

  for (const t of TRACKS) {
    const sumWeights = Object.values(t.weights).reduce((acc, n) => acc + n, 0);
    assert.equal(sumWeights, 150, `Track ${t.name} weights should total 150`);
  }

  assert.equal(normalizeTopicTitleKey('Data & People'), normalizeTopicTitleKey('Data and People'));
  assert.equal(
    normalizeTopicTitleKey('ร้อยละ (แผนภูมิ และ กาารเปลี่ยนแปลง)'),
    normalizeTopicTitleKey('ร้อยละ (แผนภูมิและการเปลี่ยนแปลง)')
  );
  assert.equal(normalizeTopicTitleKey('วิวัฒนาการคอมพิวเตอร์'), normalizeTopicTitleKey('วิวัฒนาการคอม'));

  const matcher = resolveTopicSelection('Data & People||Data and People');
  assert.equal(matcher.displayTopic, 'Data & People');
  assert.equal(matcher.matches('Data & People'), true);
  assert.equal(matcher.matches('Data and People'), true);
  assert.equal(matcher.matches('Data   &   People'), true);
  assert.equal(matcher.matches('Word'), false);
  assert.equal(matcher.matches(null), false);

  // Desktop nav highlights /catalog/subject and /catalog/topics independently
  assert.equal(isNavItemActive('/catalog/topics', '/catalog/topics', false), true);
  assert.equal(isNavItemActive('/catalog/topics', '/catalog/subject', false), false);
  assert.equal(isNavItemActive('/catalog/form', '/catalog', false), true);
  assert.equal(isNavItemActive('/catalog/topics', '/catalog', false), false);

  // Mobile bottom nav (7 independent tabs) highlights each route individually
  assert.equal(isNavItemActive('/catalog/topics', '/catalog/topics', true), true);
  assert.equal(isNavItemActive('/catalog/topics', '/catalog/subject', true), false);
  assert.equal(isNavItemActive('/catalog/subject', '/catalog/subject', true), true);
  assert.equal(isNavItemActive('/catalog/completed', '/catalog/completed', true), true);
  assert.equal(isNavItemActive('/catalog/completed', '/catalog', true), false);
  assert.equal(isNavItemActive('/catalog/completed', '/catalog/completed', false), true);
  assert.equal(isNavItemActive('/', '/', false), true);
  assert.equal(isNavItemActive('/dashboard', '/', false), false);
});

test('utf8-thai: safeTruncateThai preserves 3-byte UTF-8 and Thai combining clusters', () => {
  assert.equal(safeTruncateThai(null, 10), '');
  assert.equal(safeTruncateThai('กขค', 10), 'กขค');

  // "น้ำ" = น (0), ำ (1), ้ (2), then "ท่วม" = ท (3)...
  // Cutting at 2 would separate น + ำ from tone mark ้, so cut backs up past combining marks
  const sample = 'น้ำท่วมหมู่บ้านตำรวจ';
  const truncated = safeTruncateThai(sample, 2);
  assert.equal(truncated.endsWith('…'), true);
  // Ensure result has no replacement char (U+FFFD) and valid UTF-8 encoding
  assert.equal(truncated.includes('\uFFFD'), false);
  const firstToneInput = 'ก้ำขำค'; // ก (0), ้ (1), ำ (2) -> cut=1 hits tone mark ้
  const cutTone = safeTruncateThai(firstToneInput, 1);
  assert.equal(cutTone, 'ก…');

  // Cutting inside combining marks on Thai words (e.g. "ที่" at index 1 or 2)
  const word = 'ที่ทำการสถานีตำรวจภูธร';
  const cutWord = safeTruncateThai(word, 2);
  // index 0='ท', 1='ี', 2='่' -> index 2 is combining mark, backs up to index 0 ('ท…')
  assert.equal(cutWord, 'ท…');
  assert.equal(Buffer.from(cutWord, 'utf8').toString('utf8'), cutWord);
});

test('gamification: XP calculation, rank tiers (Lv.1-Lv.8), daily missions & weakness sorting', () => {
  assert.equal(computeAttemptXp({ score: 15, total: 20, passed: true }), 15 * 10 + 5 * 2 + 50);
  assert.equal(computeAttemptXp({ score: 5, total: 20, passed: false }), 5 * 10 + 15 * 2 + 15);

  // Level 1 (0 XP)
  const emptyStats = computePlayerStats([], 1, [], [], '2026-11-16');
  assert.equal(emptyStats.xp, 0);
  assert.equal(emptyStats.rank.level, 1);
  assert.equal(emptyStats.nextRank?.level, 2);
  assert.equal(emptyStats.dailyMissions[0].done, false);

  // Level 8 (5000+ XP): create attempts earning > 5000 XP
  const makeAttempt = (
    id: number,
    score: number,
    total: number,
    submittedAt: string,
    perSubject: Array<{ key: 'math' | 'com' | 'law'; correct: number; total: number }>,
    perTopic: Array<{ title: string; subjectKey: 'math' | 'com' | 'law'; correct: number; total: number }>
  ) => ({
    id,
    setId: '201',
    setTitle: 'Test',
    mode: 'practice' as const,
    startedAt: submittedAt,
    submittedAt,
    durationSec: 120,
    score,
    total,
    pct: Math.round((score / total) * 100),
    passed: score / total >= 0.6,
    perSubject: perSubject.map((s) => ({ ...s, pct: Math.round((s.correct / s.total) * 100) })),
    groups: [],
    perTopic: perTopic.map((t) => ({ ...t, pct: Math.round((t.correct / t.total) * 100) })),
    wrongIndices: [],
    questionIds: [],
    answers: [],
    bookmarkedIds: [],
  });

  const highAttempts = [
    makeAttempt(
      1,
      450,
      500,
      '2026-11-16T09:00:00.000Z',
      [
        { key: 'math', correct: 2, total: 10 }, // 20% -> critical
        { key: 'law', correct: 6, total: 10 }, // 60% -> warning
        { key: 'com', correct: 9, total: 10 }, // 90% -> strong
      ],
      [
        { title: 'อนุกรม', subjectKey: 'math', correct: 1, total: 5 }, // 20%
        { title: 'Word', subjectKey: 'com', correct: 5, total: 5 }, // 100%
      ]
    ),
    makeAttempt(2, 100, 100, '2026-11-15T09:00:00.000Z', [], []),
  ];

  const highStats = computePlayerStats(highAttempts, 5, [], [1, 2, 3, 4, 5], '2026-11-16');
  assert.ok(highStats.xp >= POLICE_RANKS[POLICE_RANKS.length - 1].minXp);
  assert.equal(highStats.rank.level, 8);
  assert.equal(highStats.nextRank, null);
  assert.equal(highStats.levelProgressPct, 100);
  assert.equal(highStats.weakestSubjects[0].key, 'math');
  assert.equal(highStats.weakestSubjects[0].status, 'critical');
  assert.equal(highStats.weakestSubjects[1].status, 'warning');
  assert.equal(highStats.weakestSubjects[2].status, 'strong');
  assert.equal(highStats.weakestTopics[0].title, 'อนุกรม');
  assert.equal(highStats.dailyMissions[0].done, true);
  assert.equal(highStats.dailyMissions[1].done, true);
  assert.equal(highStats.dailyMissions[2].done, true);
});

test('server-db: dataset completeness, zero raw URLs, valid SVGs on disk & buildExamForSetId', () => {
  const store = getStore();
  assert.ok(store.questions.length >= 7038, `Expected >= 7038 questions, got ${store.questions.length}`);
  assert.equal(store.topics.length, 132);
  assert.equal(store.examSets.length, 22);
  assert.ok(store.imageCount >= 551, `Expected >= 551 images, got ${store.imageCount}`);

  const svgDir = path.join(process.cwd(), 'public');
  for (const q of store.questions) {
    assert.equal(isImageUrlString(q.stem), false, `Question #${q.id} still has raw image URL in stem: ${q.stem}`);
    for (let i = 0; i < q.opts.length; i++) {
      assert.equal(
        isImageUrlString(q.opts[i]),
        false,
        `Question #${q.id} opt[${i}] still has raw image URL: ${q.opts[i]}`
      );
    }
    assert.equal(
      isImageUrlString(q.explanation),
      false,
      `Question #${q.id} still has raw image URL in explanation`
    );

    const mediaRefs = [q.img, q.explanation_img, ...(q.opt_imgs || [])].filter(
      (u): u is string => Boolean(u)
    );
    for (const ref of mediaRefs) {
      assert.equal(
        /^https?:\/\//i.test(ref),
        false,
        `Question #${q.id} should not reference external image URL: ${ref}`
      );
      assert.ok(ref.startsWith('/question-svgs/'), `Expected /question-svgs/ path in #${q.id}, got ${ref}`);
      const fullPath = path.join(svgDir, ref.slice(1));
      assert.equal(fs.existsSync(fullPath), true, `Missing SVG on disk for #${q.id}: ${fullPath}`);
    }
  }

  // Fixed set 201 (150 items) & 107 (20 items)
  const set201 = buildExamForSetId('201');
  assert.equal(set201.items.length, 150);
  assert.equal(set201.passRule, 'groups');
  assert.equal(set201.durationSec, 180 * 60);

  const set107 = buildExamForSetId('107');
  assert.equal(set107.items.length, 20);
  assert.ok(set107.items.every((item) => item.subject === 'soc'));

  // Subject filter on multi-subject set
  const set201Math = buildExamForSetId('201', { subject: 'math' });
  assert.equal(set201Math.items.length, 20);
  assert.ok(set201Math.items.every((item) => item.subject === 'math'));

  // Disjoint sequential subject sets
  const lawSet1 = buildExamForSetId('subject-law', { setIndex: 1, count: 20 });
  const lawSet2 = buildExamForSetId('subject-law', { setIndex: 2, count: 20 });
  assert.equal(lawSet1.items.length, 20);
  assert.equal(lawSet2.items.length, 20);
  assert.ok(lawSet1.items.every((q) => q.subject === 'law'));
  assert.ok(lawSet2.items.every((q) => q.subject === 'law'));
  const law1Ids = new Set(lawSet1.items.map((q) => q.id));
  for (const item of lawSet2.items) {
    assert.equal(law1Ids.has(item.id), false, 'subject-law set 1 and set 2 must be disjoint');
  }

  // Sub-topic ordered drill
  const comWord = buildExamForSetId('topic', { subject: 'com', topic: 'Word', setIndex: 1, count: 20 });
  assert.equal(comWord.items.length, 20);
  assert.ok(comWord.items.every((q) => q.subject === 'com'));
  assert.ok(comWord.title.includes('ชุดที่ 1'));

  // Multi-variant topic drill
  const comData = buildExamForSetId('topic', {
    subject: 'com',
    topic: 'Data & People||Data and People',
    setIndex: 1,
    count: 50,
  });
  assert.ok(comData.items.length > 0);
  assert.ok(comData.items.every((q) => q.subject === 'com'));

  // Track-weighted random mock (full 150 matches TRACKS[0] exact subject weights)
  const randFull = buildExamForSetId('random-0');
  assert.equal(randFull.items.length, 150);
  const weightCounts: Record<string, number> = {};
  for (const q of randFull.items) {
    weightCounts[q.subject] = (weightCounts[q.subject] || 0) + 1;
  }
  for (const [sk, expectedCount] of Object.entries(TRACKS[0].weights)) {
    assert.equal(
      weightCounts[sk] || 0,
      expectedCount,
      `Expected ${expectedCount} questions for ${sk} in random-0`
    );
  }

  // Track-weighted random mock with explicit count
  const rand25 = buildExamForSetId('random-0', { count: 25 });
  assert.equal(rand25.items.length, 25);
});

test('question-pool: outcomes tracking, deduplication (excludeCompleted), completed-* builders & reset', () => {
  const store = getStore();
  const comWordIds = store.questions
    .filter((q) => q.subject_key === 'com' && q.title === 'Word')
    .slice(0, 5)
    .map((q) => q.id);
  const mathIds = store.questions
    .filter((q) => q.subject_key === 'math')
    .slice(0, 3)
    .map((q) => q.id);
  assert.equal(comWordIds.length, 5);
  assert.equal(mathIds.length, 3);

  const profile: { bookmarks: number[]; mistakeIds: number[]; correctIds: number[] } = {
    bookmarks: [],
    mistakeIds: [],
    correctIds: [],
  };

  // Mark 3 com/Word correct, 2 com/Word wrong, 3 math correct
  applyQuestionOutcomes(profile, [
    { id: comWordIds[0], correct: true },
    { id: comWordIds[1], correct: true },
    { id: comWordIds[2], correct: true },
    { id: comWordIds[3], correct: false },
    { id: comWordIds[4], correct: false },
    ...mathIds.map((id) => ({ id, correct: true })),
  ]);

  let sets = getCompletedIdSets(profile);
  assert.equal(sets.correctSet.size, 6);
  assert.equal(sets.mistakeSet.size, 2);
  assert.equal(sets.allCompletedSet.size, 8);

  // Retry wrong question -> answer correctly -> moves from mistakeIds to correctIds automatically
  applyQuestionOutcomes(profile, [{ id: comWordIds[3], correct: true }]);
  sets = getCompletedIdSets(profile);
  assert.equal(sets.correctSet.size, 7);
  assert.equal(sets.mistakeSet.size, 1);
  assert.equal(sets.mistakeSet.has(comWordIds[3]), false);
  assert.equal(sets.correctSet.has(comWordIds[3]), true);

  // Re-answer correct question wrongly -> moves back to mistakeIds
  applyQuestionOutcomes(profile, [{ id: comWordIds[0], correct: false }]);
  sets = getCompletedIdSets(profile);
  assert.equal(sets.correctSet.size, 6);
  assert.equal(sets.mistakeSet.size, 2);

  const source = {
    allQuestions: store.questions,
    findById: (id: number) => store.questionsById.get(id),
    fixedIdsForSet: (sid: string) => store.setsMap.get(sid),
    setMetaForSet: (sid: string) => store.examSets.find((s) => String(s.id) === sid),
    profile,
  };

  // Normal topic with excludeCompleted=true excludes all 5 answered com/Word items
  const filteredWord = buildExamFromSource(source, 'topic', {
    subject: 'com',
    topic: 'Word',
    setIndex: 1,
    count: 50,
    excludeCompleted: true,
  });
  for (const item of filteredWord.items) {
    assert.equal(comWordIds.includes(item.id), false, `Completed #${item.id} must be excluded`);
  }

  // Normal subject with excludeCompleted=true excludes all completed math IDs
  const filteredMath = buildExamFromSource(source, 'subject-math', {
    count: 150,
    setIndex: 1,
    excludeCompleted: true,
  });
  for (const item of filteredMath.items) {
    assert.equal(mathIds.includes(item.id), false, `Completed math #${item.id} must be excluded`);
  }

  // Completed-pool builders across all 3 structures & all 3 pool filters
  const compFormAll = buildExamFromSource(source, 'completed-form', { pool: 'all', setIndex: 1 });
  assert.equal(compFormAll.items.length, 8);
  const compFormCorrect = buildExamFromSource(source, 'completed-form', { pool: 'correct', setIndex: 1 });
  assert.equal(compFormCorrect.items.length, 6);
  const compFormWrong = buildExamFromSource(source, 'completed-form', { pool: 'wrong', setIndex: 1 });
  assert.equal(compFormWrong.items.length, 2);

  const compSubjCom = buildExamFromSource(source, 'completed-subject', {
    pool: 'all',
    subject: 'com',
    setIndex: 1,
  });
  assert.equal(compSubjCom.items.length, 5);
  assert.ok(compSubjCom.items.every((q) => q.subject === 'com'));

  const compTopicWordWrong = buildExamFromSource(source, 'completed-topic', {
    pool: 'wrong',
    subject: 'com',
    topic: 'Word',
    setIndex: 1,
  });
  assert.equal(compTopicWordWrong.items.length, 2);

  // Scoped resets
  resetCompletedHistory(profile, { scope: 'topic', subject: 'com', topic: 'Word', pool: 'wrong' }, store.questions);
  assert.equal(getCompletedIdSets(profile).mistakeSet.size, 0);
  assert.equal(getCompletedIdSets(profile).correctSet.size, 6);

  resetCompletedHistory(profile, { scope: 'subject', subject: 'math', pool: 'all' }, store.questions);
  assert.equal(getCompletedIdSets(profile).correctSet.size, 3); // only 3 com/Word left

  resetCompletedHistory(profile, { scope: 'all', pool: 'all' }, store.questions);
  assert.equal(getCompletedIdSets(profile).allCompletedSet.size, 0);
});

test('server-db: cached subTopicsCatalog, getQuestionSearchBlob & lazy readRuntimeState', () => {
  const store = getStore();
  assert.ok(store.subTopicsCatalog, 'Store should pre-compute subTopicsCatalog');
  assert.equal(Object.keys(store.subTopicsCatalog.topicsBySubject).length, 7);
  const catalogQuestionCount = Object.values(store.subTopicsCatalog.subjectTotals).reduce(
    (sum, n) => sum + n,
    0
  );
  assert.ok(catalogQuestionCount >= 7038, `Expected >= 7038 questions in cached catalog, got ${catalogQuestionCount}`);

  const sample = store.questions[0];
  const blob = getQuestionSearchBlob(sample);
  assert.ok(blob.includes(String(sample.id)));
  if (sample.stem) {
    assert.ok(blob.includes(sample.stem.toLowerCase()));
  }

  const runtime = readRuntimeState();
  assert.ok(runtime.profile && typeof runtime.profile.track === 'string');
  assert.ok(Array.isArray(runtime.leaderboard) && runtime.leaderboard.length > 0);
});

test('question-pool: dynamic 150-repack (fill vs strict) & review vault builders', () => {
  const store = getStore();
  const nonRealTotal = store.questions.filter(
    (q) => !REAL_EXAM_ID_SET.has(q.id) && !HIDDEN_SUBJECT_KEYS.has(q.subject_key)
  ).length;
  const completedIds = store.questions
    .filter((q) => !REAL_EXAM_ID_SET.has(q.id) && !HIDDEN_SUBJECT_KEYS.has(q.subject_key))
    .slice(0, 120)
    .map((q) => q.id);
  const completedSet = new Set(completedIds);
  assert.equal(ACTIVE_SUBJECTS.length, 6);
  assert.equal(HIDDEN_SUBJECT_KEYS.has('soc'), true);

  // Fill mode: full sets are strictly 150, remainder < 150, zero overlap, 100% conservation (excluding 450 real-exam)
  const fillPacks = buildDynamicFormPacks(store.questions, completedSet, {
    packMode: 'fill',
    trackName: TRACKS[0].name,
    chunkSize: 150,
  });
  assert.ok(fillPacks.fullSets.length > 0);
  const seenFill = new Set<number>();
  for (const pack of fillPacks.fullSets) {
    assert.equal(pack.total, 150);
    for (const id of pack.ids) {
      assert.equal(REAL_EXAM_ID_SET.has(id), false, 'Real-exam ID leaked into repack');
      assert.equal(completedSet.has(id), false, 'Completed ID leaked into repack');
      assert.equal(seenFill.has(id), false, 'Duplicate ID across repacked sets');
      seenFill.add(id);
    }
  }
  if (fillPacks.remainderSet) {
    assert.ok(fillPacks.remainderSet.total > 0);
    for (const id of fillPacks.remainderSet.ids) {
      assert.equal(REAL_EXAM_ID_SET.has(id), false, 'Real-exam ID leaked into remainder');
      assert.equal(seenFill.has(id), false);
      seenFill.add(id);
    }
  }
  assert.equal(seenFill.size + fillPacks.completedCount, nonRealTotal);

  // Strict mode: every full set satisfies exact track weights
  const strictPacks = buildDynamicFormPacks(store.questions, completedSet, {
    packMode: 'strict',
    trackName: TRACKS[0].name,
    chunkSize: 150,
  });
  assert.ok(strictPacks.fullSets.length > 0);
  for (const pack of strictPacks.fullSets) {
    assert.equal(pack.total, 150);
    assert.equal(pack.isTrackExact, true);
  }
  const strictCounted =
    strictPacks.fullSets.reduce((sum, p) => sum + p.total, 0) +
    (strictPacks.remainderSet?.total || 0) +
    strictPacks.completedCount;
  assert.equal(strictCounted, nonRealTotal);

  // Build repack-form & review vault exam sets
  const sampleBookmarks = [
    ...store.questions.filter((q) => q.subject_key === 'math').slice(0, 4).map((q) => q.id),
    ...store.questions
      .filter((q) => q.subject_key === 'com' && (q.title || '').includes('Word'))
      .slice(0, 3)
      .map((q) => q.id),
  ];
  const source = {
    allQuestions: store.questions,
    findById: (id: number) => store.questionsById.get(id),
    fixedIdsForSet: (sid: string) => store.setsMap.get(sid),
    setMetaForSet: (sid: string) => store.examSets.find((s) => String(s.id) === sid),
    profile: {
      correctIds: completedIds,
      mistakeIds: [],
      bookmarks: sampleBookmarks,
      excludeCompleted: true,
    },
  };

  const repackedSet1 = buildExamFromSource(source, 'repack-form', {
    setIndex: 1,
    packMode: 'fill',
    trackName: TRACKS[0].name,
  });
  assert.equal(repackedSet1.items.length, 150);
  assert.ok(repackedSet1.items.every((q) => !completedSet.has(q.id)));

  const reviewAll = buildExamFromSource(source, 'review-form', { setIndex: 1, count: 20 });
  assert.equal(reviewAll.items.length, 7);

  const reviewMath = buildExamFromSource(source, 'review-subject', { subject: 'math' });
  assert.equal(reviewMath.items.length, 4);
  assert.ok(reviewMath.items.every((q) => q.subject === 'math'));

  const reviewWord = buildExamFromSource(source, 'review-topic', {
    subject: 'com',
    topic: 'Word',
  });
  assert.equal(reviewWord.items.length, 3);

  const reviewSingle = buildExamFromSource(source, 'bookmarks', { qid: sampleBookmarks[0] });
  assert.equal(reviewSingle.items.length, 1);
  assert.equal(reviewSingle.items[0].id, sampleBookmarks[0]);
});

test('real-exam-sets: 4 fixed sets (exact 1-150 order, >=2/sub-topic), isolation & auto-fill mix 150 loop', () => {
  const store = getStore();
  assert.equal(REAL_EXAM_SETS.length, 4);
  assert.equal(REAL_EXAM_ALL_IDS.length, REAL_EXAM_ID_SET.size);
  assert.ok(REAL_EXAM_ALL_IDS.length >= 600);

  // Verify exact official 1-150 subject order for Sets 1, 2, 3:
  // 1-20 math, 21-40 thai, 41-80 com, 81-110 doc, 111-135 law, 136-150 eng
  const officialRanges: Array<[number, number, string]> = [
    [0, 20, 'math'],
    [20, 40, 'thai'],
    [40, 80, 'com'],
    [80, 110, 'doc'],
    [110, 135, 'law'],
    [135, 150, 'eng'],
  ];
  for (let s = 0; s < 3; s++) {
    const ids = REAL_EXAM_SETS[s].questionIds;
    assert.equal(ids.length, 150, `Set ${s + 1} must be 150 questions`);
    for (const [start, end, expectedSubj] of officialRanges) {
      for (let i = start; i < end; i++) {
        const q = store.questionsById.get(ids[i]);
        assert.ok(q, `Missing question #${ids[i]}`);
        assert.equal(
          q.subject_key,
          expectedSubj,
          `Set ${s + 1} Q#${i + 1} expected ${expectedSubj}, got ${q.subject_key}`
        );
      }
    }
  }

  // Verify >= 2 questions per sub-topic across Sets 1-3
  const subCounts = new Map<string, number>();
  for (const s of REAL_EXAM_SETS.slice(0, 3)) {
    for (const id of s.questionIds) {
      const q = store.questionsById.get(id)!;
      const key = `${q.subject_key}:${normalizeTopicTitleKey((q.title || 'อื่นๆ').trim())}`;
      subCounts.set(key, (subCounts.get(key) || 0) + 1);
    }
  }
  assert.ok(subCounts.size >= 100);
  for (const [k, c] of subCounts) {
    assert.ok(c >= 2, `Sub-topic ${k} has only ${c} questions across Sets 1-3`);
  }

  const profile = {
    correctIds: [] as number[],
    mistakeIds: [] as number[],
    realExamCorrectIds: [] as number[],
    realExamMistakeIds: [] as number[],
    bookmarks: [] as number[],
    excludeCompleted: true,
  };

  // Mark 30 wrong + rest correct inside the real-exam pool
  const outcomes = REAL_EXAM_ALL_IDS.map((id, idx) => ({
    id,
    correct: idx >= 30,
  }));
  applyRealExamOutcomes(profile, outcomes);

  const status = getRealExamStatusSets(profile);
  assert.equal(status.realCorrectSet.size, REAL_EXAM_ALL_IDS.length - 30);
  assert.equal(status.realMistakeSet.size, 30);
  // Main pool must remain completely untouched
  assert.equal(profile.correctIds.length, 0);
  assert.equal(profile.mistakeIds.length, 0);

  const source = {
    allQuestions: store.questions,
    findById: (id: number) => store.questionsById.get(id),
    fixedIdsForSet: (sid: string) => store.setsMap.get(sid),
    setMetaForSet: (sid: string) => store.examSets.find((s) => String(s.id) === sid),
    profile,
  };

  const set1 = buildExamFromSource(source, 'real-1');
  assert.equal(set1.items.length, 150);

  const set4 = buildExamFromSource(source, 'real-4');
  assert.equal(set4.items.length, REAL_EXAM_SETS[3].questionIds.length);

  const onlyMistakes = buildExamFromSource(source, 'real-mistakes');
  assert.equal(onlyMistakes.items.length, 30);

  const realCompletedWrong = buildExamFromSource(source, 'real-completed', { pool: 'wrong' });
  assert.equal(realCompletedWrong.items.length, 30);

  // Pagination on real-completed (set=1 vs set=2 with count=12)
  const realCompPage1 = buildExamFromSource(source, 'real-completed', {
    pool: 'wrong',
    setIndex: 1,
    count: 12,
  });
  const realCompPage2 = buildExamFromSource(source, 'real-completed', {
    pool: 'wrong',
    setIndex: 2,
    count: 12,
  });
  assert.equal(realCompPage1.items.length, 12);
  assert.equal(realCompPage2.items.length, 12);
  const p1Set = new Set(realCompPage1.items.map((q) => q.id));
  assert.ok(realCompPage2.items.every((q) => !p1Set.has(q.id)), 'Paginated real-completed sets must not overlap');

  // Sequential sub-sets on real-mix (`set=1` vs `set=2` for subject=com)
  const realComSet1 = buildExamFromSource(source, 'real-mix', {
    subject: 'com',
    setIndex: 1,
    count: 15,
    excludeCompleted: false,
  });
  const realComSet2 = buildExamFromSource(source, 'real-mix', {
    subject: 'com',
    setIndex: 2,
    count: 15,
    excludeCompleted: false,
  });
  assert.equal(realComSet1.items.length, 15);
  assert.equal(realComSet2.items.length, 15);
  const com1Set = new Set(realComSet1.items.map((q) => q.id));
  assert.ok(realComSet2.items.every((q) => !com1Set.has(q.id)), 'Sequential real-mix sub-sets must not overlap');

  // Auto-fill mix 150: must include all 30 wrong + 120 topped up from correct in the 4 sets = 150 total
  const mix150 = buildExamFromSource(source, 'real-mix');
  assert.equal(mix150.items.length, 150);
  const mixIdSet = new Set(mix150.items.map((q) => q.id));
  for (const wrongId of REAL_EXAM_ALL_IDS.slice(0, 30)) {
    assert.equal(mixIdSet.has(wrongId), true, `Wrong real-exam #${wrongId} must be prioritized in real-mix`);
  }
  assert.ok(mix150.items.every((q) => REAL_EXAM_ID_SET.has(q.id)));

  // Scoped reset with target='real-exam' must NOT touch practice pool (`correctIds` / `mistakeIds`)
  profile.correctIds = [999001, 999002];
  profile.mistakeIds = [999003];
  resetCompletedHistory(
    profile,
    { scope: 'subject', subject: 'math', pool: 'wrong', target: 'real-exam' },
    store.questions
  );
  assert.deepEqual(profile.correctIds, [999001, 999002]);
  assert.deepEqual(profile.mistakeIds, [999003]);
  assert.ok(getRealExamStatusSets(profile).realMistakeSet.size < 30);

  resetCompletedHistory(
    profile,
    { scope: 'all', pool: 'all', target: 'real-exam' },
    store.questions
  );
  assert.equal(getRealExamStatusSets(profile).realAttemptedSet.size, 0);
  assert.deepEqual(profile.correctIds, [999001, 999002]);

  // Reset only real-exam history helper
  resetRealExamHistory(profile);
  assert.equal(getRealExamStatusSets(profile).realAttemptedSet.size, 0);
});

test('syllabus-taxonomy: 7-group COURSE_SYLLABUS mapping conservation & priority scoring', () => {
  const store = getStore();
  const activeQuestions = store.questions.filter(
    (q) => !HIDDEN_SUBJECT_KEYS.has(q.subject_key)
  );
  const tree = buildSyllabusTree(activeQuestions);

  assert.equal(tree.length, 7);
  const groupKeys = tree.map((g) => g.groupKey);
  assert.deepEqual(groupKeys, ['math', 'thai', 'eng', 'com', 'law', 'doc-general', 'doc-54']);

  // 100% conservation: every active question belongs to exactly one group & chapter
  const groupedCount = tree.reduce((sum, g) => sum + g.questionIds.length, 0);
  assert.equal(groupedCount, activeQuestions.length);

  const chapterSum = tree.reduce(
    (sum, g) => sum + g.chapters.reduce((s, ch) => s + ch.questionIds.length, 0),
    0
  );
  assert.equal(chapterSum, activeQuestions.length);

  // doc-general and doc-54 both have questions
  const docGen = tree.find((g) => g.groupKey === 'doc-general')!;
  const doc54 = tree.find((g) => g.groupKey === 'doc-54')!;
  assert.ok(docGen.questionIds.length > 0 && doc54.questionIds.length > 0);

  // Priority scoring: higher examWeight & lower accuracy outranks lower weight & higher accuracy
  const highUrgency = computePriorityScore(30, 12, 40);
  const lowUrgency = computePriorityScore(85, 2, 15);
  assert.ok(highUrgency > lowUrgency);
  assert.equal(computePriorityScore(100, 0, 40), 0);
});

test('ocr-audit: zero <page_number, unclosed <table>, unclosed $$, or legacy GuruPolice across all 7,038 questions', () => {
  const store = getStore();
  for (const q of store.questions) {
    const fields: Array<[string, string]> = [
      ['stem', q.stem || ''],
      ['explanation', q.explanation || ''],
      ...(q.opts || []).map((o, idx): [string, string] => [`opt[${idx}]`, o || '']),
    ];
    for (const [label, val] of fields) {
      assert.equal(
        /page_number|<page/i.test(val),
        false,
        `Question #${q.id} (${label}) still contains OCR <page_number artifact: ${val}`
      );
      assert.equal(
        /gurupolice/i.test(val),
        false,
        `Question #${q.id} (${label}) still contains legacy GuruPolice string`
      );
      const openTables = (val.match(/<table\b/gi) || []).length;
      const closeTables = (val.match(/<\/table>/gi) || []).length;
      assert.equal(
        openTables,
        closeTables,
        `Question #${q.id} (${label}) has unbalanced <table> tags (${openTables} vs ${closeTables})`
      );
      const dblDollars = (val.match(/\$\$/g) || []).length;
      assert.equal(
        dblDollars % 2,
        0,
        `Question #${q.id} (${label}) has unclosed $$ math block`
      );
    }
  }

  for (const fixedId of [8883, 8889, 8892, 13515]) {
    const q = store.questionsById.get(fixedId);
    assert.ok(q && (q.explanation || '').length >= 40, `Expected full explanation on #${fixedId}`);
  }

  // Defensive parser test for future user-added content
  const sanitized = normalizeLatexDelimiters('17<page_number\n<table><tr><td>A');
  assert.equal(sanitized.includes('page_number'), false);
  assert.equal(sanitized.endsWith('</table>'), true);
});

test('sub-topic mixing & examSettings: strict <= 2-3 cap per sub-topic across repack, fixed sets, random & subject sets', () => {
  const store = getStore();
  const rankMap = new Map(OFFICIAL_EXAM_SUBJECT_ORDER.map((sk, idx) => [sk, idx]));

  const assertMaxTopicAndOrder = (
    ids: number[],
    maxAllowed: number,
    label: string,
    checkSubjectOrder = true
  ) => {
    const counts = new Map<string, number>();
    let prevRank = -1;
    let prevSubjTopic = '';
    for (const id of ids) {
      const q = store.questionsById.get(id)!;
      assert.ok(q, `${label}: missing question #${id}`);
      assert.equal(REAL_EXAM_ID_SET.has(id), false, `${label}: real-exam ID #${id} leaked`);
      assert.equal(HIDDEN_SUBJECT_KEYS.has(q.subject_key), false, `${label}: hidden subject leaked`);

      const key = `${q.subject_key}::${normalizeTopicTitleKey(q.title || 'อื่นๆ')}`;
      const nextCount = (counts.get(key) || 0) + 1;
      counts.set(key, nextCount);
      assert.ok(
        nextCount <= maxAllowed,
        `${label}: sub-topic ${key} appeared ${nextCount} times (exceeds max ${maxAllowed})`
      );

      if (checkSubjectOrder) {
        const r = rankMap.get(q.subject_key) ?? 99;
        assert.ok(
          r >= prevRank,
          `${label}: subject order violated (${q.subject_key} after rank ${prevRank})`
        );
        prevRank = r;
      }

      // Ensure no 2 consecutive questions share the exact same sub-topic when >1 sub-topic exists
      assert.notEqual(
        key,
        prevSubjTopic,
        `${label}: consecutive duplicate sub-topic ${key} at question #${id}`
      );
      prevSubjTopic = key;
    }
  };

  // 1. Dynamic repack with maxPerTopic = 3 (27 full sets) & maxPerTopic = 2 (20 full sets)
  const packsCap3 = buildDynamicFormPacks(store.questions, new Set(), {
    packMode: 'fill',
    maxPerTopic: 3,
    trackName: TRACKS[0].name,
  });
  assert.ok(packsCap3.fullSets.length >= 25);
  for (const pack of packsCap3.fullSets) {
    assert.equal(pack.ids.length, 150);
    assertMaxTopicAndOrder(pack.ids, 3, `repack-cap3-set-${pack.setIndex}`);
  }

  const packsCap2 = buildDynamicFormPacks(store.questions, new Set(), {
    packMode: 'fill',
    maxPerTopic: 2,
    trackName: TRACKS[0].name,
  });
  assert.ok(packsCap2.fullSets.length >= 18);
  for (const pack of packsCap2.fullSets) {
    assert.equal(pack.ids.length, 150);
    assertMaxTopicAndOrder(pack.ids, 2, `repack-cap2-set-${pack.setIndex}`);
  }

  // 2. Fixed standard sets 201..215 and 101..106
  for (let sid = 201; sid <= 215; sid++) {
    const ids = store.setsMap.get(String(sid)) || [];
    assert.equal(ids.length, 150);
    assertMaxTopicAndOrder(ids, 3, `fixed-set-${sid}`);
  }
  for (let sid = 101; sid <= 106; sid++) {
    const ids = store.setsMap.get(String(sid)) || [];
    assert.equal(ids.length, 20);
    assertMaxTopicAndOrder(ids, 3, `fixed-subject-set-${sid}`, false);
  }

  // 3. Random mock exam & sequential subject sets honor profile.examSettings.maxPerTopic
  const customSettings = sanitizeExamSettings(
    { maxPerTopic: 2, packMode: 'fill', viewMode: 'repack', workspaceMode: 'real-exam' },
    DEFAULT_EXAM_SETTINGS
  );
  assert.equal(customSettings.maxPerTopic, 2);
  assert.equal(customSettings.workspaceMode, 'real-exam');
  assert.equal(sanitizeExamSettings(null).maxPerTopic, 3);

  const sourceCap2 = {
    allQuestions: store.questions,
    findById: (id: number) => store.questionsById.get(id),
    fixedIdsForSet: (sid: string) => store.setsMap.get(sid),
    setMetaForSet: (sid: string) => store.examSets.find((s) => String(s.id) === sid),
    profile: {
      correctIds: [],
      mistakeIds: [],
      bookmarks: [],
      excludeCompleted: true,
      examSettings: customSettings,
    },
  };

  const randCap2 = buildExamFromSource(sourceCap2, 'random-0');
  assert.equal(randCap2.items.length, 150);
  assertMaxTopicAndOrder(
    randCap2.items.map((q) => q.id),
    2,
    'random-0-cap2'
  );

  const mathSubjSet1 = buildExamFromSource(sourceCap2, 'subject-math', { setIndex: 1, count: 20 });
  assert.equal(mathSubjSet1.items.length, 20);
  assertMaxTopicAndOrder(
    mathSubjSet1.items.map((q) => q.id),
    2,
    'subject-math-set1-cap2',
    false
  );
});

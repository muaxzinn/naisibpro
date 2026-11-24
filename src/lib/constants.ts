export type SubjectKey = 'math' | 'thai' | 'eng' | 'com' | 'doc' | 'law' | 'soc';
export type BrandKey = 'blue' | 'red' | 'orange' | 'yellow' | 'brown';
export type ThemeMode = 'light' | 'dark';

export interface SubjectMeta {
  key: SubjectKey;
  name: string;
  shortName: string;
  color: string;
  grp: 'general' | 'specific';
  setId: number;
}

export const SUBJECTS: SubjectMeta[] = [
  { key: 'math', name: 'ความสามารถทั่วไป', shortName: 'ความสามารถทั่วไป', color: '#14b8a6', grp: 'general', setId: 101 },
  { key: 'thai', name: 'ภาษาไทย', shortName: 'ภาษาไทย', color: '#6366f1', grp: 'general', setId: 102 },
  { key: 'eng', name: 'ภาษาอังกฤษ', shortName: 'ภาษาอังกฤษ', color: '#0ea5e9', grp: 'specific', setId: 103 },
  { key: 'com', name: 'คอมพิวเตอร์', shortName: 'คอมพิวเตอร์', color: '#f59e0b', grp: 'specific', setId: 104 },
  { key: 'doc', name: 'งานสารบรรณ + ลักษณะที่ 54', shortName: 'สารบรรณฯ', color: '#ec4899', grp: 'specific', setId: 105 },
  { key: 'law', name: 'กฎหมาย', shortName: 'กฎหมาย', color: '#0891b2', grp: 'specific', setId: 106 },
  { key: 'soc', name: 'สังคม', shortName: 'สังคม', color: '#16a34a', grp: 'specific', setId: 107 },
];

export const SUBJECT_MAP: Record<SubjectKey, SubjectMeta> = Object.fromEntries(
  SUBJECTS.map((s) => [s.key, s])
) as Record<SubjectKey, SubjectMeta>;

// Reversible subject visibility toggle: keep 'soc' data intact in dataset, hide from active UI/pools for now.
export const HIDDEN_SUBJECT_KEYS: ReadonlySet<SubjectKey> = new Set<SubjectKey>(['soc']);

export const ACTIVE_SUBJECTS: SubjectMeta[] = SUBJECTS.filter(
  (s) => !HIDDEN_SUBJECT_KEYS.has(s.key)
);

export function isSubjectHidden(key: SubjectKey): boolean {
  return HIDDEN_SUBJECT_KEYS.has(key);
}

export interface TrackMeta {
  id: number;
  name: string;
  shortName: string;
  subjects: SubjectKey[];
  weights: Record<SubjectKey, number>;
  examDateLabel: string;
  examDateIso: string;
  quotaLabel: string;
}

export const TRACKS: TrackMeta[] = [
  {
    id: 0,
    name: 'สายอำนวยการ / พิสูจน์หลักฐาน',
    shortName: 'อำนวยการ / พฐ.',
    subjects: ['math', 'thai', 'com', 'doc', 'law', 'eng'],
    weights: { math: 20, thai: 20, com: 40, doc: 30, law: 25, eng: 15, soc: 0 },
    examDateLabel: '29 พ.ย. 2569',
    examDateIso: '2026-11-29T01:30:00.000Z',
    quotaLabel: '900 อัตรา (อำนวยการ 800 · พฐ. 100)',
  },
  {
    id: 1,
    name: 'ปราบปราม (บุคคลทั่วไป)',
    shortName: 'ปราบปราม ทั่วไป',
    subjects: ['math', 'thai', 'eng', 'com', 'law', 'soc'],
    weights: { math: 30, thai: 25, doc: 0, com: 25, law: 20, eng: 30, soc: 20 },
    examDateLabel: '17 ม.ค. 2570',
    examDateIso: '2027-01-17T01:30:00.000Z',
    quotaLabel: 'เปิดรับประจำปี 2570',
  },
  {
    id: 2,
    name: 'ปราบปราม (ทหารเกณฑ์)',
    shortName: 'ปราบปราม ทหารเกณฑ์',
    subjects: ['math', 'thai', 'eng', 'com', 'law', 'soc'],
    weights: { math: 25, thai: 25, doc: 0, com: 25, law: 30, eng: 25, soc: 20 },
    examDateLabel: '17 ม.ค. 2570',
    examDateIso: '2027-01-17T01:30:00.000Z',
    quotaLabel: 'โควตาทหารกองหนุน 2570',
  },
];

export const BRAND_PALETTES: Array<{
  key: BrandKey;
  label: string;
  dot: string;
  gradient: string;
}> = [
  { key: 'blue', label: 'น้ำเงิน', dot: '#1d4ed8', gradient: 'linear-gradient(135deg, #2563eb, #1e40af)' },
  { key: 'red', label: 'แดง', dot: '#e60707', gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)' },
  { key: 'orange', label: 'ส้ม', dot: '#ea580c', gradient: 'linear-gradient(135deg, #f97316, #c2410c)' },
  { key: 'yellow', label: 'เหลือง', dot: '#a16207', gradient: 'linear-gradient(135deg, #eab308, #854d0e)' },
  { key: 'brown', label: 'น้ำตาล', dot: '#92400e', gradient: 'linear-gradient(135deg, #b45309, #78350f)' },
];

export const CHOICE_LABELS = ['ก', 'ข', 'ค', 'ง'] as const;
export const AWAY_TIMEOUT_MINUTES = 15;

export function normalizeTopicTitleKey(title: string): string {
  return title
    .replace(/\s+/g, '')
    .replace(/&/g, 'and')
    .replace(/กาาร/g, 'การ')
    .replace(/คอมพิวเตอร์/g, 'คอม')
    .toLowerCase();
}

export function resolveTopicSelection(requestedTopic?: string): {
  displayTopic: string;
  matches: (qTitle?: string | null) => boolean;
} {
  if (!requestedTopic || !requestedTopic.trim()) {
    return { displayTopic: 'รวม', matches: () => true };
  }
  const parts = requestedTopic
    .split('||')
    .map((p) => p.trim())
    .filter(Boolean);
  const displayTopic = parts[0] || requestedTopic.trim();
  const exactSet = new Set(parts);
  const normSet = new Set(parts.map(normalizeTopicTitleKey));

  return {
    displayTopic,
    matches: (qTitle?: string | null) => {
      if (!qTitle) return false;
      if (exactSet.has(qTitle)) return true;
      return normSet.has(normalizeTopicTitleKey(qTitle));
    },
  };
}

export function isNavItemActive(
  pathname: string,
  href: string,
  _isMobileBottom = false
): boolean {
  if (href === '/') return pathname === '/';
  if (href === '/catalog') {
    return pathname === '/catalog' || pathname.startsWith('/catalog/form');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}


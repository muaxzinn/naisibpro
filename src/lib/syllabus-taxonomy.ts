import { normalizeTopicTitleKey, type SubjectKey } from './constants';

export type SyllabusGroupKey =
  | 'math'
  | 'thai'
  | 'eng'
  | 'com'
  | 'law'
  | 'doc-general'
  | 'doc-54';

export interface SyllabusSubTopicNode {
  rawTitle: string;
  displayTitle: string;
  questionIds: number[];
}

export interface SyllabusChapterNode {
  chapterKey: string;
  chapterNumber: number;
  title: string;
  subjectKey: SubjectKey;
  rawTitles: string[];
  questionIds: number[];
  subTopics: SyllabusSubTopicNode[];
}

export interface SyllabusGroupNode {
  groupKey: SyllabusGroupKey;
  subjectKey: SubjectKey;
  name: string;
  shortName: string;
  examWeight: number;
  chapters: SyllabusChapterNode[];
  questionIds: number[];
}

interface ChapterRule {
  chapterNumber: number;
  title: string;
  patterns: string[];
}

interface GroupDefinition {
  groupKey: SyllabusGroupKey;
  subjectKey: SubjectKey;
  name: string;
  shortName: string;
  examWeight: number;
  chapters: ChapterRule[];
}

export const SYLLABUS_GROUPS: readonly GroupDefinition[] = [
  {
    groupKey: 'math',
    subjectKey: 'math',
    name: 'วิชาความสามารถทั่วไป',
    shortName: 'ความสามารถทั่วไป',
    examWeight: 20,
    chapters: [
      { chapterNumber: 1, title: 'บทที่ 1 อนุกรม', patterns: ['อนุกรม'] },
      { chapterNumber: 2, title: 'บทที่ 2 อุปมา-อุปไมย', patterns: ['อุปมา'] },
      { chapterNumber: 3, title: 'บทที่ 3 รูปภาพ (มิติสัมพันธ์)', patterns: ['รูปภาพ'] },
      { chapterNumber: 4, title: 'บทที่ 4 IQ (เชาวน์ปัญญา)', patterns: ['iq'] },
      { chapterNumber: 5, title: 'บทที่ 5 เลขพื้นฐาน', patterns: ['เลขพื้นฐาน'] },
      { chapterNumber: 6, title: 'บทที่ 6 ห.ร.ม. และ ค.ร.น.', patterns: ['ห.ร.ม', 'ค.ร.น'] },
      { chapterNumber: 7, title: 'บทที่ 7 อัตราส่วน', patterns: ['อัตราส่วน'] },
      { chapterNumber: 8, title: 'บทที่ 8 ร้อยละ', patterns: ['ร้อยละ'] },
      { chapterNumber: 9, title: 'บทที่ 9 สมการ', patterns: ['สมการ'] },
      { chapterNumber: 10, title: 'บทที่ 10 เลขยกกำลังและพหุนาม', patterns: ['เลขยกกำลัง', 'พหุนาม'] },
      { chapterNumber: 11, title: 'บทที่ 11 อสมการ', patterns: ['อสมการ'] },
      { chapterNumber: 12, title: 'บทที่ 12 ความน่าจะเป็น', patterns: ['ความน่าจะเป็น'] },
      { chapterNumber: 13, title: 'บทที่ 13 ลำดับเลขคณิตและเรขาคณิต', patterns: ['เลขคณิต', 'เรขาคณิต'] },
      { chapterNumber: 14, title: 'บทที่ 14 พื้นที่และปริมาตร', patterns: ['พื้นที่', 'ปริมาตร'] },
      { chapterNumber: 15, title: 'บทที่ 15 สามเหลี่ยม', patterns: ['สามเหลี่ยม'] },
      { chapterNumber: 16, title: 'บทที่ 16 เลขฐาน', patterns: ['เลขฐาน'] },
      { chapterNumber: 17, title: 'บทที่ 17 สถิติ', patterns: ['สถิติ'] },
      { chapterNumber: 18, title: 'บทที่ 18 เซต', patterns: ['เซต'] },
      { chapterNumber: 19, title: 'บทที่ 19 ตรรกศาสตร์', patterns: ['ตรรกศาสตร์'] },
      { chapterNumber: 20, title: 'บทที่ 20 การให้เหตุผล', patterns: ['การให้เหตุผล', 'เหตุผล'] },
    ],
  },
  {
    groupKey: 'thai',
    subjectKey: 'thai',
    name: 'วิชาภาษาไทย',
    shortName: 'ภาษาไทย',
    examWeight: 20,
    chapters: [
      {
        chapterNumber: 1,
        title: 'บทที่ 1 วิเคราะห์บทความ',
        patterns: [
          'สาระสำคัญ',
          'การอนุมาน',
          'การแสดงทรรศนะ',
          'จุดประสงค์',
          'ความรู้สึก',
          'น้ำเสียง',
          'วิเคราะห์ข้อคิด',
          'การถามข้อมูลด้านใน',
        ],
      },
      {
        chapterNumber: 2,
        title: 'บทที่ 2–3 โวหารการเขียนและโวหารภาพพจน์',
        patterns: ['โวหาร'],
      },
      { chapterNumber: 4, title: 'บทที่ 4 ระดับภาษา', patterns: ['ระดับภาษา'] },
      {
        chapterNumber: 5,
        title: 'บทที่ 5 การใช้คำตรงความหมาย',
        patterns: ['การใช้คำให้เหมาะสม', 'ความหมายตามตัว', 'การใช้คำเชื่อม'],
      },
      { chapterNumber: 6, title: 'บทที่ 6 สำนวน สุภาษิต', patterns: ['สุภาษิต', 'คำพังเพย'] },
      {
        chapterNumber: 7,
        title: 'บทที่ 7 อุดมคติ คำคม คำขวัญ คติพจน์',
        patterns: ['อุดมคติ', 'คติพจน์', 'คำขวัญ'],
      },
      {
        chapterNumber: 8,
        title: 'บทที่ 8 การสะกดคำและคำทับศัพท์',
        patterns: ['สะกดคำ', 'คำทับศัพท์'],
      },
      { chapterNumber: 9, title: 'บทที่ 9 คำราชาศัพท์', patterns: ['ราชาศัพท์'] },
      {
        chapterNumber: 10,
        title: 'บทที่ 10 การใช้ภาษาไทยในชีวิตประจำวัน',
        patterns: ['ชีวิตประจำวัน'],
      },
      {
        chapterNumber: 11,
        title: 'บทที่ 11 ข้อบกพร่องทางภาษา',
        patterns: ['กำกวม', 'ฟุ่มเฟือย', 'สำนวนภาษาต่างประเทศ', 'ข้อบกพร่อง'],
      },
      {
        chapterNumber: 12,
        title: 'บทที่ 12 คำสุภาพและคำไวพจน์',
        patterns: ['คำสุภาพ', 'ไวพจน์'],
      },
      {
        chapterNumber: 13,
        title: 'บทที่ 13–14 หลักภาษาอื่น ๆ และลักษณนาม',
        patterns: ['หลักภาษา', 'ลักษณนาม', 'อื่นๆ'],
      },
    ],
  },
  {
    groupKey: 'eng',
    subjectKey: 'eng',
    name: 'วิชาภาษาอังกฤษ',
    shortName: 'ภาษาอังกฤษ',
    examWeight: 15,
    chapters: [
      { chapterNumber: 1, title: 'บทที่ 1 Conversation (บทสนทนา)', patterns: ['conversation'] },
      { chapterNumber: 2, title: 'บทที่ 2 Vocabulary (คำศัพท์)', patterns: ['vocabulary'] },
      { chapterNumber: 3, title: 'บทที่ 3 Reading (การอ่านจับใจความ)', patterns: ['reading'] },
      { chapterNumber: 4, title: 'บทที่ 4 Grammar 1 (Parts of Speech)', patterns: ['partsofspeech'] },
      { chapterNumber: 5, title: 'บทที่ 5 Grammar 2 (Tenses & Passive Voice)', patterns: ['tenses', 'passive'] },
      { chapterNumber: 6, title: 'บทที่ 6 Grammar 3 (Clauses & Verb Forms)', patterns: ['clauses', 'verbforms'] },
      { chapterNumber: 7, title: 'บทที่ 7 Grammar 4 (Connectors & Prepositions)', patterns: ['connectors', 'prepositions'] },
      { chapterNumber: 8, title: 'บทที่ 8 Grammar 5 (Special Grammar Points)', patterns: ['specialgrammar'] },
    ],
  },
  {
    groupKey: 'com',
    subjectKey: 'com',
    name: 'วิชาคอมพิวเตอร์และเทคโนโลยีสารสนเทศ',
    shortName: 'คอมพิวเตอร์',
    examWeight: 40,
    chapters: [
      { chapterNumber: 1, title: 'บทที่ 1 วิวัฒนาการคอมพิวเตอร์', patterns: ['วิวัฒนาการ'] },
      { chapterNumber: 2, title: 'บทที่ 2 ข้อมูลและสารสนเทศ', patterns: ['ข้อมูลและสารสนเทศ'] },
      { chapterNumber: 3, title: 'บทที่ 3 IPOS Cycle', patterns: ['ipos'] },
      { chapterNumber: 4, title: 'บทที่ 4 Hardware & Software', patterns: ['hardware', 'software'] },
      { chapterNumber: 5, title: 'บทที่ 5 Data & People', patterns: ['dataandpeople', 'data&people'] },
      { chapterNumber: 6, title: 'บทที่ 6 Procedure', patterns: ['procedure'] },
      { chapterNumber: 7, title: 'บทที่ 7 ระบบเครือข่ายคอมพิวเตอร์', patterns: ['เครือข่าย'] },
      { chapterNumber: 8, title: 'บทที่ 8 ระบบอินเทอร์เน็ต', patterns: ['อินเทอร์เน็ต', 'อินเตอร์เน็ต'] },
      { chapterNumber: 9, title: 'บทที่ 9 พาณิชย์อิเล็กทรอนิกส์', patterns: ['พาณิชย์'] },
      { chapterNumber: 10, title: 'บทที่ 10 ความปลอดภัยของระบบคอมพิวเตอร์', patterns: ['ความปลอดภัย'] },
      { chapterNumber: 11, title: 'บทที่ 11 Microsoft Word', patterns: ['word'] },
      { chapterNumber: 12, title: 'บทที่ 12 Microsoft Excel', patterns: ['excel'] },
      { chapterNumber: 13, title: 'บทที่ 13 Microsoft PowerPoint', patterns: ['powerpoint'] },
      { chapterNumber: 14, title: 'บทที่ 14 สื่อสังคมออนไลน์ (Social Media)', patterns: ['social'] },
    ],
  },
  {
    groupKey: 'law',
    subjectKey: 'law',
    name: 'วิชากฎหมาย',
    shortName: 'กฎหมาย',
    examWeight: 25,
    chapters: [
      { chapterNumber: 1, title: 'บทที่ 1 ความหมายและประเภทของกฎหมาย', patterns: ['บทนำกฎหมาย', 'ความหมาย'] },
      { chapterNumber: 2, title: 'บทที่ 2 กฎหมายไทย', patterns: ['กฎหมายไทย'] },
      { chapterNumber: 3, title: 'บทที่ 3 รัฐธรรมนูญ', patterns: ['รัฐธรรมนูญ'] },
      { chapterNumber: 4, title: 'บทที่ 4 กฎหมายปกครอง (เพิ่มเติม)', patterns: ['ปกครอง'] },
      { chapterNumber: 5, title: 'บทที่ 5 กฎหมายแพ่ง (บุคคล)', patterns: ['แพ่ง(บุคคล)'] },
      { chapterNumber: 6, title: 'บทที่ 6 กฎหมายแพ่ง (ทรัพย์)', patterns: ['แพ่ง(ทรัพย์)'] },
      { chapterNumber: 7, title: 'บทที่ 7 กฎหมายแพ่ง (สัญญา)', patterns: ['แพ่ง(สัญญา)'] },
      { chapterNumber: 8, title: 'บทที่ 8 กฎหมายแพ่ง (ครอบครัว)', patterns: ['แพ่ง(ครอบครัว)'] },
      { chapterNumber: 9, title: 'บทที่ 9 กฎหมายอาญา (โทษ)', patterns: ['อาญา(โทษ)'] },
      { chapterNumber: 10, title: 'บทที่ 10 กฎหมายอาญา (ความผิดเกี่ยวกับบุคคล)', patterns: ['อาญา(บุคคล)'] },
      { chapterNumber: 11, title: 'บทที่ 11 กฎหมายแรงงาน', patterns: ['แรงงาน'] },
      { chapterNumber: 12, title: 'บทที่ 12 กฎหมายในชีวิตประจำวัน', patterns: ['ชีวิตประจำวัน'] },
    ],
  },
  {
    groupKey: 'doc-general',
    subjectKey: 'doc',
    name: 'วิชางานสารบรรณ',
    shortName: 'งานสารบรรณ',
    examWeight: 18,
    chapters: [
      { chapterNumber: 1, title: 'บทที่ 1 บทนำและนิยาม', patterns: ['บทนำและนิยาม'] },
      { chapterNumber: 2, title: 'บทที่ 2 มาตรฐานแบบพิมพ์ ซอง และตราครุฑ', patterns: ['แบบพิมพ์', 'ตราครุฑ'] },
      {
        chapterNumber: 3,
        title: 'บทที่ 3 หนังสือภายนอก ภายใน และประทับตรา',
        patterns: ['นอก+ใน+ประทับตรา', 'หนังสือภายนอก'],
      },
      { chapterNumber: 4, title: 'บทที่ 4 หนังสือสั่งการ', patterns: ['สั่งการ'] },
      { chapterNumber: 5, title: 'บทที่ 5 หนังสือประชาสัมพันธ์', patterns: ['ประชาสัมพันธ์'] },
      {
        chapterNumber: 6,
        title: 'บทที่ 6 หนังสือที่เจ้าหน้าที่จัดทำขึ้นหรือรับไว้เป็นหลักฐาน',
        patterns: ['เจ้าหน้าที่'],
      },
      {
        chapterNumber: 7,
        title: 'บทที่ 7 เบ็ดเตล็ด สำเนา และหนังสือภาษาอังกฤษ',
        patterns: ['เบ็ดเตล็ด'],
      },
      { chapterNumber: 8, title: 'บทที่ 8 การรับ-ส่งหนังสือ', patterns: ['รับ-ส่ง'] },
      { chapterNumber: 9, title: 'บทที่ 9 การเก็บรักษาหนังสือ', patterns: ['เก็บรักษา'] },
      { chapterNumber: 10, title: 'บทที่ 10 การยืมหนังสือ', patterns: ['การยืม'] },
      { chapterNumber: 11, title: 'บทที่ 11 การทำลายหนังสือ', patterns: ['การทำลาย'] },
      { chapterNumber: 12, title: 'บทที่ 12 ระบบสารบรรณอิเล็กทรอนิกส์', patterns: ['อิเล็กทรอนิกส์'] },
    ],
  },
  {
    groupKey: 'doc-54',
    subjectKey: 'doc',
    name: 'วิชาลักษณะที่ 54 (งานสารบรรณตำรวจ)',
    shortName: 'ลักษณะที่ 54',
    examWeight: 12,
    chapters: [
      {
        chapterNumber: 1,
        title: 'บทที่ 1–3 สารบรรณตำรวจ บันทึกข้อความ และการจัดทำหนังสือ',
        patterns: ['บท1+บท2+บท3'],
      },
      {
        chapterNumber: 4,
        title: 'บทที่ 4–6 การนำเสนองาน รับ-ส่ง และคัดลอกสำเนา',
        patterns: ['บท4+บท5+บท6'],
      },
      {
        chapterNumber: 7,
        title: 'บทที่ 7 กำหนดเลขที่ประจำหน่วยงาน ตร.',
        patterns: ['บท7'],
      },
      {
        chapterNumber: 8,
        title: 'บทที่ 8–9 คำย่อราชการตำรวจ และบัญญัติศัพท์ภาษาอังกฤษ',
        patterns: ['บท8'],
      },
      {
        chapterNumber: 10,
        title: 'บทที่ 10–11 ประกาศพนักงานจราจร และไปรษณีย์สนาม ตชด.',
        patterns: ['บท10'],
      },
    ],
  },
];

function isDoc54Title(rawTitle: string): boolean {
  return rawTitle.trim().startsWith('(54)');
}

function resolveGroupForQuestion(subjectKey: SubjectKey, rawTitle: string): GroupDefinition | undefined {
  if (subjectKey === 'doc') {
    const targetKey: SyllabusGroupKey = isDoc54Title(rawTitle) ? 'doc-54' : 'doc-general';
    return SYLLABUS_GROUPS.find((g) => g.groupKey === targetKey);
  }
  return SYLLABUS_GROUPS.find((g) => g.subjectKey === subjectKey);
}

function matchChapterRule(group: GroupDefinition, rawTitle: string): ChapterRule | null {
  const norm = normalizeTopicTitleKey(rawTitle);
  for (const ch of group.chapters) {
    for (const pat of ch.patterns) {
      if (norm.includes(normalizeTopicTitleKey(pat))) {
        return ch;
      }
    }
  }
  return null;
}

export function buildSyllabusTree<
  T extends { id: number; subject_key: SubjectKey; title: string | null },
>(questions: T[]): SyllabusGroupNode[] {
  const groupAcc = new Map<
    SyllabusGroupKey,
    {
      def: GroupDefinition;
      questionIds: number[];
      chapters: Map<
        string,
        {
          chapterNumber: number;
          title: string;
          rawTitlesSet: Set<string>;
          questionIds: number[];
          subTopics: Map<string, { displayTitle: string; rawTitles: Set<string>; questionIds: number[] }>;
        }
      >;
    }
  >();

  for (const def of SYLLABUS_GROUPS) {
    groupAcc.set(def.groupKey, {
      def,
      questionIds: [],
      chapters: new Map(),
    });
  }

  for (const q of questions) {
    const rawTitle = (q.title || 'หัวข้ออื่น ๆ').trim();
    const groupDef = resolveGroupForQuestion(q.subject_key, rawTitle);
    if (!groupDef) continue;

    const gBucket = groupAcc.get(groupDef.groupKey)!;
    gBucket.questionIds.push(q.id);

    const matchedRule = matchChapterRule(groupDef, rawTitle);
    const chapterKey = matchedRule
      ? `${groupDef.groupKey}:ch-${matchedRule.chapterNumber}`
      : `${groupDef.groupKey}:other`;
    const chapterTitle = matchedRule ? matchedRule.title : 'หัวข้ออื่น ๆ เพิ่มเติม';
    const chapterNumber = matchedRule ? matchedRule.chapterNumber : 99;

    let chBucket = gBucket.chapters.get(chapterKey);
    if (!chBucket) {
      chBucket = {
        chapterNumber,
        title: chapterTitle,
        rawTitlesSet: new Set(),
        questionIds: [],
        subTopics: new Map(),
      };
      gBucket.chapters.set(chapterKey, chBucket);
    }

    chBucket.rawTitlesSet.add(rawTitle);
    chBucket.questionIds.push(q.id);

    const subKey = normalizeTopicTitleKey(rawTitle);
    let subBucket = chBucket.subTopics.get(subKey);
    if (!subBucket) {
      subBucket = {
        displayTitle: rawTitle.replace(/_/g, ' '),
        rawTitles: new Set([rawTitle]),
        questionIds: [],
      };
      chBucket.subTopics.set(subKey, subBucket);
    } else {
      subBucket.rawTitles.add(rawTitle);
    }
    subBucket.questionIds.push(q.id);
  }

  return SYLLABUS_GROUPS.map((def) => {
    const gBucket = groupAcc.get(def.groupKey)!;
    const chapters: SyllabusChapterNode[] = Array.from(gBucket.chapters.entries())
      .map(([chapterKey, ch]) => ({
        chapterKey,
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        subjectKey: def.subjectKey,
        rawTitles: Array.from(ch.rawTitlesSet),
        questionIds: ch.questionIds,
        subTopics: Array.from(ch.subTopics.values())
          .map((st) => ({
            rawTitle: Array.from(st.rawTitles).join('||'),
            displayTitle: st.displayTitle,
            questionIds: st.questionIds,
          }))
          .sort((a, b) => b.questionIds.length - a.questionIds.length),
      }))
      .sort((a, b) => a.chapterNumber - b.chapterNumber);

    return {
      groupKey: def.groupKey,
      subjectKey: def.subjectKey,
      name: def.name,
      shortName: def.shortName,
      examWeight: def.examWeight,
      chapters,
      questionIds: gBucket.questionIds,
    };
  });
}

/**
 * Computes urgency score for the Automated Priority Fix Plan.
 * Higher score = more urgent to drill (high exam weight, low accuracy, more mistakes).
 */
export function computePriorityScore(
  accuracy: number | null,
  wrongCount: number,
  examWeight: number
): number {
  if (wrongCount <= 0) return 0;
  const errorRate = accuracy === null ? 100 : Math.max(5, 100 - accuracy);
  return Math.round(examWeight * errorRate * Math.log2(wrongCount + 1));
}

import React from 'react';
import Link from 'next/link';
import { Archive, ArrowRight, BarChart3, BookmarkCheck, BookOpenCheck, Database, FileSpreadsheet, Flame, Layers, Shuffle } from 'lucide-react';
import { SiteHeader } from '@/components/SiteHeader';
import { ACTIVE_SUBJECTS, HIDDEN_SUBJECT_KEYS, TRACKS } from '@/lib/constants';
import { getAllQuestionsMerged, getStore } from '@/lib/server-db';

export default function CatalogHubPage() {
  const store = getStore();
  const totalQ = getAllQuestionsMerged().filter(
    (q) => !HIDDEN_SUBJECT_KEYS.has(q.subject_key)
  ).length;
  const formSets = store.examSets.filter((s) => s.kind === 'form');

  return (
    <div className="min-h-screen bg-bg text-ink pb-24 md:pb-12">
      <SiteHeader mode="app" />
      <main className="mx-auto max-w-5xl px-4 py-7 space-y-6">
        <div className="border-b border-line pb-5">
          <div className="text-xs font-medium text-muted">ทำข้อสอบ / คลังข้อสอบทั้งหมด</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">เลือกโหมดการทำข้อสอบ</h1>
          <p className="mt-1 text-sm text-muted tabular-nums">
            คลังข้อสอบจริง {totalQ.toLocaleString()} ข้อ เลือกฝึกตามเป้าหมายของคุณ
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/catalog/real-exam"
            className="card-hover sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-card border border-accent/40 bg-accent/[0.04] p-5 shadow-card"
          >
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-bold text-accent">
                  แยกขาดจากชุดอื่น 100% · โค้งสุดท้ายก่อนสอบ
                </div>
                <h2 className="mt-1.5 text-lg font-bold text-ink">
                  สนามข้อสอบจริงคัดพิเศษ (4 ชุด · 643 ข้อ · รุ่น 2569)
                </h2>
                <p className="mt-0.5 text-[13px] text-muted leading-relaxed">
                  คัดจากข้อสอบจริงฉบับภาพต้นฉบับ (OCR + SVG) ล็อกแยกต่างหาก พร้อมโหมดซ่อมวนและผสมเติมเต็ม 150 ข้อจนกว่าจะถูก 100%
                </p>
              </div>
            </div>
            <div className="inline-flex shrink-0 items-center gap-1.5 rounded-btn bg-accent px-4 py-2 text-xs font-semibold text-white">
              <span>เปิดสนามข้อสอบจริง</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          <div className="rounded-card border border-line bg-panel p-5 shadow-card">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Shuffle className="h-5 w-5" />
            </div>
            <h2 className="mt-3.5 text-[17px] font-semibold">สุ่มข้อสอบครบทุกวิชา (150 ข้อ)</h2>
            <p className="mt-1 text-[13px] text-muted leading-relaxed">
              สุ่มจัดชุดตามสัดส่วนจริงของแต่ละสายสอบ จับเวลา 180 นาที
            </p>
            <div className="mt-4 space-y-1.5">
              {TRACKS.map((t) => (
                <Link
                  key={t.id}
                  href={`/exam/random-${t.id}?mode=real`}
                  className="flex items-center justify-between rounded-lg border border-line bg-bg2/40 px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-brand/50 hover:text-brand"
                >
                  <span>{t.name}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted" />
                </Link>
              ))}
            </div>
          </div>

          <Link
            href="/catalog/form"
            className="card-hover flex flex-col justify-between rounded-card border border-line bg-panel p-5 shadow-card"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal/15 text-teal-ink">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <h2 className="mt-3.5 text-[17px] font-semibold">ฟอร์มข้อสอบจำลอง ({formSets.length} ชุด)</h2>
              <p className="mt-1 text-[13px] text-muted leading-relaxed">
                ชุดข้อสอบมาตรฐานชุดละ 150 ข้อ ทำได้ทั้งโหมดสอบจริงและฝึกซ้อม
              </p>
            </div>
            <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
              <span>เปิดดูทั้ง {formSets.length} ชุด</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          <Link
            href="/catalog/subject"
            className="card-hover flex flex-col justify-between rounded-card border border-line bg-panel p-5 shadow-card"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet/15 text-violet">
                <Layers className="h-5 w-5" />
              </div>
              <h2 className="mt-3.5 text-[17px] font-semibold">ข้อสอบแยกรายวิชา ({ACTIVE_SUBJECTS.length} วิชา)</h2>
              <p className="mt-1 text-[13px] text-muted leading-relaxed">
                แบ่งทำชุดย่อย 20 / 50 ข้อเรียงลำดับ หรือสุ่มฝึกเข้มข้นพร้อมเฉลยละเอียด
              </p>
            </div>
            <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
              <span>เลือกรายวิชา</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          <Link
            href="/catalog/topics"
            className="card-hover flex flex-col justify-between rounded-card border border-line bg-panel p-5 shadow-card"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <BookOpenCheck className="h-5 w-5" />
              </div>
              <h2 className="mt-3.5 text-[17px] font-semibold">
                แยกหัวข้อย่อยรายวิชา
              </h2>
              <p className="mt-1 text-[13px] text-muted leading-relaxed">
                เจาะลึกเฉพาะบทในทั้ง 7 วิชา เช่น Word, Excel, แพ่ง/อาญา, อนุกรม
              </p>
            </div>
            <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
              <span>เลือกหัวข้อย่อย</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          <Link
            href="/catalog/review"
            className="card-hover flex flex-col justify-between rounded-card border border-line bg-panel p-5 shadow-card"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15 text-gold-ink">
                <BookmarkCheck className="h-5 w-5" />
              </div>
              <h2 className="mt-3.5 text-[17px] font-semibold">
                คลังทบทวนรายข้อ
              </h2>
              <p className="mt-1 text-[13px] text-muted leading-relaxed">
                รวมข้อที่กด &ldquo;ต้องการทบทวน&rdquo; ฝึกได้ครบทั้งแบบรวม แยกวิชา แยกหัวข้อ และดูแบบรายข้อ
              </p>
            </div>
            <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
              <span>เปิดคลังทบทวนรายข้อ</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          <Link
            href="/weakness"
            className="card-hover flex flex-col justify-between rounded-card border border-line bg-panel p-5 shadow-card"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h2 className="mt-3.5 text-[17px] font-semibold">
                สรุปจุดอ่อนรายวิชา &amp; หัวข้อย่อย
              </h2>
              <p className="mt-1 text-[13px] text-muted leading-relaxed">
                ดูสรุปง่ายๆ ว่าไม่ถนัดวิชาไหนและหัวข้อย่อยอะไรบ้าง แยกครบทั้ง {ACTIVE_SUBJECTS.length} วิชา พร้อมปุ่มซ่อมทันที
              </p>
            </div>
            <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
              <span>เปิดหน้าสรุปจุดอ่อน</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          <Link
            href="/catalog/completed"
            className="card-hover flex flex-col justify-between rounded-card border border-line bg-panel p-5 shadow-card"
          >
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Archive className="h-5 w-5" />
              </div>
              <h2 className="mt-3.5 text-[17px] font-semibold">
                ชุดข้อสอบที่เคยทำแล้ว
              </h2>
              <p className="mt-1 text-[13px] text-muted leading-relaxed">
                ทบทวนข้อที่เคยทำ แยกรวมทั้งหมด ทำถูกอย่างเดียว หรือทำผิดอย่างเดียว
              </p>
            </div>
            <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
              <span>เปิดชุดข้อสอบที่เคยทำแล้ว</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          <Link
            href="/bank"
            className="card-hover flex flex-col justify-between rounded-card border border-line bg-panel p-6 shadow-card"
          >
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/15 text-gold-ink">
                <Database className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-extrabold">คลังเจาะลึก {store.topics.length} หัวข้อย่อย</h2>
              <p className="mt-1 text-xs text-muted">
                ค้นหาโจทย์จากคลัง {totalQ.toLocaleString()} ข้อ กรองตามบทและชุดนำเข้า หรือเปิดอ่านเฉลยแบบ Flashcard
              </p>
            </div>
            <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-brand">
              <span>เปิดคลังข้อสอบ</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}


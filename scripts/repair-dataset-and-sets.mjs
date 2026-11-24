#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATASET_DIR = path.join(ROOT, 'data', 'dataset');
const ALL_Q_PATH = path.join(DATASET_DIR, 'all-questions.json');
const BY_SUBJ_DIR = path.join(DATASET_DIR, 'questions');
const BY_SET_DIR = path.join(BY_SUBJ_DIR, 'by-set');
const REAL_SETS_TS = path.join(ROOT, 'src', 'lib', 'real-exam-sets.ts');

function normalizeTopicTitleKey(title) {
  return (title || 'อื่นๆ')
    .replace(/\s+/g, '')
    .replace(/&/g, 'and')
    .replace(/กาาร/g, 'การ')
    .replace(/คอมพิวเตอร์/g, 'คอม')
    .toLowerCase();
}

// 1. Explicit verified stem/explanation repairs for OCR-corrupted & truncated questions
const EXPLICIT_FIXES = {
  8660: {
    stem: 'จากรูปภาพตารางด้านล่าง โปรแกรมกำลังทำขั้นตอนใดอยู่\n\n<table><tr><td>ปี 2562</td><td></td><td>C6</td></tr><tr><td>11,000</td><td>B Bus NaisibPro</td><td></td></tr></table>',
  },
  8692: {
    explanation:
      'ปุ่มคำสั่งรูปแถบฟิล์มและเครื่องหมายเล่น (Insert Video) ในโปรแกรม Microsoft PowerPoint ใช้สำหรับแทรกไฟล์วิดีโอลงในสไลด์',
  },
  8767: {
    explanation:
      'สัญลักษณ์ตัวอักษร "in" ในกรอบสี่เหลี่ยมเป็นไอคอนของ LinkedIn เครือข่ายสังคมออนไลน์สำหรับวิชาชีพและการสมัครงาน',
  },
  8791: {
    explanation:
      'สัญลักษณ์รูปตัวโน้ตดนตรีเป็นไอคอนของแอปพลิเคชัน TikTok แพลตฟอร์มวิดีโอสั้นออนไลน์',
  },
  8796: {
    explanation:
      'สัญลักษณ์รูปเครื่องบินกระดาษในวงกลมเป็นไอคอนของแอปพลิเคชัน Telegram สำหรับส่งข้อความและสื่อสารออนไลน์',
  },
  8883: {
    explanation:
      'พิจารณาผลต่างระหว่างพจน์ติดกัน: $15 - 8 = 7$, $36 - 15 = 21$, $99 - 36 = 63$ จะเห็นว่าผลต่างคูณด้วย $3$ ทุกขั้น ($7 \\times 3 = 21$, $21 \\times 3 = 63$, ขั้นถัดไป $63 \\times 3 = 189$) ดังนั้นพจน์ถัดไปคือ $99 + 189 = 288$',
  },
  8886: {
    explanation:
      'อนุกรมเรขาคณิตคูณด้วย $4$ ทุกพจน์: $2 \\times 4 = 8$, $8 \\times 4 = 32$, $32 \\times 4 = 128$ ดังนั้นพจน์ถัดไปคือ $128 \\times 4 = 512$',
  },
  8887: {
    explanation:
      'พิจารณาผลต่างระหว่างพจน์ติดกัน: $-8, -7, -6, -5$ ($19 - 8 = 11$, $11 - 7 = 4$, $4 - 6 = -2$, $-2 - 5 = -7$) ขั้นถัดไปจึงลบด้วย $4$ ได้ $-7 - 4 = -11$',
  },
  8889: {
    explanation:
      'พิจารณาผลต่างระหว่างพจน์ติดกัน: $+3, +5, +7, +9$ (เพิ่มขึ้นเป็นจำนวนคี่เรียงกันทีละ $2$) ขั้นถัดไปจึงบวกด้วย $11$ ได้ $112 + 11 = 123$',
  },
  8892: {
    explanation:
      'พิจารณาผลต่างสลับกันระหว่าง $+6$ และ $+8$: $17 + 6 = 23$, $23 + 8 = 31$, $31 + 6 = 37$, $37 + 8 = 45$ ขั้นถัดไปจึงบวกด้วย $6$ ได้ $45 + 6 = 51$',
  },
  8907: {
    explanation:
      'อนุกรมสลับ 2 ชุด: ชุดตำแหน่งคี่ $34, 40, 46, \\dots$ เพิ่มขึ้นทีละ $+6$ ดังนั้นพจน์ถัดไป (ตำแหน่งที่ 7) คือ $46 + 6 = 52$ (ส่วนชุดตำแหน่งคู่ $67, 62, 57$ ลดลงทีละ $5$)',
  },
  8908: {
    explanation:
      'อนุกรมสลับ 2 ชุด: ชุดตำแหน่งคี่ $6, 8, 11, 15$ ($+2, +3, +4$) และชุดตำแหน่งคู่ $6, 7, 9, \\dots$ เพิ่มขึ้นทีละ $+1, +2, +3$ ดังนั้นพจน์ถัดไป (ตำแหน่งที่ 8) คือ $9 + 3 = 12$',
  },
  8909: {
    explanation:
      'อนุกรมสลับ 2 ชุด: ชุดตำแหน่งคี่ $59, 56, 52, 47$ ($-3, -4, -5$) และชุดตำแหน่งคู่ $31, 34, 38, \\dots$ เพิ่มขึ้นทีละ $+3, +4, +5$ ดังนั้นพจน์ถัดไป (ตำแหน่งที่ 8) คือ $38 + 5 = 43$',
  },
  8912: {
    explanation:
      'อนุกรมสลับ 2 ชุด: ชุดตำแหน่งคี่ $72, 69, 66, \\dots$ ลดลงทีละ $-3$ ดังนั้นพจน์ถัดไป (ตำแหน่งที่ 7) คือ $66 - 3 = 63$ (ชุดตำแหน่งคู่ $40, 37, 34$ ลดลงทีละ $-3$ เช่นกัน)',
  },
  8931: {
    explanation:
      'อนุกรมเรขาคณิตที่คูณด้วย $\\frac{5}{2}$ ทุกพจน์: $1 \\times \\frac{5}{2} = \\frac{5}{2}$, $\\frac{5}{2} \\times \\frac{5}{2} = \\frac{25}{4}$, $\\frac{25}{4} \\times \\frac{5}{2} = \\frac{125}{8}$ ดังนั้นพจน์ถัดไปคือ $\\frac{125}{8} \\times \\frac{5}{2} = \\frac{625}{16}$',
  },
  9044: {
    stem: 'กำหนดความสัมพันธ์ของตัวเลขดังนี้ ชุดที่ 1: (14, 16, 18 -> 48), ชุดที่ 2: (11, 13, 15 -> 39), ชุดที่ 3: (21, 14, A -> 52) จงหาค่าของ 2A',
  },
  9072: {
    explanation:
      'คำนวณตัวตั้ง: $6 + \\frac{3}{2} = \\frac{15}{2}$\nคำนวณตัวหาร: $\\frac{12}{7} - 2\\left(\\frac{3}{4}\\right) = \\frac{12}{7} - \\frac{3}{2} = \\frac{24 - 21}{14} = \\frac{3}{14}$\nดังนั้น $\\frac{15}{2} \\div \\frac{3}{14} = \\frac{15}{2} \\times \\frac{14}{3} = 5 \\times 7 = 35$',
  },
  9092: {
    explanation:
      'เทียบบัญญัติไตรยางศ์: มะละกอ $100$ ผล ราคา $580$ บาท ถ้าซื้อ $300$ ผล คิดเป็นเงิน $\\frac{580 \\times 300}{100} = 580 \\times 3 = 1,740$ บาท',
  },
  9114: {
    stem: 'จงหาค่าของ $3^{757}$ ว่าหลักหน่วยมีค่าตรงกับข้อใด',
    explanation:
      'หลักหน่วยของเลขยกกำลังฐาน $3$ วนซ้ำทุก $4$ รอบ คือ $3^1=3, 3^2=9, 3^3=27, 3^4=81$ (ลงท้ายด้วย $3, 9, 7, 1$) นำเลขชี้กำลัง $757 \\div 4$ ได้ $189$ เศษ $1$ จึงตรงกับลำดับที่ $1$ คือหลักหน่วยเป็น $3$',
  },
  9115: {
    explanation:
      'หลักหน่วยของเลขยกกำลังฐาน $7$ วนซ้ำทุก $4$ รอบ คือ $7^1=7, 7^2=49, 7^3=343, 7^4=2401$ (ลงท้ายด้วย $7, 9, 3, 1$) นำเลขชี้กำลัง $123 \\div 4$ ได้ $30$ เศษ $3$ จึงตรงกับลำดับที่ $3$ คือหลักหน่วยเป็น $3$',
  },
  9116: {
    explanation:
      'หลักหน่วยของเลขยกกำลังฐาน $4$ วนซ้ำทุก $2$ รอบ คือ เลขชี้กำลังคี่ลงท้ายด้วย $4$ ($4^1=4, 4^3=64$) และเลขชี้กำลังคู่ลงท้ายด้วย $6$ ($4^2=16$) เนื่องจาก $323$ เป็นจำนวนคี่ หลักหน่วยจึงเท่ากับ $4$',
  },
  9125: {
    explanation:
      'เนื่องจาก $\\frac{343}{125} = \\left(\\frac{7}{5}\\right)^3 = \\left(\\frac{5}{7}\\right)^{-3}$ เมื่อฐานเท่ากันจะได้ $2 - 5x = -3 \\Rightarrow 5x = 5 \\Rightarrow x = 1$',
  },
  9283: {
    explanation:
      'แปลงฐานสิบสองเป็นฐานสิบก่อน: $167B_{12} = (1 \\times 12^3) + (6 \\times 12^2) + (7 \\times 12^1) + (11 \\times 12^0) = 1,728 + 864 + 84 + 11 = 2,687$\nจากนั้นแปลง $2,687$ เป็นฐานห้าโดยหารสั้นด้วย $5$ ต่อเนื่อง ได้เศษเรียงย้อนกลับคือ $41222_5$ (ตรงกับตัวเลือก 412225)',
  },
  9285: {
    explanation:
      'แปลงฐานสิบหกเป็นฐานสิบก่อน: $AD12_{16} = (10 \\times 16^3) + (13 \\times 16^2) + (1 \\times 16^1) + (2 \\times 16^0) = 40,960 + 3,328 + 16 + 2 = 44,306$\nจากนั้นแปลง $44,306$ เป็นฐานสี่โดยหารสั้นด้วย $4$ ต่อเนื่อง ได้ผลลัพธ์ $22310102_4$ (ตรงกับตัวเลือก 223101024)',
  },
  9286: {
    explanation:
      'แปลงฐานสิบหกเป็นฐานสิบก่อน: $BE35_{16} = (11 \\times 16^3) + (14 \\times 16^2) + (3 \\times 16^1) + (5 \\times 16^0) = 45,056 + 3,584 + 48 + 5 = 48,693$\nจากนั้นแปลง $48,693$ เป็นฐานห้าโดยหารสั้นด้วย $5$ ต่อเนื่อง ได้ผลลัพธ์ $3024233_5$ (ตรงกับตัวเลือก 30242335)',
  },
  9341: {
    explanation:
      'ให้ต้นทุนของนาย ก. เท่ากับ $x$ บาท\nนาย ก. ขายให้นาย ข. ได้กำไร $20\\%$ เป็นเงิน $1.2x$ บาท และนาย ข. ขายต่อให้นาย ค. ได้กำไร $10\\%$ เป็นเงิน $1.1 \\times 1.2x = 2,772$\nดังนั้น $x = \\frac{2,772}{1.32} = 2,100$ บาท',
  },
  9342: {
    explanation:
      'ให้ต้นทุนของ A เท่ากับ $x$ บาท จะได้สมการ $x \\times \\frac{120}{100} \\times \\frac{110}{100} = 5,225$\nดังนั้น $x = \\frac{5,225}{1.32} \\approx 3,958.33$ ปัดเป็นจำนวนเต็มได้ $3,958$ บาท',
  },
  9373: {
    stem: 'ตารางแสดงรายรับและรายจ่ายของร้านค้าแห่งหนึ่ง\n\n<table><tr><th>เดือน</th><th>รายรับ (บาท)</th><th>รายจ่าย (บาท)</th></tr><tr><td>มกราคม</td><td>50,000</td><td>40,000</td></tr><tr><td>กุมภาพันธ์</td><td>60,000</td><td>45,000</td></tr><tr><td>มีนาคม</td><td>55,000</td><td>44,000</td></tr><tr><td>เมษายน</td><td>80,000</td><td>56,000</td></tr></table>\n\nเดือนใดมีกำไรคิดเป็นร้อยละของรายรับสูงที่สุด',
  },
  9392: {
    explanation:
      'คิดดอกเบี้ยทบต้นทีละปี:\nสิ้นปีที่ 1 ได้เงินรวม $5,000 \\times 1.02 = 5,100$ บาท\nสิ้นปีที่ 2 ได้เงินรวม $5,100 \\times 1.03 = 5,253$ บาท',
  },
  9393: {
    explanation:
      'จากโจทย์ เงินต้น $= 2,500$ บาท, ระยะเวลา $n = 2$ ปี, อัตราดอกเบี้ย $= 1\\%$ ต่อปี\nจากสูตรเงินรวมทบต้น $= 2,500\\left(1 + \\frac{1}{100}\\right)^2 = 2,500(1.01)^2 = 2,500(1.0201) = 2,550.25$ บาท\nดังนั้น เมื่อฝากครบ 2 ปี จะได้รับดอกเบี้ย $2,550.25 - 2,500 = 50.25$ บาท',
  },
  9483: {
    explanation:
      'ตามมาตราตวงไทย $1$ เกวียน เท่ากับ $100$ ถัง และ $1$ ถัง เท่ากับ $20$ ลิตร ดังนั้น $1$ เกวียน $= 2,000$ ลิตร เมื่อเกี่ยวข้าวได้ $4$ เกวียน จึงคิดเป็น $4 \\times 2,000 = 8,000$ ลิตร',
  },
  9487: {
    explanation:
      'จากสูตรพื้นที่รูปสามเหลี่ยมด้านเท่า $= \\frac{\\sqrt{3}}{4} \\times \\text{ด้าน}^2 = \\frac{\\sqrt{3}}{4} \\times (2\\sqrt{5})^2 = \\frac{\\sqrt{3}}{4} \\times 20 = 5\\sqrt{3}$ ตารางหน่วย',
  },
  9493: {
    explanation:
      'สระว่ายน้ำมีหน้าตัดตามยาวเป็นรูปสี่เหลี่ยมคางหมู ความลึกเฉลี่ย $= \\frac{2 + 3}{2} = 2.5$ เมตร ดังนั้นปริมาตรความจุน้ำของสระ $= 12 \\times 20 \\times 2.5 = 600$ ลูกบาศก์เมตร',
  },
  9506: {
    explanation:
      'จากทฤษฎีบทพีทาโกรัส $(3x + 1)^2 = (3x)^2 + 5^2 \\Rightarrow 9x^2 + 6x + 1 = 9x^2 + 25 \\Rightarrow 6x = 24 \\Rightarrow x = 4$\nจะได้ด้านประกอบมุมฉากยาว $5$ หน่วย และ $3(4) = 12$ หน่วย ดังนั้นพื้นที่รูปสามเหลี่ยม $= \\frac{1}{2} \\times 5 \\times 12 = 30$ ตารางหน่วย',
  },
  9551: {
    stem: 'จากรูปสามเหลี่ยมคล้ายที่กำหนดให้ ด้านที่ต้องการหามีความยาวกี่หน่วย',
    explanation:
      'ใช้สมบัติของรูปสามเหลี่ยมคล้าย เทียบอัตราส่วนด้านที่สมนัยกันของรูปสามเหลี่ยมสองรูป จะคำนวณความยาวด้านที่ต้องการได้เท่ากับ $40.5$ หน่วย',
  },
  9554: {
    stem: 'จงหาค่าของ $\\sec^{2} 60^{\\circ} + \\sin 30^{\\circ} + \\cos 60^{\\circ} - \\csc 30^{\\circ}$',
    explanation:
      'แทนค่าฟังก์ชันตรีโกณมิติ: $\\sec 60^{\\circ} = 2$, $\\sin 30^{\\circ} = \\frac{1}{2}$, $\\cos 60^{\\circ} = \\frac{1}{2}$, $\\csc 30^{\\circ} = 2$\nจะได้ $2^2 + \\frac{1}{2} + \\frac{1}{2} - 2 = 4 + 1 - 2 = 3$',
  },
  9558: {
    explanation:
      'แทนค่าฟังก์ชันตรีโกณมิติ: $\\cos 60^{\\circ} \\cdot \\sec 60^{\\circ} = \\frac{1}{2} \\times 2 = 1$, $\\cos^2 30^{\\circ} = \\left(\\frac{\\sqrt{3}}{2}\\right)^2 = \\frac{3}{4}$, และ $\\cos 30^{\\circ} \\cdot \\cot 60^{\\circ} = \\frac{\\sqrt{3}}{2} \\times \\frac{1}{\\sqrt{3}} = \\frac{1}{2}$\nดังนั้น $1 - \\frac{3}{4} + \\frac{1}{2} = \\frac{3}{4}$',
  },
  9612: {
    explanation:
      'ให้จำนวนเต็มบวกสามจำนวนเรียงกันคือ $x, x+1, x+2$ ผลรวมเท่ากับ $3x + 3$\nจากเงื่อนไข $15 < 3x + 3 < 24 \\Rightarrow 12 < 3x < 21 \\Rightarrow 4 < x < 7$\nดังนั้นจำนวนที่มีค่าน้อยที่สุดที่เป็นไปได้คือ $x = 5$ (ชุดตัวเลข $5, 6, 7$ รวมได้ $18$)',
  },
  9648: {
    explanation:
      'จำนวนวิธีหยิบสลาก $3$ ใบจาก $10$ ใบ คือ $\\binom{10}{3} = \\frac{10 \\times 9 \\times 8}{3 \\times 2 \\times 1} = 120$ วิธี\nเหตุการณ์ที่ได้แต้มรวมเป็น $10$ โดยไม่มีใบใดเกิน $5$ มีได้ $2$ ชุด คือ $\\{1, 4, 5\\}$ และ $\\{2, 3, 5\\}$ รวม $2$ วิธี\nดังนั้นความน่าจะเป็น $= \\frac{2}{120} = \\frac{1}{60}$',
  },
  9650: {
    explanation:
      'มีลูกบอลทั้งหมด $2 + 4 = 6$ ลูก เป็นสีแดง $2$ ลูก การหยิบแล้วใส่คืนทำให้โอกาสได้สีแดงแต่ละครั้งเท่าเดิมคือ $\\frac{2}{6} = \\frac{1}{3}$\nความน่าจะเป็นที่จะได้สีแดงทั้ง 2 ครั้ง $= \\frac{1}{3} \\times \\frac{1}{3} = \\frac{1}{9}$',
  },
  9651: {
    explanation:
      'มีลูกบอลทั้งหมด $2 + 4 = 6$ ลูก หยิบทีละลูกโดยไม่ใส่คืน:\nครั้งที่ 1 ได้สีแดง $= \\frac{2}{6}$ และครั้งที่ 2 ได้สีแดงจากที่เหลือ $= \\frac{1}{5}$\nดังนั้นความน่าจะเป็น $= \\frac{2}{6} \\times \\frac{1}{5} = \\frac{2}{30} = \\frac{1}{15}$',
  },
  9699: {
    explanation:
      'เนื่องจากข้อมูลเป็นอันตรภาคชั้น จึงหาจุดกึ่งกลางชั้นได้ดังนี้\n\n<table><tr><th>ค่าอาหารกลางวัน (บาท)</th><th>จำนวน (คน)</th><th>จุดกึ่งกลางชั้น</th></tr><tr><td>10 - 19</td><td>2</td><td>14.5</td></tr><tr><td>20 - 29</td><td>3</td><td>24.5</td></tr><tr><td>30 - 39</td><td>5</td><td>34.5</td></tr></table>\n\nคำนวณค่าเฉลี่ยเลขคณิต: $\\bar{x} = \\frac{(14.5 \\times 2) + (24.5 \\times 3) + (34.5 \\times 5)}{2 + 3 + 5} = \\frac{29 + 73.5 + 172.5}{10} = \\frac{275}{10} = 27.5$ บาท',
  },
  9707: {
    explanation:
      'มีนักเรียนชาย $13$ คน และนักเรียนหญิง $30 - 13 = 17$ คน\nจากสูตรค่าเฉลี่ยรวม $\\bar{x}_{\\text{รวม}} = \\frac{(13 \\times 64) + (17 \\times 61)}{30} = \\frac{832 + 1,037}{30} = \\frac{1,869}{30} = 62.3$ กิโลกรัม',
  },
  9727: {
    explanation:
      '$(A \\cap B) = \\{-20, -19, -18, \\dots, -1\\}$\n$C = \\{x \\mid -6 \\le x \\le 6\\} = \\{-6, -5, -4, \\dots, 4, 5, 6\\}$\n$(A \\cap B) - C = \\{-20, -19, -18, \\dots, -7\\}$\nดังนั้น $n((A \\cap B) - C) = 14$',
  },
  11186: {
    explanation:
      'ข้าราชการตำรวจประกอบด้วยยศทั้งหมด 14 ชั้นยศ แบ่งเป็น ชั้นสัญญาบัตร 9 ชั้นยศ (ว่าที่ร้อยตำรวจตรี ถึง พลตำรวจเอก) และชั้นประทวน 5 ชั้นยศ (พลตำรวจสำรอง/พลตำรวจ, สิบตำรวจตรี, สิบตำรวจโท, สิบตำรวจเอก และจ่าสิบตำรวจ/ดาบตำรวจ)',
  },
  11275: {
    explanation:
      'ความสูงเสาธงเหนือระดับสายตาชิรา ($1.5 = \\frac{3}{2}$ เมตร) คือ $\\frac{64 + 3\\sqrt{3}}{2\\sqrt{3}} - \\frac{3}{2} = \\frac{64 + 3\\sqrt{3} - 3\\sqrt{3}}{2\\sqrt{3}} = \\frac{32}{\\sqrt{3}}$ เมตร\nจาก $\\tan 30^{\\circ} = \\frac{1}{\\sqrt{3}} = \\frac{32 / \\sqrt{3}}{d}$ ดังนั้นชิรายืนห่างจากเสาธง $d = 32$ เมตร',
  },
  11277: {
    explanation:
      '<table><tr><th>ช่วงอายุ (ปี)</th><th>จำนวนสมาชิก (คน)</th><th>จุดกึ่งกลางชั้น</th></tr><tr><td>21 - 30</td><td>16</td><td>25.5</td></tr><tr><td>31 - 40</td><td>4</td><td>35.5</td></tr><tr><td>41 - 50</td><td>10</td><td>45.5</td></tr></table>\n\nคำนวณอายุเฉลี่ย: $\\bar{x} = \\frac{(25.5 \\times 16) + (35.5 \\times 4) + (45.5 \\times 10)}{16 + 4 + 10} = \\frac{408 + 142 + 455}{30} = \\frac{1,005}{30} = 33.5$ ปี',
  },
  12822: {
    explanation:
      'พิจารณาผลต่างระหว่างพจน์ติดกัน: $+4, +8, +16$ (ผลต่างเพิ่มเป็น $2$ เท่าทุกขั้น) ขั้นถัดไปจึงบวกด้วย $32$ ได้ $30 + 32 = 62$',
  },
  12854: {
    explanation:
      'เทียบบัญญัติไตรยางศ์: ทำขนมถาด $4$ อัน ใช้น้ำตาล $7$ ถุง ถ้าต้องการทำขนมถาด $68$ อัน จะต้องใช้น้ำตาล $\\frac{7 \\times 68}{4} = 7 \\times 17 = 119$ ถุง',
  },
  12855: {
    explanation:
      'เทียบบัญญัติไตรยางศ์: ใช้น้ำตาล $16$ ถ้วย ทำขนมได้ $80$ ชิ้น ถ้าใช้น้ำตาล $7$ ถ้วย จะทำขนมได้ $\\frac{80 \\times 7}{16} = 5 \\times 7 = 35$ ชิ้น',
  },
  12856: {
    explanation:
      'เทียบบัญญัติไตรยางศ์: เงิน $30$ บาท ซื้อขนมได้ $4$ ชิ้น ถ้าซื้อขนมราคา $285$ บาท จะได้ขนม $\\frac{4 \\times 285}{30} = \\frac{1,140}{30} = 38$ ชิ้น',
  },
  12860: {
    explanation:
      'อัตราส่วน $8 : 6 : 9$ รวมเป็น $8 + 6 + 9 = 23$ ส่วน คิดเป็นเงิน $10,557$ บาท ($1$ ส่วน $= \\frac{10,557}{23} = 459$ บาท) ดังนั้นขาวได้ $8$ ส่วน คิดเป็นเงิน $8 \\times 459 = 3,672$ บาท',
  },
  12862: {
    explanation:
      'จากสูตรของผสม $C_1V_1 + C_2V_2 = C_{\\text{รวม}}V_{\\text{รวม}}$\nจะได้ $(50)(15) + (58)(25) = C_{\\text{รวม}}(15 + 25) \\Rightarrow 750 + 1,450 = 40C_{\\text{รวม}} \\Rightarrow C_{\\text{รวม}} = \\frac{2,200}{40} = 55\\%$',
  },
  12872: {
    explanation:
      'ให้ต้นทุนโทรทัศน์เท่ากับ $x$ บาท ติดป้ายรวมกำไร $25\\%$ คือ $\\frac{125}{100}x$ แล้วลดราคาจากป้าย $25\\%$ เหลือราคาขาย $\\frac{75}{100} \\times \\frac{125}{100}x = \\frac{15}{16}x$ บาท\nขาดทุน $\\frac{1}{16}x = 6,000$ บาท ดังนั้นต้นทุน $x = 6,000 \\times 16 = 96,000$ บาท',
  },
  12876: {
    stem: 'จากแผนภาพต้น-ใบแสดงน้ำหนักของนักเรียนจำนวน 25 คน (พบว่ามีนักเรียนที่น้ำหนักมากกว่า 50 กิโลกรัม จำนวน 10 คน) อยากทราบว่านักเรียนที่น้ำหนักมากกว่า 50 กิโลกรัม คิดเป็นกี่เปอร์เซ็นต์ของนักเรียนทั้งหมด',
  },
  12904: {
    explanation:
      'จากสูตรค่าเฉลี่ยรวม $\\bar{X}_{\\text{รวม}} = \\frac{N_1\\bar{X}_1 + N_2\\bar{X}_2}{N_1 + N_2} = \\frac{(15 \\times 20) + (10 \\times 18)}{15 + 10} = \\frac{300 + 180}{25} = \\frac{480}{25} = 19.2$ คะแนน',
  },
  12951: {
    explanation:
      'เอกสารสิทธิที่แสดงกรรมสิทธิ์ในที่ดิน ได้แก่ โฉนดที่ดิน โฉนดแผนที่ โฉนดตราจอง และตราจองที่ตราว่า "ได้ทำประโยชน์แล้ว" ส่วนหนังสือรับรองการทำประโยชน์ (น.ส. 3 / น.ส. 3 ก.) เป็นเพียงเอกสารแสดงสิทธิครอบครอง ไม่ใช่กรรมสิทธิ์',
  },
  12973: {
    explanation:
      'ทายาทโดยธรรม 6 ลำดับตาม ป.พ.พ. มาตรา 1629 ได้แก่ (1) ผู้สืบสันดาน (รวมบุตรบุญธรรม) (2) บิดามารดา (3) พี่น้องร่วมบิดามารดาเดียวกัน (4) พี่น้องร่วมบิดาหรือร่วมมารดาเดียวกัน (5) ปู่ ย่า ตา ยาย (6) ลุง ป้า น้า อา ส่วนคู่สมรสต้องจดทะเบียนสมรสตามกฎหมายจึงจะมีสิทธิรับมรดก ดังนั้นภริยาที่ไม่ได้จดทะเบียนสมรสจึงไม่มีสิทธิรับมรดกในฐานะทายาทโดยธรรม',
  },
  12999: {
    explanation:
      'ตาม พ.ร.บ. คุ้มครองแรงงาน กำหนดน้ำหนักสูงสุดที่ลูกจ้างยก แบก หาม หาบ ทูน ลาก หรือเข็นได้ ดังนี้ ลูกจ้างหญิงอายุตั้งแต่ 18 ปีขึ้นไป (งานปกติ) ห้ามเกิน 25 กิโลกรัม (ส่วนเด็กหญิงอายุ 15–18 ปี ห้ามเกิน 20 กิโลกรัม และเด็กชายอายุ 15–18 ปี ห้ามเกิน 25 กิโลกรัม)',
  },
  13003: {
    explanation:
      'ตาม พ.ร.บ. การทะเบียนราษฎร เมื่อมีคนเกิดต้องแจ้งต่อนายทะเบียนภายใน 15 วัน นับแต่วันเกิด (กรณีคนตายต้องแจ้งภายใน 24 ชั่วโมง และกรณีย้ายที่อยู่ต้องแจ้งภายใน 15 วัน)',
  },
  13004: {
    explanation:
      'ตาม พ.ร.บ. การทะเบียนราษฎร เมื่อมีคนตายในบ้าน เจ้าบ้านต้องแจ้งต่อนายทะเบียนแห่งท้องที่ที่ตายภายใน 24 ชั่วโมง นับแต่เวลาตายหรือเวลาพบศพ',
  },
  13039: {
    explanation:
      'หน่วยความจุข้อมูล: $1\\text{ TB} = 1,024\\text{ GB}$ ดังนั้นข้อมูลขนาด $20\\text{ GB}$ ต้องใช้อุปกรณ์ที่มีความจุมากกว่า $20\\text{ GB}$ ซึ่งในตัวเลือกมีเพียง $1\\text{ TB}$ ที่สามารถจัดเก็บได้ครบถ้วน',
  },
  13048: {
    explanation:
      'การ์ดแลน (LAN Card / Network Interface Card: NIC) ทำหน้าที่เชื่อมต่อเครื่องคอมพิวเตอร์เข้ากับระบบเครือข่ายและอินเทอร์เน็ตแบบใช้สายผ่านสายคู่บิดเกลียว (Ethernet / RJ-45)',
  },
  13049: {
    explanation:
      'เราเตอร์ (Router) ทำหน้าที่เชื่อมต่อเครือข่ายคอมพิวเตอร์หลายเครือข่ายที่ต่างวงกันเข้าด้วยกัน และเลือกเส้นทางส่งข้อมูลที่เหมาะสมที่สุด เช่น การเชื่อมเครือข่ายภายในบ้าน (LAN) ออกสู่อินเทอร์เน็ต (WAN)',
  },
  13054: {
    explanation:
      'เครือข่ายแบบดาว (Star Topology) เป็นโครงสร้างเครือข่ายที่นิยมใช้มากที่สุดในปัจจุบัน โดยทุกเครื่องเชื่อมต่อเข้ากับอุปกรณ์กระจายสัญญาณกลาง (Switch) แยกสายอิสระ หากสายของเครื่องใดชำรุดจะไม่ทำให้เครือข่ายทั้งระบบล่ม',
  },
  13060: {
    explanation:
      'โดเมนเนมระดับบนสุด `.edu` (Education) ใช้สำหรับสถาบันการศึกษา (ในประเทศไทยใช้โดเมน 3 ระดับเป็น `.ac.th` สำหรับสถาบันการศึกษา, `.go.th` สำหรับหน่วยงานรัฐ, `.co.th` สำหรับองค์กรพาณิชย์ และ `.or.th` สำหรับองค์กรไม่แสวงผลกำไร)',
  },
  13061: {
    explanation:
      'โดเมนสำหรับสถาบันการศึกษาและมหาวิทยาลัยคือ `.edu` (Education) หรือในระดับประเทศไทยใช้ `.ac.th` (Academic)',
  },
  13062: {
    explanation:
      'โดเมนเนมขององค์กรพาณิชย์หรือบริษัทเอกชนในประเทศไทยคือ `.co.th` (Commercial) ส่วน `.ac.th` คือสถาบันการศึกษา, `.mi.th` คือหน่วยงานทหาร และ `.in.th` คือบุคคลทั่วไปหรือองค์กรในไทย',
  },
  13079: {
    explanation:
      'Microsoft Word เป็นโปรแกรมประมวลผลคำ (Word Processor) สำหรับจัดทำ แก้ไข และจัดการเอกสารทั่วไป ส่วน Excel ใช้คำนวณตาราง, PowerPoint ใช้นำเสนองาน และ Access ใช้จัดการฐานข้อมูล',
  },
  13090: {
    explanation:
      'Microsoft Excel เป็นโปรแกรมตารางคำนวณ (Spreadsheet) ที่เหมาะสำหรับการประมวลผลข้อมูลตัวเลข สถิติ สูตรคำนวณ และการสรุปแผนภูมิ เช่น สถิติอุบัติเหตุ 7 วันอันตราย',
  },
  13097: {
    explanation:
      'Microsoft PowerPoint เป็นโปรแกรมสำหรับสร้างสื่อนำเสนองาน (Presentation) ด้วยสไลด์ ข้อความ รูปภาพ และภาพเคลื่อนไหว (ส่วน Paint ใช้วาดภาพ, Windows Media Player ใช้เล่นสื่อ และ Calendar ใช้จัดการปฏิทิน)',
  },
  13125: {
    explanation:
      'การลงวันที่ในหนังสือภายใน (บันทึกข้อความ) ตามระเบียบงานสารบรรณ ให้พิมพ์คำว่า "วันที่" ตามด้วยตัวเลขของวันที่ ชื่อเต็มของเดือน และตัวเลขของปีพุทธศักราชโดยไม่มีคำว่า พ.ศ. เช่น "วันที่ ๑๓ มกราคม ๒๕๖๕"',
  },
  13138: {
    explanation:
      'การลงวันที่ในรายงานการประชุม ตามระเบียบงานสารบรรณ ให้ใช้คำว่า "เมื่อวันที่" ตามด้วยวัน เดือน ปี ที่ประชุม เช่น "เมื่อวันที่ ๑๓ พฤษภาคม ๒๕๕๙"',
  },
  13166: {
    explanation:
      'ตามหลักเกณฑ์การกำหนดรหัสตัวอักษรโรมันประจำส่วนราชการของระบบสารบรรณอิเล็กทรอนิกส์ สำนักงานตำรวจแห่งชาติ ใช้รหัสอักษรโรมันคือ RTP (Royal Thai Police)',
  },
  13515: {
    explanation:
      'พิจารณาผลต่างระหว่างพจน์ติดกัน: $16 - 12 = 4$ ($2^2$), $32 - 16 = 16$ ($4^2$), $68 - 32 = 36$ ($6^2$), $132 - 68 = 64$ ($8^2$) ซึ่งเป็นกำลังสองของเลขคู่เรียงกัน ขั้นถัดไปจึงบวกด้วย $10^2 = 100$ ได้ $132 + 100 = 232$',
  },
  13521: {
    explanation:
      'จากความสัมพันธ์ของอัตราการทำงาน $\\frac{\\text{คน}_1 \\times \\text{วัน}_1}{\\text{งาน}_1} = \\frac{\\text{คน}_2 \\times \\text{วัน}_2}{\\text{งาน}_2}$ แทนค่าได้ $\\frac{6 \\times 5}{360} = \\frac{15 \\times d}{540} \\Rightarrow \\frac{30}{360} = \\frac{15d}{540} \\Rightarrow d = 3$ วัน',
  },
  13528: {
    explanation:
      'จากเงื่อนไข "ถ้าผ่านข้อเขียน ($P$) แล้วจะผ่านเกณฑ์ตรวจร่างกายเบื้องต้น ($Q$)" เมื่อทราบว่า นาย ข ไม่ผ่านเกณฑ์ตรวจร่างกายเบื้องต้น ($\\sim Q$) ตามหลักตรรกศาสตร์ (Modus Tollens) จึงสรุปได้อย่างสมเหตุสมผลว่า นาย ข ไม่ผ่านข้อเขียน ($\\sim P$)',
  },
  13626: {
    explanation:
      'แผ่น CD (Compact Disc), DVD และ Blu-ray จัดเป็นสื่อเก็บข้อมูลสำรองประเภทแสง (Optical Storage Devices) ที่ใช้ลำแสงเลเซอร์ในการอ่านและบันทึกข้อมูล',
  },
  13720: {
    explanation:
      'ตามหลักเกณฑ์การกำหนดอักษรย่อลักษณะงานต่อท้ายตำแหน่งของสำนักงานตำรวจแห่งชาติ อักษรย่อ "(บร)" หมายถึง งานบริหาร',
  },
  13744: {
    explanation:
      'การเทียบยศข้าราชการตำรวจเป็นภาษาอังกฤษแบบเต็ม: พลตำรวจเอก = Police General, พันตำรวจเอก = Police Colonel, พันตำรวจโท = Police Lieutenant Colonel และพันตำรวจตรี = Police Major ดังนั้นยศ "พันตำรวจโท" จึงใช้คำว่า Police Lieutenant Colonel',
  },
};

function repairUnclosedHtmlTableInText(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  let s = raw.replace(/<page_number[^>]*>?/gi, '').replace(/GuruPolice/gi, 'NaisibPro');

  const openCount = (s.match(/<table\b/gi) || []).length;
  const closeCount = (s.match(/<\/table>/gi) || []).length;
  if (openCount <= closeCount) return s;

  // Repair each unclosed <table ...> segment, stopping before a double newline paragraph if present
  const tableIdx = s.toLowerCase().lastIndexOf('<table');
  if (tableIdx === -1) return s;

  const before = s.slice(0, tableIdx);
  const fromTable = s.slice(tableIdx);

  // Check if there is a trailing question paragraph after \n\n (like stems #6589, #7180, #8035)
  const dblNlMatch = /\n\n(?![\s]*<(?:tr|td|th|\/))/i.exec(fromTable);
  const tableChunk = dblNlMatch ? fromTable.slice(0, dblNlMatch.index) : fromTable;
  const afterChunk = dblNlMatch ? fromTable.slice(dblNlMatch.index) : '';

  // Keep all complete <tr>...</tr> rows; also salvage complete <td>/<th> cells in a trailing partial <tr>
  const completeRows = [];
  const rowRe = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
  let m;
  let lastRowEnd = 0;
  while ((m = rowRe.exec(tableChunk)) !== null) {
    // Fix nested malformed <th colspan="2">X<td>Y</td></th> -> <th>X</th><td>Y</td>
    let rowHtml = m[0].replace(
      /<th([^>]*)>([^<]*)<td>([\s\S]*?)<\/td><\/th>/gi,
      '<th$1>$2</th><td>$3</td>'
    );
    completeRows.push(rowHtml);
    lastRowEnd = m.index + m[0].length;
  }

  const tailAfterRows = tableChunk.slice(lastRowEnd);
  const trStartInTail = tailAfterRows.search(/<tr\b/i);
  if (trStartInTail !== -1) {
    const partialTr = tailAfterRows.slice(trStartInTail);
    const completeCells = partialTr.match(/<(?:td|th)\b[^>]*>[\s\S]*?<\/(?:td|th)>/gi) || [];
    // Also salvage trailing unclosed <td>text if text has meaningful content (>= 4 chars)
    const lastCellIdx = partialTr.toLowerCase().lastIndexOf('<td');
    if (lastCellIdx !== -1) {
      const afterTdOpen = partialTr.slice(lastCellIdx);
      if (!/<\/td>/i.test(afterTdOpen)) {
        const gtIdx = afterTdOpen.indexOf('>');
        if (gtIdx !== -1) {
          let inner = afterTdOpen
            .slice(gtIdx + 1)
            .replace(/<[a-zA-Z\/][^>]*$/g, '')
            .replace(/<(?:ol|ul|li)\b[^>]*>/gi, ' ')
            .replace(/<\/(?:ol|ul|li)>/gi, ' ')
            .trim();
          if (inner.length >= 4) {
            completeCells.push(`<td>${inner}</td>`);
          }
        }
      }
    }
    if (completeCells.length > 0) {
      completeRows.push(`<tr>${completeCells.join('')}</tr>`);
    }
  }

  const rebuiltTable =
    completeRows.length > 0 ? `<table>${completeRows.join('')}</table>` : '';
  return `${before}${rebuiltTable}${afterChunk}`.trim();
}

const rawQuestions = JSON.parse(fs.readFileSync(ALL_Q_PATH, 'utf8'));
let modifiedCount = 0;

for (const q of rawQuestions) {
  const beforeJson = JSON.stringify([q.stem, q.explanation, q.opts]);

  const explicit = EXPLICIT_FIXES[q.id];
  if (explicit) {
    if (explicit.stem !== undefined) q.stem = explicit.stem;
    if (explicit.explanation !== undefined) q.explanation = explicit.explanation;
  }

  if (typeof q.stem === 'string') {
    q.stem = repairUnclosedHtmlTableInText(q.stem);
  }
  if (typeof q.explanation === 'string') {
    q.explanation = repairUnclosedHtmlTableInText(q.explanation);
  }
  if (Array.isArray(q.opts)) {
    q.opts = q.opts.map((o) => (typeof o === 'string' ? repairUnclosedHtmlTableInText(o) : o));
  }

  if (JSON.stringify([q.stem, q.explanation, q.opts]) !== beforeJson) {
    modifiedCount++;
  }
}

console.log(`Repaired ${modifiedCount} questions in memory.`);

// Verify ZERO remaining corruptions across all 7,038 questions
const verifyErrors = [];
for (const q of rawQuestions) {
  for (const [f, val] of [
    ['stem', q.stem || ''],
    ['exp', q.explanation || ''],
    ...(q.opts || []).map((o, i) => [`opt${i}`, o || '']),
  ]) {
    if (/page_number|<page/i.test(val)) verifyErrors.push(`${q.id}:${f}:page_number`);
    if (/gurupolice/i.test(val)) verifyErrors.push(`${q.id}:${f}:gurupolice`);
    const ot = (val.match(/<table\b/gi) || []).length;
    const ct = (val.match(/<\/table>/gi) || []).length;
    if (ot !== ct) verifyErrors.push(`${q.id}:${f}:unclosed_table(${ot}!=${ct})`);
    const dd = (val.match(/\$\$/g) || []).length;
    if (dd % 2 !== 0) verifyErrors.push(`${q.id}:${f}:unclosed_$$`);
  }
}
if (verifyErrors.length > 0) {
  console.error('Verification failed:', verifyErrors);
  process.exit(1);
}
console.log('Dataset integrity audit passed: 0 corruptions across all 7,038 questions.');

// 2. Rebuild Fixed Sets (set-201..215 and set-101..106) from Pure Practice Pool
//    Strictly <= 3 questions per sub-topic, interleaved (no consecutive duplicate topic),
//    official 1-150 order (math -> thai -> com -> doc -> law -> eng), 0 overlap with real-1..4!
const realTsContent = fs.readFileSync(REAL_SETS_TS, 'utf8');
const realExamIds = new Set();
for (const setId of ['real-1', 'real-2', 'real-3', 'real-4']) {
  const re = new RegExp(`id:\\s*"${setId}"[\\s\\S]*?questionIds:\\s*\\[([^\\]]+)\\]`);
  const m = re.exec(realTsContent);
  if (!m) throw new Error(`Missing ${setId} in real-exam-sets.ts`);
  for (const tok of m[1].split(',')) {
    const id = Number(tok.trim());
    if (Number.isFinite(id) && id > 0) realExamIds.add(id);
  }
}

const byId = new Map(rawQuestions.map((q) => [q.id, q]));
const OFFICIAL_ORDER = ['math', 'thai', 'com', 'doc', 'law', 'eng'];
const OFFICIAL_WEIGHTS = { math: 20, thai: 20, com: 40, doc: 30, law: 25, eng: 15 };
const MAX_PER_TOPIC = 3;

const practicePool = rawQuestions.filter(
  (q) => !realExamIds.has(q.id) && q.subject_key !== 'soc'
);

function createTopicMapForPool(pool) {
  const subjMap = new Map();
  for (const sk of OFFICIAL_ORDER) subjMap.set(sk, new Map());
  for (const q of pool) {
    const m = subjMap.get(q.subject_key);
    if (!m) continue;
    const tk = normalizeTopicTitleKey(q.title);
    if (!m.has(tk)) m.set(tk, []);
    m.get(tk).push(q.id);
  }
  for (const [, m] of subjMap) {
    for (const [, arr] of m) arr.sort((a, b) => a - b);
  }
  return subjMap;
}

const subjTopicsFor200 = createTopicMapForPool(practicePool);

function pickFromSubjectCapped(m, sk, want, usedTopic, maxCap) {
  const out = [];
  let lastTk = '';
  while (out.length < want) {
    const cands = [];
    for (const [tk, arr] of m.entries()) {
      const u = usedTopic.get(`${sk}::${tk}`) || 0;
      if (arr.length > 0 && u < maxCap) {
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
    const qid = best.arr.shift();
    out.push({ id: qid, tk: best.tk });
    usedTopic.set(`${sk}::${best.tk}`, best.u + 1);
    lastTk = best.tk;
  }
  return out;
}

function interleaveByTopicOrder(items) {
  if (items.length <= 2) return items;
  const groups = new Map();
  for (const it of items) {
    if (!groups.has(it.tk)) groups.set(it.tk, []);
    groups.get(it.tk).push(it);
  }
  const out = [];
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
    out.push(arr.shift());
    lastTk = tk;
  }
  return out;
}

const built200Sets = [];
for (let i = 0; i < 15; i++) {
  const usedTopic = new Map();
  const perSubj = new Map(OFFICIAL_ORDER.map((sk) => [sk, []]));
  let total = 0;

  for (const sk of OFFICIAL_ORDER) {
    const picked = pickFromSubjectCapped(
      subjTopicsFor200.get(sk),
      sk,
      OFFICIAL_WEIGHTS[sk],
      usedTopic,
      MAX_PER_TOPIC
    );
    perSubj.get(sk).push(...picked);
    total += picked.length;
  }

  // Top up to 150 while still strictly enforcing <= MAX_PER_TOPIC per sub-topic
  let guard = 0;
  while (total < 150 && guard < 500) {
    guard++;
    let progressed = false;
    for (const sk of OFFICIAL_ORDER) {
      if (total >= 150) break;
      const extra = pickFromSubjectCapped(
        subjTopicsFor200.get(sk),
        sk,
        1,
        usedTopic,
        MAX_PER_TOPIC
      );
      if (extra.length > 0) {
        perSubj.get(sk).push(...extra);
        total += extra.length;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  if (total !== 150) {
    throw new Error(`Set ${201 + i} failed to reach 150 questions (got ${total})`);
  }

  // Interleave any topped-up items cleanly inside each subject so adjacent items never share a topic
  const finalIds = [];
  for (const sk of OFFICIAL_ORDER) {
    const items = interleaveByTopicOrder(perSubj.get(sk));
    finalIds.push(...items.map((x) => x.id));
  }
  built200Sets.push(finalIds);
}

// Rebuild set-101..106 (20 questions each, <= 2-3 per sub-topic, 0 real-exam overlap)
const subjTopicsFor100 = createTopicMapForPool(practicePool);
const built100Sets = new Map();
const SET_100_MAP = [
  ['101', 'math'],
  ['102', 'thai'],
  ['103', 'eng'],
  ['104', 'com'],
  ['105', 'doc'],
  ['106', 'law'],
];
for (const [sid, sk] of SET_100_MAP) {
  const usedTopic = new Map();
  const picked = interleaveByTopicOrder(
    pickFromSubjectCapped(subjTopicsFor100.get(sk), sk, 20, usedTopic, 3)
  );
  built100Sets.set(sid, picked.map((x) => x.id));
}

// Update set_id references or write files cleanly
fs.writeFileSync(ALL_Q_PATH, JSON.stringify(rawQuestions, null, 2) + '\n', 'utf8');

// Write subject files (math.json..soc.json)
for (const sk of ['math', 'thai', 'eng', 'com', 'doc', 'law', 'soc']) {
  const subArr = rawQuestions.filter((q) => q.subject_key === sk);
  fs.writeFileSync(
    path.join(BY_SUBJ_DIR, `${sk}.json`),
    JSON.stringify(subArr, null, 2) + '\n',
    'utf8'
  );
}

// Write set-101..106.json & sync set-107.json question texts
for (const [sid, ids] of built100Sets.entries()) {
  const records = ids.map((id) => byId.get(id));
  fs.writeFileSync(
    path.join(BY_SET_DIR, `set-${sid}.json`),
    JSON.stringify(records, null, 2) + '\n',
    'utf8'
  );
}
const set107Path = path.join(BY_SET_DIR, 'set-107.json');
if (fs.existsSync(set107Path)) {
  const old107 = JSON.parse(fs.readFileSync(set107Path, 'utf8'));
  const refreshed107 = old107.map((it) => byId.get(it.id) || it);
  fs.writeFileSync(set107Path, JSON.stringify(refreshed107, null, 2) + '\n', 'utf8');
}

// Write set-201..215.json and verify maxPerTopic <= 3 on every set
const assignedSetIds = new Set();
for (let i = 0; i < 15; i++) {
  const sid = 201 + i;
  const ids = built200Sets[i];
  const topicCounts = {};
  for (const id of ids) {
    assignedSetIds.add(id);
    if (realExamIds.has(id)) throw new Error(`Real exam leak in set-${sid}: ${id}`);
    const q = byId.get(id);
    const k = `${q.subject_key}:${normalizeTopicTitleKey(q.title)}`;
    topicCounts[k] = (topicCounts[k] || 0) + 1;
    if (topicCounts[k] > 3) {
      throw new Error(`Topic cap exceeded in set-${sid}: ${k} = ${topicCounts[k]}`);
    }
  }
  const records = ids.map((id) => byId.get(id));
  fs.writeFileSync(
    path.join(BY_SET_DIR, `set-${sid}.json`),
    JSON.stringify(records, null, 2) + '\n',
    'utf8'
  );
}

// Sync set-unassigned.json if present
const unassignedPath = path.join(BY_SET_DIR, 'set-unassigned.json');
if (fs.existsSync(unassignedPath)) {
  fs.writeFileSync(unassignedPath, JSON.stringify(rawQuestions, null, 2) + '\n', 'utf8');
}

console.log(
  `Successfully rebuilt set-101..106 and set-201..215 (${assignedSetIds.size} distinct practice questions, 0 real-exam overlap, maxPerTopic <= 3 on all sets).`
);

import type { Metadata } from 'next';
import { Prompt, Sarabun, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeAndBrandProvider } from '@/components/ThemeAndBrandProvider';
import { WorkspaceModeProvider } from '@/components/WorkspaceModeProvider';

const prompt = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['500', '600', '700'],
  variable: '--font-prompt',
  display: 'swap',
});

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sarabun',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-mono',
  display: 'swap',
});

const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (BASE_PATH ? `https://muaxzinn.github.io${BASE_PATH}` : 'https://naisibpro.vercel.app');

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'นายสิบ โปร — ติวสอบนายสิบตำรวจ ตัวจริง',
  description:
    'คลังข้อสอบนายสิบตำรวจ 7,038 ข้อ ครบ 7 วิชา เฉลยละเอียด วิเคราะห์จุดอ่อนรายหัวข้อ และโหมดสอบจับเวลาเสมือนจริง',
  manifest: `${BASE_PATH}/manifest.webmanifest`,
  icons: {
    icon: [
      { url: `${BASE_PATH}/icon.svg`, type: 'image/svg+xml' },
      { url: `${BASE_PATH}/favicon.ico`, sizes: 'any' },
    ],
    apple: `${BASE_PATH}/apple-icon.png`,
  },
  openGraph: {
    title: 'นายสิบ โปร — ติวสอบนายสิบตำรวจ ตัวจริง',
    description: 'คลังข้อสอบ 7,038 ข้อ · ฝึกฟรี ไม่ต้องสมัคร · ครบ 7 วิชา พร้อมเฉลยละเอียด',
    type: 'website',
    locale: 'th_TH',
    images: [
      {
        url: `${BASE_PATH}/og-banner.png`,
        width: 1200,
        height: 630,
        alt: 'นายสิบ โปร — ติวสอบนายสิบตำรวจ ตัวจริง',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'นายสิบ โปร — ติวสอบนายสิบตำรวจ ตัวจริง',
    description: 'คลังข้อสอบ 7,038 ข้อ · ฝึกฟรี ไม่ต้องสมัคร · ครบ 7 วิชา พร้อมเฉลยละเอียด',
    images: [`${BASE_PATH}/og-banner.png`],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="th"
      data-theme="light"
      data-brand="blue"
      suppressHydrationWarning
      className={`${prompt.variable} ${sarabun.variable} ${mono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('gp:theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t;}var b=localStorage.getItem('gp:brand');if(b){document.documentElement.dataset.brand=b;}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-bg font-sans text-ink antialiased selection:bg-brand/20 selection:text-ink">
        <ThemeAndBrandProvider>
          <WorkspaceModeProvider>{children}</WorkspaceModeProvider>
        </ThemeAndBrandProvider>
      </body>
    </html>
  );
}


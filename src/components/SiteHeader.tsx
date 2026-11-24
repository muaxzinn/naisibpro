'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Archive,
  BarChart3,
  BookmarkCheck,
  BookMarked,
  BookOpenCheck,
  Check,
  ChevronDown,
  Database,
  Flame,
  History,
  Home,
  Layers,
  Menu,
  Moon,
  Palette,
  PenLine,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Wrench,
  X,
} from 'lucide-react';
import { BRAND_PALETTES, isNavItemActive } from '@/lib/constants';
import { useThemeAndBrand } from './ThemeAndBrandProvider';
import { useWorkspaceMode, type WorkspaceMode } from './WorkspaceModeProvider';

export function ThemeAndBrandControls() {
  const { theme, brand, toggleTheme, setBrand } = useThemeAndBrand();
  const [openPalette, setOpenPalette] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpenPalette(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activePalette = BRAND_PALETTES.find((p) => p.key === brand) || BRAND_PALETTES[0];

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="สลับโหมดสว่างและมืด"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panel text-ink transition-colors hover:border-brand/50 hover:text-brand"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4 text-gold" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="relative" ref={popRef}>
        <button
          type="button"
          onClick={() => setOpenPalette((o) => !o)}
          aria-label="เปลี่ยนสีธีม"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panel transition-colors hover:border-brand/50"
        >
          <span
            className="h-4 w-4 rounded-full shadow-inner"
            style={{ background: activePalette.gradient }}
          />
        </button>

        {openPalette && (
          <div className="absolute right-0 top-11 z-50 w-44 rounded-2xl border border-line bg-panel p-2 shadow-card">
            <div className="mb-1 flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold text-muted">
              <Palette className="h-3.5 w-3.5" />
              <span>เลือกโทนสีระบบ</span>
            </div>
            <div className="space-y-1">
              {BRAND_PALETTES.map((p) => {
                const selected = p.key === brand;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setBrand(p.key);
                      setOpenPalette(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors ${
                      selected ? 'bg-brand/10 text-brand' : 'text-ink hover:bg-bg2'
                    }`}
                  >
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-full shadow-inner"
                      style={{ background: p.gradient }}
                    >
                      {selected && <Check className="h-2.5 w-2.5 text-white stroke-[3]" />}
                    </span>
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PRIMARY_APP_NAV = [
  { href: '/dashboard', label: 'แดชบอร์ด', icon: PenLine },
  { href: '/catalog', label: 'ชุดข้อสอบ', icon: BookMarked },
  { href: '/catalog/subject', label: 'แยกรายวิชา', icon: Layers },
  { href: '/catalog/topics', label: 'หัวข้อย่อย', icon: BookOpenCheck },
  { href: '/weakness', label: 'จุดอ่อน', icon: BarChart3 },
  { href: '/catalog/review', label: 'คลังทบทวน', icon: BookmarkCheck },
  { href: '/catalog/completed', label: 'ที่ทำแล้ว', icon: Archive },
];

const SECONDARY_APP_NAV = [
  { href: '/bank', label: 'คลังข้อสอบทั้งหมด', icon: Database },
  { href: '/history', label: 'ประวัติการสอบ', icon: History },
  { href: '/reports', label: 'แจ้งปัญหาข้อสอบ', icon: Wrench },
  { href: '/admin', label: 'จัดการระบบ (Admin)', icon: SlidersHorizontal },
  { href: '/', label: 'หน้าหลัก', icon: Home },
];

const APP_NAV = [...PRIMARY_APP_NAV, ...SECONDARY_APP_NAV];

const MOBILE_BOTTOM_NAV = [
  { href: '/dashboard', label: 'แดชบอร์ด', icon: PenLine },
  { href: '/catalog/form', label: 'ชุดข้อสอบ', icon: BookMarked },
  { href: '/catalog/subject', label: 'แยกวิชา', icon: Layers },
  { href: '/catalog/topics', label: 'หัวข้อ', icon: BookOpenCheck },
  { href: '/weakness', label: 'จุดอ่อน', icon: BarChart3 },
  { href: '/catalog/review', label: 'ทบทวน', icon: BookmarkCheck },
  { href: '/catalog/completed', label: 'ทำแล้ว', icon: Archive },
];

const PUBLIC_NAV = [
  { href: '/#features', label: 'จุดเด่น' },
  { href: '/#tracks', label: 'สายงานที่เปิดสอบ' },
  { href: '/articles', label: 'บทความ' },
  { href: '/news', label: 'ข่าวรับสมัคร' },
  { href: '/bank', label: 'คลังข้อสอบ' },
];

export function SiteHeader({ mode = 'app' }: { mode?: 'public' | 'app' }) {
  const pathname = usePathname();
  const router = useRouter();
  const { workspaceMode, setWorkspaceMode } = useWorkspaceMode();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const handleGlobalModeSwitch = (next: WorkspaceMode) => {
    setWorkspaceMode(next);
    if (pathname === '/catalog/real-exam' && next === 'practice') {
      router.push('/catalog/form');
    } else if (pathname === '/catalog/form' && next === 'real-exam') {
      // stays on /catalog/form which renders real-exam mode in-place
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-panel/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2.5 font-display text-base font-bold tracking-tight text-ink sm:text-[17px]">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
              <ShieldCheck className="h-4.5 w-4.5" />
            </span>
            <span>
              นายสิบ <span className="text-brand">โปร</span>
            </span>
          </Link>

          {mode === 'app' ? (
            <nav className="hidden items-center gap-1 lg:flex">
              {PRIMARY_APP_NAV.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(pathname, item.href, false);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                      active
                        ? 'bg-brand/10 font-semibold text-brand'
                        : 'font-medium text-muted hover:bg-bg2 hover:text-ink'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              <div className="relative" ref={moreRef}>
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-expanded={moreOpen}
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                    SECONDARY_APP_NAV.some((s) => s.href !== '/' && isNavItemActive(pathname, s.href, false))
                      ? 'bg-brand/10 font-semibold text-brand'
                      : 'font-medium text-muted hover:bg-bg2 hover:text-ink'
                  }`}
                >
                  <span>เพิ่มเติม</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {moreOpen && (
                  <div className="absolute right-0 top-10 z-50 w-48 rounded-xl border border-line bg-panel p-1.5 shadow-card">
                    {SECONDARY_APP_NAV.map((item) => {
                      const Icon = item.icon;
                      const active = isNavItemActive(pathname, item.href, false);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
                            active
                              ? 'bg-brand/10 font-semibold text-brand'
                              : 'font-medium text-ink hover:bg-bg2'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 text-muted" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </nav>
          ) : (
          <nav className="hidden items-center gap-5 lg:flex">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap text-sm font-medium text-muted transition-colors hover:text-brand"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {mode === 'app' && (
            <div
              role="group"
              aria-label="สลับโหมดฝึกปกติและสนามจริง"
              className="inline-flex shrink-0 items-center rounded-full border border-line bg-bg2 p-0.5 text-xs font-bold whitespace-nowrap"
            >
              <button
                type="button"
                onClick={() => handleGlobalModeSwitch('practice')}
                className={`whitespace-nowrap rounded-full px-3 py-1 transition-colors ${
                  workspaceMode === 'practice'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                ฝึกปกติ
              </button>
              <button
                type="button"
                onClick={() => handleGlobalModeSwitch('real-exam')}
                className={`inline-flex whitespace-nowrap items-center gap-1 rounded-full px-3 py-1 transition-colors ${
                  workspaceMode === 'real-exam'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <Flame className="h-3.5 w-3.5 shrink-0" />
                <span>สนามจริง</span>
              </button>
            </div>
          )}

          <ThemeAndBrandControls />

          {mode === 'public' && (
            <Link
              href="/dashboard"
              className="hidden items-center gap-2 rounded-btn bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark sm:inline-flex"
            >
              <BookMarked className="h-4 w-4" />
              <span>เริ่มทำข้อสอบ</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="เปิดเมนูมือถือ"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-panel text-ink lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-panel px-4 py-3 lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            {(mode === 'app'
              ? APP_NAV
              : [...PUBLIC_NAV.map((p) => ({ ...p, icon: BookMarked })), { href: '/dashboard', label: 'เข้าทำข้อสอบ', icon: PenLine }]
            ).map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-xl border border-line bg-bg2 px-3 py-2.5 text-xs font-semibold text-ink hover:border-brand/50 hover:text-brand"
                >
                  <Icon className="h-4 w-4 text-brand" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      </header>

      {mode === 'app' && workspaceMode === 'real-exam' && (
        <div className="border-b border-accent/25 bg-accent/[0.08] px-4 py-1.5 text-center text-xs font-semibold text-accent">
          <span className="inline-flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 shrink-0" />
            <span>
              กำลังอยู่ในโหมด <strong>สนามจริง</strong> (4 ชุดล็อกแยก · 643 ข้อ · สัดส่วนรุ่น 2569) — ทุกหน้ากำลังแสดงเฉพาะข้อมูลสนามจริง
            </span>
          </span>
        </div>
      )}

      {mode === 'app' && (
        <nav
          aria-label="แถบนำทางมือถือ"
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 w-full max-w-[100vw] overflow-hidden border-t border-line bg-panel/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
        >
          <div className="mx-auto grid w-full max-w-xl grid-cols-7 px-0.5">
            {MOBILE_BOTTOM_NAV.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname, item.href, true);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 px-0.5 text-[10px] sm:text-[11px] font-bold leading-tight transition-colors ${
                    active ? 'text-brand' : 'text-muted hover:text-ink'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="w-full truncate text-center">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}


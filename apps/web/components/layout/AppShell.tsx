'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface AppShellProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export default function AppShell({ sidebar, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const myPageHref = useMemo(() => {
    if (pathname?.startsWith('/admin')) return '/admin';
    return '/agency/mypage';
  }, [pathname]);

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setIsAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAccountMenuOpen(false);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  const handleLogout = () => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // 쿠키 토큰도 제거
      document.cookie = 'token=; Path=/; Max-Age=0; SameSite=Lax';
    } catch {
      // ignore
    }

    setIsAccountMenuOpen(false);
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Header */}
      <header className="h-14 border-b border-[var(--border)] flex items-center justify-between px-6 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--brand)] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-base font-bold text-[var(--text)]">피크마케팅</h1>
          </div>
          <span className="text-xs text-[var(--muted)] hidden sm:inline">원고 생성 · 관리</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 검색 */}
          <div className="relative hidden md:block">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="검색..."
              className="w-56 pl-9 pr-3 py-2 text-sm rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10 transition-all"
            />
          </div>
          {/* 알림 */}
          <button className="p-2 hover:bg-[var(--bg)] rounded-lg transition-colors text-[var(--muted)] hover:text-[var(--text)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          {/* 계정 */}
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              className="p-2 hover:bg-[var(--bg)] rounded-lg transition-colors text-[var(--muted)] hover:text-[var(--text)]"
              aria-label="계정 메뉴"
              aria-haspopup="menu"
              aria-expanded={isAccountMenuOpen}
              onClick={() => setIsAccountMenuOpen((prev) => !prev)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>

            {isAccountMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-40 rounded-xl border border-[var(--border)] bg-white shadow-lg overflow-hidden z-50"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--bg)] text-[var(--text)] transition-colors"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    router.push(myPageHref);
                  }}
                >
                  마이페이지
                </button>
                <div className="border-t border-[var(--border-light)]" />
                <button
                  type="button"
                  role="menuitem"
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--bg)] text-[var(--danger)] transition-colors"
                  onClick={handleLogout}
                >
                  로그아웃
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-[240px] min-h-[calc(100vh-3.5rem)] bg-white border-r border-[var(--border)] sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          {sidebar}
        </aside>
        {/* Main Content */}
        <main className="flex-1 p-6 min-h-[calc(100vh-3.5rem)]">{children}</main>
      </div>
    </div>
  );
}


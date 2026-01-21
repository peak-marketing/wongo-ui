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
    <div
      className="min-h-screen text-[var(--text)]"
      style={{ background: 'linear-gradient(180deg,#0B0F12 0%, #0E1622 100%)' }}
    >
      <header className="h-12 border-b border-white/10 flex items-center justify-between px-4 bg-[var(--panel)]">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">피크마케팅 원고 프로그램</h1>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            원고 생성 및 관리 시스템
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* 검색 */}
          <input
            type="text"
            placeholder="검색..."
            className="input-dark w-64 text-sm"
          />
          {/* 알림 */}
          <button className="p-2 hover:bg-white/5 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          {/* 계정 */}
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              className="p-2 hover:bg-white/5 rounded-lg"
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
                className="absolute right-0 mt-2 w-36 rounded-lg border border-white/10 bg-[var(--panel)] overflow-hidden"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                  onClick={() => {
                    setIsAccountMenuOpen(false);
                    router.push(myPageHref);
                  }}
                >
                  마이페이지
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
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
        <aside className="w-[260px] border-r border-white/10 bg-[var(--panel)] min-h-[calc(100vh-3rem)]">
          {sidebar}
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}


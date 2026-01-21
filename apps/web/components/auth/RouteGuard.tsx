'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import toast from 'react-hot-toast';

interface RouteGuardProps {
  children: ReactNode;
  requiredRole?: 'AGENCY' | 'ADMIN';
}

export default function RouteGuard({ children, requiredRole }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);
  const [stuckFallback, setStuckFallback] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const redirectingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let didFinishCheck = false;

    let fallbackTimer: number | null = null;
    const clearFallbackTimer = () => {
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const buildLoginUrl = (reason: string) => {
      try {
        const from = pathname || '/';
        return `/auth/login?reason=${encodeURIComponent(reason)}&from=${encodeURIComponent(from)}`;
      } catch {
        return '/auth/login';
      }
    };

    const redirectTo = (target: string) => {
      clearFallbackTimer();

      if (redirectingRef.current) return;
      redirectingRef.current = true;
      setRedirectTarget(target);

      // 무조건 화면이 바뀌게 하드 리다이렉트 우선
      try {
        if (window.location.pathname + window.location.search !== target) {
          window.location.replace(target);
          return;
        }
      } catch {
        // ignore
      }

      try {
        router.replace(target);
      } catch {
        // ignore
      }

      // next/navigation이 간헐적으로 먹지 않거나 hydration 이슈가 있을 때를 대비한 폴백
      try {
        const current = window.location.pathname + window.location.search;
        if (current === target) return;
        window.setTimeout(() => {
          try {
            const now = window.location.pathname + window.location.search;
            if (now !== target) {
              window.location.href = target;
            }
          } catch {
            // ignore
          }
        }, 150);
      } catch {
        // ignore
      }
    };

    // next/navigation 또는 localStorage 접근 문제로 체크가 멈추는 케이스에 대비
    fallbackTimer = window.setTimeout(() => {
      if (cancelled) return;
      // 정상적으로 인증 체크가 끝났으면 fallback이 동작하면 안 됨
      if (didFinishCheck) return;
      setStuckFallback(true);
      setBlockReason('timeout');
      redirectTo(buildLoginUrl('timeout'));
    }, 2500);

    const decodeJwtPayload = (jwt: string): any | null => {
      try {
        const parts = String(jwt || '').split('.');
        if (parts.length < 2) return null;
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const padLen = (4 - (base64.length % 4)) % 4;
        const padded = base64 + '='.repeat(padLen);
        const json = decodeURIComponent(
          Array.prototype.map
            .call(atob(padded), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join(''),
        );
        return JSON.parse(json);
      } catch {
        return null;
      }
    };

    const checkAuth = () => {
      const safeGet = (key: string) => {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      };

      const getCookie = (key: string) => {
        try {
          const nameEq = `${encodeURIComponent(key)}=`;
          const parts = String(document.cookie || '').split(';');
          for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.startsWith(nameEq)) {
              return decodeURIComponent(trimmed.slice(nameEq.length));
            }
          }
          return null;
        } catch {
          return null;
        }
      };

      const safeSet = (key: string, value: string) => {
        try {
          localStorage.setItem(key, value);
        } catch {
          // ignore
        }
      };

      const token = safeGet('token') || getCookie('token');
      const userStr = safeGet('user');
      
      if (!token) {
        setBlockReason('no_token');
        redirectTo(buildLoginUrl('no_token'));
        return;
      }

      // user가 없거나 깨져도 token 기반으로 role을 복구해서 진행
      let user: any | null = null;
      if (userStr) {
        try {
          user = JSON.parse(userStr);
        } catch {
          user = null;
        }
      }

      if (!user) {
        const payload = decodeJwtPayload(token);
        const roleFromToken = payload?.role || payload?.user?.role;
        if (roleFromToken) {
          user = { role: roleFromToken };
          safeSet('user', JSON.stringify(user));
        }
      }

      if (!user) {
        setBlockReason('no_user');
        redirectTo(buildLoginUrl('no_user'));
        return;
      }

      try {
        const userRole = user.role;

        // 역할 체크
        if (requiredRole) {
          if (userRole && userRole !== requiredRole) {
            toast.error('접근 권한이 없습니다');
            if (userRole === 'ADMIN') {
              redirectTo('/admin');
            } else if (userRole === 'AGENCY') {
              redirectTo('/agency');
            } else {
              setBlockReason('role_mismatch');
              redirectTo(buildLoginUrl('role_mismatch'));
            }
            return;
          }
        }

        setIsChecking(false);
        setStuckFallback(false);
        setBlockReason(null);
        redirectingRef.current = false;
        didFinishCheck = true;
        clearFallbackTimer();
      } catch (error) {
        console.error('Failed to parse user data', error);
        setBlockReason('parse_error');
        redirectTo(buildLoginUrl('parse_error'));
      }
    };

    try {
      checkAuth();
    } catch (error) {
      console.error('Auth check failed', error);
      setBlockReason('check_failed');
      redirectTo(buildLoginUrl('check_failed'));
    }

    return () => {
      cancelled = true;
      clearFallbackTimer();
    };
  }, [router, pathname, requiredRole]);

  if (isChecking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg,#0B0F12 0%, #0E1622 100%)',
          color: 'var(--muted)',
          padding: '16px',
        }}
      >
        <div style={{ fontSize: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div>{redirectTarget ? '이동 중...' : '로딩 중...'}</div>
          {blockReason ? (
            <div style={{ fontSize: '12px', opacity: 0.9 }}>
              사유: {blockReason}
            </div>
          ) : null}
          {stuckFallback ? (
            <button
              className="btn-outline"
              onClick={() => {
                const reason = blockReason || 'timeout';
                try {
                  const from = window.location.pathname + window.location.search;
                  window.location.href = `/auth/login?reason=${encodeURIComponent(reason)}&from=${encodeURIComponent(from)}`;
                } catch {
                  window.location.href = '/auth/login';
                }
              }}
            >
              로그인 페이지로 이동
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}


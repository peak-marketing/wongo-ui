'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { getApiBaseUrl } from '@/lib/api';

export default function AuthLoginPage() {
  const router = useRouter();
  const shownReasonRef = useRef<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason');
    if (!reason) return;
    if (shownReasonRef.current === reason) return;
    shownReasonRef.current = reason;

    const messageMap: Record<string, string> = {
      no_token: '로그인이 필요합니다 (토큰 없음)',
      no_user: '로그인이 필요합니다 (사용자 정보 없음)',
      role_mismatch: '권한이 없어 로그아웃되었습니다',
      timeout: '인증 확인이 지연되어 로그인 화면으로 이동했습니다',
      parse_error: '로그인 정보 처리 중 오류가 발생했습니다',
      check_failed: '인증 확인 중 오류가 발생했습니다',
    };

    toast.error(messageMap[reason] || `로그인이 필요합니다 (${reason})`);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const apiBase = getApiBaseUrl();

      const res = await fetch(
        `${apiBase}/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
          credentials: 'include',
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMessage = data?.message || '로그인 실패';
        toast.error(errorMessage);
        return;
      }

      const token = data.access_token || data.accessToken;
      if (token) {
        localStorage.setItem('token', token);

        // 쿠키에도 저장해서 새로고침/스토리지 이슈 시에도 복구 가능하게
        try {
          document.cookie = `token=${encodeURIComponent(token)}; Path=/; SameSite=Lax`;
        } catch {
          // ignore
        }
      }

      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      const role = data.role || data.user?.role;
      if (role === 'ADMIN') {
        router.replace('/admin');
      } else if (role === 'AGENCY') {
        router.replace('/agency');
      } else {
        router.replace('/');
      }

      toast.success('로그인 성공');
    } catch (error: any) {
      toast.error(error.message || '로그인 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(180deg,#0B0F12 0%, #0E1622 100%)' }}
    >
      <div className="w-full max-w-[420px]">
        <div className="card">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
              피크마케팅 원고 프로그램
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              원고 생성 및 관리 시스템
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-dark w-full"
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-dark w-full"
                placeholder="••••••••"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-brand w-full">
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => router.push('/auth/signup')}
              className="text-sm"
              style={{ color: 'var(--brand)' }}
            >
              아직 계정이 없으신가요? 회원가입
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

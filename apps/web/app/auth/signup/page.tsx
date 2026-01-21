'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getApiBaseUrl } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [businessRegNo, setBusinessRegNo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessName.trim() || !businessRegNo.trim() || !email.trim() || !password.trim()) {
      toast.error('필수 항목을 모두 입력해주세요');
      return;
    }

    if (password.length < 8 || password.length > 64) {
      toast.error('비밀번호는 8자 이상 64자 이하여야 합니다');
      return;
    }

    const regNoClean = businessRegNo.trim();
    if (!/^[0-9-]+$/.test(regNoClean)) {
      toast.error('사업자 등록 번호는 숫자와 하이픈만 입력 가능합니다');
      return;
    }

    setLoading(true);

    try {
      const base = getApiBaseUrl();
      const res = await fetch(
        `${base}/auth/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessName: businessName.trim(),
            businessRegNo: regNoClean,
            email: email.trim(),
            password,
            displayName: displayName.trim() || undefined,
          }),
          credentials: 'include',
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMessage = data?.message || '회원가입 실패';
        toast.error(errorMessage);
        return;
      }

      toast.success('신청이 접수되었습니다. 어드민 승인 후 로그인 가능합니다.');
      router.push('/auth/login');
    } catch (error: any) {
      toast.error(error.message || '회원가입 실패');
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
              회원가입 신청
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              사업자 정보를 입력하고 승인을 요청하세요
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                사업자명 <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="input-dark w-full"
                placeholder="사업자명을 입력하세요"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                사업자 등록 번호 <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                value={businessRegNo}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  if (/^[0-9-]*$/.test(nextValue)) {
                    setBusinessRegNo(nextValue);
                  }
                }}
                className="input-dark w-full"
                placeholder="123-45-67890"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                이메일 <span style={{ color: 'var(--danger)' }}>*</span>
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
                비밀번호 <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-dark w-full"
                placeholder="8자 이상 64자 이하"
                required
                minLength={8}
                maxLength={64}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                8자 이상 64자 이하
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
                이름 (선택)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-dark w-full"
                placeholder="이름"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-brand w-full">
              {loading ? '신청 중...' : '회원가입 신청'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link
              href="/auth/login"
              className="text-sm"
              style={{ color: 'var(--brand)' }}
            >
              이미 계정이 있으신가요? 로그인
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // 로그인 상태 확인 후 적절한 페이지로 리다이렉트
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role === 'ADMIN') {
          router.replace('/admin');
        } else if (user.role === 'AGENCY') {
          router.replace('/agency');
        } else {
          router.replace('/auth/login');
        }
      } catch {
        router.replace('/auth/login');
      }
    } else {
      router.replace('/auth/login');
    }
  }, [router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(180deg,#0B0F12 0%, #0E1622 100%)' }}
    >
      <div className="text-sm" style={{ color: 'var(--muted)' }}>
        로딩 중...
      </div>
    </div>
  );
}


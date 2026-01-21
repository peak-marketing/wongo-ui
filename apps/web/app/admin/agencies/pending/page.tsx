'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import AdminSidebar from '@/components/nav/AdminSidebar';
import RouteGuard from '@/components/auth/RouteGuard';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';

type AgencyRow = {
  id: string;
  email: string;
  contactName?: string | null;
  phone?: string | null;
  createdAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
};

export default function AdminAgenciesPendingPage() {
  const [items, setItems] = useState<AgencyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.listAdminAgencies({ status: 'PENDING', page: 1, limit: 50 });
      setItems(data.items || []);
    } catch (error: any) {
      toast.error(error?.message || '대기 대행사 목록을 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <RouteGuard requiredRole="ADMIN">
      <AppShell sidebar={<AdminSidebar />}>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            가입 대기 대행사
          </h1>

          {loading ? (
            <div className="text-sm" style={{ color: 'var(--muted)' }}>
              로딩 중...
            </div>
          ) : items.length === 0 ? (
            <div className="card text-center" style={{ color: 'var(--muted)' }}>
              대기 중인 대행사가 없습니다
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
                      이메일
                    </th>
                    <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
                      담당자명
                    </th>
                    <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
                      연락처
                    </th>
                    <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
                      신청일
                    </th>
                    <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
                      상태
                    </th>
                    <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((agency) => (
                    <tr key={agency.id} className="border-b border-white/5">
                      <td className="p-3 text-sm" style={{ color: 'var(--text)' }}>
                        {agency.email}
                      </td>
                      <td className="p-3 text-sm" style={{ color: 'var(--text)' }}>
                        {agency.contactName || '-'}
                      </td>
                      <td className="p-3 text-sm" style={{ color: 'var(--muted)' }}>
                        {agency.phone || '-'}
                      </td>
                      <td className="p-3 text-sm" style={{ color: 'var(--muted)' }}>
                        {new Date(agency.createdAt).toLocaleString('ko-KR')}
                      </td>
                      <td className="p-3 text-sm" style={{ color: 'var(--text)' }}>
                        PENDING
                      </td>
                      <td className="p-3">
                        <Link
                          href={`/admin/agencies/${agency.id}`}
                          className="text-xs px-3 py-1 rounded border border-white/20 hover:bg-white/10"
                          style={{ color: 'var(--text)' }}
                        >
                          상세보기
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AppShell>
    </RouteGuard>
  );
}

'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import AdminSidebar from '@/components/nav/AdminSidebar';
import RouteGuard from '@/components/auth/RouteGuard';
import { getApiBaseUrl } from '@/lib/api';
import toast from 'react-hot-toast';

interface User {
  id: string;
  email: string;
  businessName: string;
  businessRegNo: string;
  displayName?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  role: 'ADMIN' | 'AGENCY';
  defaultUnitPrice?: number;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | ''>('PENDING');
  const [query, setQuery] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [unitPriceInputs, setUnitPriceInputs] = useState<Record<string, string>>({});
  const [savingUnitPriceId, setSavingUnitPriceId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, [statusFilter, query]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const base = getApiBaseUrl();
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (query) params.append('query', query);

      const res = await fetch(`${base}/admin/users?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok) {
        const nextUsers = (data.users || []) as User[];
        setUsers(nextUsers);
        setUnitPriceInputs((prev) => {
          const next: Record<string, string> = { ...prev };
          for (const u of nextUsers) {
            if (typeof next[u.id] === 'string') continue;
            if (typeof u.defaultUnitPrice === 'number' && u.defaultUnitPrice > 0) {
              next[u.id] = String(u.defaultUnitPrice);
            } else {
              next[u.id] = '';
            }
          }
          return next;
        });
      } else {
        toast.error(data.message || '사용자 목록을 불러올 수 없습니다');
      }
    } catch (error) {
      toast.error('사용자 목록을 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUnitPrice = async (userId: string) => {
    const raw = unitPriceInputs[userId] ?? '';
    const unitPrice = Math.trunc(Number(raw));
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      toast.error('단가는 1 이상의 숫자여야 합니다');
      return;
    }

    setSavingUnitPriceId(userId);
    try {
      const token = localStorage.getItem('token');
      const base = getApiBaseUrl();
      const res = await fetch(
        `${base}/admin/users/${userId}/unit-price`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ unitPrice }),
          credentials: 'include',
        },
      );

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success('단가 저장 완료');
        loadUsers();
      } else {
        toast.error(data.message || '단가 저장 실패');
      }
    } catch (error) {
      toast.error('단가 저장 중 오류가 발생했습니다');
    } finally {
      setSavingUnitPriceId(null);
    }
  };

  const handleApprove = async (userId: string) => {
    if (!confirm('이 사용자를 승인하시겠습니까?')) return;

    setApprovingId(userId);
    try {
      const token = localStorage.getItem('token');
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: 'AGENCY' }),
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('승인 완료. 이제 로그인이 가능합니다.');
        loadUsers();
      } else {
        toast.error(data.message || '승인 실패');
      }
    } catch (error) {
      toast.error('승인 처리 중 오류가 발생했습니다');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (userId: string) => {
    if (!confirm('이 사용자를 거절하시겠습니까?')) return;

    setRejectingId(userId);
    try {
      const token = localStorage.getItem('token');
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/admin/users/${userId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('거절 완료');
        loadUsers();
      } else {
        toast.error(data.message || '거절 실패');
      }
    } catch (error) {
      toast.error('거절 처리 중 오류가 발생했습니다');
    } finally {
      setRejectingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      PENDING: 'var(--warning)',
      APPROVED: 'var(--success)',
      REJECTED: 'var(--danger)',
    };
    const labels = {
      PENDING: '대기중',
      APPROVED: '승인됨',
      REJECTED: '거절됨',
    };
    return (
      <span
        className="px-2 py-1 rounded text-xs"
        style={{
          backgroundColor: colors[status as keyof typeof colors] || 'var(--muted)',
          color: 'white',
        }}
      >
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  return (
    <RouteGuard requiredRole="ADMIN">
      <AppShell sidebar={<AdminSidebar />}>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            회원관리
          </h1>

          <div className="flex gap-4 items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  statusFilter === 'PENDING'
                    ? 'bg-[var(--brand)] text-white'
                    : 'bg-white/5 text-[var(--muted)] hover:bg-white/10'
                }`}
              >
                대기중
              </button>
              <button
                onClick={() => setStatusFilter('APPROVED')}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  statusFilter === 'APPROVED'
                    ? 'bg-[var(--brand)] text-white'
                    : 'bg-white/5 text-[var(--muted)] hover:bg-white/10'
                }`}
              >
                승인됨
              </button>
              <button
                onClick={() => setStatusFilter('REJECTED')}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  statusFilter === 'REJECTED'
                    ? 'bg-[var(--brand)] text-white'
                    : 'bg-white/5 text-[var(--muted)] hover:bg-white/10'
                }`}
              >
                거절됨
              </button>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input-dark flex-1 max-w-xs"
              placeholder="이메일/사업자명/사업자등록번호 검색..."
            />
          </div>

          {loading ? (
            <div className="text-sm" style={{ color: 'var(--muted)' }}>로딩 중...</div>
          ) : users.length === 0 ? (
            <div className="card text-center" style={{ color: 'var(--muted)' }}>
              사용자가 없습니다
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
                      사업자명
                    </th>
                    <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
                      사업자등록번호
                    </th>
                    <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
                      신청일
                    </th>
                    <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
                      상태
                    </th>
                    <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
                      기본 단가
                    </th>
                    <th className="text-left p-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-white/5">
                      <td className="p-3 text-sm" style={{ color: 'var(--text)' }}>
                        {user.email}
                      </td>
                      <td className="p-3 text-sm" style={{ color: 'var(--text)' }}>
                        {user.businessName}
                      </td>
                      <td className="p-3 text-sm" style={{ color: 'var(--muted)' }}>
                        {user.businessRegNo}
                      </td>
                      <td className="p-3 text-sm" style={{ color: 'var(--muted)' }}>
                        {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="p-3">{getStatusBadge(user.status)}</td>
                      <td className="p-3 text-sm" style={{ color: 'var(--muted)' }}>
                        {user.role === 'AGENCY' && user.status === 'APPROVED'
                          ? (typeof user.defaultUnitPrice === 'number' && user.defaultUnitPrice > 0
                            ? user.defaultUnitPrice.toLocaleString('ko-KR')
                            : '-')
                          : '-'}
                      </td>
                      <td className="p-3">
                        {user.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(user.id)}
                              disabled={approvingId === user.id}
                              className="btn-brand text-xs px-3 py-1 disabled:opacity-50"
                            >
                              {approvingId === user.id ? '승인 중...' : '승인'}
                            </button>
                            <button
                              onClick={() => handleReject(user.id)}
                              disabled={rejectingId === user.id}
                              className="text-xs px-3 py-1 rounded border border-white/20 hover:bg-white/10 disabled:opacity-50"
                              style={{ color: 'var(--danger)' }}
                            >
                              {rejectingId === user.id ? '거절 중...' : '거절'}
                            </button>
                          </div>
                        )}

                        {user.role === 'AGENCY' && user.status === 'APPROVED' && (
                          <div className="flex gap-2 items-center">
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              value={unitPriceInputs[user.id] ?? ''}
                              onChange={(e) =>
                                setUnitPriceInputs((prev) => ({ ...prev, [user.id]: e.target.value }))
                              }
                              className="input-dark w-28"
                              placeholder="단가"
                              disabled={savingUnitPriceId === user.id}
                            />
                            <button
                              onClick={() => handleSaveUnitPrice(user.id)}
                              disabled={savingUnitPriceId === user.id}
                              className="text-xs px-3 py-1 rounded border border-white/20 hover:bg-white/10 disabled:opacity-50"
                              style={{ color: 'var(--text)' }}
                            >
                              {savingUnitPriceId === user.id ? '저장 중...' : '저장'}
                            </button>
                          </div>
                        )}
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










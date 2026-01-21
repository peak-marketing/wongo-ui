'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import AgencySidebar from '@/components/nav/AgencySidebar';
import RouteGuard from '@/components/auth/RouteGuard';
import { apiClient } from '@/lib/api';
import { Order, OrderStatus } from '@/lib/types';
import { getStatusLabel } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function AgencyDashboardPage() {
  const [stats, setStats] = useState({
    writing: 0,
    firstReview: 0,
    todayDone: 0,
    balance: 0,
    spentTotal: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    // 30초마다 자동 새로고침 (선택적)
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);

    const [statsResult, ordersResult] = await Promise.allSettled([
      apiClient.getStats(),
      apiClient.getOrders(),
    ]);

    if (statsResult.status === 'fulfilled') {
      const statsData = statsResult.value.data || {};
      setStats({
        writing: Number(statsData.writing) || 0,
        firstReview: Number(statsData.firstReview) || 0,
        todayDone: Number(statsData.todayDone) || 0,
        balance: Number(statsData.balance) || 0,
        spentTotal: Number(statsData.spentTotal) || 0,
      });
    } else {
      console.error('Failed to load stats', statsResult.reason);
      // 401은 전역 인터셉터에서 로그인으로 리다이렉트 처리
      if (statsResult.reason?.status !== 401) {
        toast.error('통계 로드 실패');
      }
      setStats({ writing: 0, firstReview: 0, todayDone: 0, balance: 0, spentTotal: 0 });
    }

    if (ordersResult.status === 'fulfilled') {
      const payload = ordersResult.value.data || {};
      const orders: Order[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.items)
        ? payload.items
        : [];
      const sorted = [...orders].sort((a: Order, b: Order) => {
        const aTime = new Date(a.updatedAt || a.createdAt).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt).getTime();
        return bTime - aTime;
      });
      setRecentOrders(sorted.slice(0, 5));
    } else {
      console.error('Failed to load recent orders', ordersResult.reason);
      setRecentOrders([]);
    }

    setLoading(false);
  };

  const formatCurrency = (value: number) => `₩${Math.round(Number(value) || 0).toLocaleString('ko-KR')}`;

  const StatCard = ({
    title,
    value,
    color,
    icon,
  }: {
    title: string;
    value: number;
    color: string;
    icon: React.ReactNode;
  }) => (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {title}
        </span>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
        {Number(value || 0).toLocaleString('ko-KR')}
      </div>
    </div>
  );

  return (
    <RouteGuard requiredRole="AGENCY">
      <AppShell sidebar={<AgencySidebar />}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          대시보드
        </h1>

        {/* 진행 현황 위젯 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="원고 작성 중"
            value={stats.writing}
            color="var(--brand)"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          />
          <StatCard
            title="원고 1차 검수 요청"
            value={stats.firstReview}
            color="var(--warning)"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
          />
          <StatCard
            title="금일 주문 완료"
            value={stats.todayDone}
            color="var(--success)"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 최근 접수 */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>
              최근 접수
            </h2>
            {loading ? (
              <div className="text-sm" style={{ color: 'var(--muted)' }}>로딩 중...</div>
            ) : recentOrders.length === 0 ? (
              <div className="text-sm" style={{ color: 'var(--muted)' }}>접수된 주문이 없습니다</div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/agency/orders/${order.id}`}
                    className="block p-3 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium" style={{ color: 'var(--text)' }}>
                          {order.placeName}
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                          {new Date(order.createdAt).toLocaleString('ko-KR')}
                        </div>
                      </div>
                      <span
                        className="px-2 py-1 rounded text-xs"
                        style={{
                          backgroundColor:
                            order.status === OrderStatus.COMPLETE
                              ? 'var(--success)'
                              : order.status === OrderStatus.AGENCY_REJECTED
                              ? 'var(--danger)'
                              : 'var(--brand)',
                          color: 'white',
                        }}
                      >
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 지갑 요약 */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>
              지갑 요약
            </h2>
            {loading ? (
              <div className="text-sm" style={{ color: 'var(--muted)' }}>로딩 중...</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-sm mb-1" style={{ color: 'var(--muted)' }}>
                    현재 잔액
                  </div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                    {formatCurrency(stats.balance)}
                  </div>
                </div>
                <div>
                  <div className="text-sm mb-1" style={{ color: 'var(--muted)' }}>
                    총 사용 금액
                  </div>
                  <div className="text-xl font-semibold" style={{ color: 'var(--warning)' }}>
                    {formatCurrency(stats.spentTotal)}
                  </div>
                </div>
                <Link
                  href="/agency/billing"
                  className="btn-brand inline-block text-center w-full"
                >
                  충전하기
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
    </RouteGuard>
  );
}


'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import AppShell from '@/components/layout/AppShell';
import AdminSidebar from '@/components/nav/AdminSidebar';
import RouteGuard from '@/components/auth/RouteGuard';
import { apiClient, getApiBaseUrl } from '@/lib/api';
import { Order } from '@/lib/types';
import toast from 'react-hot-toast';

export default function AdminDashboardPage() {
  const [queueStats, setQueueStats] = useState({
    waiting: 0,
    active: 0,
    failed: 0,
    completed: 0,
  });
  const [recentFailed, setRecentFailed] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 헬스체크로 큐 상태 가져오기
      const base = getApiBaseUrl();
      const healthRes = await fetch(
        `${base}/health`
      );
      const healthData = await healthRes.json();
      
      if (healthData.queue) {
        setQueueStats({
          waiting: healthData.queue.waiting || 0,
          active: healthData.queue.active || 0,
          failed: healthData.queue.failed || 0,
          completed: healthData.queue.completed || 0,
        });
      }

      // 최근 실패한 주문 가져오기
      const ordersRes = await apiClient.getAdminOrders('FAILED');
      setRecentFailed((ordersRes.data || []).slice(0, 5));
    } catch (error) {
      console.error('Failed to load data', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({
    title,
    value,
    color,
    icon,
  }: {
    title: string;
    value: number;
    color: string;
    icon: ReactNode;
  }) => (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {title}
        </span>
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
        {value}
      </div>
    </div>
  );

  const handleRetry = async (orderId: string) => {
    try {
      await apiClient.generateManuscript(orderId);
      toast.success('재시도가 시작되었습니다');
      loadData();
    } catch (error: any) {
      toast.error(error.message || '재시도 실패');
    }
  };

  return (
    <RouteGuard requiredRole="ADMIN">
      <AppShell sidebar={<AdminSidebar />}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          대시보드
        </h1>

        {/* 큐 상태 위젯 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="대기중"
            value={queueStats.waiting}
            color="var(--muted)"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            title="진행중"
            value={queueStats.active}
            color="var(--brand)"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          />
          <StatCard
            title="완료"
            value={queueStats.completed}
            color="var(--success)"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            }
          />
          <StatCard
            title="실패"
            value={queueStats.failed}
            color="var(--danger)"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            }
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 최근 실패 */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
                최근 실패 작업
              </h2>
            </div>
            {loading ? (
              <div className="text-sm" style={{ color: 'var(--muted)' }}>로딩 중...</div>
            ) : recentFailed.length === 0 ? (
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                실패한 작업이 없습니다
              </div>
            ) : (
              <div className="space-y-3">
                {recentFailed.map((order) => (
                  <div
                    key={order.id}
                    className="p-3 rounded-lg border border-white/10"
                  >
                    <div className="flex justify-between items-start mb-2">
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
                          backgroundColor: 'var(--danger)',
                          color: 'white',
                        }}
                      >
                        실패
                      </span>
                    </div>
                    <button
                      onClick={() => handleRetry(order.id)}
                      className="btn-brand text-sm px-3 py-1"
                    >
                      재시도
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 대행사별 진행 현황 */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text)' }}>
              대행사별 진행 현황
            </h2>
            <div className="space-y-4">
              {/* TODO: 대행사별 통계 구현 */}
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                통계 데이터 준비 중...
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
    </RouteGuard>
  );
}


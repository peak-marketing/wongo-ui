'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import AppShell from '@/components/layout/AppShell';
import AdminSidebar from '@/components/nav/AdminSidebar';
import RouteGuard from '@/components/auth/RouteGuard';
import { apiClient } from '@/lib/api';
import { Order, OrderStatus } from '@/lib/types';
import { getStatusColor, getStatusLabel } from '@/lib/utils';

type PersonaPreset = {
  label: string;
  personaId: string;
  snapshot: string;
};

const AGE_GROUPS = [
  { value: '20', label: '20대' },
  { value: '30', label: '30대' },
  { value: '40', label: '40대' },
  { value: '50', label: '50대' },
];

const GENDERS = [
  { value: 'F', label: '여성' },
  { value: 'M', label: '남성' },
];

const PERSONALITIES = [
  { value: 'FRIENDLY', label: '친근한' },
  { value: 'PROFESSIONAL', label: '전문적인' },
  { value: 'TRENDY', label: '트렌디한' },
  { value: 'CALM', label: '차분한' },
];

const TONES = [
  { value: 'WARM', label: '따뜻한 톤' },
  { value: 'BRIGHT', label: '밝은 톤' },
  { value: 'NEUTRAL', label: '중립 톤' },
];

const QUICK_PRESETS: PersonaPreset[] = [
  {
    label: '20대 여성 · 활발 · 밝은',
    personaId: '20-F-FRIENDLY-BRIGHT',
    snapshot: '20대 여성, 친근하고 밝은 톤의 작성 스타일',
  },
  {
    label: '30대 남성 · 전문 · 중립',
    personaId: '30-M-PROFESSIONAL-NEUTRAL',
    snapshot: '30대 남성, 전문적이고 중립적인 톤의 서술',
  },
  {
    label: '40대 여성 · 차분 · 따뜻',
    personaId: '40-F-CALM-WARM',
    snapshot: '40대 여성, 차분하고 따뜻한 톤의 설명',
  },
  {
    label: '50대 남성 · 전문 · 밝은',
    personaId: '50-M-PROFESSIONAL-BRIGHT',
    snapshot: '50대 남성, 전문적이면서도 밝은 톤의 안내',
  },
  {
    label: '30대 여성 · 트렌디 · 밝은',
    personaId: '30-F-TRENDY-BRIGHT',
    snapshot: '30대 여성, 트렌디하고 밝은 톤의 추천',
  },
];

const INTAKE_PIPELINE_STATUSES: OrderStatus[] = [
  OrderStatus.SUBMITTED,
  OrderStatus.ADMIN_INTAKE,
  OrderStatus.GENERATING,
  OrderStatus.GENERATED,
  OrderStatus.ADMIN_REVIEW,
  OrderStatus.FAILED,
  OrderStatus.REGEN_QUEUED,
];

const CLEANUP_STATUSES: OrderStatus[] = [
  OrderStatus.CANCEL_REQUESTED,
  OrderStatus.CANCELED,
  OrderStatus.CANCELED_BY_AGENCY,
  OrderStatus.ADMIN_REJECTED,
  OrderStatus.AGENCY_REJECTED,
];

interface PersonaSelectionState {
  age: string;
  gender: string;
  personality: string;
  tone: string;
}

export default function IntakePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'blog' | 'receipt' | 'cleanup'>('blog');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [qualityModeByOrderId, setQualityModeByOrderId] = useState<Record<string, boolean>>({});
  const [canceling, setCanceling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [personaInputs, setPersonaInputs] = useState<Record<string, Partial<PersonaSelectionState>>>({});
  const [health, setHealth] = useState<{ db: boolean; redis: boolean; queue?: Record<string, number> } | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  useEffect(() => {
    void loadOrders();
    void refreshHealth(true);
  }, []);

  const isReceiptReview = (order: Order) => String((order as any)?.type || '').toUpperCase() === 'RECEIPT_REVIEW';

  const blogReviewOrders = useMemo(
    () => orders.filter((order) => INTAKE_PIPELINE_STATUSES.includes(order.status) && !isReceiptReview(order)),
    [orders],
  );

  const receiptReviewOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          INTAKE_PIPELINE_STATUSES.includes(order.status) && isReceiptReview(order),
      ),
    [orders],
  );

  const cleanupOrders = useMemo(
    () => orders.filter((order) => CLEANUP_STATUSES.includes(order.status)),
    [orders],
  );

  const visibleOrders = useMemo(() => {
    if (activeTab === 'blog') return blogReviewOrders;
    if (activeTab === 'receipt') return receiptReviewOrders;
    return cleanupOrders;
  }, [activeTab, blogReviewOrders, receiptReviewOrders, cleanupOrders]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.getAdminOrders();
      setOrders(data || []);
    } catch (error: any) {
      console.error('Failed to load orders', error);
      toast.error(error.message || '주문 목록을 불러오지 못했습니다', { position: 'top-center' });
    } finally {
      setLoading(false);
    }
  };

  const refreshHealth = async (silent = false) => {
    if (!silent) {
      setHealthLoading(true);
    }
    try {
      const { data } = await apiClient.getHealth();
      setHealth({ db: data.db, redis: data.redis, queue: data.queue });
    } catch (error: any) {
      console.error('Failed to fetch health', error);
      if (!silent) {
        toast.error(error.message || '시스템 상태를 확인할 수 없습니다', { position: 'top-center' });
      }
    } finally {
      if (!silent) {
        setHealthLoading(false);
      }
    }
  };

  const buildPersonaSnapshot = (selection: PersonaSelectionState): { id: string; snapshot: string } => {
    const age = AGE_GROUPS.find((item) => item.value === selection.age)?.label ?? '연령 미지정';
    const gender = GENDERS.find((item) => item.value === selection.gender)?.label ?? '성별 미지정';
    const personality = PERSONALITIES.find((item) => item.value === selection.personality)?.label ?? '성격 미지정';
    const tone = TONES.find((item) => item.value === selection.tone)?.label ?? '톤 미지정';

    return {
      id: `${selection.age}-${selection.gender}-${selection.personality}-${selection.tone}`,
      snapshot: `${age} ${gender}, ${personality} 성격, ${tone}으로 작성`,
    };
  };

  const handleAssignPreset = async (orderId: string, preset: PersonaPreset) => {
    setAssigning(orderId);
    try {
      const response = await apiClient.assignPersona(orderId, preset.personaId, preset.snapshot);
      const message = response.data?.message || '페르소나가 배정되었습니다';
      toast.success(message, { position: 'top-center' });
      await loadOrders();
    } catch (error: any) {
      console.error('Failed to assign persona', error);
      const message = error.response?.data?.message || error.message || '페르소나 배정에 실패했습니다';
      toast.error(message, { position: 'top-center' });
    } finally {
      setAssigning(null);
    }
  };

  const handleAssignPersona = async (orderId: string) => {
    const selection = personaInputs[orderId];
    if (!selection || !selection.age || !selection.gender || !selection.personality || !selection.tone) {
      toast.error('연령, 성별, 성격, 톤을 모두 선택해주세요', { position: 'top-center' });
      return;
    }

    const persona = buildPersonaSnapshot(selection as PersonaSelectionState);
    setAssigning(orderId);
    try {
      const response = await apiClient.assignPersona(orderId, persona.id, persona.snapshot);
      const message = response.data?.message || '페르소나가 배정되었습니다';
      toast.success(message, { position: 'top-center' });
      await loadOrders();
    } catch (error: any) {
      console.error('Failed to assign persona', error);
      const message = error.response?.data?.message || error.message || '페르소나 배정에 실패했습니다';
      toast.error(message, { position: 'top-center' });
    } finally {
      setAssigning(null);
    }
  };

  const runGeneration = async (orderId: string, context: 'manual' | 'retry' = 'manual') => {
    setGenerating(orderId);
    try {
      const qualityMode = Boolean(qualityModeByOrderId[orderId]);
      const response = await apiClient.generateManuscript(orderId, undefined, qualityMode);
      const message = response.data?.message || (context === 'retry' ? '재생성을 시작했습니다' : '원고 산출을 시작했습니다');
      toast.success(message, { position: 'top-center' });
      await Promise.all([loadOrders(), refreshHealth(true)]);
    } catch (error: any) {
      console.error('Failed to trigger generation', error);
      const message = error.response?.data?.message || error.message || '원고 산출에 실패했습니다';
      toast.error(message, { position: 'top-center' });
    } finally {
      setGenerating(null);
    }
  };

  const getGenModeLabels = (order: Order): { speed: string; quality: string } => {
    const t = String((order as any)?.type || '').toUpperCase();
    if (t === 'RECEIPT_REVIEW') {
      return { speed: '속도 우선 (Flash-Lite)', quality: '품질 우선 (Gemini 3.0 Pro)' };
    }
    return { speed: '속도 우선 (Gemini 3.0 Fresh)', quality: '품질 우선 (Gemini 3.0 Pro)' };
  };

  const renderGenModeToggle = (order: Order) => {
    const labels = getGenModeLabels(order);
    const current = Boolean(qualityModeByOrderId[order.id]);
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={current ? 'btn-outline text-xs' : 'btn-brand text-xs'}
          onClick={() => setQualityModeByOrderId((prev) => ({ ...prev, [order.id]: false }))}
          disabled={generating === order.id}
          title={labels.speed}
        >
          {labels.speed}
        </button>
        <button
          type="button"
          className={current ? 'btn-brand text-xs' : 'btn-outline text-xs'}
          onClick={() => setQualityModeByOrderId((prev) => ({ ...prev, [order.id]: true }))}
          disabled={generating === order.id}
          title={labels.quality}
        >
          {labels.quality}
        </button>
      </div>
    );
  };

  const cancelIntake = async (orderId: string) => {
    if (!confirm('이 주문을 접수 취소하시겠습니까? (예약된 크레딧이 해제됩니다)')) return;
    const reason = (typeof window !== 'undefined' ? window.prompt('취소 사유(선택)', '접수 취소') : null) ?? undefined;

    setCanceling(orderId);
    try {
      await apiClient.adminCancelOrder(orderId, reason || undefined);
      toast.success('접수가 취소되었습니다', { position: 'top-center' });
      await loadOrders();
      await refreshHealth(true);
    } catch (error: any) {
      console.error('Failed to cancel intake', error);
      const message = error.response?.data?.message || error.message || '접수 취소에 실패했습니다';
      toast.error(message, { position: 'top-center' });
    } finally {
      setCanceling(null);
    }
  };

  const forceFailGenerating = async (orderId: string) => {
    if (!confirm('이 주문을 강제 실패(스톨 처리)로 전환하시겠습니까? (예약된 크레딧이 해제됩니다)')) return;
    const reason = (typeof window !== 'undefined' ? window.prompt('실패 사유(선택)', 'stalled') : null) ?? undefined;

    setGenerating(orderId);
    try {
      await apiClient.adminForceFailOrder(orderId, reason || undefined);
      toast.success('강제 실패 처리되었습니다', { position: 'top-center' });
      await Promise.all([loadOrders(), refreshHealth(true)]);
    } catch (error: any) {
      console.error('Failed to force-fail order', error);
      const message = error.response?.data?.message || error.message || '강제 실패 처리에 실패했습니다';
      toast.error(message, { position: 'top-center' });
    } finally {
      setGenerating(null);
    }
  };

  const deleteIntake = async (orderId: string) => {
    if (!confirm('이 주문을 삭제(숨김)하시겠습니까? 삭제 후에는 목록/상세에서 보이지 않습니다.')) return;

    setDeleting(orderId);
    try {
      await apiClient.adminDeleteOrder(orderId);
      toast.success('삭제되었습니다', { position: 'top-center' });
      await loadOrders();
      await refreshHealth(true);
    } catch (error: any) {
      console.error('Failed to delete order', error);
      const message = error.response?.data?.message || error.message || '삭제에 실패했습니다';
      toast.error(message, { position: 'top-center' });
    } finally {
      setDeleting(null);
    }
  };

  const renderKeywords = (order: Order) => {
    if (!order.searchKeywords) return '키워드 없음';
    const keywords = order.searchKeywords
      .split(',')
      .map((kw) => kw.trim())
      .filter(Boolean);
    if (keywords.length === 0) return '키워드 없음';
    if (keywords.length <= 3) return keywords.join(', ');
    return `${keywords.slice(0, 3).join(', ')} 외 ${keywords.length - 3}개`;
  };

  const renderCardActions = (order: Order) => {
    if (order.status === OrderStatus.SUBMITTED) {
      return (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              빠른 배정 (동일 플레이스 5건 프리셋)
            </h4>
            <div className="flex flex-wrap gap-2">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.personaId}
                  className="btn-outline text-xs"
                  onClick={() => handleAssignPreset(order.id, preset)}
                  disabled={assigning === order.id}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <select
              className="input-dark"
              value={personaInputs[order.id]?.age ?? ''}
              onChange={(e) =>
                setPersonaInputs((prev) => ({
                  ...prev,
                  [order.id]: { ...(prev[order.id] ?? {}), age: e.target.value },
                }))
              }
            >
              <option value="">연령대</option>
              {AGE_GROUPS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              className="input-dark"
              value={personaInputs[order.id]?.gender ?? ''}
              onChange={(e) =>
                setPersonaInputs((prev) => ({
                  ...prev,
                  [order.id]: { ...(prev[order.id] ?? {}), gender: e.target.value },
                }))
              }
            >
              <option value="">성별</option>
              {GENDERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              className="input-dark"
              value={personaInputs[order.id]?.personality ?? ''}
              onChange={(e) =>
                setPersonaInputs((prev) => ({
                  ...prev,
                  [order.id]: { ...(prev[order.id] ?? {}), personality: e.target.value },
                }))
              }
            >
              <option value="">성격</option>
              {PERSONALITIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              className="input-dark"
              value={personaInputs[order.id]?.tone ?? ''}
              onChange={(e) =>
                setPersonaInputs((prev) => ({
                  ...prev,
                  [order.id]: { ...(prev[order.id] ?? {}), tone: e.target.value },
                }))
              }
            >
              <option value="">톤</option>
              {TONES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => handleAssignPersona(order.id)}
            className="btn-brand"
            disabled={assigning === order.id}
          >
            페르소나 배정
          </button>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-outline"
              onClick={() => cancelIntake(order.id)}
              disabled={canceling === order.id || deleting === order.id || assigning === order.id}
            >
              {canceling === order.id ? '취소중…' : '접수 취소'}
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => deleteIntake(order.id)}
              disabled={canceling === order.id || deleting === order.id || assigning === order.id}
              style={{ borderColor: 'rgba(255,255,255,0.18)', color: 'var(--danger)' }}
            >
              {deleting === order.id ? '삭제중…' : '삭제'}
            </button>
          </div>
        </div>
      );
    }

    if (order.status === OrderStatus.ADMIN_INTAKE || order.status === OrderStatus.REGEN_QUEUED) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          {renderGenModeToggle(order)}
          <button
            className="btn-brand bg-green-600 hover:bg-green-500"
            onClick={() => runGeneration(order.id)}
            disabled={generating === order.id}
          >
            원고 산출
          </button>

          <button
            type="button"
            className="btn-outline"
            onClick={() => cancelIntake(order.id)}
            disabled={canceling === order.id || deleting === order.id || generating === order.id}
          >
            {canceling === order.id ? '취소중…' : '접수 취소'}
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => deleteIntake(order.id)}
            disabled={canceling === order.id || deleting === order.id || generating === order.id}
            style={{ borderColor: 'rgba(255,255,255,0.18)', color: 'var(--danger)' }}
          >
            {deleting === order.id ? '삭제중…' : '삭제'}
          </button>
        </div>
      );
    }

    if (order.status === OrderStatus.FAILED) {
      return (
        <div className="flex flex-wrap gap-3">
          <div className="text-xs" style={{ color: 'var(--danger)' }}>
            워커 실패로 재시도가 필요합니다. 잔액이 충분한지 확인 후 다시 시도하세요.
          </div>
          {renderGenModeToggle(order)}
          <button
            className="btn-brand bg-amber-600 hover:bg-amber-500"
            onClick={() => runGeneration(order.id, 'retry')}
            disabled={generating === order.id}
          >
            재시도
          </button>

          <button
            type="button"
            className="btn-outline"
            onClick={() => deleteIntake(order.id)}
            disabled={deleting === order.id || generating === order.id}
            style={{ borderColor: 'rgba(255,255,255,0.18)', color: 'var(--danger)' }}
          >
            {deleting === order.id ? '삭제중…' : '삭제'}
          </button>
        </div>
      );
    }

    if (order.status === OrderStatus.GENERATING) {
      const updatedAtMs = Number.isFinite(Date.parse(order.updatedAt)) ? Date.parse(order.updatedAt) : Date.now();
      const elapsedMin = Math.max(0, Math.floor((Date.now() - updatedAtMs) / 60000));
      const maybeStalled = elapsedMin >= 15;
      return (
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs" style={{ color: 'var(--muted)' }}>
            AI 산출이 진행 중입니다…{elapsedMin > 0 ? ` (${elapsedMin}분 경과)` : ''}
          </div>
          {maybeStalled && (
            <button
              type="button"
              className="btn-outline"
              onClick={() => forceFailGenerating(order.id)}
              disabled={generating === order.id}
              style={{ borderColor: 'rgba(255,255,255,0.18)', color: 'var(--danger)' }}
            >
              스톨 처리
            </button>
          )}
        </div>
      );
    }

    if (order.status === OrderStatus.GENERATED || order.status === OrderStatus.ADMIN_REVIEW) {
      return (
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs" style={{ color: 'var(--success)' }}>
            원고가 생성되었으며 관리자가 검수 중입니다.
          </div>
          <button
            type="button"
            className="btn-outline"
            onClick={() => deleteIntake(order.id)}
            disabled={deleting === order.id}
            style={{ borderColor: 'rgba(255,255,255,0.18)', color: 'var(--danger)' }}
          >
            {deleting === order.id ? '삭제중…' : '삭제'}
          </button>
        </div>
      );
    }

    if (
      order.status === OrderStatus.CANCEL_REQUESTED ||
      order.status === OrderStatus.CANCELED ||
      order.status === OrderStatus.CANCELED_BY_AGENCY ||
      order.status === OrderStatus.ADMIN_REJECTED ||
      order.status === OrderStatus.AGENCY_REJECTED
    ) {
      const canCancel = order.status === OrderStatus.CANCEL_REQUESTED;
      return (
        <div className="flex flex-wrap items-center gap-3">
          {canCancel && (
            <button
              type="button"
              className="btn-outline"
              onClick={() => cancelIntake(order.id)}
              disabled={canceling === order.id || deleting === order.id}
            >
              {canceling === order.id ? '취소중…' : '접수 취소'}
            </button>
          )}
          <button
            type="button"
            className="btn-outline"
            onClick={() => deleteIntake(order.id)}
            disabled={canceling === order.id || deleting === order.id}
            style={{ borderColor: 'rgba(255,255,255,0.18)', color: 'var(--danger)' }}
          >
            {deleting === order.id ? '삭제중…' : '삭제'}
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <RouteGuard requiredRole="ADMIN">
      <AppShell sidebar={<AdminSidebar />}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                어드민 인테이크
              </h1>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                접수 → 배정 → 산출 → 검수 단계의 모든 주문을 한 곳에서 관리합니다.
              </p>
            </div>
            <div className="card min-w-[220px]">
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted)' }}>
                <span>시스템 상태</span>
                <button className="btn-outline px-2 py-1" onClick={() => refreshHealth()}
                  disabled={healthLoading}
                >
                  새로고침
                </button>
              </div>
              <div className="mt-3 space-y-2 text-xs" style={{ color: 'var(--text)' }}>
                <div>DB: {health?.db ? '정상' : '오류'}</div>
                <div>Redis: {health?.redis ? '정상' : '오류'}</div>
                <div>
                  큐 대기/진행: {health?.queue ? `${health.queue.waiting ?? 0} / ${health.queue.active ?? 0}` : '-'}
                </div>
                <div>
                  실패/지연: {health?.queue ? `${health.queue.failed ?? 0} / ${health.queue.delayed ?? 0}` : '-'}
                </div>
                <div>
                  완료: {health?.queue ? `${health.queue.completed ?? 0}` : '-'}
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="card text-center" style={{ color: 'var(--muted)' }}>
              주문을 불러오는 중입니다...
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={activeTab === 'blog' ? 'btn-brand' : 'btn-outline'}
                onClick={() => setActiveTab('blog')}
              >
                블로그 리뷰 ({blogReviewOrders.length.toLocaleString('ko-KR')})
              </button>
              <button
                type="button"
                className={activeTab === 'receipt' ? 'btn-brand' : 'btn-outline'}
                onClick={() => setActiveTab('receipt')}
              >
                영수증 리뷰 ({receiptReviewOrders.length.toLocaleString('ko-KR')})
              </button>
              <button
                type="button"
                className={activeTab === 'cleanup' ? 'btn-brand' : 'btn-outline'}
                onClick={() => setActiveTab('cleanup')}
              >
                취소/반려 ({cleanupOrders.length.toLocaleString('ko-KR')})
              </button>
            </div>
          )}

          {!loading && visibleOrders.length === 0 ? (
            <div className="card text-center" style={{ color: 'var(--muted)' }}>
              현재 처리할 주문이 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {visibleOrders.map((order) => (
                <div key={order.id} className="card space-y-4">
                  <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                          {order.placeName}
                        </h2>
                        {String((order as any)?.type || '').toUpperCase() === 'RECEIPT_REVIEW' ? (
                          <span
                            className="px-2 py-1 rounded text-xs"
                            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text)' }}
                          >
                            영수증 리뷰
                          </span>
                        ) : null}
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                        대행사: {order.agency?.businessName || order.agency?.displayName || order.agency?.name || '정보 없음'}
                      </div>
                      {order.personaSnapshot && (
                        <div className="text-xs mt-2" style={{ color: 'var(--text)' }}>
                          페르소나: {order.personaSnapshot}
                        </div>
                      )}
                      {order.extraInstruction && (
                        <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                          추가 가이드: {order.extraInstruction}
                        </div>
                      )}
                      {order.status === OrderStatus.FAILED && order.lastFailureReason && (
                        <div className="text-xs mt-1" style={{ color: 'var(--danger)' }}>
                          실패 사유: {order.lastFailureReason}
                        </div>
                      )}
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>
                        접수: {new Date(order.createdAt).toLocaleString('ko-KR')} · 최근 업데이트: {new Date(order.updatedAt).toLocaleString('ko-KR')}
                      </div>
                    </div>
                    <div className="text-sm" style={{ color: 'var(--muted)' }}>
                      <div>키워드: {renderKeywords(order)}</div>
                      {String((order as any)?.type || '').toUpperCase() === 'RECEIPT_REVIEW' ? (
                        <div>사진: {String((order as any)?.payload?.photoUrl || '').trim() ? '1장' : '0장'}</div>
                      ) : (
                        <div>이미지: {(order.photos?.length ?? 0).toLocaleString('ko-KR')}장</div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-4">
                    {renderCardActions(order)}
                  </div>

                  <div className="text-right text-sm">
                    <Link href={`/admin/orders/${order.id}`} className="text-[var(--brand)] hover:underline">
                      상세 보기 →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </RouteGuard>
  );
}


'use client';

import { Suspense, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import AgencySidebar from '@/components/nav/AgencySidebar';
import RouteGuard from '@/components/auth/RouteGuard';
import { apiClient } from '@/lib/api';
import { Order, OrderStatus } from '@/lib/types';
import { getStatusLabel, getStatusColor } from '@/lib/utils';
import toast from 'react-hot-toast';

type BucketKey = 'writing' | 'firstReview' | 'todayDone';

const BUCKET_TABS: Array<{ key: BucketKey; label: string }> = [
  { key: 'writing', label: '작성 중' },
  { key: 'firstReview', label: '원고 완료' },
  { key: 'todayDone', label: '금일 완료' },
];

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'updatedAt,desc', label: '최근 업데이트 순' },
  { value: 'createdAt,desc', label: '최근 접수 순' },
  { value: 'createdAt,asc', label: '오래된 접수 순' },
  { value: 'completedAt,desc', label: '최근 완료 순' },
];

const PAGE_SIZE = 20;

const CANCELABLE_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.DRAFT,
  OrderStatus.SUBMITTED,
  OrderStatus.ADMIN_INTAKE,
  OrderStatus.GENERATING,
  OrderStatus.GENERATED,
  OrderStatus.ADMIN_REVIEW,
  OrderStatus.ADMIN_REJECTED,
  OrderStatus.REVISION_REQUESTED,
  OrderStatus.REGEN_QUEUED,
  OrderStatus.FAILED,
]);

function OrdersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stats, setStats] = useState({ writing: 0, firstReview: 0, todayDone: 0 });
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState({ page: 1, total: 0, hasMore: false });
  const [activeTab, setActiveTab] = useState<BucketKey>('writing');
  const [doneDate, setDoneDate] = useState(() => new Date().toLocaleDateString('sv-SE'));
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updatedAt,desc');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [zipDownloading, setZipDownloading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const lastFocusRef = useRef<string | null>(null);
  // viewport breakpoint (tailwind lg: 1024px)
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchOrders(1);
  }, [activeTab, query, sort, doneDate]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchStats(true);
      fetchOrders(meta.page, { silent: true });
      // 상세 드로어가 열려 있으면 10초마다 최신화
      if (selectedOrderId) {
        void loadOrderDetail(selectedOrderId, true);
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [meta.page, activeTab, query, sort, selectedOrderId]);

  // URL 동기화 (?id=...)
  useEffect(() => {
    const id = searchParams?.get('id');
    if (id && id !== selectedOrderId) {
      setSelectedOrderId(id);
      void loadOrderDetail(id, true);
    }
    if (!id) {
      setSelectedOrderId(null);
      setSelectedOrder(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const fetchStats = async (silent = false) => {
    try {
      const { data } = await apiClient.getStats();
      setStats({
        writing: Number(data.writing) || 0,
        firstReview: Number(data.firstReview) || 0,
        todayDone: Number(data.todayDone) || 0,
      });
    } catch (error: any) {
      if (!silent) {
        console.error('Failed to load stats', error);
        toast.error(error.message || '통계를 불러오지 못했습니다', { position: 'top-center' });
      }
    }
  };

  const fetchOrders = async (
    page: number,
    options: { silent?: boolean; statusOverride?: BucketKey } = {},
  ) => {
    const silent = options.silent === true;
    const status = options.statusOverride ?? activeTab;
    if (!silent) {
      setLoadingOrders(true);
    }
    try {
      const { data } = await apiClient.getOrders({
        status,
        q: query || undefined,
        completedDate: status === 'todayDone' ? doneDate : undefined,
        page,
        sort,
      });

      const items: Order[] = data.items || [];
      setOrders(items);
      setMeta({ page: data.page || page, total: data.total || 0, hasMore: Boolean(data.hasMore) });

      // 기존 선택된 항목이 리스트에 있으면 유지, 없으면 선택 해제
      if (selectedOrderId && !items.some((order) => order.id === selectedOrderId)) {
        setSelectedOrderId(null);
        setSelectedOrder(null);
      }
    } catch (error: any) {
      console.error('Failed to load orders', error);
      toast.error(error.message || '목록을 불러오지 못했습니다', { position: 'top-center' });
    } finally {
      if (!silent) {
        setLoadingOrders(false);
      }
    }
  };

  const loadOrderDetail = async (orderId: string, silent = false) => {
    if (!orderId) return;
    if (!silent) {
      setLoadingDetail(true);
    }
    try {
      const { data } = await apiClient.getOrder(
        orderId,
        'manuscript,validationReport,counters',
      );
      setSelectedOrder(data);
    } catch (error: any) {
      console.error('Failed to load order detail', error);
      toast.error(error.message || '상세 정보를 불러오지 못했습니다', { position: 'top-center' });
    } finally {
      if (!silent) {
        setLoadingDetail(false);
      }
    }
  };

  const handleRowClick = (order: Order) => {
    // 모바일/태블릿: 상세 페이지 라우팅
    if (!isDesktop) {
      router.push(`/agency/orders/${order.id}`);
      return;
    }
    // 데스크톱: 우측 패널 + URL 동기화
    lastFocusRef.current = order.id;
    setSelectedOrderId(order.id);
    const params = new URLSearchParams(window.location.search);
    params.set('id', order.id);
    router.push(`/agency/orders?${params.toString()}`, { scroll: false });
    void loadOrderDetail(order.id);
  };

  const closeDrawer = useCallback(() => {
    setSelectedOrderId(null);
    setSelectedOrder(null);
    setRejectionReason('');
    const params = new URLSearchParams(window.location.search);
    params.delete('id');
    router.push(`/agency/orders?${params.toString()}`, { scroll: false });
    // 포커스 복원
    const rowEl = document.querySelector<HTMLElement>(`[data-row-id="${lastFocusRef.current}"]`);
    if (rowEl) {
      rowEl.focus();
    }
  }, [router]);

  const parseFilenameFromContentDisposition = (value: string | undefined) => {
    if (!value) return undefined;
    const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return utf8Match[1];
      }
    }
    const plainMatch = value.match(/filename="?([^";]+)"?/i);
    return plainMatch?.[1];
  };

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadDeliverableZip = useCallback(async () => {
    if (!selectedOrder || zipDownloading) return;
    try {
      setZipDownloading(true);
      const response = await apiClient.downloadDeliverableZip(selectedOrder.id);
      const blob = response.data as Blob;
      const contentDisposition =
        (response.headers?.['content-disposition'] as string | undefined) ??
        (response.headers?.['Content-Disposition'] as string | undefined);
      const filenameFromHeader = parseFilenameFromContentDisposition(contentDisposition);
      const filename = filenameFromHeader || `deliverable_${selectedOrder.id}.zip`;
      triggerBlobDownload(blob, filename);
    } catch (error: any) {
      if (error?.status === 403) {
        toast.error('다운로드 권한이 없습니다', { position: 'top-center' });
        return;
      }
      toast.error(error?.message || 'ZIP 다운로드에 실패했습니다', { position: 'top-center' });
    } finally {
      setZipDownloading(false);
    }
  }, [selectedOrder, zipDownloading]);

  // ESC 키로 드로어 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') {
        return;
      }
      if (cancelDialogOpen) {
        e.preventDefault();
        setCancelDialogOpen(false);
        setCancelReason('');
        return;
      }
      if (selectedOrderId) {
        closeDrawer();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedOrderId, closeDrawer, cancelDialogOpen]);

  // Enter = 승인, Ctrl+R = 수정요청 단축키
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if (!selectedOrder || (selectedOrder.status !== OrderStatus.AGENCY_REVIEW && selectedOrder.status !== OrderStatus.GENERATED) || actionLoading) {
        return;
      }
      const revisionCount = selectedOrder.revisionCount ?? 0;
      
      if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        void handleReview('APPROVE');
      }
      
      if (e.key === 'r' && e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (revisionCount >= 1) {
          toast.error('수정요청은 1회만 가능합니다', { position: 'top-center' });
          return;
        }
        void handleRevisionRequest();
      }
    };
    
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [selectedOrder, actionLoading]);

  // 가시성 회복/포커스 시 1회 재조회
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && selectedOrderId) {
        void loadOrderDetail(selectedOrderId, true);
      }
    };
    const onFocus = () => {
      if (selectedOrderId) {
        void loadOrderDetail(selectedOrderId, true);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [selectedOrderId]);

  const handleSearch = () => {
    setQuery(searchInput.trim());
  };

  const handleReview = async (decision: 'APPROVE' | 'REJECT', reasonOverride?: string) => {
    if (!selectedOrderId) return;
    const rejectReason = decision === 'REJECT' ? (reasonOverride ?? rejectionReason).trim() : undefined;
    if (decision === 'REJECT' && !rejectReason) {
      toast.error('수정 요청 사유를 입력해주세요', { position: 'top-center' });
      return;
    }

    setActionLoading(true);
    try {
      // 낙관적 업데이트
      const prev = selectedOrder;
      if (prev) {
        const optimistic = { ...prev } as Order;
        if (decision === 'APPROVE') {
          optimistic.status = OrderStatus.COMPLETE;
          (optimistic as any).approveCount = (optimistic as any).approveCount ? (optimistic as any).approveCount + 1 : 1;
          setSelectedOrder(optimistic);
        } else {
          optimistic.status = OrderStatus.SUBMITTED;
          optimistic.rejectionReason = rejectReason;
          optimistic.revisionCount = Math.max(optimistic.revisionCount ?? 0, 1);
          setSelectedOrder(optimistic);
        }
      }

      const key = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const response = await apiClient.reviewOrder(
        selectedOrderId,
        decision,
        decision === 'REJECT' ? rejectReason : undefined,
        key,
      );

      const message = response.data?.message || '처리가 완료되었습니다';
      toast.success(message, { position: 'top-center' });
      setRejectionReason('');

      // 강제 재조회로 정합 확인
      await loadOrderDetail(selectedOrderId, true);

      await fetchStats();

      const nextTab: BucketKey = decision === 'APPROVE' ? 'todayDone' : 'writing';
      setActiveTab(nextTab);
      setMeta((prev) => ({ ...prev, page: 1 }));

      // 리스트 최신화: activeTab setState는 비동기라, nextTab을 명시해서 즉시 반영
      await fetchOrders(1, { silent: true, statusOverride: nextTab });
    } catch (error: any) {
      console.error('Failed to submit review', error);
      // 롤백
      if (selectedOrder) {
        await loadOrderDetail(selectedOrderId, true);
      }
      if (error?.status === 409) {
        toast.error('상태가 변경되었습니다. 화면을 새로고침했습니다.', { position: 'top-center' });
      } else {
        toast.error(error.message || '처리에 실패했습니다', { position: 'top-center' });
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevisionRequest = async () => {
    if ((selectedOrder?.revisionCount ?? 0) >= 1) {
      toast.error('수정요청은 1회만 가능합니다', { position: 'top-center' });
      return;
    }
    const initial = rejectionReason.trim();
    const input = window.prompt('수정 요청 사유를 입력해주세요 (최대 300자)', initial);
    if (input === null) {
      return;
    }
    const trimmed = input.trim();
    if (!trimmed) {
      toast.error('수정 요청 사유를 입력해주세요', { position: 'top-center' });
      return;
    }
    if (trimmed.length > 300) {
      toast.error('수정 요청 사유는 300자 이하여야 합니다', { position: 'top-center' });
      return;
    }
    setRejectionReason(trimmed);
    await handleReview('REJECT', trimmed);
  };

  const closeCancelDialog = () => {
    setCancelDialogOpen(false);
    setCancelReason('');
  };

  const handleCancelConfirm = async () => {
    if (!selectedOrderId) return;
    const trimmed = cancelReason.trim();
    if (trimmed.length < 10 || trimmed.length > 300) {
      toast.error('작성 중단 사유는 10~300자 사이여야 합니다', { position: 'top-center' });
      return;
    }

    setCancelLoading(true);
    try {
      const key = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const response = await apiClient.cancelOrder(selectedOrderId, trimmed, key);
      const message = response.data?.message || '작성 중단을 완료했습니다';
      toast.success(message, { position: 'top-center' });

      closeCancelDialog();

      await loadOrderDetail(selectedOrderId, true);
      await fetchStats(true);
      await fetchOrders(meta.page, { silent: true });
    } catch (error: any) {
      console.error('Failed to cancel order', error);
      if (error?.status === 409) {
        toast.error(error.message || '상태가 변경되었습니다. 화면을 새로고침했습니다.', { position: 'top-center' });
        await loadOrderDetail(selectedOrderId, true);
      } else {
        toast.error(error?.message || '작성 중단 처리에 실패했습니다', { position: 'top-center' });
      }
    } finally {
      setCancelLoading(false);
    }
  };

  

  const handlePageChange = (nextPage: number) => {
    setMeta((prev) => ({ ...prev, page: nextPage }));
    void fetchOrders(nextPage);
  };

  useEffect(() => {
    if (selectedOrderId) {
      void loadOrderDetail(selectedOrderId, true);
    }
  }, [activeTab]);

  const keywordSummary = useMemo(() => {
    if (!selectedOrder?.searchKeywords) return [];
    return selectedOrder.searchKeywords
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean);
  }, [selectedOrder]);

  const hashtags = selectedOrder?.hashtags || [];
  const photoUrls = (selectedOrder?.photoSnapshot?.length ? selectedOrder.photoSnapshot.map((p) => p.url) : selectedOrder?.photos) || [];
  const photoCount = photoUrls.length;
  const canCancelOrder = selectedOrder ? CANCELABLE_STATUSES.has(selectedOrder.status) : false;
  const cancelReasonLength = cancelReason.trim().length;
  const isCancelReasonValid = cancelReasonLength >= 10 && cancelReasonLength <= 300;

  const getAgencyStatusLabel = (order: Order) => {
    const revisionCount = order.revisionCount ?? 0;
    if ((order.status === OrderStatus.AGENCY_REVIEW || order.status === OrderStatus.GENERATED) && revisionCount >= 1) {
      return '수정본 도착';
    }
    // V2: GENERATED → "원고 완료"
    if (order.status === OrderStatus.GENERATED) {
      return '원고 완료';
    }
    return getStatusLabel(order.status);
  };

  return (
    <RouteGuard requiredRole="AGENCY">
      <AppShell sidebar={<AgencySidebar />}>
        <div className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                원고 캠페인 관리
              </h1>
              <Link href="/agency/orders/new" className="btn-brand w-full lg:w-auto text-center">
                새 원고 접수
              </Link>
            </div>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              진행 상태별로 원고(캠페인)를 확인하고, “1차 확인 요청” 건은 상세에서 원고를 확인한 뒤 승인/수정요청 처리할 수 있습니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
              <div className="card text-center py-3">
                <div className="text-xs" style={{ color: 'var(--muted)' }}>작성 중</div>
                <div className="text-xl font-semibold" style={{ color: 'var(--text)' }}>{stats.writing.toLocaleString('ko-KR')}</div>
              </div>
              <div className="card text-center py-3">
                <div className="text-xs" style={{ color: 'var(--muted)' }}>1차 확인 요청</div>
                <div className="text-xl font-semibold" style={{ color: 'var(--text)' }}>{stats.firstReview.toLocaleString('ko-KR')}</div>
              </div>
              <div className="card text-center py-3">
                <div className="text-xs" style={{ color: 'var(--muted)' }}>금일 완료</div>
                <div className="text-xl font-semibold" style={{ color: 'var(--text)' }}>{stats.todayDone.toLocaleString('ko-KR')}</div>
              </div>
            </div>
          </div>

          {/* ── 주문 상세: 2컬럼 레이아웃 (사진 | 원고) ── */}
          {selectedOrder && isDesktop && !loadingDetail && (
            <div>
              {/* 헤더 */}
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <button
                  onClick={closeDrawer}
                  className="flex items-center gap-1 text-sm font-medium hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--brand)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  목록으로
                </button>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{selectedOrder.placeName}</h2>
                <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(selectedOrder.status)}`}>
                  {getAgencyStatusLabel(selectedOrder)}
                </span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>사진 {photoCount}장</span>
                <div className="ml-auto flex items-center gap-2">
                  {selectedOrder.status === OrderStatus.COMPLETE && (
                    <button
                      className="text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-60"
                      style={{ background: 'var(--brand)' }}
                      onClick={() => void handleDownloadDeliverableZip()}
                      disabled={zipDownloading}
                    >
                      {zipDownloading ? '다운로드 중…' : '완료본 다운로드'}
                    </button>
                  )}
                  {canCancelOrder && (
                    <button
                      className="px-3 py-1.5 rounded-lg text-xs"
                      style={{ background: '#FFEBEB', color: '#E5484D' }}
                      onClick={() => { setCancelDialogOpen(true); setCancelReason(''); }}
                    >
                      작성 중단
                    </button>
                  )}
                  <button
                    className="text-xs px-2 py-1 rounded bg-[var(--bg)] hover:bg-[var(--border-light)]"
                    style={{ color: 'var(--muted)' }}
                    onClick={() => selectedOrderId && loadOrderDetail(selectedOrderId, true)}
                  >
                    새로고침
                  </button>
                </div>
              </div>
              {selectedOrder.placeAddress && (
                <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>{selectedOrder.placeAddress}</p>
              )}

              {/* 2컬럼 본문 */}
              <div className="flex gap-6" style={{ height: 'calc(100vh - 280px)' }}>
                {/* LEFT: 사진 + 정보 */}
                <div className="w-1/2 overflow-y-auto pr-3 space-y-4">
                  {/* 검색 키워드 */}
                  {keywordSummary.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>검색 키워드</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {keywordSummary.map(kw => (
                          <span key={kw} className="px-2.5 py-1 text-xs rounded-full font-medium" style={{ background: '#E8F3FF', color: '#1B64DA' }}>{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 해시태그 */}
                  {hashtags.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>해시태그 ({hashtags.length})</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {hashtags.map(tag => (
                          <span key={tag} className="px-2.5 py-1 text-xs rounded-full" style={{ background: '#F2F4F6', color: '#6B7684' }}>#{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 사진 그리드 */}
                  <div>
                    <h3 className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>사진 ({photoCount}장)</h3>
                    {photoUrls.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2">
                        {photoUrls.map((url: string, idx: number) => (
                          <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group" style={{ border: '1px solid var(--border)' }}>
                            <img src={url} alt={`사진 ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                            <span className="absolute top-1.5 left-1.5 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                              {idx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm py-6 text-center" style={{ color: 'var(--muted)' }}>등록된 사진이 없습니다</p>
                    )}
                  </div>
                  {/* 비고 */}
                  {selectedOrder.notes && (
                    <div>
                      <h3 className="text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>비고</h3>
                      <p className="text-sm p-3 rounded-xl" style={{ background: 'var(--bg)', color: 'var(--text)' }}>{selectedOrder.notes}</p>
                    </div>
                  )}
                </div>

                {/* RIGHT: 원고 + 리포트 + 액션 */}
                <div className="w-1/2 overflow-y-auto pl-3 space-y-4">
                  {selectedOrder.status === OrderStatus.GENERATED || selectedOrder.status === OrderStatus.AGENCY_REVIEW || selectedOrder.status === OrderStatus.COMPLETE ? (
                    <>
                      {/* 원고 미리보기 */}
                      <div className="rounded-2xl p-5" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold" style={{ color: 'var(--text)' }}>원고 미리보기</h3>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F2F4F6', color: 'var(--muted)' }}>
                            {(selectedOrder.manuscript || '').length.toLocaleString()}자
                          </span>
                        </div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap rounded-xl p-4 max-h-[55vh] overflow-y-auto" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
                          {selectedOrder.manuscript || '원고가 아직 생성되지 않았습니다.'}
                        </div>
                      </div>

                      {/* 리포트 */}
                      <div className="rounded-2xl p-5" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                        <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text)' }}>리포트 결과</h3>
                        <div className="space-y-2">
                          {(() => {
                            const manuscript = selectedOrder.manuscript || '';
                            const charCount = manuscript.length;
                            const hashtagCount = hashtags.length;
                            const requiredKeywords = selectedOrder.requiredKeywords || [];
                            const charOk = charCount >= 1500 && charCount <= 2000;
                            const hashtagOk = hashtagCount <= 5;
                            const requiredOk = requiredKeywords.length === 0 || requiredKeywords.every(kw => manuscript.toLowerCase().includes(kw.toLowerCase()));
                            const items = [
                              { label: '글자수', ok: charOk, detail: `${charCount.toLocaleString()}자 (1,500~2,000자 권장)` },
                              { label: '해시태그', ok: hashtagOk, detail: `${hashtagCount}개 (적합)` },
                              { label: '필수 키워드', ok: requiredOk, detail: requiredOk ? '모두 포함' : '일부 누락' },
                              { label: '링크/지도', ok: true, detail: `${selectedOrder.hasLink || selectedOrder.hasMap ? '포함' : '미포함'} (선택)` },
                            ];
                            return items.map(({ label, ok, detail }) => (
                              <div key={label} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'var(--bg)' }}>
                                <div className="flex items-center gap-2">
                                  <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold text-white ${ok ? 'bg-green-500' : 'bg-red-400'}`}>
                                    {ok ? '✓' : '✗'}
                                  </span>
                                  <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</span>
                                </div>
                                <span className="text-xs" style={{ color: ok ? 'var(--success)' : 'var(--danger)' }}>{detail}</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                      {/* 승인/수정요청 */}
                      {(selectedOrder.status === OrderStatus.AGENCY_REVIEW || selectedOrder.status === OrderStatus.GENERATED) && (
                        <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                          <p className="text-xs" style={{ color: 'var(--muted)' }}>
                            승인(최종 승인) 또는 수정요청을 선택해주세요. 수정요청은 사유 입력이 필요합니다.
                          </p>
                          <div className="flex gap-3">
                            <button
                              className="flex-1 py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
                              style={{ background: 'var(--bg)', color: 'var(--danger)', border: '1px solid var(--border)' }}
                              onClick={() => void handleRevisionRequest()}
                              disabled={actionLoading || (selectedOrder.revisionCount ?? 0) >= 1}
                            >
                              {actionLoading ? '처리 중…' : (selectedOrder.revisionCount ?? 0) >= 1 ? '수정요청 완료' : '수정요청 (Ctrl+R)'}
                            </button>
                            <button
                              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                              style={{ background: 'var(--brand)' }}
                              onClick={() => void handleReview('APPROVE')}
                              disabled={actionLoading}
                            >
                              {actionLoading ? '처리 중…' : '승인 (Enter)'}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: '#F2F4F6' }}>
                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h4m2-12H9a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V6a2 2 0 00-2-2z" stroke="#B0B8C1" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </div>
                      <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>원고가 아직 준비되지 않았습니다</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        {[OrderStatus.REGEN_QUEUED, OrderStatus.GENERATING].includes(selectedOrder.status)
                          ? '원고를 작성하고 있습니다. 잠시만 기다려주세요.'
                          : '접수 후 원고가 작성되면 이곳에서 확인할 수 있습니다.'}
                      </p>
                    </div>
                  )}
                  {/* 반려 사유 */}
                  {selectedOrder.rejectionReason && (
                    <div className="rounded-2xl p-4" style={{ background: '#FFEBEB', border: '1px solid #FFC1C1' }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#E5484D' }}>이전 수정요청 사유</p>
                      <p className="text-sm" style={{ color: '#C13535' }}>{selectedOrder.rejectionReason}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-6" style={{ display: selectedOrder && isDesktop ? 'none' : undefined }}>
            <div className="lg:w-[55%] space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {BUCKET_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      setMeta((prev) => ({ ...prev, page: 1 }));
                    }}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      activeTab === tab.key
                        ? 'bg-[var(--brand)] text-white'
                        : 'bg-[var(--bg)] text-[var(--muted)] hover:bg-[var(--border-light)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="card">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      캠페인(원고) 목록
                    </h2>
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                      행을 클릭하면 상세가 열립니다.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4 sticky top-0 z-10 bg-[var(--bg)]/80 backdrop-blur rounded-md p-2">
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSearch();
                        }
                      }}
                      className="input-dark flex-1"
                      placeholder="업체/장소명 또는 키워드 검색"
                    />
                    <button onClick={handleSearch} className="btn-brand whitespace-nowrap">
                      검색
                    </button>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
                    {activeTab === 'todayDone' ? (
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>완료일</span>
                        <input
                          type="date"
                          value={doneDate}
                          onChange={(e) => {
                            setDoneDate(e.target.value);
                            setMeta((prev) => ({ ...prev, page: 1 }));
                          }}
                          className="input-dark w-full md:w-auto"
                        />
                      </div>
                    ) : null}
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                      className="input-dark w-full md:w-auto"
                    >
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left" style={{ color: 'var(--muted)' }}>
                        <th className="py-2 px-3">상태</th>
                        <th className="py-2 px-3">업체/장소</th>
                        <th className="py-2 px-3">키워드</th>
                        <th className="py-2 px-3">사진</th>
                        <th className="py-2 px-3">확인 결과</th>
                        <th className="py-2 px-3">최근 업데이트</th>
                        <th className="py-2 px-3 text-right">상세</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingOrders ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center" style={{ color: 'var(--muted)' }}>
                            목록을 불러오는 중입니다...
                          </td>
                        </tr>
                      ) : orders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8">
                            <div className="flex flex-col items-center gap-3" style={{ color: 'var(--muted)' }}>
                              <span>현재 조건에 해당하는 원고가 없습니다.</span>
                              <button
                                className="btn-outline"
                                onClick={() => {
                                  setSearchInput('');
                                  setQuery('');
                                  setSort('updatedAt,desc');
                                  setActiveTab('writing');
                                  setMeta((prev) => ({ ...prev, page: 1 }));
                                  void fetchOrders(1);
                                }}
                              >
                                모든 원고 보기
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        orders.map((order) => {
                          const keywords = order.searchKeywords
                            ? order.searchKeywords
                                .split(',')
                                .map((k) => k.trim())
                                .filter(Boolean)
                            : [];
                          const keywordLabel = keywords.length > 3
                            ? `${keywords.slice(0, 3).join(', ')} 외 ${keywords.length - 3}개`
                            : keywords.join(', ');
                          
                          const approveCount = order.approveCount || 0;
                          const revisionCount = order.revisionCount || 0;

                          return (
                            <tr
                              data-row-id={order.id}
                              key={order.id}
                              onClick={() => handleRowClick(order)}
                              tabIndex={0}
                              role="button"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleRowClick(order);
                                }
                              }}
                              className={`cursor-pointer transition-colors ${
                                selectedOrderId === order.id ? 'bg-[var(--border-light)]' : 'hover:bg-[var(--bg)]'
                              }`}
                            >
                              <td className="py-2 px-3">
                                <span className={`px-2 py-1 rounded text-xs ${getStatusColor(order.status)} text-center inline-block`}>
                                  {getAgencyStatusLabel(order)}
                                </span>
                              </td>
                              <td className="py-2 px-3" style={{ color: 'var(--text)' }}>
                                {order.placeName}
                              </td>
                              <td className="py-2 px-3" style={{ color: 'var(--muted)' }}>
                                {keywordLabel || '-'}
                              </td>
                              <td className="py-2 px-3" style={{ color: 'var(--muted)' }}>
                                {order.photos?.length ?? 0}
                              </td>
                              <td className="py-2 px-3">
                                {approveCount > 0 || revisionCount > 0 ? (
                                  <span className="text-xs whitespace-nowrap">
                                    <span className="text-blue-500">승인 {approveCount}</span>
                                    {' / '}
                                    <span className="text-red-500">수정요청 {revisionCount}</span>
                                  </span>
                                ) : (
                                  <span className="text-xs" style={{ color: 'var(--muted)' }}>-</span>
                                )}
                              </td>
                              <td className="py-2 px-3" style={{ color: 'var(--muted)' }}>
                                {new Date(order.updatedAt || order.createdAt).toLocaleString('ko-KR')}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  type="button"
                                  aria-label="상세 보기"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowClick(order);
                                  }}
                                  className="text-xs text-[var(--brand)] hover:underline"
                                >
                                  상세 보기
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between mt-4 text-xs" style={{ color: 'var(--muted)' }}>
                  <div>
                    페이지 {meta.page} / {Math.max(1, Math.ceil((meta.total || 0) / PAGE_SIZE))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-outline disabled:opacity-50"
                      onClick={() => handlePageChange(Math.max(1, meta.page - 1))}
                      disabled={meta.page <= 1 || loadingOrders}
                    >
                      이전
                    </button>
                    <button
                      className="btn-outline disabled:opacity-50"
                      onClick={() => handlePageChange(meta.page + 1)}
                      disabled={!meta.hasMore || loadingOrders}
                    >
                      다음
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {cancelDialogOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30"
            onClick={closeCancelDialog}
          >
            <div
              className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text)' }}>
                작성 중단 사유 입력
              </h3>
              <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                작성 중단 사유는 10~300자 사이로 입력해주세요. 취소 사유는 관리자에게 전달되어 빠른 후속 처리를 돕습니다.
              </p>
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                maxLength={300}
                className="input-dark w-full h-28 resize-none"
                placeholder="작성 중단 사유를 입력하세요"
              />
              <div className="mt-2 flex items-center justify-between text-xs" style={{ color: isCancelReasonValid ? 'var(--muted)' : 'var(--danger)' }}>
                <span>{cancelReasonLength} / 300자</span>
                {!isCancelReasonValid && <span>사유는 10~300자 사이여야 합니다.</span>}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-outline px-4"
                  onClick={closeCancelDialog}
                  disabled={cancelLoading}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="btn-brand px-4 disabled:opacity-60"
                  onClick={handleCancelConfirm}
                  disabled={cancelLoading || !isCancelReasonValid}
                >
                  {cancelLoading ? '처리 중…' : '작성 중단 확정'}
                </button>
              </div>
            </div>
          </div>
        )}

      </AppShell>
    </RouteGuard>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="p-6">로딩 중...</div>}>
      <OrdersPageInner />
    </Suspense>
  );
}


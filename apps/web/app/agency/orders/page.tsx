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
  { key: 'firstReview', label: '1차 확인 요청' },
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
      if (!selectedOrder || selectedOrder.status !== OrderStatus.AGENCY_REVIEW || actionLoading) {
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
    if (order.status === OrderStatus.AGENCY_REVIEW && revisionCount >= 1) {
      return '수정본 도착';
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

          <div className="flex flex-col lg:flex-row gap-6">
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
                        : 'bg-white/5 text-[var(--muted)] hover:bg-white/10'
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
                                selectedOrderId === order.id ? 'bg-white/10' : 'hover:bg-white/5'
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

            {/* 드로어 배경 오버레이 */}
            {isDesktop && selectedOrderId && (
              <div
                className="fixed inset-0 bg-black/40 z-40 transition-opacity duration-300"
                onClick={closeDrawer}
                style={{ opacity: selectedOrderId ? 1 : 0 }}
              />
            )}

            {/* 드로어 슬라이드 패널 */}
            {isDesktop && selectedOrderId && (
              <div
                className="fixed right-0 top-0 bottom-0 w-[45%] bg-[var(--panel)] shadow-2xl z-50 overflow-y-auto transition-transform duration-300 ease-out"
                style={{
                  transform: selectedOrderId ? 'translateX(0)' : 'translateX(100%)',
                }}
              >
                {loadingDetail ? (
                  <div className="py-10 text-center" style={{ color: 'var(--muted)' }}>
                    상세 정보를 불러오는 중입니다...
                  </div>
                ) : !selectedOrder ? (
                  <div className="py-10 text-center" style={{ color: 'var(--muted)' }}>
                    주문을 선택해주세요.
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    {/* 드로어 헤더 */}
                    <div className="sticky top-0 bg-[var(--panel)] border-b border-white/10 p-4 z-10">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h2 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                            {selectedOrder.placeName}
                          </h2>
                          {selectedOrder.placeAddress && (
                            <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                              {selectedOrder.placeAddress}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={closeDrawer}
                          className="ml-4 p-1 rounded hover:bg-white/10 transition-colors"
                          aria-label="닫기"
                        >
                          <svg className="w-5 h-5" style={{ color: 'var(--muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(selectedOrder.status)}`}>
                          {getAgencyStatusLabel(selectedOrder)}
                        </span>
                        {selectedOrder.status === OrderStatus.FAILED && (
                          <span className="px-2 py-1 rounded text-xs bg-red-600/20 text-red-400">
                            재생성 실패
                          </span>
                        )}
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                          사진 {photoCount}장
                        </span>
                        {selectedOrder.status === OrderStatus.CANCEL_REQUESTED && (
                          <span className="px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-200 whitespace-nowrap">
                            작성 중단 요청됨
                          </span>
                        )}
                        {selectedOrder.status === OrderStatus.CANCELED_BY_AGENCY && (
                          <span className="px-2 py-1 rounded text-xs bg-gray-500/40 text-gray-100 whitespace-nowrap">
                            대행사 취소
                          </span>
                        )}
                        {((selectedOrder.approveCount || 0) > 0 || (selectedOrder.revisionCount || 0) > 0) && (
                          <span className="px-2 py-1 rounded text-xs bg-white/5 whitespace-nowrap">
                            <span className="text-blue-500">승인 {selectedOrder.approveCount || 0}</span>
                            {' / '}
                            <span className="text-red-500">수정요청 {selectedOrder.revisionCount || 0}</span>
                          </span>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                          {selectedOrder.status === OrderStatus.COMPLETE && (
                            <button
                              className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
                              onClick={() => void handleDownloadDeliverableZip()}
                              disabled={zipDownloading}
                            >
                              {zipDownloading ? '다운로드 중…' : '완료본(이미지+원고) 다운로드'}
                            </button>
                          )}
                          {canCancelOrder && (
                            <button
                              className="px-3 py-1 rounded bg-red-500/20 text-red-200 hover:bg-red-500/30 text-xs"
                              onClick={() => {
                                setCancelDialogOpen(true);
                                setCancelReason('');
                              }}
                            >
                              작성 중단
                            </button>
                          )}
                          <button
                            className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10"
                            onClick={() => selectedOrderId && loadOrderDetail(selectedOrderId, true)}
                          >
                            새로고침
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-3 text-xs" style={{ color: 'var(--muted)' }}>
                        <div>
                          <div className="text-[0.7rem] uppercase tracking-wide">작성</div>
                          <div>{new Date(selectedOrder.createdAt).toLocaleString('ko-KR')}</div>
                        </div>
                        <div>
                          <div className="text-[0.7rem] uppercase tracking-wide">갱신</div>
                          <div>{new Date(selectedOrder.updatedAt).toLocaleString('ko-KR')}</div>
                        </div>
                      </div>
                    </div>

                    {/* 드로어 본문 */}
                    <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                      {/* 키워드 요약 */}
                      <div>
                        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>
                          검색 키워드
                        </h3>
                        {keywordSummary.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--muted)' }}>
                            키워드가 없습니다.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2 text-xs">
                            {keywordSummary.map((keyword) => (
                              <span key={keyword} className="px-2 py-1 rounded bg-white/10" style={{ color: 'var(--text)' }}>
                                {keyword}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {hashtags.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>
                            해시태그 ({hashtags.length})
                          </h3>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {hashtags.map((tag) => (
                              <span key={tag} className="px-2 py-1 rounded bg-white/10" style={{ color: 'var(--text)' }}>
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedOrder.referenceReviews && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>
                            참고 리뷰
                          </h3>
                          <div className="p-3 rounded bg-white/5 text-sm whitespace-pre-wrap" style={{ color: 'var(--muted)' }}>
                            {selectedOrder.referenceReviews}
                          </div>
                        </div>
                      )}

                      {selectedOrder.notes && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>
                            비고
                          </h3>
                          <div className="p-3 rounded bg-white/5 text-sm" style={{ color: 'var(--muted)' }}>
                            {selectedOrder.notes}
                          </div>
                        </div>
                      )}

                      {/* 원고 미리보기 */}
                      {selectedOrder.status === OrderStatus.AGENCY_REVIEW || selectedOrder.status === OrderStatus.COMPLETE ? (
                        <>
                          <div>
                            <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>
                              원고 미리보기
                            </h3>
                            <div className="p-4 bg-white/5 rounded text-sm whitespace-pre-wrap max-h-96 overflow-y-auto" style={{ color: 'var(--text)' }}>
                              {selectedOrder.manuscript || '원고가 아직 제공되지 않았습니다.'}
                            </div>
                          </div>

                          {/* 리포트 */}
                          <div>
                            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
                              리포트 결과
                            </h3>
                            <div className="space-y-2">
                              {(() => {
                                const manuscript = selectedOrder.manuscript || '';
                                const charCount = manuscript.length;
                                const hashtagCount = hashtags.length;
                                const hasLink = selectedOrder.hasLink;
                                const hasMap = selectedOrder.hasMap;
                                const requiredKeywords = selectedOrder.requiredKeywords || [];
                                
                                const charOk = charCount >= 1500 && charCount <= 2000;
                                const hashtagOk = hashtagCount <= 5;
                                const requiredOk = requiredKeywords.length === 0 || requiredKeywords.every(kw => manuscript.toLowerCase().includes(kw.toLowerCase()));
                                const linkMapOk = true; // 링크/지도는 선택사항이므로 항상 OK

                                return (
                                  <>
                                    <div className="flex items-center gap-2 text-sm">
                                      {charOk ? (
                                        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      ) : (
                                        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      )}
                                      <span style={{ color: charOk ? 'var(--success)' : 'var(--danger)' }}>
                                        글자수: {charCount.toLocaleString()}자 {charOk ? '(적합)' : '(1,500~2,000자 권장)'}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm">
                                      {hashtagOk ? (
                                        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      ) : (
                                        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      )}
                                      <span style={{ color: hashtagOk ? 'var(--success)' : 'var(--danger)' }}>
                                        해시태그: {hashtagCount}개 {hashtagOk ? '(적합)' : '(최대 5개)'}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm">
                                      {requiredOk ? (
                                        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      ) : (
                                        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      )}
                                      <span style={{ color: requiredOk ? 'var(--success)' : 'var(--danger)' }}>
                                        필수 키워드: {requiredOk ? '모두 포함' : '일부 누락'}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm">
                                      <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      <span style={{ color: 'var(--success)' }}>
                                        링크/지도: {hasLink || hasMap ? '포함' : '미포함'} (선택)
                                      </span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="p-4 bg-white/5 rounded text-sm text-center" style={{ color: 'var(--muted)' }}>
                          원고가 작성되면 상세에서 미리보기가 활성화됩니다.
                        </div>
                      )}

                      {selectedOrder.rejectionReason && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--danger)' }}>
                            최근 수정요청 사유
                          </h3>
                          <div className="p-3 rounded bg-red-500/10 text-sm" style={{ color: 'var(--danger)' }}>
                            {selectedOrder.rejectionReason}
                          </div>
                        </div>
                      )}

                      
                    </div>

                    {/* 드로어 푸터 (확인 액션) */}
                    {selectedOrder.status === OrderStatus.AGENCY_REVIEW && (
                      <div className="sticky bottom-0 bg-[var(--panel)] border-t border-white/10 p-4 space-y-3">
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          승인(최종 승인) 또는 수정요청을 선택해주세요. 수정요청은 사유 입력이 필요합니다.
                        </p>
                        <div className="flex gap-3">
                          <button
                            className="flex-1 px-4 py-3 rounded-lg font-medium text-white bg-white/10 hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                            onClick={() => void handleRevisionRequest()}
                            disabled={actionLoading || (selectedOrder.revisionCount ?? 0) >= 1}
                          >
                            {actionLoading ? '처리 중...' : (selectedOrder.revisionCount ?? 0) >= 1 ? '수정요청 완료' : '수정요청 (Ctrl+R)'}
                          </button>
                          <button
                            className="flex-1 px-4 py-3 rounded-lg font-medium text-white bg-[var(--brand)] hover:opacity-90 disabled:opacity-60 transition-colors"
                            onClick={() => void handleReview('APPROVE')}
                            disabled={actionLoading}
                          >
                            {actionLoading ? '처리 중...' : '승인 (Enter)'}
                          </button>
                        </div>
                      </div>
                    )}

                    
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {cancelDialogOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
            onClick={closeCancelDialog}
          >
            <div
              className="w-full max-w-md rounded-lg border border-white/10 bg-[var(--panel)] p-6 shadow-2xl"
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


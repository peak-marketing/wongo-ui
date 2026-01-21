'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import AdminSidebar from '@/components/nav/AdminSidebar';
import RouteGuard from '@/components/auth/RouteGuard';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

type AgencyListRow = {
  userId: string;
  businessName: string | null;
  businessRegNo: string | null;
  email: string | null;
};

type AgencySettlement = {
  userId: string;
  range: string;
  start: string;
  end: string;
  summary: {
    topupSum: number;
    captureSum: number;
    captureCount: number;
    adminCostSum: number;
    profitSum: number;
    lastTopupAt: string | null;
  };
  details: SettlementDetailRow[];
};

type SettlementDetailRow = {
  id: string;
  createdAt: string;
  type: string;
  amount: number;
  status: string;
  orderId: string | null;
  memo: string | null;
};

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function formatNumber(n: number) {
  return Number(n || 0).toLocaleString('ko-KR');
}

function formatKstDateOnly(iso: string | null | undefined) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function getTypeLabel(type: string) {
  const labels: Record<string, string> = {
    TOPUP_REQUEST: '충전요청',
    TOPUP_APPROVED: '충전승인',
    TOPUP: '충전',
    CAPTURE: '차감',
  };
  return labels[type] || type;
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: '대기',
    COMPLETED: '완료',
    REJECTED: '반려',
    FAILED: '실패',
    CANCELED: '취소',
  };
  return labels[status] || status;
}

export default function AdminSettlementsPage() {
  const initialYmd = useMemo(() => todayYmd(), []);
  const didInitRef = useRef(false);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpi, setKpi] = useState<{
    date: string;
    todayTopupSum: number;
    todayProfitSum: number;
    todayCaptureCount: number;
    todayCaptureSum?: number;
  } | null>(null);

  const [query, setQuery] = useState('');
  const [agenciesLoading, setAgenciesLoading] = useState(false);
  const [agencies, setAgencies] = useState<AgencyListRow[]>([]);

  const [selected, setSelected] = useState<AgencyListRow | null>(null);
  const [agencyLoading, setAgencyLoading] = useState(false);
  const [agencySettlement, setAgencySettlement] = useState<AgencySettlement | null>(null);

  const loadKpi = async () => {
    setKpiLoading(true);
    try {
      const res = await apiClient.getAdminSettlementKpi(initialYmd);
      setKpi(res.data);
    } catch (error: any) {
      toast.error(error?.message || 'KPI를 불러올 수 없습니다');
    } finally {
      setKpiLoading(false);
    }
  };

  const loadAgencies = async (q?: string, autoSelectFirst?: boolean) => {
    setAgenciesLoading(true);
    try {
      const res = await apiClient.getAdminSettlementAgencies(q ?? query);
      const list = (res.data?.items || []) as AgencyListRow[];
      setAgencies(list);

      if (autoSelectFirst && list.length > 0) {
        setSelected(list[0]);
      }
    } catch (error: any) {
      toast.error(error?.message || '대행사 목록을 불러올 수 없습니다');
    } finally {
      setAgenciesLoading(false);
    }
  };

  const loadAgencySettlement = async (userId: string) => {
    setAgencyLoading(true);
    setAgencySettlement(null);
    try {
      const res = await apiClient.getAdminSettlementByAgency({ userId, range: '30d' });
      setAgencySettlement(res.data as AgencySettlement);
    } catch (error: any) {
      toast.error(error?.message || '대행사 정산 데이터를 불러올 수 없습니다');
    } finally {
      setAgencyLoading(false);
    }
  };

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    loadKpi();
    loadAgencies('', true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected?.userId) return;
    loadAgencySettlement(selected.userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.userId]);

  return (
    <RouteGuard requiredRole="ADMIN">
      <AppShell sidebar={<AdminSidebar />}>
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              정산 관리
            </h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="card">
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                오늘 충전합(완료)
              </div>
              <div className="text-2xl font-bold mt-1" style={{ color: 'var(--text)' }}>
                {kpiLoading ? '-' : formatNumber(kpi?.todayTopupSum || 0)}
              </div>
            </div>
            <div className="card">
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                오늘 순이익
              </div>
              <div className="text-2xl font-bold mt-1" style={{ color: 'var(--text)' }}>
                {kpiLoading ? '-' : formatNumber(kpi?.todayProfitSum || 0)}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                차감합 - (차감건수 × 1500)
              </div>
            </div>
            <div className="card">
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                오늘 차감건수
              </div>
              <div className="text-2xl font-bold mt-1" style={{ color: 'var(--text)' }}>
                {kpiLoading ? '-' : formatNumber(kpi?.todayCaptureCount || 0)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card space-y-3">
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                대행사
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="사업자명/번호/이메일 검색"
                  className="px-3 py-2 rounded bg-white/5 w-full"
                  style={{ color: 'var(--text)' }}
                />
                <button
                  className="btn-brand text-sm px-3 py-2"
                  onClick={() => loadAgencies(query, false)}
                  disabled={agenciesLoading}
                >
                  검색
                </button>
              </div>

              {agenciesLoading ? (
                <div className="text-sm" style={{ color: 'var(--muted)' }}>
                  로딩 중...
                </div>
              ) : agencies.length === 0 ? (
                <div className="text-sm" style={{ color: 'var(--muted)' }}>
                  대행사가 없습니다.
                </div>
              ) : (
                <div className="space-y-1 max-h-[520px] overflow-y-auto">
                  {agencies.map((a) => {
                    const isSelected = selected?.userId === a.userId;
                    return (
                      <button
                        key={a.userId}
                        type="button"
                        onClick={() => setSelected(a)}
                        className={`w-full text-left px-3 py-2 rounded border border-white/10 hover:bg-white/5 ${
                          isSelected ? 'bg-white/5' : ''
                        }`}
                        title="선택"
                      >
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                          {a.businessName || '-'}
                        </div>
                        <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                          {a.businessRegNo || '-'}
                        </div>
                        <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                          {a.email || a.userId}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 space-y-4">
              {!selected ? (
                <div className="card">
                  <div className="text-sm" style={{ color: 'var(--muted)' }}>
                    대행사를 선택하세요.
                  </div>
                </div>
              ) : agencyLoading ? (
                <div className="card">
                  <div className="text-sm" style={{ color: 'var(--muted)' }}>
                    불러오는 중...
                  </div>
                </div>
              ) : !agencySettlement ? (
                <div className="card">
                  <div className="text-sm" style={{ color: 'var(--muted)' }}>
                    데이터를 불러올 수 없습니다.
                  </div>
                </div>
              ) : (
                <>
                  <div className="card space-y-3">
                    <div className="flex flex-col gap-1">
                      <div className="text-base font-semibold" style={{ color: 'var(--text)' }}>
                        {selected.businessName || '-'}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--muted)' }}>
                        최근 30일 ({agencySettlement.start} ~ {agencySettlement.end})
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex items-center justify-between gap-3 border border-white/10 rounded px-3 py-2">
                        <div className="text-sm" style={{ color: 'var(--muted)' }}>
                          마지막 충전일
                        </div>
                        <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                          {formatKstDateOnly(agencySettlement.summary.lastTopupAt)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 border border-white/10 rounded px-3 py-2">
                        <div className="text-sm" style={{ color: 'var(--muted)' }}>
                          충전합(완료)
                        </div>
                        <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                          {formatNumber(agencySettlement.summary.topupSum)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 border border-white/10 rounded px-3 py-2">
                        <div className="text-sm" style={{ color: 'var(--muted)' }}>
                          차감합(매출)
                        </div>
                        <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                          {formatNumber(agencySettlement.summary.captureSum)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 border border-white/10 rounded px-3 py-2">
                        <div className="text-sm" style={{ color: 'var(--muted)' }}>
                          차감건수
                        </div>
                        <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                          {formatNumber(agencySettlement.summary.captureCount)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 border border-white/10 rounded px-3 py-2">
                        <div className="text-sm" style={{ color: 'var(--muted)' }}>
                          관리자원가합
                        </div>
                        <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                          {formatNumber(agencySettlement.summary.adminCostSum)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 border border-white/10 rounded px-3 py-2">
                        <div className="text-sm" style={{ color: 'var(--muted)' }}>
                          순이익
                        </div>
                        <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                          {formatNumber(agencySettlement.summary.profitSum)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>
                      최근 거래 (최대 100건)
                    </div>

                    {agencySettlement.details.length === 0 ? (
                      <div className="text-sm" style={{ color: 'var(--muted)' }}>
                        거래 내역이 없습니다.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left border-b border-white/10">
                              <th className="py-2 pr-4 whitespace-nowrap">일시</th>
                              <th className="py-2 pr-4 whitespace-nowrap">유형</th>
                              <th className="py-2 pr-4 whitespace-nowrap">금액</th>
                              <th className="py-2 pr-4 whitespace-nowrap">상태</th>
                              <th className="py-2 pr-4 whitespace-nowrap">주문ID</th>
                              <th className="py-2 pr-4 whitespace-nowrap">메모</th>
                            </tr>
                          </thead>
                          <tbody>
                            {agencySettlement.details.map((d) => (
                              <tr key={d.id} className="border-b border-white/5">
                                <td className="py-2 pr-4 whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                                  {new Date(d.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                                </td>
                                <td className="py-2 pr-4 whitespace-nowrap" style={{ color: 'var(--text)' }}>
                                  {getTypeLabel(d.type)}
                                </td>
                                <td className="py-2 pr-4 whitespace-nowrap" style={{ color: 'var(--text)' }}>
                                  {formatNumber(d.amount)}
                                </td>
                                <td className="py-2 pr-4 whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                                  {getStatusLabel(d.status)}
                                </td>
                                <td className="py-2 pr-4" style={{ color: 'var(--muted)' }}>
                                  <div className="max-w-sm truncate" title={d.orderId || ''}>
                                    {d.orderId || '-'}
                                  </div>
                                </td>
                                <td className="py-2 pr-4" style={{ color: 'var(--muted)' }}>
                                  <div className="max-w-sm truncate" title={d.memo || ''}>
                                    {d.memo || '-'}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    </RouteGuard>
  );
}

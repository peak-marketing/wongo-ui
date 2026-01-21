"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { apiClient } from '@/lib/api';
import type { PagedResult, TopupRequestItem, TransactionItem, WalletSummary } from '@/lib/types';
import { formatKRW, parseKRWInput } from '@/lib/utils';
import AppShell from '@/components/layout/AppShell';
import AgencySidebar from '@/components/nav/AgencySidebar';
import RouteGuard from '@/components/auth/RouteGuard';

type TxFilters = {
  type?: string;
  from?: string;
  to?: string;
  min?: string;
  max?: string;
  page: number;
  pageSize: number;
};

// 거래 유형 매핑
const TX_TYPE_LABELS: Record<string, string> = {
  TOPUP_REQUEST: '충전요청',
  TOPUP_APPROVED: '충전승인',
  RESERVE: '예약',
  CAPTURE: '사용',
  RELEASE: '해제',
  ADJUST: '조정',
  REFUND: '환불',
};

// 충전 요청 상태 매핑
const TOPUP_STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '거절',
  CANCELED: '취소',
  EXPIRED: '만료',
};

// 거래 상태 매핑
const TX_STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  COMPLETED: '완료',
  FAILED: '실패',
  CANCELED: '취소',
};

// 필터용 간소화된 유형
const FILTER_TYPES = [
  { value: 'TOPUP_REQUEST', label: '충전요청' },
  { value: 'TOPUP_APPROVED', label: '충전승인' },
  { value: 'CAPTURE', label: '사용' },
  { value: 'REFUND', label: '환불' },
];

// 내역(수량) 헬퍼
function getDetailWithUnits(type: string, units: number): string {
  const labels: Record<string, string> = {
    RESERVE: '예약',
    CAPTURE: '사용',
    RELEASE: '해제',
  };
  if (labels[type] && units > 0) {
    return `${labels[type]} ${units}건`;
  }
  return TX_TYPE_LABELS[type] || type;
}

export default function AgencyBillingPage() {
  // ---- states ----
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [topups, setTopups] = useState<PagedResult<TopupRequestItem> | null>(null);
  const [tx, setTx] = useState<PagedResult<TransactionItem> | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<TxFilters>({ page: 1, pageSize: 20 });
  const [topupPage, setTopupPage] = useState(1);
  const [openTopup, setOpenTopup] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [memo, setMemo] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  // 날짜 캘린더 팝오버
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [selectedFromDate, setSelectedFromDate] = useState<Date | undefined>(undefined);
  const [selectedToDate, setSelectedToDate] = useState<Date | undefined>(undefined);
  const fromPickerRef = useRef<HTMLDivElement>(null);
  const toPickerRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fromPickerRef.current && !fromPickerRef.current.contains(event.target as Node)) {
        setShowFromPicker(false);
      }
      if (toPickerRef.current && !toPickerRef.current.contains(event.target as Node)) {
        setShowToPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const invalidAmountMessage = useMemo(() => {
    const parsed = parseKRWInput(amountInput);
    if (parsed === null) return '정수 금액을 입력해 주세요';
    if (parsed < 10000) return '최소 충전 금액은 10,000원입니다';
    if (parsed > 5_000_000) return '최대 충전 금액은 5,000,000원입니다';
    return '';
  }, [amountInput]);

  // ---- loaders ----
  const loadAll = async () => {
    setLoading(true);
    try {
      const [wRes, tRes, xRes] = await Promise.all([
        apiClient.getWallet(),
        apiClient.listTopups({ page: topupPage }),
        apiClient.listTransactions(filters),
      ]);
      setWallet(wRes.data);
      setTopups(tRes.data);
      setTx(xRes.data);
    } catch (err: any) {
      const status = err?.status;
      if (status === 401 || status === 403) {
        toast.error('로그인이 필요합니다. 다시 로그인해 주세요.');
        // soft redirect
        window.location.href = '/';
        return;
      }
      const msg = err?.message || '데이터를 불러오지 못했습니다';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topupPage, JSON.stringify(filters)]);

  // ---- topup ----
  const quickSet = (n: number) => setAmountInput(n.toLocaleString('ko-KR'));
  const createTopup = async () => {
    const parsed = parseKRWInput(amountInput);
    if (parsed === null || parsed < 10000 || parsed > 5_000_000) {
      toast.error(invalidAmountMessage || '금액을 확인해 주세요');
      return;
    }
    try {
      setSubmitBusy(true);
      const key = crypto.randomUUID();
  const res = await apiClient.createTopup(parsed, memo || undefined, key);
  // 서버가 메시지를 제공하면 그대로 표기, 없으면 기본 메시지
  const serverMsg = (res as any)?.data?.message;
  toast.success(serverMsg || '충전 요청이 접수되었습니다.');
      setOpenTopup(false);
      setAmountInput('');
      setMemo('');
      await loadAll();
    } catch (err: any) {
      if (err?.status === 429) {
        toast.error('요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.');
        setCooldown(true);
        setTimeout(() => setCooldown(false), 3000);
      } else {
        toast.error(err?.message || '충전 요청 실패');
      }
    } finally {
      setSubmitBusy(false);
    }
  };

  const cancelTopup = async (id: string) => {
    try {
      await apiClient.cancelTopup(id);
      toast.success('충전 요청이 취소되었습니다.');
      await loadAll();
    } catch (err: any) {
      if (err?.status === 409 || err?.status === 400) {
        toast.error(err?.message || '취소할 수 없는 상태입니다');
      } else if (err?.status === 429) {
        toast.error('요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.');
      } else {
        toast.error(err?.message || '취소 요청 실패');
      }
    }
  };

  // ---- xlsx export ----
  const exportXlsx = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.min) params.append('min', filters.min);
      if (filters.max) params.append('max', filters.max);
      
      const response = await apiClient.exportTransactionsXlsx(filters);
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `거래내역_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('엑셀 파일이 다운로드되었습니다');
    } catch (err: any) {
      toast.error(err?.message || '내보내기 실패');
    }
  };

  return (
    <RouteGuard requiredRole="AGENCY">
      <AppShell sidebar={<AgencySidebar />}>
        <div className="p-6 space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">대행사 충전 관리</h1>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 rounded-md bg-[var(--brand)] text-white disabled:opacity-60"
                onClick={() => setOpenTopup(true)}
              >
                충전하기
              </button>
              <button
                className="px-3 py-2 rounded-md border border-white/10 hover:bg-white/5"
                onClick={loadAll}
                title="재조회"
              >
                새로고침
              </button>
            </div>
          </div>

      {/* summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard title="현재 잔액" value={wallet ? formatKRW(wallet.balance) : '-'} />
        <SummaryCard title="가용 금액" value={wallet ? formatKRW(wallet.available) : '-'} />
        <SummaryCard title="총 사용 금액" value={wallet ? formatKRW(wallet.spentTotal) : '-'} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* topup requests */}
        <section className="rounded-lg border border-white/10">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="font-medium">충전 요청</h2>
            <div className="flex items-center gap-3 text-sm">
              <span>페이지</span>
              <input
                type="number"
                min={1}
                className="w-20 bg-transparent border border-white/10 rounded px-2 py-1"
                value={topupPage}
                onChange={(e) => setTopupPage(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)] border-b border-white/10">
                  <th className="p-3">일시</th>
                  <th className="p-3">금액</th>
                  <th className="p-3">상태</th>
                  <th className="p-3">메모</th>
                  <th className="p-3">요청자(로그인 ID)</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {(topups?.items || []).map((r) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="p-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="p-3">{formatKRW(r.amount)}</td>
                    <td className="p-3">{TOPUP_STATUS_LABELS[r.status] || r.status}</td>
                    <td className="p-3">{r.memo || '-'}</td>
                    <td className="p-3">{r.requesterEmail || '-'}</td>
                    <td className="p-3 text-right">
                      {r.status === 'PENDING' && (
                        <button
                          className="px-3 py-1 rounded border border-white/15 hover:bg-white/5"
                          onClick={() => cancelTopup(r.id)}
                        >
                          취소
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!topups?.items?.length && (
                  <tr>
                    <td className="p-6 text-center text-[var(--muted)]" colSpan={6}>데이터 없음</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* transactions */}
        <section className="rounded-lg border border-white/10">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="font-medium">거래 내역</h2>
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 rounded-md border border-white/10 hover:bg-white/5 text-sm" onClick={exportXlsx}>엑셀로 받기(XLSX)</button>
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <select
              className="bg-[#0b121b] text-white border border-white/10 rounded px-2 py-2"
              style={{ colorScheme: 'dark' }}
              value={filters.type || ''}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value || undefined, page: 1 }))}
            >
              <option value="">유형 전체</option>
              {FILTER_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            
            {/* 시작일 캘린더 팝오버 */}
            <div ref={fromPickerRef} className="relative">
              <input
                type="text"
                readOnly
                placeholder="시작일"
                className="w-full bg-transparent border border-white/10 rounded px-2 py-2 cursor-pointer"
                value={selectedFromDate ? format(selectedFromDate, 'yyyy-MM-dd', { locale: ko }) : ''}
                onClick={() => setShowFromPicker(!showFromPicker)}
              />
              {showFromPicker && (
                <div className="absolute z-10 mt-1 bg-[#0b121b] border border-white/10 rounded-lg shadow-lg p-3">
                  <DayPicker
                    mode="single"
                    selected={selectedFromDate}
                    onSelect={(date) => {
                      setSelectedFromDate(date);
                      if (date) {
                        const dateStr = format(date, 'yyyy-MM-dd');
                        if (selectedToDate && date > selectedToDate) {
                          toast.error('시작일은 종료일보다 늦을 수 없습니다');
                          return;
                        }
                        setFilters(f => ({ ...f, from: dateStr, page: 1 }));
                      } else {
                        setFilters(f => ({ ...f, from: undefined, page: 1 }));
                      }
                      setShowFromPicker(false);
                    }}
                    locale={ko}
                    modifiersClassNames={{
                      selected: 'bg-[var(--brand)] text-white',
                      today: 'text-[var(--brand)]'
                    }}
                  />
                  <button
                    className="w-full mt-2 px-3 py-1.5 text-sm border border-white/10 rounded hover:bg-white/5"
                    onClick={() => {
                      setSelectedFromDate(undefined);
                      setFilters(f => ({ ...f, from: undefined, page: 1 }));
                      setShowFromPicker(false);
                    }}
                  >
                    초기화
                  </button>
                </div>
              )}
            </div>

            {/* 종료일 캘린더 팝오버 */}
            <div ref={toPickerRef} className="relative">
              <input
                type="text"
                readOnly
                placeholder="종료일"
                className="w-full bg-transparent border border-white/10 rounded px-2 py-2 cursor-pointer"
                value={selectedToDate ? format(selectedToDate, 'yyyy-MM-dd', { locale: ko }) : ''}
                onClick={() => setShowToPicker(!showToPicker)}
              />
              {showToPicker && (
                <div className="absolute z-10 mt-1 bg-[#0b121b] border border-white/10 rounded-lg shadow-lg p-3">
                  <DayPicker
                    mode="single"
                    selected={selectedToDate}
                    onSelect={(date) => {
                      setSelectedToDate(date);
                      if (date) {
                        const dateStr = format(date, 'yyyy-MM-dd');
                        if (selectedFromDate && date < selectedFromDate) {
                          toast.error('종료일은 시작일보다 빠를 수 없습니다');
                          return;
                        }
                        setFilters(f => ({ ...f, to: dateStr, page: 1 }));
                      } else {
                        setFilters(f => ({ ...f, to: undefined, page: 1 }));
                      }
                      setShowToPicker(false);
                    }}
                    locale={ko}
                    modifiersClassNames={{
                      selected: 'bg-[var(--brand)] text-white',
                      today: 'text-[var(--brand)]'
                    }}
                  />
                  <button
                    className="w-full mt-2 px-3 py-1.5 text-sm border border-white/10 rounded hover:bg-white/5"
                    onClick={() => {
                      setSelectedToDate(undefined);
                      setFilters(f => ({ ...f, to: undefined, page: 1 }));
                      setShowToPicker(false);
                    }}
                  >
                    초기화
                  </button>
                </div>
              )}
            </div>

            <input placeholder="최소 금액" className="bg-transparent border border-white/10 rounded px-2 py-2" value={filters.min || ''} onChange={(e)=>setFilters(f=>({...f, min:e.target.value||undefined, page:1}))} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)] border-b border-white/10">
                  <th className="p-3">일시</th>
                  <th className="p-3">유형</th>
                  <th className="p-3">내역(수량)</th>
                  <th className="p-3">금액</th>
                  <th className="p-3">메모·참조</th>
                  <th className="p-3">상태</th>
                </tr>
              </thead>
              <tbody>
                {(tx?.items || []).map((r) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="p-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="p-3">{TX_TYPE_LABELS[r.type] || r.type}</td>
                    <td className="p-3">{getDetailWithUnits(r.type, r.units)}</td>
                    <td className="p-3">{formatKRW(r.amount)}</td>
                    <td className="p-3">{r.memo || '-'}</td>
                    <td className="p-3">{TX_STATUS_LABELS[r.status] || r.status}</td>
                  </tr>
                ))}
                {!tx?.items?.length && (
                  <tr>
                    <td className="p-6 text-center text-[var(--muted)]" colSpan={6}>데이터 없음</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between p-3 text-sm">
            <div className="flex items-center gap-2">
              <span>페이지</span>
              <input
                type="number"
                min={1}
                className="w-20 bg-transparent border border-white/10 rounded px-2 py-1"
                value={filters.page}
                onChange={(e) => setFilters((f) => ({ ...f, page: Math.max(1, Number(e.target.value) || 1) }))}
              />
            </div>
            <div className="text-[var(--muted)]">
              총 {tx?.total ?? 0}건
            </div>
          </div>
        </section>
      </div>

      {/* Topup modal */}
      {openTopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#0b121b] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">충전하기</h3>
              <button className="text-[var(--muted)] hover:text-[var(--text)]" onClick={()=>setOpenTopup(false)}>닫기</button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[10_000, 50_000, 100_000, 300_000, 500_000].map((v) => (
                <button key={v} className="px-2 py-2 rounded border border-white/10 hover:bg-white/5 text-sm" onClick={()=>quickSet(v)}>
                  {v.toLocaleString('ko-KR')}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-[var(--muted)]">금액(원)</label>
              <input
                inputMode="numeric"
                placeholder="예: 50,000"
                className="w-full bg-transparent border border-white/15 rounded px-3 py-2"
                value={amountInput}
                onChange={(e)=>setAmountInput(e.target.value)}
              />
              {invalidAmountMessage && (
                <p className="text-xs text-red-400">{invalidAmountMessage}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-[var(--muted)]">메모(선택)</label>
              <input
                className="w-full bg-transparent border border-white/15 rounded px-3 py-2"
                value={memo}
                onChange={(e)=>setMemo(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 rounded-md border border-white/10" onClick={()=>setOpenTopup(false)}>취소</button>
              <button
                className="px-4 py-2 rounded-md bg-[var(--brand)] text-white disabled:opacity-60"
                disabled={!!invalidAmountMessage || submitBusy || cooldown}
                onClick={createTopup}
              >
                {submitBusy ? '처리 중…' : cooldown ? '잠시 후 재시도' : '제출'}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </AppShell>
    </RouteGuard>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 p-4">
      <div className="text-sm text-[var(--muted)]">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

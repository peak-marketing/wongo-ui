'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import AdminSidebar from '@/components/nav/AdminSidebar';
import RouteGuard from '@/components/auth/RouteGuard';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

type BillingLedgerItem = {
  id: string;
  createdAt: string;
  userId: string;
  userEmail: string | null;
  businessName: string | null;
  businessRegNo: string | null;
  orderId: string | null;
  type: string;
  amount: number;
  status: string;
  units: number;
  memo: string | null;
  walletBalance: number | null;
  walletReserved: number | null;
  walletAvailable: number | null;
};

export default function AdminBillingPage() {
  const [items, setItems] = useState<BillingLedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingOnly, setPendingOnly] = useState(false);
  const [busyTxId, setBusyTxId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [pendingOnly]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getAdminBillingLedger(100, pendingOnly ? 'PENDING' : 'ALL');
      setItems((res.data?.items || []) as BillingLedgerItem[]);
    } catch (error: any) {
      toast.error(error?.message || '원장 내역을 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await apiClient.exportAdminBillingLedgerXlsx(100, pendingOnly ? 'PENDING' : 'ALL');
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billing_ledger_${pendingOnly ? 'PENDING' : 'ALL'}_100.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error(error?.message || '엑셀 다운로드 실패');
    }
  };

  const handleApprove = async (txId: string) => {
    if (!confirm('이 충전 요청을 승인하시겠습니까?')) return;
    setBusyTxId(txId);
    try {
      await apiClient.approveAdminTopupTransaction(txId);
      toast.success('승인 완료');
      load();
    } catch (error: any) {
      toast.error(error?.message || '승인 실패');
    } finally {
      setBusyTxId(null);
    }
  };

  const handleReject = async (txId: string) => {
    const reason = prompt('반려 사유를 입력하세요 (필수)')?.trim() ?? '';
    if (!reason) {
      toast.error('반려 사유가 필요합니다');
      return;
    }
    if (!confirm('이 충전 요청을 반려하시겠습니까?')) return;
    setBusyTxId(txId);
    try {
      await apiClient.rejectAdminTopupTransaction(txId, reason);
      toast.success('반려 완료');
      load();
    } catch (error: any) {
      toast.error(error?.message || '반려 실패');
    } finally {
      setBusyTxId(null);
    }
  };

  return (
    <RouteGuard requiredRole="ADMIN">
      <AppShell sidebar={<AdminSidebar />}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              대행사 충전 관리
            </h1>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
                <input
                  type="checkbox"
                  checked={pendingOnly}
                  onChange={(e) => setPendingOnly(e.target.checked)}
                />
                대기만 보기
              </label>
              <button onClick={handleDownload} className="btn-brand text-sm px-3 py-2">
                엑셀 다운로드
              </button>
              <button onClick={load} className="btn-brand text-sm px-3 py-2">
                새로고침
              </button>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
                최근 원장 내역 (최대 100건)
              </h2>
            </div>

            {loading ? (
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                로딩 중...
              </div>
            ) : items.length === 0 ? (
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                내역이 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-white/10">
                      <th className="py-2 pr-4">일시</th>
                      <th className="py-2 pr-4">사업자명</th>
                      <th className="py-2 pr-4">사업자등록번호</th>
                      <th className="py-2 pr-4">대행사</th>
                      <th className="py-2 pr-4">주문ID</th>
                      <th className="py-2 pr-4">유형</th>
                      <th className="py-2 pr-4">금액</th>
                      <th className="py-2 pr-4">상태</th>
                      <th className="py-2 pr-4">잔액(가용)</th>
                      <th className="py-2 pr-4">처리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((t) => (
                      <tr key={t.id} className="border-b border-white/5">
                        <td className="py-2 pr-4 whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                          {new Date(t.createdAt).toLocaleString('ko-KR')}
                        </td>
                        <td className="py-2 pr-4" style={{ color: 'var(--text)' }}>
                          {t.businessName || '-'}
                        </td>
                        <td className="py-2 pr-4" style={{ color: 'var(--muted)' }}>
                          {t.businessRegNo || '-'}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="font-medium" style={{ color: 'var(--text)' }}>
                            {t.userEmail || t.userId}
                          </div>
                          {t.userEmail ? (
                            <div className="text-xs" style={{ color: 'var(--muted)' }}>
                              {t.userEmail}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-2 pr-4" style={{ color: 'var(--muted)' }}>
                          {t.orderId || '-'}
                        </td>
                        <td className="py-2 pr-4" style={{ color: 'var(--text)' }}>
                          {t.type}
                        </td>
                        <td className="py-2 pr-4" style={{ color: 'var(--text)' }}>
                          {Number(t.amount).toLocaleString('ko-KR')}
                        </td>
                        <td className="py-2 pr-4" style={{ color: 'var(--muted)' }}>
                          {t.status}
                        </td>
                        <td className="py-2 pr-4" style={{ color: 'var(--muted)' }}>
                          {typeof t.walletBalance === 'number' && typeof t.walletAvailable === 'number'
                            ? `${t.walletBalance.toLocaleString('ko-KR')} (${t.walletAvailable.toLocaleString('ko-KR')})`
                            : '-'}
                        </td>
                        <td className="py-2 pr-4">
                          {t.type === 'TOPUP_REQUEST' && t.status === 'PENDING' ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApprove(t.id)}
                                disabled={busyTxId === t.id}
                                className="btn-brand text-xs px-2 py-1"
                              >
                                승인
                              </button>
                              <button
                                onClick={() => handleReject(t.id)}
                                disabled={busyTxId === t.id}
                                className="btn-brand text-xs px-2 py-1"
                              >
                                반려
                              </button>
                            </div>
                          ) : t.status === 'REJECTED' && t.memo ? (
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>
                              사유: {t.memo}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>
                              -
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </AppShell>
    </RouteGuard>
  );
}

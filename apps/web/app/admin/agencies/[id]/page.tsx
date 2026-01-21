'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import AdminSidebar from '@/components/nav/AdminSidebar';
import RouteGuard from '@/components/auth/RouteGuard';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';

type AgencyDetail = {
  id: string;
  email: string;
  role: 'ADMIN' | 'AGENCY';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  businessName: string;
  businessRegNo?: string | null;
  displayName?: string | null;
  name?: string | null;
  contactName?: string | null;
  phone?: string | null;
  companyName?: string | null;
  refundBank?: string | null;
  refundHolder?: string | null;
  refundAccount?: string | null;
  contactPosition?: string | null;
  contactPhone?: string | null;
  businessAddress1?: string | null;
  businessAddress2?: string | null;
  businessZipCode?: string | null;
  integrationMemo?: string | null;
  slackWebhookUrl?: string | null;
  notifyByEmail: boolean;
  notifyBySms: boolean;
  notifyBySlack: boolean;
  agencyId?: string | null;
  approvedAt?: string | null;
  rejectedReason?: string | null;
  createdAt: string;
  updatedAt: string;
};

function diagLog(
  step: 'AGENCY_APPROVE' | 'AGENCY_REJECT',
  result: 'SUCCESS' | 'FAIL',
  params: {
    agencyId: string;
    email: string;
    prevStatus: string;
    nextStatus: string;
    reasonLen: number;
  },
) {
  const ts = new Date().toISOString();
  const payload = `${params.agencyId}|${params.email}|${params.prevStatus}->${params.nextStatus}|${params.reasonLen}`;
  // eslint-disable-next-line no-console
  console.log(`${ts} (${step}) (${result}) (${payload})`);
}

export default function AdminAgencyDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const agencyId = params.id;

  const [agency, setAgency] = useState<AgencyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fields = useMemo(() => {
    if (!agency) return [] as Array<{ label: string; value: string }>;

    const v = (x: any) => {
      if (x === null || x === undefined || x === '') return '-';
      if (typeof x === 'boolean') return x ? 'Y' : 'N';
      return String(x);
    };

    return [
      { label: '이메일', value: v(agency.email) },
      { label: '상태', value: v(agency.status) },
      { label: '사업자명', value: v(agency.businessName) },
      { label: '사업자등록번호', value: v(agency.businessRegNo) },
      { label: '담당자명', value: v(agency.contactName) },
      { label: '연락처', value: v(agency.phone) },
      { label: '회사명', value: v(agency.companyName) },
      { label: '환불은행', value: v(agency.refundBank) },
      { label: '예금주', value: v(agency.refundHolder) },
      { label: '환불계좌', value: v(agency.refundAccount) },
      { label: '담당자 직책', value: v(agency.contactPosition) },
      { label: '담당자 추가 연락처', value: v(agency.contactPhone) },
      { label: '사업장 주소1', value: v(agency.businessAddress1) },
      { label: '사업장 주소2', value: v(agency.businessAddress2) },
      { label: '우편번호', value: v(agency.businessZipCode) },
      { label: '통합 메모', value: v(agency.integrationMemo) },
      { label: '슬랙 Webhook', value: v(agency.slackWebhookUrl) },
      { label: '이메일 알림', value: v(agency.notifyByEmail) },
      { label: 'SMS 알림', value: v(agency.notifyBySms) },
      { label: '슬랙 알림', value: v(agency.notifyBySlack) },
      { label: '내부 AgencyId', value: v(agency.agencyId) },
      { label: '승인일', value: v(agency.approvedAt) },
      { label: '반려사유', value: v(agency.rejectedReason) },
      { label: '신청일', value: v(agency.createdAt) },
      { label: '수정일', value: v(agency.updatedAt) },
    ];
  }, [agency]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.getAdminAgency(agencyId);
      setAgency(data.agency);
    } catch (error: any) {
      toast.error(error?.message || '대행사 정보를 불러올 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [agencyId]);

  const handleApprove = async () => {
    if (!agency) return;
    if (!confirm('승인하시겠습니까?')) return;

    const prevStatus = agency.status;
    const nextStatus = 'APPROVED';

    setSaving(true);
    try {
      const { data } = await apiClient.approveAdminAgency(agencyId);
      setAgency(data.agency);
      diagLog('AGENCY_APPROVE', 'SUCCESS', {
        agencyId,
        email: agency.email,
        prevStatus,
        nextStatus,
        reasonLen: 0,
      });
      toast.success('승인 완료. 이제 로그인이 가능합니다.');
      router.push('/admin/agencies/pending');
    } catch (error: any) {
      diagLog('AGENCY_APPROVE', 'FAIL', {
        agencyId,
        email: agency.email,
        prevStatus,
        nextStatus: prevStatus,
        reasonLen: 0,
      });
      toast.error(error?.message || '승인 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!agency) return;

    const reasonRaw = prompt('반려 사유를 입력하세요');
    if (reasonRaw === null) return;

    const reason = reasonRaw.trim();
    const prevStatus = agency.status;
    const nextStatus = 'REJECTED';

    if (!reason) {
      diagLog('AGENCY_REJECT', 'FAIL', {
        agencyId,
        email: agency.email,
        prevStatus,
        nextStatus: prevStatus,
        reasonLen: 0,
      });
      toast.error('반려 사유는 필수입니다');
      return;
    }

    setSaving(true);
    try {
      const { data } = await apiClient.rejectAdminAgency(agencyId, reason);
      setAgency(data.agency);
      diagLog('AGENCY_REJECT', 'SUCCESS', {
        agencyId,
        email: agency.email,
        prevStatus,
        nextStatus,
        reasonLen: reason.length,
      });
      toast.success('반려 완료');
      router.push('/admin/agencies/pending');
    } catch (error: any) {
      diagLog('AGENCY_REJECT', 'FAIL', {
        agencyId,
        email: agency.email,
        prevStatus,
        nextStatus: prevStatus,
        reasonLen: reason.length,
      });
      toast.error(error?.message || '반려 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard requiredRole="ADMIN">
      <AppShell sidebar={<AdminSidebar />}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              대행사 상세
            </h1>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.push('/admin/agencies/pending')}
                className="text-xs px-3 py-1 rounded border border-white/20 hover:bg-white/10"
                style={{ color: 'var(--text)' }}
              >
                목록으로
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-sm" style={{ color: 'var(--muted)' }}>
              로딩 중...
            </div>
          ) : !agency ? (
            <div className="card text-center" style={{ color: 'var(--muted)' }}>
              대행사를 찾을 수 없습니다
            </div>
          ) : (
            <>
              <div className="card">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fields.map((f) => (
                    <div key={f.label} className="space-y-1">
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>
                        {f.label}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--text)' }}>
                        {f.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {agency.status === 'PENDING' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-brand text-sm px-4 py-2 disabled:opacity-50"
                    disabled={saving}
                    onClick={handleApprove}
                  >
                    승인하기
                  </button>
                  <button
                    type="button"
                    className="text-sm px-4 py-2 rounded border border-white/20 hover:bg-white/10 disabled:opacity-50"
                    style={{ color: 'var(--danger)' }}
                    disabled={saving}
                    onClick={handleReject}
                  >
                    반려하기
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </AppShell>
    </RouteGuard>
  );
}

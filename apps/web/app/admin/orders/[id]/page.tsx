'use client';

import { useEffect, useState, type ComponentProps } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Order, OrderStatus } from '@/lib/types';
import { formatKRW, getStatusLabel, getStatusColor } from '@/lib/utils';
import ValidationReportComponent from '@/components/admin/ValidationReport';

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const isManualRevisionMode = searchParams.get('mode') === 'manual-revision';
  const [order, setOrder] = useState<Order | null>(null);
  const [validationReport, setValidationReport] = useState<ComponentProps<typeof ValidationReportComponent>['report']>(null);
  const [loading, setLoading] = useState(true);
  const [reviewReason, setReviewReason] = useState('');
  const [extraInstruction, setExtraInstruction] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [manualManuscript, setManualManuscript] = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const [adminMemo, setAdminMemo] = useState('');
  const [revisionMemo, setRevisionMemo] = useState('');
  const [memoSaving, setMemoSaving] = useState(false);
  const [snapshotSaving, setSnapshotSaving] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [id]);

  useEffect(() => {
    if (isManualRevisionMode && order) {
      setManualManuscript(order.manuscript || '');
    }
  }, [isManualRevisionMode, order]);

  useEffect(() => {
    if (order) {
      setAdminMemo((order as any).adminMemo || '');
      setRevisionMemo((order as any).revisionMemo || '');
    }
  }, [order]);

  const loadOrder = async () => {
    try {
      const { data } = await apiClient.getAdminOrder(id);
      // API returns { order, manuscript, validationReport }
      if (data.order) {
        setOrder(data.order);
      } else {
        // Fallback for old format
        setOrder(data);
      }
      
      if (data.validationReport) {
        setValidationReport(data.validationReport as ComponentProps<typeof ValidationReportComponent>['report']);
      } else if (data.order?.validationReport) {
        try {
          setValidationReport(JSON.parse(data.order.validationReport) as ComponentProps<typeof ValidationReportComponent>['report']);
        } catch (e) {
          console.error('Failed to parse validation report', e);
        }
      }
    } catch (error) {
      console.error('Failed to load order', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartReview = async () => {
    setSubmitting(true);
    try {
      await apiClient.startReview(id);
      await loadOrder();
    } catch (error) {
      console.error('Failed to start review', error);
      alert('검수 시작에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (decision: 'PASS' | 'FAIL' | 'REVISION') => {
    const currentUnitPrice = (order as any)?.unitPrice as number | undefined;
    if (decision === 'PASS' && (!currentUnitPrice || currentUnitPrice <= 0)) {
      const ok = confirm(
        '단가(unitPrice)가 0입니다. 대행사 기본 단가(defaultUnitPrice)가 설정되어 있으면 서버가 자동 적용합니다. 그대로 통과 처리할까요?'
      );
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      await apiClient.reviewManuscript(
        id,
        decision,
        reviewReason || undefined,
        extraInstruction || undefined
      );
      await loadOrder();
      alert(`리뷰가 완료되었습니다. ${decision === 'PASS' ? '대행사 검수로 이동합니다.' : '재생성이 시작됩니다.'}`);
    } catch (error) {
      console.error('Failed to review', error);
      alert('리뷰 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('작업을 중단/취소하시겠습니까? 예약된 크레딧이 해제됩니다.')) {
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.cancelOrder(id);
      await loadOrder();
      alert('작업이 취소되었습니다. 예약된 크레딧이 해제되었습니다.');
    } catch (error) {
      console.error('Failed to cancel', error);
      alert('취소 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSave = async () => {
    if (!order) return;
    if (!manualManuscript.trim()) {
      alert('원고 내용을 입력해주세요.');
      return;
    }
    if (!confirm('저장하면 대행사 확인 요청(AGENCY_REVIEW)으로 이동합니다. 진행할까요?')) {
      return;
    }

    setManualSaving(true);
    try {
      await apiClient.updateAdminManuscript(id, manualManuscript);
      await loadOrder();
      alert('저장되었습니다.');
    } catch (error) {
      console.error('Failed to update manuscript', error);
      alert('저장에 실패했습니다.');
    } finally {
      setManualSaving(false);
    }
  };

  const handleSaveMemo = async () => {
    if (!order) return;
    setMemoSaving(true);
    try {
      await apiClient.updateAdminOrderMemo(id, { adminMemo, revisionMemo });
      await loadOrder();
      alert('메모가 저장되었습니다.');
    } catch (error) {
      console.error('Failed to save memo', error);
      alert('메모 저장에 실패했습니다.');
    } finally {
      setMemoSaving(false);
    }
  };

  const handleSaveRevisionSnapshot = async () => {
    if (!order) return;
    if (!confirm('현재 사진/메모를 스냅샷으로 저장할까요? (이후 재사용 고정)')) {
      return;
    }
    setSnapshotSaving(true);
    try {
      await apiClient.saveRevisionSnapshot(id, { adminMemo, revisionMemo });
      await loadOrder();
      alert('스냅샷이 저장되었습니다.');
    } catch (error) {
      console.error('Failed to save revision snapshot', error);
      alert('스냅샷 저장에 실패했습니다.');
    } finally {
      setSnapshotSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8">로딩 중...</div>;
  }

  if (!order) {
    return <div className="p-8">주문을 찾을 수 없습니다.</div>;
  }

  const currentUnitPrice = (order as any)?.unitPrice as number | undefined;

  const canStartReview = order.status === OrderStatus.GENERATED;
  const canReview = order.status === OrderStatus.ADMIN_REVIEW;
  const canCancel = order.status === OrderStatus.GENERATING || 
                    order.status === OrderStatus.ADMIN_INTAKE || 
                    order.status === OrderStatus.REGEN_QUEUED ||
                    order.status === OrderStatus.ADMIN_REVIEW;

  const revisionRequestReason = order.rejectionReason?.trim() || '';
  const hasRevisionRequestReason = Boolean(revisionRequestReason);

  return (
    <div className="min-h-screen p-8" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">{order.placeName}</h1>
            <span className={`px-3 py-1 rounded ${getStatusColor(order.status)}`}>
              {getStatusLabel(order.status)}
            </span>
          </div>

          {(order as any)?.type === 'RECEIPT_REVIEW' && (
            <div className="mb-6 p-4 rounded" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="text-sm" style={{ color: 'var(--muted)' }}>
                영수증 리뷰 정보
              </div>
              <div className="mt-2 text-sm">
                <span className="font-medium">메뉴명:</span>{' '}
                {String((order as any)?.payload?.menuName || '').trim() || '—'}
              </div>
              <div className="mt-1 text-sm">
                <span className="font-medium">영수증 사진:</span>{' '}
                {String((order as any)?.payload?.photoUrl || '').trim() ? (
                  <a
                    href={String((order as any)?.payload?.photoUrl || '').trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    1장
                  </a>
                ) : (
                  '0장'
                )}
              </div>
            </div>
          )}

          {/* 취소 정보 배너 */}
          {order.status === OrderStatus.CANCELED && order.cancelReason && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
              <h3 className="font-semibold text-red-800 mb-2">취소됨</h3>
              <p className="text-red-700">{order.cancelReason}</p>
              {order.canceledAt && (
                <p className="text-sm text-red-600 mt-1">
                  취소 시각: {new Date(order.canceledAt).toLocaleString('ko-KR')}
                </p>
              )}
            </div>
          )}

          {order.status === OrderStatus.CANCEL_REQUESTED && order.cancelReason && (
            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded">
              <h3 className="font-semibold text-orange-800 mb-2">취소 요청됨 (생성 중단 대기)</h3>
              <p className="text-orange-700">{order.cancelReason}</p>
              {order.cancelRequestedAt && (
                <p className="text-sm text-orange-600 mt-1">
                  요청 시각: {new Date(order.cancelRequestedAt).toLocaleString('ko-KR')}
                </p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="text-sm mb-2" style={{ color: 'var(--muted)' }}>상태: {getStatusLabel(order.status)}</div>
              <div className="text-sm mb-2" style={{ color: 'var(--muted)' }}>플레이스: {order.placeName}</div>
              {order.placeAddress && <div className="text-sm" style={{ color: 'var(--muted)' }}>주소: {order.placeAddress}</div>}
            </div>

            {hasRevisionRequestReason && (
              <div className="rounded border border-white/10 p-4" style={{ background: 'var(--bg2)' }}>
                <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>대행사 수정요청사항</h2>
                <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
                  {revisionRequestReason}
                </p>
              </div>
            )}

            {order.guideContent && (
              <div>
                <h2 className="font-semibold mb-2">가이드 내용</h2>
                <p className="whitespace-pre-wrap" style={{ color: 'var(--text)' }}>{order.guideContent}</p>
              </div>
            )}

            {order.requiredKeywords && order.requiredKeywords.length > 0 && (
              <div>
                <h2 className="font-semibold mb-2">필수 키워드</h2>
                <div className="flex flex-wrap gap-2">
                  {order.requiredKeywords.map((keyword, idx) => (
                    <span key={idx} className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {order.emphasisKeywords && order.emphasisKeywords.length > 0 && (
              <div>
                <h2 className="font-semibold mb-2">강조 키워드</h2>
                <div className="flex flex-wrap gap-2">
                  {order.emphasisKeywords.map((keyword, idx) => (
                    <span key={idx} className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {order.personaSnapshot && (
              <div>
                <h2 className="font-semibold mb-2">페르소나 스냅샷</h2>
                <p className="text-sm" style={{ color: 'var(--text)' }}>{order.personaSnapshot}</p>
              </div>
            )}
          </div>
        </div>

        <section className="card space-y-3">
          <h2 className="text-lg font-semibold">원고 메모장</h2>
          <textarea
            value={adminMemo}
            onChange={(e) => setAdminMemo(e.target.value)}
            className="input-dark w-full h-32 p-3 rounded text-sm"
            placeholder="어드민 메모를 입력하세요"
          />
          <textarea
            value={revisionMemo}
            onChange={(e) => setRevisionMemo(e.target.value)}
            className="input-dark w-full h-24 p-3 rounded text-sm"
            placeholder="수정본 메모(선택)"
          />
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={handleSaveMemo}
              disabled={memoSaving}
              className="btn-brand disabled:opacity-60"
            >
              {memoSaving ? '저장 중…' : '메모 저장'}
            </button>
            {(order.status === OrderStatus.AGENCY_REVIEW || order.status === OrderStatus.COMPLETE) && (
              <button
                type="button"
                onClick={handleSaveRevisionSnapshot}
                disabled={snapshotSaving}
                className="btn-brand disabled:opacity-60"
              >
                {snapshotSaving ? '저장 중…' : '사진/메모 저장'}
              </button>
            )}
          </div>
          {(order as any).photoSnapshot?.length > 0 && (
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              스냅샷 사진: {(order as any).photoSnapshot.length}장 저장됨
            </div>
          )}
        </section>

        {isManualRevisionMode && (
          <section className="card space-y-3">
            <h2 className="text-lg font-semibold">수동 수정</h2>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              원고를 직접 수정한 뒤 저장하면 대행사 확인 요청(AGENCY_REVIEW)으로 전달됩니다.
            </p>
            <textarea
              value={manualManuscript}
              onChange={(e) => setManualManuscript(e.target.value)}
              className="input-dark w-full h-80 p-3 rounded text-sm font-mono"
              placeholder="원고 내용을 입력하세요"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleManualSave}
                disabled={manualSaving}
                className="btn-brand disabled:opacity-60"
              >
                {manualSaving ? '저장 중…' : '저장 후 전달'}
              </button>
            </div>
          </section>
        )}

        <section className="card space-y-3">
          <h2 className="text-lg font-semibold">원고 미리보기(어드민 전용)</h2>
          {order.manuscript ? (
            <article
              className="prose prose-invert max-w-none p-4 rounded border border-white/10"
              style={{ background: 'var(--bg2)', color: 'var(--text)' }}
              dangerouslySetInnerHTML={{ __html: order.manuscript.replace(/\n/g, '<br>') }}
            />
          ) : (
            <div className="text-sm" style={{ color: 'var(--muted)' }}>원고가 아직 생성되지 않았습니다.</div>
          )}
        </section>

        <section className="card space-y-3">
          <h2 className="text-lg font-semibold">자동 검수 리포트</h2>
          <ValidationReportComponent report={validationReport} />
        </section>

        {canStartReview && (
          <div className="card">
            <button
              onClick={handleStartReview}
              disabled={submitting}
              className="btn-brand disabled:opacity-60"
            >
              검수 시작
            </button>
          </div>
        )}

        {canCancel && !canReview && (
          <div className="card">
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={submitting}
                className="btn-outline disabled:opacity-60"
              >
                작업 중단/취소
              </button>
            </div>
          </div>
        )}

        {canReview && (
          <div className="card">
            <h2 className="font-semibold mb-4">검수</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">단가 (unitPrice)</label>
                <div className="text-sm" style={{ color: 'var(--text)' }}>
                  {typeof currentUnitPrice === 'number' && currentUnitPrice > 0
                    ? formatKRW(currentUnitPrice)
                    : '미설정 (회원관리 defaultUnitPrice 기반)'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">반려/수정 사유</label>
                <textarea
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  className="input-dark w-full p-2 rounded h-24"
                  placeholder="반려하거나 수정 요청하는 경우 사유를 입력해주세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">추가 지시사항 (재생성 시)</label>
                <textarea
                  value={extraInstruction}
                  onChange={(e) => setExtraInstruction(e.target.value)}
                  className="input-dark w-full p-2 rounded h-24"
                  placeholder="재생성 시 반영할 추가 지시사항을 입력해주세요"
                />
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => handleReview('PASS')}
                  disabled={submitting}
                  className="btn-brand disabled:opacity-60"
                >
                  통과 (대행사 검수로)
                </button>
                <button
                  onClick={() => handleReview('FAIL')}
                  disabled={submitting}
                  className="btn-brand disabled:opacity-60"
                >
                  반려 (재생성)
                </button>
                <button
                  onClick={() => handleReview('REVISION')}
                  disabled={submitting}
                  className="btn-brand disabled:opacity-60"
                >
                  수정 요청 (재생성)
                </button>
                <button
                  onClick={handleCancel}
                  disabled={submitting}
                  className="btn-outline disabled:opacity-60"
                >
                  작업 중단/취소
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <button
            onClick={() => router.push('/admin/intake')}
            className="btn-outline"
          >
            목록으로
          </button>
        </div>
      </div>
    </div>
  );
}


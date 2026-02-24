'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { Order, OrderStatus } from '@/lib/types';
import { getStatusLabel } from '@/lib/utils';

/* ─── 상태 뱃지 색상 (Toss 팔레트) ───────────────────── */
function statusBadge(status: OrderStatus) {
  const map: Partial<Record<OrderStatus, { bg: string; text: string; label: string }>> = {
    [OrderStatus.DRAFT]:              { bg: '#F2F4F6', text: '#6B7684', label: '임시 저장' },
    [OrderStatus.SUBMITTED]:          { bg: '#E8F3FF', text: '#1B64DA', label: '접수 완료' },
    [OrderStatus.ADMIN_INTAKE]:       { bg: '#E8F3FF', text: '#1B64DA', label: '접수 완료' },
    [OrderStatus.GENERATING]:         { bg: '#F3EAFF', text: '#8B5CF6', label: '원고 작성중' },
    [OrderStatus.GENERATED]:          { bg: '#E5F5E8', text: '#1A7D36', label: '원고 완료' },
    [OrderStatus.ADMIN_REVIEW]:       { bg: '#FFF4E5', text: '#D97706', label: '확인 중' },
    [OrderStatus.AGENCY_REVIEW]:      { bg: '#E5F5E8', text: '#1A7D36', label: '원고 완료' },
    [OrderStatus.COMPLETE]:           { bg: '#E5F5E8', text: '#1A7D36', label: '완료' },
    [OrderStatus.REGEN_QUEUED]:       { bg: '#E8F3FF', text: '#1B64DA', label: '수정 반영중' },
    [OrderStatus.FAILED]:             { bg: '#FFEBEB', text: '#E5484D', label: '실패' },
    [OrderStatus.CANCELED_BY_AGENCY]: { bg: '#F2F4F6', text: '#6B7684', label: '취소됨' },
  };
  return map[status] ?? { bg: '#F2F4F6', text: '#6B7684', label: getStatusLabel(status) };
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);

  useEffect(() => { loadOrder(); }, [id]);

  const loadOrder = async () => {
    try {
      const { data } = await apiClient.getOrder(id);
      setOrder(data);
    } catch { /* noop */ } finally { setLoading(false); }
  };

  /* ── 파생 값 ────────────────────────────────────────── */
  const photos = useMemo(() => order?.photos ?? [], [order]);
  const canViewManuscript = order
    ? [OrderStatus.GENERATED, OrderStatus.AGENCY_REVIEW, OrderStatus.COMPLETE].includes(order.status)
    : false;
  const canReview = order
    ? [OrderStatus.GENERATED, OrderStatus.AGENCY_REVIEW].includes(order.status)
    : false;
  const isDraft = order?.status === OrderStatus.DRAFT;
  const isProcessing = order
    ? [OrderStatus.REGEN_QUEUED, OrderStatus.GENERATING].includes(order.status)
    : false;
  const canDownload = order?.status === OrderStatus.COMPLETE;

  /* ── 액션 핸들러 ────────────────────────────────────── */
  const handleReview = async (decision: 'APPROVE' | 'REJECT') => {
    if (decision === 'REJECT' && !rejectionReason.trim()) {
      toast.error('수정 요청 사유를 입력해주세요');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.reviewOrder(id, decision, rejectionReason || undefined);
      await loadOrder();
      if (decision === 'REJECT') {
        toast.success('수정 요청 완료');
        setTimeout(() => router.push('/agency/orders'), 1200);
      } else {
        toast.success('승인되었습니다');
      }
    } catch {
      toast.error('처리에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!order) return;
    setDownloading(true);
    try {
      const res = await apiClient.downloadDeliverableZip(order.id);
      const blob = res.data as Blob;
      // 서버 Content-Disposition에서 파일명 추출 (키워드_업체명.zip)
      const cd = res.headers?.['content-disposition'] ?? '';
      const fnMatch = /filename\*?=(?:UTF-8''|"?)([^";]+)/i.exec(cd);
      const serverName = fnMatch ? decodeURIComponent(fnMatch[1].replace(/"/g, '')) : '';
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = serverName || `order_${order.id}_deliverable.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('다운로드를 시작했습니다');
    } catch {
      toast.error('다운로드에 실패했습니다');
    } finally {
      setDownloading(false);
    }
  };

  /* ── 로딩 & 에러 ────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="animate-pulse text-sm" style={{ color: 'var(--muted)' }}>불러오는 중...</div>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--muted)' }}>주문을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const badge = statusBadge(order.status);
  const manuscript = order.manuscript ?? '';
  const charCount = manuscript.length;

  /* ── 렌더 ──────────────────────────────────────────── */
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* ─ 헤더 ─ */}
      <div style={{ background: 'var(--panel)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/agency/orders')}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg)] transition-colors"
              style={{ color: 'var(--muted)' }}
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div>
              <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{order.placeName}</h1>
              {order.placeAddress && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{order.placeAddress}</p>
              )}
            </div>
          </div>
          <span
            className="px-3 py-1 text-xs font-semibold rounded-full"
            style={{ background: badge.bg, color: badge.text }}
          >
            {badge.label}
          </span>
        </div>
      </div>

      {/* ─ 진행 중 알림 ─ */}
      {isProcessing && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: '#E8F3FF' }}>
            <svg className="animate-spin" width="16" height="16" fill="none" viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="6" stroke="#3182F6" strokeWidth="2" opacity=".3"/>
              <path d="M14 8a6 6 0 00-6-6" stroke="#3182F6" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="text-sm font-medium" style={{ color: '#1B64DA' }}>원고를 작성하고 있습니다…</span>
          </div>
        </div>
      )}

      {/* ─ 메인 콘텐츠: 2컬럼 ─ */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── 왼쪽: 사진 + 주문 정보 ── */}
          <div className="space-y-4">
            {/* 사진 그리드 */}
            <div className="rounded-2xl p-5" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
              <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text)' }}>
                사진 ({photos.length}장)
              </h2>
              {photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPhoto(selectedPhoto === idx ? null : idx)}
                      className="relative aspect-square rounded-xl overflow-hidden group focus:outline-none"
                      style={{ border: selectedPhoto === idx ? '2px solid var(--brand)' : '1px solid var(--border)' }}
                    >
                      <img
                        src={url}
                        alt={`사진 ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      {/* 순번 뱃지 */}
                      <span
                        className="absolute top-1.5 left-1.5 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                      >
                        {idx + 1}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>
                  등록된 사진이 없습니다
                </p>
              )}
            </div>

            {/* 선택된 사진 확대 */}
            {selectedPhoto !== null && photos[selectedPhoto] && (
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <img
                  src={photos[selectedPhoto]}
                  alt={`사진 ${selectedPhoto + 1} 확대`}
                  className="w-full max-h-96 object-contain"
                  style={{ background: '#F2F4F6' }}
                />
              </div>
            )}

            {/* 주문 정보 */}
            <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
              <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>주문 정보</h2>

              {order.searchKeywords && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>검색 키워드</p>
                  <div className="flex flex-wrap gap-1.5">
                    {order.searchKeywords.split(/[,\n]/).map((kw, i) => kw.trim()).filter(Boolean).map((kw, i) => (
                      <span key={i} className="px-2.5 py-1 text-xs rounded-full font-medium" style={{ background: '#E8F3FF', color: '#1B64DA' }}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {order.requiredKeywords && order.requiredKeywords.length > 0 && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>필수 키워드</p>
                  <div className="flex flex-wrap gap-1.5">
                    {order.requiredKeywords.map((kw, i) => (
                      <span key={i} className="px-2.5 py-1 text-xs rounded-full font-medium" style={{ background: '#FFF4E5', color: '#D97706' }}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {order.hashtags && order.hashtags.length > 0 && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>해시태그</p>
                  <div className="flex flex-wrap gap-1.5">
                    {order.hashtags.map((tag, i) => (
                      <span key={i} className="px-2.5 py-1 text-xs rounded-full" style={{ background: '#F2F4F6', color: '#6B7684' }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                {order.hasLink && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--brand)' }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 14 14"><path d="M5.83 8.17a2.5 2.5 0 003.54 0l2-2a2.5 2.5 0 00-3.54-3.54l-.58.58" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M8.17 5.83a2.5 2.5 0 00-3.54 0l-2 2a2.5 2.5 0 003.54 3.54l.58-.58" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    링크 포함
                  </span>
                )}
                {order.hasMap && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: '#1A7D36' }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 14 14"><path d="M7 7.5a1.75 1.75 0 100-3.5 1.75 1.75 0 000 3.5z" stroke="currentColor" strokeWidth="1.2"/><path d="M7 12.25S2.625 8.75 2.625 5.688a4.375 4.375 0 018.75 0C11.375 8.75 7 12.25 7 12.25z" stroke="currentColor" strokeWidth="1.2"/></svg>
                    지도 포함
                  </span>
                )}
              </div>

              {order.notes && (
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>비고</p>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{order.notes}</p>
                </div>
              )}
            </div>

            {/* 임시저장 안내 */}
            {isDraft && (
              <div className="rounded-2xl p-4 flex items-center justify-between" style={{ background: '#FFF4E5', border: '1px solid #FFE0B2' }}>
                <span className="text-sm" style={{ color: '#D97706' }}>임시 저장된 주문입니다</span>
                <button
                  onClick={() => router.push(`/agency/orders/${id}/edit`)}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-white"
                  style={{ background: 'var(--brand)' }}
                >
                  계속 작성
                </button>
              </div>
            )}
          </div>

          {/* ── 오른쪽: 원고 미리보기 ── */}
          <div className="space-y-4">
            {canViewManuscript ? (
              <>
                {/* 원고 카드 */}
                <div className="rounded-2xl p-5" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>원고 미리보기</h2>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#F2F4F6', color: 'var(--muted)' }}>
                      {charCount.toLocaleString()}자
                    </span>
                  </div>
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap max-h-[600px] overflow-y-auto rounded-xl p-4"
                    style={{ background: 'var(--bg)', color: 'var(--text)' }}
                  >
                    {manuscript || '원고가 아직 생성되지 않았습니다.'}
                  </div>
                </div>

                {/* 리포트 요약 */}
                <div className="rounded-2xl p-5" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                  <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text)' }}>검수 리포트</h2>
                  <div className="space-y-2">
                    {(() => {
                      const hashtagCount = (order.hashtags ?? []).length;
                      const reqKws = order.requiredKeywords ?? [];
                      const charOk = charCount >= 1500 && charCount <= 2000;
                      const hashOk = hashtagCount <= 5;
                      const kwOk = reqKws.length === 0 || reqKws.every(kw => manuscript.toLowerCase().includes(kw.toLowerCase()));
                      const items = [
                        { label: '글자 수', ok: charOk, detail: `${charCount.toLocaleString()} / 1,500~2,000` },
                        { label: '해시태그', ok: hashOk, detail: `${hashtagCount}개 / 최대 5개` },
                        { label: '필수 키워드', ok: kwOk, detail: kwOk ? '모두 포함' : `미포함: ${reqKws.filter(k => !manuscript.toLowerCase().includes(k.toLowerCase())).join(', ')}` },
                      ];
                      return items.map(({ label, ok, detail }) => (
                        <div key={label} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'var(--bg)' }}>
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold text-white ${ok ? 'bg-green-500' : 'bg-red-400'}`}>
                              {ok ? '✓' : '✗'}
                            </span>
                            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</span>
                          </div>
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>{detail}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* 다운로드 */}
                {canDownload && (
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                    style={{ background: 'var(--brand)' }}
                  >
                    {downloading ? '다운로드 준비 중…' : '완료본 다운로드 (이미지+원고)'}
                  </button>
                )}

                {/* 승인/수정요청 */}
                {canReview && (
                  <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--muted)' }}>
                        수정 요청 사유 (수정 요청 시 필수)
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="w-full p-3 rounded-xl text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                        style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                        placeholder="수정이 필요한 부분을 알려주세요"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleReview('REJECT')}
                        disabled={submitting || (order.revisionCount ?? 0) >= 1}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
                        style={{ background: 'var(--bg)', color: 'var(--danger)', border: '1px solid var(--border)' }}
                      >
                        {(order.revisionCount ?? 0) >= 1 ? '수정요청 완료' : '수정 요청'}
                      </button>
                      <button
                        onClick={() => handleReview('APPROVE')}
                        disabled={submitting}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                        style={{ background: 'var(--brand)' }}
                      >
                        {submitting ? '처리 중…' : '승인 (주문 완료)'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* 원고 미확인 상태 */
              <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
                <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: '#F2F4F6' }}>
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h4m2-12H9a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V6a2 2 0 00-2-2z" stroke="#B0B8C1" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>원고가 아직 준비되지 않았습니다</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {isProcessing ? '원고를 작성하고 있습니다. 잠시만 기다려주세요.' : '접수 후 원고가 작성되면 이곳에서 확인할 수 있습니다.'}
                </p>
              </div>
            )}

            {/* 반려 사유 */}
            {order.rejectionReason && (
              <div className="rounded-2xl p-4" style={{ background: '#FFEBEB', border: '1px solid #FFC1C1' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: '#E5484D' }}>이전 수정 요청 사유</p>
                <p className="text-sm" style={{ color: '#C13535' }}>{order.rejectionReason}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



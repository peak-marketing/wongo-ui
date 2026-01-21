'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { Order, OrderStatus } from '@/lib/types';
import { getStatusLabel, getStatusColor } from '@/lib/utils';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    try {
      const { data } = await apiClient.getOrder(id);
      setOrder(data);
    } catch (error) {
      console.error('Failed to load order', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (decision: 'APPROVE' | 'REJECT') => {
    if (decision === 'REJECT' && !rejectionReason.trim()) {
      alert('반려 사유를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.reviewOrder(id, decision, rejectionReason || undefined);
      await loadOrder();
      if (decision === 'REJECT') {
        toast.success('재생성 진행 중');
        // 리스트 페이지로 리다이렉트 (작성 중 버킷으로 이동했으므로)
        setTimeout(() => {
          router.push('/agency/orders');
        }, 1500);
      } else {
        toast.success('승인되었습니다');
      }
    } catch (error) {
      console.error('Failed to review', error);
      toast.error('리뷰 처리에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  

  if (loading) {
    return <div className="p-8">로딩 중...</div>;
  }

  if (!order) {
    return <div className="p-8">주문을 찾을 수 없습니다.</div>;
  }

  const canViewManuscript = order.status === OrderStatus.AGENCY_REVIEW || order.status === OrderStatus.COMPLETE;
  const canReview = order.status === OrderStatus.AGENCY_REVIEW;
  const isDraft = order.status === OrderStatus.DRAFT;
  const canDownloadDeliverableZip = order.status === OrderStatus.COMPLETE;

  const handleDownloadDeliverableZip = async () => {
    if (!order) return;
    setDownloading(true);
    try {
      const res = await apiClient.downloadDeliverableZip(order.id);
      const blob = res.data as Blob;
      const fileName = `order_${order.id}_deliverable.zip`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('다운로드를 시작했습니다');
    } catch (error) {
      console.error('Failed to download zip', error);
      toast.error('다운로드에 실패했습니다');
    } finally {
      setDownloading(false);
    }
  };
  

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">{order.placeName}</h1>
          <span className={`px-3 py-1 rounded ${getStatusColor(order.status)}`}>
            {getStatusLabel(order.status)}
          </span>
        </div>

        

        {order.status === OrderStatus.REGEN_QUEUED || order.status === OrderStatus.GENERATING || 
         order.status === OrderStatus.GENERATED || order.status === OrderStatus.ADMIN_REVIEW ? (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-blue-800">자동 재생성 중(어드민 검수 대기)</p>
          </div>
        ) : null}

        <div className="space-y-4 mb-6">
          <div>
            <h2 className="font-semibold mb-2">플레이스 정보</h2>
            <p className="text-gray-700">{order.placeName}</p>
            {order.placeAddress && <p className="text-gray-600">{order.placeAddress}</p>}
          </div>

          {order.searchKeywords && (
            <div>
              <h2 className="font-semibold mb-2">검색 키워드</h2>
              <p className="text-gray-700">{order.searchKeywords}</p>
            </div>
          )}

          {canViewManuscript ? (
            <div>
              <h2 className="font-semibold mb-2">원고</h2>
              <div className="p-4 bg-gray-50 rounded whitespace-pre-wrap">
                {order.manuscript || '원고가 없습니다.'}
              </div>

              {canDownloadDeliverableZip && (
                <div className="mt-3">
                  <button
                    onClick={handleDownloadDeliverableZip}
                    disabled={downloading}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
                  >
                    {downloading ? '다운로드 준비 중…' : '완료본(이미지+원고) 다운로드'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-gray-100 rounded">
              <p className="text-gray-500">원고는 어드민 검수 완료 후 확인할 수 있습니다.</p>
            </div>
          )}

          {order.rejectionReason && (
            <div>
              <h2 className="font-semibold mb-2">반려 사유</h2>
              <p className="text-red-600">{order.rejectionReason}</p>
            </div>
          )}
        </div>

        {canReview && (
          <div className="border-t pt-6">
            <h2 className="font-semibold mb-4">리뷰</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">반려 사유 (반려 시 필수)</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-2 border rounded h-24"
                  placeholder="반려하실 경우 사유를 입력해주세요"
                />
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => handleReview('APPROVE')}
                  disabled={submitting}
                  className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
                >
                  통과 (주문완료)
                </button>
                <button
                  onClick={() => handleReview('REJECT')}
                  disabled={submitting}
                  className="px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300"
                >
                  반려
                </button>
              </div>
            </div>
          </div>
        )}

        {isDraft && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800 mb-3">임시 저장된 주문입니다. 계속 작성하거나 접수할 수 있습니다.</p>
            <button
              onClick={() => router.push(`/agency/orders/${id}/edit`)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              계속 작성
            </button>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={() => router.push('/agency/orders')}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            목록으로
          </button>
        </div>

        
      </div>

      
    </div>
  );
}



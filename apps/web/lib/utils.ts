import { OrderStatus } from './types';

export function getStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    [OrderStatus.DRAFT]: '임시 저장',
    [OrderStatus.SUBMITTED]: '접수 완료',
    [OrderStatus.ADMIN_INTAKE]: '접수 완료',
    [OrderStatus.GENERATING]: '작가 작성중',
    [OrderStatus.GENERATED]: '원고 작성 완료(확인 필요)',
    [OrderStatus.ADMIN_REVIEW]: '확인 진행중',
    [OrderStatus.AGENCY_REVIEW]: '대행사 확인 필요',
    [OrderStatus.COMPLETE]: '완료',
    [OrderStatus.AGENCY_REJECTED]: '반려됨',
    [OrderStatus.ADMIN_REJECTED]: '반려됨',
    [OrderStatus.REVISION_REQUESTED]: '수정 요청',
    [OrderStatus.REGEN_QUEUED]: '수정 반영중(1차)',
    [OrderStatus.FAILED]: '작성 실패(재시도 예정)',
    [OrderStatus.CANCELED]: '취소됨',
    [OrderStatus.CANCEL_REQUESTED]: '취소 요청됨',
    [OrderStatus.CANCELED_BY_AGENCY]: '대행사 취소',
  };
  return labels[status] || status;
}

export function getStatusColor(status: OrderStatus): string {
  const colors: Record<OrderStatus, string> = {
    [OrderStatus.DRAFT]: 'bg-gray-100 text-gray-800',
    [OrderStatus.SUBMITTED]: 'bg-blue-100 text-blue-800',
    [OrderStatus.ADMIN_INTAKE]: 'bg-yellow-100 text-yellow-800',
    [OrderStatus.GENERATING]: 'bg-purple-100 text-purple-800',
    [OrderStatus.GENERATED]: 'bg-indigo-100 text-indigo-800',
    [OrderStatus.ADMIN_REVIEW]: 'bg-orange-100 text-orange-800',
    [OrderStatus.AGENCY_REVIEW]: 'bg-green-100 text-green-800',
    [OrderStatus.COMPLETE]: 'bg-green-500 text-white',
    [OrderStatus.AGENCY_REJECTED]: 'bg-red-100 text-red-800',
    [OrderStatus.ADMIN_REJECTED]: 'bg-red-100 text-red-800',
    [OrderStatus.REVISION_REQUESTED]: 'bg-yellow-100 text-yellow-800',
    [OrderStatus.REGEN_QUEUED]: 'bg-blue-100 text-blue-800',
    [OrderStatus.FAILED]: 'bg-red-100 text-red-800',
    [OrderStatus.CANCELED]: 'bg-gray-500 text-white',
    [OrderStatus.CANCEL_REQUESTED]: 'bg-orange-100 text-orange-800',
    [OrderStatus.CANCELED_BY_AGENCY]: 'bg-gray-700 text-white',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

// 통화 포맷터: KRW 정수, 천단위, 음수는 U+2212(−) 사용
export function formatKRW(amount: number): string {
  const sign = amount < 0 ? '−' : '';
  const abs = Math.abs(Math.trunc(amount));
  return `${sign}${abs.toLocaleString('ko-KR')}원`;
}

// 안전한 정수 파싱(천단위 콤마 제거)
export function parseKRWInput(input: string): number | null {
  const normalized = (input || '').replace(/[,\s]/g, '');
  if (!/^[-]?\d+$/.test(normalized)) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}






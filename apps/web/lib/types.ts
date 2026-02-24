export enum OrderStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  ADMIN_INTAKE = 'ADMIN_INTAKE',
  GENERATING = 'GENERATING',
  GENERATED = 'GENERATED',
  ADMIN_REVIEW = 'ADMIN_REVIEW',
  AGENCY_REVIEW = 'AGENCY_REVIEW',
  COMPLETE = 'COMPLETE',
  AGENCY_REJECTED = 'AGENCY_REJECTED',
  ADMIN_REJECTED = 'ADMIN_REJECTED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  REGEN_QUEUED = 'REGEN_QUEUED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
  CANCEL_REQUESTED = 'CANCEL_REQUESTED',
  CANCELED_BY_AGENCY = 'CANCELED_BY_AGENCY',
}

export type OrderType = 'MANUSCRIPT' | 'RECEIPT_REVIEW';

export interface Order {
  id: string;
  type?: OrderType;
  payload?: Record<string, any>;
  status: OrderStatus;
  geminiStatusKo?: '호출대기중' | '생성중' | '재시도중' | '완료' | '실패';
  agencyId: string;
  agency?: {
    id: string;
    businessName?: string;
    displayName?: string;
    name?: string;
  };
  placeName: string;
  placeAddress?: string;
  placeUrl?: string;
  searchKeywords?: string;
  guideContent?: string;
  requiredKeywords?: string[];
  emphasisKeywords?: string[];
  hasLink: boolean;
  hasMap: boolean;
  hashtags?: string[];
  referenceReviews?: string;
  notes?: string;
  photos?: string[];
  personaSnapshot?: string;
  personaId?: string;
  manuscript?: string;
  validationReport?: string;
  lastFailureReason?: string;
  rejectionReason?: string;
  extraInstruction?: string;
  approveCount?: number;
  rejectCount?: number;
  revisionCount?: number;
  // 메모/스냅샷
  adminMemo?: string;
  revisionMemo?: string;
  photoSnapshot?: Array<{ id: string; url: string }>;

  completedAt?: string;
  cancelReason?: string;
  canceledAt?: string;
  cancelRequestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Admin 컴포넌트에서 기대하는 리포트 형태와 일치하도록 타입 정리
export interface ValidationReportData {
  charCountValid: boolean;
  charCount?: number;
  hashtagCountValid: boolean;
  hashtags?: string[];
  missingKeywords?: string[];
  flagsReport: {
    link: { required: boolean; found: boolean };
    map: { required: boolean; found: boolean };
    hashtag: { required: boolean; found: boolean };
  };
}

// ValidationReport.tsx에서 사용하는 상세 검수 리포트 형태
export interface ValidationReport {
  overall: boolean;
  characterCount: {
    valid: boolean;
    value: number;
    min: number;
    max: number;
  };
  hashtags: {
    valid: boolean;
    count: number;
    max: number;
  };
  requiredKeywords: {
    valid: boolean;
    found: string[];
    missing: string[];
  };
  emphasisKeywords: {
    valid: boolean;
    found: string[];
    missing: string[];
  };
  hasLink: {
    valid: boolean;
    expected: boolean;
    found: boolean;
  };
  hasMap: {
    valid: boolean;
    expected: boolean;
    found: boolean;
  };
}

// ===== Billing types (v3.1) =====
export type WalletSummary = {
  balance: number; // 원 단위 정수
  reserved: number;
  available: number;
  spentTotal: number;
};

export type TopupStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED' | 'EXPIRED';

export interface TopupRequestItem {
  id: string;
  amount: number;
  status: TopupStatus;
  memo?: string;
  createdAt: string;
  requesterEmail: string;
}

export type TransactionType =
  | 'TOPUP_REQUEST'
  | 'TOPUP_APPROVED'
  | 'RESERVE'
  | 'CAPTURE'
  | 'RELEASE'
  | 'ADJUST'
  | 'REFUND';

export interface TransactionItem {
  id: string;
  type: TransactionType;
  amount: number; // + 충전, - 사용
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  memo?: string;
  orderId?: string;
  topupRequestId?: string;
  units: number;
  createdAt: string;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AgencyProfile {
  email: string;
  contactName: string;
  phone: string;
  companyName: string;
  businessRegNo: string;
  refundBank: string | null;
  refundHolder: string | null;
  refundAccount: string | null;
  updatedAt: string;
}



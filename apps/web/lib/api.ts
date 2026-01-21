import axios from 'axios';

export function getApiBaseUrl(): string {
  const rawBase = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  // Windows에서 localhost가 ipv4(127.0.0.1)로 먼저 붙는 경우가 있는데,
  // 현재 환경에서 127.0.0.1:3001이 다른 프로세스에 점유되어 요청이 "대기 중"으로 멈출 수 있음.
  // API가 IPv6(::)로도 리슨 중이면 [::1]로 우회해서 안정적으로 호출.
  return rawBase.replace(/^http:\/\/localhost:3001\b/, 'http://[::1]:3001');
}

const baseURL = getApiBaseUrl();

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

// Order creation payload type
export type OrderCreatePayload = {
  place: { name: string; address?: string; mapLink?: string };
  guide: {
    searchKeywords: string[]; // 검색키워드
    includeText?: string; // 원고에 들어갈 내용
    requiredKeywords?: string[]; // 필수 키워드
    emphasizeKeywords?: string[]; // 강조 키워드
    link?: boolean;
    map?: boolean;
    hashtag?: boolean;
    hashtags?: string[]; // 최대 5개
  };
  referenceText?: string; // 참고 리뷰
  notes?: string; // 비고
  targetChars?: [number, number]; // 기본 [1500,2000]
  photoLimits?: [number, number]; // 기본 [15,20]
  photos?: string[]; // 사진 URL 배열
  photoMetas?: Array<{ url: string; width?: number; height?: number; sizeKb: number }>; // 사진 메타데이터
  saveAsDraft?: boolean; // 임시 저장 여부
  submitCount?: number; // 접수 수량 (기본 1)
};

export type ReceiptReviewCreatePayload = {
  placeName: string;
  mode: 'FIXED' | 'RANDOM';
  fixedChars?: number;
  menuName?: string;
  photoUrl?: string;
  requiredKeywords?: string[];
  qualityMode?: boolean;
  emoji?: boolean;
  outputCount?: 1 | 5 | 10;
  extraInstruction: string;
  notes?: string;
  saveAsDraft?: boolean;
};

export async function uploadPhotos(files: File[]): Promise<string[]> {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('로그인이 필요합니다');
  }
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  const base = getApiBaseUrl();
  const form = new FormData();
  for (const f of files) {
    form.append('files', f);
  }

  const res = await fetch(`${base}/uploads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMessage = data?.message || `업로드 실패 (${res.status})`;
    throw new Error(errorMessage);
  }
  const urls = Array.isArray(data?.urls) ? data.urls : [];
  return urls.map((u: any) => String(u || '').trim()).filter((u: string) => u.length > 0);
}

export async function createReceiptReviewOrder(payload: ReceiptReviewCreatePayload) {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('로그인이 필요합니다');
  }

  const base = getApiBaseUrl();
  const res = await fetch(`${base}/orders/receipt-review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMessage = data?.message || `주문 생성 실패 (${res.status})`;
    throw new Error(errorMessage);
  }
  return data;
}

export async function createOrder(payload: OrderCreatePayload) {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('로그인이 필요합니다');
  }

  const base = getApiBaseUrl();

  console.log('=== createOrder API 호출 ===', {
    url: `${base}/orders`,
    token: token.substring(0, 20) + '...',
    payload: {
      place: payload.place,
      guide: payload.guide,
      photoCount: payload.photos?.length || 0,
      photoMetasCount: payload.photoMetas?.length || 0,
      saveAsDraft: payload.saveAsDraft,
      submitCount: payload.submitCount,
    },
  });

  const res = await fetch(`${base}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  
  const data = await res.json().catch(() => ({}));
  
  console.log('=== createOrder API 응답 ===', {
    status: res.status,
    ok: res.ok,
    data,
  });
  
  if (!res.ok) {
    const errorMessage = data?.message || `주문 생성 실패 (${res.status})`;
    throw new Error(errorMessage);
  }
  return data;
}

export async function updateOrder(orderId: string, payload: OrderCreatePayload) {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('로그인이 필요합니다');
  }

  const base = getApiBaseUrl();

  console.log('=== updateOrder API 호출 ===', {
    url: `${base}/agency/orders/${orderId}`,
    orderId,
    token: token.substring(0, 20) + '...',
    payload: {
      place: payload.place,
      guide: payload.guide,
      photoCount: payload.photos?.length || 0,
      saveAsDraft: payload.saveAsDraft,
    },
  });

  const res = await fetch(`${base}/agency/orders/${orderId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  
  const data = await res.json().catch(() => ({}));
  
  console.log('=== updateOrder API 응답 ===', {
    status: res.status,
    ok: res.ok,
    data,
  });
  
  if (!res.ok) {
    const errorMessage = data?.message || `주문 업데이트 실패 (${res.status})`;
    throw new Error(errorMessage);
  }
  return data;
}

// axios 기반 API 호출도 fetch 스타일로 에러 처리 통일
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || '요청 실패';
    const err: any = new Error(message);
    err.status = error.response?.status;
    err.data = error.response?.data;
    return Promise.reject(err);
  },
);

export const apiClient = {
  // Auth
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
        // Agency
        getStats: () => api.get('/agency/stats'),
        getAgencyMeProfile: () => api.get('/agency/me/profile'),
        updateAgencyMeProfile: (data: any) => api.put('/agency/me/profile', data),
        getOrderTemplates: (placeName?: string) =>
          api.get('/agency/order-templates', { params: placeName ? { place: placeName } : {} }),
        saveOrderTemplate: (placeName: string, templateData: Record<string, unknown>) =>
          api.post('/agency/order-templates', { placeName, snapshot: templateData }),
        createOrder: (data: any) => api.post('/agency/orders', data),
        getOrders: (params?: { status?: string; q?: string; page?: number; sort?: string; completedDate?: string }) =>
          api.get('/agency/orders', { params }),
        getOrder: (id: string, include?: string) =>
          api.get(`/agency/orders/${id}`, { params: include ? { include } : {} }),
        getOrderAssets: (id: string) => api.get(`/orders/${id}/assets`),
        downloadDeliverableZip: (id: string) => api.get(`/agency/orders/${id}/download-zip`, { responseType: 'blob' }),
        submitOrder: (id: string) => api.post(`/agency/orders/${id}/submit`),
        reviewOrder: (id: string, decision: string, reason?: string, idempotencyKey?: string) =>
          api.post(
            `/agency/orders/${id}/review`,
            { decision, reason },
            idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
          ),
  
  // Admin
  getAdminOrders: (status?: string) =>
    api.get('/admin/orders', { params: status ? { status } : {} }),
  getAdminOrder: (id: string) => api.get(`/admin/orders/${id}`),
  listAdminAgencies: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/admin/agencies', { params }),
  getAdminAgency: (id: string) => api.get(`/admin/agencies/${id}`),
  approveAdminAgency: (id: string) => api.patch(`/admin/agencies/${id}/approve`),
  rejectAdminAgency: (id: string, reason: string) => api.patch(`/admin/agencies/${id}/reject`, { reason }),
  assignPersona: (id: string, personaId: string, personaSnapshot?: string) =>
    api.post(`/admin/orders/${id}/assign-persona`, { personaId, personaSnapshot }),
  generateManuscript: (id: string, extraInstruction?: string, qualityMode?: boolean) =>
    api.post(`/admin/orders/${id}/generate`, { extraInstruction, qualityMode }),
  reviewManuscript: (id: string, decision: string, reason?: string, extraInstruction?: string) =>
    api.post(`/admin/orders/${id}/review`, { decision, reason, extraInstruction }),
  startReview: (id: string) => api.post(`/admin/orders/${id}/start-review`),
  cancelOrder: (id: string, reason?: string, idempotencyKey?: string) => {
    if (typeof reason === 'string') {
      return api.post(
        `/agency/orders/${id}/cancel`,
        { reason },
        idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
      );
    }
    return api.post(`/admin/orders/${id}/cancel`);
  },
  adminCancelOrder: (id: string, reason?: string) => api.post(`/admin/orders/${id}/cancel`, reason ? { reason } : undefined),
  adminForceFailOrder: (id: string, reason?: string) =>
    api.post(`/admin/orders/${id}/force-fail`, reason ? { reason } : undefined),
  adminDeleteOrder: (id: string) => api.delete(`/admin/orders/${id}`),
  updateAdminManuscript: (id: string, manuscript: string) => api.patch(`/admin/orders/${id}/manuscript`, { manuscript }),
  updateAdminOrderMemo: (id: string, body: { adminMemo?: string; revisionMemo?: string }) => api.patch(`/admin/orders/${id}/memo`, body),
  saveRevisionSnapshot: (id: string, body: { adminMemo?: string; revisionMemo?: string }) => api.post(`/admin/orders/${id}/revision-snapshot`, body),
  getAdminBillingLedger: (limit?: number, status?: 'PENDING' | 'ALL') =>
    api.get('/admin/billing/ledger', { params: { limit, status } }),
  exportAdminBillingLedgerXlsx: (limit?: number, status?: 'PENDING' | 'ALL') =>
    api.get('/admin/billing/ledger/export', { params: { limit, status }, responseType: 'blob' }),
  approveAdminTopupTransaction: (id: string) => api.patch(`/admin/billing/transactions/${id}/approve`),
  rejectAdminTopupTransaction: (id: string, reason?: string) => api.patch(`/admin/billing/transactions/${id}/reject`, reason ? { reason } : undefined),
  getAdminSettlementKpi: (ymd?: string) => api.get('/admin/settlements/kpi', { params: ymd ? { ymd } : {} }),
  getAdminSettlementAgencies: (q?: string) => api.get('/admin/settlements/agencies', { params: q ? { q } : {} }),
  getAdminSettlementByAgency: (params: { userId: string; range?: string }) => api.get('/admin/settlements/by-agency', { params }),
  getHealth: () => api.get('/health'),
  
  // Billing (Agency-scoped v3.1)
  getWallet: () => api.get('/agency/wallet'),
  listTopups: (params?: { status?: string; page?: number }) =>
    api.get('/agency/topups', { params }),
  createTopup: (amount: number, memo?: string, idempotencyKey?: string) =>
    api.post(
      '/agency/topups',
      { amount, memo },
      idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
    ),
  cancelTopup: (id: string) => api.post(`/agency/topups/${id}/cancel`),
  listTransactions: (params: { type?: string; from?: string; to?: string; min?: string; max?: string; page?: number; pageSize?: number }) =>
    api.get('/agency/transactions', { params }),
  exportTransactions: (params: { type?: string; from?: string; to?: string; min?: string; max?: string }) =>
    api.get('/agency/transactions/export.xlsx', { params, responseType: 'blob' }),
  exportTransactionsXlsx: (params: { type?: string; from?: string; to?: string; min?: string; max?: string; page?: number; pageSize?: number }) =>
    api.get('/agency/transactions/export.xlsx', { params, responseType: 'blob' }),
};


'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import AppShell from '@/components/layout/AppShell';
import AgencySidebar from '@/components/nav/AgencySidebar';
import RouteGuard from '@/components/auth/RouteGuard';
import {
	createOrder,
	createReceiptReviewOrder,
	updateOrder,
	apiClient,
	type OrderCreatePayload,
	type ReceiptReviewCreatePayload,
} from '@/lib/api';
import PhotoUploader, { PhotoUploadItem } from '@/components/upload/PhotoUploader';
import { Order } from '@/lib/types';

type TemplateSnapshot = {
	address: string;
	placeUrl?: string;
	searchKeywords: string[];
	includeText: string;
	requiredKeywords: string[];
	emphasizeKeywords: string[];
	link: boolean;
	map: boolean;
	hashtag: boolean;
	hashtags: string[];
	referenceText: string;
	notes: string;
};

interface OrderTemplateSummary {
	id: string;
	createdAt: string;
	templateData?: Partial<TemplateSnapshot>;
}

const TEMPLATE_FETCH_DELAY = 400;

function NewOrderPageInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const draftIdParam = searchParams.get('draftId');

	const [loading, setLoading] = useState(false);
	const [initializing, setInitializing] = useState(false);
	const [photos, setPhotos] = useState<PhotoUploadItem[]>([]);
	const [receiptPhotos, setReceiptPhotos] = useState<PhotoUploadItem[]>([]);
	const [formData, setFormData] = useState({
		placeName: '',
		address: '',
		placeUrl: '',
		searchKeywords: [] as string[],
		includeText: '',
		requiredKeywords: [] as string[],
		emphasizeKeywords: [] as string[],
		flags: {
			link: false,
			map: false,
			hashtag: true,
		},
		hashtags: [] as string[],
		referenceText: '',
		notes: '',
	});
	const [requiredKeywordInput, setRequiredKeywordInput] = useState('');
	const [emphasisKeywordInput, setEmphasisKeywordInput] = useState('');
	const [hashtagInput, setHashtagInput] = useState('');
	const [submitCount, setSubmitCount] = useState(1);
	const [orderType, setOrderType] = useState<'MANUSCRIPT' | 'RECEIPT_REVIEW'>('MANUSCRIPT');
	const [receiptMode, setReceiptMode] = useState<'FIXED' | 'RANDOM'>('RANDOM');
	const [receiptFixedChars, setReceiptFixedChars] = useState(80);

	const [receiptEmoji, setReceiptEmoji] = useState(false);
	const [receiptOutputCount, setReceiptOutputCount] = useState<1 | 5 | 10>(1);
	const [receiptMenuName, setReceiptMenuName] = useState('');
	const [receiptExtraInstruction, setReceiptExtraInstruction] = useState('');
	const [latestTemplate, setLatestTemplate] = useState<OrderTemplateSummary | null>(null);
	const [templatesLoading, setTemplatesLoading] = useState(false);
	const [templatesError, setTemplatesError] = useState<string | null>(null);
	const [templateAppliedId, setTemplateAppliedId] = useState<string | null>(null);
	const [savingTemplate, setSavingTemplate] = useState(false);
	const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

	const isEditing = useMemo(() => Boolean(editingOrderId), [editingOrderId]);
	const trimmedPlaceName = formData.placeName.trim();
	const uploadStats = useMemo(() => {
		const uploaded = photos.filter((photo) => photo.status === 'uploaded');
		const failedCount = photos.filter((photo) => photo.status === 'failed').length;
		const inFlightCount = photos.filter(
			(photo) => photo.status === 'queued' || photo.status === 'uploading',
		).length;
		const metaMissingCount = uploaded.filter(
			(photo) => !photo.url || !photo.width || !photo.height || !photo.sizeKb,
		).length;
		return {
			total: photos.length,
			uploaded,
			uploadedCount: uploaded.length,
			failedCount,
			inFlightCount,
			metaMissingCount,
		};
	}, [photos]);

	const receiptUploadStats = useMemo(() => {
		const uploaded = receiptPhotos.filter((photo) => photo.status === 'uploaded');
		const failedCount = receiptPhotos.filter((photo) => photo.status === 'failed').length;
		const inFlightCount = receiptPhotos.filter(
			(photo) => photo.status === 'queued' || photo.status === 'uploading',
		).length;
		return {
			total: receiptPhotos.length,
			uploaded,
			uploadedCount: uploaded.length,
			failedCount,
			inFlightCount,
		};
	}, [receiptPhotos]);

	const notifySuccess = (message: string) => toast.success(message, { position: 'top-center' });
	const notifyError = (message: string) => toast.error(message, { position: 'top-center' });

	useEffect(() => {
		if (!draftIdParam) {
			setEditingOrderId(null);
			return;
		}

		let cancelled = false;

		const fetchDraft = async () => {
			setInitializing(true);
			try {
				const { data } = await apiClient.getOrder(draftIdParam);
				if (!data) {
					throw new Error('Draft order not found');
				}

				const order = data as Order;

				if (!cancelled) {
					setEditingOrderId(order.id);
					setFormData((prev) => ({
						...prev,
						placeName: order.placeName ?? '',
						address: order.placeAddress ?? '',
						placeUrl: (order as any).placeUrl ?? '',
						searchKeywords: order.searchKeywords
							? order.searchKeywords
									.split(',')
									.map((keyword) => keyword.trim())
									.filter((keyword) => keyword.length > 0)
							: [],
						includeText: order.guideContent ?? '',
						requiredKeywords: order.requiredKeywords ?? [],
						emphasizeKeywords: order.emphasisKeywords ?? [],
						flags: {
							...prev.flags,
							link: Boolean(order.hasLink),
							map: Boolean(order.hasMap),
						},
						hashtags: order.hashtags ?? [],
						referenceText: order.referenceReviews ?? '',
						notes: order.notes ?? '',
					}));
					setSubmitCount(1);
					setTemplateAppliedId(null);
				}

				try {
					const assetsRes = await apiClient.getOrderAssets(draftIdParam);
					const assets = assetsRes.data || [];
					if (!cancelled) {
						const mapped: PhotoUploadItem[] = assets.map((asset: any, index: number) => ({
							id: asset.id || `asset_${index}_${Date.now()}`,
							preview: asset.url,
							url: asset.url,
							width: typeof asset.width === 'number' && asset.width > 0 ? asset.width : undefined,
							height: typeof asset.height === 'number' && asset.height > 0 ? asset.height : undefined,
							sizeKb: Math.max(1, Math.round(Number(asset.sizeKb) || 0)),
							status: 'uploaded',
							progress: 100,
						}));
						setPhotos(mapped);
					}
				} catch (assetError) {
					console.error('Failed to load order assets', assetError);
					if (!cancelled) {
						setPhotos([]);
					}
				}
			} catch (error) {
				console.error('Failed to load draft order', error);
				if (!cancelled) {
					notifyError('임시 저장 주문을 불러오지 못했습니다');
					setEditingOrderId(null);
					router.push('/agency/orders');
				}
			} finally {
				if (!cancelled) {
					setInitializing(false);
				}
			}
		};

		fetchDraft();

		return () => {
			cancelled = true;
		};
	}, [draftIdParam, router]);

	const addKeyword = (type: 'required' | 'emphasis') => {
		const value = type === 'required' ? requiredKeywordInput : emphasisKeywordInput;
		const trimmed = value.trim();
		if (!trimmed) {
			return;
		}

		if (type === 'required') {
			setFormData((prev) => ({
				...prev,
				requiredKeywords: [...prev.requiredKeywords, trimmed],
			}));
			setRequiredKeywordInput('');
		} else {
			setFormData((prev) => ({
				...prev,
				emphasizeKeywords: [...prev.emphasizeKeywords, trimmed],
			}));
			setEmphasisKeywordInput('');
		}
	};

	const addHashtag = () => {
		const trimmed = hashtagInput.trim().replace(/^#/, '');
		if (!trimmed) {
			return;
		}

		setFormData((prev) => {
			if (prev.hashtags.length >= 5) {
				return prev;
			}
			return {
				...prev,
				hashtags: [...prev.hashtags, trimmed],
			};
		});
		setHashtagInput('');
	};

	useEffect(() => {
		// 2자 미만이거나 비어있으면 템플릿 숨김
		if (!trimmedPlaceName || trimmedPlaceName.length < 2) {
			setLatestTemplate(null);
			setTemplatesError(null);
			setTemplatesLoading(false);
			return;
		}

		let cancelled = false;
		setTemplatesLoading(true);
		setTemplatesError(null);

		const timer = setTimeout(async () => {
			try {
				const response = await apiClient.getOrderTemplates(trimmedPlaceName);
				if (cancelled) {
					return;
				}
				if (!response) {
					setLatestTemplate(null);
				} else {
					setLatestTemplate(response.data || null);
				}
			} catch (error: any) {
				console.error('Failed to load templates', error);
				if (!cancelled) {
					setLatestTemplate(null);
					setTemplatesError(error?.message || '템플릿을 불러오지 못했습니다');
				}
			} finally {
				if (!cancelled) {
					setTemplatesLoading(false);
				}
			}
		}, TEMPLATE_FETCH_DELAY);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [trimmedPlaceName]);

	const handleApplyTemplate = () => {
		if (!latestTemplate) {
			return;
		}

		const data = latestTemplate.templateData ?? {};
		
		// 해시태그 5개 초과 검증 및 자동 교정
		const hashtags = Array.isArray(data.hashtags) ? data.hashtags.slice(0, 5) : [];
		if (Array.isArray(data.hashtags) && data.hashtags.length > 5) {
			notifyError(`템플릿의 해시태그가 5개를 초과하여 앞 5개만 적용됩니다`);
		}
		
		setFormData((prev) => ({
			...prev,
			address: data.address ?? '',
			placeUrl: (data as any).placeUrl ?? '',
			searchKeywords: Array.isArray(data.searchKeywords) ? data.searchKeywords : [],
			includeText: data.includeText ?? '',
			requiredKeywords: Array.isArray(data.requiredKeywords) ? data.requiredKeywords : [],
			emphasizeKeywords: Array.isArray(data.emphasizeKeywords) ? data.emphasizeKeywords : [],
			flags: {
				...prev.flags,
				link: Boolean(data.link),
				map: Boolean(data.map),
				hashtag: data.hashtag !== undefined ? Boolean(data.hashtag) : prev.flags.hashtag,
			},
			hashtags,
			referenceText: data.referenceText ?? '',
			notes: data.notes ?? '',
		}));
		setTemplateAppliedId(latestTemplate.id);
		
		// 필수 항목 검증 (검색 키워드)
		if (!Array.isArray(data.searchKeywords) || data.searchKeywords.length === 0) {
			notifyError('템플릿에 검색 키워드가 없습니다. 직접 입력해주세요');
		} else {
			notifySuccess('템플릿이 적용되었습니다 (사진은 새로 업로드해주세요)');
		}
	};

	const handleSaveTemplate = async () => {
		const rawPlaceName = formData.placeName.trim();
		if (rawPlaceName.length < 2) {
			notifyError('플레이스명을 2자 이상 입력해주세요');
			return;
		}

		const snapshot = buildTemplateSnapshot();
		setSavingTemplate(true);
		try {
			const response = await apiClient.saveOrderTemplate(rawPlaceName, snapshot);
			const saved = response.data;
			setLatestTemplate({
				id: saved?.id ?? crypto.randomUUID(),
				createdAt: saved?.createdAt ?? new Date().toISOString(),
				templateData: snapshot,
			});
			setTemplateAppliedId(saved?.id ?? null);
			notifySuccess('현재 입력값을 템플릿으로 저장했습니다');
		} catch (error: any) {
			console.error('Failed to save template', error);
			notifyError(error?.message || '템플릿 저장에 실패했습니다');
		} finally {
			setSavingTemplate(false);
		}
	};

	const buildTemplateSnapshot = (): TemplateSnapshot => ({
		address: formData.address,
		placeUrl: formData.placeUrl,
		searchKeywords: [...formData.searchKeywords],
		includeText: formData.includeText,
		requiredKeywords: [...formData.requiredKeywords],
		emphasizeKeywords: [...formData.emphasizeKeywords],
		link: formData.flags.link,
		map: formData.flags.map,
		hashtag: formData.flags.hashtag,
		hashtags: formData.hashtags.slice(0, 5),
		referenceText: formData.referenceText,
		notes: formData.notes,
	});

	const handleSubmitReceiptReview = async (saveAsDraft = false) => {
		if (isEditing) {
			notifyError('임시 저장 주문 편집에서는 사용할 수 없습니다');
			return;
		}
		if (!trimmedPlaceName) {
			notifyError('업체명을 입력해주세요');
			return;
		}
		if (!receiptExtraInstruction.trim()) {
			notifyError('추가 지시문은 필수입니다');
			return;
		}
		if (formData.requiredKeywords.length === 0) {
			notifyError('필수 키워드는 최소 1개 이상 필요합니다');
			return;
		}
		if (receiptMode === 'FIXED' && (receiptFixedChars < 10 || receiptFixedChars > 299)) {
			notifyError('글자수는 10~299 범위로 입력해주세요');
			return;
		}
		if (receiptUploadStats.inFlightCount > 0) {
			notifyError('사진 업로드가 완료될 때까지 기다려주세요');
			return;
		}
		if (receiptUploadStats.failedCount > 0) {
			notifyError('업로드 실패한 사진이 있습니다. 제거 후 다시 시도해주세요');
			return;
		}

		setLoading(true);
		try {
			const photoUrl = receiptUploadStats.uploaded[0]?.url;
			const receiptPayload: ReceiptReviewCreatePayload = {
				placeName: trimmedPlaceName,
				menuName: receiptMenuName.trim() || undefined,
				photoUrl: photoUrl || undefined,
				mode: receiptMode,
				fixedChars: receiptMode === 'FIXED' ? receiptFixedChars : undefined,
				requiredKeywords: [...formData.requiredKeywords],
				emoji: receiptEmoji,
				outputCount: receiptOutputCount,
				extraInstruction: receiptExtraInstruction.trim(),
				notes: formData.notes,
				saveAsDraft,
			};

			await createReceiptReviewOrder(receiptPayload);

			if (saveAsDraft) {
				notifySuccess('임시 저장 완료');
			} else {
				notifySuccess(`영수증 리뷰 접수 완료${receiptOutputCount > 1 ? ` (${receiptOutputCount}개 생성)` : ''}`);
			}
			router.push('/agency/orders');
		} catch (error: any) {
			const errorMessage = error?.message || (saveAsDraft ? '임시 저장에 실패했습니다' : '주문 처리에 실패했습니다');
			notifyError(errorMessage);
			console.error('=== 영수증 리뷰 주문 처리 실패 ===', {
				errorMessage,
				error,
				errorStack: error?.stack,
				errorResponse: error?.response?.data,
			});
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = async (saveAsDraft = false) => {
		if (!trimmedPlaceName) {
			notifyError('플레이스명을 입력해주세요');
			return;
		}

		if (formData.searchKeywords.length === 0) {
			notifyError('검색 키워드는 최소 1개 이상 필요합니다');
			return;
		}

		if (formData.hashtags.length > 5) {
			notifyError('해시태그는 최대 5개까지 가능합니다');
			return;
		}

		// 링크/지도 옵션이 켜져 있으면 URL을 강제(서버 생성 단계에서 linkUrl empty 방지)
		if ((formData.flags.link || formData.flags.map) && !String(formData.placeUrl || '').trim()) {
			notifyError('링크/지도 포함 옵션을 켠 경우 플레이스 URL을 입력해주세요');
			return;
		}
		if (
			(formData.flags.link || formData.flags.map) &&
			String(formData.placeUrl || '').trim() &&
			!/^https?:\/\//i.test(String(formData.placeUrl || '').trim())
		) {
			notifyError('플레이스 URL은 http(s):// 로 시작해야 합니다');
			return;
		}

		const effectiveSubmitCount = isEditing ? 1 : submitCount;

		if (!saveAsDraft) {
			if (uploadStats.uploadedCount < 5) {
				notifyError('사진은 최소 5장이 필요합니다.');
				return;
			}
			if (uploadStats.uploadedCount > 20) {
				notifyError('사진은 최대 20장까지 업로드할 수 있습니다.');
				return;
			}
		} else if (uploadStats.uploadedCount > 20) {
			notifyError('사진은 최대 20장까지 업로드할 수 있습니다.');
			return;
		}

		if (!isEditing && !saveAsDraft && (effectiveSubmitCount < 1 || effectiveSubmitCount > 5)) {
			notifyError('접수 수량은 1~5건 사이여야 합니다');
			return;
		}

		setLoading(true);
		try {
			const uploadedPhotos = uploadStats.uploaded;
			const pendingCount = uploadStats.inFlightCount;
			const failedCount = uploadStats.failedCount;
			const metaMissingCount = uploadStats.metaMissingCount;

			if (!saveAsDraft) {
				if (pendingCount > 0) {
					notifyError(`업로드 진행 중 ${pendingCount}건이 있습니다.`);
					setLoading(false);
					return;
				}
				if (failedCount > 0) {
					notifyError(`업로드 실패 ${failedCount}건을 해결한 뒤 다시 시도해주세요.`);
					setLoading(false);
					return;
				}
				if (metaMissingCount > 0) {
					notifyError(`사진 메타데이터 누락 ${metaMissingCount}건을 확인해주세요.`);
					setLoading(false);
					return;
				}
				if (uploadedPhotos.length < 5 || uploadedPhotos.length > 20) {
					notifyError('사진은 5~20장 범위 내에서 업로드를 완료해야 합니다.');
					setLoading(false);
					return;
				}
			}

			const photoMetas: Array<{ url: string; width: number; height: number; sizeKb: number }> = [];
			const photoUrls: string[] = [];

			for (const photo of uploadedPhotos) {
				const url = typeof photo.url === 'string' ? photo.url.trim() : '';
				const width = typeof photo.width === 'number' && photo.width > 0 ? photo.width : null;
				const height = typeof photo.height === 'number' && photo.height > 0 ? photo.height : null;
				const sizeKb = Number.isFinite(photo.sizeKb) && photo.sizeKb > 0 ? photo.sizeKb : null;

				if (!url || width === null || height === null || sizeKb === null) {
					continue;
				}

				photoUrls.push(url);
				photoMetas.push({
					url,
					width,
					height,
					sizeKb,
				});
			}

			if (!saveAsDraft && photoUrls.length !== uploadedPhotos.length) {
				notifyError('사진 메타데이터를 다시 확인한 뒤 제출해주세요.');
				setLoading(false);
				return;
			}

			const payload: OrderCreatePayload = {
				place: {
					name: trimmedPlaceName,
					address: formData.address,
					mapLink: String(formData.placeUrl || '').trim() || undefined,
				},
				guide: {
					searchKeywords: [...formData.searchKeywords],
					includeText: formData.includeText,
					requiredKeywords: [...formData.requiredKeywords],
					emphasizeKeywords: [...formData.emphasizeKeywords],
					link: formData.flags.link,
					map: formData.flags.map,
					hashtag: formData.flags.hashtag,
					hashtags: formData.hashtags.slice(0, 5),
				},
				referenceText: formData.referenceText,
				notes: formData.notes,
				targetChars: [1500, 2000],
				photoLimits: [5, 20],
				photos: photoUrls.length > 0 ? photoUrls : undefined,
				photoMetas: photoMetas.length > 0 ? photoMetas : undefined,
				saveAsDraft,
				submitCount: !saveAsDraft && !isEditing ? effectiveSubmitCount : undefined,
			};

			// 디버깅: 페이로드 출력
			console.log('=== 주문 제출 디버깅 ===', {
				mode: isEditing ? '편집' : '신규',
				orderId: editingOrderId,
				saveAsDraft,
				submitCount: payload.submitCount,
				placeName: payload.place.name,
				placeUrl: payload.place.mapLink,
				searchKeywords: payload.guide.searchKeywords,
				photoCount: photoUrls.length,
				photoMetasSample: photoMetas.length > 0 ? photoMetas[0] : null,
			});

			if (isEditing && editingOrderId) {
				await updateOrder(editingOrderId, payload);
			} else {
				await createOrder(payload);
			}

			// 템플릿 스냅샷 저장
			const snapshot = buildTemplateSnapshot();
			console.log('=== 템플릿 저장 시도 ===', {
				placeName: trimmedPlaceName,
				snapshot,
			});
			try {
				const result = await apiClient.saveOrderTemplate(trimmedPlaceName, snapshot);
				console.log('=== 템플릿 저장 성공 ===', result);
			} catch (snapshotError: any) {
				console.error('=== 템플릿 저장 실패 ===', {
					error: snapshotError,
					message: snapshotError?.message,
					response: snapshotError?.response?.data,
				});
			}

			if (saveAsDraft) {
				notifySuccess(isEditing ? '임시 저장이 업데이트되었습니다' : '임시 저장 완료');
			} else if (!isEditing && effectiveSubmitCount > 1) {
				notifySuccess(`${effectiveSubmitCount}건 접수 완료`);
			} else {
				notifySuccess('원고 접수가 완료되었습니다');
			}

		router.push('/agency/orders');
	} catch (error: any) {
		const errorMessage = error?.message || (saveAsDraft ? '임시 저장에 실패했습니다' : '주문 처리에 실패했습니다');
		notifyError(errorMessage);
		console.error('=== 주문 처리 실패 ===', {
			errorMessage,
			error,
			errorStack: error?.stack,
			errorResponse: error?.response?.data,
		});
	} finally {
		setLoading(false);
	}
};
	const hasRequiredPhotos = uploadStats.uploadedCount >= 5 && uploadStats.uploadedCount <= 20;
	const hasValidKeywords = formData.searchKeywords.length > 0;
	const hasValidHashtags = formData.hashtags.length <= 5;
	const canSubmit =
		Boolean(trimmedPlaceName) &&
		hasValidKeywords &&
		hasValidHashtags &&
		uploadStats.failedCount === 0 &&
		uploadStats.inFlightCount === 0 &&
		uploadStats.metaMissingCount === 0 &&
		hasRequiredPhotos;

	const latestTemplateData = latestTemplate?.templateData ?? {};
	const latestTemplateKeywords = Array.isArray(latestTemplateData.searchKeywords)
		? latestTemplateData.searchKeywords
		: [];
	const latestTemplateRequired = Array.isArray(latestTemplateData.requiredKeywords)
		? latestTemplateData.requiredKeywords
		: [];
	const latestTemplateEmphasis = Array.isArray(latestTemplateData.emphasizeKeywords)
		? latestTemplateData.emphasizeKeywords
		: [];
	const latestTemplateHashtags = Array.isArray(latestTemplateData.hashtags)
		? latestTemplateData.hashtags
		: [];
	const latestTemplateHasIssues =
		latestTemplateKeywords.length === 0 || latestTemplateHashtags.length > 5;

	return (
		<RouteGuard requiredRole="AGENCY">
			<AppShell sidebar={<AgencySidebar />}>
				<div className="max-w-5xl mx-auto">
					<div className="card">
						<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
							<div>
								<h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
									{isEditing ? '임시 주문 계속 작성' : '새 주문 생성'}
								</h1>

								{!isEditing && (
									<div className="mt-4 hidden md:flex gap-2">
										<button
											type="button"
											onClick={() => setOrderType('MANUSCRIPT')}
											className={orderType === 'MANUSCRIPT' ? 'btn-brand text-sm' : 'btn-outline text-sm'}
											disabled={loading || initializing}
										>
											블로그 원고
										</button>
										<button
											type="button"
											onClick={() => setOrderType('RECEIPT_REVIEW')}
											className={orderType === 'RECEIPT_REVIEW' ? 'btn-brand text-sm' : 'btn-outline text-sm'}
											disabled={loading || initializing}
										>
											영수증 리뷰
										</button>
									</div>
								)}

								<div className="mt-6 space-y-6">
									{!isEditing && orderType === 'RECEIPT_REVIEW' ? (
										<>
											<div>
												<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
													업체명 *
												</label>
												<input
													type="text"
													value={formData.placeName}
													onChange={(event) => {
														setFormData({ ...formData, placeName: event.target.value });
														setTemplateAppliedId(null);
													}}
													className="input-dark w-full"
													required
												/>
												<p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
													PC에서만 노출되는 간단 주문 폼입니다.
												</p>
												<p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
													모델 선택은 어드민에서 합니다. (영수증: 속도=Flash-Lite / 품질=Gemini 3.0 Pro)
												</p>
											</div>

											<div>
												<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
													메뉴명 (선택)
												</label>
												<input
													type="text"
													value={receiptMenuName}
													onChange={(event) => setReceiptMenuName(event.target.value)}
													className="input-dark w-full"
													placeholder="예: 김치찌개, 아메리카노"
													disabled={loading || initializing}
												/>
												<p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
													입력하면 후기 내용에 자연스럽게 1회 언급됩니다.
												</p>
											</div>

											<div>
												<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
													영수증 사진 (선택, 0~1장)
												</label>
												<PhotoUploader
													photos={receiptPhotos}
													onPhotosChange={setReceiptPhotos}
													minCount={0}
													maxCount={1}
												/>
												<p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
													사진을 올리면 모델이 영수증 내용을 참고해 후기를 작성합니다.
												</p>
											</div>

										<div>
											<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
												생성 개수
											</label>
											<div className="flex gap-2">
												{([1, 5, 10] as const).map((n) => (
													<button
														key={n}
														type="button"
														onClick={() => setReceiptOutputCount(n)}
														className={receiptOutputCount === n ? 'btn-brand text-sm' : 'btn-outline text-sm'}
														disabled={loading || initializing}
													>
														{n}개
													</button>
												))}
											</div>
										</div>

										<div>
											<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
												글자수 설정
											</label>
											<div className="flex gap-2">
												<button
													type="button"
													onClick={() => setReceiptMode('RANDOM')}
													className={receiptMode === 'RANDOM' ? 'btn-brand text-sm' : 'btn-outline text-sm'}
													disabled={loading || initializing}
												>
													RANDOM (10~299)
												</button>
												<button
													type="button"
													onClick={() => setReceiptMode('FIXED')}
													className={receiptMode === 'FIXED' ? 'btn-brand text-sm' : 'btn-outline text-sm'}
													disabled={loading || initializing}
												>
													FIXED
												</button>
											</div>
											{receiptMode === 'FIXED' && (
												<div className="mt-2">
													<input
														type="number"
														min={10}
														max={299}
														value={receiptFixedChars}
														onChange={(event) => {
															const next = parseInt(event.target.value, 10);
															if (!Number.isNaN(next)) setReceiptFixedChars(next);
														}}
														className="input-dark w-full"
														placeholder="예: 80"
													/>
													<p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
													10~299 범위 권장 (항상 300자 미만)
												</p>
												</div>
											)}
										</div>

										<div>
											<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
												이모지 사용
											</label>
											<label className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
												<input
													type="checkbox"
													checked={receiptEmoji}
													onChange={(e) => setReceiptEmoji(e.target.checked)}
													disabled={loading || initializing}
												/>
												1~3개 자연스럽게 포함
											</label>
										</div>

										<div>
											<label className="block text-sm font-medium mb-2">필수 키워드 (최소 1개)</label>
											<div className="flex gap-2 mb-2">
												<input
													type="text"
													value={requiredKeywordInput}
													onChange={(event) => setRequiredKeywordInput(event.target.value)}
													onKeyDown={(event) => {
														if (event.key === 'Enter') {
															event.preventDefault();
															addKeyword('required');
														}
													}}
													className="input-dark flex-1"
													placeholder="키워드 입력 후 Enter"
												/>
												<button type="button" onClick={() => addKeyword('required')} className="btn-brand">
													추가
												</button>
											</div>
											<div className="flex flex-wrap gap-2">
												{formData.requiredKeywords.map((keyword, index) => (
													<span
														key={`${keyword}-${index}`}
														className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/20 text-red-100"
													>
														{keyword}
														<button
															type="button"
															onClick={() =>
																setFormData({
																	...formData,
																	requiredKeywords: formData.requiredKeywords.filter((_, i) => i !== index),
																})
														}
														className="text-red-200 hover:text-white transition-colors"
													>
														×
													</button>
												</span>
												))}
											</div>
										</div>

										<div>
											<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
												추가 지시문(필수)
											</label>
											<textarea
												value={receiptExtraInstruction}
												onChange={(event) => setReceiptExtraInstruction(event.target.value)}
												className="input-dark w-full h-28"
												placeholder="예: 1인분 기준으로 간단하게, 과장 없이, 가격/주소/링크 언급 금지 등"
											/>
											<p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
												이 필드는 필수입니다.
											</p>
										</div>

										<div>
											<label className="block text-sm font-medium mb-2">비고</label>
											<textarea
												value={formData.notes}
												onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
												className="input-dark w-full h-24"
											/>
										</div>

										<div className="flex gap-4">
											<button
												type="button"
												onClick={() => handleSubmitReceiptReview(true)}
												disabled={loading || initializing || !trimmedPlaceName}
												className="btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
												style={{ backgroundColor: 'var(--muted)' }}
											>
												임시 저장
											</button>
											<button
												type="button"
												onClick={() => handleSubmitReceiptReview(false)}
												disabled={loading || initializing || !trimmedPlaceName || !receiptExtraInstruction.trim()}
												className="btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
											>
												영수증 리뷰 접수{receiptOutputCount > 1 ? ` (${receiptOutputCount}개)` : ''}
											</button>
										</div>
									</>
									) : (
										<>
									<div>
										<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
											플레이스명 *
										</label>
										<input
											type="text"
											value={formData.placeName}
											onChange={(event) => {
												setFormData({ ...formData, placeName: event.target.value });
												setTemplateAppliedId(null);
											}}
											className="input-dark w-full"
											required
										/>
										<p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
											플레이스명을 입력하면 우측 패널에서 최근 템플릿을 불러올 수 있습니다.
										</p>
									</div>

									<div>
										<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
											주소
										</label>
										<input
											type="text"
											value={formData.address}
											onChange={(event) => setFormData({ ...formData, address: event.target.value })}
											className="input-dark w-full"
										/>
									</div>

									<div>
										<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
											플레이스 URL
										</label>
										<input
											type="url"
											placeholder="https://... (네이버/카카오/구글 플레이스 URL)"
											value={formData.placeUrl}
											onChange={(event) => setFormData({ ...formData, placeUrl: event.target.value })}
											className="input-dark w-full"
											required={formData.flags.link || formData.flags.map}
										/>
										<p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
											링크 포함/지도 포함 옵션을 켠 경우 필수입니다. (서버가 이 값을 최우선으로 사용)
										</p>
									</div>

									<div>
										<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
											검색 키워드
										</label>
										<input
											type="text"
											placeholder="키워드 입력 후 Enter (여러 개 가능)"
											onKeyDown={(event) => {
												if (event.key === 'Enter') {
													event.preventDefault();
													const value = (event.currentTarget as HTMLInputElement).value.trim();
													if (value) {
														setFormData({
															...formData,
															searchKeywords: [...formData.searchKeywords, value],
														});
														(event.currentTarget as HTMLInputElement).value = '';
													}
												}
											}}
											className="input-dark w-full"
										/>
										<div className="flex flex-wrap gap-2 mt-2">
											{formData.searchKeywords.map((keyword, index) => (
												<span
													key={`${keyword}-${index}`}
													className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-white/10 text-[var(--text)] border border-white/10"
												>
													{keyword}
													<button
														type="button"
														onClick={() =>
															setFormData({
																...formData,
																searchKeywords: formData.searchKeywords.filter((_, i) => i !== index),
															})
														}
														className="text-[var(--muted)] hover:text-white transition-colors"
													>
														×
													</button>
												</span>
											))}
										</div>
									</div>

									<div>
										<label className="block text-sm font-medium mb-2">원고에 들어갈 내용</label>
										<textarea
											value={formData.includeText}
											onChange={(event) => setFormData({ ...formData, includeText: event.target.value })}
											className="input-dark w-full h-32"
										/>
									</div>

									<div>
										<label className="block text-sm font-medium mb-2">필수 키워드</label>
										<div className="flex gap-2 mb-2">
											<input
												type="text"
												value={requiredKeywordInput}
												onChange={(event) => setRequiredKeywordInput(event.target.value)}
												onKeyDown={(event) => {
													if (event.key === 'Enter') {
														event.preventDefault();
														addKeyword('required');
													}
												}}
												className="input-dark flex-1"
												placeholder="키워드 입력 후 Enter"
											/>
											<button type="button" onClick={() => addKeyword('required')} className="btn-brand">
												추가
											</button>
										</div>
										<div className="flex flex-wrap gap-2">
											{formData.requiredKeywords.map((keyword, index) => (
												<span
													key={`${keyword}-${index}`}
													className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/20 text-red-100"
												>
													{keyword}
													<button
														type="button"
														onClick={() =>
															setFormData({
																...formData,
																requiredKeywords: formData.requiredKeywords.filter((_, i) => i !== index),
															})
														}
														className="text-red-200 hover:text-white transition-colors"
													>
														×
													</button>
												</span>
											))}
										</div>
									</div>

									<div>
										<label className="block text-sm font-medium mb-2">강조 키워드</label>
										<div className="flex gap-2 mb-2">
											<input
												type="text"
												value={emphasisKeywordInput}
												onChange={(event) => setEmphasisKeywordInput(event.target.value)}
												onKeyDown={(event) => {
													if (event.key === 'Enter') {
														event.preventDefault();
														addKeyword('emphasis');
													}
												}}
												className="input-dark flex-1"
												placeholder="키워드 입력 후 Enter"
											/>
											<button type="button" onClick={() => addKeyword('emphasis')} className="btn-brand">
												추가
											</button>
										</div>
										<div className="flex flex-wrap gap-2">
											{formData.emphasizeKeywords.map((keyword, index) => (
												<span
													key={`${keyword}-${index}`}
													className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-amber-400/20 text-amber-100"
												>
													{keyword}
													<button
														type="button"
														onClick={() =>
															setFormData({
																...formData,
																emphasizeKeywords: formData.emphasizeKeywords.filter((_, i) => i !== index),
															})
														}
														className="text-amber-200 hover:text-white transition-colors"
													>
														×
													</button>
												</span>
											))}
										</div>
									</div>

									<div className="space-y-2">
										<label className="flex items-center">
											<input
												type="checkbox"
												checked={formData.flags.link}
												onChange={(event) =>
													setFormData({ ...formData, flags: { ...formData.flags, link: event.target.checked } })
												}
												className="mr-2"
											/>
											링크 포함
										</label>
										<label className="flex items-center">
											<input
												type="checkbox"
												checked={formData.flags.map}
												onChange={(event) =>
													setFormData({ ...formData, flags: { ...formData.flags, map: event.target.checked } })
												}
												className="mr-2"
											/>
											지도 포함
										</label>
									</div>

									<div>
										<label className="block text-sm font-medium mb-2">해시태그 (최대 5개)</label>
										<div className="flex gap-2 mb-2">
											<input
												type="text"
												value={hashtagInput}
												onChange={(event) => setHashtagInput(event.target.value)}
												onKeyDown={(event) => {
													if (event.key === 'Enter') {
														event.preventDefault();
														addHashtag();
													}
												}}
												className="input-dark flex-1"
												placeholder="# 없이 입력"
												disabled={formData.hashtags.length >= 5}
											/>
											<button
												type="button"
												onClick={addHashtag}
												disabled={formData.hashtags.length >= 5}
												className="btn-brand disabled:opacity-50"
											>
												추가
											</button>
										</div>
										<div className="flex flex-wrap gap-2">
											{formData.hashtags.map((tag, index) => (
												<span
													key={`${tag}-${index}`}
													className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-white/10 text-[var(--text)] border border-white/10"
												>
													#{tag}
													<button
														type="button"
														onClick={() =>
															setFormData({
																...formData,
																hashtags: formData.hashtags.filter((_, i) => i !== index),
															})
														}
														className="text-[var(--muted)] hover:text-white transition-colors"
													>
														×
													</button>
												</span>
											))}
										</div>
									</div>

									<div>
										<label className="block text-sm font-medium mb-2">참고 리뷰</label>
										<textarea
											value={formData.referenceText}
											onChange={(event) => setFormData({ ...formData, referenceText: event.target.value })}
											className="input-dark w-full h-24"
										/>
									</div>

									<div>
										<label className="block text-sm font-medium mb-2">비고</label>
										<textarea
											value={formData.notes}
											onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
											className="input-dark w-full h-24"
										/>
									</div>

									<PhotoUploader photos={photos} onPhotosChange={setPhotos} minCount={5} maxCount={20} />

									<div>
										<label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
											접수 수량
										</label>
										<input
											type="number"
											min="1"
											max="5"
											value={submitCount}
											onChange={(event) => {
												const next = parseInt(event.target.value, 10);
												if (!Number.isNaN(next) && next >= 1 && next <= 5) {
													setSubmitCount(next);
												}
											}}
											className="input-dark w-full"
											placeholder="1"
											disabled={loading || isEditing}
										/>
										<p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
											{isEditing
												? '임시 저장 건을 계속 작성하는 동안 접수 수량은 1건으로 고정됩니다.'
												: `동일한 입력값으로 ${submitCount}건의 주문을 생성합니다 (최대 5건)`}
										</p>
									</div>

									<div className="flex gap-4">
										<button
											type="button"
											onClick={() => handleSubmit(true)}
											disabled={loading || initializing || !trimmedPlaceName}
											className="btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
											style={{ backgroundColor: 'var(--muted)' }}
										>
											{isEditing ? '임시 저장 업데이트' : '임시 저장'}
										</button>
										<button
											type="button"
											onClick={() => handleSubmit(false)}
											disabled={
												loading ||
												initializing ||
												!canSubmit ||
												(!isEditing && (submitCount < 1 || submitCount > 5))
											}
											className="btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
										>
											{isEditing ? '원고 접수' : `원고 접수${submitCount > 1 ? ` (${submitCount}건)` : ''}`}
										</button>
									</div>
										</>
									)}
								</div>
							</div>

							{orderType === 'RECEIPT_REVIEW' && !isEditing ? null : (
							<aside className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-3">
								<h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
									최근 템플릿(업체명 일치)
								</h2>

								<button
									type="button"
									onClick={handleSaveTemplate}
									disabled={savingTemplate || !trimmedPlaceName || trimmedPlaceName.length < 2}
									className="btn-outline text-xs disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{savingTemplate ? '저장 중...' : '현재 입력값을 템플릿으로 저장'}
								</button>

								{!trimmedPlaceName && (
									<p className="text-xs" style={{ color: 'var(--muted)' }}>
										플레이스명을 2자 이상 입력하면 최근 템플릿이 나타납니다.
									</p>
								)}

								{trimmedPlaceName.length === 1 && (
									<p className="text-xs" style={{ color: 'var(--muted)' }}>
										플레이스명을 1자 더 입력해주세요 (2자 이상 필요)
									</p>
								)}

								{trimmedPlaceName && templatesLoading && (
									<p className="text-xs" style={{ color: 'var(--muted)' }}>
										최근 템플릿을 불러오는 중입니다...
									</p>
								)}

								{trimmedPlaceName && !templatesLoading && templatesError && (
									<p className="text-xs" style={{ color: 'var(--danger)' }}>
										{templatesError}
									</p>
								)}

								{trimmedPlaceName && !templatesLoading && !templatesError && latestTemplate && (
									<div className="space-y-3 text-xs">
										<div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
											<div className="flex items-start justify-between gap-3">
												<div>
													<p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
														저장일시
													</p>
													<p style={{ color: 'var(--text)' }}>
														{new Date(latestTemplate.createdAt).toLocaleString('ko-KR')}
													</p>
												</div>
												<button
													type="button"
													onClick={handleApplyTemplate}
													disabled={templateAppliedId === latestTemplate.id}
													className="btn-brand px-3 py-2 text-xs disabled:opacity-60"
												>
													{templateAppliedId === latestTemplate.id ? '적용됨' : '폼에 적용'}
												</button>
											</div>

											{latestTemplateHasIssues && (
												<p className="flex items-center gap-1 text-[11px] text-yellow-400">
													<span aria-hidden>⚠</span>
													검색 키워드가 없거나 해시태그가 5개를 초과한 템플릿입니다. 적용 후 값을 확인해주세요.
												</p>
											)}

											<div className="grid gap-2">
												<div>
													<p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
														검색 키워드
													</p>
													<p style={{ color: latestTemplateKeywords.length ? 'var(--text)' : 'var(--muted)' }}>
														{latestTemplateKeywords.length ? latestTemplateKeywords.slice(0, 3).join(', ') : '값 없음'}
													</p>
												</div>
												<div className="flex flex-wrap gap-2">
													{latestTemplateRequired.slice(0, 5).map((keyword) => (
														<span key={`req-${keyword}`} className="px-2 py-1 rounded bg-red-500/20 text-red-100">
															{keyword}
														</span>
													))}
													{latestTemplateEmphasis.slice(0, 5).map((keyword) => (
														<span key={`emp-${keyword}`} className="px-2 py-1 rounded bg-amber-400/20 text-amber-100">
															{keyword}
														</span>
													))}
												</div>
												{latestTemplateHashtags.length > 0 && (
													<div className="flex flex-wrap gap-2">
														{latestTemplateHashtags.slice(0, 5).map((tag) => (
															<span key={`hash-${tag}`} className="px-2 py-1 rounded bg-white/10 border border-white/10">
																#{tag}
															</span>
														))}
														{latestTemplateHashtags.length > 5 && (
															<span className="text-[11px] text-yellow-400">… {latestTemplateHashtags.length - 5}개 추가</span>
														)}
													</div>
												)}
												{latestTemplateData.notes && (
													<p className="rounded bg-white/5 p-2" style={{ color: 'var(--muted)' }}>
														비고: {latestTemplateData.notes}
													</p>
												)}
											</div>
										</div>
									</div>
								)}

								{trimmedPlaceName && !templatesLoading && !templatesError && !latestTemplate && (
									<p className="text-xs" style={{ color: 'var(--muted)' }}>
										이 업체의 저장된 템플릿이 없습니다.
									</p>
								)}

								<p className="text-[11px]" style={{ color: 'var(--muted)' }}>
									텍스트·체크 항목만 복원되며 사진은 항상 새로 업로드해야 합니다.
								</p>
							</aside>
							)}
						</div>
					</div>
				</div>
			</AppShell>
		</RouteGuard>
	);
}

export default function NewOrderPage() {
	return (
		<Suspense fallback={null}>
			<NewOrderPageInner />
		</Suspense>
	);
}

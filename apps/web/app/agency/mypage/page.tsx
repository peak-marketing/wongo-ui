"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import AppShell from '@/components/layout/AppShell';
import AgencySidebar from '@/components/nav/AgencySidebar';
import RouteGuard from '@/components/auth/RouteGuard';
import { apiClient } from '@/lib/api';
import type { AgencyProfile } from '@/lib/types';

type FormState = {
	email: string;
	contactName: string;
	phone: string;
	companyName: string;
	businessRegNo: string;
	refundBank: string;
	refundHolder: string;
	refundAccount: string;
};

type FormErrors = Partial<Record<Exclude<keyof FormState, 'email'>, string>>;

const EMPTY_FORM: FormState = {
	email: '',
	contactName: '',
	phone: '',
	companyName: '',
	businessRegNo: '',
	refundBank: '',
	refundHolder: '',
	refundAccount: '',
};

function formatUpdatedAtLabel(updatedAt?: string | null) {
	if (!updatedAt) return '마지막 업데이트: -';
	const date = new Date(updatedAt);
	if (Number.isNaN(date.getTime())) return '마지막 업데이트: -';
	const formatter = new Intl.DateTimeFormat('ko-KR', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	});
	return `마지막 업데이트: ${formatter.format(date)}`;
}

function formatPhoneNumberForDisplay(digitsOnly: string) {
	if (digitsOnly.length === 10) {
		return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
	}
	if (digitsOnly.length === 11) {
		return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 7)}-${digitsOnly.slice(7)}`;
	}
	return digitsOnly;
}

function formatBusinessRegNoForDisplay(digitsOnly: string) {
	if (digitsOnly.length !== 10) {
		return digitsOnly;
	}
	return `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 5)}-${digitsOnly.slice(5)}`;
}

function sanitizeAccount(value: string) {
	return value
		.replace(/[^0-9-]/g, '')
		.replace(/-{2,}/g, '-')
		.replace(/^-+/, '')
		.replace(/-+$/, '');
}

function maskLast4(value: string) {
	const digits = value.replace(/\D/g, '');
	return digits.length ? digits.slice(-4) : '';
}

function mapProfileToForm(profile: AgencyProfile | null | undefined): FormState {
	if (!profile) {
		return { ...EMPTY_FORM };
	}

	return {
		email: profile.email || '',
		contactName: profile.contactName || '',
		phone: profile.phone || '',
		companyName: profile.companyName || '',
		businessRegNo: profile.businessRegNo || '',
		refundBank: profile.refundBank || '',
		refundHolder: profile.refundHolder || '',
		refundAccount: profile.refundAccount || '',
	};
}

function normalizeForCompare(field: keyof FormState, value: string) {
	switch (field) {
		case 'phone':
		case 'businessRegNo':
			return value.replace(/\D/g, '');
		case 'refundAccount':
			return sanitizeAccount(value);
		default:
			return value.trim();
	}
}

function validateState(state: FormState): FormErrors {
	const next: FormErrors = {};

	const trimmedContact = state.contactName.trim();
	if (!trimmedContact) {
		next.contactName = '담당자 이름을 입력해주세요';
	} else if (trimmedContact.length > 30) {
		next.contactName = '담당자 이름은 1~30자 이내여야 합니다';
	}

	const phoneDigits = state.phone.replace(/\D/g, '');
	if (!phoneDigits) {
		next.phone = '연락처를 입력해주세요';
	} else if (phoneDigits.length < 10 || phoneDigits.length > 11) {
		next.phone = '연락처는 숫자 10~11자리로 입력해주세요';
	}

	const trimmedCompany = state.companyName.trim();
	if (!trimmedCompany) {
		next.companyName = '사업자명을 입력해주세요';
	} else if (trimmedCompany.length > 50) {
		next.companyName = '사업자명은 1~50자 이내여야 합니다';
	}

	const bizDigits = state.businessRegNo.replace(/\D/g, '');
	if (!bizDigits) {
		next.businessRegNo = '사업자등록번호를 입력해주세요';
	} else if (bizDigits.length !== 10) {
		next.businessRegNo = '사업자등록번호는 숫자 10자리로 입력해주세요';
	}

	const bank = state.refundBank.trim();
	if (bank && (bank.length < 1 || bank.length > 30)) {
		next.refundBank = '은행명은 1~30자 이내로 입력해주세요';
	}

	const holder = state.refundHolder.trim();
	if (holder && (holder.length < 1 || holder.length > 30)) {
		next.refundHolder = '예금주는 1~30자 이내로 입력해주세요';
	}

	const account = sanitizeAccount(state.refundAccount);
	if (account) {
		if (account.length < 4 || account.length > 30) {
			next.refundAccount = '계좌번호는 숫자와 하이픈으로 4~30자 이내여야 합니다';
		}
	}

	return next;
}

function AgencyMypageContent() {
	const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
	const [initialForm, setInitialForm] = useState<FormState | null>(null);
	const [errors, setErrors] = useState<FormErrors>({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [updatedAt, setUpdatedAt] = useState<string | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);

	const fetchProfile = useCallback(async () => {
		setLoading(true);
		try {
			const { data } = await apiClient.getAgencyMeProfile();
			const mapped = mapProfileToForm(data as AgencyProfile);
			const enriched: FormState = {
				...mapped,
				phone: formatPhoneNumberForDisplay(mapped.phone.replace(/\D/g, '')),
				businessRegNo: formatBusinessRegNoForDisplay(mapped.businessRegNo.replace(/\D/g, '')),
				refundAccount: sanitizeAccount(mapped.refundAccount),
			};
			setForm(enriched);
			setInitialForm({ ...enriched });
			setErrors(validateState(enriched));
			setUpdatedAt((data as AgencyProfile)?.updatedAt || null);
			setLoadError(null);
		} catch (error: any) {
			console.error('Failed to load profile', error);
			const message = error instanceof Error ? error.message : '프로필 정보를 불러오지 못했습니다';
			setLoadError(message);
			toast.error(message, { position: 'top-center' });
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void fetchProfile();
	}, [fetchProfile]);

	useEffect(() => {
		if (!initialForm) return;
		setErrors(validateState(form));
	}, [form, initialForm]);

	const hasValidationError = useMemo(() => Object.values(errors).some(Boolean), [errors]);

	const hasChanges = useMemo(() => {
		if (!initialForm) return false;
		const fields: Array<keyof FormState> = [
			'contactName',
			'phone',
			'companyName',
			'businessRegNo',
			'refundBank',
			'refundHolder',
			'refundAccount',
		];
		return fields.some((field) => normalizeForCompare(field, form[field]) !== normalizeForCompare(field, initialForm[field]));
	}, [form, initialForm]);

	const updateField = useCallback((field: keyof FormState, value: string) => {
		setForm((prev) => ({ ...prev, [field]: value }));
	}, []);

	const handleBasicChange = useCallback(
		(field: 'contactName' | 'companyName' | 'refundBank' | 'refundHolder') =>
					(event: ChangeEvent<HTMLInputElement>) => {
				updateField(field, event.target.value);
			},
		[updateField],
	);

	const handlePhoneChange = useCallback(
			(event: ChangeEvent<HTMLInputElement>) => {
			const digits = event.target.value.replace(/\D/g, '');
			updateField('phone', digits);
		},
		[updateField],
	);

	const handleBusinessRegNoChange = useCallback(
			(event: ChangeEvent<HTMLInputElement>) => {
			const digits = event.target.value.replace(/\D/g, '');
			updateField('businessRegNo', digits);
		},
		[updateField],
	);

	const handleRefundAccountChange = useCallback(
			(event: ChangeEvent<HTMLInputElement>) => {
			updateField('refundAccount', sanitizeAccount(event.target.value));
		},
		[updateField],
	);

	const handlePhoneBlur = useCallback(() => {
		setForm((prev) => {
			const digits = prev.phone.replace(/\D/g, '');
			const formatted = formatPhoneNumberForDisplay(digits);
			return { ...prev, phone: formatted };
		});
	}, []);

	const handleBusinessRegNoBlur = useCallback(() => {
		setForm((prev) => {
			const digits = prev.businessRegNo.replace(/\D/g, '');
			const formatted = formatBusinessRegNoForDisplay(digits);
			return { ...prev, businessRegNo: formatted };
		});
	}, []);

	const handleRefundAccountBlur = useCallback(() => {
		setForm((prev) => ({ ...prev, refundAccount: sanitizeAccount(prev.refundAccount) }));
	}, []);

	const handleSubmit = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (loading || saving) return;

			const currentErrors = validateState(form);
			setErrors(currentErrors);
			if (Object.values(currentErrors).some(Boolean)) {
				toast.error('입력값을 다시 확인해주세요', { position: 'top-center' });
				return;
			}

			if (!hasChanges) {
				return;
			}

			setSaving(true);
			try {
				const payload = {
					contactName: form.contactName.trim(),
					phone: form.phone.replace(/\D/g, ''),
					companyName: form.companyName.trim(),
					businessRegNo: form.businessRegNo.replace(/\D/g, ''),
					refundBank: form.refundBank.trim() || undefined,
					refundHolder: form.refundHolder.trim() || undefined,
					refundAccount: sanitizeAccount(form.refundAccount) || undefined,
				};

				const { data } = await apiClient.updateAgencyMeProfile(payload);
				const mapped = mapProfileToForm(data as AgencyProfile);
				const refreshed: FormState = {
					...mapped,
					phone: formatPhoneNumberForDisplay(mapped.phone.replace(/\D/g, '')),
					businessRegNo: formatBusinessRegNoForDisplay(mapped.businessRegNo.replace(/\D/g, '')),
					refundAccount: sanitizeAccount(mapped.refundAccount),
				};
				setForm(refreshed);
				setInitialForm({ ...refreshed });
				setErrors(validateState(refreshed));
				setUpdatedAt((data as AgencyProfile)?.updatedAt || new Date().toISOString());
				toast.success('정보가 저장되었습니다.', { position: 'top-center' });
				console.log(
					`${new Date().toISOString()} (PROFILE_SAVE) (SUCCESS) (${form.email}|${payload.contactName}|${payload.phone}|${maskLast4(payload.businessRegNo)}|${payload.refundBank || ''}${payload.refundAccount ? `/${maskLast4(payload.refundAccount)}` : ''})`,
				);
			} catch (error: unknown) {
				console.error('Failed to save profile', error);
				const message = error instanceof Error ? error.message : '정보 저장에 실패했습니다';
				toast.error(message, { position: 'top-center' });
				console.log(
					`${new Date().toISOString()} (PROFILE_SAVE) (FAIL) (${form.email}|${form.contactName.trim()}|${form.phone.replace(/\D/g, '')}|${maskLast4(form.businessRegNo)}|${form.refundBank.trim() || ''}${form.refundAccount ? `/${maskLast4(form.refundAccount)}` : ''})`,
				);
			} finally {
				setSaving(false);
			}
		},
		[form, hasChanges, loading, saving],
	);

	const isSaveDisabled = !hasChanges || hasValidationError || saving;

	return (
		<div className="max-w-4xl">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
				<div>
					<h2 className="text-2xl font-semibold">마이 페이지</h2>
					<p className="text-sm text-[var(--muted)]">대행사 기본 정보를 확인하고 수정할 수 있습니다.</p>
				</div>
				<span className="text-xs text-[var(--muted)] whitespace-nowrap">{formatUpdatedAtLabel(updatedAt)}</span>
			</div>

			<div className="bg-[var(--panel)] border border-white/10 rounded-2xl shadow-lg p-6">
				{loading ? (
					<div className="flex h-40 items-center justify-center text-sm text-[var(--muted)]">
						프로필 정보를 불러오는 중입니다...
					</div>
				) : loadError ? (
					<div className="flex flex-col items-center justify-center gap-3 text-sm text-[var(--muted)]">
						<span>{loadError}</span>
						<button
							type="button"
							onClick={() => void fetchProfile()}
							className="btn-brand px-4 py-2"
						>
							다시 시도
						</button>
					</div>
				) : (
					<form className="space-y-8" onSubmit={handleSubmit} noValidate>
						<section className="space-y-4">
							<h3 className="text-lg font-semibold">기본 정보</h3>
							<div className="grid gap-4 md:grid-cols-2">
								<div>
									<label className="block text-sm font-medium mb-1">이메일</label>
									<input
										value={form.email}
										className="input-dark w-full opacity-70"
										readOnly
										disabled
									/>
								</div>
								<div>
									<label className="block text-sm font-medium mb-1">담당자 이름 *</label>
									<input
										value={form.contactName}
										onChange={handleBasicChange('contactName')}
										className={`input-dark w-full ${errors.contactName ? 'border-red-500' : ''}`}
										maxLength={30}
									/>
									{errors.contactName && <p className="mt-1 text-xs text-red-400">{errors.contactName}</p>}
								</div>
								<div>
									<label className="block text-sm font-medium mb-1">연락처 *</label>
									<input
										value={form.phone}
										onChange={handlePhoneChange}
										onBlur={handlePhoneBlur}
										className={`input-dark w-full ${errors.phone ? 'border-red-500' : ''}`}
										inputMode="numeric"
										maxLength={13}
										placeholder="01012345678"
									/>
									{errors.phone && <p className="mt-1 text-xs text-red-400">{errors.phone}</p>}
								</div>
								<div>
									<label className="block text-sm font-medium mb-1">사업자명 *</label>
									<input
										value={form.companyName}
										onChange={handleBasicChange('companyName')}
										className={`input-dark w-full ${errors.companyName ? 'border-red-500' : ''}`}
										maxLength={50}
									/>
									{errors.companyName && <p className="mt-1 text-xs text-red-400">{errors.companyName}</p>}
								</div>
								<div>
									<label className="block text-sm font-medium mb-1">사업자등록번호 *</label>
									<input
										value={form.businessRegNo}
										onChange={handleBusinessRegNoChange}
										onBlur={handleBusinessRegNoBlur}
										className={`input-dark w-full ${errors.businessRegNo ? 'border-red-500' : ''}`}
										inputMode="numeric"
										maxLength={12}
										placeholder="1234567890"
									/>
									{errors.businessRegNo && <p className="mt-1 text-xs text-red-400">{errors.businessRegNo}</p>}
								</div>
							</div>
						</section>

						<section className="space-y-4">
							<h3 className="text-lg font-semibold">환불 계좌 (선택)</h3>
							<div className="grid gap-4 md:grid-cols-3">
								<div>
									<label className="block text-sm font-medium mb-1">은행명</label>
									<input
										value={form.refundBank}
										onChange={handleBasicChange('refundBank')}
										className={`input-dark w-full ${errors.refundBank ? 'border-red-500' : ''}`}
										maxLength={30}
									/>
									{errors.refundBank && <p className="mt-1 text-xs text-red-400">{errors.refundBank}</p>}
								</div>
								<div>
									<label className="block text-sm font-medium mb-1">예금주</label>
									<input
										value={form.refundHolder}
										onChange={handleBasicChange('refundHolder')}
										className={`input-dark w-full ${errors.refundHolder ? 'border-red-500' : ''}`}
										maxLength={30}
									/>
									{errors.refundHolder && <p className="mt-1 text-xs text-red-400">{errors.refundHolder}</p>}
								</div>
								<div>
									<label className="block text-sm font-medium mb-1">계좌번호</label>
									<input
										value={form.refundAccount}
										onChange={handleRefundAccountChange}
										onBlur={handleRefundAccountBlur}
										className={`input-dark w-full ${errors.refundAccount ? 'border-red-500' : ''}`}
										maxLength={30}
										placeholder="숫자와 하이픈 조합"
									/>
									{errors.refundAccount && <p className="mt-1 text-xs text-red-400">{errors.refundAccount}</p>}
								</div>
							</div>
						</section>

						<div className="flex justify-end">
							<button
								type="submit"
								disabled={isSaveDisabled}
								className={`btn-brand flex items-center gap-2 ${
									isSaveDisabled ? 'opacity-40 cursor-not-allowed' : ''
								}`}
							>
								{saving && (
									<span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
								)}
								저장하기
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}

export default function AgencyMypagePage() {
	return (
		<RouteGuard requiredRole="AGENCY">
			<AppShell sidebar={<AgencySidebar />}>
				<AgencyMypageContent />
			</AppShell>
		</RouteGuard>
	);
}

'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { uploadPhotos } from '@/lib/api';

export type PhotoUploadStatus = 'queued' | 'uploading' | 'uploaded' | 'failed';

export interface PhotoUploadItem {
  id: string;
  file?: File;
  preview: string;
  url?: string;
  width?: number;
  height?: number;
  sizeKb: number;
  status: PhotoUploadStatus;
  progress: number;
  error?: string;
}

interface PhotoUploaderProps {
  photos: PhotoUploadItem[];
  onPhotosChange: React.Dispatch<React.SetStateAction<PhotoUploadItem[]>>;
  minCount?: number;
  maxCount?: number;
}

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_SIZE_MB = 10;
const MAX_SIZE_KB = MAX_SIZE_MB * 1024;
const MAX_TOTAL_SIZE_MB = 150;
const MAX_TOTAL_SIZE_KB = MAX_TOTAL_SIZE_MB * 1024;
const isDevMode = process.env.NODE_ENV !== 'production';

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `photo_${Math.random().toString(36).slice(2, 10)}`;
};

const statusBadge: Record<PhotoUploadStatus, { label: string; className: string }> = {
  queued: { label: '대기', className: 'bg-gray-500/80' },
  uploading: { label: '업로드 중', className: 'bg-blue-500/80' },
  uploaded: { label: '완료', className: 'bg-emerald-500/80' },
  failed: { label: '실패', className: 'bg-red-500/80' },
};

export default function PhotoUploader({
  photos,
  onPhotosChange,
  minCount = 15,
  maxCount = 20,
}: PhotoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = (file: File): string | null => {
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `허용되지 않은 파일 형식입니다. (JPG, JPEG, PNG, WEBP만 가능)`;
    }
    if (file.size > MAX_SIZE_KB * 1024) {
      return `파일 크기는 ${MAX_SIZE_MB}MB를 초과할 수 없습니다.`;
    }
    return null;
  };

  const getImageDimensions = (previewUrl: string) =>
    new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = reject;
      img.src = previewUrl;
    });

  const updatePhoto = useCallback(
    (id: string, updater: (photo: PhotoUploadItem) => PhotoUploadItem) => {
      onPhotosChange((prev) => prev.map((photo) => (photo.id === id ? updater(photo) : photo)));
    },
    [onPhotosChange],
  );

  const removePhoto = (id: string) => {
    onPhotosChange((prev) => {
      const target = prev.find((photo) => photo.id === id);
      if (target && target.preview.startsWith('blob:')) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((photo) => photo.id !== id);
    });
  };

  const movePhoto = (id: string, direction: 'up' | 'down') => {
    onPhotosChange((prev) => {
      const index = prev.findIndex((photo) => photo.id === id);
      if (index === -1) {
        return prev;
      }
      if ((direction === 'up' && index === 0) || (direction === 'down' && index === prev.length - 1)) {
        return prev;
      }
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const processFile = useCallback(
    async (itemId: string, file: File, preview: string) => {
      updatePhoto(itemId, (photo) => ({ ...photo, status: 'uploading', progress: 10, error: undefined }));

      try {
        const dimensions = await getImageDimensions(preview);
        updatePhoto(itemId, (photo) => ({ ...photo, progress: 35 }));
        const sizeKb = Math.max(1, Math.round(file.size / 1024));

        const [uploadedUrl] = await uploadPhotos([file]);
        if (!uploadedUrl) {
          throw new Error('업로드 URL이 비어있습니다');
        }

        updatePhoto(itemId, (photo) => ({
          ...photo,
          status: 'uploaded',
          progress: 100,
          url: uploadedUrl,
          width: dimensions.width,
          height: dimensions.height,
          sizeKb,
        }));
      } catch (error) {
        console.error('Photo processing failed', error);
        updatePhoto(itemId, (photo) => ({
          ...photo,
          status: 'failed',
          progress: 0,
          error: error instanceof Error ? error.message : '업로드 실패',
        }));
        toast.error(`${file.name} 업로드 실패`);
      }
    },
    [updatePhoto],
  );

  const processFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      const remainingSlots = Math.max(0, maxCount - photos.length);
      if (remainingSlots <= 0) {
        toast.error(`사진은 최대 ${maxCount}장까지 업로드할 수 있습니다.`);
        return;
      }

      const acceptedFiles = files.slice(0, remainingSlots);
      if (acceptedFiles.length < files.length) {
        toast.error(`최대 ${maxCount}장까지 업로드할 수 있습니다. 남은 슬롯: ${remainingSlots}장`);
      }

      const currentTotalKb = photos.reduce((sum, photo) => sum + (photo.sizeKb || 0), 0);
      let nextTotalKb = currentTotalKb;

      const preparedItems: PhotoUploadItem[] = [];
      for (const file of acceptedFiles) {
        const validationError = validateFile(file);
        if (validationError) {
          toast.error(validationError);
          continue;
        }

        const preview = URL.createObjectURL(file);
        const sizeKb = Math.max(1, Math.round(file.size / 1024));

        if (nextTotalKb + sizeKb > MAX_TOTAL_SIZE_KB) {
          toast.error(`총 업로드 용량은 ${MAX_TOTAL_SIZE_MB}MB를 초과할 수 없습니다.`);
          URL.revokeObjectURL(preview);
          continue;
        }

        nextTotalKb += sizeKb;
        preparedItems.push({
          id: createId(),
          file,
          preview,
          sizeKb,
          status: 'queued',
          progress: 0,
        });
      }

      if (preparedItems.length === 0) {
        return;
      }

      onPhotosChange((prev) => [...prev, ...preparedItems]);

      await Promise.all(preparedItems.map((item) => processFile(item.id, item.file as File, item.preview)));
    },
    [maxCount, onPhotosChange, photos, processFile],
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) {
        processFiles(files);
      }
    },
    [processFiles],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const retryUpload = useCallback(
    (photo: PhotoUploadItem) => {
      if (!photo.file) {
        return;
      }
      updatePhoto(photo.id, (item) => ({ ...item, status: 'queued', progress: 0, error: undefined }));
      processFile(photo.id, photo.file, photo.preview);
    },
    [processFile, updatePhoto],
  );

  const totalSizeMb = useMemo(() => photos.reduce((sum, photo) => sum + photo.sizeKb, 0) / 1024, [photos]);
  const uploadedCount = useMemo(() => photos.filter((photo) => photo.status === 'uploaded').length, [photos]);
  const failedCount = useMemo(() => photos.filter((photo) => photo.status === 'failed').length, [photos]);
  const inFlightCount = useMemo(
    () => photos.filter((photo) => photo.status === 'queued' || photo.status === 'uploading').length,
    [photos],
  );
  const metaMissingCount = useMemo(
    () =>
      photos.filter(
        (photo) =>
          photo.status === 'uploaded' && (!photo.url || !photo.width || !photo.height || !photo.sizeKb),
      ).length,
    [photos],
  );

  const isWithinCount = photos.length >= minCount && photos.length <= maxCount;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>
          사진 ({minCount}~{maxCount}장) <span style={{ color: 'var(--danger)' }}>*</span>
        </label>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-[var(--brand)] bg-[var(--brand)]/10'
              : 'border-white/20 hover:border-white/40'
          }`}
          style={{ background: isDragging ? 'rgba(37, 99, 235, 0.1)' : 'transparent' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_EXTENSIONS.join(',')}
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="space-y-2">
            <p className="text-sm" style={{ color: 'var(--text)' }}>
              드래그 & 드롭 또는 클릭하여 파일 선택
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {ALLOWED_EXTENSIONS.map((ext) => ext.replace('.', '').toUpperCase()).join(', ')} | 최대 {MAX_SIZE_MB}MB/파일 | 총 {MAX_TOTAL_SIZE_MB}MB 이하
            </p>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-brand mt-4">
              파일 선택
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span style={{ color: isWithinCount ? 'var(--success)' : 'var(--warning)' }}>
          {photos.length} / {minCount}~{maxCount}장
        </span>
        <span style={{ color: 'var(--muted)' }}>총 용량: {totalSizeMb.toFixed(1)}MB (권장: 최대 150MB)</span>
      </div>

      {(!isWithinCount || inFlightCount > 0 || failedCount > 0 || metaMissingCount > 0) && (
        <div className="text-xs space-y-1" style={{ color: 'var(--warning)' }}>
          {!isWithinCount && photos.length < minCount && <p>최소 {minCount}장의 사진이 필요합니다.</p>}
          {inFlightCount > 0 && <p>업로드 진행 중: {inFlightCount}건</p>}
          {failedCount > 0 && <p>업로드 실패: {failedCount}건 (재시도 필요)</p>}
          {metaMissingCount > 0 && <p>메타데이터 누락: {metaMissingCount}건</p>}
        </div>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-5 gap-4">
          {photos.map((photo) => {
            const badge = statusBadge[photo.status];
            const metaIncomplete =
              photo.status === 'uploaded' && (!photo.url || !photo.width || !photo.height || !photo.sizeKb);

            return (
              <div key={photo.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-white/5 border border-white/10">
                  <img src={photo.preview} alt="업로드 사진" className="w-full h-full object-cover" />
                </div>
                <div
                  className={`absolute top-2 left-2 px-2 py-1 text-[11px] rounded-full text-white ${badge.className}`}
                >
                  {badge.label}
                </div>
                {metaIncomplete && (
                  <div className="absolute top-2 right-2 px-2 py-1 text-[11px] rounded-full bg-red-600/80 text-white">
                    메타 누락
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2 text-xs text-white">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => movePhoto(photo.id, 'up')}
                      className="px-2 py-1 bg-white/20 rounded"
                      disabled={photos[0]?.id === photo.id}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      className="px-2 py-1 bg-red-500 rounded"
                    >
                      삭제
                    </button>
                    <button
                      type="button"
                      onClick={() => movePhoto(photo.id, 'down')}
                      className="px-2 py-1 bg-white/20 rounded"
                      disabled={photos[photos.length - 1]?.id === photo.id}
                    >
                      ↓
                    </button>
                  </div>
                  {photo.status === 'failed' && photo.file && (
                    <button
                      type="button"
                      onClick={() => retryUpload(photo)}
                      className="px-3 py-1 bg-yellow-500 rounded text-black"
                    >
                      재시도
                    </button>
                  )}
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 text-center">
                  {photo.sizeKb}KB
                  {photo.width && photo.height ? ` · ${photo.width}×${photo.height}` : null}
                </div>
                {photo.error && (
                  <div className="absolute bottom-2 left-2 right-2 text-[11px] text-red-300 text-center">
                    {photo.error}
                  </div>
                )}
                {photo.status === 'uploading' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                    <div style={{ width: `${photo.progress}%` }} className="h-full bg-blue-500 transition-all" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isDevMode && (
        <div className="text-xs rounded-md bg-white/5 border border-white/10 p-2" style={{ color: 'var(--muted)' }}>
          업로드 현황: uploaded {uploadedCount} / total {photos.length}, failed {failedCount}, in-flight {inFlightCount}
        </div>
      )}
    </div>
  );
}


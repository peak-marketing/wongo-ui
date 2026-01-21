import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../order/order.entity';
import { OrderStatus } from '../common/enums/order-status.enum';
import { OrderType } from '../common/enums/order-type.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateReceiptReviewOrderDto } from './dto/create-receipt-review-order.dto';
import { Asset } from '../assets/asset.entity';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_SIZE_KB = 10 * 1024; // 10MB

function isAllowedExtension(url: string): boolean {
  const lower = url.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const allowedDomains = process.env.ALLOWED_S3_DOMAINS?.split(',').filter(Boolean) || [];
    if (allowedDomains.length > 0) {
      return allowedDomains.some((domain) => parsed.hostname.includes(domain));
    }
    return true;
  } catch {
    return false;
  }
}

interface Place {
  id: string;
  agencyId: string;
  name: string;
  address?: string;
  mapLink?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Asset)
    private assetRepository: Repository<Asset>,
  ) {}

  async ensurePlace(agencyId: string, p: { name: string; address?: string; mapLink?: string }): Promise<Place> {
    // 임시로 place를 order에 직접 저장하는 방식
    // 실제로는 Place 엔티티를 별도로 만들거나 기존 구조 활용
    return {
      id: `${agencyId}-${p.name}`,
      agencyId,
      name: p.name,
      address: p.address,
      mapLink: p.mapLink,
    };
  }

  async createOrder(agencyId: string, placeId: string, dto: CreateOrderDto, unitPrice?: number) {
    // 검증: 검색 키워드 최소 1개
    if (!dto.guide?.searchKeywords || dto.guide.searchKeywords.length === 0) {
      const error = new BadRequestException('검색 키워드는 최소 1개 이상 필요합니다');
      console.error('[OrdersService.createOrder] BadRequestException:', error.message);
      throw error;
    }

    // 검증: 해시태그 최대 5개
    const hashtags = dto.guide.hashtags || [];
    if (hashtags.length > 5) {
      const error = new BadRequestException('해시태그는 최대 5개까지 가능합니다');
      console.error('[OrdersService.createOrder] BadRequestException:', error.message);
      throw error;
    }

    const photos = dto.photos || [];
    if (photos.some((url) => typeof url === 'string' && url.startsWith('blob:'))) {
      throw new BadRequestException('이미지를 업로드한 뒤 다시 접수해주세요');
    }

    // 사진 개수 검증 (임시 저장이 아닐 때만)
    if (!dto.saveAsDraft) {
      const photoLimits = dto.photoLimits || [5, 20];
      const [minPhotos, maxPhotos] = photoLimits;
      if (photos.length < minPhotos) {
        throw new BadRequestException(`사진은 최소 ${minPhotos}장이 필요합니다`);
      }
      if (photos.length > maxPhotos) {
        throw new BadRequestException(`사진은 최대 ${maxPhotos}장까지 업로드할 수 있습니다`);
      }
    }

    // 사진 URL 검증 (확장자, URL 유효성)
    photos.forEach((url) => {
      if (!isAllowedExtension(url)) {
        throw new BadRequestException(`허용되지 않은 파일 형식입니다. (${ALLOWED_EXTENSIONS.join(', ')}만 가능)`);
      }
      if (!isValidUrl(url)) {
        throw new BadRequestException('유효하지 않은 사진 URL입니다');
      }
    });

    if (dto.photoMetas && dto.photoMetas.length > 0) {
      if (dto.photoMetas.length !== photos.length) {
        throw new BadRequestException('사진 메타데이터 개수가 일치하지 않습니다');
      }

      dto.photoMetas.forEach((meta) => {
        if (!photos.includes(meta.url)) {
          throw new BadRequestException('사진 메타데이터에 등록되지 않은 URL이 포함되었습니다');
        }
        if (meta.sizeKb > MAX_SIZE_KB) {
          throw new BadRequestException('사진 크기는 10MB를 초과할 수 없습니다');
        }
        if (meta.sizeKb <= 0) {
          throw new BadRequestException('사진 크기 정보가 잘못되었습니다');
        }
        if (meta.width !== undefined && meta.width <= 0) {
          throw new BadRequestException('사진 가로 크기 정보가 잘못되었습니다');
        }
        if (meta.height !== undefined && meta.height <= 0) {
          throw new BadRequestException('사진 세로 크기 정보가 잘못되었습니다');
        }
      });
    }

    // 기본값 설정
    const targetChars = dto.targetChars || [1500, 2000];

    const flags = {
      link: !!dto.guide.link,
      map: !!dto.guide.map,
      hashtag: dto.guide.hashtag ?? true,
    };

    // 링크 포함 옵션이 켜진 경우: 플레이스 URL을 서버에서도 필수로 요구한다.
    // (URL이 없으면 생성 워커에서 hasLink=true but linkUrl empty로 실패하므로 사전 차단)
    const placeUrl = String(dto.place?.mapLink || '').trim();
    if (flags.link && !placeUrl) {
      throw new BadRequestException('링크 포함 옵션을 켠 경우 플레이스 URL을 입력해주세요');
    }
    if (flags.link && placeUrl && !/^https?:\/\//i.test(placeUrl)) {
      throw new BadRequestException('플레이스 URL은 http(s):// 로 시작해야 합니다');
    }

    // 접수 수량 확인 (편집 모드에서는 submitCount가 없을 수 있으므로 기본값 1)
    // submitCount가 undefined면 기본 1, 있으면 1~5 범위로 제한
    const submitCount = dto.submitCount !== undefined 
      ? Math.min(Math.max(dto.submitCount, 1), 5) 
      : 1;
    const saveAsDraft = dto.saveAsDraft === true;

    const normalizedUnitPrice =
      typeof unitPrice === 'number' && Number.isFinite(unitPrice) && unitPrice > 0 ? Math.trunc(unitPrice) : 0;

    // 기존 Order 엔티티 구조에 맞춰 변환
    const orders: Order[] = [];
    for (let i = 0; i < submitCount; i++) {
      const order = this.orderRepository.create({
        agencyId,
        status: saveAsDraft ? OrderStatus.DRAFT : OrderStatus.SUBMITTED,
        unitPrice: normalizedUnitPrice,
        placeName: dto.place.name,
      placeAddress: dto.place.address || '',
      placeUrl: String(dto.place?.mapLink || '').trim() || null,
      searchKeywords: dto.guide.searchKeywords.join(', '),
      guideContent: dto.guide.includeText || '',
      requiredKeywords: dto.guide.requiredKeywords || [],
      emphasisKeywords: dto.guide.emphasizeKeywords || [],
  hasLink: flags.link,
  hasMap: flags.map,
      hashtags: dto.guide.hashtags || [],
      referenceReviews: dto.referenceText || '',
        notes: dto.notes || '',
        photos: photos, // 사진 URL 배열
      });
      orders.push(order);
    }

    const created = await this.orderRepository.save(orders);

    // 사진 메타데이터를 Assets 테이블에 저장 (모든 주문에 동일하게)
    if (dto.photoMetas && dto.photoMetas.length > 0) {
      const allAssets: Asset[] = [];
      for (const order of created) {
        const assets = dto.photoMetas.map((meta) =>
          this.assetRepository.create({
            orderId: order.id,
            url: meta.url,
            width: meta.width,
            height: meta.height,
            sizeKb: meta.sizeKb,
          }),
        );
        allAssets.push(...assets);
      }
      if (allAssets.length > 0) {
        await this.assetRepository.save(allAssets);
      }
    }

    // 여러 건 생성 시 ID 배열 반환, 단일 건 시 단일 객체 반환
    if (submitCount > 1) {
      return { ids: created.map((o) => o.id), status: created[0].status, count: submitCount };
    }
    return { id: created[0].id, status: created[0].status };
  }

  async createReceiptReviewOrder(agencyId: string, dto: CreateReceiptReviewOrderDto, unitPrice?: number) {
    const placeName = String(dto.placeName || '').trim();
    if (!placeName) {
      throw new BadRequestException('업체명은 필수입니다');
    }

    const extraInstruction = String(dto.extraInstruction || '').trim();
    if (!extraInstruction) {
      throw new BadRequestException('추가 지시문은 필수입니다');
    }

    const mode = dto.mode === 'FIXED' ? 'FIXED' : 'RANDOM';
    const fixedChars = dto.fixedChars === undefined ? undefined : Math.trunc(Number(dto.fixedChars));
    if (mode === 'FIXED') {
      if (!Number.isFinite(Number(fixedChars)) || Number(fixedChars) < 10 || Number(fixedChars) > 299) {
        throw new BadRequestException('FIXED 모드에서는 글자수(10~299)를 입력해주세요');
      }
    }

    const outputCountRaw = dto.outputCount === undefined ? 1 : Math.trunc(Number(dto.outputCount));
    const outputCount: 1 | 5 | 10 = (outputCountRaw === 5 ? 5 : outputCountRaw === 10 ? 10 : 1);

    const menuName = String((dto as any)?.menuName || '').trim();

    const photoUrlRaw = String((dto as any)?.photoUrl || '').trim();
    if (photoUrlRaw && photoUrlRaw.startsWith('blob:')) {
      throw new BadRequestException('이미지를 업로드한 뒤 다시 접수해주세요');
    }
    if (photoUrlRaw) {
      if (!isAllowedExtension(photoUrlRaw)) {
        throw new BadRequestException(`허용되지 않은 파일 형식입니다. (${ALLOWED_EXTENSIONS.join(', ')}만 가능)`);
      }
      if (!isValidUrl(photoUrlRaw)) {
        throw new BadRequestException('유효하지 않은 사진 URL입니다');
      }
    }

    const requiredKeywords = Array.isArray(dto.requiredKeywords)
      ? dto.requiredKeywords
          .map((k) => String(k || '').trim())
          .filter((k) => k.length > 0)
          .slice(0, 20)
      : [];

    const emoji = dto.emoji === true;
    const qualityMode = dto.qualityMode === true;
    const saveAsDraft = dto.saveAsDraft === true;

    const normalizedUnitPrice =
      typeof unitPrice === 'number' && Number.isFinite(unitPrice) && unitPrice > 0 ? Math.trunc(unitPrice) : 0;

    const payload = {
      mode,
      fixedChars: mode === 'FIXED' ? fixedChars : null,
      menuName: menuName || null,
      photoUrl: photoUrlRaw || null,
      requiredKeywords,
      emoji,
      qualityMode,
      outputCount,
      extraInstruction,
    };

    const order = this.orderRepository.create({
      agencyId,
      status: saveAsDraft ? OrderStatus.DRAFT : OrderStatus.SUBMITTED,
      type: OrderType.RECEIPT_REVIEW,
      unitPrice: normalizedUnitPrice,
      placeName,
      placeAddress: '',
      searchKeywords: '',
      guideContent: '',
      requiredKeywords,
      emphasisKeywords: [],
      hasLink: false,
      hasMap: false,
      hashtags: [],
      referenceReviews: '',
      notes: String(dto.notes || '').trim() || '',
      photos: [],
      extraInstruction,
      payload,
    });

    const created = await this.orderRepository.save(order);
    return { id: created.id, status: created.status };
  }

  async updateOrder(agencyId: string, orderId: string, dto: CreateOrderDto) {
    // 기존 주문 찾기
    const order = await this.orderRepository.findOne({
      where: { id: orderId, agencyId },
    });

    if (!order) {
      throw new BadRequestException('주문을 찾을 수 없습니다');
    }

    // DRAFT 상태만 업데이트 가능
    if (order.status !== OrderStatus.DRAFT) {
      throw new BadRequestException('임시 저장 상태의 주문만 수정할 수 있습니다');
    }

    // 검증: 검색 키워드 최소 1개
    if (!dto.guide?.searchKeywords || dto.guide.searchKeywords.length === 0) {
      throw new BadRequestException('검색 키워드는 최소 1개 이상 필요합니다');
    }

    // 검증: 해시태그 최대 5개
    const hashtags = dto.guide.hashtags || [];
    if (hashtags.length > 5) {
      throw new BadRequestException('해시태그는 최대 5개까지 가능합니다');
    }

    const photos = dto.photos || [];
    if (photos.some((url) => typeof url === 'string' && url.startsWith('blob:'))) {
      throw new BadRequestException('이미지를 업로드한 뒤 다시 접수해주세요');
    }

    // 사진 개수 검증 (임시 저장이 아닐 때만)
    if (!dto.saveAsDraft) {
      const photoLimits = dto.photoLimits || [5, 20];
      const [minPhotos, maxPhotos] = photoLimits;
      if (photos.length < minPhotos) {
        throw new BadRequestException(`사진은 최소 ${minPhotos}장이 필요합니다`);
      }
      if (photos.length > maxPhotos) {
        throw new BadRequestException(`사진은 최대 ${maxPhotos}장까지 업로드할 수 있습니다`);
      }
    }

    // 사진 URL 검증 (확장자, URL 유효성)
    photos.forEach((url) => {
      if (!isAllowedExtension(url)) {
        throw new BadRequestException(`허용되지 않은 파일 형식입니다. (${ALLOWED_EXTENSIONS.join(', ')}만 가능)`);
      }
      if (!isValidUrl(url)) {
        throw new BadRequestException('유효하지 않은 사진 URL입니다');
      }
    });

    if (dto.photoMetas && dto.photoMetas.length > 0) {
      if (dto.photoMetas.length !== photos.length) {
        throw new BadRequestException('사진 메타데이터 개수가 일치하지 않습니다');
      }

      dto.photoMetas.forEach((meta) => {
        if (!photos.includes(meta.url)) {
          throw new BadRequestException('사진 메타데이터에 등록되지 않은 URL이 포함되었습니다');
        }
        if (meta.sizeKb > MAX_SIZE_KB) {
          throw new BadRequestException('사진 크기는 10MB를 초과할 수 없습니다');
        }
        if (meta.sizeKb <= 0) {
          throw new BadRequestException('사진 크기 정보가 잘못되었습니다');
        }
        if (meta.width !== undefined && meta.width <= 0) {
          throw new BadRequestException('사진 가로 크기 정보가 잘못되었습니다');
        }
        if (meta.height !== undefined && meta.height <= 0) {
          throw new BadRequestException('사진 세로 크기 정보가 잘못되었습니다');
        }
      });
    }

    const flags = {
      link: !!dto.guide.link,
      map: !!dto.guide.map,
      hashtag: dto.guide.hashtag ?? true,
    };

    const placeUrl = String(dto.place?.mapLink || '').trim();
    if (flags.link && !placeUrl) {
      throw new BadRequestException('링크 포함 옵션을 켠 경우 플레이스 URL을 입력해주세요');
    }
    if (flags.link && placeUrl && !/^https?:\/\//i.test(placeUrl)) {
      throw new BadRequestException('플레이스 URL은 http(s):// 로 시작해야 합니다');
    }

    const saveAsDraft = dto.saveAsDraft === true;

    // 주문 업데이트
    order.placeName = dto.place.name;
    order.placeAddress = dto.place.address || '';
    order.placeUrl = String(dto.place?.mapLink || '').trim() || null;
    order.searchKeywords = dto.guide.searchKeywords.join(', ');
    order.guideContent = dto.guide.includeText || '';
    order.requiredKeywords = dto.guide.requiredKeywords || [];
    order.emphasisKeywords = dto.guide.emphasizeKeywords || [];
    order.hasLink = flags.link;
    order.hasMap = flags.map;
    order.hashtags = hashtags;
    order.referenceReviews = dto.referenceText || '';
    order.notes = dto.notes || '';
    order.photos = photos;
    order.status = saveAsDraft ? OrderStatus.DRAFT : OrderStatus.SUBMITTED;

    const updated = await this.orderRepository.save(order);

    // 기존 Assets 삭제 후 새로 생성
    await this.assetRepository.delete({ orderId: orderId });

    if (dto.photoMetas && dto.photoMetas.length > 0) {
      const assets = dto.photoMetas.map((meta) =>
        this.assetRepository.create({
          orderId: orderId,
          url: meta.url,
          width: meta.width,
          height: meta.height,
          sizeKb: meta.sizeKb,
        }),
      );
      await this.assetRepository.save(assets);
    }

    return { id: updated.id, status: updated.status };
  }
}


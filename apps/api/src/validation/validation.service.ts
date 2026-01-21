import { Injectable } from '@nestjs/common';
import { Order } from '../order/order.entity';

export interface ValidationReport {
  characterCount: {
    value: number;
    valid: boolean;
    min: number;
    max: number;
  };
  hashtags: {
    count: number;
    valid: boolean;
    max: number;
  };
  requiredKeywords: {
    found: string[];
    missing: string[];
    valid: boolean;
  };
  emphasisKeywords: {
    found: string[];
    missing: string[];
    valid: boolean;
  };
  hasLink: {
    expected: boolean;
    found: boolean;
    valid: boolean;
  };
  hasMap: {
    expected: boolean;
    found: boolean;
    valid: boolean;
  };
  overall: boolean;
}

@Injectable()
export class ValidationService {
  private normalizeForKeywordMatch(input: string): string {
    return String(input || '')
      .replace(/\s+/g, '')
      .replace(/#/g, '')
      .trim();
  }

  private includesKeywordLoose(haystack: string, needle: string): boolean {
    const h = this.normalizeForKeywordMatch(haystack);
    const n = this.normalizeForKeywordMatch(needle);
    if (!n) return false;
    return h.includes(n);
  }

  validate(order: Order): ValidationReport {
    const manuscript = order.manuscript || '';
    const charCount = manuscript.length;
    const hashtagMatches = manuscript.match(/#[\w가-힣]+/g) || [];
    const hashtagCount = hashtagMatches.length;

    // Extract hashtags from text
    const foundHashtags = hashtagMatches.map(h => h.substring(1));

    // Check for required keywords
    const requiredKeywords = order.requiredKeywords || [];
    const foundRequired = requiredKeywords.filter((keyword) => this.includesKeywordLoose(manuscript, keyword));
    const missingRequired = requiredKeywords.filter((keyword) => !this.includesKeywordLoose(manuscript, keyword));

    // Check for emphasis keywords
    const emphasisKeywords = order.emphasisKeywords || [];
    const foundEmphasis = emphasisKeywords.filter((keyword) => this.includesKeywordLoose(manuscript, keyword));
    const missingEmphasis = emphasisKeywords.filter((keyword) => !this.includesKeywordLoose(manuscript, keyword));

    // Check for links
    const hasLinkInText = /https?:\/\/[^\s]+/.test(manuscript);
    
    // Check for map indicators
    // - 서버가 (주소) 형태로 append 하는 케이스가 많아서, "지도/주소" 같은 키워드가 없어도 주소 문자열이 있으면 found 처리
    const addr = String(order.placeAddress || '').trim();
    const hasMapKeyword = /지도|위치|주소|map|location/i.test(manuscript);
    const hasAddressLiteral = !!addr && manuscript.includes(addr);
    const hasAddressLikeParen = /\([^\n)]*(서울|경기|인천|부산|대구|대전|광주|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[^\n)]*(구|군|시|로|길|번지)[^\n)]*\)/.test(
      manuscript,
    );
    const hasMapInText = hasMapKeyword || hasAddressLiteral || hasAddressLikeParen;

    const report: ValidationReport = {
      characterCount: {
        value: charCount,
        valid: charCount >= 1500 && charCount <= 2500,
        min: 1500,
        max: 2500,
      },
      hashtags: {
        count: hashtagCount,
        valid: hashtagCount <= 5,
        max: 5,
      },
      requiredKeywords: {
        found: foundRequired,
        missing: missingRequired,
        valid: missingRequired.length === 0,
      },
      emphasisKeywords: {
        found: foundEmphasis,
        missing: missingEmphasis,
        valid: missingEmphasis.length === 0,
      },
      hasLink: {
        expected: order.hasLink || false,
        found: hasLinkInText,
        valid: !order.hasLink || hasLinkInText,
      },
      hasMap: {
        expected: order.hasMap || false,
        found: hasMapInText,
        valid: !order.hasMap || hasMapInText,
      },
      overall: false,
    };

    report.overall =
      report.characterCount.valid &&
      report.hashtags.valid &&
      report.requiredKeywords.valid &&
      report.hasLink.valid &&
      report.hasMap.valid;

    return report;
  }
}



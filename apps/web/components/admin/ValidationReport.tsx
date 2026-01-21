'use client';

import React from 'react';

type Flag = { required: boolean; found: boolean };

type FlagsReport = { link: Flag; map: Flag; hashtag: Flag };

interface ValidationReportData {
  charCountValid: boolean;
  charCount?: number;
  hashtagCountValid: boolean;
  hashtags?: string[];
  missingKeywords?: string[];
  flagsReport: FlagsReport;
}

export default function ValidationReport({ report }: { report: ValidationReportData | null }) {
  if (!report)
    return (
      <div className="text-sm" style={{ color: 'var(--muted)' }}>
        검수 리포트가 없습니다.
      </div>
    );

  const Item = ({
    ok,
    label,
    detail,
  }: {
    ok: boolean;
    label: string;
    detail?: React.ReactNode;
  }) => (
    <div
      className={`rounded border border-white/10 p-3 ${ok ? 'text-emerald-300' : 'text-rose-300'}`}
      style={{ background: 'var(--bg2)' }}
    >
      <div className="font-medium">
        {label} {ok ? '✅' : '❌'}
      </div>
      {detail && (
        <div className="text-sm mt-1" style={{ color: 'var(--text)' }}>
          {detail}
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-3">
      <Item
        ok={report.charCountValid}
        label="글자수 1,500~2,500자"
        detail={<span>현재 {report.charCount ?? '-'}자</span>}
      />
      <Item
        ok={report.hashtagCountValid}
        label="해시태그 ≤ 5"
        detail={<span>{(report.hashtags ?? []).join(' ')}</span>}
      />
      <Item
        ok={(report.missingKeywords ?? []).length === 0}
        label="가이드 키워드/필수·강조 포함"
        detail={
          report.missingKeywords && report.missingKeywords.length > 0 ? (
            <div>누락: {report.missingKeywords.join(', ')}</div>
          ) : undefined
        }
      />
      <Item
        ok={
          report.flagsReport.link.found === report.flagsReport.link.required &&
          report.flagsReport.map.found === report.flagsReport.map.required
        }
        label="링크·지도 플래그 일치"
        detail={
          <div className="space-y-1">
            <div>
              링크: {report.flagsReport.link.required ? '필수' : '선택'} →{' '}
              {report.flagsReport.link.found ? '충족' : '미충족'}
            </div>
            <div>
              지도: {report.flagsReport.map.required ? '필수' : '선택'} →{' '}
              {report.flagsReport.map.found ? '충족' : '미충족'}
            </div>
          </div>
        }
      />
    </div>
  );
}



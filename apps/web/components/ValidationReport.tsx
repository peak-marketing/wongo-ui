'use client';

import { ValidationReport as ValidationReportType } from '@/lib/types';

interface ValidationReportProps {
  report: ValidationReportType;
}

export default function ValidationReport({ report }: ValidationReportProps) {
  return (
    <div className="border rounded-lg p-6 bg-white">
      <h3 className="text-lg font-semibold mb-4">검수 리포트</h3>
      
      <div className="space-y-4">
        <div className={`p-4 rounded ${report.characterCount.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex justify-between items-center">
            <span className="font-medium">글자수</span>
            <span className={report.characterCount.valid ? 'text-green-700' : 'text-red-700'}>
              {report.characterCount.value}자 ({report.characterCount.min}-{report.characterCount.max}자)
            </span>
          </div>
          {!report.characterCount.valid && (
            <p className="text-sm text-red-600 mt-1">글자수가 범위를 벗어났습니다.</p>
          )}
        </div>

        <div className={`p-4 rounded ${report.hashtags.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex justify-between items-center">
            <span className="font-medium">해시태그</span>
            <span className={report.hashtags.valid ? 'text-green-700' : 'text-red-700'}>
              {report.hashtags.count}개 (최대 {report.hashtags.max}개)
            </span>
          </div>
          {!report.hashtags.valid && (
            <p className="text-sm text-red-600 mt-1">해시태그가 {report.hashtags.max}개를 초과했습니다.</p>
          )}
        </div>

        <div className={`p-4 rounded ${report.requiredKeywords.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium">필수 키워드</span>
            <span className={report.requiredKeywords.valid ? 'text-green-700' : 'text-red-700'}>
              {report.requiredKeywords.found.length} / {report.requiredKeywords.found.length + report.requiredKeywords.missing.length}
            </span>
          </div>
          {report.requiredKeywords.missing.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-red-600 font-medium">누락된 키워드:</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {report.requiredKeywords.missing.map((keyword, idx) => (
                  <span key={idx} className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
          {report.requiredKeywords.found.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-green-600 font-medium">포함된 키워드:</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {report.requiredKeywords.found.map((keyword, idx) => (
                  <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={`p-4 rounded ${report.emphasisKeywords.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium">강조 키워드</span>
            <span className={report.emphasisKeywords.valid ? 'text-green-700' : 'text-red-700'}>
              {report.emphasisKeywords.found.length} / {report.emphasisKeywords.found.length + report.emphasisKeywords.missing.length}
            </span>
          </div>
          {report.emphasisKeywords.missing.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-red-600 font-medium">누락된 키워드:</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {report.emphasisKeywords.missing.map((keyword, idx) => (
                  <span key={idx} className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={`p-4 rounded ${report.hasLink.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex justify-between items-center">
            <span className="font-medium">링크 포함</span>
            <span className={report.hasLink.valid ? 'text-green-700' : 'text-red-700'}>
              {report.hasLink.found ? '포함됨' : '미포함'} (요구: {report.hasLink.expected ? '예' : '아니오'})
            </span>
          </div>
          {!report.hasLink.valid && (
            <p className="text-sm text-red-600 mt-1">링크 포함 여부가 요구사항과 일치하지 않습니다.</p>
          )}
        </div>

        <div className={`p-4 rounded ${report.hasMap.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex justify-between items-center">
            <span className="font-medium">지도 포함</span>
            <span className={report.hasMap.valid ? 'text-green-700' : 'text-red-700'}>
              {report.hasMap.found ? '포함됨' : '미포함'} (요구: {report.hasMap.expected ? '예' : '아니오'})
            </span>
          </div>
          {!report.hasMap.valid && (
            <p className="text-sm text-red-600 mt-1">지도 포함 여부가 요구사항과 일치하지 않습니다.</p>
          )}
        </div>

        <div className={`p-4 rounded ${report.overall ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500'}`}>
          <div className="flex justify-between items-center">
            <span className="font-bold text-lg">전체 검수 결과</span>
            <span className={`font-bold text-lg ${report.overall ? 'text-green-700' : 'text-red-700'}`}>
              {report.overall ? '✅ 통과' : '❌ 실패'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}






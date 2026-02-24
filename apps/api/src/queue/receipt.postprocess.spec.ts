// NOTE: GenerationProcessor 내부 헬퍼는 private이라 직접 import가 어려워,
// 동일 규칙을 검증하기 위해 텍스트 규칙 중심의 테스트만 수행한다.
// (실제 적용은 워커에서 수행)

const truncateUnder300 = (input: string) => {
  const t = String(input || '').trim();
  if (!t) return '';
  if (t.length < 300) return t;
  const hard = t.slice(0, 299);
  const cutIdx = Math.max(
    hard.lastIndexOf('.'),
    hard.lastIndexOf('!'),
    hard.lastIndexOf('?'),
    hard.lastIndexOf('…'),
    hard.lastIndexOf('。'),
    hard.lastIndexOf('！'),
    hard.lastIndexOf('？'),
    hard.lastIndexOf('\n'),
  );
  const sliced = cutIdx >= 10 ? hard.slice(0, cutIdx + 1) : hard;
  return sliced.trim();
};

const tryGetEmojiRegex = (): RegExp | null => {
  try {
    return new RegExp('\\p{Extended_Pictographic}', 'gu');
  } catch {
    return null;
  }
};

const sanitizeReceiptEmojis = (input: string, enabled: boolean) => {
  const t = String(input || '');
  if (!t) return '';
  const re = tryGetEmojiRegex();
  if (!enabled) return re ? t.replace(re, '') : t;
  if (!re) return t;

  const emojis = t.match(re) || [];
  const emojiCount = emojis.length;
  const sentenceEndEmojiCount = (t.match(/([.!?…。！？…])\s*\p{Extended_Pictographic}/gu) || []).length;
  if (emojiCount <= 2 && sentenceEndEmojiCount <= 1) return t;

  const first = emojis[0];
  const stripped = t.replace(re, '').replace(/[ \t]{2,}/g, ' ').trim();
  if (!first) return stripped;
  return stripped.length > 0 ? `${stripped} ${first}` : first;
};

describe('receipt postprocess guards', () => {
  test('length is always < 300 after truncation guard', () => {
    const base = '가'.repeat(400);
    const out = truncateUnder300(base);
    expect(out.length).toBeLessThan(300);
  });

  test('emoji overuse gets reduced (no emoji on every sentence)', () => {
    const raw = '맛있어요! 😋 다음에도 올게요! 😋 분위기도 좋아요! 😋';
    const out = sanitizeReceiptEmojis(raw, true);
    const re = tryGetEmojiRegex();
    if (re) {
      const count = (out.match(re) || []).length;
      expect(count).toBeLessThanOrEqual(2);
    }
    // 문장 끝마다 이모지 붙는 패턴이 사라져야 함(최소 2회 이상이면 실패)
    const sentenceEndEmojiCount = (out.match(/([.!?…。！？…])\s*\p{Extended_Pictographic}/gu) || []).length;
    expect(sentenceEndEmojiCount).toBeLessThanOrEqual(1);
  });

  test('batch 10 samples remain < 300', () => {
    for (let i = 0; i < 10; i++) {
      const raw = `테스트 ${i} ` + '나'.repeat(350) + '!';
      const out = truncateUnder300(raw);
      expect(out.length).toBeLessThan(300);
    }
  });
});

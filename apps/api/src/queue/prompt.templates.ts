export interface CaptionItem {
  index: number; // 1..N
  caption: string;
  tags: string[]; // 3~6 tags (매칭용)
  ocr: string[]; // 사진에서 읽힌 글자(있으면)
}

function personaStyleGuidelines(personaId?: string): string[] {
  const raw = String(personaId || '').trim();
  const parts = raw.split('-');
  const age = parts.length === 4 ? parts[0] : '';
  const gender = parts.length === 4 ? parts[1] : '';
  const personality = parts.length === 4 ? parts[2] : '';
  const tone = parts.length === 4 ? parts[3] : '';

  // 기본값: 너무 중립적으로 평준화되지 않게 최소한의 스타일 지시를 넣는다.
  const base: string[] = [
    '- 문체는 페르소나에 따라 체감될 정도로 달라야 한다(다른 주문과 톤이 똑같아 보이면 실패).',
    '- 단, 출력 계약/절대 규칙/절대 금지 사항이 페르소나보다 우선이다.',
  ];

  // 공통 가이드: 페르소나 차이를 강제로 벌리기 위한 기준
  const widenDiff: string[] = [
    '- (중요) 페르소나가 밝으면 문장 리듬/어휘 강도/리액션이 분명히 밝아야 한다.',
    '- (중요) 페르소나가 차분/중립이면 과한 감탄/강조 부사는 의도적으로 줄여야 한다.',
    '- 문장 길이/호흡도 페르소나에 맞게 조절한다(짧게/길게가 섞이지 않게).',
    '- (중요) 독자가 한 번에 이해할 수 있게 쉬운 단어/짧은 문장으로 쓴다(불필요한 수식어 남발 금지).',
    '- (중요) 같은 표현/문장 패턴을 반복하지 말고, 페르소나에 맞게 표현을 적극적으로 변주한다.',
  ];

  const ageHints: string[] = (() => {
    const a = Number(age);
    if (!Number.isFinite(a)) return [];
    if (a <= 20)
      return [
        '- 문장 호흡: 비교적 짧고 빠르게(경쾌한 리듬).',
        '- 표현: 너무 무겁지 않게, 공감/리액션이 자연스럽게 느껴지게(과한 유행어 남발 금지).',
      ];
    if (a >= 50)
      return [
        '- 문장 호흡: 너무 튀지 않게, 안정적이고 정돈된 리듬.',
        '- 표현: 예의 있는 추천/안내 톤을 유지하되 딱딱하지 않게.',
      ];
    return ['- 문장 호흡: 너무 과하지 않게, 자연스럽고 균형 있게.'];
  })();

  // 성별은 톤을 직접 지시하지 않고, 말투의 "결"만 미세하게 반영하도록 제한
  const genderHint: string[] = (() => {
    if (gender === 'F') return ['- 말투 결: 부드럽고 공감형 표현을 약간 더 섞어도 된다(과장 금지).'];
    if (gender === 'M') return ['- 말투 결: 담백하고 단정한 표현을 약간 더 섞어도 된다(무뚝뚝 금지).'];
    return [];
  })();

  const friendlyHint: string[] =
    personality === 'FRIENDLY'
      ? [
          '- FRIENDLY: 친구에게 후기 들려주듯 자연스럽게 말한다(너무 꾸미지 않기).',
          '- FRIENDLY: 공감/리액션 문장(예: "저는 이런 점이 좋았어요")을 1~2번 섞어도 된다.',
        ]
      : [];

  const trendyHint: string[] =
    personality === 'TRENDY'
      ? [
          '- TRENDY: 표현은 센스 있게(분위기/무드/포인트/핫플 등), 다만 과한 유행어는 남발하지 않는다.',
          '- TRENDY: 짧은 문장 + 핵심 포인트를 빠르게 찍는 리듬으로 쓴다.',
        ]
      : [];

  const allowLightReaction = personality === 'FRIENDLY' || personality === 'TRENDY' || tone === 'BRIGHT';
  const isBright = tone === 'BRIGHT';
  const isWarm = tone === 'WARM';
  const isNeutral = tone === 'NEUTRAL';

  if (personality === 'PROFESSIONAL') {
    return [
      ...base,
      ...widenDiff,
      ...ageHints,
      ...genderHint,
      '- 문체: 합니다체/설명체를 유지한다(과한 감탄/유행어/웃음표현 금지).',
      '- 어휘: "진짜/완전/대박" 같은 과한 강화 부사는 피한다.',
      '- 구조: 관찰 → 근거(사진/정보) → 결론(추천/팁) 흐름으로 정돈한다.',
      '- 리액션: "ㅎㅎ" 같은 웃음 표현은 사용하지 않는다.',
    ];
  }

  if (tone === 'NEUTRAL' && personality === 'CALM') {
    return [
      ...base,
      ...widenDiff,
      ...ageHints,
      ...genderHint,
      '- 문체: 차분한 해요체 또는 설명체로 정돈한다.',
      '- 어휘: 강조 부사("진짜/너무/완전") 사용을 최대한 줄이고 담백하게 쓴다.',
      '- 리액션: 감탄(!)은 최소화하고, "ㅎㅎ" 같은 웃음 표현은 사용하지 않는다.',
    ];
  }

  if (allowLightReaction) {
    return [
      ...base,
      ...widenDiff,
      ...ageHints,
      ...genderHint,
      ...friendlyHint,
      ...trendyHint,
      '- 문체: 친근한 해요체를 기본으로 한다(예: "~해요.", "~했어요.").',
      isBright
        ? '- 밝은 톤: 긍정/리액션이 느껴지게 쓴다. 감탄(!)은 총 2~5회까지는 허용(!!! 금지).'
        : '- 리액션: 자연스러운 감탄(!)을 가끔 사용해도 된다.',
      isBright
        ? '- 밝은 톤: 강화 부사("진짜/너무/완전/대박" 중 1~2개)을 총 1~3회만 자연스럽게 사용해도 된다(남발 금지).'
        : '',
      personality === 'TRENDY'
        ? '- TRENDY: 줄임말/유행어는 최대 0~2회만(없어도 됨). 너무 과하면 금지.'
        : '',
      isBright
        ? '- 리액션: "ㅎㅎ" 같은 웃음 표현은 1~3회까지는 허용(연속 사용 "ㅎㅎㅎㅎ" 금지).'
        : '- 리액션: "ㅎㅎ" 같은 웃음 표현은 0~1회만(필수 아님). 연속 사용 "ㅎㅎㅎㅎ" 금지.',
      isBright
        ? '- 이모지(emoji): 1~2개는 자연스럽게 사용해도 된다(문장 끝마다 반복 금지, 전체 합계 1~2개).'
        : '- 이모지/이모티콘은 가급적 사용하지 않는다.',
      isBright
        ? '- 밝은 톤(가독성): 긴 문장 1개로 끝내지 말고, 핵심 포인트를 2~4문장으로 나눠서 또렷하게 전달한다.'
        : '- 가독성: 한 문장에 정보가 몰리지 않게, 핵심을 짧게 끊어 쓴다.',
      '- 과도한 기호 반복(!!!, ??)이나 이모지/이모티콘 남발은 금지.',
    ];
  }

  // 그 외(예: CALM-WARM)
  return [
    ...base,
    ...widenDiff,
    ...ageHints,
    ...genderHint,
    isWarm
      ? '- 문체: 따뜻하고 배려하는 해요체(공감/배려 표현을 1~2번 자연스럽게 포함).'
      : '- 문체: 따뜻하고 정돈된 해요체로 쓴다.',
    isNeutral ? '- 어휘: 담백하게, 평가/감탄을 절제한다.' : '',
    '- 리액션: 감탄(!)은 과하지 않게, "ㅎㅎ" 같은 웃음 표현은 사용하지 않는다.',
  ];
}

function safeJoin(lines: Array<string | undefined | null>): string {
  return lines.filter((l): l is string => typeof l === 'string' && l.length > 0).join('\n');
}

export function buildCaptionPrompt(args: {
  placeName: string;
  placeAddress?: string;
  searchKeywords?: string;
  guideContent?: string;
  referenceReviews?: string;
  notes?: string;
  personaId?: string;
  personaSnapshot: string;
  photoIndex: number; // 1..N
}): string {
  return safeJoin([
    '너는 한국어 원고 작성을 돕는 어시스턴트다.',
    '아래에 제공되는 단일 사진(이미지)을 보고, 해당 사진을 대표하는 캡션과 매칭용 태그를 만들어라.',
    '중요: 실제 사진에 보이는 내용만 근거로 작성한다(환각/상상 금지).',
    '중요: 사람/직원/손님/인물 언급은 사진에서 인물이 명확히 보일 때만 허용한다. 애매하면 인물 언급 금지.',
    '',
    '[주문 정보]',
    `업체/장소명: ${args.placeName}`,
    `주소: ${args.placeAddress ?? ''}`,
    `검색 키워드: ${args.searchKeywords ?? ''}`,
    `가이드: ${args.guideContent ?? ''}`,
    `참고 리뷰: ${args.referenceReviews ?? ''}`,
    `비고: ${args.notes ?? ''}`,
    '',
    '[페르소나]',
    ...(args.personaId ? [`personaId: ${args.personaId}`] : []),
    ...personaStyleGuidelines(args.personaId),
    args.personaSnapshot || '',
    '',
    `[대상 사진] 사진 ${args.photoIndex}`,
    '',
    '[출력 형식 - 반드시 JSON만 출력]',
    '아래 형식의 단일 JSON 객체만 출력한다. 코드블록/설명/마크다운 금지.',
    'index는 반드시 요청된 사진 번호 그대로 넣어라.',
    'caption은 1~2문장 한국어로, 사진에서 확인 가능한 요소만 근거로 구체적으로 쓴다.',
    'tags는 사진 매칭용이라서 3~6개를 추천한다. 짧은 명사 위주로, 가능하면 무공백(띄어쓰기 최소)으로 작성한다.',
    'tags는 사진에서 실제로 보이는 오브젝트/공간 단서/텍스트 단서만 사용한다(추상 단어만 금지: "좋음", "예쁨" 등).',
    'ocr은 사진에서 읽힌 텍스트가 있으면 배열로 넣고, 없으면 빈 배열로 둔다.',
    '',
    '예시:',
    '{"index":1,"caption":"...","tags":["외관","간판","입구"],"ocr":["..." ]}',
  ]);
}

export function buildManuscriptPrompt(args: {
  placeName: string;
  placeAddress?: string;
  searchKeywords?: string;
  guideContent?: string;
  requiredKeywords: string[];
  emphasisKeywords: string[];
  hashtags: string[];
  referenceReviews?: string;
  notes?: string;
  personaId?: string;
  personaSnapshot: string;
  revisionReason?: string;
  extraInstruction?: string;
  photoLabels: string[];
  captions: CaptionItem[];
  linkUrl?: string;
  hasLink?: boolean;
  hasMap?: boolean;
}): string {
  const photoCount = args.photoLabels.length;
  const captionsForManuscript = (args.captions || []).map((c) => ({
    index: c.index,
    caption: c.caption,
    tags: Array.isArray(c.tags) ? c.tags : [],
    ocr: Array.isArray(c.ocr) ? c.ocr : [],
  }));
  const captionsJson = JSON.stringify(captionsForManuscript, null, 2);

  return safeJoin([
    '너는 한국어 원고 작성자다. 아래 정보를 바탕으로 원고를 작성해라.',
    '출력은 텍스트만(불필요한 메타 설명/마크다운 코드블록 금지).',
    '',
    '[절대 규칙(고정) - 아래 규칙은 가이드와 무관하게 항상 적용된다]',
    '- "사진 N"은 반드시 단독 라인으로 출력한다. (예: "사진 1" 다음 줄부터 본문 시작)',
    '- "사진 1도심한복판"처럼 헤더에 텍스트를 붙이지 마라. 반드시 "사진 1" 다음 줄에 본문을 쓴다.',
    '- 본문은 문장 단위로 줄바꿈한다. 특히 문장 끝이 "요." / "습니다." / "니다." / "다." 또는 문장부호(. ! ?)로 끝나면 바로 줄바꿈한다.',
    '- 사진 블록과 블록 사이는 빈 줄 1줄(\n\n)로만 구분한다(0줄/2줄 이상 금지).',
    '- 해시태그 라인은 반드시 마지막 줄 1개이며, 그 뒤에 어떤 텍스트도 출력하지 않는다.',
    '- 지도/링크는 원고 본문에 직접 쓰지 않는다(서버가 최종 append). 단, 서버가 붙이는 지도 URL 라인은 반드시 "지도 삽입 : {URL}" 형식이다.',
    '- 제목/본문/해시태그 어디에도 큰따옴표(")를 사용하지 않는다. 특히 ""단어""처럼 따옴표로 감싸 강조하는 표현은 절대 금지다.',
    '- 특정 단어를 강조해야 하면 따옴표/특수문자(**, __, ~~ 등) 없이 그대로 자연스럽게 포함한다.',
    '',
    '[절대 금지]',
    '- 업로드 파일명(label), 업로드 URL(/uploads/...), 외부 URL(http/https)을 원고에 절대 쓰지 말 것.',
    '- 지도/주소/URL/링크/플레이스주소 문구를 원고에 절대 쓰지 말 것(서버가 최종 조립 단계에서 추가한다).',
    '- ""단어"" / "단어" 같은 따옴표 강조(quote emphasis)는 절대 쓰지 말 것.',
    '',
    '[출력 계약(Contract) - 절대 준수]',
    `1) 1번째 줄: 제목: {${args.placeName} 포함, 25~40자}`, 
    '2) 2번째 줄: 빈 줄',
    `3) 3번째 줄부터: 사진 1부터 사진 ${photoCount}까지, 반드시 순서대로 블록을 작성`,
    '   - 각 블록은 반드시 아래 형식을 지킨다(줄바꿈 규칙 중요):',
    '     a) 첫 줄: "사진 N" (숫자만 바뀜, 이 줄에는 다른 텍스트 금지)',
    '     b) 다음 줄부터: 해당 사진에 대한 본문(여러 줄 가능)',
    '     c) 본문은 문장 단위로 줄바꿈해서 출력한다(특히 "요.", "습니다.", "니다.", "다."로 끝나면 줄바꿈).',
    '     d) 다음 사진으로 넘어갈 때는 빈 줄 1줄을 넣는다.',
    '4) 마지막 줄: 해시태그: #... #... (최소 1개, 최대 5개, 한 줄만)',
    '',
    '[사진-본문 매칭 강제 규칙]',
    '- 아래 캡션 JSON의 각 사진 항목에 tags(3~6개)가 있다.',
    '- 각 사진 문단(사진 i)에는 해당 사진 tags 중 최소 2개를 반드시 포함한다(환각/상상 금지, 사진 근거 기반).',
    '- 인물/직원/손님/아이/연인 등 사람 관련 서술은 tags나 caption/ocr에서 인물 존재가 명확한 경우에만 허용한다. 애매하면 절대 언급하지 마라.',
    '',
    '[본문 작성 규칙]',
    '- 사진 표기는 반드시 "사진 1", "사진 2" … 형식만 사용한다(띄어쓰기 필수: "사진1" 금지).',
    `- 사진 순서는 1→${photoCount} 고정(역순/점프/누락 금지).`,
    '- 본문 중간에 다른 사진 번호(예: 사진 2, 사진 3 등)를 임의로 다시 쓰지 말 것(블록 헤더 줄만 허용).',
    '- 필수 키워드/강조 키워드는 원문 그대로 본문(body)에 최소 1회 이상 포함한다.',
    '- 본문(body) 글자수는 1500~2300자 범위를 맞춘다(제목/해시태그 제외).',
    '',
    '[해시태그 생성 규칙]',
    '- 입력 해시태그가 있으면 반드시 포함한다.',
    '- 해시태그는 과다 생성하지 않는다. 입력 해시태그를 우선 사용하며, 총 1~5개 범위로만 맞춘다.',
    '- 해시태그는 반드시 마지막 줄 한 줄에만 출력한다.',
    '',
    '[주문 정보]',
    `업체/장소명: ${args.placeName}`,
    `주소: ${args.placeAddress ?? ''}`,
    `검색 키워드: ${args.searchKeywords ?? ''}`,
    `가이드: ${args.guideContent ?? ''}`,
    `필수 키워드: ${(args.requiredKeywords || []).join(', ')}`,
    `강조 키워드: ${(args.emphasisKeywords || []).join(', ')}`,
    `입력 해시태그: ${(args.hashtags || []).map((t) => String(t)).join(', ')}`,
    `참고 리뷰: ${args.referenceReviews ?? ''}`,
    `비고: ${args.notes ?? ''}`,
    '',
    '[페르소나(말투/문체) - 반드시 강하게 반영]',
    ...(args.personaId ? [`personaId: ${args.personaId}`] : []),
    ...personaStyleGuidelines(args.personaId),
    args.personaSnapshot || '',
    '',
    args.revisionReason ? '[수정요청 사유]\n' + String(args.revisionReason) : '',
    args.extraInstruction ? '[추가 지시사항]\n' + String(args.extraInstruction) : '',
    '',
    '[사진 캡션 JSON - 순서 고정]',
    captionsJson,
    '',
    '[출력 예시(형식 참고용, 내용은 실제 정보로 작성)]',
    '제목: {placeName 포함 25~40자}',
    '',
    '사진 1',
    '첫 문장입니다.',
    '둘째 문장입니다.',
    '',
    '사진 2',
    '첫 문장입니다.',
    '둘째 문장입니다.',
    '...',
    `사진 ${photoCount}`,
    '첫 문장입니다.',
    '해시태그: #... #... #... #... #... #... #... #...',
  ]);
}

export function buildReceiptReviewPrompt(args: {
  placeName: string;
  menuName?: string;
  photoProvided?: boolean;
  requiredKeywords: string[];
  mode: 'FIXED' | 'RANDOM';
  targetChars: number; // 이미 FIXED/RANDOM 처리된 단일 목표 글자수
  emoji: boolean;
  outputIndex: number; // 1..N
  outputCount: number;
  personaId?: string;
  personaSnapshot: string;
  extraInstruction: string; // 필수
}): string {
  const keywords = Array.isArray(args.requiredKeywords) ? args.requiredKeywords.filter(Boolean) : [];
  const target = Math.max(10, Math.min(299, Math.trunc(Number(args.targetChars) || 80)));
  const menuName = String(args.menuName || '').trim();
  const emojiRule = args.emoji
    ? safeJoin([
        '- 이모지(emoji)는 선택적으로, 꼭 필요할 때만 사용한다(억지 삽입 금지).',
        '- 이모지 총 개수: 0~2개만 허용(기본 0~1개, 남성/전문/중립 톤일수록 0~1개로 더 보수적으로).',
        '- 금지: 모든 문장/문장 끝마다 이모지를 붙이는 행위.',
      ])
    : '- 이모지(emoji)는 사용하지 않는다.';

  return safeJoin([
    '너는 한국어로 짧고 자연스러운 영수증 리뷰(후기) 문장을 쓰는 작성자다.',
    '출력은 텍스트만(설명/메타/마크다운/코드블록/JSON 금지).',
    args.photoProvided ? '- 참고: 영수증 사진이 1장 제공됩니다. 사진에서 확인되는 정보만 참고하고, 확인 불가능한 정보는 추측하지 마세요.' : '',
    '',
    '[절대 규칙]',
    '- 따옴표("“” 포함)로 단어를 강조하지 않는다. 따옴표 문자는 출력에서 사용하지 않는다.',
    '- 과장된 광고 문구/과도한 반복/기호 반복(!!!, ???) 금지.',
    '- 실제 영수증 후기처럼 짧고 일상적인 톤으로 쓴다(네이버 플레이스 후기 스타일).',
    '- 문장 단위로 줄바꿈한다(특히 "요", "습니다", "니다", "다" 종결 포함).',
    '- 빈 줄(연속 개행)은 만들지 않는다.',
    '',
    '[길이 규칙]',
    '- (중요) 한국어 글자수 기준(공백 포함) 결과는 반드시 300자 미만이어야 한다.',
    args.mode === 'FIXED'
      ? `- 목표 글자수(공백 포함): 반드시 정확히 ${target}자여야 한다(± 허용 없음).`
      : `- 목표 글자수(공백 포함): ${target}자 전후로 맞춘다(최소 ${Math.max(10, target - 15)}자 ~ 최대 ${Math.min(299, target + 15)}자 범위).`,
    `- 모드: ${args.mode}`,
    '',
    '[메뉴 규칙]',
    menuName ? `- 메뉴명: ${menuName}` : '- 메뉴명: (없음)',
    '- 메뉴명이 있으면 본문에 자연스럽게 1회만 언급한다(반복 금지).',
    '- 메뉴명이 없으면 메뉴 언급 없이 작성한다.',
    '',
    '[키워드 규칙]',
    '- 아래 필수 키워드를 원문 그대로 자연스럽게 포함한다.',
    '- 각 키워드는 1~2회만 등장하도록 한다(너무 많이 반복 금지).',
    keywords.length > 0 ? `- 필수 키워드: ${keywords.join(', ')}` : '- 필수 키워드: (없음)',
    '',
    '[이모지 규칙]',
    emojiRule,
    '',
    '[주문 정보]',
    `업체명: ${args.placeName}`,
    '',
    '[페르소나(말투/문체) - 반드시 강하게 반영]',
    ...(args.personaId ? [`personaId: ${args.personaId}`] : []),
    ...personaStyleGuidelines(args.personaId),
    args.personaSnapshot || '',
    '',
    '[추가 지시문(필수)]',
    String(args.extraInstruction || ''),
    '',
    '[다중 출력 지시]',
    `- 너는 총 ${args.outputCount}개 중 ${args.outputIndex}번째 후기를 작성한다.`,
    '- 다른 번호의 후기와 문장 구성/표현/리듬이 겹치지 않게 변주한다.',
    '',
    '[출력]',
    '- 한 개의 후기만 출력한다. 번호/목록/구분선/추가 텍스트를 붙이지 않는다.',
  ]);
}

export function buildCorrectionPrompt(args: {
  failures: string[];
  original: string;
  photoLabels: string[];
  captions: CaptionItem[];
  requiredKeywords: string[];
  emphasisKeywords: string[];
  personaId?: string;
  personaSnapshot?: string;
  hasLink?: boolean;
  linkUrl?: string;
  hasMap?: boolean;
  placeAddress?: string;
}): string {
  const photoCount = args.photoLabels.length;
  const captionsForManuscript = (args.captions || []).map((c) => ({
    index: c.index,
    caption: c.caption,
    tags: Array.isArray(c.tags) ? c.tags : [],
    ocr: Array.isArray(c.ocr) ? c.ocr : [],
  }));

  return safeJoin([
    '너는 한국어 원고 편집자다. 아래 원고를 규칙에 맞게 1회만 보정하라.',
    '출력은 보정된 원고 텍스트만(설명/메타/코드블록 금지).',
    '',
    '[페르소나(말투/문체) - 보정 시에도 유지]',
    ...(args.personaId ? [`personaId: ${args.personaId}`] : []),
    ...personaStyleGuidelines(args.personaId),
    '- 보정 과정에서 문체가 중립화되지 않도록, 아래 페르소나를 톤에 그대로 유지한다.',
    args.personaSnapshot || '',
    '',
    '[절대 규칙(고정) - 아래 규칙은 항상 적용된다]',
    '- "사진 N"은 반드시 단독 라인이다. "사진 1" 라인에는 다른 텍스트를 붙이지 마라.',
    '- "사진 1" 다음 줄부터 본문을 작성하고, 문장 단위로 줄바꿈한다(특히 "요.", "습니다.", "니다.", "다." 종결 포함).',
    '- 사진 블록과 블록 사이는 빈 줄 1줄(\n\n)로만 구분한다.',
    '- 해시태그 라인은 반드시 마지막 줄 1개이며, 그 뒤에 어떤 텍스트도 출력하지 않는다.',
    '- 지도/링크는 원고 본문에 직접 쓰지 않는다(서버가 최종 append). 단, 서버가 붙이는 지도 URL 라인은 반드시 "지도 삽입 : {URL}" 형식이다.',
    '- 보정 결과(제목/본문/해시태그) 어디에도 큰따옴표(")를 사용하지 않는다. 특히 ""단어""처럼 따옴표로 감싸 강조하는 표현은 절대 금지다.',
    '- 특정 단어를 강조해야 하면 따옴표/특수문자(**, __, ~~ 등) 없이 그대로 자연스럽게 포함한다.',
    '',
    '[실패한 규칙]',
    ...(args.failures || []).map((f) => `- ${f}`),
    '',
    '[절대 금지]',
    '- 업로드 파일명(label), 업로드 URL(/uploads/...), 외부 URL(http/https)을 원고에 절대 쓰지 말 것.',
    '- 지도/주소/URL/링크/플레이스주소 문구를 원고에 절대 쓰지 말 것(서버가 최종 조립 단계에서 추가한다).',
    '- ""단어"" / "단어" 같은 따옴표 강조(quote emphasis)는 절대 쓰지 말 것.',
    '',
    '[출력 계약(Contract) - 절대 준수]',
    `1) 1번째 줄: 제목: {placeName 포함, 25~40자}`, 
    '2) 2번째 줄: 빈 줄',
    `3) 3번째 줄부터: 사진 1부터 사진 ${photoCount}까지, 반드시 순서대로 블록 작성`,
    '   - 각 블록 형식:',
    '     a) 첫 줄: "사진 N" (단독 라인, 다른 텍스트 금지)',
    '     b) 다음 줄부터: 본문(문장 단위 줄바꿈)',
    '     c) 다음 블록 시작 전: 빈 줄 1줄',
    '4) 마지막 줄: 해시태그: #... #... (최소 1개, 최대 5개, 한 줄만)',
    '',
    '[사진-본문 매칭 강제 규칙]',
    '- 아래 캡션 JSON의 각 사진 항목에 tags(3~6개)가 있다.',
    '- 각 사진 문단(사진 i)에는 해당 사진 tags 중 최소 2개를 반드시 포함한다.',
    '- 인물/직원/손님/아이/연인 등 사람 관련 서술은 tags나 caption/ocr에서 인물 존재가 명확한 경우에만 허용한다. 애매하면 절대 언급하지 마라.',
    '',
    '[본문 작성 규칙]',
    '- 사진 표기는 반드시 "사진 1"처럼 띄어쓰기를 포함한다("사진1" 금지).',
    `- 사진 순서는 1→${photoCount} 고정(역순/점프/누락 금지).`,
    '- 필수/강조 키워드는 원문 그대로 본문(body)에 최소 1회 이상 포함한다.',
    '- 본문(body) 글자수는 1500~2300자 범위를 맞춘다(제목/해시태그 제외).',
    '',
    `필수 키워드: ${(args.requiredKeywords || []).join(', ')}`,
    `강조 키워드: ${(args.emphasisKeywords || []).join(', ')}`,
    '',
    '[사진 캡션 JSON - 순서 고정 (label/파일명 없음)]',
    JSON.stringify(captionsForManuscript, null, 2),
    '',
    '[원고 원문]',
    args.original || '',
  ]);
}

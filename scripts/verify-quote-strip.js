const samples = [
  '이건 ""단어"" 강조예요',
  '이건 "단어" 강조예요',
  '스마트따옴표 “단어” 테스트',
];

function normalizeLikeServer(input) {
  return String(input)
    .replace(/""\s*([^"\n]+?)\s*""/g, '$1')
    .replace(/[“”"]/g, '');
}

for (const s of samples) {
  console.log('IN :', s);
  console.log('OUT:', normalizeLikeServer(s));
  console.log('---');
}

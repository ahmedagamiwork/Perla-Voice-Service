const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;
const SEARCH_STOP_WORDS = new Set([
  'بكام','كم','سعر','السعر','عايز','عاوزه','عايزه','اريد','ابغي','ابي','عندكم','عندكو','فيه','في','من','لو','سمحت','ممكن','فرع','الفرع'
]);

export function normalizeArabic(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(DIACRITICS, '')
    .replace(TATWEEL, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[×*]/g, 'x')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchTokens(input: string): string[] {
  const base = normalizeArabic(input).split(' ').filter(Boolean);
  const output: string[] = [];
  for (const token of base) {
    if (SEARCH_STOP_WORDS.has(token)) continue;
    if (!output.includes(token)) output.push(token);
    if (token.startsWith('ال') && token.length > 4) {
      const withoutArticle = token.slice(2);
      if (!output.includes(withoutArticle)) output.push(withoutArticle);
    }
  }
  return output;
}

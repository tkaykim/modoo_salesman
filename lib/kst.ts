/**
 * 날짜·시간은 한국 표준시(KST, Asia/Seoul)로 표시합니다.
 */
export const KST_TIMEZONE = 'Asia/Seoul' as const;

function parseDate(input: string | Date | null | undefined): Date | null {
  if (input == null || input === '') return null;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

const kst = { timeZone: KST_TIMEZONE } as const;

export function formatKstDateLong(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return '-';
  return d.toLocaleString('ko-KR', {
    ...kst,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatKstDateNumeric(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return '-';
  return d.toLocaleString('ko-KR', {
    ...kst,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatKstDateTimeMedium(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return '-';
  return d.toLocaleString('ko-KR', {
    ...kst,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatKstDateShort(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return '-';
  return d.toLocaleString('ko-KR', {
    ...kst,
    month: '2-digit',
    day: '2-digit',
  });
}

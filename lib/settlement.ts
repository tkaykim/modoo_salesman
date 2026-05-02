// 정산 사이클 — 매월 1일~말일 매출 → 다음 달 15일 정산 지급
// 단순화: settlement_period = 매출 발생 월 (YYYY-MM)
//        cutoff_day = 다음 달 15일 (3.3% 원천징수 후 지급)
//        evaluation_day = 매월 1일 (직전 3개월 평균 매출로 등급 재평가)

export const SETTLEMENT_CUTOFF_DAY = 15;

export interface SettlementPeriod {
  /** 'YYYY-MM' format */
  key: string;
  year: number;
  month: number; // 1~12
  /** 매출 발생 기간 시작 */
  rangeStart: Date;
  /** 매출 발생 기간 끝 (exclusive — 다음 달 1일 0시) */
  rangeEnd: Date;
  /** 정산 지급 예정일 (다음 달 15일) */
  payoutDate: Date;
}

export function buildPeriod(year: number, month1to12: number): SettlementPeriod {
  const m = ((month1to12 - 1) % 12 + 12) % 12; // 0~11
  const rangeStart = new Date(year, m, 1, 0, 0, 0, 0);
  const rangeEnd = new Date(year, m + 1, 1, 0, 0, 0, 0);
  const payoutDate = new Date(year, m + 1, SETTLEMENT_CUTOFF_DAY, 0, 0, 0, 0);
  const key = `${rangeStart.getFullYear()}-${String(rangeStart.getMonth() + 1).padStart(2, '0')}`;
  return { key, year: rangeStart.getFullYear(), month: rangeStart.getMonth() + 1, rangeStart, rangeEnd, payoutDate };
}

export function getCurrentPeriod(now: Date = new Date()): SettlementPeriod {
  return buildPeriod(now.getFullYear(), now.getMonth() + 1);
}

export function getPreviousPeriod(now: Date = new Date()): SettlementPeriod {
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return buildPeriod(prev.getFullYear(), prev.getMonth() + 1);
}

/**
 * 이번 달 정산 마감(다음 달 15일)까지 남은 일수
 */
export function getDaysUntilPayout(now: Date = new Date()): number {
  const period = getCurrentPeriod(now);
  const ms = period.payoutDate.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/**
 * 매출 마감(이번 달 말일)까지 남은 일수
 */
export function getDaysUntilCloseOfMonth(now: Date = new Date()): number {
  const period = getCurrentPeriod(now);
  const ms = period.rangeEnd.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/**
 * 다음 등급 재평가일 (다음 달 1일)
 */
export function getNextEvaluationDate(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
}

export function getDaysUntilEvaluation(now: Date = new Date()): number {
  const ms = getNextEvaluationDate(now).getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function formatPeriod(p: SettlementPeriod | string): string {
  const key = typeof p === 'string' ? p : p.key;
  const [y, m] = key.split('-');
  return `${y}년 ${parseInt(m, 10)}월`;
}

/**
 * 원천징수 (3.3%) 적용 후 실수령액
 */
export function applyWithholding(commissionAmount: number): { gross: number; withholding: number; net: number } {
  const withholding = Math.floor(commissionAmount * 0.033);
  return {
    gross: commissionAmount,
    withholding,
    net: commissionAmount - withholding,
  };
}

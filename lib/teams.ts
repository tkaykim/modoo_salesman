// Team domain model + partner_malls 매핑
// partner_malls.team_meta JSON ↔ TeamMeta 타입

export type TeamCategory = '학교' | '기업' | '동호회' | '매장' | '댄스';
export type TeamStatus = 'new' | 'active' | 'reorder_due' | 'dormant';

export interface TeamAddress {
  postal?: string;
  road?: string;
  detail?: string;
  /** 자유 입력 형태로 저장된 경우 fallback */
  raw?: string;
}

export interface TeamContact {
  name: string;
  role?: string;       // 예: 코치, 회장, 점주, 인사담당
  phone?: string;
  email?: string;
  isPrimary?: boolean;
}

export interface TeamMeta {
  category?: TeamCategory;
  size?: number;
  /** @deprecated — contacts[]로 이전. 마이그레이션 전 row 호환용 */
  decisionMaker?: string;
  /** @deprecated — contacts[]로 이전 */
  phone?: string;
  reorderCycleMonths?: number;
  note?: string;
  // 신규 필드
  address?: TeamAddress;
  contacts?: TeamContact[];
}

export interface PartnerMallRow {
  id: string;
  name: string;
  slug: string | null;
  share_token: string | null;
  logo_url: string | null;
  is_active: boolean | null;
  created_at: string | null;
  salesman_id: string | null;
  team_meta: TeamMeta | null;
}

export interface OrderAggregate {
  totalOrders: number;
  totalRevenue: number;
  lastOrderAt: string | null;
  lastOrderAmount: number;
  history: Array<{ date: string; amount: number; item: string }>;
}

export interface Team {
  id: string;
  name: string;
  slug: string | null;
  shareToken: string | null;
  logoUrl: string | null;
  isActive: boolean;
  category: TeamCategory | null;
  size: number | null;
  /** primary contact 이름 (contacts[0].name 또는 legacy decisionMaker) */
  decisionMaker: string | null;
  /** primary contact 전화 (contacts[0].phone 또는 legacy phone) */
  phone: string | null;
  reorderCycleMonths: number | null;
  note: string | null;
  address: TeamAddress | null;
  contacts: TeamContact[];
  ownerSalesmanId: string | null;
  createdAt: string | null;
  // 주문 집계 (없으면 0/null)
  totalOrders: number;
  totalRevenue: number;
  lastOrderAt: string | null;
  lastOrderAmount: number;
  lastOrderDays: number | null;
  /** 주문이력 기반 평균 발주 주기(일). 데이터 부족 시 null */
  avgReorderDays: number | null;
  /** 다음 예상 발주일까지 남은 일수(음수=경과). 데이터 부족 시 null */
  nextReorderDays: number | null;
  history: OrderAggregate['history'];
  status: TeamStatus;
}

const DEFAULT_AGG: OrderAggregate = {
  totalOrders: 0,
  totalRevenue: 0,
  lastOrderAt: null,
  lastOrderAmount: 0,
  history: [],
};

/**
 * 주문이력(날짜 배열)에서 평균 발주 주기(일)를 산출한다.
 * 주문이 2건 미만이면 주기를 알 수 없어 null.
 */
export function computeAvgReorderDays(orderDates: Array<string | null | undefined>): number | null {
  const times = orderDates
    .map((d) => (d ? new Date(d).getTime() : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (times.length < 2) return null;
  const span = times[times.length - 1] - times[0];
  const gaps = times.length - 1;
  const avg = span / gaps / (1000 * 60 * 60 * 24);
  return avg > 0 ? Math.round(avg) : null;
}

/**
 * 재발주 주기(일) 기준 단체 상태. cycleDays는 수동 override(reorderCycleMonths) 또는
 * 주문이력 기반 평균(avgReorderDays)에서 도출된 유효 주기.
 */
export function computeStatus(
  totalOrders: number,
  lastOrderDays: number | null,
  cycleDays: number | null
): TeamStatus {
  if (totalOrders === 0) return 'new';
  if (lastOrderDays === null) return 'new';
  // 첫 거래 후 30일 이내 = new (방금 거래 시작)
  if (totalOrders === 1 && lastOrderDays <= 30) return 'new';
  if (cycleDays === null) {
    // 주기 미정 — 6개월 무거래면 dormant, 아니면 active
    return lastOrderDays > 180 ? 'dormant' : 'active';
  }
  // 주기 80% 이상 경과 = 재발주 임박 (소진 직전 알림: 연구 권장)
  if (lastOrderDays >= cycleDays * 0.8 && lastOrderDays <= cycleDays * 1.5) return 'reorder_due';
  // 주기 1.5배 초과 = 휴면
  if (lastOrderDays > cycleDays * 1.5) return 'dormant';
  return 'active';
}

export function mapPartnerMallToTeam(row: PartnerMallRow, agg: OrderAggregate = DEFAULT_AGG): Team {
  const meta = row.team_meta ?? {};
  const lastOrderDays = agg.lastOrderAt
    ? Math.floor((Date.now() - new Date(agg.lastOrderAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // contacts[] 우선, 없으면 legacy decisionMaker/phone
  const contacts: TeamContact[] = Array.isArray(meta.contacts) && meta.contacts.length > 0
    ? meta.contacts
    : meta.decisionMaker
      ? [{ name: meta.decisionMaker, phone: meta.phone, isPrimary: true }]
      : [];
  const primary = contacts.find((c) => c.isPrimary) ?? contacts[0] ?? null;

  // 재발주 주기: 수동 override(reorderCycleMonths) 우선, 없으면 주문이력 평균.
  const avgReorderDays = computeAvgReorderDays((agg.history ?? []).map((h) => h.date));
  const manualCycleDays = meta.reorderCycleMonths != null ? meta.reorderCycleMonths * 30 : null;
  const effectiveCycleDays = manualCycleDays ?? avgReorderDays;
  const nextReorderDays =
    effectiveCycleDays != null && lastOrderDays != null
      ? Math.round(effectiveCycleDays - lastOrderDays)
      : null;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shareToken: row.share_token,
    logoUrl: row.logo_url,
    isActive: !!row.is_active,
    category: meta.category ?? null,
    size: meta.size ?? null,
    decisionMaker: primary?.name ?? meta.decisionMaker ?? null,
    phone: primary?.phone ?? meta.phone ?? null,
    reorderCycleMonths: meta.reorderCycleMonths ?? null,
    note: meta.note ?? null,
    address: meta.address ?? null,
    contacts,
    ownerSalesmanId: row.salesman_id,
    createdAt: row.created_at,
    totalOrders: agg.totalOrders,
    totalRevenue: agg.totalRevenue,
    lastOrderAt: agg.lastOrderAt,
    lastOrderAmount: agg.lastOrderAmount,
    lastOrderDays,
    avgReorderDays,
    nextReorderDays,
    history: agg.history,
    status: computeStatus(agg.totalOrders, lastOrderDays, effectiveCycleDays),
  };
}

export function formatAddress(addr: TeamAddress | null | undefined): string {
  if (!addr) return '';
  if (addr.raw) return addr.raw;
  return [addr.postal ? `[${addr.postal}]` : '', addr.road, addr.detail].filter(Boolean).join(' ');
}

export const CATEGORY_OPTIONS: TeamCategory[] = ['학교', '기업', '동호회', '매장', '댄스'];
export const REORDER_CYCLE_OPTIONS = [
  { value: 3, label: '3개월 (시즌별)' },
  { value: 6, label: '6개월 (반기)' },
  { value: 12, label: '1년 (연간)' },
  { value: 24, label: '2년+' },
];
export const CATEGORY_COLORS: Record<TeamCategory, string> = {
  학교: 'bg-blue-100 text-blue-800',
  기업: 'bg-purple-100 text-purple-800',
  동호회: 'bg-green-100 text-green-800',
  매장: 'bg-amber-100 text-amber-800',
  댄스: 'bg-pink-100 text-pink-800',
};

export const CONTACT_ROLE_OPTIONS = ['결정권자', '담당자', '코치', '회장', '점주', '인사담당', '구매담당', '기타'];

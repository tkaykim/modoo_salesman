// Team domain model + partner_malls 매핑
// partner_malls.team_meta JSON ↔ TeamMeta 타입

export type TeamCategory = '학교' | '기업' | '동호회' | '매장' | '댄스';
export type TeamStatus = 'new' | 'active' | 'reorder_due' | 'dormant';

export interface TeamMeta {
  category?: TeamCategory;
  size?: number;
  decisionMaker?: string;
  phone?: string;
  reorderCycleMonths?: number;
  note?: string;
}

export interface PartnerMallRow {
  id: string;
  name: string;
  slug: string | null;
  share_token: string | null;
  logo_url: string | null;
  is_active: boolean | null;
  created_at: string | null;
  owner_salesman_id: string | null;
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
  decisionMaker: string | null;
  phone: string | null;
  reorderCycleMonths: number | null;
  note: string | null;
  // 주문 집계 (없으면 0/null)
  totalOrders: number;
  totalRevenue: number;
  lastOrderAt: string | null;
  lastOrderAmount: number;
  lastOrderDays: number | null;
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

export function computeStatus(
  totalOrders: number,
  lastOrderDays: number | null,
  cycleMonths: number | null
): TeamStatus {
  if (totalOrders === 0) return 'new';
  if (lastOrderDays === null) return 'new';
  // 첫 거래 후 30일 이내 = new (방금 거래 시작)
  if (totalOrders === 1 && lastOrderDays <= 30) return 'new';
  if (cycleMonths === null) {
    // 사이클 미정 — 6개월 무거래면 dormant, 아니면 active
    return lastOrderDays > 180 ? 'dormant' : 'active';
  }
  const cycleDays = cycleMonths * 30;
  // 사이클 80% 이상 경과 = 재발주 임박
  if (lastOrderDays >= cycleDays * 0.8 && lastOrderDays <= cycleDays * 1.5) return 'reorder_due';
  // 사이클 1.5배 초과 = 휴면
  if (lastOrderDays > cycleDays * 1.5) return 'dormant';
  return 'active';
}

export function mapPartnerMallToTeam(row: PartnerMallRow, agg: OrderAggregate = DEFAULT_AGG): Team {
  const meta = row.team_meta ?? {};
  const lastOrderDays = agg.lastOrderAt
    ? Math.floor((Date.now() - new Date(agg.lastOrderAt).getTime()) / (1000 * 60 * 60 * 24))
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
    decisionMaker: meta.decisionMaker ?? null,
    phone: meta.phone ?? null,
    reorderCycleMonths: meta.reorderCycleMonths ?? null,
    note: meta.note ?? null,
    totalOrders: agg.totalOrders,
    totalRevenue: agg.totalRevenue,
    lastOrderAt: agg.lastOrderAt,
    lastOrderAmount: agg.lastOrderAmount,
    lastOrderDays,
    history: agg.history,
    status: computeStatus(agg.totalOrders, lastOrderDays, meta.reorderCycleMonths ?? null),
  };
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

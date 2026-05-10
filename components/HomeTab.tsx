'use client';

import {
  HeroLevelCard,
  EarningsCard,
  QuickActionGrid,
  TintedSection,
  Icon,
} from '@/components/ui';
import type { GradeInfo } from '@/lib/grades';
import type { Team } from '@/lib/teams';

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

export interface HomeTabProps {
  grade: GradeInfo;
  next: GradeInfo | null;
  thisMonthRevenue: number;
  totalRevenue: number;
  teams: Team[];
  reorderDue: Team[];
  newOrdersCount: number;
  couponCount: number;
  onCreateOrder: () => void;
  onOpenCalculator: () => void;
  onOpenTemplates: () => void;
  onOpenCoupons: () => void;
  onOpenLevel: () => void;
  onOpenOrg: (teamId: string) => void;
  onNavigate: (t: 'home' | 'map' | 'orgs' | 'tools' | 'profile') => void;
}

export default function HomeTab({
  grade,
  next,
  thisMonthRevenue,
  totalRevenue,
  teams,
  reorderDue,
  newOrdersCount,
  couponCount,
  onCreateOrder,
  onOpenCalculator,
  onOpenTemplates,
  onOpenCoupons,
  onOpenLevel,
  onOpenOrg,
  onNavigate,
}: HomeTabProps) {
  const goal = next ? next.monthlyThreshold : grade.monthlyThreshold;

  return (
    <div className="bg-[var(--color-surface-alt)] min-h-full pb-8">
      {/* Hero level card */}
      <div className="pt-3">
        <HeroLevelCard
          grade={grade}
          next={next}
          thisMonthRevenue={thisMonthRevenue}
          couponCount={couponCount}
          onClick={onOpenLevel}
        />
      </div>

      {/* Earnings card */}
      <EarningsCard
        label="이번 달 매출"
        amount={thisMonthRevenue}
        goal={goal}
        yoyDelta={null}
        stats={[
          { label: '신규 주문', value: newOrdersCount, suffix: '건' },
          { label: '활성 단체', value: teams.length, suffix: '곳' },
          { label: '누적', value: `${Math.round(totalRevenue / 10000).toLocaleString('ko-KR')}`, suffix: '만원' },
        ]}
        onDetail={() => onNavigate('tools')}
      />

      {/* Quick actions */}
      <div className="mt-3.5 px-3">
        <div className="px-1.5 pb-2">
          <h3 className="text-[13px] font-bold text-[var(--color-body)] tracking-tight">빠른 시작</h3>
        </div>
        <QuickActionGrid
          items={[
            { icon: 'bolt',    label: '간편 견적', tint: 'primary', onClick: onOpenCalculator },
            { icon: 'palette', label: '템플릿',    tint: 'purple',  onClick: onOpenTemplates },
            { icon: 'sparkle', label: '커스텀',    tint: 'success', onClick: onCreateOrder },
            { icon: 'tag',     label: '쿠폰',      tint: 'gold',    badge: couponCount, onClick: onOpenCoupons },
          ]}
        />
      </div>

      {/* Reorder timing — warning tint */}
      <TintedSection
        title="재주문 타이밍"
        right={`${reorderDue.length}곳 임박`}
        onRight={() => onNavigate('orgs')}
        alert={reorderDue.length > 0}
        tint="warning"
      >
        {reorderDue.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px] text-[var(--color-warn-deep)]">
            재발주 임박 단체 없음
          </div>
        ) : (
          reorderDue.slice(0, 3).map((team, i, arr) => (
            <ReorderRow
              key={team.id}
              team={team}
              divider={i < arr.length - 1}
              onClick={() => onOpenOrg(team.id)}
            />
          ))
        )}
      </TintedSection>

      {/* Recommended missions — primary tint, mock */}
      <TintedSection
        title="추천 미션"
        right="지도에서 보기"
        onRight={() => onNavigate('map')}
        tint="primary"
      >
        {MOCK_MISSIONS.map((m, i, arr) => (
          <MissionRow key={m.id} mission={m} divider={i < arr.length - 1} onClick={() => onNavigate('map')} />
        ))}
      </TintedSection>

      {/* Activity feed */}
      <TintedSection title="최근 활동">
        {MOCK_FEED.map((f, i, arr) => (
          <div
            key={f.id}
            className="flex items-center gap-3 px-4 py-3.5"
            style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--color-hairline-soft)' : 'none' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{
                background:
                  f.kind === 'reorder' ? 'var(--color-err)' :
                  f.kind === 'mission' ? 'var(--color-brand-500)' :
                  f.kind === 'coupon'  ? 'var(--color-gold)' :
                                          'var(--color-pos)',
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-medium text-[var(--color-ink)] tracking-tight">{f.text}</div>
              <div className="text-[11px] text-[var(--color-faint)] mt-0.5">{f.time}</div>
            </div>
            {f.urgent && <div className="text-[11px] font-bold text-[var(--color-err)]">긴급</div>}
          </div>
        ))}
      </TintedSection>

      {/* Total link */}
      <div className="mt-3.5 px-3">
        <button
          onClick={() => onNavigate('orgs')}
          className="w-full bg-white rounded-[16px] px-4 py-3.5 flex items-center justify-between"
          style={{ boxShadow: 'var(--shadow-card-flat)', border: '1px solid var(--color-hairline-soft)' }}
        >
          <div className="text-left">
            <div className="text-[11px] text-[var(--color-muted)] mb-0.5">관리 단체 / 누적 매출</div>
            <div className="text-[13px] font-bold text-[var(--color-ink)]">
              {teams.length}개 · <span className="font-mono num">{fmt(totalRevenue)}</span>
            </div>
          </div>
          <Icon name="chevron-r" size={16} color="var(--color-faint)" />
        </button>
      </div>
    </div>
  );
}

function ReorderRow({ team, divider, onClick }: { team: Team; divider: boolean; onClick: () => void }) {
  const days = team.lastOrderDays != null && team.reorderCycleMonths != null
    ? Math.max(0, team.reorderCycleMonths * 30 - team.lastOrderDays)
    : null;
  const overdue = days != null && days <= 3;
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
      style={{ borderBottom: divider ? '1px solid rgba(0,0,0,0.04)' : 'none' }}
    >
      <div
        className="w-11 h-11 rounded-[12px] flex flex-col items-center justify-center flex-shrink-0"
        style={{
          background: overdue ? '#ffe1d4' : '#fde9c1',
          color: overdue ? 'var(--color-err-strong)' : 'var(--color-warn-deep)',
        }}
      >
        <div className="text-[13px] font-extrabold leading-none tracking-tight">
          {days == null ? '?' : days <= 0 ? '오늘' : `D-${days}`}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-bold text-[var(--color-ink)] tracking-tight truncate">{team.name}</div>
        <div className="text-[12px] text-[var(--color-muted)] mt-0.5">
          {team.category || '단체'} · {team.lastOrderDays != null ? `${team.lastOrderDays}일 전 주문` : '주문 없음'}
        </div>
      </div>
      <Icon name="chevron-r" size={18} color="var(--color-faint)" strokeWidth={2} />
    </button>
  );
}

interface MockMission {
  id: string;
  name: string;
  stage: 'lead' | 'contact' | 'quote' | 'first';
  distance: string;
  mission: string;
  xp: number;
}

const MOCK_MISSIONS: MockMission[] = [
  { id: 'm1', name: '서울중학교 축구부', stage: 'contact', distance: '0.3km',  mission: '담당자 명함 받기',     xp: 30 },
  { id: 'm2', name: '강남헬스장',        stage: 'lead',    distance: '0.8km',  mission: '단가표 제시',          xp: 20 },
  { id: 'm3', name: '청담 동호회',       stage: 'quote',   distance: '1.2km',  mission: '견적서 회신 받기',     xp: 50 },
];

function MissionRow({ mission, divider, onClick }: { mission: MockMission; divider: boolean; onClick: () => void }) {
  const stages = {
    lead:    { label: '리드',   color: 'var(--color-faint)' },
    contact: { label: '컨택',   color: 'var(--color-brand-500)' },
    quote:   { label: '견적중', color: 'var(--color-warn-deep)' },
    first:   { label: '첫주문', color: 'var(--color-err-strong)' },
  };
  const s = stages[mission.stage];
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-3.5 flex items-center gap-3 text-left"
      style={{ borderBottom: divider ? '1px solid rgba(0,82,204,0.08)' : 'none' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold" style={{ color: s.color }}>{s.label}</span>
          <span className="w-[3px] h-[3px] rounded-full bg-[var(--color-hairline)]" />
          <div className="text-[15px] font-bold text-[var(--color-ink)] tracking-tight">{mission.name}</div>
        </div>
        <div className="text-[12px] text-[var(--color-muted)] mt-0.5">
          {mission.distance} · {mission.mission}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[14px] font-extrabold text-[var(--color-brand-500)]">+{mission.xp}</div>
        <div className="text-[10px] text-[var(--color-muted)] font-semibold">XP</div>
      </div>
      <Icon name="chevron-r" size={18} color="var(--color-faint)" strokeWidth={2} />
    </button>
  );
}

const MOCK_FEED = [
  { id: 'f1', kind: 'reorder' as const, text: '서울중학교 축구부 재주문 임박',  time: '오늘',         urgent: true },
  { id: 'f2', kind: 'mission' as const, text: '강남헬스장 명함 미션 완료',       time: '어제',         urgent: false },
  { id: 'f3', kind: 'coupon'  as const, text: '5% 쿠폰 1장 지급',                time: '5월 7일',      urgent: false },
  { id: 'f4', kind: 'success' as const, text: '청담 동호회 첫 주문 32벌 등록',  time: '5월 5일',      urgent: false },
];

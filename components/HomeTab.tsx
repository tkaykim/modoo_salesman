'use client';

import {
  HeroLevelCard,
  EarningsCard,
  QuickActionGrid,
  TintedSection,
  Icon,
} from '@/components/ui';
import type { GradeInfo } from '@/lib/grades';
import { applyWithholding } from '@/lib/settlement';
import type { Team } from '@/lib/teams';

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

export interface HomeTabProps {
  grade: GradeInfo;
  next: GradeInfo | null;
  /** 결제 완료分(확정 매출) */
  thisMonthRevenue: number;
  /** 미결제(pending) 대기 매출 */
  thisMonthPendingRevenue: number;
  totalRevenue: number;
  teams: Team[];
  reorderDue: Team[];
  couponCount: number;
  onCreateOrder: () => void;
  onStartVisit: () => void;
  onOpenCalculator: () => void;
  onOpenTemplates: () => void;
  onOpenCoupons: () => void;
  onOpenEarnings: () => void;
  onOpenAcademy: () => void;
  onOpenOrg: (teamId: string) => void;
  onNavigate: (t: 'home' | 'academy' | 'earnings' | 'orgs' | 'tools' | 'profile') => void;
}

export default function HomeTab({
  grade,
  next,
  thisMonthRevenue,
  thisMonthPendingRevenue,
  totalRevenue,
  teams,
  reorderDue,
  couponCount,
  onCreateOrder,
  onStartVisit,
  onOpenCalculator,
  onOpenTemplates,
  onOpenCoupons,
  onOpenEarnings,
  onOpenAcademy,
  onOpenOrg,
  onNavigate,
}: HomeTabProps) {
  // 이번 달 내 예상 수수료(확정 매출 기준)와 실수령
  const estCommission = Math.round(thisMonthRevenue * grade.commissionRate);
  const net = applyWithholding(estCommission).net;

  return (
    <div className="bg-[var(--color-surface-alt)] min-h-full pb-8">
      {/* Hero level card */}
      <div className="pt-3">
        <HeroLevelCard
          grade={grade}
          next={next}
          thisMonthRevenue={thisMonthRevenue}
          couponCount={couponCount}
          onClick={onOpenEarnings}
        />
      </div>

      {/* Earnings card — 내가 버는 돈이 메인 */}
      <EarningsCard
        label={`이번 달 예상 수수료 (${Math.round(grade.commissionRate * 100)}%)`}
        amount={estCommission}
        yoyDelta={null}
        stats={[
          { label: '확정 매출', value: `${Math.round(thisMonthRevenue / 10000).toLocaleString('ko-KR')}`, suffix: '만원' },
          { label: '실수령(예상)', value: `${Math.round(net / 10000).toLocaleString('ko-KR')}`, suffix: '만원' },
          { label: '활성 단체', value: teams.length, suffix: '곳' },
        ]}
        onDetail={onOpenEarnings}
      />

      <div className="px-3 mt-3">
        <button
          onClick={onStartVisit}
          className="w-full rounded-[18px] bg-[var(--color-ink)] px-4 py-4 text-left text-white active:opacity-90"
          style={{ boxShadow: 'var(--shadow-cta)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[14px] bg-white/10 flex items-center justify-center flex-shrink-0">
              <Icon name="briefcase" size={22} color="white" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-extrabold tracking-tight">새 매장 상담 시작</div>
              <div className="text-[11px] text-white/70 mt-0.5">등록하고 바로 제품 시안을 만들어요</div>
            </div>
            <Icon name="chevron-r" size={18} color="rgba(255,255,255,0.75)" strokeWidth={2.2} />
          </div>
        </button>
      </div>

      {/* 미결제 대기 — 결제되면 수수료로 전환 */}
      {thisMonthPendingRevenue > 0 && (
        <div className="px-3 mt-2">
          <button
            onClick={onOpenEarnings}
            className="w-full bg-[var(--color-warn)]/10 border border-[var(--color-warn)]/25 rounded-[14px] px-4 py-2.5 flex items-center gap-2 text-left active:bg-[var(--color-warn)]/15"
          >
            <Icon name="clock" size={16} color="var(--color-warn-deep)" />
            <div className="flex-1 min-w-0">
              <span className="text-[12px] text-[var(--color-warn-deep)] font-bold">결제 대기 </span>
              <span className="text-[12px] text-[var(--color-warn-deep)] font-mono num">{fmt(thisMonthPendingRevenue)}</span>
              <span className="text-[11px] text-[var(--color-muted)]"> · 결제되면 수수료로 반영돼요</span>
            </div>
            <Icon name="chevron-r" size={14} color="var(--color-warn-deep)" />
          </button>
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-3.5 px-3">
        <div className="px-1.5 pb-2">
          <h3 className="text-[13px] font-bold text-[var(--color-body)] tracking-tight">빠른 시작</h3>
        </div>
        <QuickActionGrid
          items={[
            { icon: 'bolt',    label: '간편 견적', tint: 'primary', onClick: onOpenCalculator },
            { icon: 'palette', label: '템플릿',    tint: 'purple',  onClick: onOpenTemplates },
            { icon: 'sparkle', label: '커스텀 주문', tint: 'success', onClick: onCreateOrder },
            { icon: 'tag',     label: '쿠폰',      tint: 'gold',    badge: couponCount, onClick: onOpenCoupons },
          ]}
        />
      </div>

      <div className="px-3 mt-3">
        <button
          onClick={onOpenAcademy}
          className="w-full bg-white rounded-[16px] px-4 py-3.5 flex items-center gap-3 text-left active:bg-[var(--color-surface-alt)]"
          style={{ boxShadow: 'var(--shadow-card-flat)', border: '1px solid var(--color-hairline-soft)' }}
        >
          <div
            className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--color-gold-soft)' }}
          >
            <Icon name="trophy" size={22} color="var(--color-gold-deep)" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-extrabold text-[var(--color-ink)] tracking-tight">
              파트너 스쿨 미션 시작
            </div>
            <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
              교육 보고 첫 단체몰 리워드까지 확인
            </div>
          </div>
          <Icon name="chevron-r" size={16} color="var(--color-faint)" />
        </button>
      </div>

      {/* Reorder timing — warning tint, 실데이터 */}
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
          reorderDue.slice(0, 4).map((team, i, arr) => (
            <ReorderRow
              key={team.id}
              team={team}
              divider={i < arr.length - 1}
              onClick={() => onOpenOrg(team.id)}
            />
          ))
        )}
      </TintedSection>

      {/* Total link */}
      <div className="mt-3.5 px-3">
        <button
          onClick={() => onNavigate('orgs')}
          className="w-full bg-white rounded-[16px] px-4 py-3.5 flex items-center justify-between"
          style={{ boxShadow: 'var(--shadow-card-flat)', border: '1px solid var(--color-hairline-soft)' }}
        >
          <div className="text-left">
            <div className="text-[11px] text-[var(--color-muted)] mb-0.5">관리 단체 / 누적 확정 매출</div>
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
  // 예상 발주일까지 남은 일수 — nextReorderDays(주문이력 기반)가 있으면 우선, 없으면 고정주기 계산 폴백
  const days =
    team.nextReorderDays != null
      ? team.nextReorderDays
      : team.lastOrderDays != null && team.reorderCycleMonths != null
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

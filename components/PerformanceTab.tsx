'use client';

import { useState } from 'react';
import { Icon, Card, Section, HairLine } from '@/components/ui';
import { useSalesmanStore } from '@/store/useSalesmanStore';
import { useMyRevenue } from '@/hooks/useMyRevenue';
import { useMySettlements, type SettlementRow } from '@/hooks/useMySettlements';
import { useMyGradeHistory } from '@/hooks/useMyGradeHistory';
import { useGradeLevels, type GradeLevelRow } from '@/hooks/useGradeLevels';
import { useMyCoupons } from '@/hooks/useMyCoupons';
import { getGrade } from '@/lib/grades';
import {
  getCurrentPeriod,
  getDaysUntilCloseOfMonth,
  getDaysUntilPayout,
  getDaysUntilEvaluation,
  formatPeriod,
  applyWithholding,
} from '@/lib/settlement';

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

export default function PerformanceTab() {
  const { user } = useSalesmanStore();
  const grade = getGrade(user?.grade);
  const { thisMonthRevenue, totalRevenue, totalOrderCount, monthly, isLoading: revLoading } = useMyRevenue();
  const { settlements, isLoading: setLoading } = useMySettlements();
  const { history } = useMyGradeHistory();
  const { levels, findNext, labelFor } = useGradeLevels();
  const { primary: primaryCoupon } = useMyCoupons();

  const next = findNext(grade.level);
  const target = next ? next.monthly_revenue_threshold : grade.monthlyThreshold;
  const progress = target > 0 ? Math.min(100, Math.round((thisMonthRevenue / target) * 100)) : 100;

  const period = getCurrentPeriod();
  const daysToCloseOfMonth = getDaysUntilCloseOfMonth();
  const daysToPayout = getDaysUntilPayout();
  const daysToEvaluation = getDaysUntilEvaluation();

  const estimatedCommission = thisMonthRevenue * grade.commissionRate;
  const withholding = applyWithholding(estimatedCommission);

  return (
    <div className="px-4 py-4 space-y-4">
      {/* 1. 등급 카드 (hero) */}
      <Card variant="inverted" padding="lg">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[11px] text-white/60 mb-1">나의 등급</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-[28px] font-black leading-none ${grade.badgeColor}`}>{grade.shortLabel}</span>
              <span className="text-[14px] text-white/80">{grade.label}</span>
            </div>
          </div>
          <span className="text-[11px] bg-white/15 text-white px-2 py-1 rounded-full font-bold">
            수수료 {Math.round(grade.commissionRate * 100)}%
          </span>
        </div>

        {next ? (
          <>
            <div className="flex justify-between items-baseline text-[11px] mb-1.5">
              <span className="text-white/70">{next.label} 승급까지</span>
              <span className="text-white font-mono font-semibold num">
                {fmt(Math.max(0, target - thisMonthRevenue))}
              </span>
            </div>
            <div className="w-full bg-white/15 rounded-full h-1.5 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${grade.trackColor}`} style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-white/50 mt-1.5 num">
              <span>{fmt(thisMonthRevenue)}</span>
              <span>{fmt(target)}</span>
            </div>
          </>
        ) : (
          <p className="text-[12px] text-white/70">최고 등급 유지 중 — {fmt(thisMonthRevenue)}</p>
        )}
      </Card>

      {/* 2. 이번 평가기간 */}
      <Section title="이번 평가기간">
        <Card variant="default" padding="md">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-[var(--color-brand-100)] flex items-center justify-center flex-shrink-0">
              <Icon name="history" size={18} color="var(--color-brand-500)" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[var(--color-ink)]">{formatPeriod(period)} 매출 집계 중</p>
              <p className="text-[11px] text-[var(--color-muted)] mt-0.5 leading-relaxed">
                매월 1일 0시에 직전 3개월 평균 매출로 등급 재평가됩니다.
              </p>
            </div>
          </div>
          <HairLine className="my-3" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <Pill label="매출 마감" days={daysToCloseOfMonth} hint="이번 달 말일" />
            <Pill label="등급 재평가" days={daysToEvaluation} hint="다음 달 1일" highlight={daysToEvaluation <= 7} />
            <Pill label="정산 지급" days={daysToPayout} hint="다음 달 15일" />
          </div>
        </Card>
      </Section>

      {/* 3. 등급 기준표 */}
      <GradeTable levels={levels} currentLevel={grade.level} />

      {/* 4. 정산 예정액 */}
      <Section title="이번 달 정산 예정액">
        <Card variant="default" padding="md">
          <div className="text-center py-2">
            <p className="text-[28px] font-black text-[var(--color-ink)] num leading-tight">
              {fmt(estimatedCommission)}
            </p>
            <p className="text-[11px] text-[var(--color-muted)] mt-1">
              매출 {fmt(thisMonthRevenue)} × 수수료 {Math.round(grade.commissionRate * 100)}%
            </p>
          </div>
          <HairLine className="my-3" />
          <div className="grid grid-cols-3 gap-1 text-center">
            <Stat label="총 수수료" value={fmt(withholding.gross)} />
            <Stat label="원천징수 3.3%" value={`-${fmt(withholding.withholding)}`} accent="var(--color-err)" />
            <Stat label="실수령액" value={fmt(withholding.net)} accent="var(--color-pos)" bold />
          </div>
          <p className="text-[10px] text-[var(--color-faint)] mt-3 text-center">
            지급일: 다음 달 15일 (영업일 기준)
          </p>
        </Card>
      </Section>

      {/* 5. 정산 이력 */}
      <Section title="정산 이력">
        {setLoading ? (
          <Card padding="md"><div className="text-[12px] text-center text-[var(--color-muted)] py-2">불러오는 중...</div></Card>
        ) : settlements.length === 0 ? (
          <EmptyState icon="wallet" title="아직 정산 이력이 없어요" desc={`첫 매출이 발생한 달부터 자동으로 기록됩니다.`} />
        ) : (
          <div className="space-y-2">
            {settlements.map((s) => (
              <SettlementCard key={s.id} settlement={s} commissionLabel={labelFor(s.commission_rate_applied >= 0.25 ? 'LV10' : '')} />
            ))}
          </div>
        )}
      </Section>

      {/* 6. 월별 매출 (정산 이력이 비어있을 때 보조 정보) */}
      {settlements.length === 0 && monthly.length > 0 && (
        <Section title="월별 매출 (집계)">
          <Card padding="none">
            {monthly.slice(0, 6).map((m, i) => (
              <div key={m.period} className={`flex justify-between items-center px-4 py-3 ${i > 0 ? 'border-t border-[var(--color-hairline-soft)]' : ''}`}>
                <span className="text-[13px] font-semibold text-[var(--color-body)]">{formatPeriod(m.period)}</span>
                <div className="text-right">
                  <div className="text-[14px] font-bold text-[var(--color-ink)] num">{fmt(m.revenue)}</div>
                  <div className="text-[10px] text-[var(--color-muted)]">{m.orderCount}건</div>
                </div>
              </div>
            ))}
          </Card>
          <p className="text-[10px] text-[var(--color-faint)] px-1">
            ⓘ 정산 row가 생성되기 전까지 임시 집계 표시. 누적 {totalOrderCount}건 / {fmt(totalRevenue)}
            {revLoading && ' · 불러오는 중...'}
          </p>
        </Section>
      )}

      {/* 7. 승급/강등 이력 */}
      <Section title="등급 변경 이력">
        {history.length === 0 ? (
          <EmptyState icon="history" title="이력이 없어요" desc="등급이 변경되면 자동으로 기록됩니다." />
        ) : (
          <Card padding="none">
            {history.map((h, i) => (
              <div key={h.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-[var(--color-hairline-soft)]' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-[var(--color-brand-100)] flex items-center justify-center flex-shrink-0">
                  <Icon name={h.prev_level ? 'arrow-up-r' : 'sparkle'} size={16} color="var(--color-brand-500)" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-[13px]">
                    {h.prev_level && (
                      <>
                        <span className="text-[var(--color-muted)] font-mono">{h.prev_level.replace('LV', 'Lv.')}</span>
                        <Icon name="arrow-r" size={12} color="var(--color-faint)" />
                      </>
                    )}
                    <span className="font-bold text-[var(--color-ink)] font-mono">{h.new_level.replace('LV', 'Lv.')}</span>
                  </div>
                  <p className="text-[10px] text-[var(--color-faint)] mt-0.5">
                    {new Date(h.changed_at).toLocaleDateString('ko-KR')} · {reasonLabel(h.reason)}
                  </p>
                </div>
              </div>
            ))}
          </Card>
        )}
      </Section>

      {/* 8. 내 할인코드 */}
      <Section title="내 영업 할인코드">
        {primaryCoupon ? (
          <Card variant="default" padding="md">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-[var(--color-brand-100)] flex items-center justify-center flex-shrink-0">
                <Icon name="tag" size={18} color="var(--color-brand-500)" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-[var(--color-muted)] mb-0.5">고객에게 공유 가능</p>
                <p className="text-[20px] font-black font-mono text-[var(--color-brand-700)] tracking-wider">
                  {primaryCoupon.code}
                </p>
              </div>
            </div>
            <HairLine className="my-3" />
            <div className="flex justify-between text-[12px]">
              <span className="text-[var(--color-muted)]">기본 할인</span>
              <span className="font-bold text-[var(--color-ink)]">
                {primaryCoupon.discount_type === 'percentage'
                  ? `${primaryCoupon.discount_value}%`
                  : fmt(primaryCoupon.discount_value)}
              </span>
            </div>
            {primaryCoupon.current_uses != null && (
              <div className="flex justify-between text-[12px] mt-1">
                <span className="text-[var(--color-muted)]">사용 횟수</span>
                <span className="font-bold text-[var(--color-ink)] num">{primaryCoupon.current_uses}회</span>
              </div>
            )}
            <p className="text-[10px] text-[var(--color-faint)] mt-3 leading-relaxed">
              ⓘ 고객이 결제 시 이 코드를 입력하거나, 단체 mall에서 자동 적용됩니다. 매출은 본인에게 자동 귀속.
            </p>
          </Card>
        ) : (
          <Card padding="md">
            <p className="text-[12px] text-[var(--color-warn)]">⚠️ 할인코드가 발급되지 않았습니다. 본사에 문의하세요.</p>
          </Card>
        )}
      </Section>
    </div>
  );
}

// =====================================================================
// Sub-components
// =====================================================================

function Pill({ label, days, hint, highlight }: { label: string; days: number; hint: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[10px] px-2 py-2 ${highlight ? 'bg-[var(--color-brand-100)]' : 'bg-[var(--color-surface-alt)]'}`}>
      <div className="text-[10px] text-[var(--color-muted)] mb-0.5">{label}</div>
      <div className={`text-[16px] font-black num ${highlight ? 'text-[var(--color-brand-700)]' : 'text-[var(--color-ink)]'}`}>
        D{days >= 0 ? '-' : '+'}{Math.abs(days)}
      </div>
      <div className="text-[9px] text-[var(--color-faint)] mt-0.5">{hint}</div>
    </div>
  );
}

function Stat({ label, value, accent, bold }: { label: string; value: string; accent?: string; bold?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-[var(--color-muted)]">{label}</div>
      <div
        className={`text-[13px] num mt-0.5 ${bold ? 'font-bold' : 'font-semibold'}`}
        style={{ color: accent ?? 'var(--color-ink)' }}
      >
        {value}
      </div>
    </div>
  );
}

function GradeTable({ levels, currentLevel }: { levels: GradeLevelRow[]; currentLevel: string }) {
  const [expanded, setExpanded] = useState(false);
  const visibleLevels = expanded ? levels : levels.filter((l) => Math.abs(l.display_order - (levels.find((x) => x.level === currentLevel)?.display_order ?? 0)) <= 1);

  return (
    <Section
      title="등급 기준표"
      action={
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[12px] text-[var(--color-brand-500)] font-bold flex items-center gap-0.5"
        >
          {expanded ? '접기' : '전체 보기'}
          <Icon name={expanded ? 'chevron-u' : 'chevron-d'} size={14} color="var(--color-brand-500)" />
        </button>
      }
    >
      <Card padding="none">
        <div className="px-4 py-2.5 flex justify-between text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wide bg-[var(--color-surface-alt)] rounded-t-[14px]">
          <span className="w-24">등급</span>
          <span className="w-16 text-right">수수료</span>
          <span className="flex-1 text-right">월 매출 임계</span>
        </div>
        {visibleLevels.map((lv, i) => {
          const isCurrent = lv.level === currentLevel;
          return (
            <div
              key={lv.level}
              className={`flex items-center px-4 py-3 ${i > 0 ? 'border-t border-[var(--color-hairline-soft)]' : ''} ${isCurrent ? 'bg-[var(--color-brand-100)]' : ''}`}
            >
              <span className={`w-24 min-w-0 flex items-center gap-1.5 text-[13px] font-mono font-bold ${isCurrent ? 'text-[var(--color-brand-700)]' : 'text-[var(--color-ink)]'}`}>
                <span className="shrink-0">{lv.level.replace('LV', 'Lv.')}</span>
                {isCurrent && (
                  <span className="inline-flex h-4 shrink-0 items-center rounded-full bg-[var(--color-brand-500)] px-1.5 text-[9px] font-bold leading-none text-white">
                    현재
                  </span>
                )}
              </span>
              <span className={`w-16 text-right text-[13px] font-bold num ${isCurrent ? 'text-[var(--color-brand-700)]' : 'text-[var(--color-ink)]'}`}>
                {Math.round(lv.commission_rate * 100)}%
              </span>
              <span className="flex-1 text-right text-[12px] text-[var(--color-muted)] num">
                {lv.monthly_revenue_threshold > 0
                  ? `${(lv.monthly_revenue_threshold / 10000).toLocaleString('ko-KR')}만+`
                  : '—'}
              </span>
            </div>
          );
        })}
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full px-4 py-2.5 text-[12px] text-[var(--color-brand-500)] font-bold border-t border-[var(--color-hairline-soft)] hover:bg-[var(--color-surface-alt)]"
          >
            전체 11단계 보기
          </button>
        )}
      </Card>
      <p className="text-[10px] text-[var(--color-faint)] px-1">
        ⓘ 직전 3개월 평균 매출 기준. 임계값 도달 시 다음 달 1일에 자동 승급됩니다.
      </p>
    </Section>
  );
}

function SettlementCard({ settlement, commissionLabel: _commissionLabel }: { settlement: SettlementRow; commissionLabel: string }) {
  void _commissionLabel; // currently unused but kept for future
  const w = applyWithholding(Number(settlement.commission_amount));
  const statusInfo = (() => {
    switch (settlement.status) {
      case 'paid':   return { label: '지급 완료', color: 'var(--color-pos)', bg: '#10B98120' };
      case 'calculated': return { label: '계산 완료', color: 'var(--color-warn)', bg: '#F59E0B20' };
      case 'pending':
      default:       return { label: '집계 중',   color: 'var(--color-muted)', bg: '#5C657320' };
    }
  })();

  return (
    <Card variant="default" padding="md">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-[14px] font-bold text-[var(--color-ink)]">{formatPeriod(settlement.settlement_period)}</p>
          <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
            매출 <span className="font-mono num">{fmt(Number(settlement.gross_revenue))}</span> · 수수료율 {Math.round(Number(settlement.commission_rate_applied) * 100)}%
          </p>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ color: statusInfo.color, backgroundColor: statusInfo.bg }}
        >
          {statusInfo.label}
        </span>
      </div>
      <HairLine className="my-2" />
      <div className="grid grid-cols-3 gap-1 text-center">
        <Stat label="수수료" value={fmt(w.gross)} />
        <Stat label="원천징수" value={`-${fmt(w.withholding)}`} accent="var(--color-err)" />
        <Stat label="실수령" value={fmt(w.net)} accent="var(--color-pos)" bold />
      </div>
      {settlement.paid_at && (
        <p className="text-[10px] text-[var(--color-faint)] mt-2 text-center">
          {new Date(settlement.paid_at).toLocaleDateString('ko-KR')} 지급 완료
        </p>
      )}
    </Card>
  );
}

function EmptyState({ icon, title, desc }: { icon: 'wallet' | 'history' | 'box'; title: string; desc: string }) {
  return (
    <Card padding="lg">
      <div className="flex flex-col items-center text-center py-3">
        <div className="w-12 h-12 rounded-full bg-[var(--color-surface-alt)] flex items-center justify-center mb-3">
          <Icon name={icon} size={22} color="var(--color-faint)" />
        </div>
        <p className="text-[13px] font-bold text-[var(--color-ink)] mb-1">{title}</p>
        <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">{desc}</p>
      </div>
    </Card>
  );
}

function reasonLabel(reason: string | null): string {
  switch (reason) {
    case 'monthly_auto':       return '자동 재평가';
    case 'manual_change':      return '본사 수동 변경';
    case 'manual_override':    return '본사 직접 조정';
    case 'retention_demotion': return '실적 미달';
    case 'initial_registration':
    case 'backfill_initial':   return '초기 등록';
    default:                   return reason ?? '변경';
  }
}

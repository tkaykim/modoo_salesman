'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSalesmanStore } from '@/store/useSalesmanStore';
import { useMyTeams } from '@/hooks/useMyTeams';
import { useMyCoupons } from '@/hooks/useMyCoupons';
import { useMyRevenue } from '@/hooks/useMyRevenue';
import { useGradeLevels } from '@/hooks/useGradeLevels';
import { getGrade } from '@/lib/grades';
import type { Team } from '@/lib/teams';
import { AppBar, TabBar, NavSpacer, Card, Section, HairLine, Icon, Chip, type IconName } from '@/components/ui';
import CreateTeamSheet from '@/components/CreateTeamSheet';
import CreateOrderSheet from '@/components/CreateOrderSheet';
import PerformanceTab from '@/components/PerformanceTab';
import TeamDetailSheet from '@/components/TeamDetailSheet';
import MyOrdersSheet from '@/components/MyOrdersSheet';
import PriceCalculatorSheet from '@/components/PriceCalculatorSheet';
import NewOrderChooser from '@/components/NewOrderChooser';

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

type Tab = 'home' | 'crm' | 'performance' | 'more';

export default function MobileApp() {
  const [tab, setTab] = useState<Tab>('home');
  const [orderModal, setOrderModal] = useState<{ open: boolean; teamId: string | null }>({ open: false, teamId: null });
  const [lastCreatedOrderId, setLastCreatedOrderId] = useState<string | null>(null);
  const [detailTeamId, setDetailTeamId] = useState<string | null>(null);
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);

  const { user } = useSalesmanStore();
  const { teams, mutate: refetchTeams } = useMyTeams();
  const { primary: primaryCoupon } = useMyCoupons();
  const { thisMonthRevenue, totalRevenue } = useMyRevenue();

  const grade = getGrade(user?.grade);
  const reorderDue = teams.filter((t) => t.status === 'reorder_due');

  return (
    <div className="flex h-[100dvh] bg-[var(--color-surface-alt)] justify-center overflow-hidden">
      <main className="w-full max-w-md h-full bg-[var(--color-surface)] flex flex-col relative shadow-2xl">
        {/* Top bar */}
        <AppBar
          left={
            <div className="px-2">
              <p className="text-[10px] text-[var(--color-muted)] leading-tight">
                {grade.shortLabel} · {user?.salesman_code ?? ''}
              </p>
              <p className="text-[14px] font-bold text-[var(--color-ink)] leading-tight">
                {user?.name || user?.email || '영업사원'} 님
              </p>
            </div>
          }
          right={
            primaryCoupon ? (
              <button
                onClick={() => setTab('performance')}
                className="bg-[var(--color-brand-100)] px-2.5 py-1.5 rounded-full flex items-center gap-1 mr-2"
              >
                <Icon name="tag" size={12} color="var(--color-brand-700)" />
                <span className="font-bold text-[var(--color-brand-700)] text-[11px] font-mono">
                  {primaryCoupon.code}
                </span>
              </button>
            ) : null
          }
        />

        {/* Last order banner */}
        {lastCreatedOrderId && (
          <div className="bg-[var(--color-pos)]/10 border-b border-[var(--color-pos)]/30 px-4 py-2 flex justify-between items-center">
            <div className="text-[12px] text-[var(--color-ink)]">
              <span className="font-bold">주문 등록 완료</span>{' '}
              <span className="font-mono num">{lastCreatedOrderId}</span>
            </div>
            <button
              onClick={() => setLastCreatedOrderId(null)}
              className="text-[11px] text-[var(--color-muted)] font-bold"
            >
              닫기
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <NavSpacer>
            {tab === 'home' && (
              <HomeTab
                grade={grade}
                thisMonthRevenue={thisMonthRevenue}
                totalRevenue={totalRevenue}
                teams={teams}
                reorderDue={reorderDue}
                onCreateOrder={() => setChooserOpen(true)}
                onOpenCalculator={() => setCalcOpen(true)}
                onNavigate={setTab}
              />
            )}
            {tab === 'crm' && (
              <CrmTab
                teams={teams}
                onCreateOrderForTeam={(teamId) => setOrderModal({ open: true, teamId })}
                onOpenDetail={(teamId) => setDetailTeamId(teamId)}
                onTeamMutate={refetchTeams}
              />
            )}
            {tab === 'performance' && <PerformanceTab />}
            {tab === 'more' && <MoreTab />}
          </NavSpacer>
        </div>

        {/* Bottom Nav */}
        <TabBar<Tab>
          active={tab}
          onChange={setTab}
          items={[
            { id: 'home', icon: 'home', label: '홈' },
            { id: 'crm', icon: 'group', label: '단체', badge: reorderDue.length },
            { id: 'performance', icon: 'wallet', label: '실적' },
            { id: 'more', icon: 'menu', label: '더보기' },
          ]}
        />

        <CreateOrderSheet
          open={orderModal.open}
          preselectedTeamId={orderModal.teamId}
          onClose={() => setOrderModal({ open: false, teamId: null })}
          onCreated={(orderId) => {
            setLastCreatedOrderId(orderId);
            refetchTeams();
          }}
        />

        <TeamDetailSheet
          open={!!detailTeamId}
          teamId={detailTeamId}
          onClose={() => setDetailTeamId(null)}
          onCreateOrder={(teamId) => {
            setDetailTeamId(null);
            setOrderModal({ open: true, teamId });
          }}
          onEdit={(teamId) => {
            setDetailTeamId(null);
            setEditTeamId(teamId);
          }}
        />

        <CreateTeamSheet
          open={!!editTeamId}
          editTeamId={editTeamId}
          onClose={() => setEditTeamId(null)}
          onCreated={() => {
            refetchTeams();
            setEditTeamId(null);
          }}
        />

        <PriceCalculatorSheet open={calcOpen} onClose={() => setCalcOpen(false)} />

        <NewOrderChooser
          open={chooserOpen}
          onClose={() => setChooserOpen(false)}
          onQuickQuote={(teamId) => setOrderModal({ open: true, teamId })}
        />
      </main>
    </div>
  );
}

// =====================================================================
// HOME TAB
// =====================================================================
function HomeTab({
  grade,
  thisMonthRevenue,
  totalRevenue,
  teams,
  reorderDue,
  onCreateOrder,
  onOpenCalculator,
  onNavigate,
}: {
  grade: ReturnType<typeof getGrade>;
  thisMonthRevenue: number;
  totalRevenue: number;
  teams: Team[];
  reorderDue: Team[];
  onCreateOrder: () => void;
  onOpenCalculator: () => void;
  onNavigate: (t: Tab) => void;
}) {
  const { findNext } = useGradeLevels();
  const next = findNext(grade.level);
  const target = next ? next.monthly_revenue_threshold : grade.monthlyThreshold;
  const progress = target > 0 ? Math.min(100, Math.round((thisMonthRevenue / target) * 100)) : 100;

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Big CTA */}
      <button
        onClick={onCreateOrder}
        className="w-full bg-[var(--color-brand-500)] text-white rounded-[14px] p-4 flex items-center gap-3 active:bg-[var(--color-brand-600)]"
        style={{ boxShadow: 'var(--shadow-cta)' }}
      >
        <span className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
          <Icon name="cart" size={22} color="white" strokeWidth={2} />
        </span>
        <span className="flex-1 text-left">
          <span className="block font-bold text-[15px]">새 주문 생성</span>
          <span className="block text-[11px] opacity-80 mt-0.5">제품 · 디자인 · 사이즈별 수량 (admin 흐름)</span>
        </span>
        <Icon name="chevron-r" size={18} color="white" />
      </button>

      {/* 단가계산기 */}
      <button
        onClick={onOpenCalculator}
        className="w-full bg-white border border-[var(--color-hairline)] rounded-[14px] p-3.5 flex items-center gap-3 active:bg-[var(--color-surface-alt)]"
      >
        <span className="w-9 h-9 bg-[var(--color-brand-100)] rounded-full flex items-center justify-center">
          <Icon name="ruler" size={18} color="var(--color-brand-500)" />
        </span>
        <span className="flex-1 text-left">
          <span className="block font-bold text-[14px] text-[var(--color-ink)]">단가 계산기</span>
          <span className="block text-[11px] text-[var(--color-muted)] mt-0.5">디자인 없이 빠른 견적</span>
        </span>
        <Icon name="chevron-r" size={16} color="var(--color-faint)" />
      </button>

      {/* KPI 2-up */}
      <div className="grid grid-cols-2 gap-3">
        <KPICard label="이번 달 실적" value={fmt(thisMonthRevenue)} />
        <KPICard
          label={`예상 정산 (${Math.round(grade.commissionRate * 100)}%)`}
          value={fmt(thisMonthRevenue * grade.commissionRate)}
          accent="var(--color-brand-500)"
        />
      </div>

      {/* Grade progress */}
      <Card variant="inverted" padding="md">
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-[11px] text-white/60">
              {next ? `${next.label} 승급까지` : '최고 등급 유지 중'}
            </p>
            <p className="font-bold text-[14px] mt-0.5 font-mono num">
              {next ? `${fmt(Math.max(0, target - thisMonthRevenue))} 남음` : `${fmt(thisMonthRevenue)}`}
            </p>
          </div>
          <button
            onClick={() => onNavigate('performance')}
            className="text-[11px] text-white/80 underline-offset-2 underline"
          >
            기준표 보기
          </button>
        </div>
        <div className="w-full bg-white/15 rounded-full h-1.5 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${grade.trackColor}`} style={{ width: `${progress}%` }} />
        </div>
      </Card>

      {/* Reorder alerts */}
      <Section title={`재구매 알림 (${reorderDue.length})`}>
        <Card padding="none">
          {reorderDue.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-[var(--color-muted)]">
              현재 재발주 임박 단체가 없습니다.
            </div>
          ) : (
            <div>
              {reorderDue.slice(0, 5).map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => onNavigate('crm')}
                  className={`w-full px-4 py-3 flex justify-between items-center text-left active:bg-[var(--color-surface-alt)] ${i > 0 ? 'border-t border-[var(--color-hairline-soft)]' : ''}`}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-[14px] text-[var(--color-ink)] truncate">{t.name}</p>
                    <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
                      {t.lastOrderDays !== null ? `${t.lastOrderDays}일 전 주문` : '주문 없음'}
                      {t.reorderCycleMonths ? ` · 주기 ${t.reorderCycleMonths}개월` : ''}
                    </p>
                  </div>
                  <Icon name="chevron-r" size={16} color="var(--color-faint)" />
                </button>
              ))}
            </div>
          )}
        </Card>
      </Section>

      {/* Summary */}
      <button
        onClick={() => onNavigate('crm')}
        className="w-full flex justify-between items-center"
      >
        <Card padding="md" className="w-full active:bg-[var(--color-surface-alt)]">
          <div className="flex justify-between items-center">
            <div className="text-left">
              <p className="text-[11px] text-[var(--color-muted)] mb-0.5">관리 단체 / 누적 매출</p>
              <p className="text-[13px] font-bold text-[var(--color-ink)]">
                {teams.length}개 · <span className="font-mono num">{fmt(totalRevenue)}</span>
              </p>
            </div>
            <Icon name="chevron-r" size={16} color="var(--color-faint)" />
          </div>
        </Card>
      </button>
    </div>
  );
}

function KPICard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card padding="sm">
      <p className="text-[11px] text-[var(--color-muted)] mb-1">{label}</p>
      <p className="text-[15px] font-bold font-mono num" style={{ color: accent ?? 'var(--color-ink)' }}>{value}</p>
    </Card>
  );
}

// =====================================================================
// CRM TAB
// =====================================================================
function CrmTab({
  teams,
  onCreateOrderForTeam,
  onOpenDetail,
  onTeamMutate,
}: {
  teams: Team[];
  onCreateOrderForTeam: (teamId: string) => void;
  onOpenDetail: (teamId: string) => void;
  onTeamMutate: () => void;
}) {
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'reorder' | 'active' | 'dormant'>('all');

  const filtered = teams
    .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    .filter((t) => {
      if (filter === 'all') return true;
      if (filter === 'reorder') return t.status === 'reorder_due';
      if (filter === 'active') return t.status === 'active' || t.status === 'new';
      if (filter === 'dormant') return t.status === 'dormant';
      return true;
    });

  const counts = {
    reorder: teams.filter((t) => t.status === 'reorder_due').length,
    active: teams.filter((t) => t.status === 'active' || t.status === 'new').length,
    dormant: teams.filter((t) => t.status === 'dormant').length,
  };

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-[18px] font-bold text-[var(--color-ink)]">내 단체 ({teams.length})</h2>
        <button
          onClick={() => setCreateTeamOpen(true)}
          className="flex items-center gap-1 text-[13px] bg-[var(--color-ink)] text-white px-3 py-1.5 rounded-[10px] active:opacity-90 font-bold"
        >
          <Icon name="plus" size={14} color="white" /> 등록
        </button>
      </div>

      <Card padding="sm" className="flex items-center gap-2">
        <Icon name="search" size={16} color="var(--color-faint)" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="단체명 검색..."
          className="flex-1 outline-none text-[14px] bg-transparent"
        />
      </Card>

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>전체 {teams.length}</Chip>
        <Chip active={filter === 'reorder'} onClick={() => setFilter('reorder')}>재발주 {counts.reorder}</Chip>
        <Chip active={filter === 'active'} onClick={() => setFilter('active')}>활성 {counts.active}</Chip>
        <Chip active={filter === 'dormant'} onClick={() => setFilter('dormant')}>휴면 {counts.dormant}</Chip>
      </div>

      {teams.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center text-center py-3">
            <div className="w-12 h-12 rounded-full bg-[var(--color-surface-alt)] flex items-center justify-center mb-3">
              <Icon name="group" size={22} color="var(--color-faint)" />
            </div>
            <p className="text-[14px] font-bold text-[var(--color-ink)] mb-1">아직 등록된 단체가 없어요</p>
            <p className="text-[11px] text-[var(--color-muted)] mb-4">[+ 등록] 버튼으로 첫 단체를 추가하세요.</p>
            <button
              onClick={() => setCreateTeamOpen(true)}
              className="bg-[var(--color-brand-500)] text-white font-bold py-2.5 px-5 rounded-[12px] text-[13px] inline-flex items-center gap-2 active:bg-[var(--color-brand-600)]"
            >
              <Icon name="plus" size={14} color="white" /> 새 단체 추가
            </button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((team) => {
            const isUrgent = team.status === 'reorder_due';
            const phoneHref = team.phone ? `tel:${team.phone.replace(/[^0-9+]/g, '')}` : null;
            return (
              <Card key={team.id} padding="md" className={isUrgent ? 'border-[var(--color-warn)]' : ''}>
                <button
                  onClick={() => onOpenDetail(team.id)}
                  className="w-full text-left mb-2 active:opacity-80"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 flex items-start gap-2.5">
                      {team.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={team.logoUrl} alt={team.name} className="w-10 h-10 rounded-[8px] object-contain bg-[var(--color-surface-alt)] flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-[8px] bg-[var(--color-brand-100)] flex items-center justify-center flex-shrink-0">
                          <Icon name="group" size={18} color="var(--color-brand-500)" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        {team.category && (
                          <span className="text-[10px] font-bold bg-[var(--color-surface-alt)] text-[var(--color-muted)] px-1.5 py-0.5 rounded mb-1 inline-block">
                            {team.category}
                          </span>
                        )}
                        <h3 className="font-bold text-[15px] text-[var(--color-ink)] truncate">{team.name}</h3>
                        <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
                          {team.decisionMaker || '담당자 미기재'}
                          {team.phone ? ` · ${team.phone}` : ''}
                        </p>
                        <p className="text-[10px] text-[var(--color-faint)] mt-0.5 font-mono num">
                          누적 {team.totalOrders}건 · {fmt(team.totalRevenue)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isUrgent && <span className="w-2 h-2 bg-[var(--color-err)] rounded-full animate-pulse" />}
                      <Icon name="chevron-r" size={16} color="var(--color-faint)" />
                    </div>
                  </div>
                </button>
                <HairLine className="my-2" />
                <div className="flex gap-1.5">
                  {phoneHref ? (
                    <a
                      href={phoneHref}
                      className="flex-1 bg-[var(--color-pos)]/10 text-[var(--color-pos)] py-2 rounded-[10px] text-[12px] font-bold flex items-center justify-center gap-1 active:bg-[var(--color-pos)]/20"
                    >
                      <Icon name="phone" size={14} color="var(--color-pos)" /> 전화
                    </a>
                  ) : (
                    <button disabled className="flex-1 bg-[var(--color-surface-alt)] text-[var(--color-faint)] py-2 rounded-[10px] text-[12px] font-bold">
                      전화 없음
                    </button>
                  )}
                  <button
                    onClick={() => onCreateOrderForTeam(team.id)}
                    className="flex-[1.5] bg-[var(--color-brand-500)] text-white py-2 rounded-[10px] text-[12px] font-bold flex items-center justify-center gap-1 active:bg-[var(--color-brand-600)]"
                  >
                    <Icon name="cart" size={14} color="white" /> 주문 생성
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <CreateTeamSheet open={createTeamOpen} onClose={() => setCreateTeamOpen(false)} onCreated={onTeamMutate} />
    </div>
  );
}

// =====================================================================
// MORE TAB
// =====================================================================
function MoreTab() {
  const router = useRouter();
  const { logout, user } = useSalesmanStore();
  const [myOrdersOpen, setMyOrdersOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const items: { icon: IconName; label: string; desc: string; onClick?: () => void; disabled?: boolean }[] = [
    { icon: 'box',     label: '내 주문 내역', desc: '본인이 만든 / 단체 주문 전체', onClick: () => setMyOrdersOpen(true) },
    { icon: 'sparkle', label: 'e-Learning',   desc: '준비중', disabled: true },
    { icon: 'send',    label: '본사 채널',    desc: '준비중', disabled: true },
    { icon: 'menu',    label: '설정',         desc: '준비중', disabled: true },
    { icon: 'info',    label: 'FAQ',          desc: '준비중', disabled: true },
  ];

  return (
    <div className="px-4 py-4 space-y-3">
      <Card padding="md">
        <p className="text-[11px] text-[var(--color-muted)] mb-0.5">로그인 계정</p>
        <p className="text-[14px] font-bold text-[var(--color-ink)]">{user?.email}</p>
        <p className="text-[10px] text-[var(--color-faint)] mt-0.5 font-mono">
          {user?.salesman_code} · {user?.grade ?? 'LV0'}
        </p>
      </Card>

      <Card padding="none">
        {items.map((m, i) => (
          <button
            key={m.label}
            onClick={m.onClick}
            disabled={m.disabled}
            className={`w-full px-4 py-3 flex items-center gap-3 active:bg-[var(--color-surface-alt)] disabled:opacity-50 ${i > 0 ? 'border-t border-[var(--color-hairline-soft)]' : ''}`}
          >
            <div className="w-8 h-8 flex items-center justify-center rounded-[10px] bg-[var(--color-surface-alt)]">
              <Icon name={m.icon} size={18} color="var(--color-muted)" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-[13px] text-[var(--color-ink)] font-semibold">{m.label}</div>
              <div className="text-[10px] text-[var(--color-faint)]">{m.desc}</div>
            </div>
            <Icon name="chevron-r" size={14} color="var(--color-faint)" />
          </button>
        ))}
      </Card>

      <MyOrdersSheet open={myOrdersOpen} onClose={() => setMyOrdersOpen(false)} />

      <button
        onClick={handleLogout}
        className="w-full bg-[var(--color-err)]/10 border border-[var(--color-err)]/30 rounded-[14px] p-3 flex items-center justify-center gap-2 text-[var(--color-err)] font-bold active:bg-[var(--color-err)]/20 mt-4"
      >
        <Icon name="logout" size={16} color="var(--color-err)" /> 로그아웃
      </button>

      <p className="text-[10px] text-[var(--color-faint)] text-center pt-4">
        모두의 유니폼 영업사원 앱 v0.3
      </p>
    </div>
  );
}

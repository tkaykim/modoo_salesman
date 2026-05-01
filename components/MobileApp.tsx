'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSalesmanStore } from '@/store/useSalesmanStore';
import { useMyTeams } from '@/hooks/useMyTeams';
import { CATEGORY_COLORS, type Team, type TeamStatus } from '@/lib/teams';
import CreateTeamSheet from '@/components/CreateTeamSheet';
import {
  Home,
  Users,
  Briefcase,
  MoreHorizontal,
  LogOut,
  Phone,
  MessageCircle,
  FileText,
  ChevronDown,
  Plus,
  Inbox,
} from 'lucide-react';

const fmt = (n: number) => `₩${n.toLocaleString()}`;

const formatLastOrder = (days: number | null) => {
  if (days === null) return '주문 없음';
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 ${Math.floor((days % 365) / 30)}개월 전`;
};

const getReorderDaysLeft = (t: Team) => {
  if (t.reorderCycleMonths === null || t.lastOrderDays === null) return null;
  return t.reorderCycleMonths * 30 - t.lastOrderDays;
};

type MobileTab = 'home' | 'teams' | 'pipeline' | 'more';
type FilterKey = 'all' | 'reorder_due' | 'active' | 'dormant';
type SortKey = 'reorder' | 'last_order' | 'total_revenue' | 'name';

export default function MobileApp() {
  const [tab, setTab] = useState<MobileTab>('teams');

  // teams 탭 상태
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('reorder');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { teams, isLoading, error, mutate } = useMyTeams();

  const counts = useMemo(
    () => ({
      all: teams.length,
      reorder_due: teams.filter((t) => t.status === 'reorder_due').length,
      active: teams.filter((t) => t.status === 'active' || t.status === 'new').length,
      dormant: teams.filter((t) => t.status === 'dormant').length,
    }),
    [teams]
  );

  const filteredTeams = useMemo(() => {
    return teams
      .filter((t) => {
        if (filter === 'all') return true;
        if (filter === 'reorder_due') return t.status === 'reorder_due';
        if (filter === 'active') return t.status === 'active' || t.status === 'new';
        if (filter === 'dormant') return t.status === 'dormant';
        return true;
      })
      .sort((a, b) => {
        if (sort === 'reorder') {
          const aLeft = getReorderDaysLeft(a) ?? Number.MAX_SAFE_INTEGER;
          const bLeft = getReorderDaysLeft(b) ?? Number.MAX_SAFE_INTEGER;
          return aLeft - bLeft;
        }
        if (sort === 'last_order') {
          const aDays = a.lastOrderDays ?? Number.MAX_SAFE_INTEGER;
          const bDays = b.lastOrderDays ?? Number.MAX_SAFE_INTEGER;
          return aDays - bDays;
        }
        if (sort === 'total_revenue') return b.totalRevenue - a.totalRevenue;
        return a.name.localeCompare(b.name);
      });
  }, [teams, filter, sort]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gray-50">
      <Header reorderCount={counts.reorder_due} />

      <main className="flex-1 overflow-y-auto pb-20">
        {tab === 'home' && <HomeTab teams={teams} />}
        {tab === 'teams' && (
          <TeamsTab
            isLoading={isLoading}
            error={error}
            filter={filter}
            setFilter={setFilter}
            sort={sort}
            setSort={setSort}
            counts={counts}
            teams={filteredTeams}
            totalTeams={teams.length}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onAddClick={() => setCreateOpen(true)}
          />
        )}
        {tab === 'pipeline' && <PipelineTab />}
        {tab === 'more' && <MoreTab />}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 grid grid-cols-4 z-30 pb-[env(safe-area-inset-bottom)]">
        <TabButton active={tab === 'home'} onClick={() => setTab('home')} icon={Home} label="홈" />
        <TabButton active={tab === 'teams'} onClick={() => setTab('teams')} icon={Users} label="내 단체" badge={counts.reorder_due} />
        <TabButton active={tab === 'pipeline'} onClick={() => setTab('pipeline')} icon={Briefcase} label="진행" />
        <TabButton active={tab === 'more'} onClick={() => setTab('more')} icon={MoreHorizontal} label="더보기" />
      </nav>

      <CreateTeamSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          mutate();
        }}
      />
    </div>
  );
}

function Header({ reorderCount }: { reorderCount: number }) {
  const { user } = useSalesmanStore();
  const gradeLabel = user?.grade ?? '—';
  const code = user?.salesman_code ?? '';
  return (
    <header
      className="bg-gradient-to-r from-brand-500 to-brand-600 text-white px-4 py-3 sticky top-0 z-20"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
    >
      <div className="flex justify-between items-center">
        <div>
          <div className="text-[10px] opacity-80">{code} · {gradeLabel}</div>
          <div className="text-base font-bold">{user?.name || user?.email || '영업사원'}님</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] opacity-80">재발주 임박</div>
          <div className="text-base font-bold font-mono">{reorderCount}건</div>
        </div>
      </div>
    </header>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
}) {
  return (
    <button onClick={onClick} className={`relative py-2.5 flex flex-col items-center gap-0.5 text-[10px] ${active ? 'text-brand-600 font-bold' : 'text-gray-500'}`}>
      <Icon className="w-5 h-5" />
      <span>{label}</span>
      {badge && badge > 0 ? (
        <span className="absolute top-1 right-[28%] bg-red-500 text-white text-[9px] font-bold rounded-full px-1.5 py-0.5">{badge}</span>
      ) : null}
    </button>
  );
}

// =====================================================================
// 홈 탭
// =====================================================================
function HomeTab({ teams }: { teams: Team[] }) {
  const reorderTeams = teams.filter((t) => t.status === 'reorder_due');
  const totalRevenue = teams.reduce((s, t) => s + t.totalRevenue, 0);

  return (
    <div className="p-3 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <KPI label="관리 단체" value={`${teams.length}개`} sub="활성 + 휴면 포함" tone="brand" />
        <KPI label="누적 매출" value={fmt(totalRevenue)} sub="이 단체 전체 합" tone="blue" />
        <KPI label="재발주 임박" value={`${reorderTeams.length}팀`} sub="지금 연락 권장" tone="sky" />
      </div>

      {reorderTeams.length > 0 ? (
        <div className="bg-orange-100 border-2 border-orange-300 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🔔</span>
            <span className="text-sm font-bold text-orange-900">재발주 임박 {reorderTeams.length}팀</span>
          </div>
          <div className="text-xs text-orange-800 leading-relaxed">
            {reorderTeams.slice(0, 4).map((t) => t.name).join(' · ')}
            {reorderTeams.length > 4 ? ` 외 ${reorderTeams.length - 4}팀` : ''}
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="text-xs text-blue-900 leading-relaxed">
            현재 재발주 임박 단체가 없습니다. 새 단체 등록은 [내 단체] 탭에서 가능합니다.
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) {
  const map: Record<string, string> = {
    brand: 'bg-brand-100 text-brand-900',
    blue: 'bg-blue-100 text-blue-900',
    sky: 'bg-sky-100 text-sky-900',
  };
  return (
    <div className={`rounded-xl p-3 ${map[tone]}`}>
      <div className="text-[9px] font-semibold opacity-70">{label}</div>
      <div className="text-sm font-bold font-mono">{value}</div>
      <div className="text-[9px] opacity-70">{sub}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: TeamStatus }) {
  const map: Record<TeamStatus, { label: string; cls: string }> = {
    new: { label: '신규', cls: 'bg-blue-500 text-white' },
    active: { label: '활성', cls: 'bg-green-500 text-white' },
    reorder_due: { label: '재발주 임박', cls: 'bg-orange-500 text-white animate-pulse' },
    dormant: { label: '휴면', cls: 'bg-gray-400 text-white' },
  };
  const m = map[status];
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${m.cls}`}>{m.label}</span>;
}

// =====================================================================
// 내 단체 탭
// =====================================================================
function TeamsTab({
  isLoading, error, filter, setFilter, sort, setSort, counts, teams, totalTeams, expandedId, setExpandedId, onAddClick,
}: {
  isLoading: boolean;
  error: Error | null;
  filter: FilterKey;
  setFilter: (f: FilterKey) => void;
  sort: SortKey;
  setSort: (s: SortKey) => void;
  counts: { all: number; reorder_due: number; active: number; dormant: number };
  teams: Team[];
  totalTeams: number;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  onAddClick: () => void;
}) {
  return (
    <div>
      {/* Sticky 컨트롤 */}
      <div className="px-3 py-3 bg-white border-b border-gray-200 sticky top-[52px] z-10">
        <div className="flex justify-between items-baseline mb-2">
          <div className="text-base font-bold text-gray-900">내 단체 ({counts.all})</div>
          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="text-xs border border-gray-300 rounded-md px-2 py-1 bg-white"
            >
              <option value="reorder">재발주 임박순</option>
              <option value="last_order">최근 주문순</option>
              <option value="total_revenue">누적 매출순</option>
              <option value="name">이름순</option>
            </select>
            <button
              onClick={onAddClick}
              className="bg-brand-500 text-white rounded-md px-2 py-1 text-xs font-bold flex items-center gap-1 active:bg-brand-600"
            >
              <Plus className="w-3.5 h-3.5" /> 추가
            </button>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {([
            { k: 'all' as const, label: '전체', n: counts.all },
            { k: 'reorder_due' as const, label: '재발주 임박', n: counts.reorder_due, hot: true },
            { k: 'active' as const, label: '활성', n: counts.active },
            { k: 'dormant' as const, label: '휴면', n: counts.dormant },
          ]).map((f) => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                filter === f.k
                  ? f.hot ? 'bg-orange-500 text-white' : 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f.label}{f.n > 0 && ` (${f.n})`}
            </button>
          ))}
        </div>
      </div>

      {/* 본문 */}
      {isLoading ? (
        <div className="p-10 text-center">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">단체 목록 불러오는 중...</p>
        </div>
      ) : error ? (
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
            <div className="font-bold mb-1">불러오기 실패</div>
            <div className="text-xs">{error.message}</div>
          </div>
        </div>
      ) : totalTeams === 0 ? (
        <EmptyTeams onAddClick={onAddClick} />
      ) : teams.length === 0 ? (
        <div className="p-10 text-center text-sm text-gray-500">
          이 필터에 해당하는 단체가 없습니다.
        </div>
      ) : (
        <div className="p-3 space-y-2.5">
          {teams.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              expanded={expandedId === t.id}
              onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyTeams({ onAddClick }: { onAddClick: () => void }) {
  return (
    <div className="p-8 text-center">
      <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-brand-100 flex items-center justify-center">
        <Inbox className="w-8 h-8 text-brand-600" />
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1">아직 등록된 단체가 없어요</h3>
      <p className="text-xs text-gray-600 mb-4 leading-relaxed">
        첫 단체를 등록해 영업 활동을 추적해보세요.<br />
        단체별 주문 이력·재발주 사이클·연락처를 한 곳에서 관리합니다.
      </p>
      <button
        onClick={onAddClick}
        className="bg-brand-500 text-white font-bold py-3 px-6 rounded-xl inline-flex items-center gap-2 active:bg-brand-600"
      >
        <Plus className="w-4 h-4" /> 새 단체 추가하기
      </button>
    </div>
  );
}

function TeamCard({ team, expanded, onToggle }: { team: Team; expanded: boolean; onToggle: () => void }) {
  const daysLeft = getReorderDaysLeft(team);
  return (
    <div className={`bg-white rounded-xl border-2 ${team.status === 'reorder_due' ? 'border-orange-400' : 'border-gray-200'} overflow-hidden`}>
      <button onClick={onToggle} className="w-full p-3 text-left active:bg-gray-50">
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-1 flex-wrap mb-1">
              {team.category && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CATEGORY_COLORS[team.category]}`}>{team.category}</span>
              )}
              <StatusBadge status={team.status} />
              {!team.isActive && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">비공개</span>
              )}
            </div>
            <div className="text-base font-bold text-gray-900 leading-tight">{team.name}</div>
            <div className="text-xs text-gray-500">
              {team.size ? `${team.size}명` : '인원 미기재'}
              {team.decisionMaker ? ` · ${team.decisionMaker}` : ''}
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform mt-1 ${expanded ? 'rotate-180' : ''}`} />
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="text-gray-500 text-[10px]">📅 마지막 주문</div>
            <div className="font-bold text-gray-900">{formatLastOrder(team.lastOrderDays)}</div>
            <div className="font-mono text-gray-700 text-[11px]">
              {team.lastOrderAmount > 0 ? fmt(team.lastOrderAmount) : '-'}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="text-gray-500 text-[10px]">📊 누적</div>
            <div className="font-bold text-gray-900">{team.totalOrders}건</div>
            <div className="font-mono text-gray-700 text-[11px]">
              {team.totalRevenue > 0 ? fmt(team.totalRevenue) : '-'}
            </div>
          </div>
        </div>

        {team.status === 'reorder_due' && daysLeft !== null && (
          <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg p-2 text-xs text-orange-900">
            ⏰ 재발주 사이클 {team.reorderCycleMonths}개월 — {daysLeft <= 0 ? `이미 ${Math.abs(daysLeft)}일 지남` : `${daysLeft}일 남음`}. 지금 연락 권장.
          </div>
        )}
        {team.status === 'dormant' && team.lastOrderDays !== null && (
          <div className="mt-2 bg-gray-100 rounded-lg p-2 text-xs text-gray-700">
            💤 {Math.floor(team.lastOrderDays / 30)}개월 무연락
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-3 space-y-3">
          {team.note && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 text-xs">
              <div className="text-[10px] font-bold text-yellow-900 mb-1">📝 메모</div>
              <div className="text-yellow-900">{team.note}</div>
            </div>
          )}

          {team.history.length > 0 ? (
            <div>
              <div className="text-xs font-bold text-gray-700 mb-1.5">📜 주문 이력 ({team.history.length}건)</div>
              <div className="space-y-1.5">
                {team.history.map((h, i) => (
                  <div key={i} className="bg-white rounded-lg p-2.5 text-xs border border-gray-200">
                    <div className="flex justify-between mb-0.5">
                      <span className="font-mono text-gray-600">{h.date}</span>
                      <span className="font-mono font-bold text-gray-900">{fmt(h.amount)}</span>
                    </div>
                    <div className="text-gray-700">{h.item}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500 bg-white rounded-lg p-3 border border-gray-200">
              아직 주문 이력이 없습니다. 결제 발생 시 자동으로 표시됩니다.
            </div>
          )}

          {!team.isActive && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-900">
              💡 이 단체는 비공개 상태(메타만 등록). 로고·제품 라인업 셋업 후 활성화하면 단체장에게 공유 링크 전달 가능.
            </div>
          )}

          <div className="grid grid-cols-3 gap-1.5">
            <ActionBtn
              icon={Phone}
              label="전화"
              color="bg-green-500"
              href={team.phone ? `tel:${team.phone.replace(/[^0-9+]/g, '')}` : undefined}
              disabled={!team.phone}
            />
            <ActionBtn icon={MessageCircle} label="카톡" color="bg-yellow-400" textDark />
            <ActionBtn icon={FileText} label="견적" color="bg-brand-500" />
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  icon: Icon, label, color, textDark, href, disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  textDark?: boolean;
  href?: string;
  disabled?: boolean;
}) {
  const className = `${color} ${textDark ? 'text-yellow-900' : 'text-white'} text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-1 active:opacity-80 ${disabled ? 'opacity-40 pointer-events-none' : ''}`;
  if (href && !disabled) {
    return (
      <a href={href} className={className}>
        <Icon className="w-4 h-4" />
        {label}
      </a>
    );
  }
  return (
    <button disabled={disabled} className={className}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

// =====================================================================
// 진행 탭 (Pipeline) — 현재 placeholder, 향후 deals 테이블 연동
// =====================================================================
function PipelineTab() {
  return (
    <div className="p-6 text-center">
      <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-brand-100 flex items-center justify-center">
        <Briefcase className="w-8 h-8 text-brand-600" />
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1">진행 중 거래</h3>
      <p className="text-xs text-gray-600 leading-relaxed">
        탐색 → 제안 → 시안 → 계약 → 생산 → 추천 단계별 현황.<br />
        견적·딜 시스템 연동 후 활성화 예정.
      </p>
    </div>
  );
}

// =====================================================================
// 더보기 탭
// =====================================================================
function MoreTab() {
  const router = useRouter();
  const { logout, user } = useSalesmanStore();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="p-3 space-y-2">
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-2">
        <div className="text-xs text-gray-500">로그인 계정</div>
        <div className="text-sm font-bold text-gray-900">{user?.email}</div>
        <div className="text-[10px] text-gray-500 mt-0.5 font-mono">
          {user?.salesman_code} · {user?.grade}
        </div>
      </div>

      {[
        { icon: '📊', label: '내 매출 통계' },
        { icon: '🏆', label: '동료 랭킹' },
        { icon: '📅', label: '월간 컨벤션' },
        { icon: '📚', label: 'e-Learning' },
        { icon: '💬', label: '본사 채널' },
        { icon: '⚙️', label: '설정' },
        { icon: '❓', label: 'FAQ' },
      ].map((m) => (
        <button key={m.label} className="w-full bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 active:bg-gray-50">
          <span className="text-xl">{m.icon}</span>
          <span className="text-sm text-gray-900 font-medium">{m.label}</span>
        </button>
      ))}

      <button
        onClick={handleLogout}
        className="w-full bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-center gap-2 text-red-700 font-bold active:bg-red-100 mt-4"
      >
        <LogOut className="w-4 h-4" />
        로그아웃
      </button>
    </div>
  );
}

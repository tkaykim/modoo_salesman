'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Wallet,
  MoreHorizontal,
  Search,
  ChevronRight,
  Plus,
  AlertCircle,
  Tag,
  LogOut,
  Phone,
  ShoppingCart,
  Receipt,
} from 'lucide-react';
import { useSalesmanStore } from '@/store/useSalesmanStore';
import { useMyTeams } from '@/hooks/useMyTeams';
import { useMyCoupons } from '@/hooks/useMyCoupons';
import { getGrade, getNextGrade, type GradeInfo } from '@/lib/grades';
import type { Team } from '@/lib/teams';
import CreateTeamSheet from '@/components/CreateTeamSheet';
import CreateOrderSheet from '@/components/CreateOrderSheet';

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

type Tab = 'home' | 'crm' | 'performance' | 'more';

export default function MobileApp() {
  const [tab, setTab] = useState<Tab>('home');
  const [orderModal, setOrderModal] = useState<{ open: boolean; teamId: string | null }>({ open: false, teamId: null });
  const [lastCreatedOrderId, setLastCreatedOrderId] = useState<string | null>(null);

  const { user } = useSalesmanStore();
  const { teams, mutate: refetchTeams } = useMyTeams();
  const { primary: primaryCoupon } = useMyCoupons();

  const grade = getGrade(user?.grade);
  const nextGrade = getNextGrade(grade.level);

  // 이번달 / 누적 매출 — history에서 계산 (현재 0인 경우 많음)
  const thisMonthRevenue = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return teams.reduce((sum, t) => sum + t.history.filter((h) => h.date.startsWith(ym)).reduce((s, h) => s + h.amount, 0), 0);
  }, [teams]);
  const totalRevenue = useMemo(() => teams.reduce((s, t) => s + t.totalRevenue, 0), [teams]);

  return (
    <div className="flex h-[100dvh] bg-gray-100 font-sans text-slate-800 justify-center overflow-hidden">
      <main className="w-full max-w-md h-full bg-slate-50 flex flex-col relative shadow-2xl">
        {/* Header */}
        <header
          className="bg-white px-5 pb-3 shadow-sm flex justify-between items-end z-20"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 28px)' }}
        >
          <div>
            <p className="text-[11px] text-slate-500 font-medium mb-0.5">
              <span className={`font-bold ${grade.badgeColor.replace('text-', 'text-').replace('-300', '-600').replace('-400', '-700')}`}>
                {grade.shortLabel} · {grade.label}
              </span>
              {' · '}
              {user?.salesman_code ?? ''}
            </p>
            <h1 className="text-lg font-bold text-slate-900">{user?.name || user?.email || '영업사원'} 님</h1>
          </div>
          {primaryCoupon && (
            <button
              onClick={() => setTab('performance')}
              className="bg-brand-50 px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-brand-100 active:bg-brand-100"
            >
              <Tag className="w-3.5 h-3.5 text-brand-600" />
              <span className="font-bold text-brand-700 text-xs font-mono">{primaryCoupon.code}</span>
            </button>
          )}
        </header>

        {/* Last order banner */}
        {lastCreatedOrderId && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex justify-between items-center">
            <div className="text-xs text-emerald-800">
              <span className="font-bold">주문 등록 완료</span> <span className="font-mono">{lastCreatedOrderId}</span>
            </div>
            <button onClick={() => setLastCreatedOrderId(null)} className="text-[11px] text-emerald-700 font-bold">닫기</button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-24">
          {tab === 'home' && (
            <HomeTab
              grade={grade}
              nextGrade={nextGrade}
              thisMonthRevenue={thisMonthRevenue}
              totalRevenue={totalRevenue}
              teams={teams}
              onCreateOrder={() => setOrderModal({ open: true, teamId: null })}
              onNavigate={setTab}
            />
          )}
          {tab === 'crm' && (
            <CrmTab
              teams={teams}
              onCreateOrderForTeam={(teamId) => setOrderModal({ open: true, teamId })}
              onTeamMutate={refetchTeams}
            />
          )}
          {tab === 'performance' && (
            <PerformanceTab
              grade={grade}
              nextGrade={nextGrade}
              thisMonthRevenue={thisMonthRevenue}
              totalRevenue={totalRevenue}
              primaryCoupon={primaryCoupon}
            />
          )}
          {tab === 'more' && <MoreTab />}
        </div>

        {/* Bottom Nav */}
        <nav
          className="absolute bottom-0 w-full bg-white border-t border-gray-200 grid grid-cols-4 z-30 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)', paddingTop: '8px' }}
        >
          <NavItem active={tab === 'home'}        onClick={() => setTab('home')}        icon={<LayoutDashboard size={22} />} label="홈" />
          <NavItem active={tab === 'crm'}         onClick={() => setTab('crm')}         icon={<Users size={22} />}           label="단체" />
          <NavItem active={tab === 'performance'} onClick={() => setTab('performance')} icon={<Wallet size={22} />}          label="실적" />
          <NavItem active={tab === 'more'}        onClick={() => setTab('more')}        icon={<MoreHorizontal size={22} />}  label="더보기" />
        </nav>

        <CreateOrderSheet
          open={orderModal.open}
          preselectedTeamId={orderModal.teamId}
          onClose={() => setOrderModal({ open: false, teamId: null })}
          onCreated={(orderId) => {
            setLastCreatedOrderId(orderId);
            refetchTeams();
          }}
        />
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-0.5 py-1 ${active ? 'text-brand-600' : 'text-gray-400'}`}>
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

// =====================================================================
// HOME TAB
// =====================================================================
function HomeTab({
  grade,
  nextGrade,
  thisMonthRevenue,
  totalRevenue,
  teams,
  onCreateOrder,
  onNavigate,
}: {
  grade: GradeInfo;
  nextGrade: GradeInfo | null;
  thisMonthRevenue: number;
  totalRevenue: number;
  teams: Team[];
  onCreateOrder: () => void;
  onNavigate: (t: Tab) => void;
}) {
  const reorderDue = teams.filter((t) => t.status === 'reorder_due');
  const target = nextGrade ? nextGrade.monthlyThreshold : grade.monthlyThreshold;
  const progress = target > 0 ? Math.min(100, Math.round((thisMonthRevenue / target) * 100)) : 100;

  return (
    <div className="p-4 space-y-4">
      {/* Big CTA */}
      <button
        onClick={onCreateOrder}
        className="w-full bg-brand-500 active:bg-brand-600 text-white rounded-2xl p-4 flex items-center gap-3 shadow-md"
      >
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
          <ShoppingCart className="w-5 h-5" />
        </div>
        <div className="flex-1 text-left">
          <div className="font-bold text-base">새 주문 생성</div>
          <div className="text-[11px] opacity-80">제품 · 인쇄 · 사이즈별 수량 견적</div>
        </div>
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
          <p className="text-[11px] text-gray-500 mb-1">이번 달 실적</p>
          <p className="text-base font-bold text-slate-900 font-mono">{fmt(thisMonthRevenue)}</p>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
          <p className="text-[11px] text-gray-500 mb-1">예상 정산금 ({Math.round(grade.commissionRate * 100)}%)</p>
          <p className="text-base font-bold text-brand-600 font-mono">{fmt(thisMonthRevenue * grade.commissionRate)}</p>
        </div>
      </div>

      {/* Grade progress */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-2xl shadow-md text-white">
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-[11px] text-slate-400">
              {nextGrade ? `${nextGrade.shortLabel} 승급까지` : '최고 등급 유지 중'}
            </p>
            <p className="font-bold text-sm mt-0.5 font-mono">
              {nextGrade ? `${fmt(Math.max(0, target - thisMonthRevenue))} 남음` : `${fmt(thisMonthRevenue)} / ${fmt(target)}`}
            </p>
          </div>
          <span className={`text-xs font-bold ${grade.badgeColor}`}>{progress}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${grade.trackColor}`} style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Reorder alerts */}
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
        <div className="bg-red-50/50 p-3 border-b border-red-100 flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2 text-red-800 text-sm">
            <BellAlert /> 재구매 알림
          </h3>
          <span className="text-[11px] font-bold text-red-600">{reorderDue.length}건</span>
        </div>
        {reorderDue.length === 0 ? (
          <div className="p-5 text-center text-xs text-gray-500">현재 재발주 임박 단체가 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {reorderDue.slice(0, 5).map((t) => (
              <button
                key={t.id}
                onClick={() => onNavigate('crm')}
                className="w-full p-3 flex justify-between items-center active:bg-gray-50 text-left"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 text-sm truncate">{t.name}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {t.lastOrderDays !== null ? `${t.lastOrderDays}일 전 주문` : '주문 없음'}
                    {t.reorderCycleMonths ? ` · 주기 ${t.reorderCycleMonths}개월` : ''}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Summary card */}
      <button
        onClick={() => onNavigate('crm')}
        className="w-full bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center active:bg-gray-50"
      >
        <div className="text-left">
          <p className="text-[11px] text-gray-500 mb-0.5">관리 단체 / 누적 매출</p>
          <p className="text-sm font-bold text-slate-900">
            {teams.length}개 단체 · <span className="font-mono">{fmt(totalRevenue)}</span>
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </button>
    </div>
  );
}

function BellAlert() {
  return (
    <div className="relative">
      <AlertCircle size={18} className="text-red-500" />
      <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full animate-ping" />
    </div>
  );
}

// =====================================================================
// CRM TAB (단체 관리)
// =====================================================================
function CrmTab({
  teams,
  onCreateOrderForTeam,
  onTeamMutate,
}: {
  teams: Team[];
  onCreateOrderForTeam: (teamId: string) => void;
  onTeamMutate: () => void;
}) {
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = teams.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-900">내 단체 ({teams.length})</h2>
        <button
          onClick={() => setCreateTeamOpen(true)}
          className="flex items-center gap-1 text-sm bg-slate-900 text-white px-3 py-1.5 rounded-lg active:bg-slate-800"
        >
          <Plus size={16} /> 등록
        </button>
      </div>

      <div className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2">
        <Search className="text-gray-400" size={16} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="단체명 검색..."
          className="flex-1 outline-none text-sm bg-transparent"
        />
      </div>

      {teams.length === 0 ? (
        <div className="p-6 text-center bg-white rounded-2xl border border-gray-100">
          <p className="text-sm text-gray-700 font-bold mb-1">아직 등록된 단체가 없어요</p>
          <p className="text-xs text-gray-500 mb-4">[+ 등록] 버튼으로 첫 단체를 추가하세요.</p>
          <button
            onClick={() => setCreateTeamOpen(true)}
            className="bg-brand-500 text-white font-bold py-2.5 px-5 rounded-xl text-sm inline-flex items-center gap-2 active:bg-brand-600"
          >
            <Plus size={16} /> 새 단체 추가
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((team) => {
            const isUrgent = team.status === 'reorder_due';
            const phoneHref = team.phone ? `tel:${team.phone.replace(/[^0-9+]/g, '')}` : null;
            return (
              <div key={team.id} className={`bg-white p-3 rounded-xl shadow-sm border-2 relative ${isUrgent ? 'border-orange-300' : 'border-gray-100'}`}>
                {isUrgent && <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />}
                <div className="mb-2">
                  {team.category && (
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded mb-1 inline-block">
                      {team.category}
                    </span>
                  )}
                  <h3 className="font-bold text-slate-900 truncate">{team.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {team.decisionMaker || '담당자 미기재'}
                    {team.phone ? ` · ${team.phone}` : ''}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                    누적 {team.totalOrders}건 · {fmt(team.totalRevenue)}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {phoneHref ? (
                    <a
                      href={phoneHref}
                      className="flex-1 bg-green-50 text-green-700 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 active:bg-green-100"
                    >
                      <Phone size={14} /> 전화
                    </a>
                  ) : (
                    <button disabled className="flex-1 bg-gray-50 text-gray-400 py-2 rounded-lg text-xs font-bold">
                      전화 없음
                    </button>
                  )}
                  <button
                    onClick={() => onCreateOrderForTeam(team.id)}
                    className="flex-[1.5] bg-brand-500 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 active:bg-brand-600"
                  >
                    <ShoppingCart size={14} /> 주문 생성
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateTeamSheet open={createTeamOpen} onClose={() => setCreateTeamOpen(false)} onCreated={onTeamMutate} />
    </div>
  );
}

// =====================================================================
// PERFORMANCE TAB (실적)
// =====================================================================
function PerformanceTab({
  grade,
  nextGrade,
  thisMonthRevenue,
  totalRevenue,
  primaryCoupon,
}: {
  grade: GradeInfo;
  nextGrade: GradeInfo | null;
  thisMonthRevenue: number;
  totalRevenue: number;
  primaryCoupon: ReturnType<typeof useMyCoupons>['primary'];
}) {
  const target = nextGrade ? nextGrade.monthlyThreshold : grade.monthlyThreshold;
  const progress = target > 0 ? Math.min(100, Math.round((thisMonthRevenue / target) * 100)) : 100;

  return (
    <div className="p-4 space-y-4">
      {/* Grade card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-md">
        <h3 className="text-xs text-slate-400 font-medium mb-2">나의 등급</h3>
        <div className="flex items-end gap-3 mb-4">
          <span className={`text-3xl font-black ${grade.badgeColor}`}>{grade.shortLabel}</span>
          <span className="text-sm text-slate-300 pb-1">{grade.label}</span>
          <span className="text-xs text-slate-400 pb-1.5 ml-auto">수수료 {Math.round(grade.commissionRate * 100)}%</span>
        </div>
        <div className="flex justify-between items-center mb-1 text-[11px]">
          <span className="font-mono text-slate-300">이번달 {fmt(thisMonthRevenue)}</span>
          <span className="text-slate-400 font-mono">{nextGrade ? `${nextGrade.shortLabel} ${fmt(target)}` : '최고 등급'}</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-1.5">
          <div className={`h-1.5 rounded-full transition-all ${grade.trackColor}`} style={{ width: `${progress}%` }} />
        </div>
        {nextGrade && (
          <p className="text-[11px] text-slate-400 mt-2">
            {nextGrade.shortLabel} 승급까지 {fmt(Math.max(0, target - thisMonthRevenue))} 남음
          </p>
        )}
      </div>

      {/* My discount code */}
      {primaryCoupon ? (
        <div className="bg-white p-4 rounded-2xl shadow-sm border-2 border-brand-200">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4 text-brand-600" />
            <p className="text-xs font-bold text-gray-700">내 영업 할인코드</p>
          </div>
          <div className="bg-brand-50 rounded-lg p-3 mb-2">
            <div className="text-2xl font-black text-brand-700 font-mono tracking-wider text-center">{primaryCoupon.code}</div>
          </div>
          <div className="text-[11px] text-gray-600 text-center">
            {primaryCoupon.discount_type === 'percentage'
              ? `${primaryCoupon.discount_value}% 할인 적용`
              : `${fmt(primaryCoupon.discount_value)} 할인 적용`}
            {primaryCoupon.current_uses != null && ` · ${primaryCoupon.current_uses}회 사용됨`}
          </div>
          <div className="text-[10px] text-gray-400 mt-1.5 text-center leading-relaxed">
            고객이 이 코드를 결제 시 입력하면<br />매출이 자동으로 본인에게 귀속됩니다.
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 text-xs text-yellow-800">
          ⚠️ 할인코드가 아직 발급되지 않았습니다. 본사에 문의해주세요.
        </div>
      )}

      {/* Settlement card */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
        <p className="text-xs font-bold text-gray-500 mb-1">이번 달 누적 정산 예정액</p>
        <p className="text-3xl font-black text-slate-900 font-mono">{fmt(thisMonthRevenue * grade.commissionRate)}</p>
        <p className="text-[10px] text-gray-400 mt-2">정산일: 매월 15일 (3.3% 원천징수 후 지급)</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
          <p className="text-[11px] text-gray-500 mb-1">누적 매출</p>
          <p className="text-base font-bold text-slate-900 font-mono">{fmt(totalRevenue)}</p>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
          <p className="text-[11px] text-gray-500 mb-1">현재 등급</p>
          <p className="text-base font-bold text-slate-900">{grade.shortLabel} {grade.label}</p>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// MORE TAB (더보기)
// =====================================================================
function MoreTab() {
  const router = useRouter();
  const { logout, user } = useSalesmanStore();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="p-4 space-y-3">
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <p className="text-[11px] text-gray-500 mb-0.5">로그인 계정</p>
        <p className="text-sm font-bold text-slate-900">{user?.email}</p>
        <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
          {user?.salesman_code} · {user?.grade ?? 'LV0'}
        </p>
      </div>

      {[
        { icon: <Receipt className="w-5 h-5 text-gray-500" />, label: '내 주문 내역', desc: '준비중' },
        { icon: <span className="text-lg">📚</span>, label: 'e-Learning', desc: '준비중' },
        { icon: <span className="text-lg">💬</span>, label: '본사 채널', desc: '준비중' },
        { icon: <span className="text-lg">⚙️</span>, label: '설정', desc: '준비중' },
        { icon: <span className="text-lg">❓</span>, label: 'FAQ', desc: '준비중' },
      ].map((m) => (
        <button key={m.label} className="w-full bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-3 active:bg-gray-50">
          <div className="w-8 h-8 flex items-center justify-center">{m.icon}</div>
          <div className="flex-1 text-left">
            <div className="text-sm text-gray-900 font-medium">{m.label}</div>
            <div className="text-[10px] text-gray-400">{m.desc}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </button>
      ))}

      <button
        onClick={handleLogout}
        className="w-full bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-center gap-2 text-red-700 font-bold active:bg-red-100 mt-4"
      >
        <LogOut className="w-4 h-4" />
        로그아웃
      </button>

      <div className="text-[10px] text-gray-400 text-center pt-4">
        모두의 유니폼 영업사원 앱 v0.2
      </div>
    </div>
  );
}

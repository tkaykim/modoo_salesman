'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Map as MapIcon,
  Target,
  Users,
  Wallet,
  Search,
  Navigation,
  MapPin,
  CheckCircle2,
  ChevronRight,
  Coffee,
  Zap,
  Star,
  Briefcase,
  Activity,
  Plus,
  FileText,
  Download,
  AlertCircle,
  LogOut,
  Phone,
} from 'lucide-react';
import { useSalesmanStore } from '@/store/useSalesmanStore';
import { useMyTeams } from '@/hooks/useMyTeams';
import type { Team } from '@/lib/teams';
import CreateTeamSheet from '@/components/CreateTeamSheet';

// =====================================================================
// 등급/포인트/활동 메타 (실 DB 미연동 — 모의값)
// =====================================================================
type GradeKey = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

const GRADE_INFO: Record<GradeKey, {
  label: string;
  rate: number;
  nextLabel: string | null;
  nextTarget: number;
  badgeColor: string;
}> = {
  BRONZE:   { label: 'Bronze',   rate: 0.10, nextLabel: 'Silver',   nextTarget: 5_000_000,  badgeColor: 'text-orange-300' },
  SILVER:   { label: 'Silver',   rate: 0.15, nextLabel: 'Gold',     nextTarget: 10_000_000, badgeColor: 'text-slate-200' },
  GOLD:     { label: 'Gold',     rate: 0.18, nextLabel: 'Platinum', nextTarget: 15_000_000, badgeColor: 'text-yellow-400' },
  PLATINUM: { label: 'Platinum', rate: 0.22, nextLabel: 'Diamond',  nextTarget: 25_000_000, badgeColor: 'text-blue-300' },
  DIAMOND:  { label: 'Diamond',  rate: 0.25, nextLabel: null,       nextTarget: 25_000_000, badgeColor: 'text-cyan-300' },
};

const DEFAULT_GRADE: GradeKey = 'BRONZE';

const MOCK_PLACES = [
  { id: 1, name: '저스트절크 댄스학원', category: 'dance' as const, type: '댄스학원', x: 20, y: 30, difficulty: '보통',   targetItem: '크루 연습복/굿즈',  points: 30 },
  { id: 2, name: '스포애니 합정역점',   category: 'gym'   as const, type: '대형 헬스장', x: 60, y: 45, difficulty: '어려움', targetItem: '트레이너 기능성티', points: 50 },
  { id: 3, name: '썬키친 합정',         category: 'food'  as const, type: '식당',       x: 40, y: 70, difficulty: '쉬움',   targetItem: '로고 자수 앞치마',  points: 15 },
  { id: 4, name: '버핏그라운드',        category: 'gym'   as const, type: '피트니스',   x: 75, y: 20, difficulty: '보통',   targetItem: '회원 증정용 티셔츠', points: 40 },
  { id: 5, name: '카페 꽃마',           category: 'cafe'  as const, type: '카페',       x: 30, y: 80, difficulty: '쉬움',   targetItem: '바리스타 셔츠',     points: 15 },
];
type Place = typeof MOCK_PLACES[number] & { checkedIn?: boolean };

const DAILY_TASKS = [
  { id: 't1', title: '앱 접속 및 실적 확인',     points: 5  },
  { id: 't2', title: '관심 영업처 1곳 방문 기록', points: 20 },
  { id: 't3', title: '신규 견적서 1건 발송',     points: 30 },
];

const PRODUCTS = [
  { id: 'p1', name: '20수 라운드 반팔',     basePrice: 10000 },
  { id: 'p2', name: '특양면 후드 집업',     basePrice: 24000 },
  { id: 'p3', name: '쿨론 기능성 반팔',     basePrice: 9000 },
];
const PRINTS = [
  { id: 'pr1', name: '나염 1도',           price: 2000 },
  { id: 'pr2', name: '소형 자수 (가슴)',    price: 4000 },
];

// =====================================================================
// Utils
// =====================================================================
const fmt = (n: number) => `₩${n.toLocaleString('ko-KR')}`;

type Tab = 'home' | 'map' | 'activity' | 'crm' | 'performance';

// =====================================================================
// Main
// =====================================================================
export default function MobileApp() {
  const [tab, setTab] = useState<Tab>('home');
  const [places, setPlaces] = useState<Place[]>(MOCK_PLACES);
  const [points, setPoints] = useState<number>(1250);
  const [completedTasks, setCompletedTasks] = useState<string[]>(['t1', 't2']);

  const { user } = useSalesmanStore();
  const { teams, isLoading, error, mutate } = useMyTeams();

  const grade = (user?.grade as GradeKey) ?? DEFAULT_GRADE;
  const gradeInfo = GRADE_INFO[grade] ?? GRADE_INFO[DEFAULT_GRADE];

  // 임시: thisMonthRevenue는 history에서 이번 달 합계로 계산 (대부분 0)
  const thisMonthRevenue = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return teams.reduce((sum, t) => {
      return sum + t.history
        .filter((h) => h.date.startsWith(ym))
        .reduce((s, h) => s + h.amount, 0);
    }, 0);
  }, [teams]);

  const totalRevenue = useMemo(
    () => teams.reduce((s, t) => s + t.totalRevenue, 0),
    [teams]
  );

  const handleCheckIn = (placeId: number, pts: number, name: string) => {
    setPlaces((prev) => prev.map((p) => (p.id === placeId ? { ...p, checkedIn: true } : p)));
    setPoints((p) => p + pts);
    alert(`[${name} 방문 기록] ${pts}P 적립`);
  };

  const renderContent = () => {
    switch (tab) {
      case 'home':
        return (
          <HomeView
            grade={grade}
            gradeInfo={gradeInfo}
            thisMonthRevenue={thisMonthRevenue}
            totalRevenue={totalRevenue}
            teams={teams}
            isLoading={isLoading}
            onNavigate={setTab}
            completedCount={completedTasks.length}
          />
        );
      case 'map':
        return <MapView places={places} onCheckIn={handleCheckIn} />;
      case 'activity':
        return (
          <ActivityView
            points={points}
            completedTasks={completedTasks}
            setCompletedTasks={setCompletedTasks}
            setPoints={setPoints}
          />
        );
      case 'crm':
        return (
          <CrmView
            teams={teams}
            isLoading={isLoading}
            error={error}
            onTeamCreated={mutate}
            commissionRate={gradeInfo.rate}
          />
        );
      case 'performance':
        return (
          <PerformanceView
            grade={grade}
            gradeInfo={gradeInfo}
            thisMonthRevenue={thisMonthRevenue}
            totalRevenue={totalRevenue}
          />
        );
    }
  };

  return (
    <div className="flex h-[100dvh] bg-gray-100 font-sans text-slate-800 justify-center overflow-hidden">
      <main className="w-full max-w-md h-full bg-slate-50 flex flex-col relative shadow-2xl">
        {/* Header */}
        <header
          className="bg-white px-5 pb-4 shadow-sm flex justify-between items-end z-20"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 32px)' }}
        >
          <div>
            <p className="text-[11px] text-slate-500 font-medium mb-0.5">
              {gradeInfo.label} 파트너 · {user?.salesman_code ?? ''}
            </p>
            <h1 className="text-lg font-bold text-slate-900">
              {user?.name || user?.email || '영업사원'} 님
            </h1>
          </div>
          <button
            onClick={() => setTab('activity')}
            className="bg-brand-50 px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-brand-100 active:bg-brand-100"
          >
            <div className="w-4 h-4 bg-brand-500 rounded-full flex items-center justify-center">
              <span className="text-[10px] text-white font-bold">P</span>
            </div>
            <span className="font-bold text-brand-700 text-sm">{points.toLocaleString()}</span>
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-24">{renderContent()}</div>

        {/* Bottom Nav */}
        <nav className="absolute bottom-0 w-full bg-white border-t border-gray-200 px-2 py-2 flex justify-between items-center z-30 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]"
             style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
          <NavItem active={tab === 'home'}        onClick={() => setTab('home')}        icon={<LayoutDashboard size={22} />} label="홈" />
          <NavItem active={tab === 'map'}         onClick={() => setTab('map')}         icon={<MapIcon size={22} />}         label="지도" />
          <NavItem active={tab === 'activity'}    onClick={() => setTab('activity')}    icon={<Target size={22} />}          label="활동" />
          <NavItem active={tab === 'crm'}         onClick={() => setTab('crm')}         icon={<Users size={22} />}           label="고객" />
          <NavItem active={tab === 'performance'} onClick={() => setTab('performance')} icon={<Wallet size={22} />}          label="실적" />
        </nav>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 ${active ? 'text-brand-600' : 'text-gray-400'}`}
    >
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

// =====================================================================
// Home Tab
// =====================================================================
interface HomeViewProps {
  grade: GradeKey;
  gradeInfo: typeof GRADE_INFO[GradeKey];
  thisMonthRevenue: number;
  totalRevenue: number;
  teams: Team[];
  isLoading: boolean;
  onNavigate: (t: Tab) => void;
  completedCount: number;
}

function HomeView({ gradeInfo, thisMonthRevenue, totalRevenue, teams, isLoading, onNavigate, completedCount }: HomeViewProps) {
  const reorderDue = teams.filter((t) => t.status === 'reorder_due');
  const progressPct = gradeInfo.nextTarget > 0 ? Math.min(100, Math.round((thisMonthRevenue / gradeInfo.nextTarget) * 100)) : 100;

  return (
    <div className="p-5 space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-[11px] text-gray-500 mb-1">이번 달 실적</p>
          <p className="text-base font-bold text-slate-900 font-mono">{fmt(thisMonthRevenue)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-[11px] text-gray-500 mb-1">예상 정산금 ({Math.round(gradeInfo.rate * 100)}%)</p>
          <p className="text-base font-bold text-brand-600 font-mono">{fmt(Math.round(thisMonthRevenue * gradeInfo.rate))}</p>
        </div>
      </div>

      {/* Grade progress */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 rounded-2xl shadow-md text-white">
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-[11px] text-slate-400">
              {gradeInfo.nextLabel ? `다음 달 ${gradeInfo.nextLabel} 승급까지` : '최고 등급 유지 중'}
            </p>
            <p className="font-bold text-sm mt-0.5 font-mono">
              {gradeInfo.nextLabel ? `${fmt(Math.max(0, gradeInfo.nextTarget - thisMonthRevenue))} 남음` : `${fmt(thisMonthRevenue)} / ${fmt(gradeInfo.nextTarget)}`}
            </p>
          </div>
          <span className={`text-xs font-bold ${gradeInfo.badgeColor}`}>{progressPct}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div className="bg-yellow-400 h-2 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Reorder alerts */}
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
        <div className="bg-red-50/50 p-4 border-b border-red-100 flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2 text-red-800 text-sm">
            <BellAlert /> 재구매 알림 (연락 타이밍!)
          </h3>
          <span className="text-[11px] font-bold text-red-600">{reorderDue.length}건</span>
        </div>
        {isLoading ? (
          <div className="p-6 text-center text-xs text-gray-500">불러오는 중...</div>
        ) : reorderDue.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500">현재 재발주 임박 단체가 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {reorderDue.slice(0, 5).map((t) => (
              <button
                key={t.id}
                onClick={() => onNavigate('crm')}
                className="w-full p-4 flex justify-between items-center active:bg-gray-50 text-left"
              >
                <div>
                  <p className="font-bold text-slate-900 text-sm">{t.name}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {t.lastOrderDays !== null ? `${t.lastOrderDays}일 전 주문` : '주문 이력 없음'}
                    {t.reorderCycleMonths ? ` · 주기 ${t.reorderCycleMonths}개월` : ''}
                  </p>
                </div>
                <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold">관리 가기</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI 2: total revenue */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
        <div>
          <p className="text-[11px] text-gray-500 mb-0.5">관리 단체 / 누적 매출</p>
          <p className="text-sm font-bold text-slate-900">
            {teams.length}개 단체 · <span className="font-mono">{fmt(totalRevenue)}</span>
          </p>
        </div>
        <button onClick={() => onNavigate('crm')} className="text-brand-600 text-xs font-bold flex items-center gap-1">
          관리 <ChevronRight size={14} />
        </button>
      </div>

      {/* Activity link */}
      <div
        className="bg-brand-50 border border-brand-100 rounded-2xl p-4 flex justify-between items-center cursor-pointer active:bg-brand-100"
        onClick={() => onNavigate('activity')}
      >
        <div className="flex items-center gap-3">
          <Target className="text-brand-500" />
          <div>
            <p className="font-bold text-sm text-brand-900">오늘의 활동 목표 ({completedCount}/{DAILY_TASKS.length})</p>
            <p className="text-[11px] text-brand-700 mt-0.5">완료 시 인바운드 DB 교환 포인트 지급!</p>
          </div>
        </div>
        <ChevronRight className="text-brand-400" />
      </div>
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
// Map Tab
// =====================================================================
function MapView({ places, onCheckIn }: { places: Place[]; onCheckIn: (id: number, pts: number, name: string) => void }) {
  const [selected, setSelected] = useState<Place | null>(null);

  const categoryStyle = (c: Place['category']) => {
    if (c === 'dance') return 'bg-purple-500';
    if (c === 'gym') return 'bg-red-500';
    return 'bg-orange-500';
  };

  return (
    <div className="h-full relative flex flex-col bg-slate-200">
      {/* Search bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex gap-2">
        <div className="flex-1 bg-white h-12 rounded-xl shadow-md flex items-center px-4 gap-2">
          <Search size={18} className="text-gray-400" />
          <input
            type="text"
            placeholder="주변 영업처 탐색..."
            className="bg-transparent border-none outline-none text-sm w-full font-medium"
            readOnly
          />
        </div>
        <button className="w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center text-brand-600">
          <Navigation size={20} className="fill-current" />
        </button>
      </div>

      {/* Map area (mock) */}
      <div className="flex-1 relative">
        {/* Center "me" pin */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-4 h-4 bg-brand-600 rounded-full border-2 border-white shadow-lg relative z-10" />
          <div className="w-12 h-12 bg-brand-500/20 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping" />
        </div>

        {places.map((place) => (
          <button
            key={place.id}
            onClick={() => setSelected(place)}
            className={`absolute w-10 h-10 rounded-full border-[3px] border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all flex items-center justify-center ${categoryStyle(place.category)} ${place.checkedIn ? 'opacity-50 grayscale' : ''} ${selected?.id === place.id ? 'ring-4 ring-brand-400/50 scale-125' : ''}`}
            style={{ top: `${place.y}%`, left: `${place.x}%` }}
          >
            {place.category === 'dance' && <Star size={16} color="white" className="fill-current" />}
            {place.category === 'gym' && <Zap size={16} color="white" className="fill-current" />}
            {(place.category === 'food' || place.category === 'cafe') && <Coffee size={16} color="white" />}
            {place.checkedIn && (
              <div className="absolute -top-1 -right-1 bg-white rounded-full">
                <CheckCircle2 size={14} className="text-green-500" />
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Bottom Sheet */}
      <div className={`absolute bottom-0 w-full bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-300 z-20 ${selected ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3 mb-4" />
        {selected && (
          <div className="px-6 pb-6 pt-2">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded mb-2 inline-block">
                  {selected.type}
                </span>
                <h2 className="text-xl font-bold text-slate-900">{selected.name}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 bg-gray-100 rounded-full text-gray-500 leading-none w-8 h-8 flex items-center justify-center">
                ✕
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-100 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Target size={16} className="text-slate-500" />
                <span className="text-slate-600">추천 품목:</span>
                <span className="font-bold">{selected.targetItem}</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-slate-500" />
                <span className="text-slate-600">접근 난이도:</span>
                <span className="font-bold text-orange-500">{selected.difficulty}</span>
              </div>
            </div>

            <button
              disabled={selected.checkedIn}
              onClick={() => {
                onCheckIn(selected.id, selected.points, selected.name);
                setSelected({ ...selected, checkedIn: true });
              }}
              className={`w-full py-3.5 rounded-xl font-bold text-sm flex justify-center items-center gap-2 transition-colors ${selected.checkedIn ? 'bg-gray-200 text-gray-500' : 'bg-slate-900 text-white active:bg-slate-800'}`}
            >
              {selected.checkedIn ? (
                <><CheckCircle2 size={18} /> 방문 완료</>
              ) : (
                <><MapPin size={18} /> 방문 기록 및 명함전달 (+{selected.points}P)</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Activity Tab
// =====================================================================
function ActivityView({
  points,
  completedTasks,
  setCompletedTasks,
  setPoints,
}: {
  points: number;
  completedTasks: string[];
  setCompletedTasks: (v: string[]) => void;
  setPoints: (fn: (p: number) => number) => void;
}) {
  const completeTask = (taskId: string, pts: number) => {
    if (completedTasks.includes(taskId)) return;
    setCompletedTasks([...completedTasks, taskId]);
    setPoints((p) => p + pts);
  };

  return (
    <div className="p-5 space-y-6">
      {/* Daily tasks */}
      <section>
        <div className="flex justify-between items-end mb-3">
          <h3 className="text-base font-bold text-slate-900">오늘의 활동 목표</h3>
          <span className="text-xs font-bold text-brand-600">{completedTasks.length}/{DAILY_TASKS.length} 완료</span>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2">
          {DAILY_TASKS.map((task) => {
            const done = completedTasks.includes(task.id);
            return (
              <button
                key={task.id}
                onClick={() => completeTask(task.id, task.points)}
                disabled={done}
                className="w-full flex items-center justify-between p-3 border-b border-gray-50 last:border-0 text-left active:bg-gray-50 disabled:active:bg-transparent"
              >
                <div className="flex items-center gap-3">
                  {done ? (
                    <CheckCircle2 size={20} className="text-brand-500" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                  )}
                  <span className={`text-sm font-medium ${done ? 'text-gray-400 line-through' : 'text-slate-700'}`}>
                    {task.title}
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded ${done ? 'bg-gray-100 text-gray-400' : 'bg-brand-50 text-brand-600'}`}>
                  +{task.points}P
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Rewards */}
      <section>
        <h3 className="text-base font-bold text-slate-900 mb-3">파트너 혜택 교환</h3>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 mb-4 relative overflow-hidden shadow-md">
          <div className="absolute right-0 top-0 w-32 h-32 bg-brand-500/20 rounded-full blur-2xl -mr-10 -mt-10" />
          <div className="relative z-10">
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded mb-2 inline-block">HOT 리드</span>
            <h4 className="text-white font-bold text-lg mb-1">인바운드 고객 DB 배정권</h4>
            <p className="text-slate-400 text-xs mb-4">마포구 단체복 문의 100% 의향 고객 연락처를 우선 배정받습니다.</p>
            <button
              disabled={points < 1000}
              className="w-full bg-brand-500 active:bg-brand-600 text-white py-3 rounded-xl font-bold text-sm flex justify-center items-center gap-2 disabled:opacity-50"
            >
              <Users size={18} /> 1,000P로 DB 열람 (현재 {points}P)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <RewardItem icon={<Coffee />}    title="커피 기프티콘"   desc="고객 미팅 지원용"   cost="500P"   color="orange" />
          <RewardItem icon={<Briefcase />} title="고급 샘플북"     desc="프리미엄 원단 키트" cost="2,000P" color="purple" />
        </div>
      </section>
    </div>
  );
}

function RewardItem({ icon, title, desc, cost, color }: { icon: React.ReactNode; title: string; desc: string; cost: string; color: 'orange' | 'purple' }) {
  const colorMap = {
    orange: 'bg-orange-50 text-orange-500',
    purple: 'bg-purple-50 text-purple-500',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col items-center text-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${colorMap[color]}`}>{icon}</div>
      <h4 className="text-sm font-bold text-slate-800 mb-0.5">{title}</h4>
      <p className="text-[10px] text-gray-500 mb-3">{desc}</p>
      <button className="bg-slate-100 text-slate-600 text-xs font-bold py-2 w-full rounded-lg">{cost} 교환</button>
    </div>
  );
}

// =====================================================================
// CRM Tab
// =====================================================================
function CrmView({
  teams,
  isLoading,
  error,
  onTeamCreated,
  commissionRate,
}: {
  teams: Team[];
  isLoading: boolean;
  error: Error | null;
  onTeamCreated: () => void;
  commissionRate: number;
}) {
  const [view, setView] = useState<'list' | 'quote'>('list');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = teams.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));

  if (view === 'quote' && selectedTeam) {
    return (
      <QuoteGenerator
        team={selectedTeam}
        commissionRate={commissionRate}
        onBack={() => {
          setView('list');
          setSelectedTeam(null);
        }}
      />
    );
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-900">내 고객 / 단체</h2>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1 text-sm bg-slate-900 text-white px-3 py-1.5 rounded-lg active:bg-slate-800"
        >
          <Plus size={16} /> 등록
        </button>
      </div>

      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2">
        <Search className="text-gray-400" size={18} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="단체명 검색..."
          className="flex-1 outline-none text-sm bg-transparent"
        />
      </div>

      {isLoading ? (
        <div className="p-10 text-center">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">단체 목록 불러오는 중...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          <div className="font-bold mb-1">불러오기 실패</div>
          <div className="text-xs">{error.message}</div>
        </div>
      ) : teams.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-gray-100">
          <p className="text-sm text-gray-700 font-bold mb-1">아직 등록된 단체가 없어요</p>
          <p className="text-xs text-gray-500 mb-4">[+ 등록] 버튼으로 첫 단체를 추가하세요.</p>
          <button
            onClick={() => setCreateOpen(true)}
            className="bg-brand-500 text-white font-bold py-2.5 px-5 rounded-xl text-sm inline-flex items-center gap-2 active:bg-brand-600"
          >
            <Plus size={16} /> 새 단체 추가
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((team) => {
            const isUrgent = team.status === 'reorder_due';
            const phoneHref = team.phone ? `tel:${team.phone.replace(/[^0-9+]/g, '')}` : null;
            return (
              <div key={team.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative">
                {isUrgent && (
                  <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                )}
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0">
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
                </div>
                <div className="flex gap-2">
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
                  <button className="flex-1 bg-yellow-100 text-yellow-800 py-2 rounded-lg text-xs font-bold active:bg-yellow-200">
                    카톡 찌르기
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTeam(team);
                      setView('quote');
                    }}
                    className="flex-1 bg-brand-50 text-brand-700 py-2 rounded-lg text-xs font-bold active:bg-brand-100"
                  >
                    새 견적
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateTeamSheet open={createOpen} onClose={() => setCreateOpen(false)} onCreated={onTeamCreated} />
    </div>
  );
}

// =====================================================================
// Quote Generator
// =====================================================================
interface QuoteItem {
  id: number;
  productId: string;
  printId: string;
  qty: number;
}

function QuoteGenerator({ team, commissionRate, onBack }: { team: Team; commissionRate: number; onBack: () => void }) {
  const [items, setItems] = useState<QuoteItem[]>([{ id: 1, productId: 'p1', printId: 'pr1', qty: 30 }]);

  const updateItem = (id: number, patch: Partial<QuoteItem>) => {
    setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };
  const addItem = () => {
    setItems([...items, { id: Date.now(), productId: 'p1', printId: 'pr1', qty: 30 }]);
  };
  const removeItem = (id: number) => {
    if (items.length === 1) return;
    setItems(items.filter((it) => it.id !== id));
  };

  const orderTotal = items.reduce((sum, item) => {
    const product = PRODUCTS.find((p) => p.id === item.productId);
    const print = PRINTS.find((p) => p.id === item.printId);
    return sum + ((product?.basePrice || 0) + (print?.price || 0)) * 1.5 * item.qty;
  }, 0);

  return (
    <div className="p-5 space-y-5">
      <button onClick={onBack} className="text-sm text-gray-500 font-medium flex items-center gap-1 active:text-gray-700">
        <ChevronRight size={16} className="rotate-180" /> 고객 목록으로
      </button>

      <div>
        <p className="text-[11px] text-brand-600 font-bold mb-1">{team.name}</p>
        <h2 className="text-xl font-bold">견적서 생성</h2>
        <p className="text-xs text-gray-500 mt-1">고객에게 전달할 맞춤 견적서를 즉시 생성합니다.</p>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-3">
        {items.map((item, idx) => (
          <div key={item.id} className="p-3 border border-gray-100 bg-gray-50 rounded-lg space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-gray-500">품목 {idx + 1}</span>
              {items.length > 1 && (
                <button onClick={() => removeItem(item.id)} className="text-[10px] text-red-500 font-bold">삭제</button>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">제품</label>
              <select
                value={item.productId}
                onChange={(e) => updateItem(item.id, { productId: e.target.value })}
                className="w-full p-2 border border-gray-200 rounded-md text-sm bg-white"
              >
                {PRODUCTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({fmt(p.basePrice)})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">인쇄</label>
                <select
                  value={item.printId}
                  onChange={(e) => updateItem(item.id, { printId: e.target.value })}
                  className="w-full p-2 border border-gray-200 rounded-md text-sm bg-white"
                >
                  {PRINTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (+{fmt(p.price)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">수량</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={item.qty}
                  onChange={(e) => updateItem(item.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-full p-2 border border-gray-200 rounded-md text-sm bg-white"
                />
              </div>
            </div>
          </div>
        ))}
        <button
          onClick={addItem}
          className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold active:bg-gray-200 flex items-center justify-center gap-1"
        >
          <Plus size={14} /> 품목 추가
        </button>
      </div>

      <div className="bg-slate-900 p-5 rounded-xl shadow-lg text-white space-y-2 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-brand-500/20 rounded-full blur-3xl -mr-10 -mt-10" />
        <div className="relative z-10">
          <p className="text-[11px] text-slate-400 mb-1">고객 제안 총액 (VAT 포함)</p>
          <p className="text-3xl font-bold font-mono">{fmt(Math.round(orderTotal))}</p>
          <div className="my-3 border-t border-slate-700" />
          <p className="text-[11px] text-slate-400 mb-1">계약 성사 시 나의 예상 정산액 ({Math.round(commissionRate * 100)}%)</p>
          <p className="text-xl font-bold text-yellow-400 font-mono">{fmt(Math.round(orderTotal * commissionRate))}</p>
        </div>
        <div className="relative z-10 flex gap-2 mt-3">
          <button className="flex-1 bg-brand-500 active:bg-brand-600 py-3 rounded-lg text-sm font-bold flex justify-center items-center gap-1">
            <FileText size={16} /> 링크 전송
          </button>
          <button className="flex-1 bg-slate-800 border border-slate-700 active:bg-slate-700 py-3 rounded-lg text-sm font-bold flex justify-center items-center gap-1">
            <Download size={16} /> PDF 저장
          </button>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-center leading-relaxed">
        ⓘ 견적서 전송·PDF 기능은 아직 모의 단계입니다. 실 결제 연동은 추후 활성화됩니다.
      </p>
    </div>
  );
}

// =====================================================================
// Performance Tab
// =====================================================================
function PerformanceView({
  grade,
  gradeInfo,
  thisMonthRevenue,
  totalRevenue,
}: {
  grade: GradeKey;
  gradeInfo: typeof GRADE_INFO[GradeKey];
  thisMonthRevenue: number;
  totalRevenue: number;
}) {
  const router = useRouter();
  const { logout, user } = useSalesmanStore();
  const progressPct = gradeInfo.nextTarget > 0 ? Math.min(100, Math.round((thisMonthRevenue / gradeInfo.nextTarget) * 100)) : 100;

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="p-5 space-y-5">
      {/* Grade card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-md">
        <h3 className="text-xs text-slate-400 font-medium mb-2">나의 등급 상태</h3>
        <div className="flex items-end gap-3 mb-6">
          <span className={`text-4xl font-black ${gradeInfo.badgeColor}`}>{gradeInfo.label}</span>
          <span className="text-sm text-slate-300 pb-1">적용 요율 {Math.round(gradeInfo.rate * 100)}%</span>
        </div>
        <div className="flex justify-between items-center mb-1 text-xs">
          <span className="font-mono">이번달 실적: {fmt(thisMonthRevenue)}</span>
          <span className="text-slate-400 font-mono">목표: {fmt(gradeInfo.nextTarget)}</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-1.5">
          <div className="bg-yellow-400 h-1.5 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        {gradeInfo.nextLabel && (
          <p className="text-[11px] text-slate-400 mt-2">
            {gradeInfo.nextLabel} 승급까지 {fmt(Math.max(0, gradeInfo.nextTarget - thisMonthRevenue))} 남음
          </p>
        )}
      </div>

      {/* Settlement card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
        <p className="text-sm font-bold text-gray-500 mb-1">이번 달 누적 정산 예정액</p>
        <p className="text-3xl font-black text-slate-900 font-mono">{fmt(Math.round(thisMonthRevenue * gradeInfo.rate))}</p>
        <p className="text-[11px] text-gray-400 mt-2">정산일: 매월 15일 (3.3% 원천징수 후 지급)</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-[11px] text-gray-500 mb-1">누적 매출</p>
          <p className="text-base font-bold text-slate-900 font-mono">{fmt(totalRevenue)}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-[11px] text-gray-500 mb-1">현재 등급</p>
          <p className="text-base font-bold text-slate-900">{gradeInfo.label}</p>
        </div>
      </div>

      {/* Account info & logout */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <p className="text-[11px] text-gray-500 mb-0.5">로그인 계정</p>
        <p className="text-sm font-bold text-slate-900">{user?.email}</p>
        <p className="text-[10px] text-gray-500 mt-0.5 font-mono">
          {user?.salesman_code} · {grade}
        </p>
      </div>

      <button
        onClick={handleLogout}
        className="w-full bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-center gap-2 text-red-700 font-bold active:bg-red-100"
      >
        <LogOut className="w-4 h-4" />
        로그아웃
      </button>
    </div>
  );
}

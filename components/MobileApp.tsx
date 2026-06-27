'use client';

import { useState } from 'react';
import { useSalesmanStore } from '@/store/useSalesmanStore';
import { useMyTeams } from '@/hooks/useMyTeams';
import { useMyCoupons } from '@/hooks/useMyCoupons';
import { useMyRevenue } from '@/hooks/useMyRevenue';
import { useGradeLevels } from '@/hooks/useGradeLevels';
import { getGrade } from '@/lib/grades';
import { AppBar, TabBar, NavSpacer, Icon, type TabItem } from '@/components/ui';
import CreateTeamSheet from '@/components/CreateTeamSheet';
import CreateOrderSheetV2, { type InitialMallProduct } from '@/components/CreateOrderSheetV2';
import TeamDetailSheet from '@/components/TeamDetailSheet';
import PriceCalculatorSheet from '@/components/PriceCalculatorSheet';
import HomeTab from '@/components/HomeTab';
import OrgsTab from '@/components/OrgsTab';
import ToolsTab from '@/components/ToolsTab';
import PerformanceTab from '@/components/PerformanceTab';
import ProfileTab from '@/components/ProfileTab';
import AcademyTab from '@/components/AcademyTab';
import type { TeamProductRow } from '@/hooks/useTeamProducts';

type Tab = 'home' | 'academy' | 'earnings' | 'orgs' | 'tools' | 'profile';
type DetailTab = 'overview' | 'products' | 'orders' | 'assets' | 'shareLink';

export default function MobileApp() {
  const [tab, setTab] = useState<Tab>('home');
  const [lastCreatedOrderId, setLastCreatedOrderId] = useState<string | null>(null);
  const [detailTeamId, setDetailTeamId] = useState<string | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<DetailTab>('overview');
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);
  const [orderV2, setOrderV2] = useState<{
    open: boolean;
    teamId: string | null;
    initialMallProducts: InitialMallProduct[];
  }>({ open: false, teamId: null, initialMallProducts: [] });

  const teamProductsToInitial = (rows: TeamProductRow[] | undefined): InitialMallProduct[] =>
    (rows ?? []).map((p) => ({
      id: p.id,
      product_id: p.product_id,
      display_name: p.display_name,
      color_hex: p.color_hex,
      color_name: p.color_name,
      color_code: null,
      preview_url: p.preview_url,
      price: p.price,
    }));
  const [paymentLinkInfo, setPaymentLinkInfo] = useState<{ orderId: string; url: string } | null>(null);

  const { user } = useSalesmanStore();
  const { teams, mutate: refetchTeams } = useMyTeams();
  const { coupons, primary: primaryCoupon } = useMyCoupons();
  const { thisMonthRevenue, thisMonthPendingRevenue, totalRevenue } = useMyRevenue();
  const { findNext } = useGradeLevels();

  const grade = getGrade(user?.grade);
  const next = findNext(grade.level);
  const nextInfo = next
    ? getGrade(next.level)
    : null;
  const reorderDue = teams.filter((t) => t.status === 'reorder_due');
  const couponCount = coupons.length;

  const openOrder = (teamId: string | null = null) =>
    setOrderV2({ open: true, teamId, initialMallProducts: [] });

  const tabItems: TabItem<Tab>[] = [
    { id: 'home',     icon: 'home',   label: '홈' },
    { id: 'academy',  icon: 'trophy', label: '스쿨' },
    { id: 'earnings', icon: 'wallet', label: '수입' },
    { id: 'orgs',     icon: 'group',  label: '단체', badge: reorderDue.length },
    { id: 'tools',    icon: 'grid',   label: '도구' },
    { id: 'profile',  icon: 'user',   label: '마이' },
  ];

  return (
    <div className="flex h-[100dvh] bg-[var(--color-surface-alt)] justify-center overflow-hidden">
      <main className="w-full max-w-md h-full bg-[var(--color-surface-alt)] flex flex-col relative shadow-2xl">
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
                onClick={() => setTab('profile')}
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
                next={nextInfo}
                thisMonthRevenue={thisMonthRevenue}
                thisMonthPendingRevenue={thisMonthPendingRevenue}
                totalRevenue={totalRevenue}
                teams={teams}
                reorderDue={reorderDue}
                couponCount={couponCount}
                onCreateOrder={() => openOrder(null)}
                onStartVisit={() => setCreateTeamOpen(true)}
                onOpenCalculator={() => setCalcOpen(true)}
                onOpenTemplates={() => openOrder(null)}
                onOpenCoupons={() => setTab('profile')}
                onOpenEarnings={() => setTab('earnings')}
                onOpenAcademy={() => setTab('academy')}
                onOpenOrg={(teamId) => {
                  setDetailInitialTab('overview');
                  setDetailTeamId(teamId);
                }}
                onNavigate={setTab}
              />
            )}
            {tab === 'academy' && (
              <AcademyTab
                teams={teams}
                totalRevenue={totalRevenue}
                onStartVisit={() => setCreateTeamOpen(true)}
                onOpenTeam={(teamId) => {
                  setDetailInitialTab('overview');
                  setDetailTeamId(teamId);
                }}
              />
            )}
            {tab === 'earnings' && <PerformanceTab />}
            {tab === 'orgs' && (
              <OrgsTab
                teams={teams}
                onCreateOrderForTeam={(teamId) => openOrder(teamId)}
                onOpenDetail={(teamId) => {
                  setDetailInitialTab('overview');
                  setDetailTeamId(teamId);
                }}
                onTeamMutate={refetchTeams}
              />
            )}
            {tab === 'tools' && (
              <ToolsTab
                onOpenCalculator={() => setCalcOpen(true)}
                onOpenCustomOrder={() => openOrder(null)}
                onOpenMyOrders={() => setTab('profile')}
                onOpenAcademy={() => setTab('academy')}
              />
            )}
            {tab === 'profile' && (
              <ProfileTab
                grade={grade}
                thisMonthRevenue={thisMonthRevenue}
                totalRevenue={totalRevenue}
                couponCount={couponCount}
                onOpenAcademy={() => setTab('academy')}
              />
            )}
          </NavSpacer>
        </div>

        {/* Bottom Nav — 5 tabs, no center FAB */}
        <TabBar<Tab> active={tab} onChange={setTab} items={tabItems} />

        <TeamDetailSheet
          key={`${detailTeamId ?? 'none'}-${detailInitialTab}`}
          open={!!detailTeamId}
          teamId={detailTeamId}
          initialTab={detailInitialTab}
          onClose={() => setDetailTeamId(null)}
          onCreateOrder={(teamId, selectedProducts) => {
            setDetailTeamId(null);
            setOrderV2({
              open: true,
              teamId,
              initialMallProducts: teamProductsToInitial(selectedProducts),
            });
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

        <CreateTeamSheet
          open={createTeamOpen}
          onClose={() => setCreateTeamOpen(false)}
          onCreated={async (teamId) => {
            await refetchTeams();
            setCreateTeamOpen(false);
            if (teamId) {
              setDetailInitialTab('products');
              setDetailTeamId(teamId);
            } else {
              setTab('orgs');
            }
          }}
        />

        <PriceCalculatorSheet open={calcOpen} onClose={() => setCalcOpen(false)} />

        <CreateOrderSheetV2
          open={orderV2.open}
          preselectedTeamId={orderV2.teamId}
          initialMallProducts={orderV2.initialMallProducts}
          onClose={() =>
            setOrderV2({ open: false, teamId: null, initialMallProducts: [] })
          }
          onCreated={(orderId, paymentLinkUrl) => {
            setLastCreatedOrderId(orderId);
            if (paymentLinkUrl) setPaymentLinkInfo({ orderId, url: paymentLinkUrl });
            refetchTeams();
          }}
        />

        {paymentLinkInfo && (
          <PaymentLinkModal
            orderId={paymentLinkInfo.orderId}
            url={paymentLinkInfo.url}
            onClose={() => setPaymentLinkInfo(null)}
          />
        )}
      </main>
    </div>
  );
}

function PaymentLinkModal({ orderId, url, onClose }: { orderId: string; url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-3">
      <div className="bg-white rounded-[20px] w-full max-w-md p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 bg-[var(--color-pos)]/10 rounded-full flex items-center justify-center">
            <Icon name="check" size={18} color="var(--color-pos)" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[14px] font-bold text-[var(--color-ink)]">결제 링크 생성됨</p>
            <p className="text-[11px] text-[var(--color-muted)] font-mono">{orderId}</p>
          </div>
        </div>
        <p className="text-[12px] text-[var(--color-muted)] mb-2 leading-relaxed">
          아래 링크를 고객에게 전달하세요. 고객이 결제하면 매출이 자동으로 본인에게 귀속됩니다.
        </p>
        <div className="bg-[var(--color-surface-alt)] rounded-[10px] p-3 mb-3 break-all font-mono text-[11px] text-[var(--color-ink)]">
          {url}
        </div>
        <div className="flex gap-2">
          <button
            onClick={copy}
            className={`flex-1 py-3 rounded-[12px] font-bold text-[13px] flex items-center justify-center gap-1 ${copied ? 'bg-[var(--color-pos)]/10 text-[var(--color-pos)]' : 'bg-[var(--color-brand-500)] text-white'}`}
            style={!copied ? { boxShadow: 'var(--shadow-cta)' } : undefined}
          >
            <Icon name={copied ? 'check' : 'share'} size={14} color={copied ? 'var(--color-pos)' : 'white'} />
            {copied ? '복사됨' : '링크 복사'}
          </button>
          <button onClick={onClose} className="px-4 py-3 rounded-[12px] bg-[var(--color-surface-alt)] text-[var(--color-body)] font-bold text-[13px]">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Icon, Chip, HairLine } from '@/components/ui';
import CreateTeamSheet from '@/components/CreateTeamSheet';
import type { Team } from '@/lib/teams';

const fmt = (n: number) => `₩${Math.round(n).toLocaleString('ko-KR')}`;

export interface OrgsTabProps {
  teams: Team[];
  onCreateOrderForTeam: (teamId: string) => void;
  onOpenDetail: (teamId: string) => void;
  onTeamMutate: () => void;
}

export default function OrgsTab({
  teams,
  onCreateOrderForTeam,
  onOpenDetail,
  onTeamMutate,
}: OrgsTabProps) {
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
    <div className="bg-[var(--color-surface-alt)] min-h-full px-4 pt-4 pb-8 space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="text-[18px] font-extrabold text-[var(--color-ink)] tracking-tight">
          내 단체 <span className="text-[var(--color-muted)] font-mono num">{teams.length}</span>
        </h2>
        <button
          onClick={() => setCreateTeamOpen(true)}
          className="flex items-center gap-1 text-[13px] bg-[var(--color-ink)] text-white px-3 py-1.5 rounded-[10px] active:opacity-90 font-bold"
        >
          <Icon name="plus" size={14} color="white" /> 등록
        </button>
      </div>

      <div
        className="bg-white rounded-[14px] px-3 py-2.5 flex items-center gap-2"
        style={{ boxShadow: 'var(--shadow-card-flat)', border: '1px solid var(--color-hairline-soft)' }}
      >
        <Icon name="search" size={16} color="var(--color-faint)" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="단체명 검색..."
          className="flex-1 outline-none text-[14px] bg-transparent"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>전체 {teams.length}</Chip>
        <Chip active={filter === 'reorder'} onClick={() => setFilter('reorder')}>재발주 {counts.reorder}</Chip>
        <Chip active={filter === 'active'} onClick={() => setFilter('active')}>활성 {counts.active}</Chip>
        <Chip active={filter === 'dormant'} onClick={() => setFilter('dormant')}>휴면 {counts.dormant}</Chip>
      </div>

      {teams.length === 0 ? (
        <div
          className="bg-white rounded-[18px] p-6 flex flex-col items-center text-center"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
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
      ) : (
        <div className="space-y-2.5">
          {filtered.map((team) => {
            const isUrgent = team.status === 'reorder_due';
            const phoneHref = team.phone ? `tel:${team.phone.replace(/[^0-9+]/g, '')}` : null;
            return (
              <div
                key={team.id}
                className="bg-white rounded-[18px] p-4"
                style={{
                  boxShadow: 'var(--shadow-card)',
                  border: isUrgent
                    ? '1px solid var(--color-warn-border)'
                    : '1px solid var(--color-hairline-soft)',
                }}
              >
                <button
                  onClick={() => onOpenDetail(team.id)}
                  className="w-full text-left mb-2 active:opacity-80"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 flex items-start gap-2.5">
                      {team.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={team.logoUrl}
                          alt={team.name}
                          className="w-10 h-10 rounded-[10px] object-contain bg-[var(--color-surface-alt)] flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-[10px] bg-[var(--color-brand-100)] flex items-center justify-center flex-shrink-0">
                          <Icon name="group" size={18} color="var(--color-brand-500)" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        {team.category && (
                          <span className="text-[10px] font-bold bg-[var(--color-surface-alt)] text-[var(--color-muted)] px-1.5 py-0.5 rounded mb-1 inline-block">
                            {team.category}
                          </span>
                        )}
                        <h3 className="font-bold text-[15px] text-[var(--color-ink)] truncate tracking-tight">
                          {team.name}
                        </h3>
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
                      {isUrgent && (
                        <span className="w-2 h-2 bg-[var(--color-err)] rounded-full animate-pulse" />
                      )}
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
                    <button
                      disabled
                      className="flex-1 bg-[var(--color-surface-alt)] text-[var(--color-faint)] py-2 rounded-[10px] text-[12px] font-bold"
                    >
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
              </div>
            );
          })}
        </div>
      )}

      <CreateTeamSheet
        open={createTeamOpen}
        onClose={() => setCreateTeamOpen(false)}
        onCreated={onTeamMutate}
      />
    </div>
  );
}

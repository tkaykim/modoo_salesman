'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { useSalesmanStore } from '@/store/useSalesmanStore';
import type { Team } from '@/lib/teams';
import { Icon } from '@/components/ui';

interface Props {
  teams: Team[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** 신규 단체 등록 후 팀 목록 재조회 */
  onTeamsChanged?: () => void;
  /** 컨테이너 클래스 (기본 토큰 스타일) */
  variant?: 'token' | 'legacy';
}

export default function TeamPicker({
  teams,
  selectedId,
  onSelect,
  onTeamsChanged,
  variant = 'token',
}: Props) {
  const { user } = useSalesmanStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === selectedId) ?? null,
    [teams, selectedId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) => t.name.toLowerCase().includes(q));
  }, [teams, query]);

  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return teams.some((t) => t.name.toLowerCase() === q);
  }, [teams, query]);

  // Outside click close
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
        setError(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Auto focus on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const handleCreate = async () => {
    const name = query.trim();
    if (!name) return;
    if (!user?.salesman_profile_id) {
      setError('영업사원 프로필 미확인. 다시 로그인해주세요.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: insErr } = await supabase
        .from('partner_malls')
        .insert({
          name,
          logo_url: '',
          is_active: false,
          salesman_id: user.salesman_profile_id,
          team_meta: {},
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
      if (!data?.id) throw new Error('생성된 단체 ID가 없습니다.');
      onSelect(data.id as string);
      onTeamsChanged?.();
      setOpen(false);
      setQuery('');
    } catch (err) {
      console.error('[TeamPicker] create error:', err);
      setError((err as Error).message || '등록 실패');
    } finally {
      setCreating(false);
    }
  };

  const triggerClass =
    variant === 'token'
      ? 'w-full rounded-[10px] border border-[var(--color-hairline)] px-3 py-2.5 text-[14px] bg-white flex items-center justify-between gap-2'
      : 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white flex items-center justify-between gap-2';

  const panelClass =
    variant === 'token'
      ? 'absolute z-20 mt-1 w-full rounded-[10px] border border-[var(--color-hairline)] bg-white shadow-lg overflow-hidden'
      : 'absolute z-20 mt-1 w-full rounded-lg border border-gray-300 bg-white shadow-lg overflow-hidden';

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
      >
        <span className={selectedTeam ? '' : 'text-gray-400'}>
          {selectedTeam?.name ?? '단체 미연결 (개별 고객 주문)'}
        </span>
        <Icon name="chevron-d" size={14} />
      </button>

      {open && (
        <div className={panelClass}>
          <div className="p-2 border-b border-[var(--color-hairline-soft)]">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="단체명 검색"
              className="w-full rounded-[8px] border border-[var(--color-hairline)] px-3 py-2 text-[14px] focus:outline-none focus:border-[var(--color-brand-500)]"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setOpen(false);
                setQuery('');
              }}
              className={`w-full text-left px-3 py-2 text-[13px] hover:bg-gray-50 ${
                selectedId === null ? 'bg-gray-50 font-bold' : ''
              }`}
            >
              단체 미연결 (개별 고객 주문)
            </button>
            {filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onSelect(t.id);
                  setOpen(false);
                  setQuery('');
                }}
                className={`w-full text-left px-3 py-2 text-[14px] hover:bg-gray-50 ${
                  selectedId === t.id ? 'bg-gray-50 font-bold' : ''
                }`}
              >
                {t.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-[12px] text-gray-400">검색 결과 없음</div>
            )}
            {query.trim() && !exactMatch && (
              <div className="border-t border-[var(--color-hairline-soft)] mt-1 pt-1">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="w-full text-left px-3 py-2 text-[13px] text-[var(--color-brand-500)] font-bold hover:bg-[var(--color-brand-500)]/5 disabled:opacity-50 flex items-center gap-1"
                >
                  <Icon name="plus" size={14} color="var(--color-brand-500)" />
                  {creating ? '등록 중...' : `'${query.trim()}' 새 단체로 등록`}
                </button>
              </div>
            )}
            {error && (
              <div className="px-3 py-2 text-[12px] text-[var(--color-err)]">{error}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

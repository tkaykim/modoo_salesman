'use client';

import { Icon, Chip } from '@/components/ui';
import { useState } from 'react';

interface Pin {
  id: string;
  x: number;
  y: number;
  stage: 'lead' | 'contact' | 'quote' | 'first';
  name: string;
  distance: string;
}

// 지도 핀 — 데모용. 실제 단체 위치는 데이터 연결 후 채워집니다.
const PINS: Pin[] = [
  { id: 'p1', x: 30,  y: 40, stage: 'contact', name: '샘플 단체 1', distance: '0.3km' },
  { id: 'p2', x: 60,  y: 30, stage: 'lead',    name: '샘플 단체 2', distance: '0.8km' },
  { id: 'p3', x: 70,  y: 60, stage: 'quote',   name: '샘플 단체 3', distance: '1.2km' },
  { id: 'p4', x: 40,  y: 70, stage: 'first',   name: '샘플 단체 4', distance: '0.5km' },
  { id: 'p5', x: 80,  y: 45, stage: 'lead',    name: '샘플 단체 5', distance: '1.5km' },
];

const STAGE_COLOR: Record<Pin['stage'], string> = {
  lead:    'var(--color-faint)',
  contact: 'var(--color-brand-500)',
  quote:   'var(--color-warn-strong)',
  first:   'var(--color-err-strong)',
};

export default function MapTab() {
  const [filter, setFilter] = useState<'all' | Pin['stage']>('all');
  const visible = PINS.filter((p) => filter === 'all' || p.stage === filter);

  return (
    <div className="bg-[var(--color-surface-alt)] min-h-full pb-8">
      {/* Map placeholder */}
      <div className="relative mx-3 mt-3 h-[260px] rounded-[20px] overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div
          className="absolute inset-0"
          style={{
            background:
              'repeating-linear-gradient(0deg, #eef3fb 0, #eef3fb 1px, #f7faff 1px, #f7faff 32px), repeating-linear-gradient(90deg, #eef3fb 0, #eef3fb 1px, #f7faff 1px, #f7faff 32px)',
          }}
        />
        {/* center marker */}
        <div
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'var(--color-brand-500)',
            border: '3px solid #fff',
            boxShadow: '0 0 0 6px rgba(0,82,204,0.18)',
          }}
        />
        {/* pins */}
        {visible.map((p) => (
          <div
            key={p.id}
            className="absolute flex flex-col items-center"
            style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -100%)' }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: STAGE_COLOR[p.stage], boxShadow: '0 4px 8px rgba(0,0,0,0.15)' }}
            >
              <Icon name="pin" size={14} color="#fff" strokeWidth={2.5} />
            </div>
          </div>
        ))}
      </div>

      {/* Daily quest banner — primary tint */}
      <div
        className="mx-3 mt-3.5 rounded-[16px] p-4"
        style={{
          background: 'var(--color-brand-softer)',
          border: '1px solid var(--color-brand-100)',
          boxShadow: 'var(--shadow-card-flat)',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Icon name="target" size={18} color="var(--color-brand-500)" />
          <div className="text-[14px] font-bold text-[var(--color-ink)] tracking-tight">데일리 퀘스트</div>
          <span className="flex-1" />
          <span className="text-[11px] font-bold text-[var(--color-brand-500)]">2 / 3</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,82,204,0.15)' }}>
          <div className="h-full rounded-full" style={{ width: '66%', background: 'var(--color-brand-500)' }} />
        </div>
        <p className="text-[11px] text-[var(--color-muted)] mt-2">
          오늘 미션 1개만 더 완료하면 보너스 +50 XP
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto px-4 mt-3.5 pb-1">
        <Chip active={filter === 'all'}     onClick={() => setFilter('all')}>전체</Chip>
        <Chip active={filter === 'lead'}    onClick={() => setFilter('lead')}>리드</Chip>
        <Chip active={filter === 'contact'} onClick={() => setFilter('contact')}>컨택</Chip>
        <Chip active={filter === 'quote'}   onClick={() => setFilter('quote')}>견적중</Chip>
        <Chip active={filter === 'first'}   onClick={() => setFilter('first')}>첫주문</Chip>
      </div>

      {/* Mission list */}
      <div className="mx-3 mt-3.5">
        <div className="px-1.5 pb-2 flex items-baseline justify-between">
          <h3 className="text-[13px] font-bold text-[var(--color-body)] tracking-tight">근처 미션 {visible.length}개</h3>
          <span className="text-[11px] text-[var(--color-faint)]">정적 화면 · 데이터 미연결</span>
        </div>
        <div
          className="bg-white rounded-[16px] overflow-hidden"
          style={{ border: '1px solid var(--color-hairline-soft)', boxShadow: 'var(--shadow-card-flat)' }}
        >
          {visible.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-4 py-3.5"
              style={{ borderTop: i > 0 ? '1px solid var(--color-hairline-soft)' : 'none' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: STAGE_COLOR[p.stage] }}
              >
                <Icon name="pin" size={14} color="#fff" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold text-[var(--color-ink)] truncate">{p.name}</div>
                <div className="text-[11px] text-[var(--color-muted)] mt-0.5">{p.distance}</div>
              </div>
              <Icon name="chevron-r" size={16} color="var(--color-faint)" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

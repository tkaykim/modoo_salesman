'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import {
  CATEGORY_OPTIONS,
  REORDER_CYCLE_OPTIONS,
  CONTACT_ROLE_OPTIONS,
  type TeamCategory,
  type TeamContact,
  type TeamMeta,
} from '@/lib/teams';
import { useSalesmanStore } from '@/store/useSalesmanStore';
import { Icon, Chip, Card, Section } from '@/components/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** Edit mode — partner_mall id */
  editTeamId?: string | null;
}

export default function CreateTeamSheet({ open, onClose, onCreated, editTeamId }: Props) {
  const { user } = useSalesmanStore();
  const isEdit = !!editTeamId;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<TeamCategory>('학교');
  const [size, setSize] = useState('');
  const [reorderCycleMonths, setReorderCycleMonths] = useState(6);
  const [note, setNote] = useState('');

  // 주소
  const [postalCode, setPostalCode] = useState('');
  const [roadAddress, setRoadAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');

  // 담당자 (다수)
  const [contacts, setContacts] = useState<TeamContact[]>([
    { name: '', role: '결정권자', phone: '', email: '', isPrimary: true },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit: load existing team_meta
  useEffect(() => {
    if (!open || !isEdit || !editTeamId) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('partner_malls')
          .select('name, team_meta')
          .eq('id', editTeamId)
          .maybeSingle();
        if (error) throw error;
        if (!active || !data) return;

        const meta = (data.team_meta ?? {}) as TeamMeta;
        setName(data.name);
        setCategory(meta.category ?? '학교');
        setSize(meta.size ? String(meta.size) : '');
        setReorderCycleMonths(meta.reorderCycleMonths ?? 6);
        setNote(meta.note ?? '');
        setPostalCode(meta.address?.postal ?? '');
        setRoadAddress(meta.address?.road ?? '');
        setDetailAddress(meta.address?.detail ?? '');

        const loadedContacts: TeamContact[] = Array.isArray(meta.contacts) && meta.contacts.length > 0
          ? meta.contacts
          : meta.decisionMaker
            ? [{ name: meta.decisionMaker, role: '결정권자', phone: meta.phone ?? '', email: '', isPrimary: true }]
            : [{ name: '', role: '결정권자', phone: '', email: '', isPrimary: true }];
        setContacts(loadedContacts);
      } catch (err) {
        console.error('[CreateTeamSheet] load error:', err);
        setError('단체 정보를 불러오지 못했습니다.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, isEdit, editTeamId]);

  // Reset on close (only for create mode)
  useEffect(() => {
    if (open) return;
    if (isEdit) return;
    setName('');
    setCategory('학교');
    setSize('');
    setReorderCycleMonths(6);
    setNote('');
    setPostalCode('');
    setRoadAddress('');
    setDetailAddress('');
    setContacts([{ name: '', role: '결정권자', phone: '', email: '', isPrimary: true }]);
    setError(null);
  }, [open, isEdit]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const updateContact = (idx: number, patch: Partial<TeamContact>) => {
    setContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };
  const addContact = () => {
    setContacts((prev) => [...prev, { name: '', role: '담당자', phone: '', email: '' }]);
  };
  const removeContact = (idx: number) => {
    setContacts((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== idx);
      if (!next.some((c) => c.isPrimary)) next[0] = { ...next[0], isPrimary: true };
      return next;
    });
  };
  const setPrimaryContact = (idx: number) => {
    setContacts((prev) => prev.map((c, i) => ({ ...c, isPrimary: i === idx })));
  };

  const handleSubmit = async () => {
    setError(null);

    if (!user?.salesman_profile_id) {
      setError('영업사원 프로필 미확인. 다시 로그인해주세요.');
      return;
    }
    if (!name.trim()) {
      setError('단체명을 입력해주세요.');
      return;
    }
    const filledContacts = contacts.filter((c) => c.name.trim());
    if (filledContacts.length === 0) {
      setError('담당자를 최소 1명 등록해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();

      const meta: TeamMeta = {
        category,
        size: size ? Number(size) : undefined,
        reorderCycleMonths,
        note: note.trim() || undefined,
        address: (postalCode || roadAddress || detailAddress)
          ? {
              postal: postalCode.trim() || undefined,
              road: roadAddress.trim() || undefined,
              detail: detailAddress.trim() || undefined,
            }
          : undefined,
        contacts: filledContacts.map((c, i) => ({
          name: c.name.trim(),
          role: c.role?.trim() || undefined,
          phone: c.phone?.trim() || undefined,
          email: c.email?.trim() || undefined,
          isPrimary: c.isPrimary || (i === 0 && !filledContacts.some((x) => x.isPrimary)),
        })),
      };

      if (isEdit && editTeamId) {
        const { error: updErr } = await supabase
          .from('partner_malls')
          .update({ name: name.trim(), team_meta: meta as unknown as Record<string, unknown> })
          .eq('id', editTeamId);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from('partner_malls').insert({
          name: name.trim(),
          logo_url: '',
          is_active: false, // light 모드로 시작
          salesman_id: user.salesman_profile_id,
          team_meta: meta as unknown as Record<string, unknown>,
        });
        if (insErr) throw insErr;
      }

      onCreated();
      onClose();
    } catch (err) {
      console.error('[CreateTeamSheet] submit error:', err);
      setError((err as Error).message || (isEdit ? '저장 실패' : '등록 실패'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      <div
        className="relative mt-auto bg-[var(--color-surface)] rounded-t-[20px] shadow-2xl max-h-[92vh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-hairline-soft)]">
          <h2 className="text-[15px] font-bold text-[var(--color-ink)]">{isEdit ? '단체 정보 수정' : '새 단체 추가'}</h2>
          <button onClick={handleClose} disabled={submitting} className="p-1 -mr-1 text-[var(--color-muted)]">
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loading ? (
            <div className="p-8 text-center text-[12px] text-[var(--color-muted)]">불러오는 중...</div>
          ) : (
            <>
              <Section title="기본 정보">
                <Field label="단체명 *">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 한빛고등학교 댄스부"
                    className="w-full rounded-[10px] border border-[var(--color-hairline)] px-3 py-2.5 text-[15px] focus:outline-none focus:border-[var(--color-brand-500)]"
                    required
                  />
                </Field>
                <Field label="카테고리">
                  <div className="grid grid-cols-5 gap-1.5">
                    {CATEGORY_OPTIONS.map((c) => (
                      <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>
                    ))}
                  </div>
                </Field>
                <Field label="인원수">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="예: 25"
                    className="w-full rounded-[10px] border border-[var(--color-hairline)] px-3 py-2.5 text-[15px] focus:outline-none focus:border-[var(--color-brand-500)]"
                  />
                </Field>
                <Field label="재발주 주기">
                  <div className="grid grid-cols-2 gap-1.5">
                    {REORDER_CYCLE_OPTIONS.map((opt) => (
                      <Chip key={opt.value} active={reorderCycleMonths === opt.value} onClick={() => setReorderCycleMonths(opt.value)}>
                        {opt.label}
                      </Chip>
                    ))}
                  </div>
                </Field>
              </Section>

              <Section title="주소 (선택)">
                <Field label="우편번호">
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="12345"
                    className="w-full rounded-[10px] border border-[var(--color-hairline)] px-3 py-2.5 text-[15px] focus:outline-none focus:border-[var(--color-brand-500)]"
                  />
                </Field>
                <Field label="도로명 주소">
                  <input
                    type="text"
                    value={roadAddress}
                    onChange={(e) => setRoadAddress(e.target.value)}
                    placeholder="예: 서울시 마포구 성지3길 55"
                    className="w-full rounded-[10px] border border-[var(--color-hairline)] px-3 py-2.5 text-[15px] focus:outline-none focus:border-[var(--color-brand-500)]"
                  />
                </Field>
                <Field label="상세 주소">
                  <input
                    type="text"
                    value={detailAddress}
                    onChange={(e) => setDetailAddress(e.target.value)}
                    placeholder="예: 3층 301호"
                    className="w-full rounded-[10px] border border-[var(--color-hairline)] px-3 py-2.5 text-[15px] focus:outline-none focus:border-[var(--color-brand-500)]"
                  />
                </Field>
              </Section>

              <Section
                title={`담당자 (${contacts.length})`}
                action={
                  <button onClick={addContact} className="text-[12px] text-[var(--color-brand-500)] font-bold flex items-center gap-1">
                    <Icon name="plus" size={14} color="var(--color-brand-500)" /> 추가
                  </button>
                }
              >
                <div className="space-y-2">
                  {contacts.map((c, idx) => (
                    <Card key={idx} padding="sm" className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[var(--color-muted)]">담당자 {idx + 1}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPrimaryContact(idx)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.isPrimary ? 'bg-[var(--color-brand-500)] text-white' : 'bg-[var(--color-surface-alt)] text-[var(--color-muted)]'}`}
                          >
                            {c.isPrimary ? '★ 대표' : '대표 지정'}
                          </button>
                          {contacts.length > 1 && (
                            <button onClick={() => removeContact(idx)} className="p-1 text-[var(--color-err)]">
                              <Icon name="trash" size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) => updateContact(idx, { name: e.target.value })}
                        placeholder="이름 (예: 박지영)"
                        className="w-full rounded-[8px] border border-[var(--color-hairline)] px-3 py-2 text-[14px] focus:outline-none focus:border-[var(--color-brand-500)]"
                      />
                      <select
                        value={c.role ?? ''}
                        onChange={(e) => updateContact(idx, { role: e.target.value })}
                        className="w-full rounded-[8px] border border-[var(--color-hairline)] px-3 py-2 text-[14px] bg-white focus:outline-none focus:border-[var(--color-brand-500)]"
                      >
                        {CONTACT_ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="tel"
                          inputMode="tel"
                          value={c.phone ?? ''}
                          onChange={(e) => updateContact(idx, { phone: e.target.value })}
                          placeholder="010-1234-5678"
                          className="w-full rounded-[8px] border border-[var(--color-hairline)] px-3 py-2 text-[14px] focus:outline-none focus:border-[var(--color-brand-500)]"
                        />
                        <input
                          type="email"
                          inputMode="email"
                          value={c.email ?? ''}
                          onChange={(e) => updateContact(idx, { email: e.target.value })}
                          placeholder="email@…"
                          className="w-full rounded-[8px] border border-[var(--color-hairline)] px-3 py-2 text-[14px] focus:outline-none focus:border-[var(--color-brand-500)]"
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              </Section>

              <Section title="메모">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="단체 특이사항, 영업 포인트, 디자인 선호 등"
                  className="w-full rounded-[10px] border border-[var(--color-hairline)] px-3 py-2.5 text-[14px] focus:outline-none focus:border-[var(--color-brand-500)] resize-none"
                />
              </Section>

              {error && (
                <div className="rounded-[10px] bg-[var(--color-err)]/10 border border-[var(--color-err)]/30 px-3 py-2 text-[12px] text-[var(--color-err)]">
                  {error}
                </div>
              )}

              {!isEdit && (
                <p className="text-[10px] text-[var(--color-faint)] leading-relaxed pt-1">
                  ⓘ 등록 후 단체 상세에서 로고/제품 라인업 셋업 → 공유 링크 활성화 가능
                </p>
              )}
            </>
          )}
        </div>

        <div className="border-t border-[var(--color-hairline-soft)] p-3">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || loading}
            className="w-full bg-[var(--color-brand-500)] text-white font-bold py-3 rounded-[14px] disabled:opacity-50 active:bg-[var(--color-brand-600)]"
            style={{ boxShadow: 'var(--shadow-cta)' }}
          >
            {submitting ? (isEdit ? '저장 중...' : '등록 중...') : isEdit ? '변경사항 저장' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 last:mb-0">
      <label className="block text-[11px] font-bold text-[var(--color-muted)] mb-1">{label}</label>
      {children}
    </div>
  );
}

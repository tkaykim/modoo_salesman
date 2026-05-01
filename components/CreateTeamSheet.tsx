'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { CATEGORY_OPTIONS, REORDER_CYCLE_OPTIONS, type TeamCategory } from '@/lib/teams';
import { useSalesmanStore } from '@/store/useSalesmanStore';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateTeamSheet({ open, onClose, onCreated }: Props) {
  const { user } = useSalesmanStore();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TeamCategory>('학교');
  const [size, setSize] = useState('');
  const [decisionMaker, setDecisionMaker] = useState('');
  const [phone, setPhone] = useState('');
  const [reorderCycleMonths, setReorderCycleMonths] = useState(6);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setCategory('학교');
    setSize('');
    setDecisionMaker('');
    setPhone('');
    setReorderCycleMonths(6);
    setNote('');
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user?.salesman_profile_id) {
      setError('영업사원 프로필 미확인. 다시 로그인해주세요.');
      return;
    }
    if (!name.trim()) {
      setError('단체명을 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase
        .from('partner_malls')
        .insert({
          name: name.trim(),
          logo_url: '', // 로고는 추후 업로드 단계에서 셋업
          is_active: false, // light 모드로 시작 (단체 메타만)
          owner_salesman_id: user.salesman_profile_id,
          team_meta: {
            category,
            size: size ? Number(size) : undefined,
            decisionMaker: decisionMaker.trim() || undefined,
            phone: phone.trim() || undefined,
            reorderCycleMonths,
            note: note.trim() || undefined,
          },
        });

      if (insertError) {
        console.error('[CreateTeamSheet] insert error:', insertError);
        setError(insertError.message || '등록 실패');
        setSubmitting(false);
        return;
      }

      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError((err as Error).message || '등록 실패');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* Sheet */}
      <div className="relative mt-auto bg-white rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-base font-bold text-gray-900">새 단체 추가</h2>
          <button onClick={handleClose} disabled={submitting} className="p-1 -mr-1 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3">
          <Field label="단체명 *" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 한빛고등학교 댄스부"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              required
            />
          </Field>

          <Field label="카테고리">
            <div className="grid grid-cols-5 gap-1.5">
              {CATEGORY_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                    category === c ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {c}
                </button>
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
            />
          </Field>

          <Field label="결정권자">
            <input
              type="text"
              value={decisionMaker}
              onChange={(e) => setDecisionMaker(e.target.value)}
              placeholder="예: 박지영 코치"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
            />
          </Field>

          <Field label="연락처">
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-1234-5678"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
            />
          </Field>

          <Field label="재발주 주기">
            <div className="grid grid-cols-2 gap-1.5">
              {REORDER_CYCLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setReorderCycleMonths(opt.value)}
                  className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                    reorderCycleMonths === opt.value ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="메모">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="단체 특이사항, 영업 포인트, 디자인 선호 등"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 resize-none"
            />
          </Field>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
          )}

          <div className="text-[11px] text-gray-500 leading-relaxed pt-2">
            ⓘ 등록 후 단체 상세에서 로고/제품 라인업 셋업 → 공유 링크 활성화 가능
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-gray-200 p-3 sticky bottom-0 bg-white">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="w-full bg-brand-500 text-white font-bold py-3 rounded-lg disabled:opacity-50"
          >
            {submitting ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

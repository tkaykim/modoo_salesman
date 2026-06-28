'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui';

const AGE_OPTIONS = ['20대', '30대', '40대', '50대 이상'];

const REGION_EXAMPLES = ['서울 마포구', '경기 수원', '부산 해운대', '대구 수성구'];

export default function ApplyPage() {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const steps = useMemo(
    () => [
      {
        id: 'region',
        eyebrow: '1 / 4',
        title: '어느 지역에서 활동하시나요?',
        desc: '가까운 단체복 수요를 연결할 수 있는 지역만 알려주세요.',
      },
      {
        id: 'age',
        eyebrow: '2 / 4',
        title: '나이대를 알려주세요.',
        desc: '파트너 안내와 교육 자료를 맞춰드리기 위한 기본 정보입니다.',
      },
      {
        id: 'name',
        eyebrow: '3 / 4',
        title: '성함을 알려주세요.',
        desc: '상담 안내를 정확히 드리기 위해 필요합니다.',
      },
      {
        id: 'phone',
        eyebrow: '4 / 4',
        title: '연락처를 남겨주세요.',
        desc: '승인 절차와 시작 안내를 문자 또는 전화로 드립니다.',
      },
    ],
    []
  );

  const currentStep = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  const validateStep = (targetStep = step) => {
    if (targetStep === 0 && region.trim().length < 2) return '활동 지역을 입력해주세요.';
    if (targetStep === 1 && !ageRange) return '나이대를 선택해주세요.';
    if (targetStep === 2 && displayName.trim().length < 2) return '이름을 입력해주세요.';
    if (targetStep === 3 && phone.replace(/[^0-9]/g, '').length < 10) return '연락처를 입력해주세요.';
    return null;
  };

  const goNext = () => {
    const msg = validateStep();
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    for (let i = 0; i < steps.length; i += 1) {
      const msg = validateStep(i);
      if (msg) {
        setStep(i);
        setError(msg);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/salesman/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          phone,
          region,
          age_range: ageRange,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error || '신청에 실패했습니다.');
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-[100dvh] bg-[#f6f7fb] px-5 py-8 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-[24px] bg-white p-6 text-center shadow-[0_18px_46px_rgba(18,31,54,0.12)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#0052cc] shadow-[0_10px_24px_rgba(0,82,204,0.25)]">
            <Icon name="check" size={28} color="white" strokeWidth={2.4} />
          </div>
          <p className="mb-2 text-[11px] font-black text-[#0052cc]">MODOO PARTNERS</p>
          <h1 className="mb-2 text-[22px] font-black tracking-tight text-[#17191f]">
            상담 신청이 완료되었습니다
          </h1>
          <p className="mb-5 text-[13px] leading-relaxed text-[#667085]">
            운영팀이 지역과 기본 정보를 확인한 뒤 연락드립니다.
            <br />
            안내를 받은 뒤 파트너 스쿨과 첫 단체몰 만들기를 시작할 수 있습니다.
          </p>
          <div className="rounded-[16px] bg-[#f6f7fb] p-4 text-left">
            <p className="mb-2 text-[12px] font-black text-[#17191f]">다음 안내</p>
            <p className="text-[12px] leading-relaxed text-[#667085]">
              1분 내 자동 계정 가입이 아니라, 담당자가 적합한 지역과 활동 방식을 확인한 뒤 시작 안내를 드립니다.
            </p>
          </div>
          <Link
            href="/login"
            prefetch={false}
            className="mt-5 flex w-full items-center justify-center rounded-[16px] bg-[#0052cc] px-4 py-3.5 text-[14px] font-black text-white active:bg-[#003f9e]"
          >
            기존 파트너 로그인
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#f6f7fb] text-[#17191f]">
      <main className="mx-auto w-full max-w-md overflow-hidden bg-[#f6f7fb] pb-8">
        <section
          className="relative min-h-[640px] px-5 pb-6 pt-7 text-white"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(11,18,32,0.38) 0%, rgba(11,18,32,0.68) 42%, rgba(11,18,32,0.92) 100%), url('https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=82')",
            backgroundPosition: 'center top',
            backgroundSize: 'cover',
          }}
        >
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#0052cc]">
                <Icon name="trophy" size={20} color="white" strokeWidth={2.2} />
              </div>
              <div>
                <p className="text-[13px] font-black">모두 파트너스</p>
                <p className="text-[10px] font-bold text-white/70">단체복 부업 파트너</p>
              </div>
            </div>
            <Link href="/login" prefetch={false} className="text-[12px] font-black text-white/85">
              로그인
            </Link>
          </div>

          <div className="relative z-10 mt-20">
            <p className="inline-flex items-center gap-1 rounded-full bg-white/16 px-3 py-1 text-[11px] font-black backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ffde59]" />
              주변 단체복 수요를 용돈벌이로
            </p>
            <h1 className="mt-4 text-[40px] font-black leading-[1.05] tracking-tight">
              하루 1시간,
              <br />
              단체복 주문을
              <br />
              수익으로 연결하세요
            </h1>
            <p className="mt-4 max-w-[320px] text-[14px] leading-relaxed text-white/78">
              학교, 동호회, 학원, 매장처럼 단체복이 필요한 곳을 모두의 유니폼 주문 링크로 연결하는 부업입니다.
            </p>
          </div>

          <div className="relative z-10 mt-8 rounded-[18px] bg-white p-4 text-[#17191f] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black text-[#0052cc]">예상 수익 방식</p>
                <p className="mt-1 text-[24px] font-black tracking-tight">
                  주문 매출 기준 수수료
                </p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#ffe75f]">
                <Icon name="wallet" size={27} color="#17191f" strokeWidth={2.3} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <HeroMetric label="초기비용" value="0원" />
              <HeroMetric label="시간" value="자율" />
              <HeroMetric label="교육" value="지원" />
            </div>
          </div>
        </section>

        <section className="-mt-3 rounded-t-[28px] bg-[#f6f7fb] px-5 pb-2 pt-6">
          <SectionTitle eyebrow="HOW IT WORKS" title="복잡한 판매가 아니라 연결하는 일입니다." />
          <div className="mt-4 space-y-3">
            <FlowCard step="01" title="가까운 단체를 떠올립니다" desc="학과, 동호회, 학원, 매장처럼 단체복을 맞출 가능성이 있는 곳이면 충분합니다." icon="group" />
            <FlowCard step="02" title="주문 링크를 전달합니다" desc="디자인, 상품 구성, 결제 페이지는 모두의 유니폼 시스템에서 준비합니다." icon="qr" />
            <FlowCard step="03" title="주문이 결제되면 수수료가 쌓입니다" desc="실제 결제 주문을 기준으로 정산 대상 매출이 잡히고 월별로 확인합니다." icon="wallet" />
          </div>
        </section>

        <section className="px-5 py-5">
          <div className="rounded-[22px] bg-white p-5 shadow-[0_10px_28px_rgba(18,31,54,0.08)]">
            <p className="text-center text-[24px] font-black leading-tight tracking-tight">
              이런 분께 잘 맞아요
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <FitCard title="주변에 모임이 많아요" desc="학교, 동호회, 학원, 회사 지인이 있는 분" />
              <FitCard title="영업 경험은 없어요" desc="처음이어도 스크립트와 교육으로 시작" />
              <FitCard title="퇴근 후 가능해요" desc="정해진 출퇴근 없이 자율 활동" />
              <FitCard title="부담 없이 해보고 싶어요" desc="초기비용 없이 상담 후 시작" />
            </div>
          </div>
        </section>

        <section className="px-5">
          <div className="overflow-hidden rounded-[24px] bg-[#17191f] text-white shadow-[0_16px_42px_rgba(18,31,54,0.18)]">
            <div className="p-5">
              <p className="text-[11px] font-black text-[#ffde59]">PARTNER SCHOOL</p>
              <h2 className="mt-1 text-[23px] font-black leading-tight tracking-tight">
                시작 후에는 스쿨에서 바로 배웁니다.
              </h2>
              <p className="mt-3 text-[13px] leading-relaxed text-white/70">
                첫 단체 후보 찾기, 첫 메시지, 단체몰 만들기까지 앱 안에서 순서대로 따라가도록 구성했습니다.
              </p>
            </div>
            <div className="grid grid-cols-3 border-t border-white/10">
              <MiniSchool label="교육" value="4개" />
              <MiniSchool label="미션" value="7개" />
              <MiniSchool label="리워드" value="예정" />
            </div>
          </div>
        </section>

        <section className="px-5 py-5">
          <div className="rounded-[24px] bg-white p-5 shadow-[0_16px_42px_rgba(18,31,54,0.11)]">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black text-[#0052cc]">30초 상담 신청</p>
                <h2 className="mt-1 text-[22px] font-black tracking-tight">
                  딱 필요한 정보만 받을게요.
                </h2>
              </div>
              <span className="rounded-full bg-[#fff2c7] px-3 py-1 text-[11px] font-black text-[#8a6200]">
                {currentStep.eyebrow}
              </span>
            </div>

            <div className="mb-5 h-2 overflow-hidden rounded-full bg-[#eef0f4]">
              <div
                className="h-full rounded-full bg-[#0052cc] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <form onSubmit={handleSubmit}>
              <div className="min-h-[215px]">
                <p className="text-[24px] font-black leading-tight tracking-tight">
                  {currentStep.title}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-[#667085]">
                  {currentStep.desc}
                </p>
                <div className="mt-6">
                  {step === 0 && (
                    <div>
                      <input
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                        className="modoo-apply-input"
                        placeholder="예: 서울 마포구"
                        autoFocus
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {REGION_EXAMPLES.map((example) => (
                          <button
                            key={example}
                            type="button"
                            onClick={() => setRegion(example)}
                            className="rounded-full border border-[#e2e5eb] px-3 py-2 text-[12px] font-bold text-[#667085] active:bg-[#f6f7fb]"
                          >
                            {example}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {step === 1 && (
                    <div className="grid grid-cols-2 gap-2">
                      {AGE_OPTIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setAgeRange(option)}
                          className={`rounded-[14px] border px-3 py-4 text-[15px] font-black transition-colors ${
                            ageRange === option
                              ? 'border-[#0052cc] bg-[#eaf2ff] text-[#0052cc]'
                              : 'border-[#e2e5eb] bg-white text-[#17191f] active:bg-[#f6f7fb]'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                  {step === 2 && (
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="modoo-apply-input"
                      placeholder="예: 김모두"
                      autoFocus
                    />
                  )}
                  {step === 3 && (
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="modoo-apply-input"
                      placeholder="010-0000-0000"
                      inputMode="tel"
                      type="tel"
                      autoFocus
                    />
                  )}
                </div>
              </div>

              {error && (
                <div className="mb-3 rounded-[12px] border border-[#0052cc]/25 bg-[#eaf2ff] px-3 py-2 text-[12px] font-bold text-[#003f9e]">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStep((prev) => Math.max(prev - 1, 0));
                    }}
                    className="w-[92px] rounded-[16px] border border-[#e2e5eb] bg-white px-3 py-4 text-[14px] font-black text-[#667085] active:bg-[#f6f7fb]"
                  >
                    이전
                  </button>
                )}
                {step < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="flex-1 rounded-[16px] bg-[#0052cc] px-3 py-4 text-[15px] font-black text-white shadow-[0_12px_24px_rgba(0,82,204,0.24)] active:bg-[#003f9e]"
                  >
                    다음
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-[16px] bg-[#0052cc] px-3 py-4 text-[15px] font-black text-white shadow-[0_12px_24px_rgba(0,82,204,0.24)] active:bg-[#003f9e] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? '신청 접수 중...' : '상담 신청 완료'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>

        <p className="px-6 text-[10px] leading-relaxed text-[#98a2b3]">
          수익은 실제 결제 주문과 정산 기준에 따라 달라질 수 있습니다.
          <br />
          초기비용 0원은 모두 파트너스 신청과 기본 교육 기준이며, 별도 유료 가입비를 받지 않는다는 의미입니다.
        </p>
      </main>

      <style jsx>{`
        :global(.modoo-apply-input) {
          width: 100%;
          border-radius: 16px;
          border: 1px solid #e2e5eb;
          background: #fff;
          padding: 15px 16px;
          font-size: 18px;
          font-weight: 800;
          color: #17191f;
          outline: none;
        }
        :global(.modoo-apply-input::placeholder) {
          color: #b7bdc7;
        }
        :global(.modoo-apply-input:focus) {
          border-color: #0052cc;
          box-shadow: 0 0 0 4px rgba(0, 82, 204, 0.1);
        }
      `}</style>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-[11px] font-black text-[#0052cc]">{eyebrow}</p>
      <h2 className="mt-1 text-[23px] font-black leading-tight tracking-tight text-[#17191f]">{title}</h2>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-[#f6f7fb] px-3 py-2">
      <p className="text-[10px] font-bold text-[#667085]">{label}</p>
      <p className="mt-0.5 text-[15px] font-black text-[#17191f]">{value}</p>
    </div>
  );
}

function FlowCard({
  step,
  title,
  desc,
  icon,
}: {
  step: string;
  title: string;
  desc: string;
  icon: 'group' | 'qr' | 'wallet';
}) {
  return (
    <div className="flex gap-3 rounded-[20px] bg-white p-4 shadow-[0_8px_24px_rgba(18,31,54,0.07)]">
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#eaf2ff]">
        <Icon name={icon} size={22} color="#0052cc" strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black text-[#0052cc]">{step}</p>
        <p className="mt-0.5 text-[15px] font-black tracking-tight text-[#17191f]">{title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#667085]">{desc}</p>
      </div>
    </div>
  );
}

function FitCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="min-h-[116px] rounded-[18px] bg-[#f6f7fb] p-4">
      <p className="text-[14px] font-black leading-tight tracking-tight text-[#17191f]">{title}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-[#667085]">{desc}</p>
    </div>
  );
}

function MiniSchool({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="p-4 text-center">
      <p className="text-[10px] font-bold text-white/45">{label}</p>
      <p className="mt-1 text-[16px] font-black">{value}</p>
    </div>
  );
}

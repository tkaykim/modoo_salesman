'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/ui';

const AGE_OPTIONS = ['20대', '30대', '40대', '50대 이상'];

const REGION_EXAMPLES = ['서울 마포구', '경기 수원', '부산 해운대', '대구 수성구'];

const IMPACT_STATS = [
  { label: '신청 입력', value: 30, suffix: '초' },
  { label: '교육 영상', value: 4, suffix: '개' },
  { label: '실행 미션', value: 7, suffix: '개' },
];

const FLOW_MOMENTS: Array<{
  step: string;
  title: string;
  desc: string;
  icon: IconName;
  meta: string;
}> = [
  {
    step: '01',
    title: '가까운 단체를 떠올립니다',
    desc: '학과, 동호회, 학원, 매장처럼 단체복을 맞출 가능성이 있는 곳이면 충분합니다.',
    icon: 'group',
    meta: '후보 찾기',
  },
  {
    step: '02',
    title: '주문 링크를 전달합니다',
    desc: '디자인, 상품 구성, 결제 페이지는 모두의 유니폼 시스템에서 준비합니다.',
    icon: 'qr',
    meta: '링크 전달',
  },
  {
    step: '03',
    title: '결제 주문이 수수료로 쌓입니다',
    desc: '실제 결제 주문을 기준으로 정산 대상 매출이 잡히고 월별로 확인합니다.',
    icon: 'wallet',
    meta: '정산 확인',
  },
];

const FIT_SIGNALS = [
  ['01', '주변에 모임이 많아요', '학교, 동호회, 학원, 회사 지인이 있는 분'],
  ['02', '영업 경험은 없어도 괜찮아요', '처음 메시지와 첫 단체몰 만들기를 스쿨에서 따라갑니다'],
  ['03', '퇴근 후 짧게 움직이고 싶어요', '정해진 출퇴근 없이 후보 발굴과 링크 전달 중심입니다'],
  ['04', '부담 없이 먼저 알아보고 싶어요', '초기비용 없이 상담 후 시작 여부를 결정합니다'],
] as const;

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
      <div className="modoo-apply-page min-h-[100dvh] bg-[#f6f7fb] px-5 py-8 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-[24px] bg-white p-6 text-center shadow-[0_18px_46px_rgba(18,31,54,0.12)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#0052cc] shadow-[0_10px_24px_rgba(0,82,204,0.25)]">
            <Icon name="check" size={28} color="white" strokeWidth={2.4} />
          </div>
          <p className="mb-2 text-[11px] font-black text-[#0052cc]">MODOO PARTNERS</p>
          <h1 className="mb-2 text-[22px] font-black text-[#17191f]">
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
    <div className="modoo-apply-page min-h-[100dvh] bg-[#f6f7fb] text-[#17191f]">
      <main className="mx-auto w-full max-w-md overflow-hidden bg-[#f6f7fb] pb-8">
        <section
          className="relative min-h-[640px] px-5 pb-7 pt-7 text-white"
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
              <span className="h-1.5 w-1.5 rounded-full bg-[#0052cc]" />
              주변 단체복 수요를 용돈벌이로
            </p>
            <h1 className="mt-4 text-[40px] font-black leading-[1.05]">
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
                <p className="mt-1 text-[24px] font-black">
                  주문 매출 기준 수수료
                </p>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#eaf2ff]">
                <Icon name="wallet" size={27} color="#0052cc" strokeWidth={2.3} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <HeroMetric label="초기비용" value="0원" />
              <HeroMetric label="시간" value="자율" />
              <HeroMetric label="교육" value="지원" />
            </div>
          </div>
        </section>

        <section className="-mt-3 rounded-t-[30px] bg-[#f6f7fb] px-5 pb-8 pt-8">
          <RevealBlock>
            <SectionTitle eyebrow="MODOO PARTNERS" title="부업처럼 시작하고, 앱 안에서 순서대로 움직입니다." />
          </RevealBlock>

          <RevealBlock className="relative mt-5 overflow-hidden rounded-[28px] bg-[#0052cc] px-5 pt-5 text-white shadow-[0_18px_48px_rgba(0,82,204,0.26)]">
            <div className="pointer-events-none absolute -right-16 top-5 h-40 w-40 rounded-full border border-white/15" />
            <div className="pointer-events-none absolute -right-7 top-14 h-20 w-20 rounded-full bg-white/10" />
            <p className="text-[11px] font-black text-white/72">오늘 필요한 행동</p>
            <h2 className="mt-1 text-[27px] font-black leading-tight">
              후보 하나와
              <br />
              주문 링크 하나면 충분합니다.
            </h2>
            <p className="mt-3 max-w-[250px] text-[13px] leading-relaxed text-white/72">
              상담 후에는 앱이 첫 메시지, 첫 단체몰, 첫 공유까지 순서대로 안내합니다.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {IMPACT_STATS.map((stat, index) => (
                <ImpactStat key={stat.label} {...stat} delay={index * 120} />
              ))}
            </div>

            <div className="relative mt-5 h-[278px] overflow-hidden">
              <div className="absolute left-0 top-4 z-20 max-w-[190px] rounded-[18px] bg-white px-4 py-3 text-[#17191f] shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
                <p className="text-[12px] font-black leading-snug">
                  어디에 소개하면 좋을지부터 같이 봐요.
                </p>
                <span className="absolute -bottom-2 left-8 h-4 w-4 rotate-45 bg-white" />
              </div>
              <Image
                src="/apply-partner-character.png"
                alt=""
                width={720}
                height={960}
                className="modoo-character-float absolute bottom-[-126px] right-[-46px] w-[280px] max-w-none select-none"
                priority
                unoptimized
              />
            </div>
          </RevealBlock>
        </section>

        <section className="bg-white px-5 py-8">
          <RevealBlock>
            <SectionTitle eyebrow="HOW IT WORKS" title="판매보다 연결에 가깝게 움직입니다." />
          </RevealBlock>
          <div className="relative mt-5">
            <div className="modoo-flow-line absolute bottom-4 left-[23px] top-4 w-px bg-[#cfe0ff]" />
            {FLOW_MOMENTS.map((moment, index) => (
              <FlowMoment key={moment.step} {...moment} delay={index * 120} />
            ))}
          </div>
        </section>

        <section className="bg-[#f6f7fb] px-5 py-8">
          <RevealBlock>
            <p className="text-[11px] font-black text-[#0052cc]">FIT CHECK</p>
            <h2 className="mt-1 text-[25px] font-black leading-tight text-[#17191f]">
              이런 연결망이 있으면
              <br />
              시작이 훨씬 쉽습니다.
            </h2>
          </RevealBlock>

          <RevealBlock className="modoo-marquee mt-5 overflow-hidden border-y border-[#d7e6ff] py-3">
            <div className="modoo-marquee-track flex gap-3 text-[13px] font-black text-[#0052cc]">
              {['학과', '동호회', '학원', '매장', '회사', '교회', '크루', '동아리', '학과', '동호회', '학원', '매장'].map((item, index) => (
                <span key={`${item}-${index}`} className="whitespace-nowrap rounded-full bg-[#eaf2ff] px-3 py-2">
                  {item}
                </span>
              ))}
            </div>
          </RevealBlock>

          <div className="mt-4 divide-y divide-[#dfe8f7] border-y border-[#dfe8f7]">
            {FIT_SIGNALS.map(([index, title, desc], rowIndex) => (
              <FitSignal key={index} index={index} title={title} desc={desc} delay={rowIndex * 100} />
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#07101f] px-5 py-8 text-white">
          <div className="pointer-events-none absolute -left-24 top-10 h-52 w-52 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -right-16 bottom-12 h-44 w-44 rounded-full bg-[#0052cc]/22" />
          <RevealBlock className="relative z-10">
            <p className="text-[11px] font-black text-[#8fb8ff]">PARTNER SCHOOL</p>
            <h2 className="mt-1 text-[27px] font-black leading-tight">
              시작 후에는
              <br />
              스쿨이 옆에서 따라옵니다.
            </h2>
            <p className="mt-3 max-w-[280px] text-[13px] leading-relaxed text-white/68">
              첫 단체 후보 찾기, 첫 메시지, 단체몰 만들기까지 앱 안에서 순서대로 따라가도록 구성했습니다.
            </p>
          </RevealBlock>

          <RevealBlock className="relative z-10 mt-6 grid grid-cols-3 gap-2">
            <SchoolStat label="교육" value={4} suffix="개" />
            <SchoolStat label="미션" value={7} suffix="개" />
            <SchoolStat label="리워드" text="예정" />
          </RevealBlock>

          <RevealBlock className="relative z-10 mt-6 min-h-[214px]">
            <div className="absolute left-0 top-3 z-20 max-w-[205px] rounded-[18px] bg-white px-4 py-3 text-[#17191f] shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
              <p className="text-[12px] font-black leading-snug">
                오늘은 6분짜리 인트로부터 시작해볼게요.
              </p>
              <span className="absolute -bottom-2 left-8 h-4 w-4 rotate-45 bg-white" />
            </div>
            <Image
              src="/apply-partner-character.png"
              alt=""
              width={720}
              height={960}
              className="modoo-character-float absolute bottom-[-122px] right-[-70px] w-[262px] max-w-none select-none"
              unoptimized
            />
          </RevealBlock>
        </section>

        <section className="px-5 py-5">
          <RevealBlock className="rounded-[24px] bg-white p-5 shadow-[0_16px_42px_rgba(18,31,54,0.11)]">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black text-[#0052cc]">30초 상담 신청</p>
                <h2 className="mt-1 text-[22px] font-black">
                  딱 필요한 정보만 받을게요.
                </h2>
              </div>
              <span className="rounded-full bg-[#eaf2ff] px-3 py-1 text-[11px] font-black text-[#0052cc]">
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
                <p className="text-[24px] font-black leading-tight">
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
          </RevealBlock>
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
        :global(.modoo-apply-page) {
          letter-spacing: 0;
        }
        :global(.modoo-reveal) {
          opacity: 0;
          transform: translateY(22px);
          transition: opacity 620ms ease, transform 620ms ease;
          will-change: opacity, transform;
        }
        :global(.modoo-reveal.is-visible) {
          opacity: 1;
          transform: translateY(0);
        }
        :global(.modoo-character-float) {
          animation: modoo-character-float 3.8s ease-in-out infinite;
        }
        :global(.modoo-flow-line) {
          transform-origin: top;
          animation: modoo-flow-draw 1.2s ease-out both;
          animation-timeline: view();
          animation-range: entry 10% cover 58%;
        }
        :global(.modoo-marquee-track) {
          width: max-content;
          animation: modoo-marquee 18s linear infinite;
        }
        @keyframes modoo-character-float {
          0%, 100% {
            transform: translate3d(0, 0, 0) rotate(-1deg);
          }
          50% {
            transform: translate3d(0, -7px, 0) rotate(1deg);
          }
        }
        @keyframes modoo-flow-draw {
          from {
            transform: scaleY(0);
          }
          to {
            transform: scaleY(1);
          }
        }
        @keyframes modoo-marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.modoo-reveal),
          :global(.modoo-reveal.is-visible),
          :global(.modoo-character-float),
          :global(.modoo-flow-line),
          :global(.modoo-marquee-track) {
            animation: none;
            opacity: 1;
            transform: none;
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-[11px] font-black text-[#0052cc]">{eyebrow}</p>
      <h2 className="mt-1 text-[23px] font-black leading-tight text-[#17191f]">{title}</h2>
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

function ImpactStat({
  label,
  value,
  suffix,
  delay = 0,
}: {
  label: string;
  value: number;
  suffix: string;
  delay?: number;
}) {
  return (
    <div className="rounded-[16px] bg-white/12 px-3 py-3 backdrop-blur">
      <p className="text-[10px] font-bold text-white/62">{label}</p>
      <p className="mt-1 text-[22px] font-black leading-none">
        <AnimatedNumber value={value} suffix={suffix} delay={delay} />
      </p>
    </div>
  );
}

function FlowMoment({
  step,
  title,
  desc,
  icon,
  meta,
  delay = 0,
}: {
  step: string;
  title: string;
  desc: string;
  icon: IconName;
  meta: string;
  delay?: number;
}) {
  return (
    <RevealBlock className="relative flex gap-4 py-4" delay={delay}>
      <div className="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#eaf2ff] ring-8 ring-white">
        <Icon name={icon} size={22} color="#0052cc" strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1 border-b border-[#eef0f4] pb-4">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-black text-[#0052cc]">{step}</p>
          <span className="rounded-full bg-[#eaf2ff] px-2 py-1 text-[10px] font-black text-[#0052cc]">
            {meta}
          </span>
        </div>
        <p className="mt-1 text-[16px] font-black text-[#17191f]">{title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#667085]">{desc}</p>
      </div>
    </RevealBlock>
  );
}

function FitSignal({
  index,
  title,
  desc,
  delay = 0,
}: {
  index: string;
  title: string;
  desc: string;
  delay?: number;
}) {
  return (
    <RevealBlock className="flex items-start gap-4 py-4" delay={delay}>
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#0052cc] text-[12px] font-black text-white">
        {index}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-black leading-snug text-[#17191f]">{title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#667085]">{desc}</p>
      </div>
    </RevealBlock>
  );
}

function SchoolStat({
  label,
  value,
  suffix = '',
  text,
}: {
  label: string;
  value?: number;
  suffix?: string;
  text?: string;
}) {
  return (
    <div className="rounded-[16px] bg-white/10 px-3 py-3 text-center">
      <p className="text-[10px] font-bold text-white/48">{label}</p>
      <p className="mt-1 text-[18px] font-black">
        {typeof value === 'number' ? <AnimatedNumber value={value} suffix={suffix} /> : text}
      </p>
    </div>
  );
}

function RevealBlock({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.16 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`modoo-reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function AnimatedNumber({
  value,
  suffix = '',
  delay = 0,
}: {
  value: number;
  suffix?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [started, setStarted] = useState(false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      const frame = window.requestAnimationFrame(() => setDisplay(value));
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.55 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);

  useEffect(() => {
    if (!started) return;
    let frame = 0;
    let timer = 0;
    const duration = 950;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    timer = window.setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        setDisplay(Math.round(value * easeOut(progress)));
        if (progress < 1) frame = window.requestAnimationFrame(tick);
      };
      frame = window.requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
    };
  }, [delay, started, value]);

  return (
    <span ref={ref} className="num">
      {display.toLocaleString('ko-KR')}
      {suffix}
    </span>
  );
}

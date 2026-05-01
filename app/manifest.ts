import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '모두의 유니폼 — 영업사원',
    short_name: '모두유니폼',
    description: '단체복 영업사원 전용 모바일 앱. 단체 관리·재발주·견적·수당 추적.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0052cc',
    theme_color: '#0052cc',
    lang: 'ko',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}

// v2 디자인 시스템 아이콘 — modoo_app/app/v2/_components/tokens.tsx 포팅
// 24x24 viewBox, stroke-width 1.7 default, round caps/joins

import type { CSSProperties } from 'react';

export type IconName =
  | 'home'
  | 'grid'
  | 'box'
  | 'user'
  | 'cart'
  | 'search'
  | 'arrow-r'
  | 'arrow-l'
  | 'arrow-up-r'
  | 'plus'
  | 'minus'
  | 'check'
  | 'close'
  | 'heart'
  | 'heart-fill'
  | 'star'
  | 'star-fill'
  | 'truck'
  | 'package'
  | 'sparkle'
  | 'palette'
  | 'image'
  | 'type'
  | 'shapes'
  | 'undo'
  | 'redo'
  | 'layers'
  | 'rotate'
  | 'bookmark'
  | 'bell'
  | 'card'
  | 'pin'
  | 'chevron-r'
  | 'chevron-d'
  | 'chevron-u'
  | 'chevron-l'
  | 'share'
  | 'qr'
  | 'flame'
  | 'group'
  | 'tag'
  | 'edit'
  | 'trash'
  | 'filter'
  | 'sort'
  | 'menu'
  | 'phone'
  | 'gift'
  | 'send'
  | 'verified'
  | 'leaf'
  | 'sticker'
  | 'crop'
  | 'bg'
  | 'ruler'
  | 'wallet'
  | 'briefcase'
  | 'history'
  | 'logout'
  | 'info'
  | 'alert'
  | 'bolt'
  | 'map'
  | 'target'
  | 'clock'
  | 'arrow-up'
  | 'trophy';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({
  name,
  size = 22,
  color = 'currentColor',
  strokeWidth = 1.7,
  className,
  style,
}: IconProps) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    style,
  };
  switch (name) {
    case 'home':
      return (
        <svg {...p}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10v9h14v-9" />
        </svg>
      );
    case 'grid':
      return (
        <svg {...p}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'box':
    case 'package':
      return (
        <svg {...p}>
          <path d="M3.5 7.5 12 4l8.5 3.5v9L12 20l-8.5-3.5z" />
          <path d="M3.5 7.5 12 11l8.5-3.5" />
          <path d="M12 11v9" />
          {name === 'package' && <path d="m7.5 5.7 8.5 3.6" />}
        </svg>
      );
    case 'user':
      return (
        <svg {...p}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" />
        </svg>
      );
    case 'cart':
      return (
        <svg {...p}>
          <path d="M3.5 4.5h2.5l2 12h11" />
          <path d="M7 8h13l-1.5 7H8.5" />
          <circle cx="10" cy="20" r="1.2" />
          <circle cx="17" cy="20" r="1.2" />
        </svg>
      );
    case 'search':
      return (
        <svg {...p}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case 'arrow-r':
      return (
        <svg {...p}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
    case 'arrow-l':
      return (
        <svg {...p}>
          <path d="M19 12H5" />
          <path d="m11 18-6-6 6-6" />
        </svg>
      );
    case 'arrow-up-r':
      return (
        <svg {...p}>
          <path d="M7 17 17 7" />
          <path d="M9 7h8v8" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...p}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'minus':
      return (
        <svg {...p}>
          <path d="M5 12h14" />
        </svg>
      );
    case 'check':
      return (
        <svg {...p}>
          <path d="m5 12 5 5L20 7" />
        </svg>
      );
    case 'close':
      return (
        <svg {...p}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );
    case 'heart':
      return (
        <svg {...p}>
          <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
        </svg>
      );
    case 'heart-fill':
      return (
        <svg {...p} fill={color} stroke="none">
          <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
        </svg>
      );
    case 'star':
      return (
        <svg {...p}>
          <path d="m12 4 2.5 5 5.5.8-4 4 1 5.6L12 16.8 7 19.4l1-5.6-4-4 5.5-.8z" />
        </svg>
      );
    case 'star-fill':
      return (
        <svg {...p} fill={color} stroke="none">
          <path d="m12 4 2.5 5 5.5.8-4 4 1 5.6L12 16.8 7 19.4l1-5.6-4-4 5.5-.8z" />
        </svg>
      );
    case 'truck':
      return (
        <svg {...p}>
          <path d="M3 6.5h11v9H3z" />
          <path d="M14 9.5h4l3 3v3h-7" />
          <circle cx="7.5" cy="17" r="1.6" />
          <circle cx="17" cy="17" r="1.6" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg {...p}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
        </svg>
      );
    case 'palette':
      return (
        <svg {...p}>
          <path d="M12 4a8 8 0 1 0 0 16c1 0 1.5-.7 1.5-1.5 0-1-1-1-1-2.2 0-1.6 1.4-2.3 3.5-2.3H18a4 4 0 0 0 0-8 8 8 0 0 0-6-2z" />
          <circle cx="7.5" cy="11" r="1" />
          <circle cx="10" cy="7.5" r="1" />
          <circle cx="15" cy="7.5" r="1" />
        </svg>
      );
    case 'image':
      return (
        <svg {...p}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m4 17 5-5 4 4 3-3 4 4" />
        </svg>
      );
    case 'type':
      return (
        <svg {...p}>
          <path d="M5 6V5h14v1M12 5v14M9 19h6" />
        </svg>
      );
    case 'shapes':
      return (
        <svg {...p}>
          <circle cx="7" cy="7" r="3" />
          <rect x="13" y="4" width="7" height="7" rx="1.2" />
          <path d="M12 14l4 6H8z" />
        </svg>
      );
    case 'undo':
      return (
        <svg {...p}>
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h9a6 6 0 0 1 0 12h-3" />
        </svg>
      );
    case 'redo':
      return (
        <svg {...p}>
          <path d="m15 14 5-5-5-5" />
          <path d="M20 9h-9a6 6 0 0 0 0 12h3" />
        </svg>
      );
    case 'layers':
      return (
        <svg {...p}>
          <path d="m12 4 9 5-9 5-9-5z" />
          <path d="m3 14 9 5 9-5" />
        </svg>
      );
    case 'rotate':
      return (
        <svg {...p}>
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 4v5h-5" />
        </svg>
      );
    case 'bookmark':
      return (
        <svg {...p}>
          <path d="M6 4h12v17l-6-4-6 4z" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...p}>
          <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'card':
      return (
        <svg {...p}>
          <rect x="3.5" y="6" width="17" height="12" rx="2" />
          <path d="M3.5 10h17" />
          <path d="M7 15h3" />
        </svg>
      );
    case 'pin':
      return (
        <svg {...p}>
          <path d="M12 21s-6-6-6-11a6 6 0 1 1 12 0c0 5-6 11-6 11z" />
          <circle cx="12" cy="10" r="2" />
        </svg>
      );
    case 'chevron-r':
      return (
        <svg {...p}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
    case 'chevron-l':
      return (
        <svg {...p}>
          <path d="m15 6-6 6 6 6" />
        </svg>
      );
    case 'chevron-d':
      return (
        <svg {...p}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case 'chevron-u':
      return (
        <svg {...p}>
          <path d="m6 15 6-6 6 6" />
        </svg>
      );
    case 'share':
      return (
        <svg {...p}>
          <path d="M12 4v12" />
          <path d="m7 9 5-5 5 5" />
          <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
        </svg>
      );
    case 'qr':
      return (
        <svg {...p}>
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <path d="M14 14h2v2h-2zM18 14h2v2M14 18h2v2M18 18h2v2" />
        </svg>
      );
    case 'flame':
      return (
        <svg {...p}>
          <path d="M12 3c2 4-2 5-2 9a4 4 0 0 0 8 0c0-2-1-3-2-4 1 4-2 5-4 5-1-3 2-5 0-10z" />
        </svg>
      );
    case 'group':
      return (
        <svg {...p}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="16" cy="9" r="2.5" />
          <path d="M3.5 19c.7-2.5 3-4 5.5-4s4.8 1.5 5.5 4" />
          <path d="M14 16c.5-1.5 2-2 3.5-2s2.5.5 3 2" />
        </svg>
      );
    case 'tag':
      return (
        <svg {...p}>
          <path d="M3.5 12.5 12 4h7v7l-8.5 8.5z" />
          <circle cx="15.5" cy="8.5" r="1.2" />
        </svg>
      );
    case 'edit':
      return (
        <svg {...p}>
          <path d="M4 20h4l11-11-4-4L4 16z" />
          <path d="m13 6 4 4" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...p}>
          <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
        </svg>
      );
    case 'filter':
      return (
        <svg {...p}>
          <path d="M3 5h18l-7 9v6l-4-2v-4z" />
        </svg>
      );
    case 'sort':
      return (
        <svg {...p}>
          <path d="M7 4v16M4 7l3-3 3 3M17 4v16M14 17l3 3 3-3" />
        </svg>
      );
    case 'menu':
      return (
        <svg {...p}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...p}>
          <path d="M5 4h4l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
        </svg>
      );
    case 'gift':
      return (
        <svg {...p}>
          <rect x="3.5" y="9" width="17" height="11" rx="1.5" />
          <path d="M3.5 9h17" />
          <path d="M12 9v11" />
          <path d="M12 9c-2 0-4-1.5-4-3a2 2 0 0 1 4 0c0-1.5 2-3 4-3a2 2 0 0 1 0 4c-1.5 0-4-1-4-1z" />
        </svg>
      );
    case 'send':
      return (
        <svg {...p}>
          <path d="M21 4 11 14" />
          <path d="M21 4 14 21l-3-7-7-3z" />
        </svg>
      );
    case 'verified':
      return (
        <svg {...p}>
          <path d="m4 12 2.5-2.5L4 7l3-1.5L8 2.5l3 1L13 1l1.5 2.5L17 4l.5 3 2.5 2-2 2.5.5 3-3 .5-1 2.5-3-1-2 2-2-2-3 1z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'leaf':
      return (
        <svg {...p}>
          <path d="M5 19c0-8 6-14 15-14 0 9-6 14-14 14" />
          <path d="M5 19 12 12" />
        </svg>
      );
    case 'sticker':
      return (
        <svg {...p}>
          <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a4 4 0 0 0 4-4V10z" />
          <path d="M14 4v4a2 2 0 0 0 2 2h4" />
        </svg>
      );
    case 'crop':
      return (
        <svg {...p}>
          <path d="M6 2v16h16" />
          <path d="M2 6h16v16" />
        </svg>
      );
    case 'bg':
      return (
        <svg {...p}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
          <path d="m4 16 4-4 4 4 3-3 5 5" />
          <circle cx="9" cy="9" r="1.5" />
        </svg>
      );
    case 'ruler':
      return (
        <svg {...p}>
          <path d="m3 14 11-11 7 7L10 21z" />
          <path d="M7 10v3M10 7v3M13 10v3M10 13v3M16 10v3" />
        </svg>
      );
    case 'wallet':
      return (
        <svg {...p}>
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M3 10h18" />
          <circle cx="16.5" cy="14" r="1.2" fill={color} stroke="none" />
        </svg>
      );
    case 'briefcase':
      return (
        <svg {...p}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
          <path d="M3 13h18" />
        </svg>
      );
    case 'history':
      return (
        <svg {...p}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...p}>
          <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
          <path d="m15 8 4 4-4 4" />
          <path d="M19 12H9" />
        </svg>
      );
    case 'info':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v.01M11 12h1v5h1" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6M12 16v.01" />
        </svg>
      );
    case 'bolt':
      return (
        <svg {...p}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      );
    case 'map':
      return (
        <svg {...p}>
          <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2z" />
          <path d="M9 3v16M15 5v16" />
        </svg>
      );
    case 'target':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'arrow-up':
      return (
        <svg {...p}>
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      );
    case 'trophy':
      return (
        <svg {...p}>
          <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
          <path d="M5 4H3v3a3 3 0 0 0 3 3M19 4h2v3a3 3 0 0 1-3 3" />
        </svg>
      );
    default:
      return null;
  }
}

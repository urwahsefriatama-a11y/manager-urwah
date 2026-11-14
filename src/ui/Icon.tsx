// Ikon garis buatan sendiri (bukan salinan aset pihak lain), satu warna, presisi di kotak 24×24.
import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'home' | 'rec' | 'ask' | 'task' | 'scan' | 'chat' | 'note' | 'shalat' | 'file' | 'wid' | 'set' | 'alarm'
  | 'menu' | 'close' | 'back' | 'plus' | 'minus' | 'check' | 'chev' | 'mic' | 'pause' | 'play' | 'stop' | 'flag'
  | 'trash' | 'bell' | 'pin' | 'key' | 'battery' | 'compass' | 'copy' | 'share' | 'send' | 'attach' | 'spark'
  | 'user' | 'edit' | 'camera' | 'refresh' | 'map' | 'book' | 'calendar' | 'merge';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export function Icon({ name, size = 24, color = '#FFFFFF', strokeWidth = 1.9 }: Props) {
  const s = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const f = { fill: color };
  let body: ReactNode = null;
  switch (name) {
    case 'home':
      body = (<><Path d="M4 11 12 4.5 20 11v7.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" {...s} /><Rect x={10} y={13.5} width={4} height={6.5} rx={1} {...f} /></>);
      break;
    case 'rec':
      body = (<><Circle cx={12} cy={12} r={8.5} {...s} /><Circle cx={12} cy={12} r={4} {...f} /></>);
      break;
    case 'ask':
      body = (<><Path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7.5a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5v-3.6A2.5 2.5 0 0 1 4 14z" {...s} /><Circle cx={8.6} cy={10.2} r={1.35} {...f} /><Circle cx={12} cy={10.2} r={1.35} {...f} /><Circle cx={15.4} cy={10.2} r={1.35} {...f} /></>);
      break;
    case 'task':
      body = (<><Circle cx={12} cy={12} r={8.5} {...s} /><Path d="m8 12.2 2.8 2.8L16.5 9" {...s} strokeWidth={2.4} /></>);
      break;
    case 'scan':
      body = (<><Path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" {...s} /><Rect x={6.5} y={10.8} width={11} height={2.4} rx={1.2} {...f} /></>);
      break;
    case 'chat':
      body = (<><Path d="M9.5 4h8.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-.5v2.8l-3-2.8" {...s} /><Path d="M4 9.5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H9l-4 3v-3.2A2 2 0 0 1 4 15z" {...s} /></>);
      break;
    case 'note':
      body = (<><Path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" {...s} /><Path d="M14 3.5V8h4.5M8.6 17h5" {...s} /><Rect x={7.6} y={11} width={8.8} height={3.2} rx={1} {...f} /></>);
      break;
    case 'shalat':
      body = (<><Path d="M18.5 14.6A7.4 7.4 0 0 1 9.4 5.5a7.4 7.4 0 1 0 9.1 9.1z" {...f} /><Path d="M17 4l.7 1.5 1.5.7-1.5.7L17 8.4l-.7-1.5-1.5-.7 1.5-.7z" {...f} /></>);
      break;
    case 'file':
      body = (<><Path d="M4.5 12h.01M19.5 12h.01M7.5 9.5v5M16.5 9.5v5" {...s} /><Rect x={9.3} y={5} width={2.1} height={14} rx={1.05} {...f} /><Rect x={12.6} y={7.5} width={2.1} height={9} rx={1.05} {...f} /></>);
      break;
    case 'wid':
      body = (<><Rect x={4} y={4} width={9} height={9} rx={2.5} {...f} /><Rect x={15} y={4} width={5} height={9} rx={2} {...s} /><Rect x={4} y={15} width={16} height={5} rx={2} {...s} /></>);
      break;
    case 'set':
      body = (<><Path d="M4 8h16M4 16h16" {...s} /><Circle cx={9} cy={8} r={2.7} {...f} /><Circle cx={15} cy={16} r={2.7} {...f} /></>);
      break;
    case 'alarm':
      body = (<><Circle cx={12} cy={13} r={7.5} {...s} /><Path d="M12 9.5V13l2.5 1.5M5 4.5 3 6.5M19 4.5l2 2" {...s} /></>);
      break;
    case 'menu':
      body = <Path d="M5 9h14M5 15h14" {...s} />;
      break;
    case 'close':
      body = <Path d="M6 6l12 12M18 6 6 18" {...s} />;
      break;
    case 'back':
      body = <Path d="m15 6-6 6 6 6" {...s} />;
      break;
    case 'chev':
      body = <Path d="m9 6 6 6-6 6" {...s} />;
      break;
    case 'plus':
      body = <Path d="M12 5v14M5 12h14" {...s} />;
      break;
    case 'minus':
      body = <Path d="M5 12h14" {...s} />;
      break;
    case 'check':
      body = <Path d="m5 12 5 5 9-10" {...s} />;
      break;
    case 'mic':
      body = (<><Rect x={9} y={3} width={6} height={11} rx={3} {...s} /><Path d="M5 11a7 7 0 0 0 14 0M12 18v3" {...s} /></>);
      break;
    case 'pause':
      body = <Path d="M9 5v14M15 5v14" {...s} />;
      break;
    case 'play':
      body = <Path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" {...f} />;
      break;
    case 'stop':
      body = <Rect x={6} y={6} width={12} height={12} rx={3} {...f} />;
      break;
    case 'flag':
      body = <Path d="M5 21V4h11l-2 4 2 4H5" {...s} />;
      break;
    case 'trash':
      body = <Path d="M5 7h14M10 11v6M14 11v6M6.5 7l1 12a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8l1-12M9.5 7V4.5h5V7" {...s} />;
      break;
    case 'bell':
      body = <Path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9M10 20a2 2 0 0 0 4 0" {...s} />;
      break;
    case 'pin':
      body = (<><Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" {...s} /><Circle cx={12} cy={10} r={2.4} {...f} /></>);
      break;
    case 'key':
      body = (<><Circle cx={8} cy={14} r={4} {...s} /><Path d="m11 11 8-8M16 6l2.5 2.5M14 8l2 2" {...s} /></>);
      break;
    case 'battery':
      body = (<><Rect x={3} y={7} width={16} height={10} rx={2.5} {...s} /><Path d="M21 10.5v3" {...s} /><Rect x={5.5} y={9.5} width={7} height={5} rx={1} {...f} /></>);
      break;
    case 'compass':
      body = (<><Circle cx={12} cy={12} r={8.5} {...s} /><Path d="m15.5 8.5-2 5-5 2 2-5z" {...f} /></>);
      break;
    case 'copy':
      body = (<><Rect x={8.5} y={8.5} width={11} height={11} rx={2.2} {...s} /><Path d="M15.5 5.5v-.5a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 5v8A1.5 1.5 0 0 0 6 14.5h.5" {...s} /></>);
      break;
    case 'share':
      body = (<><Path d="M12 3.5v11M7.5 8 12 3.5 16.5 8" {...s} /><Path d="M5 12.5v5.5A1.5 1.5 0 0 0 6.5 19.5h11A1.5 1.5 0 0 0 19 18v-5.5" {...s} /></>);
      break;
    case 'send':
      body = <Path d="M4.5 11.4 19.3 4.6a.5.5 0 0 1 .66.66L13.2 20a.5.5 0 0 1-.93-.06L10.5 13.5 4.06 11.8a.5.5 0 0 1 .44-.4zM10.5 13.5 15 9" {...s} />;
      break;
    case 'attach':
      body = <Path d="m19 11.5-7.2 7.2a4.5 4.5 0 0 1-6.4-6.4l7.6-7.6a3 3 0 0 1 4.3 4.3l-7.4 7.4a1.5 1.5 0 0 1-2.1-2.1l6.7-6.7" {...s} />;
      break;
    case 'spark':
      body = (<><Path d="M12 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5z" {...f} /><Circle cx={18.5} cy={18} r={1.6} {...f} /></>);
      break;
    case 'user':
      body = (<><Circle cx={12} cy={8.5} r={3.8} {...s} /><Path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" {...s} /></>);
      break;
    case 'edit':
      body = <Path d="M4.5 19.5h4l10-10a2.8 2.8 0 0 0-4-4l-10 10zM13 7l4 4" {...s} />;
      break;
    case 'camera':
      body = (<><Path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.5-2.5h5.4L16.2 7h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" {...s} /><Circle cx={12} cy={13} r={3.3} {...s} /></>);
      break;
    case 'refresh':
      body = <Path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" {...s} />;
      break;
    case 'map':
      body = (<><Path d="M9 5 4 7v12.5l5-2 6 2 5-2V5l-5 2z" {...s} /><Path d="M9 5v12.5M15 7v12.5" {...s} /></>);
      break;
    case 'book':
      body = (<><Path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v13H6.5A1.5 1.5 0 0 0 5 18.5z" {...s} /><Path d="M5 18.5A1.5 1.5 0 0 0 6.5 20H19" {...s} /><Rect x={9} y={7.5} width={6.5} height={2.2} rx={1.1} {...f} /></>);
      break;
    case 'calendar':
      body = (<><Rect x={4} y={5.5} width={16} height={14.5} rx={2.5} {...s} /><Path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" {...s} /><Rect x={13} y={13} width={3.5} height={3.5} rx={0.8} {...f} /></>);
      break;
    case 'merge':
      body = <Path d="M7 4v4.5a4 4 0 0 0 4 4h2a4 4 0 0 1 4 4V20M17 4v4.5a4 4 0 0 1-4 4M4.5 17.5 7 20l2.5-2.5" {...s} />;
      break;
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}

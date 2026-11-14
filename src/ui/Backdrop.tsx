// Latar gradasi radial ala prototipe: cahaya hangat dari atas memudar ke gelap.
// Warna diinterpolasi di ruang OKLab (tanpa patahan warna) dan diredam (saturasi 78%) seperti di prototipe.
import { memo, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

export type BgName =
  | 'home'
  | 'tasks'
  | 'chat'
  | 'scan'
  | 'notes'
  | 'detail'
  | 'widgets'
  | 'settings'
  | 'alarm'
  | 'rec'
  | 'ask'
  | 'shalat'
  | 'recordings'
  | 'soon';

const BASE = '#0A0505';
// [warna terang, tengah, gelap, posisi pusat cahaya (0..1 dari kiri)]
const SPEC: Record<Exclude<BgName, 'shalat'>, [string, string, string, number]> = {
  home: ['#F07A1E', '#D9520C', '#8A2806', 0.2],
  tasks: ['#F5A524', '#D86A0A', '#7A3205', 0.8],
  chat: ['#FF6A45', '#D8361C', '#7E1A10', 0.3],
  scan: ['#E08A4F', '#B4521F', '#5C240D', 0.7],
  notes: ['#F4B266', '#D47A2A', '#7A3A12', 0.25],
  detail: ['#F2603A', '#C8301C', '#701410', 0.6],
  recordings: ['#F2603A', '#C8301C', '#701410', 0.6],
  widgets: ['#F7C14B', '#DC8A12', '#7A4206', 0.4],
  settings: ['#E8743A', '#B4441A', '#5A1E0C', 0.85],
  soon: ['#E8743A', '#B4441A', '#5A1E0C', 0.85],
  alarm: ['#FF8A3D', '#E0521A', '#8A240A', 0.5],
  rec: ['#FF6B4A', '#D8381E', '#7A160C', 0.5],
  ask: ['#FF8A2A', '#E0560E', '#8A2806', 0.5],
};
const SHALAT: [string, number][] = [
  ['#F6A24C', 0],
  ['#EE8636', 0.1],
  ['#E2672E', 0.2],
  ['#CB4A34', 0.31],
  ['#A8344A', 0.42],
  ['#7C2552', 0.53],
  ['#521B4E', 0.64],
  ['#2F1440', 0.75],
  ['#190D26', 0.86],
  ['#0D0812', 1],
];

// ---------- warna: sRGB ⇄ OKLab ----------
type Lab = [number, number, number];
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function hexToLab(hex: string): Lab {
  const n = parseInt(hex.slice(1), 16);
  const r = toLin(((n >> 16) & 255) / 255);
  const g = toLin(((n >> 8) & 255) / 255);
  const b = toLin((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function labToHex([L, A, B]: Lab): string {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  return '#' + rgb.map((c) => Math.round(Math.max(0, Math.min(1, toSrgb(Math.max(0, c)))) * 255).toString(16).padStart(2, '0')).join('');
}
const mix = (a: Lab, b: Lab, t: number): Lab => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mute = ([L, A, B]: Lab): Lab => [L * 0.97, A * 0.78, B * 0.78];

function stopsFor(name: BgName): { c: string; o: number }[] {
  const anchors: [Lab, number][] =
    name === 'shalat'
      ? SHALAT.map(([h, o]) => [hexToLab(h), o])
      : (() => {
          const [a, b, c] = SPEC[name];
          const A = hexToLab(a);
          const B = hexToLab(b);
          const C = hexToLab(c);
          const Z = hexToLab(BASE);
          return [
            [A, 0],
            [B, 0.26],
            [C, 0.5],
            [mix(C, Z, 0.4), 0.61],
            [mix(C, Z, 0.7), 0.72],
            [mix(C, Z, 0.88), 0.84],
            [Z, 1],
          ] as [Lab, number][];
        })();
  // 28 titik halus di antara jangkar
  const out: { c: string; o: number }[] = [];
  for (let i = 0; i <= 27; i++) {
    const t = i / 27;
    let k = 0;
    while (k < anchors.length - 2 && t > anchors[k + 1][1]) k++;
    const [la, oa] = anchors[k];
    const [lb, ob] = anchors[k + 1];
    const u = ob === oa ? 0 : Math.min(1, Math.max(0, (t - oa) / (ob - oa)));
    const e = u * u * (3 - 2 * u); // smoothstep: sambungan antar jangkar tanpa garis
    out.push({ c: labToHex(mute(mix(la, lb, e))), o: t });
  }
  return out;
}

export const Backdrop = memo(function Backdrop({ name }: { name: BgName }) {
  const { width, height } = useWindowDimensions();
  const stops = useMemo(() => stopsFor(name), [name]);
  const cx = name === 'shalat' ? 0.5 : SPEC[name as Exclude<BgName, 'shalat'>][3];
  const rx = width * (name === 'shalat' ? 1.5 : 1.4);
  const ry = height * (name === 'shalat' ? 0.9 : 0.8);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: BASE }]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={`bg-${name}`} cx={width * cx} cy={-height * 0.04} rx={rx} ry={ry} fx={width * cx} fy={-height * 0.04} gradientUnits="userSpaceOnUse">
            {stops.map((s, i) => (
              <Stop key={i} offset={s.o} stopColor={s.c} stopOpacity={1} />
            ))}
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#bg-${name})`} />
      </Svg>
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.32)']} locations={[0, 0.45, 0.6, 0.8, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
});

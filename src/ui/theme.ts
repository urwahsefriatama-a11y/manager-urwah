// Token warna & ukuran. Komponen memakai nama peran (bg, surface, ...), bukan kode warna mentah.
import { useColorScheme } from 'react-native';

const light = {
  bg: '#F3F4F7',
  surface: 'rgba(255,255,255,0.72)', // kartu "kaca"
  surfaceBorder: 'rgba(255,255,255,0.9)',
  text: '#14161A',
  textMuted: '#5B6170',
  accent: '#2F6BFF',
  onAccent: '#FFFFFF',
  accentGlow: 'rgba(47,107,255,0.28)',
  danger: '#D93636',
};

const dark: typeof light = {
  bg: '#0B0C0F',
  surface: 'rgba(255,255,255,0.07)',
  surfaceBorder: 'rgba(255,255,255,0.12)',
  text: '#F2F3F5',
  textMuted: '#9AA0AC',
  accent: '#5B8CFF',
  onAccent: '#FFFFFF',
  accentGlow: 'rgba(91,140,255,0.35)',
  danger: '#FF6B6B',
};

export type Colors = typeof light;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { card: 28, pill: 999 };
export const type = { caption: 13, body: 16, title: 22, hero: 40 };

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

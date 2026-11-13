// Token tampilan Manager Urwah.
// Gaya: latar gradasi hangat (jingga → gelap), kartu kaca, angka memakai huruf pixel (Doto).

export const color = {
  text: '#FFFFFF',
  muted: 'rgba(255,240,230,0.68)',
  faint: 'rgba(255,240,230,0.42)',
  accent: '#FFB27E', // jingga lembut
  accentSoft: '#FFD9BF',
  ink: '#1A0A04', // teks gelap di atas tombol putih
  glass: 'rgba(255,255,255,0.08)',
  glassStrong: 'rgba(255,255,255,0.14)',
  glassBorder: 'rgba(255,255,255,0.16)',
  sheet: 'rgba(24,10,6,0.96)',
  danger: '#F2A39A',
  ok: '#B9E3C6',
};

// Huruf disematkan lewat plugin expo-font (lihat app.json), jadi siap sejak app dibuka.
// Di Android nama huruf = nama file tanpa .ttf.
export const font = {
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold',
  pixel: 'Doto_900Black', // khusus angka
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const radius = { sm: 14, md: 20, lg: 26, xl: 32, pill: 999 };

// Gradasi latar per layar: model sama dengan Beranda, nuansa berbeda.
export type BgName = 'home' | 'tasks' | 'shalat' | 'rec' | 'recordings' | 'settings' | 'soon';

const G = (a: string, b: string, c: string, d: string) => ({
  colors: [a, b, c, d, '#0A0505'] as const,
  locations: [0, 0.2, 0.42, 0.66, 1] as const,
});

export const backgrounds: Record<BgName, { colors: readonly [string, string, ...string[]]; locations: readonly [number, number, ...number[]] }> = {
  home: G('#E2793A', '#C4521A', '#74270C', '#1E0A05'),
  tasks: G('#E3A04A', '#C66B1C', '#6A320D', '#1C0D05'),
  shalat: {
    colors: ['#E9A055', '#C95A36', '#8A2C4A', '#331540', '#0D0812'] as const,
    locations: [0, 0.2, 0.42, 0.66, 1] as const,
  },
  rec: G('#E36A50', '#BF3D26', '#6A1A10', '#1C0806'),
  recordings: G('#DE6A48', '#B44324', '#5E1C10', '#190806'),
  settings: G('#D97848', '#A84A22', '#4C1E0E', '#170905'),
  soon: G('#DE7A44', '#B8501E', '#5C230C', '#180905'),
};

// Batas lebar isi: layar lebar (tablet / layar terbuka) tetap rapi di tengah.
export const MAX_CONTENT_WIDTH = 560;

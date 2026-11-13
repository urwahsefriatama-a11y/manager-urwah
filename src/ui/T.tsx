// Teks dasar: huruf Inter, warna putih, dan batas pembesaran huruf
// supaya tata letak tidak pecah saat ukuran huruf HP diperbesar (umum di Samsung).
import { Text, type TextProps, type TextStyle, type StyleProp } from 'react-native';
import { color, font } from './theme';

type Weight = 'regular' | 'semibold' | 'bold' | 'heavy';

type Props = TextProps & {
  size?: number;
  weight?: Weight;
  muted?: boolean;
  /** Angka memakai huruf pixel (Doto). */
  pixel?: boolean;
  style?: StyleProp<TextStyle>;
};

export function T({ size = 15, weight = 'regular', muted, pixel, style, maxFontSizeMultiplier, ...rest }: Props) {
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? 1.3}
      {...rest}
      style={[
        {
          fontFamily: pixel ? font.pixel : font[weight],
          fontSize: size,
          color: muted ? color.muted : color.text,
          includeFontPadding: false,
        },
        style,
      ]}
    />
  );
}

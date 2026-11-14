// Arah kiblat dari kompas HP + tombol cari masjid terdekat (Google Maps).
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Linking, StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { Screen } from '../src/ui/Screen';
import { T } from '../src/ui/T';
import { Glass } from '../src/ui/Glass';
import { FadeIn, GhostBtn, Header, PrimaryBtn } from '../src/ui/bits';
import { color, font, radius } from '../src/ui/theme';
import { currentPlace } from '../src/lib/prayer';
import { heavy } from '../src/lib/haptics';

const KAABA = { lat: 21.4225, lon: 39.8262 };

/** Sudut arah (derajat dari utara) dari posisi ke Ka'bah. */
function qiblaBearing(lat: number, lon: number) {
  const r = Math.PI / 180;
  const dl = (KAABA.lon - lon) * r;
  const y = Math.sin(dl);
  const x = Math.cos(lat * r) * Math.tan(KAABA.lat * r) - Math.sin(lat * r) * Math.cos(dl);
  return (Math.atan2(y, x) / r + 360) % 360;
}

function Dial({ size }: { size: number }) {
  const c = size / 2;
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={c - 2} stroke="rgba(255,255,255,0.22)" strokeWidth={1} fill="rgba(255,255,255,0.04)" />
      {ticks.map((d) => {
        const a = (d - 90) * (Math.PI / 180);
        const long = d % 30 === 0;
        const r1 = c - 8;
        const r2 = c - (long ? 20 : 13);
        return (
          <Line
            key={d}
            x1={c + r1 * Math.cos(a)}
            y1={c + r1 * Math.sin(a)}
            x2={c + r2 * Math.cos(a)}
            y2={c + r2 * Math.sin(a)}
            stroke={long ? '#FFFFFF' : 'rgba(255,255,255,0.4)'}
            strokeWidth={long ? 2 : 1}
            strokeLinecap="round"
          />
        );
      })}
      {[
        ['U', 0],
        ['T', 90],
        ['S', 180],
        ['B', 270],
      ].map(([l, d]) => {
        const a = ((d as number) - 90) * (Math.PI / 180);
        const r = c - 38;
        return (
          <SvgText key={l as string} x={c + r * Math.cos(a)} y={c + r * Math.sin(a) + 6} fill={l === 'U' ? color.accent : '#FFFFFF'} fontSize={17} fontFamily={font.heavy} textAnchor="middle">
            {l as string}
          </SvgText>
        );
      })}
    </Svg>
  );
}

export default function Kiblat() {
  const place = currentPlace();
  const bearing = qiblaBearing(place.lat, place.lon);
  const [status, setStatus] = useState<'wait' | 'ok' | 'denied' | 'none'>('wait');
  const [heading, setHeading] = useState(0);
  const rot = useRef(new Animated.Value(0)).current;
  const last = useRef(0);
  const aligned = useRef(false);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const p = await Location.requestForegroundPermissionsAsync();
      if (!p.granted) {
        setStatus('denied');
        return;
      }
      try {
        sub = await Location.watchHeadingAsync((h) => {
          const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          setHeading(deg);
          setStatus('ok');
          // putar lewat jalur terpendek agar jarum tidak berputar penuh saat melewati 0°
          let target = -deg;
          while (target - last.current > 180) target -= 360;
          while (target - last.current < -180) target += 360;
          last.current = target;
          Animated.timing(rot, { toValue: target, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
        });
      } catch {
        setStatus('none');
      }
    })();
    return () => sub?.remove();
  }, [rot]);

  const diff = ((bearing - heading + 540) % 360) - 180;
  const isAligned = status === 'ok' && Math.abs(diff) < 4;
  useEffect(() => {
    if (isAligned && !aligned.current) heavy();
    aligned.current = isAligned;
  }, [isAligned]);

  const SIZE = 300;
  const spin = rot.interpolate({ inputRange: [-3600, 3600], outputRange: ['-3600deg', '3600deg'] });

  return (
    <Screen bg="shalat">
      <Header title="Arah kiblat" />
      <FadeIn style={{ alignItems: 'center' }}>
        <T size={13} muted>{`${place.name} · kiblat ${Math.round(bearing)}° dari utara`}</T>
        <View style={{ width: SIZE, height: SIZE, marginTop: 22 }}>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: spin }] }]}>
            <Dial size={SIZE} />
            {/* penanda Ka'bah pada piringan, ikut berputar */}
            <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${bearing}deg` }] }]}>
              <View style={styles.kaabaWrap}>
                <View style={[styles.kaaba, isAligned ? { backgroundColor: '#FFFFFF' } : null]} />
              </View>
            </View>
          </Animated.View>
          {/* jarum tetap menunjuk arah depan HP */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Svg width={SIZE} height={SIZE}>
              <Path d={`M${SIZE / 2} 46 L${SIZE / 2 - 12} ${SIZE / 2} L${SIZE / 2} ${SIZE / 2 - 14} L${SIZE / 2 + 12} ${SIZE / 2} Z`} fill={isAligned ? '#FFFFFF' : color.accent} />
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={7} fill="#FFFFFF" />
            </Svg>
          </View>
        </View>
        <Glass strong style={styles.info}>
          {status === 'ok' ? (
            <>
              <T pixel size={40} maxFontSizeMultiplier={1}>{`${Math.abs(Math.round(diff))}°`}</T>
              <T size={14} weight="bold" style={{ marginTop: 2 }}>
                {isAligned ? 'Tepat menghadap kiblat' : diff > 0 ? 'Putar ke kanan' : 'Putar ke kiri'}
              </T>
              <T size={12} muted style={{ marginTop: 6, textAlign: 'center' }}>
                Pegang HP mendatar, jauhkan dari magnet/besi. Bila meleset, gerakkan HP membentuk angka 8.
              </T>
            </>
          ) : (
            <T size={14} muted style={{ textAlign: 'center' }}>
              {status === 'wait' ? 'Membaca kompas…' : status === 'denied' ? 'Izin lokasi diperlukan untuk kompas & arah kiblat.' : 'Kompas tidak tersedia di HP ini.'}
            </T>
          )}
        </Glass>
        <View style={{ alignSelf: 'stretch', marginTop: 14, gap: 10 }}>
          <PrimaryBtn
            label="Cari masjid terdekat"
            onPress={() => Linking.openURL(`https://www.google.com/maps/search/masjid/@${place.lat},${place.lon},15z`)}
          />
          {status === 'denied' ? <GhostBtn label="Buka pengaturan izin" icon="set" onPress={() => Linking.openSettings()} /> : null}
        </View>
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kaabaWrap: { position: 'absolute', top: 2, left: 0, right: 0, alignItems: 'center' },
  kaaba: { width: 22, height: 22, borderRadius: 5, backgroundColor: '#1A0A04', borderWidth: 2, borderColor: '#E9C46A' },
  info: { alignSelf: 'stretch', borderRadius: radius.xl, padding: 18, alignItems: 'center', marginTop: 22 },
});

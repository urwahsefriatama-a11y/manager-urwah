// Penampil Markdown sederhana: judul (#, ##), poin (-, *, 1.), **tebal**, dan paragraf.
import { View } from 'react-native';
import { T } from './T';
import { color } from './theme';

function Inline({ text, size, muted }: { text: string; size: number; muted?: boolean }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <T size={size} muted={muted} style={{ lineHeight: size * 1.5 }}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <T key={i} size={size} weight="bold">
            {p.slice(2, -2)}
          </T>
        ) : (
          p
        ),
      )}
    </T>
  );
}

export function Markdown({ text, size = 15 }: { text: string; size?: number }) {
  const lines = text.replace(/\r/g, '').split('\n');
  return (
    <View style={{ gap: 6 }}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={i} style={{ height: 4 }} />;
        const h = /^(#{1,3})\s+(.*)$/.exec(line);
        if (h)
          return (
            <T key={i} size={h[1].length === 1 ? size + 4 : size + 1} weight="heavy" style={{ marginTop: 6 }}>
              {h[2].replace(/\*\*/g, '')}
            </T>
          );
        const b = /^\s*([-*•]|\d+\.)\s+(.*)$/.exec(line);
        if (b)
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 8, paddingLeft: 2 }}>
              <T size={size} weight="bold" style={{ color: color.accent, minWidth: 14 }}>
                {/\d/.test(b[1]) ? b[1] : '•'}
              </T>
              <View style={{ flex: 1 }}>
                <Inline text={b[2]} size={size} />
              </View>
            </View>
          );
        return <Inline key={i} text={line} size={size} />;
      })}
    </View>
  );
}

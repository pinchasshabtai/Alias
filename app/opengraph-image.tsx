import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Guess the word';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  const tiles = ['#FF5A5F', '#2D7DFF', '#22C55E', '#FFC93C'];
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFF8E7',
          color: '#1E1B4B',
        }}
      >
        <div style={{ display: 'flex', gap: 24 }}>
          {tiles.map((c) => (
            <div key={c} style={{ width: 150, height: 150, borderRadius: 36, background: c, border: '8px solid #1E1B4B' }} />
          ))}
        </div>
        <div style={{ marginTop: 48, fontSize: 96, fontWeight: 800 }}>GUESS THE WORD</div>
        <div style={{ marginTop: 12, fontSize: 40 }}>Explain. Guess. Laugh.</div>
      </div>
    ),
    size,
  );
}

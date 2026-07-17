import { useEffect, useRef } from 'react';

// Live frequency visualizer + peak dB meter, drawn on a HiDPI-aware canvas
// fed by the recorder's AnalyserNode.

export default function Waveform({ analyserRef, peakDb, elapsed }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const analyser = analyserRef.current;
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      if (!analyser) return;
      // resolve the theme's ink color each frame so a theme switch mid-recording is picked up
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#111';

      const bins = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(bins);

      // Voice lives in the low bins — draw the first ~60% as mirrored bars.
      const usable = Math.floor(bins.length * 0.6);
      const barCount = Math.min(56, Math.floor(width / 7));
      const step = usable / barCount;
      const barW = (width / barCount) * 0.62;
      const mid = height / 2;

      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        const from = Math.floor(i * step);
        const to = Math.floor((i + 1) * step);
        for (let j = from; j < to; j++) sum += bins[j];
        const v = sum / Math.max(1, to - from) / 255;
        const h = Math.max(2, v * mid * 0.92);
        const x = (i / barCount) * width + barW * 0.3;
        const alpha = 0.35 + v * 0.65;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.roundRect(x, mid - h, barW, h * 2, barW / 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [analyserRef]);

  // dB meter: -60 dBFS → 0%, 0 dBFS → 100%. Monochrome: the bar fades with
  // level and switches to a hazard stripe when close to clipping.
  const meterPct = Math.max(0, Math.min(100, ((peakDb + 60) / 60) * 100));
  const clipping = peakDb > -3;

  return (
    <div className="w-full fade-in">
      <canvas ref={canvasRef} className="w-full h-16 sm:h-20" aria-hidden="true" />
      <div className="flex items-center gap-3 mt-1 px-1">
        <span className="text-[11px] font-mono text-ink3 w-12">
          {String(Math.floor(elapsed / 60)).padStart(1, '0')}:{String(elapsed % 60).padStart(2, '0')}
        </span>
        <div
          className="flex-1 h-1.5 rounded-full bg-surface2 overflow-hidden"
          role="meter"
          aria-label="Niveau du micro"
          aria-valuemin={-60}
          aria-valuemax={0}
          aria-valuenow={Math.round(Math.max(-60, peakDb))}
        >
          <div
            className="h-full rounded-full transition-[width] duration-75 bg-ink"
            style={{
              width: `${meterPct}%`,
              backgroundImage: clipping
                ? 'repeating-linear-gradient(45deg, transparent 0 4px, var(--surface-2) 4px 8px)'
                : 'none',
            }}
          />
        </div>
        <span className="text-[11px] font-mono text-ink3 w-16 text-right">
          {peakDb <= -60 ? '−∞' : peakDb.toFixed(1)} dB
        </span>
      </div>
    </div>
  );
}

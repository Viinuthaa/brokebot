import { useEffect, useRef } from 'react';
import { BookSnapshot, RecentTrade } from '../types';

interface MarketCanvasChartsProps {
  book: BookSnapshot | null | undefined;
  recentTrades: RecentTrade[];
  fairValue: number | undefined;
}

export function MarketCanvasCharts({
  book,
  recentTrades,
  fairValue,
}: MarketCanvasChartsProps) {
  const priceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const depthCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = priceCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.fillStyle = '#f3eee3';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(17, 17, 17, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i += 1) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const trades = recentTrades.slice(-60);
    if (trades.length < 2) {
      ctx.fillStyle = '#5a564e';
      ctx.font = '600 12px "IBM Plex Mono", monospace';
      ctx.fillText('WAITING FOR TRADE TAPE...', 16, height / 2);
      return;
    }

    const prices = trades.map((t) => t.price);
    if (fairValue !== undefined) prices.push(fairValue);
    const minP = Math.min(...prices) - 4;
    const maxP = Math.max(...prices) + 4;
    const range = Math.max(1, maxP - minP);

    const padX = 14;
    const padY = 18;
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;

    const toX = (idx: number) => padX + (idx / (trades.length - 1)) * plotW;
    const toY = (price: number) => padY + plotH - ((price - minP) / range) * plotH;

    if (fairValue !== undefined) {
      const fy = toY(fairValue);
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = '#5a564e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padX, fy);
      ctx.lineTo(width - padX, fy);
      ctx.stroke();
      ctx.restore();
    }

    ctx.beginPath();
    trades.forEach((t, i) => {
      const x = toX(i);
      const y = toY(t.price);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#d9541e';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const lastIdx = trades.length - 1;
    const lastX = toX(lastIdx);
    const lastY = toY(trades[lastIdx].price);
    ctx.fillStyle = '#111111';
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111111';
    ctx.font = '700 11px "IBM Plex Mono", monospace';
    ctx.fillText(`$${(maxP / 100).toFixed(2)}`, padX, 13);
    ctx.fillText(`$${(minP / 100).toFixed(2)}`, padX, height - 6);
  }, [recentTrades, fairValue]);

  useEffect(() => {
    const canvas = depthCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.fillStyle = '#f3eee3';
    ctx.fillRect(0, 0, width, height);

    const bids = (book?.bids ?? []).slice(0, 15);
    const asks = (book?.asks ?? []).slice(0, 15);

    if (bids.length === 0 && asks.length === 0) {
      ctx.fillStyle = '#5a564e';
      ctx.font = '600 12px "IBM Plex Mono", monospace';
      ctx.fillText('NO RESTING LIQUIDITY', 16, height / 2);
      return;
    }

    let cumBid = 0;
    const bidPoints = bids.map((b) => {
      cumBid += b.totalQty;
      return { price: b.price, cum: cumBid };
    }).reverse();

    let cumAsk = 0;
    const askPoints = asks.map((a) => {
      cumAsk += a.totalQty;
      return { price: a.price, cum: cumAsk };
    });

    const allPrices = [...bidPoints.map((p) => p.price), ...askPoints.map((p) => p.price)];
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceSpan = Math.max(1, maxPrice - minPrice);
    const maxCum = Math.max(1, cumBid, cumAsk);

    const padX = 14;
    const padY = 18;
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;

    const toX = (price: number) => padX + ((price - minPrice) / priceSpan) * plotW;
    const toY = (cum: number) => padY + plotH - (cum / maxCum) * plotH;

    if (bidPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(toX(bidPoints[0].price), padY + plotH);
      bidPoints.forEach((pt) => {
        ctx.lineTo(toX(pt.price), toY(pt.cum));
      });
      const lastBid = bidPoints[bidPoints.length - 1];
      ctx.lineTo(toX(lastBid.price), padY + plotH);
      ctx.closePath();
      ctx.fillStyle = 'rgba(22, 101, 52, 0.22)';
      ctx.fill();

      ctx.beginPath();
      bidPoints.forEach((pt, i) => {
        const x = toX(pt.price);
        const y = toY(pt.cum);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#166534';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (askPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(toX(askPoints[0].price), padY + plotH);
      askPoints.forEach((pt) => {
        ctx.lineTo(toX(pt.price), toY(pt.cum));
      });
      const lastAsk = askPoints[askPoints.length - 1];
      ctx.lineTo(toX(lastAsk.price), padY + plotH);
      ctx.closePath();
      ctx.fillStyle = 'rgba(185, 28, 28, 0.22)';
      ctx.fill();

      ctx.beginPath();
      askPoints.forEach((pt, i) => {
        const x = toX(pt.price);
        const y = toY(pt.cum);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#b91c1c';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [book]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
      <section className="panel">
        <div className="panel-header">
          <span>EXECUTION TAPE // VS FAIR VALUE</span>
          <span style={{ color: 'var(--accent-orange)' }}>LIVE</span>
        </div>
        <div style={{ height: '220px', width: '100%' }}>
          <canvas ref={priceCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <span>CUMULATIVE LIQUIDITY WALL</span>
          <span>L2 CURVE</span>
        </div>
        <div style={{ height: '220px', width: '100%' }}>
          <canvas ref={depthCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
      </section>
    </div>
  );
}
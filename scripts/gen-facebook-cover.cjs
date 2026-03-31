/**
 * Generate Facebook cover photo (820x312px) for CarScratch
 * Dark terminal/dashboard aesthetic
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const W = 820;
const H = 312;

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// ── Background ────────────────────────────────────────────────────────────────
ctx.fillStyle = '#0f172a';
ctx.fillRect(0, 0, W, H);

// ── Dot-grid texture ──────────────────────────────────────────────────────────
ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
const dotSpacing = 24;
for (let x = dotSpacing; x < W; x += dotSpacing) {
  for (let y = dotSpacing; y < H; y += dotSpacing) {
    ctx.beginPath();
    ctx.arc(x, y, 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Subtle diagonal stripe accent (top-right quadrant) ────────────────────────
ctx.save();
ctx.globalAlpha = 0.04;
ctx.strokeStyle = '#f59e0b';
ctx.lineWidth = 1;
const stripeSpacing = 18;
for (let i = -H; i < W + H; i += stripeSpacing) {
  ctx.beginPath();
  ctx.moveTo(W * 0.55 + i, 0);
  ctx.lineTo(W * 0.55 + i - H, H);
  ctx.stroke();
}
ctx.restore();

// ── Amber vertical accent bar (left edge) ─────────────────────────────────────
const barWidth = 4;
const barMargin = 48;
const barTop = 72;
const barBottom = H - 72;
ctx.fillStyle = '#f59e0b';
ctx.fillRect(barMargin, barTop, barWidth, barBottom - barTop);

// ── Registration plate element ────────────────────────────────────────────────
// Positioned right side, slightly faded as decorative element
const plateX = W - 220;
const plateY = H / 2 - 26;
const plateW = 178;
const plateH = 52;
const plateR = 5;

// Plate background
ctx.save();
ctx.globalAlpha = 0.18;
ctx.fillStyle = '#f59e0b';
// Rounded rect
ctx.beginPath();
ctx.moveTo(plateX + plateR, plateY);
ctx.lineTo(plateX + plateW - plateR, plateY);
ctx.quadraticCurveTo(plateX + plateW, plateY, plateX + plateW, plateY + plateR);
ctx.lineTo(plateX + plateW, plateY + plateH - plateR);
ctx.quadraticCurveTo(plateX + plateW, plateY + plateH, plateX + plateW - plateR, plateY + plateH);
ctx.lineTo(plateX + plateR, plateY + plateH);
ctx.quadraticCurveTo(plateX, plateY + plateH, plateX, plateY + plateH - plateR);
ctx.lineTo(plateX, plateY + plateR);
ctx.quadraticCurveTo(plateX, plateY, plateX + plateR, plateY);
ctx.closePath();
ctx.fill();
ctx.restore();

// Plate border
ctx.save();
ctx.globalAlpha = 0.55;
ctx.strokeStyle = '#f59e0b';
ctx.lineWidth = 1.5;
ctx.beginPath();
ctx.moveTo(plateX + plateR, plateY);
ctx.lineTo(plateX + plateW - plateR, plateY);
ctx.quadraticCurveTo(plateX + plateW, plateY, plateX + plateW, plateY + plateR);
ctx.lineTo(plateX + plateW, plateY + plateH - plateR);
ctx.quadraticCurveTo(plateX + plateW, plateY + plateH, plateX + plateW - plateR, plateY + plateH);
ctx.lineTo(plateX + plateR, plateY + plateH);
ctx.quadraticCurveTo(plateX, plateY + plateH, plateX, plateY + plateH - plateR);
ctx.lineTo(plateX, plateY + plateR);
ctx.quadraticCurveTo(plateX, plateY, plateX + plateR, plateY);
ctx.closePath();
ctx.stroke();
ctx.restore();

// Plate text
ctx.save();
ctx.globalAlpha = 0.6;
ctx.fillStyle = '#f59e0b';
ctx.font = 'bold 28px "Courier New", monospace';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('MN26 ABC', plateX + plateW / 2, plateY + plateH / 2);
ctx.restore();

// ── Main wordmark: CarScratch ─────────────────────────────────────────────────
const textLeft = barMargin + barWidth + 24;

// "CAR" in white, "SCRATCH" in amber — same line, large
ctx.font = 'bold 72px Arial, sans-serif';
ctx.textAlign = 'left';
ctx.textBaseline = 'alphabetic';

// Measure "CAR" to position "SCRATCH" next to it
ctx.fillStyle = '#ffffff';
const carText = 'CAR';
const carMetrics = ctx.measureText(carText);
ctx.fillText(carText, textLeft, 148);

ctx.fillStyle = '#f59e0b';
ctx.fillText('SCRATCH', textLeft + carMetrics.width, 148);

// ── Tagline ───────────────────────────────────────────────────────────────────
ctx.fillStyle = '#e2e8f0';
ctx.font = '600 18px Arial, sans-serif';
ctx.textAlign = 'left';
ctx.fillText('UK & Isle of Man Vehicle Lookup', textLeft, 178);

// ── Secondary line ────────────────────────────────────────────────────────────
ctx.fillStyle = '#64748b';
ctx.font = '13px "Courier New", monospace';
ctx.textAlign = 'left';
ctx.fillText('MOT History  ·  Tax Status  ·  Auction Records  ·  Specs', textLeft, 210);

// ── Horizontal rule below wordmark ───────────────────────────────────────────
ctx.strokeStyle = 'rgba(248, 158, 11, 0.25)';
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(textLeft, 162);
ctx.lineTo(W * 0.54, 162);
ctx.stroke();

// ── URL bottom right ──────────────────────────────────────────────────────────
ctx.fillStyle = '#475569';
ctx.font = '13px "Courier New", monospace';
ctx.textAlign = 'right';
ctx.textBaseline = 'alphabetic';
ctx.fillText('carscratch.uk', W - 28, H - 20);

// ── Write file ────────────────────────────────────────────────────────────────
const outPath = path.join(__dirname, '..', 'public', 'facebook-cover.png');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outPath, buffer);
console.log(`Written ${buffer.length} bytes to ${outPath}`);

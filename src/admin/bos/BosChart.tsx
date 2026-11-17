import React from 'react';

export type BosChartType =
  | 'line'
  | 'area'
  | 'bar'
  | 'hbar'
  | 'donut'
  | 'heat'
  | 'scatter';

export type BosChartStatus = 'recorded' | 'estimated' | 'forecast';
export type BosChartFormat = 'money' | 'number' | 'percent';

export interface BosChartSpec {
  title: string;
  type: BosChartType;
  labels: string[];
  data: number[];
  /** Heatmap matrix, rows = cohorts, cols = periods. */
  matrix?: number[][];
  rowLabels?: string[];
  /** Scatter points (x/y in 0..1). */
  points?: Array<{ x: number; y: number }>;
  format?: BosChartFormat;
  status?: BosChartStatus;
  emptyHint?: string;
}

const W = 320;
const H = 160;
const P = { l: 32, r: 8, t: 12, b: 22 };
const PW = W - P.l - P.r;
const PH = H - P.t - P.b;
const GS = ['#000', '#4d4d4d', '#8f8f8f', '#c4c4c4', '#e6e6e6'];

export const compact = (v: number): string => {
  const n = Number.isFinite(v) ? v : 0;
  if (Math.abs(n) >= 1e4) return `${Math.round(n / 1e3)}k`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  if (Math.abs(n) >= 10) return `${Math.round(n)}`;
  return n.toFixed(1);
};

const money = (v: number) =>
  `€${Math.round(Number.isFinite(v) ? v : 0).toLocaleString('en-FI')}`;

const valueLabel = (v: number, format?: BosChartFormat): string => {
  if (format === 'money') return money(v);
  if (format === 'percent') return `${(Number.isFinite(v) ? v : 0).toFixed(1)}%`;
  return compact(v);
};

const axis = (max: number, format?: BosChartFormat) =>
  [0, 1, 2, 3]
    .map((i) => {
      const y = P.t + (PH * i) / 3;
      return `<line class="bos-g" x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}"/><text x="${P.l - 5}" y="${y + 3}" text-anchor="end">${compact(
        max * (1 - i / 3)
      )}</text>`;
    })
    .join('');

const empty = (hint?: string) => (
  <div className="bos-empty">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M3 3v18h18" strokeLinecap="round" />
      <path d="M7 14l3-3 3 2 4-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span>{hint || 'No recorded data yet.'}</span>
  </div>
);

const renderBody = (spec: BosChartSpec): string | null => {
  const { type, labels, data, matrix, points, format } = spec;

  if (type === 'line' || type === 'area') {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data) * 1.15 || 1;
    const X = (i: number) => P.l + (i * PW) / (data.length - 1);
    const Y = (v: number) => P.t + PH * (1 - v / max);
    const pt = data.map((v, i) => [X(i), Y(v)] as const);
    let path = `M${pt[0][0]},${pt[0][1]}`;
    for (let i = 1; i < pt.length; i += 1) {
      const mx = (pt[i - 1][0] + pt[i][0]) / 2;
      path += `C${mx},${pt[i - 1][1]} ${mx},${pt[i][1]} ${pt[i][0]},${pt[i][1]}`;
    }
    const im = data.indexOf(Math.max(...data));
    const [px, py] = pt[im];
    const bx = Math.min(Math.max(px - 23, P.l), W - 52);
    const by = Math.max(py - 30, 0);
    const highlight = valueLabel(data[im], format);
    const area = type === 'area' ? `<path d="${path}L${P.l + PW},${P.t + PH}L${P.l},${P.t + PH}Z" fill="url(#bos-gr)"/>` : '';

    return (
      axis(max, format) +
      area +
      `<path d="${path}" fill="none" stroke="#000" stroke-width="2"/>` +
      `<line x1="${px}" x2="${px}" y1="${py}" y2="${P.t + PH}" stroke="#000" stroke-dasharray="2 3" opacity=".4"/>` +
      `<circle cx="${px}" cy="${py}" r="4" fill="#fff" stroke="#000" stroke-width="2"/>` +
      `<rect x="${bx}" y="${by}" width="${Math.max(46, highlight.length * 6 + 12)}" height="20" rx="6"/>` +
      `<text class="bos-wt" x="${bx + Math.max(46, highlight.length * 6 + 12) / 2}" y="${by + 13}" text-anchor="middle">${highlight}</text>` +
      pt
        .map(
          (q, i) =>
            `<circle cx="${q[0]}" cy="${q[1]}" r="6" fill="transparent"><title>${labels[i] || ''}: ${valueLabel(
              data[i],
              format
            )}</title></circle>`
        )
        .join('') +
      labels
        .map(
          (x, j) =>
            `<text x="${P.l + (j * PW) / Math.max(1, labels.length - 1)}" y="${H - 6}" text-anchor="middle">${x}</text>`
        )
        .join('')
    );
  }

  if (type === 'bar') {
    if (!data || data.length === 0) return null;
    const max = Math.max(...data) * 1.15 || 1;
    const n = data.length;
    const s = PW / n;
    const hi = data.indexOf(Math.max(...data));
    return (
      axis(max, format) +
      data
        .map(
          (v, i) =>
            `<rect x="${P.l + i * s + s * 0.2}" y="${P.t + PH * (1 - v / max)}" width="${s * 0.6}" height="${
              (PH * v) / max
            }" rx="5" fill="${i === hi ? '#000' : '#d9d9d9'}"><title>${labels[i] || ''}: ${valueLabel(
              v,
              format
            )}</title></rect><text x="${P.l + i * s + s / 2}" y="${H - 6}" text-anchor="middle">${
              labels[i] || ''
            }</text>`
        )
        .join('')
    );
  }

  if (type === 'hbar') {
    if (!data || data.length === 0) return null;
    const pairs = data
      .map((v, i) => ({ v, label: labels[i] || '' }))
      .sort((a, b) => b.v - a.v);
    const max = Math.max(...pairs.map((p) => p.v)) || 1;
    const n = pairs.length;
    const rh = (H - 8) / n;
    return pairs
      .map((p, i) => {
        const y = 4 + i * rh;
        const bw = (p.v / max) * (W - 150);
        return `<text x="0" y="${y + rh / 2 + 3}">${p.label.length > 13 ? p.label.slice(0, 12) + '…' : p.label}</text><rect x="95" y="${
          y + rh * 0.2
        }" width="${bw}" height="${rh * 0.6}" rx="4" fill="${i ? '#d4d4d4' : '#000'}"><title>${
          p.label
        }: ${valueLabel(p.v, format)}</title></rect><text x="${99 + bw}" y="${y + rh / 2 + 3}">${compact(
          p.v
        )}</text>`;
      })
      .join('');
  }

  if (type === 'donut') {
    const vals = data && data.length ? data : [];
    const total = vals.reduce((a, b) => a + b, 0);
    if (!total) return null;
    const c = 2 * Math.PI * 42;
    let acc = 0;
    const arcs = vals
      .map((v, i) => {
        const f = v / total;
        const seg = `<circle cx="75" cy="80" r="42" fill="none" stroke="${GS[i % 5]}" stroke-width="24" stroke-dasharray="${
          f * c - 1.5
        } ${c}" stroke-dashoffset="${-acc * c}"><title>${labels[i] || ''}: ${Math.round(
          f * 100
        )}%</title></circle>`;
        acc += f;
        return seg;
      })
      .join('');
    const legend = vals
      .map(
        (v, i) =>
          `<rect x="165" y="${28 + i * 20}" width="10" height="10" rx="3" fill="${GS[i % 5]}" stroke="#000" stroke-opacity=".2"/><text x="181" y="${
            37 + i * 20
          }">${labels[i] || ''} ${Math.round((v / total) * 100)}%</text>`
      )
      .join('');
    return `<g transform="rotate(-90 75 80)">${arcs}</g>${legend}`;
  }

  if (type === 'heat') {
    if (!matrix || matrix.length === 0 || matrix[0].length === 0) return null;
    const n = matrix[0].length;
    const cw = PW / n;
    const rh = PH / matrix.length;
    let out = '';
    matrix.forEach((row, i) => {
      out += `<text x="${P.l - 5}" y="${P.t + i * rh + rh / 2 + 3}" text-anchor="end">${
        spec.rowLabels?.[i] || `C${i + 1}`
      }</text>`;
      for (let j = 0; j < n; j += 1) {
        const v = Math.max(0, Math.min(1, row[j] || 0));
        out += `<rect x="${P.l + j * cw + 1}" y="${P.t + i * rh + 1}" width="${cw - 2}" height="${
          rh - 2
        }" rx="4" fill="#000" fill-opacity="${v}"><title>${labels[j] || ''}: ${Math.round(
          v * 100
        )}%</title></rect>`;
        if (v > 0)
          out += `<text class="${v > 0.45 ? 'bos-wt' : ''}" x="${P.l + j * cw + cw / 2}" y="${
            P.t + i * rh + rh / 2 + 3
          }" text-anchor="middle">${Math.round(v * 100)}%</text>`;
      }
    });
    out += labels
      .map(
        (x, j) =>
          `<text x="${P.l + j * cw + cw / 2}" y="${H - 6}" text-anchor="middle">${x}</text>`
      )
      .join('');
    return out;
  }

  if (type === 'scatter') {
    if (!points || points.length === 0) return null;
    return (
      axis(1, format) +
      `<line x1="${P.l}" y1="${P.t + PH}" x2="${W - P.r}" y2="${P.t}" stroke="#000" stroke-dasharray="4 4" opacity=".35"/>` +
      points
        .map(
          (p) =>
            `<circle cx="${P.l + Math.max(0, Math.min(1, p.x)) * PW}" cy="${
              P.t + PH * (1 - Math.max(0, Math.min(1, p.y)))
            }" r="3.5" fill="#000" fill-opacity=".7"><title>${Math.round(p.x * 100)} → ${Math.round(
              p.y * 100
            )}</title></circle>`
        )
        .join('') +
      `<text x="${W / 2}" y="${H - 6}" text-anchor="middle">${labels[0] || ''}</text>`
    );
  }

  return null;
};

export const BosChart: React.FC<{ spec: BosChartSpec }> = ({ spec }) => {
  const body = renderBody(spec);
  const status = spec.status || 'recorded';
  return (
    <section className="bos-card bos-chartcard">
      <h3>
        {spec.title}
        <span className={`bos-b bos-${status}`}>{status}</span>
      </h3>
      {body ? (
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={spec.title} dangerouslySetInnerHTML={{ __html: body }} />
      ) : (
        empty(spec.emptyHint)
      )}
    </section>
  );
};

export default BosChart;

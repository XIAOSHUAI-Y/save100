/** 方格页：三张统计卡 + 进度条 + 目标网格 */

import { COLS_MAX, COLS_MIN, clampCols, cellIndexAt, derive, money, shortMoney, yuan } from '../model';
import { store } from '../store';
import { openCellSheet } from '../sheet';
import { openMilestoneList } from './milestone';
import { h } from '../ui';



export function renderGrid(): HTMLElement {
  const s = store.state;
  const d = derive(s);
  const { target, cellValue } = s.settings;
  const cols = clampCols(s.settings.cols);
  const rows = Math.ceil(d.cells / cols);

  const stats = h(
    'section',
    { class: 'stats' },
    h(
      'div',
      { class: 'stat' },
      h('b', {}, money(d.total)),
      h('span', {}, '已攒金额'),
    ),
    h(
      'div',
      { class: 'stat hero' },
      h('b', {}, String(d.restCells), h('small', {}, '格')),
      h('span', {}, `距${shortMoney(target)}目标只剩`),
    ),
    h(
      'button',
      { class: 'stat link', type: 'button', onclick: () => openMilestoneList() },
      h('b', {}, String(d.litCells), h('small', {}, '格')),
      h('span', {}, '已点亮方格 ›'),
    ),
  );

  // 刻度：第 1 格价值 + 25/50/75/100%
  const marks = [cellValue, target * 0.25, target * 0.5, target * 0.75, target];
  const marks_fmt = marks.map(shortMoney);
  const progress = h(
    'section',
    { class: 'progress' },
    h('div', { class: 'bar' }, h('i', { style: { width: `${(d.progress * 100).toFixed(2)}%` } })),
    h('div', { class: 'ticks' }, ...marks_fmt.map((v) => h('span', {}, v))),
  );

  const cells: HTMLElement[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = cellIndexAt(col, row, cols);
      if (idx >= d.cells) {
        // 格数不是 20 的整数倍时补空位
        cells.push(h('div', { class: 'cell', style: { opacity: '0' } }));
        continue;
      }
      const on = d.lit.has(idx);
      cells.push(
        h('button', {
          class: on ? 'cell on' : 'cell',
          type: 'button',
          'data-idx': String(idx),
          'aria-label': `第 ${idx + 1} 格${on ? '，已点亮' : ''}`,
          onclick: () => openCellSheet(idx),
        }),
      );
    }
  }

  const gridCard = h(
    'section',
    { class: 'card' },
    h(
      'div',
      { class: 'grid-head' },
      h('span', {}, `共 ${d.cells} 格 · 每格 ${yuan(cellValue)} 元`),
      h(
        'div',
        { class: 'legend' },
        h('i', { class: 'off' }),
        '未点亮',
        h('i', { class: 'on' }),
        '已点亮',
      ),
    ),
    sizeRow(cols),
    h('div', { class: 'grid', style: { '--cols': String(cols) } }, ...cells),
  );

  const motto = h('p', { class: 'motto' }, d.done ? '目标达成，了不起 🎉' : '千里之行，始于足下 💪');

  // 设置入口：目标金额和每格面值在 VIP 页里，藏太深了，这里给一条直达
  const cfg = h(
    'button',
    {
      class: 'cfg-link',
      type: 'button',
      onclick: () => {
        location.hash = '#/vip';
      },
    },
    `目标 ${shortMoney(target)} · 每格 ${yuan(cellValue)} 元 · 修改`,
  );

  return h('div', {}, stats, progress, gridCard, motto, cfg);
}

/**
 * 每行格数（= 格子大小）。滑块拖动时只改 CSS 变量，松手才写存储，
 * 不然每拖一格就整页重渲染 200 个按钮，手机上会卡。
 */
function sizeRow(cols: number): HTMLElement {
  const gridEl = () => document.querySelector('.grid') as HTMLElement | null;
  const label = h('b', {}, String(cols));
  const range = h('input', {
    type: 'range',
    min: String(COLS_MIN),
    max: String(COLS_MAX),
    step: '1',
    value: String(cols),
    'aria-label': '每行格数',
  }) as HTMLInputElement;

  range.addEventListener('input', () => {
    label.textContent = range.value;
    gridEl()?.style.setProperty('--cols', range.value);
  });
  range.addEventListener('change', () => {
    store.patchSettings({ cols: Number(range.value) });
  });

  return h('div', { class: 'grid-size' }, h('span', {}, '每行 ', label, ' 格'), range);
}

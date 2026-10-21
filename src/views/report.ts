/** 报告页：月度柱状图 + 速度 + 预测 */

import { byDay, byMonth, derive, forecast, money, shortMoney, streakDays, yuan } from '../model';
import { store } from '../store';
import { h } from '../ui';

export function renderReport(): HTMLElement {
  const s = store.state;
  const d = derive(s);
  const months = byMonth(s.deposits).slice(-6);
  const last30 = byDay(s.deposits, 30).reduce((a, b) => a + b, 0);
  const streak = streakDays(s.deposits);
  const f = forecast(s, d);

  const maxMonth = Math.max(1, ...months.map((m) => m.total));

  const chart =
    months.length === 0
      ? h('div', { class: 'empty-hint' }, '还没有数据')
      : h(
          'div',
          { class: 'chart' },
          ...months.map((m) =>
            h(
              'div',
              { class: 'col' },
              h('b', {}, m.total >= 10_000 ? `${(m.total / 10_000).toFixed(1)}万` : String(m.total)),
              h('i', { style: { height: `${Math.max(3, (m.total / maxMonth) * 78)}%` } }),
              h('em', {}, m.label),
            ),
          ),
        );

  return h(
    'div',
    {},
    h(
      'div',
      { class: 'tiles' },
      h('div', { class: 'tile' }, h('span', {}, '近 30 天存入'), h('b', {}, money(last30))),
      h('div', { class: 'tile' }, h('span', {}, '连续打卡'), h('b', {}, `${streak} 天`)),
      h('div', { class: 'tile' }, h('span', {}, '日均速度'), h('b', {}, `${yuan(f.perDay)} 元`)),
      h(
        'div',
        { class: 'tile' },
        h('span', {}, '预计达成'),
        h('b', {}, f.eta ? f.eta.replace(/-/g, '/') : '—'),
      ),
    ),
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'grid-head' }, h('span', {}, '最近 6 个月')),
      chart,
    ),
    h(
      'p',
      { class: 'hint' },
      f.daysLeft === null
        ? '近 30 天没有存入，无法估算达成时间。'
        : d.done
          ? '目标已达成。'
          : `按近 30 天的速度，还要 ${f.daysLeft} 天，预计 ${f.eta} 达成；还差 ${shortMoney(d.restAmount)}。`,
    ),
  );
}

/** 存折页：按月分组的存入流水 */

import { type Deposit, derive, money, parseDate, yuan } from '../model';
import { store } from '../store';
import { openEditSheet } from '../sheet';
import { h } from '../ui';

export function renderPassbook(): HTMLElement {
  const s = store.state;
  const d = derive(s);

  if (s.deposits.length === 0) {
    return h(
      'div',
      { class: 'card' },
      h('div', { class: 'empty-hint' }, '还没有存入记录', h('br'), '点底部「打卡」存第一笔'),
    );
  }

  // 已按日期倒序存着，分组时保持顺序
  const groups = new Map<string, Deposit[]>();
  for (const dep of s.deposits) {
    const key = dep.date.slice(0, 7);
    const list = groups.get(key);
    if (list) list.push(dep);
    else groups.set(key, [dep]);
  }

  const nodes: HTMLElement[] = [];
  for (const [key, list] of groups) {
    const sum = list.reduce((a, b) => a + b.amount, 0);
    nodes.push(
      h(
        'section',
        { class: 'month' },
        h(
          'div',
          { class: 'month-head' },
          h('b', {}, `${key.slice(0, 4)}年${Number(key.slice(5, 7))}月`),
          h('span', {}, `${list.length} 笔 · ${money(sum)}`),
        ),
        h(
          'div',
          { class: 'rows' },
          ...list.map((dep) =>
            h(
              'button',
              { class: 'row', type: 'button', onclick: () => openEditSheet(dep.id) },
              h('span', { class: 'date' }, `${parseDate(dep.date).getMonth() + 1}/${parseDate(dep.date).getDate()}`),
              h('span', { class: dep.note ? 'row-note' : 'row-note empty' }, dep.note || '存入'),
              h('span', { class: 'amt' }, `+${yuan(dep.amount)}`),
            ),
          ),
        ),
      ),
    );
  }

  return h(
    'div',
    {},
    h(
      'div',
      { class: 'tiles' },
      h('div', { class: 'tile' }, h('span', {}, '累计存入'), h('b', {}, money(d.total))),
      h('div', { class: 'tile' }, h('span', {}, '笔数 / 笔均'), h('b', {}, `${d.count} / ${yuan(d.count ? d.total / d.count : 0)}`)),
    ),
    ...nodes,
  );
}

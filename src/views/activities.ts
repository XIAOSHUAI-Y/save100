/** 活动页：几种常见的存钱挑战，点一下就带好金额去打卡 */

import { daysBetween, derive, todayStr, yuan } from '../model';
import { store } from '../store';
import { openDepositSheet } from '../sheet';
import { h } from '../ui';

function card(opts: {
  title: string;
  sub: string;
  desc: string;
  progress: number;
  amount: number;
  actionLabel: string;
}): HTMLElement {
  return h(
    'section',
    { class: 'card act' },
    h('h3', {}, opts.title, h('span', {}, opts.sub)),
    h('p', {}, opts.desc),
    h('div', { class: 'bar' }, h('i', { style: { width: `${Math.min(100, opts.progress * 100).toFixed(1)}%` } })),
    h(
      'div',
      { class: 'acts' },
      h(
        'button',
        {
          class: 'btn',
          type: 'button',
          onclick: () => openDepositSheet({ amount: opts.amount, note: opts.title }),
        },
        `${opts.actionLabel} +${yuan(opts.amount)}`,
      ),
    ),
  );
}

export function renderActivities(): HTMLElement {
  const s = store.state;
  const d = derive(s);

  // 52 周：第 N 周存 N×10，一年下来 13780
  const weeks = Math.min(52, Math.max(1, Math.floor(daysBetween(s.settings.startDate, todayStr()) / 7) + 1));
  const weekAmount = weeks * 10;

  // 365 天：第 N 天存 N 元；按已存笔数推进
  const dayIdx = Math.min(365, d.count + 1);

  // 阶梯：下一格
  const nextCell = s.settings.cellValue;

  return h(
    'div',
    {},
    card({
      title: '52 周存钱法',
      sub: `第 ${weeks} / 52 周`,
      desc: '每周比上一周多存 10 元。第 1 周 10 元，第 52 周 520 元，一年攒下 13,780 元。',
      progress: weeks / 52,
      amount: weekAmount,
      actionLabel: '本周存',
    }),
    card({
      title: '365 天存钱法',
      sub: `第 ${dayIdx} / 365 天`,
      desc: '第 N 天存 N 元。越往后越多，一年 66,795 元；觉得吃力就从 1 元起、按自己节奏推进。',
      progress: dayIdx / 365,
      amount: dayIdx,
      actionLabel: '今天存',
    }),
    card({
      title: '阶梯冲刺',
      sub: `还差 ${d.restCells} 格`,
      desc: `每点亮一格 ${yuan(nextCell)} 元，点方格页上任意空格就能点亮它。`,
      progress: d.cells > 0 ? d.litCells / d.cells : 0,
      amount: nextCell,
      actionLabel: '点亮一格',
    }),
  );
}

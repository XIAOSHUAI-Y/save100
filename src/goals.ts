/**
 * 目标切换 / 新建 / 删除的底部弹层。
 *
 * 数据层里 `state.settings` 永远是「当前目标」，这里只负责在目标之间搬。
 * 复用 sheet.ts 的 mountSheet，不改弹层本身的实现。
 */

import { money, shortMoney, yuan } from './model';
import { store } from './store';
import { h, toast } from './ui';
import { closeSheet, mountSheet } from './sheet';

export function openGoalSheet(): void {
  const sums = store.goalSummaries();
  const canDelete = sums.length > 1;

  const rows = sums.map((g) =>
    h(
      'div',
      { class: g.active ? 'goal-row on' : 'goal-row' },
      h(
        'button',
        {
          class: 'goal-main',
          type: 'button',
          onclick: () => {
            if (!g.active) {
              store.switchGoal(g.id);
              toast(`切到「${g.name}」`);
            }
            closeSheet();
          },
        },
        h(
          'span',
          { class: 'goal-name' },
          g.name,
          g.active ? h('i', { class: 'goal-tag' }, '当前') : null,
        ),
        h(
          'span',
          { class: 'goal-sub' },
          `${money(g.total)} / ${shortMoney(g.target)} · ${g.litCells}/${g.cells} 格`,
        ),
      ),
      canDelete
        ? h(
            'button',
            {
              class: 'goal-del',
              type: 'button',
              'aria-label': `删除目标 ${g.name}`,
              onclick: () => {
                const n = store.state.deposits.filter((d) => d.goalId === g.id).length;
                const ok = window.confirm(
                  `删除目标「${g.name}」？\n它的 ${n} 笔存入会一起删掉，不能撤销。`,
                );
                if (!ok) return;
                store.removeGoal(g.id);
                closeSheet();
                toast(`已删除「${g.name}」`);
              },
            },
            '✕',
          )
        : null,
    ),
  );

  const body = h(
    'div',
    {},
    h('h2', {}, '我的目标'),
    h('p', { class: 'goal-hint' }, '每个目标的格子、金额和里程碑都是独立的，数据互不影响。'),
    h('div', { class: 'goal-list' }, ...rows),
    h(
      'div',
      { class: 'sheet-acts' },
      h(
        'button',
        {
          class: 'btn ghost',
          type: 'button',
          onclick: () => {
            closeSheet();
            location.hash = '#/vip';
          },
        },
        '编辑当前目标',
      ),
      h('button', { class: 'btn', type: 'button', onclick: () => openNewGoalForm() }, '＋ 新建目标'),
    ),
  );

  mountSheet(body);
}

function openNewGoalForm(): void {
  const current = store.state.settings;

  const name = h('input', {
    class: 'goal-input',
    type: 'text',
    value: '新目标',
    placeholder: '目标名，例如 旅行基金',
  }) as HTMLInputElement;
  const target = h('input', {
    class: 'goal-input',
    type: 'number',
    inputmode: 'decimal',
    value: String(50_000),
    placeholder: '目标金额',
  }) as HTMLInputElement;
  const cell = h('input', {
    class: 'goal-input',
    type: 'number',
    inputmode: 'decimal',
    value: String(current.cellValue),
    placeholder: '每格金额',
  }) as HTMLInputElement;

  const field = (label: string, input: HTMLInputElement): HTMLElement =>
    h('label', { class: 'goal-field' }, h('span', {}, label), input);

  const body = h(
    'div',
    {},
    h('h2', {}, '新建目标'),
    field('名称', name),
    field('目标金额（元）', target),
    field('每格金额（元）', cell),
    h(
      'div',
      { class: 'sheet-acts' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => openGoalSheet() }, '返回'),
      h(
        'button',
        {
          class: 'btn',
          type: 'button',
          onclick: () => {
            const t = Number(target.value);
            const v = Number(cell.value);
            if (!(t > 0) || !(v > 0)) {
              toast('目标金额和每格金额都要大于 0');
              return;
            }
            if (v > t) {
              toast('每格金额不能比目标金额还大');
              return;
            }
            const id = store.addGoal({ name: name.value, target: t, cellValue: v });
            closeSheet();
            const created = store.state.goals.find((g) => g.id === id);
            toast(`已新建「${created?.name ?? '新目标'}」· 总共 ${yuan(t)} 元`);
          },
        },
        '创建并切换',
      ),
    ),
  );

  mountSheet(body);
}

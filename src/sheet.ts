/** 底部弹层：打卡存钱 / 修改一笔 */

import { cellCost, derive, todayStr, yuan } from './model';
import { store } from './store';
import { h, toast } from './ui';

let mask: HTMLElement | null = null;
let sheet: HTMLElement | null = null;
let onClose: (() => void) | null = null;

function mount(content: HTMLElement): void {
  closeSheet();
  mask = h('div', { class: 'sheet-mask' });
  sheet = h('div', { class: 'sheet' }, content);
  mask.addEventListener('click', () => closeSheet());
  document.body.append(mask, sheet);
  // 下一帧再加 show，让 transition 有起点
  requestAnimationFrame(() => {
    mask?.classList.add('show');
    sheet?.classList.add('show');
  });
  onClose = () => {
    mask?.remove();
    sheet?.remove();
    mask = null;
    sheet = null;
    onClose = null;
  };
}

/** 让别的视图也能复用这个底部弹层（里程碑列表在用） */
export const mountSheet = mount;

export function closeSheet(): void {
  document.querySelectorAll('.cell.picked').forEach((el) => el.classList.remove('picked'));
  onClose?.();
}

/** 金额输入框宽度跟着内容走，这样「¥ 1000」才是挨在一起居中的 */
function fitAmount(el: HTMLInputElement): void {
  const n = Math.max(1, el.value.length || 1);
  el.style.width = `${n + 0.4}ch`;
}

function numInput(attrs: Record<string, unknown> = {}): HTMLInputElement {
  const el = h('input', {
    inputmode: 'decimal',
    autocomplete: 'off',
    ...attrs,
  }) as HTMLInputElement;
  // 只允许数字和一个小数点，顺便把全角数字挡掉
  el.addEventListener('input', () => {
    const v = el.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    if (v !== el.value) el.value = v;
    fitAmount(el);
  });
  return el;
}

/** 打卡存钱 */
export function openDepositSheet(preset: { amount?: number; note?: string } = {}): void {
  const s = store.state;
  const cell = s.settings.cellValue;

  const amount = numInput({ placeholder: '0' });
  amount.value = preset.amount ? String(preset.amount) : '';
  fitAmount(amount);

  const date = h('input', { type: 'date', value: todayStr() }) as HTMLInputElement;
  date.max = todayStr();
  const note = h('input', { placeholder: '可选，例如「工资」' }) as HTMLInputElement;
  if (preset.note) note.value = preset.note;

  const quick = h(
    'div',
    { class: 'quick' },
    ...[cell, cell * 2, cell * 5].map((v) =>
      h(
        'button',
        {
          type: 'button',
          onclick: () => {
            const cur = Number(amount.value) || 0;
            amount.value = String(Math.round((cur + v) * 100) / 100);
            fitAmount(amount);
            amount.focus();
          },
        },
        `+${yuan(v)}`,
      ),
    ),
  );

  const submit = (): void => {
    const v = Number(amount.value);
    if (!(v > 0)) {
      toast('填一个金额');
      amount.focus();
      return;
    }
    // 一笔金额会折算成若干格，格子不够就别记进去，否则金额和格数对不上
    const cost = cellCost(store.state.settings);
    const before = derive(store.state);
    const need = Math.floor(v / cost);
    if (need > before.restCells) {
      toast(`只剩 ${before.restCells} 格，最多还能存 ${yuan(before.restCells * cost)} 元`);
      return;
    }
    const d = store.addDeposit({ amount: v, date: date.value || todayStr(), note: note.value });
    const lit = d?.cells.length ?? 0;
    toast(lit > 0 ? `已存 ${yuan(v)} 元 · 点亮 ${lit} 格` : `已存 ${yuan(v)} 元`);
    closeSheet();
  };

  amount.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });

  mount(
    h(
      'div',
      {},
      h('h2', {}, '打卡存钱'),
      h('div', { class: 'amount-box' }, h('span', { class: 'cur' }, '¥'), amount),
      quick,
      h(
        'div',
        { class: 'fields' },
        h('div', { class: 'field' }, h('label', {}, '日期'), date),
        h('div', { class: 'field' }, h('label', {}, '备注'), note),
      ),
      h(
        'div',
        { class: 'sheet-acts' },
        h('button', { class: 'btn ghost', type: 'button', onclick: closeSheet }, '取消'),
        h('button', { class: 'btn', type: 'button', onclick: submit }, '存下'),
      ),
    ),
  );
  // 手机键盘不自动弹，避免一进来就挡住整个弹层
  if (preset.amount) amount.focus();
}

/** 修改 / 删除一笔 */
export function openEditSheet(id: string): void {
  const d = store.state.deposits.find((x) => x.id === id);
  if (!d) return;

  const amount = numInput({ placeholder: '0' });
  amount.value = String(d.amount);
  fitAmount(amount);
  const date = h('input', { type: 'date', value: d.date }) as HTMLInputElement;
  date.max = todayStr();
  const note = h('input', { placeholder: '备注' }) as HTMLInputElement;
  note.value = d.note;

  const save = (): void => {
    const v = Number(amount.value);
    if (!(v > 0)) {
      toast('填一个金额');
      return;
    }
    store.updateDeposit(id, { amount: v, date: date.value || d.date, note: note.value });
    toast('已保存');
    closeSheet();
  };

  const del = (): void => {
    if (!window.confirm('删除这笔存入？')) return;
    store.removeDeposit(id);
    toast('已删除');
    closeSheet();
  };

  mount(
    h(
      'div',
      {},
      h('h2', {}, '修改这笔'),
      h('div', { class: 'amount-box' }, h('span', { class: 'cur' }, '¥'), amount),
      h(
        'div',
        { class: 'fields' },
        h('div', { class: 'field' }, h('label', {}, '日期'), date),
        h('div', { class: 'field' }, h('label', {}, '备注'), note),
      ),
      h(
        'div',
        { class: 'sheet-acts' },
        h('button', { class: 'btn ghost', type: 'button', onclick: del }, '删除'),
        h('button', { class: 'btn', type: 'button', onclick: save }, '保存'),
      ),
    ),
  );
}

/**
 * 点格子：看这一格的状态，并给出「存到这一格」的金额。
 *
 * 直接一点就扣钱太危险（200 个 16px 的格子，很容易蹭到），
 * 所以先弹层确认，金额按「补到这一格所需的钱」预填。
 */
export function openCellSheet(index: number): void {
  const s = store.state;
  const d = derive(s);
  const cost = cellCost(s.settings);
  const on = d.lit.has(index);

  const body = on
    ? h(
        'div',
        { class: 'cell-info' },
        h('b', {}, '已点亮'),
        h('span', {}, `这一格存了 ¥${yuan(cost)}。取消点亮会同时把这笔钱退掉。`),
      )
    : h(
        'div',
        { class: 'cell-info' },
        h('b', {}, `点亮 +¥${yuan(cost)}`),
        h('span', {}, `点亮这一格就存下 ¥${yuan(cost)}；再点一次可以取消。`),
      );

  const acts = on
    ? h(
        'div',
        { class: 'sheet-acts' },
        h('button', { class: 'btn ghost', type: 'button', onclick: closeSheet }, '保留'),
        h(
          'button',
          {
            class: 'btn',
            type: 'button',
            onclick: () => {
              store.unlightCell(index);
              closeSheet();
              toast(`已取消第 ${index + 1} 格`);
            },
          },
          `取消点亮 −¥${yuan(cost)}`,
        ),
      )
    : h(
        'div',
        { class: 'sheet-acts' },
        h('button', { class: 'btn ghost', type: 'button', onclick: closeSheet }, '取消'),
        h(
          'button',
          {
            class: 'btn',
            type: 'button',
            onclick: () => {
              store.lightCell(index);
              closeSheet();
              toast(`第 ${index + 1} 格点亮 · 存 ${yuan(cost)}`);
            },
          },
          `点亮 +¥${yuan(cost)}`,
        ),
      );

  mount(h('div', {}, h('h2', {}, `第 ${index + 1} 格`), body, acts));
  requestAnimationFrame(() => {
    document.querySelectorAll('.cell[data-idx]').forEach((el) => {
      if (Number((el as HTMLElement).dataset.idx) === index) el.classList.add('picked');
    });
  });
}

/**
 * 操作提示条：做完一次改动后浮在底部，带「撤销」。
 *
 * 拖选点亮、取消点亮、删除这类操作都是松手即生效，误操作只能手点回来，
 * 所以统一走这里给一次反悔机会。样式和 toast 一致，位置也一样，两者不会同时出现。
 */

const HOLD = 4200;

let bar: HTMLElement | null = null;
let textEl: HTMLElement | null = null;
let timer = 0;

function ensure(): HTMLElement {
  if (bar) return bar;
  bar = document.createElement('div');
  bar.className = 'undo-bar';

  textEl = document.createElement('div');
  textEl.className = 'undo-text';

  const undo = document.createElement('button');
  undo.type = 'button';
  undo.className = 'undo-btn';
  undo.textContent = '撤销';
  undo.onclick = () => {
    const fn = current;
    clearUndo();
    fn?.();
  };

  bar.append(textEl, undo);
  document.body.append(bar);
  return bar;
}

let current: (() => void) | null = null;

/** 显示一条可撤销的提示 */
export function offerUndo(text: string, undo: () => void, ms = HOLD): void {
  // 同时出现的 toast 会让两层叠在一起，先收起来
  document.getElementById('toast')?.classList.remove('show');

  ensure();
  if (textEl) textEl.textContent = text;
  current = undo;
  bar?.classList.add('show');

  window.clearTimeout(timer);
  timer = window.setTimeout(() => hide(), ms);
}

function hide(): void {
  bar?.classList.remove('show');
  current = null;
}

export function clearUndo(): void {
  window.clearTimeout(timer);
  hide();
}

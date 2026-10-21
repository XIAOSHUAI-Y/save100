/**
 * 按住拖选：长按一格进入选择模式，手指划过的格子一起点亮；松手一次性存下。
 *
 * 为什么是长按而不是直接拖：方格区很长，直接拖会和页面滚动抢手势。
 * 长按 240ms（手指还没动）先进入选择模式，之后才拦滚动。
 * 鼠标没有这个冲突，拖过 8px 就直接进入选择。
 *
 * 按在已点亮的格子上就进入「取消」模式：划过的格子会被取消点亮，松手一次性移除。
 *
 * 单击仍然是打开单格弹层，不受影响。
 */

import { yuan } from './model';

const LONG_PRESS = 240;
const MOVE_TOLERANCE = 8;

type Options = {
  /** 每格多少钱，用来算提示里的总额 */
  cellValue: () => number;
  isLit: (index: number) => boolean;
  /** 划过的空格子 → 点亮 */
  onLight: (cells: number[]) => void;
  /** 划过的已亮格子 → 取消点亮 */
  onUnlight: (cells: number[]) => void;
};

export function attachDragSelect(grid: HTMLElement, opts: Options): void {
  let mode: 'idle' | 'pending' | 'select' = 'idle';
  let timer = 0;
  let startX = 0;
  let startY = 0;
  let pointerId = -1;
  let selected = new Set<number>();
  let badge: HTMLElement | null = null;
  let suppressClick = false;
  let action: 'light' | 'unlight' = 'light';

  /** 这一格在当前动作下是否该被选中 */
  const wanted = (idx: number): boolean =>
    action === 'light' ? !opts.isLit(idx) : opts.isLit(idx);

  const cellOf = (x: number, y: number): HTMLElement | null => {
    const el = document.elementFromPoint(x, y);
    const cell = el instanceof Element ? (el.closest('.cell') as HTMLElement | null) : null;
    if (!cell || !grid.contains(cell) || !cell.dataset.idx) return null;
    return cell;
  };

  const refreshBadge = (): void => {
    if (!badge) return;
    const n = selected.size;
    const verb = action === 'light' ? '点亮' : '取消';
    badge.textContent = n ? `${verb} ${n} 格 · ${yuan(n * opts.cellValue())} 元` : '划过格子来选择';
  };

  const paint = (cell: HTMLElement): void => {
    const idx = Number(cell.dataset.idx);
    if (!Number.isFinite(idx) || selected.has(idx) || !wanted(idx)) return;
    selected.add(idx);
    cell.classList.add(action === 'light' ? 'choosing' : 'removing');
    refreshBadge();
  };

  const begin = (idx: number): void => {
    mode = 'select';
    selected = new Set();
    // 按在已点亮的格子上 → 取消模式；按在空格子上 → 点亮模式
    action = opts.isLit(idx) ? 'unlight' : 'light';
    grid.classList.add('selecting');
    badge = document.createElement('div');
    badge.className = action === 'unlight' ? 'drag-badge removing' : 'drag-badge';
    document.body.append(badge);

    // 把还在显示的提示收起来，免得和下面的徽标叠在一起
    document.getElementById('toast')?.classList.remove('show');

    const first = grid.querySelector(`[data-idx="${idx}"]`);
    if (first instanceof HTMLElement) paint(first);
    refreshBadge();

    try {
      grid.setPointerCapture(pointerId);
    } catch {
      /* 某些浏览器不支持，忽略 */
    }
    try {
      navigator.vibrate?.(12);
    } catch {
      /* 忽略 */
    }
  };

  const cleanup = (): void => {
    grid.classList.remove('selecting');
    badge?.remove();
    badge = null;
    grid
      .querySelectorAll('.cell.choosing, .cell.removing')
      .forEach((el) => el.classList.remove('choosing', 'removing'));
    selected = new Set();
    mode = 'idle';
  };

  const commit = (): void => {
    const act = action;
    const cells = [...selected].filter(wanted);
    cleanup();
    if (!cells.length) return;
    // 拖选结束后的那次 click 别当成单击
    suppressClick = true;
    window.setTimeout(() => {
      suppressClick = false;
    }, 400);
    if (act === 'light') opts.onLight(cells);
    else opts.onUnlight(cells);
  };

  // 拖选结束的那次 click 不要当成单击打开弹层
  grid.addEventListener(
    'click',
    (e) => {
      if (!suppressClick) return;
      e.stopPropagation();
      e.preventDefault();
    },
    true,
  );

  grid.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const cell = (e.target as HTMLElement).closest?.('.cell') as HTMLElement | null;
    if (!cell || !grid.contains(cell) || !cell.dataset.idx) return;

    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    mode = 'pending';
    window.clearTimeout(timer);

    if (e.pointerType === 'mouse') return; // 鼠标靠移动距离判断
    const idx = Number(cell.dataset.idx);
    timer = window.setTimeout(() => begin(idx), LONG_PRESS);
  });

  grid.addEventListener('pointermove', (e) => {
    if (mode === 'idle' || e.pointerId !== pointerId) return;

    if (mode === 'pending') {
      const moved = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (moved < MOVE_TOLERANCE) return;
      window.clearTimeout(timer);
      if (e.pointerType === 'mouse') {
        const cell = cellOf(e.clientX, e.clientY);
        if (cell) begin(Number(cell.dataset.idx));
        else mode = 'idle';
      } else {
        mode = 'idle'; // 手指先动了，当作滚动
      }
      return;
    }

    e.preventDefault();
    const cell = cellOf(e.clientX, e.clientY);
    if (cell) paint(cell);
  });

  // 选择模式下不让页面跟着滚
  grid.addEventListener(
    'touchmove',
    (e) => {
      if (mode === 'select') e.preventDefault();
    },
    { passive: false },
  );

  grid.addEventListener('contextmenu', (e) => {
    if (mode !== 'idle') e.preventDefault();
  });

  grid.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pointerId) return;
    window.clearTimeout(timer);
    const wasSelecting = mode === 'select';
    pointerId = -1;
    if (wasSelecting) commit();
    else cleanup();
    try {
      grid.releasePointerCapture(e.pointerId);
    } catch {
      /* 忽略 */
    }
  });

  grid.addEventListener('pointercancel', () => {
    window.clearTimeout(timer);
    pointerId = -1;
    cleanup();
  });
}

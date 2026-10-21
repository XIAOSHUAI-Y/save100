/**
 * 里程碑卡片：点亮第 1 / 10 / 50 / 100 / 200 … 格时弹一张「恭喜达成」。
 *
 * 配色不写死：全部走主题变量（--on-strong / --on / --off / --accent-soft / --card / --text），
 * 换主题时卡片跟着变。撒花的颜色也从这几个变量里取，不额外造一套色板。
 *
 * 交互照参考小程序：先看到正面（图标 + 第 N 格），轻触翻面，
 * 背面是解锁条件、一句语录、解锁日期；再点任意位置关闭。
 *
 * 一次存入跨过多个里程碑时，卡片不重新淡入淡出，而是再翻 180° 换成下一张：
 * 转到侧面（90°）那一刻两面都看不见，就在这时候换内容，看起来就是「翻过去是新的一张」。
 */

import { type MilestoneInfo, derive, milestoneInfo, milestones } from '../model';
import { store } from '../store';
import { h } from '../ui';
import { mountSheet } from '../sheet';

/** 撒花数量；手机上再多会掉帧 */
const CONFETTI = 44;

const CONFETTI_VARS = ['--on-strong', '--on', '--on-strong', '--card', '--on', '--off', '--on-strong'];

/** 换下一张时的翻转时长（ms），换内容的时刻取一半 */
const FLIP_MS = 720;

let mask: HTMLElement | null = null;
let cardEl: HTMLElement | null = null;
let frontEl: HTMLElement | null = null;
let backEl: HTMLElement | null = null;
let hintEl: HTMLElement | null = null;
let confettiEl: HTMLElement | null = null;

/** 当前是不是背面朝前 */
let flipped = false;
/** 正在翻转，挡住连点 */
let busy = false;
/** 后面还排着的卡片 */
let rest: { info: MilestoneInfo; date: string }[] = [];

function confetti(): HTMLElement {
  const wrap = h('div', { class: 'ms-confetti' });
  for (let i = 0; i < CONFETTI; i++) {
    const left = Math.random() * 100;
    const delay = Math.random() * 1.6;
    const dur = 2.6 + Math.random() * 2.2;
    const size = 5 + Math.random() * 6;
    const skew = Math.random() * 360;
    const drift = (Math.random() - 0.5) * 90;
    wrap.append(
      h('i', {
        style: {
          left: `${left.toFixed(1)}%`,
          width: `${size.toFixed(1)}px`,
          height: `${(size * (0.4 + Math.random() * 0.7)).toFixed(1)}px`,
          background: `var(${CONFETTI_VARS[i % CONFETTI_VARS.length]})`,
          // h() 走的是 style.setProperty，必须用 kebab-case，驼峰会被丢掉
          'animation-delay': `${delay.toFixed(2)}s`,
          'animation-duration': `${dur.toFixed(2)}s`,
          '--skew': `${skew.toFixed(0)}deg`,
          '--drift': `${drift.toFixed(0)}px`,
        },
      }),
    );
  }
  return wrap;
}

/** 2×2 的小图标，右下角先亮，和参考图一致 */
function icon(filled: number): HTMLElement {
  const on = new Set(Array.from({ length: Math.min(4, Math.max(0, filled)) }, (_, k) => 3 - k));
  return h(
    'div',
    { class: 'ms-icon' },
    ...[0, 1, 2, 3].map((i) => h('i', { class: on.has(i) ? 'on' : '' })),
  );
}

function frontFace(info: MilestoneInfo): HTMLElement {
  return h('div', {}, icon(info.filled), h('div', { class: 'ms-name' }, info.name), h('div', { class: 'ms-rule' }));
}

function backFace(info: MilestoneInfo, date: string): HTMLElement {
  return h(
    'div',
    {},
    h('div', { class: 'ms-cond' }, h('i', {}, '解锁条件'), h('b', {}, info.condition)),
    h('div', { class: 'ms-quote' }, info.quote),
    h('div', { class: 'ms-rule' }),
    h('div', { class: 'ms-date' }, `解锁于 ${date.replace(/-/g, '.')}`),
  );
}

/** 换卡面内容（只在卡片侧面对着屏幕时调用） */
function paint(info: MilestoneInfo, date: string): void {
  frontEl?.replaceChildren(...frontFace(info).childNodes);
  backEl?.replaceChildren(...backFace(info, date).childNodes);
}

function restartConfetti(): void {
  if (!confettiEl) return;
  const fresh = confetti();
  confettiEl.replaceWith(fresh);
  confettiEl = fresh;
}

/** 翻到背面 */
function toBack(): void {
  if (!cardEl || !hintEl) return;
  flipped = true;
  // 进场动画的 transform 会压过 .flipped，翻面前要先摘掉；
  // 但摘动画和加 class 落在同一帧时，浏览器拿不到过渡起点，会直接跳到终点
  // （表现就是「没有翻转效果」）。中间强制读一次布局，把 0° 刷成真正的起始值。
  cardEl.style.animation = 'none';
  void cardEl.offsetWidth;
  cardEl.classList.add('flipped');
  hintEl.textContent = '轻触任意位置，继续攒钱';
}

/** 换下一张：再翻 180°，侧面时换内容 */
function advance(): void {
  if (!cardEl || !hintEl || rest.length === 0) return;
  const next = rest.shift()!;
  busy = true;
  flipped = false;
  cardEl.style.transition = `transform ${FLIP_MS}ms cubic-bezier(0.3, 0.9, 0.2, 1)`;
  cardEl.style.transform = 'rotateY(360deg)';

  // 转到约 270°（侧面）时换内容，这时候两张卡面都看不见
  window.setTimeout(() => {
    paint(next.info, next.date);
    restartConfetti();
    if (hintEl) hintEl.textContent = '轻触翻开';
  }, FLIP_MS / 2);

  window.setTimeout(() => {
    // 360° 和 0° 视觉一致；清掉内联样式后回到常态，交给 class 控制之后的翻面
    cardEl!.style.transition = '';
    cardEl!.style.transform = '';
    cardEl!.classList.remove('flipped');
    busy = false;
  }, FLIP_MS);
}

function onTap(): void {
  if (busy) return;
  if (!flipped) {
    toBack();
    return;
  }
  if (rest.length > 0) {
    advance();
    return;
  }
  closeMilestone();
}

function ensureMask(): void {
  if (mask) return;
  frontEl = h('div', { class: 'ms-face ms-front' });
  backEl = h('div', { class: 'ms-face ms-back' });
  cardEl = h('div', { class: 'ms-card' }, frontEl, backEl);
  hintEl = h('div', { class: 'ms-hint' }, '轻触翻开');
  confettiEl = confetti();
  mask = h(
    'div',
    { class: 'ms-mask' },
    confettiEl,
    h('div', { class: 'ms-title' }, '恭喜达成'),
    h('div', { class: 'ms-stage' }, cardEl),
    hintEl,
  );
  mask.addEventListener('click', onTap);
  document.body.append(mask);
}

/**
 * 弹一张里程碑卡。
 * `queue` 是后面还要接着弹的：关这张时会翻过去换下一张，不重新淡入。
 */
export function showMilestone(
  info: MilestoneInfo,
  date: string,
  queue: { info: MilestoneInfo; date: string }[] = [],
): void {
  closeMilestone();
  rest = [...queue];
  flipped = false;
  busy = false;

  ensureMask();
  paint(info, date);
  if (hintEl) hintEl.textContent = '轻触翻开';

  requestAnimationFrame(() => mask?.classList.add('show'));
  // 轻震一下，有触感反馈的机型会更有「达成」的感觉
  navigator.vibrate?.(24);
}

export function closeMilestone(): void {
  if (!mask) return;
  const el = mask;
  mask = null;
  cardEl = null;
  frontEl = null;
  backEl = null;
  hintEl = null;
  confettiEl = null;
  rest = [];
  el.classList.remove('show');
  el.classList.add('leaving');
  window.setTimeout(() => el.remove(), 220);
}

/** 把还没弹过的里程碑排队弹完 */
export function flushMilestones(): void {
  const nums = store.drainUnlocks();
  if (nums.length === 0) return;
  const items = nums.map((n) => ({
    info: milestoneInfo(n),
    date: store.unlockedAt(n) ?? '',
  }));
  // 等这一帧渲染完再弹，不然卡片的进场动画会被首屏绘制吃掉
  window.setTimeout(() => showMilestone(items[0].info, items[0].date, items.slice(1)), 320);
}

/** 里程碑列表：已解锁的可以点开重看，没解锁的显示还差多少 */
export function openMilestoneList(): void {
  const d = derive(store.state);
  const list = milestones(d.cells);

  const rows = list.map((n) => {
    const at = store.unlockedAt(n) ?? '';
    const info = milestoneInfo(n);
    const opened = Boolean(at);
    return h(
      'button',
      {
        class: opened ? 'ms-row on' : 'ms-row',
        type: 'button',
        onclick: () => {
          if (opened) showMilestone(info, at);
        },
      },
      icon(info.filled),
      h(
        'div',
        { class: 'ms-row-main' },
        h('b', {}, info.name),
        h('span', {}, opened ? `解锁于 ${at.replace(/-/g, '.')}` : `还差 ${n - d.litCells} 格`),
      ),
      h('span', { class: 'ms-row-state' }, opened ? '已解锁' : '未解锁'),
    );
  });

  mountSheet(
    h(
      'div',
      {},
      h('h2', {}, '里程碑'),
      h('p', { class: 'ms-lead' }, `点亮第 ${list.join(' / ')} 格各有一张卡片。`),
      h('div', { class: 'ms-list' }, ...rows),
    ),
  );
}

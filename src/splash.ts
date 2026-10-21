/**
 * 开屏动画：打开 App 时小罐子晃一下、硬币浮一下，然后淡出。
 *
 * 手机桌面上的图标是静态的（系统不支持动图），所以动画放在这里。
 * 只在页面首次加载时跑一次，切路由不重复；`prefers-reduced-motion` 下直接跳过。
 */

const ART = `
<svg class="splash-art" viewBox="0 0 100 100" aria-hidden="true">
  <defs>
    <clipPath id="sp-jar"><path d="M31 41q0-5 5-5h28q5 0 5 5v33q0 7-7 7H38q-7 0-7-7z" /></clipPath>
    <linearGradient id="sp-glass" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0.92" />
      <stop offset="0.5" stop-color="#fff" stop-opacity="0.55" />
      <stop offset="1" stop-color="#fff" stop-opacity="0.88" />
    </linearGradient>
    <linearGradient id="sp-coin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe08a" /><stop offset="1" stop-color="#eda93a" />
    </linearGradient>
  </defs>
  <g transform="translate(50 54) scale(1.08) translate(-50 -55)">
    <g class="sp-jar">
      <path d="M30 40q0-6 6-6h28q6 0 6 6v34q0 8-8 8H38q-8 0-8-8z" fill="url(#sp-glass)" />
      <g class="sp-coins" clip-path="url(#sp-jar)">
        <circle cx="41" cy="72" r="5.4" fill="url(#sp-coin)" stroke="#d99a2e" stroke-width="0.8" />
        <circle cx="59" cy="73" r="5.4" fill="url(#sp-coin)" stroke="#d99a2e" stroke-width="0.8" />
        <circle cx="50" cy="69" r="5.4" fill="url(#sp-coin)" stroke="#d99a2e" stroke-width="0.8" />
      </g>
      <path d="M30 40q0-6 6-6h28q6 0 6 6v34q0 8-8 8H38q-8 0-8-8z" fill="none" stroke="#a9d8c6" stroke-width="2" />
      <path d="M36 44q0-4 4-4v34q-4 0-4-4z" fill="#fff" opacity="0.8" />
      <rect x="34" y="28" width="32" height="7" rx="3.5" fill="#f4a0b8" />
      <rect x="38" y="33" width="24" height="5" rx="2.5" fill="#fff" opacity="0.85" />
      <g class="sp-eyes">
        <circle cx="43" cy="52" r="2.4" fill="#3f6b5c" />
        <circle cx="57" cy="52" r="2.4" fill="#3f6b5c" />
        <circle cx="43.8" cy="51.2" r="0.8" fill="#fff" />
        <circle cx="57.8" cy="51.2" r="0.8" fill="#fff" />
      </g>
      <path d="M46 58q4 3.4 8 0" stroke="#3f6b5c" stroke-width="2" fill="none" stroke-linecap="round" />
      <ellipse cx="37.5" cy="56" rx="3.4" ry="2" fill="#f4a0b8" opacity="0.7" />
      <ellipse cx="62.5" cy="56" rx="3.4" ry="2" fill="#f4a0b8" opacity="0.7" />
    </g>
  </g>
</svg>`;

/** 动画总时长（ms），到点淡出 */
const HOLD = 850;
const FADE = 320;

export function showSplash(): void {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  if (document.querySelector('.splash')) return;

  const el = document.createElement('div');
  el.className = 'splash';
  el.innerHTML = `${ART}<div class="splash-name">100万打卡</div>`;
  document.body.append(el);

  window.setTimeout(() => {
    el.classList.add('out');
    window.setTimeout(() => el.remove(), FADE);
  }, HOLD);
}

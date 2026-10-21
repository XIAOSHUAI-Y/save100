/**
 * 版本更新提醒。
 *
 * 构建时会把 `__BUILD_ID__` 打进 JS，同时产出一份 `dist/version.json`。
 * 运行时拿服务器上的 buildId 和自己这份比：不一样就说明有新版本。
 * 没有 Service Worker，所以「更新」就是重新拉一次 index.html + 新的带哈希资源；
 * 数据全在 localStorage，刷新不会动数据。
 */

const CHECK_INTERVAL = 5 * 60 * 1000;
const FIRST_CHECK_DELAY = 4000;
const VISIBLE_THROTTLE = 60 * 1000;
const FETCH_TIMEOUT = 8000;

export type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'error';

type VersionInfo = { version: string; buildId: string; builtAt?: string };

/** 当前跑着的这份构建 */
export const appVersion = __APP_VERSION__;

let status: UpdateStatus = 'idle';
let remote: VersionInfo | null = null;
let lastError = '';
let lastCheckedAt = 0;
let inflight: Promise<UpdateStatus> | null = null;
let bannerEl: HTMLElement | null = null;
let maskEl: HTMLElement | null = null;
let dismissed = '';
let started = false;

const ICON = {
  down: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5L20 6.5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4L2.8 20h18.4z"/><path d="M12 10v4"/><path d="M12 17.2v.2"/></svg>',
  spin: '<svg class="upd-spin" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

function versionUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}version.json?t=${Date.now()}`;
}

async function fetchVersion(): Promise<VersionInfo> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(versionUrl(), { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Partial<VersionInfo>;
    if (typeof data.buildId !== 'string' || !data.buildId) throw new Error('version.json 缺 buildId');
    return { version: String(data.version ?? ''), buildId: data.buildId, builtAt: data.builtAt };
  } finally {
    window.clearTimeout(timer);
  }
}

/** 检查有没有新版本；并发调用共用同一次请求 */
export function checkForUpdates(): Promise<UpdateStatus> {
  if (inflight) return inflight;
  status = 'checking';
  if (maskEl) renderDialog();

  const run = async (): Promise<UpdateStatus> => {
    try {
      const info = await fetchVersion();
      remote = info;
      lastError = '';
      status = info.buildId === __BUILD_ID__ ? 'up-to-date' : 'update-available';
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // 已经提示过更新就别因为一次网络抖动把提示撤掉
      if (status !== 'update-available') status = 'error';
    }
    lastCheckedAt = Date.now();
    if (maskEl) renderDialog();
    if (status === 'update-available') showBanner();
    return status;
  };

  const p = run();
  inflight = p;
  void p.then(() => {
    if (inflight === p) inflight = null;
  });
  return p;
}

/** 真正刷新：带上版本号绕过 index.html 的强缓存，hash 路由保持不变 */
export function applyUpdate(): void {
  const id = remote?.buildId ?? String(Date.now());
  const url = new URL(window.location.href);
  url.searchParams.set('v', id);
  window.location.replace(url.toString());
}

function showBanner(): void {
  if (bannerEl) return;
  if (remote && dismissed === remote.buildId) return;

  const el = document.createElement('div');
  el.className = 'upd-bar';

  const top = document.createElement('div');
  top.className = 'upd-bar-top';

  const badge = document.createElement('div');
  badge.className = 'upd-badge';
  badge.innerHTML = ICON.down;

  const text = document.createElement('div');
  text.className = 'upd-bar-text';
  const title = document.createElement('b');
  title.textContent = '新版本已准备好';
  const sub = document.createElement('span');
  sub.textContent = '数据都在本机，更新只是刷新程序文件';
  text.append(title, sub);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'upd-x';
  close.setAttribute('aria-label', '稍后再说');
  close.innerHTML = ICON.close;
  close.onclick = () => {
    dismissed = remote?.buildId ?? '';
    hideBanner();
  };

  top.append(badge, text, close);

  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'upd-primary';
  go.textContent = '立即更新';
  go.onclick = () => applyUpdate();

  el.append(top, go);
  document.body.append(el);
  bannerEl = el;
}

function hideBanner(): void {
  bannerEl?.remove();
  bannerEl = null;
}

/** 手动入口（主题页）用这个打开 */
export function openUpdateDialog(): void {
  if (maskEl) return;
  hideBanner();
  const mask = document.createElement('div');
  mask.className = 'upd-mask';
  mask.onclick = (e) => {
    if (e.target === mask) closeDialog();
  };
  maskEl = mask;
  document.body.append(mask);
  renderDialog();
  void checkForUpdates();
}

function closeDialog(): void {
  maskEl?.remove();
  maskEl = null;
  if (status === 'update-available') showBanner();
}

function statusIcon(): string {
  switch (status) {
    case 'checking':
      return ICON.spin;
    case 'up-to-date':
      return ICON.check;
    case 'update-available':
      return ICON.down;
    case 'error':
      return ICON.alert;
    default:
      return ICON.down;
  }
}

function statusTitle(): string {
  switch (status) {
    case 'checking':
      return '正在检查更新';
    case 'up-to-date':
      return '已是最新版本';
    case 'update-available':
      return '发现新版本';
    case 'error':
      return '检查更新失败';
    default:
      return '检查更新';
  }
}

function statusDesc(): string {
  switch (status) {
    case 'checking':
      return '正在向服务器确认有没有新的程序版本…';
    case 'up-to-date':
      return '这已经是最新的一份，安心攒钱。';
    case 'update-available':
      return '刷新只会重新加载程序文件，你存的钱和打卡记录都不会动。';
    case 'error':
      return lastError ? `暂时连不上服务器（${lastError}）。` : '暂时连不上服务器，确认网络后重试。';
    default:
      return '来看看有没有新版本。';
  }
}

function renderDialog(): void {
  const mask = maskEl;
  if (!mask) return;

  const card = document.createElement('div');
  card.className = 'upd-card';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'upd-x upd-x-card';
  close.setAttribute('aria-label', '关闭');
  close.innerHTML = ICON.close;
  close.onclick = () => closeDialog();

  const icon = document.createElement('div');
  icon.className = `upd-icon is-${status}`;
  icon.innerHTML = statusIcon();

  const title = document.createElement('div');
  title.className = 'upd-title';
  title.textContent = statusTitle();

  const desc = document.createElement('div');
  desc.className = 'upd-desc';
  desc.textContent = statusDesc();

  const meta = document.createElement('div');
  meta.className = 'upd-meta';
  const parts = [`v${appVersion}`];
  if (status === 'update-available' && remote?.version && remote.version !== appVersion) {
    parts.push(`新版本 v${remote.version}`);
  }
  meta.textContent = parts.join(' · ');

  const actions = document.createElement('div');
  actions.className = 'upd-actions';

  if (status === 'update-available') {
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'upd-primary';
    go.textContent = '立即更新并重启';
    go.onclick = () => applyUpdate();
    actions.append(go);
  } else if (status === 'error') {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'upd-primary';
    retry.textContent = '重新检查';
    retry.onclick = () => void checkForUpdates();
    actions.append(retry);
  } else if (status === 'checking') {
    const wait = document.createElement('button');
    wait.type = 'button';
    wait.className = 'upd-ghost';
    wait.textContent = '取消';
    wait.onclick = () => closeDialog();
    actions.append(wait);
  } else {
    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'upd-primary';
    done.textContent = '完成';
    done.onclick = () => closeDialog();
    actions.append(done);
  }

  card.append(close, icon, title, desc, meta, actions);
  mask.replaceChildren(card);
}

/** 页面启动时调用一次：延迟首查 + 定时查 + 回到前台/恢复网络时查 */
export function startUpdateWatch(): void {
  if (started) return;
  started = true;

  // 更新后 URL 上留了 ?v=xxx，清掉，别留在地址栏里
  const url = new URL(window.location.href);
  if (url.searchParams.has('v')) {
    url.searchParams.delete('v');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  window.setTimeout(() => void checkForUpdates(), FIRST_CHECK_DELAY);

  window.setInterval(() => {
    if (document.visibilityState === 'visible') void checkForUpdates();
  }, CHECK_INTERVAL);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastCheckedAt < VISIBLE_THROTTLE) return;
    void checkForUpdates();
  });

  window.addEventListener('online', () => void checkForUpdates());
}

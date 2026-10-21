/**
 * 100万打卡 · 网页版
 *
 * 路由用 hash（#/grid），刷新和分享都不会 404，也不需要服务端 rewrite。
 */

import './style.css';
import { store } from './store';
import { clear, h, toast } from './ui';
import { openDepositSheet } from './sheet';
import { renderGrid } from './views/grid';
import { renderPassbook } from './views/passbook';
import { renderNotes } from './views/notes';
import { renderReport } from './views/report';
import { renderThemes } from './views/themes';
import { renderActivities } from './views/activities';
import { renderVip } from './views/vip';
import { flushMilestones } from './views/milestone';
import { showSplash } from './splash';
import { startUpdateWatch } from './update';

type RouteId = 'grid' | 'passbook' | 'notes' | 'report' | 'themes' | 'activities' | 'vip';

const ROUTES: { id: RouteId; label: string; render: () => HTMLElement }[] = [
  { id: 'grid', label: '方格', render: renderGrid },
  { id: 'passbook', label: '存折', render: renderPassbook },
  { id: 'notes', label: '便签', render: renderNotes },
  { id: 'report', label: '报告', render: renderReport },
  { id: 'themes', label: '主题', render: renderThemes },
  { id: 'activities', label: '活动', render: renderActivities },
  { id: 'vip', label: 'VIP', render: renderVip },
];

function currentRoute(): RouteId {
  const id = location.hash.replace(/^#\/?/, '') as RouteId;
  return ROUTES.some((r) => r.id === id) ? id : 'grid';
}

function go(id: RouteId): void {
  if (currentRoute() === id) return;
  location.hash = `#/${id}`;
}

const app = document.getElementById('app')!;

function render(): void {
  const route = currentRoute();
  const { settings } = store.state;
  document.documentElement.dataset.theme = settings.theme;
  document.title = `${settings.goalName} · 100万打卡`;

  clear(app);

  const goal = h(
    'button',
    { class: 'goal', type: 'button', onclick: () => go('vip') },
    h('span', { class: 'emoji' }, '🎯'),
    h('span', {}, settings.goalName),
    h('span', { class: 'chev' }, '›'),
  );

  const topbar = h(
    'header',
    { class: 'topbar' },
    goal,
    h('button', { class: 'more-btn', type: 'button', onclick: () => go('vip'), 'aria-label': '设置' }, '⋯'),
  );

  const tabs = h(
    'nav',
    { class: 'tabs' },
    ...ROUTES.map((r) =>
      h(
        'button',
        { class: r.id === route ? 'tab on' : 'tab', type: 'button', onclick: () => go(r.id) },
        r.label,
      ),
    ),
  );

  const view = ROUTES.find((r) => r.id === route)!;
  const main = h('main', {}, view.render());

  const bottom = h(
    'nav',
    { class: 'bottom' },
    h('button', { class: 'cta', type: 'button', onclick: () => openDepositSheet() }, '打卡'),
    h('button', { type: 'button', onclick: () => go('grid') }, '现在'),
    h('button', { type: 'button', onclick: () => go('report'), class: route === 'report' ? 'on' : '' }, '未来'),
  );

  app.append(topbar, tabs, main, bottom);

  // 切页回到顶部
  window.scrollTo({ top: 0 });

  // 点亮到里程碑就弹卡片
  flushMilestones();
}

window.addEventListener('hashchange', render);
store.subscribe(render);
render();

// 开屏动画：只在首次加载跑一次，切路由不重复
showSplash();

// 有新版本就提示（主题页还有手动入口）
startUpdateWatch();

// 首次打开给个提示，别让人对着空网格不知道怎么开始
if (store.state.deposits.length === 0) {
  setTimeout(() => toast('点任意方格点亮它，一格 = 一笔钱'), 600);
}

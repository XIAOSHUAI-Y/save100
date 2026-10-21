/** 主题页：6 套配色，免费全开 */

import { type ThemeId } from '../model';
import { store } from '../store';
import { h } from '../ui';
import { appVersion, openUpdateDialog } from '../update';

const THEMES: { id: ThemeId; name: string; on: string; off: string; bg: string }[] = [
  { id: 'pink', name: '樱花粉', on: '#df708c', off: '#f9e7ec', bg: '#fbf4f4' },
  { id: 'mint', name: '薄荷绿', on: '#5fbf95', off: '#e3f4ea', bg: '#f2faf6' },
  { id: 'sky', name: '晴空蓝', on: '#6f9de0', off: '#e4ecfa', bg: '#f2f6fd' },
  { id: 'sand', name: '奶茶', on: '#d9a35f', off: '#f7ecda', bg: '#fdf8f0' },
  { id: 'violet', name: '鸢尾紫', on: '#9b83d9', off: '#ece6fa', bg: '#f7f4fd' },
  { id: 'graphite', name: '石墨', on: '#7b8794', off: '#e8eaed', bg: '#f7f7f8' },
];

export function renderThemes(): HTMLElement {
  const current = store.state.settings.theme;
  return h(
    'div',
    {},
    h(
      'div',
      { class: 'swatches' },
      ...THEMES.map((t) =>
        h(
          'button',
          {
            class: current === t.id ? 'swatch on' : 'swatch',
            type: 'button',
            onclick: () => store.setTheme(t.id),
          },
          h(
            'div',
            { class: 'dots' },
            h('i', { style: { background: t.on } }),
            h('i', { style: { background: t.off } }),
            h('i', { style: { background: t.bg, border: '1px solid rgba(0,0,0,.06)' } }),
          ),
          t.name,
        ),
      ),
    ),
    h('p', { class: 'hint' }, '切换即时生效，存在本机，重开还是这套。'),
    h(
      'button',
      { class: 'upd-entry', type: 'button', onclick: () => openUpdateDialog() },
      h('span', {}, '检查更新'),
      h('span', { class: 'upd-entry-tail' }, `v${appVersion} ›`),
    ),
  );
}

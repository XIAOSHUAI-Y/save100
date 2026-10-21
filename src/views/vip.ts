/** 设置 / 会员页：参考 App 里这些都要充 VIP，这里全开 */

import { derive, money, yuan } from '../model';
import { store } from '../store';
import { h, toast } from '../ui';

function numField(
  label: string,
  value: number,
  onCommit: (v: number) => void,
  opts: { suffix?: string; min?: number; step?: number } = {},
): HTMLElement {
  const input = h('input', {
    type: 'number',
    inputmode: 'decimal',
    value: String(value),
    min: String(opts.min ?? 1),
    step: String(opts.step ?? 1),
  }) as HTMLInputElement;
  const commit = (): void => {
    const v = Number(input.value);
    if (!(v > 0)) {
      input.value = String(value);
      toast('要大于 0');
      return;
    }
    onCommit(v);
    toast('已保存');
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
  });
  return h(
    'div',
    { class: 'field' },
    h('label', {}, label),
    h('span', { style: { display: 'flex', alignItems: 'baseline', gap: '4px', flex: '0 0 52%' } },
      input,
      h('span', { style: { fontSize: '12px', color: 'var(--muted)' } }, opts.suffix ?? ''),
    ),
  );
}

export function renderVip(): HTMLElement {
  const s = store.state;
  const d = derive(s);

  const feats = [
    '6 套主题皮肤',
    '月度报告 + 达成预测',
    '便签 / 心愿清单',
    '52 周 · 365 天存钱挑战',
    '自定义目标金额与格子面值',
    '导出 / 导入备份',
  ].map((t) => h('div', { class: 'feat' }, h('i', {}, '✓'), t));

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } }) as HTMLInputElement;
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const r = store.importJson(String(reader.result));
      toast(r.message);
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  const exportData = (): void => {
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `100万打卡-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('已导出 JSON');
  };

  return h(
    'div',
    {},
    h(
      'div',
      { class: 'vip-hero' },
      h('b', {}, '全部功能已解锁'),
      h('span', {}, `已攒 ${money(d.total)} · ${d.litCells}/${d.cells} 格 · 这里没有付费墙`),
    ),
    h('div', { class: 'feats' }, ...feats),

    h(
      'section',
      { class: 'card', style: { marginBottom: '14px', padding: '0' } },
      h('div', { class: 'grid-head', style: { padding: '12px 14px 6px' } }, h('span', {}, '目标设置')),
      h(
        'div',
        { class: 'field' },
        h('label', {}, '目标名称'),
        (() => {
          const input = h('input', { type: 'text', value: s.settings.goalName }) as HTMLInputElement;
          input.addEventListener('change', () => store.patchSettings({ goalName: input.value.trim() || '我的目标' }));
          return input;
        })(),
      ),
      numField('目标金额', s.settings.target, (v) => store.patchSettings({ target: v }), { suffix: '元' }),
      numField('每格金额', s.settings.cellValue, (v) => store.patchSettings({ cellValue: v }), { suffix: '元' }),
      h(
        'div',
        { class: 'field' },
        h('label', {}, '格数'),
        h('span', { style: { fontWeight: '700' } }, `${d.cells} 格`),
      ),
    ),

    h(
      'section',
      { class: 'card', style: { marginBottom: '14px', padding: '0' } },
      h('div', { class: 'grid-head', style: { padding: '12px 14px 6px' } }, h('span', {}, '数据')),
      h(
        'div',
        { class: 'field' },
        h('label', {}, '备份'),
        h('button', { class: 'btn ghost', type: 'button', onclick: exportData, style: { padding: '8px 14px' } }, '导出 JSON'),
      ),
      h(
        'div',
        { class: 'field' },
        h('label', {}, '恢复'),
        h(
          'button',
          { class: 'btn ghost', type: 'button', onclick: () => fileInput.click(), style: { padding: '8px 14px' } },
          '导入 JSON',
        ),
      ),
      h(
        'div',
        { class: 'field' },
        h('label', {}, '清空存入'),
        h(
          'button',
          {
            class: 'btn ghost',
            type: 'button',
            style: { padding: '8px 14px' },
            onclick: () => {
              if (!window.confirm('清空所有存入记录？便签会保留。')) return;
              store.reset(true, false);
              toast('已清空存入');
            },
          },
          '清空',
        ),
      ),
      fileInput,
    ),
    h(
      'p',
      { class: 'hint' },
      `数据只存在这台设备的浏览器里（localStorage）。换手机或清缓存前，先导出一份 JSON。合计 ${yuan(d.total)} 元。`,
    ),
  );
}

/** 便签页：随手记，置顶在前 */

import { todayStr } from '../model';
import { store } from '../store';
import { h, toast } from '../ui';

export function renderNotes(): HTMLElement {
  const input = h('input', { placeholder: '记一句：想买什么、为什么攒' }) as HTMLInputElement;

  const add = (): void => {
    const t = input.value.trim();
    if (!t) {
      toast('写点什么');
      return;
    }
    store.addNote(t);
    input.value = '';
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') add();
  });

  const notes = store.sortedNotes().map((n) => {
    const body = h('div', { class: 'body' }, n.text);
    const editing = { on: false };

    const meta = h(
      'div',
      { class: 'meta' },
      h('span', {}, n.pinned ? '置顶' : todayStr(new Date(n.createdAt))),
      h(
        'div',
        { class: 'acts' },
        h(
          'button',
          {
            type: 'button',
            onclick: () => {
              store.togglePin(n.id);
            },
          },
          n.pinned ? '取消置顶' : '置顶',
        ),
        h(
          'button',
          {
            type: 'button',
            onclick: () => {
              if (editing.on) return;
              editing.on = true;
              const ta = h('textarea', { rows: '3' }) as HTMLTextAreaElement;
              ta.value = n.text;
              body.replaceChildren(ta);
              ta.focus();
              ta.addEventListener('blur', () => {
                store.updateNote(n.id, ta.value);
                editing.on = false;
              });
            },
          },
          '编辑',
        ),
        h(
          'button',
          {
            type: 'button',
            onclick: () => {
              if (!window.confirm('删除这条便签？')) return;
              store.removeNote(n.id);
            },
          },
          '删除',
        ),
      ),
    );

    return h('div', { class: n.pinned ? 'note pinned' : 'note' }, body, meta);
  });

  return h(
    'div',
    {},
    h('div', { class: 'note-add' }, input, h('button', { class: 'btn', type: 'button', onclick: add }, '添加')),
    notes.length > 0
      ? h('div', {}, ...notes)
      : h('div', { class: 'card' }, h('div', { class: 'empty-hint' }, '还没有便签', h('br'), '写下想买的东西，存钱才有理由')),
  );
}

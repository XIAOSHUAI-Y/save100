/**
 * 状态仓库：内存里一份 AppState，任何改动立刻写回 localStorage。
 *
 * 数据只在本地，没有后端。跨设备靠「导出 JSON → 另一台导入」。
 */

import {
  type AppState,
  type Deposit,
  type Note,
  type Settings,
  type ThemeId,
  cellCost,
  cellCount,
  derive,
  emptyState,
  litSet,
  milestones,
  sanitize,
  todayStr,
  uid,
} from './model';

const KEY = 'save100.state.v1';

type Listener = () => void;

class Store {
  state: AppState;
  private listeners = new Set<Listener>();
  /** 刚解锁、还没弹过的里程碑 */
  pendingUnlocks: number[] = [];
  /** 上一次数据改动前的 deposits 快照，只留一份，用来撤销 */
  private history: Deposit[] | null = null;

  constructor() {
    this.state = this.load();
    // 打开时就已达成的里程碑直接记成已解锁，不弹卡——
    // 否则老用户一进来会被一串「恭喜达成」糊脸
    const d = derive(this.state);
    for (const n of milestones(d.cells)) {
      if (d.litCells >= n && !this.state.unlocked[String(n)]) {
        this.state.unlocked[String(n)] = todayStr();
      }
    }
    this.persist();
  }

  /** 取走待弹的里程碑 */
  drainUnlocks(): number[] {
    const out = this.pendingUnlocks;
    this.pendingUnlocks = [];
    return out;
  }

  /** 改动 deposits 之前先存一份，撤销就是把它放回去 */
  private capture(): void {
    this.history = structuredClone(this.state.deposits);
  }

  canUndo(): boolean {
    return this.history !== null;
  }

  /** 回到上一次改动之前；成功返回 true */
  undo(): boolean {
    if (!this.history) return false;
    this.state.deposits = this.history;
    this.history = null;
    this.emit();
    return true;
  }

  /** 导入 / 清空这类整体替换之后，旧快照就没意义了 */
  dropHistory(): void {
    this.history = null;
  }

  /** 检查新解锁的里程碑；只在 litCells 增加时才会命中 */
  private checkMilestones(): void {
    const d = derive(this.state);
    for (const n of milestones(d.cells)) {
      if (d.litCells >= n && !this.state.unlocked[String(n)]) {
        this.state.unlocked[String(n)] = todayStr();
        this.pendingUnlocks.push(n);
      }
    }
  }

  private load(): AppState {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyState();
      return sanitize(JSON.parse(raw));
    } catch {
      return emptyState();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch (err) {
      // 隐私模式 / 配额满：不静默吞掉，控制台留痕，界面上靠「导出」兜底
      console.warn('[save100] 写入 localStorage 失败', err);
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    this.checkMilestones();
    this.persist();
    for (const fn of this.listeners) fn();
  }

  // ---------- 存入 ----------

  /**
   * 新增一笔存入。
   *
   * `cells` 给了就只点亮这几格（手动点格子）；
   * 没给就按阅读顺序（左上→右下）点亮前 floor(金额/每格) 个空格。
   */
  addDeposit(input: { amount: number; date?: string; note?: string; cells?: number[] }): Deposit | null {
    const amount = Math.round(input.amount * 100) / 100;
    if (!(amount > 0)) return null;
    this.capture();
    const cells = input.cells
      ? [...new Set(input.cells)]
      : this.nextCells(Math.floor(amount / cellCost(this.state.settings)));
    const d: Deposit = {
      id: uid(),
      date: input.date || todayStr(),
      amount,
      note: input.note?.trim() ?? '',
      createdAt: Date.now(),
      cells,
    };
    this.state.deposits.push(d);
    this.state.deposits.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
    this.emit();
    return d;
  }

  /** 取出当前还没点亮的前 n 个格子编号（阅读顺序） */
  nextCells(n: number): number[] {
    if (n <= 0) return [];
    const max = cellCount(this.state.settings);
    const lit = litSet(this.state);
    const out: number[] = [];
    for (let i = 0; i < max && out.length < n; i++) {
      if (!lit.has(i)) out.push(i);
    }
    return out;
  }

  /** 点亮一格：新建一笔「一格的钱」 */
  lightCell(index: number): void {
    if (litSet(this.state).has(index)) return;
    this.addDeposit({ amount: cellCost(this.state.settings), cells: [index] });
  }

  /**
   * 取消点亮一格。
   *
   * 从点亮它的那笔存入里摘掉这一格，金额同时减掉一格的钱；
   * 减到 0 就把这笔记录删掉。这样金额和格数不会对不上。
   */
  unlightCell(index: number): void {
    const cell = cellCost(this.state.settings);
    const dep = this.state.deposits.find((d) => d.cells.includes(index));
    if (!dep) return;
    this.capture();
    dep.cells = dep.cells.filter((c) => c !== index);
    dep.amount = Math.round((dep.amount - cell) * 100) / 100;
    if (dep.amount <= 0) {
      this.state.deposits = this.state.deposits.filter((d) => d.id !== dep.id);
    }
    this.emit();
  }

  /**
   * 一次取消点亮多格（拖选批量取消用）。
   * 语义和 unlightCell 一样：从点亮它的那笔里摘掉、金额减掉对应格数，减到 0 就删掉这笔。
   * 多个格子可能来自不同的存入，所以逐笔处理，最后只 emit 一次。
   */
  unlightCells(indices: number[]): number {
    const targets = new Set(indices);
    if (!targets.size) return 0;
    this.capture();
    const cell = cellCost(this.state.settings);
    let removed = 0;

    for (const dep of [...this.state.deposits]) {
      const keep = dep.cells.filter((c) => !targets.has(c));
      const hit = dep.cells.length - keep.length;
      if (!hit) continue;
      removed += hit;
      dep.cells = keep;
      dep.amount = Math.round((dep.amount - hit * cell) * 100) / 100;
      if (dep.amount <= 0 || !keep.length) {
        this.state.deposits = this.state.deposits.filter((d) => d.id !== dep.id);
      }
    }

    if (removed) this.emit();
    return removed;
  }

  updateDeposit(id: string, patch: Partial<Pick<Deposit, 'amount' | 'date' | 'note'>>): void {
    const d = this.state.deposits.find((x) => x.id === id);
    if (!d) return;
    this.capture();
    if (patch.amount !== undefined && patch.amount > 0) d.amount = Math.round(patch.amount * 100) / 100;
    if (patch.date) d.date = patch.date;
    if (patch.note !== undefined) d.note = patch.note.trim();
    this.emit();
  }

  removeDeposit(id: string): void {
    const i = this.state.deposits.findIndex((x) => x.id === id);
    if (i < 0) return;
    this.capture();
    this.state.deposits.splice(i, 1);
    this.emit();
  }

  // ---------- 便签 ----------

  addNote(text: string): void {
    const t = text.trim();
    if (!t) return;
    this.state.notes.unshift({ id: uid(), text: t, createdAt: Date.now(), pinned: false });
    this.emit();
  }

  updateNote(id: string, text: string): void {
    const n = this.state.notes.find((x) => x.id === id);
    if (!n) return;
    const t = text.trim();
    if (!t) {
      this.removeNote(id);
      return;
    }
    n.text = t;
    this.emit();
  }

  togglePin(id: string): void {
    const n = this.state.notes.find((x) => x.id === id);
    if (!n) return;
    n.pinned = !n.pinned;
    this.emit();
  }

  removeNote(id: string): void {
    this.state.notes = this.state.notes.filter((x) => x.id !== id);
    this.emit();
  }

  /** 置顶优先，其余按时间倒序 */
  sortedNotes(): Note[] {
    return [...this.state.notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
  }

  // ---------- 设置 ----------

  patchSettings(patch: Partial<Settings>): void {
    const shrinks = patch.cols !== undefined && patch.cols < this.state.settings.cols;
    if (shrinks) this.capture();
    this.state.settings = { ...this.state.settings, ...patch };
    // 格数变小后，越界的格子不能留：否则「点亮数」会超过总格数
    const max = cellCount(this.state.settings);
    for (const d of this.state.deposits) {
      if (d.cells.some((c) => c >= max)) d.cells = d.cells.filter((c) => c < max);
    }
    this.emit();
  }

  setTheme(theme: ThemeId): void {
    this.patchSettings({ theme });
  }

  // ---------- 导入导出 ----------

  exportJson(): string {
    return JSON.stringify(this.state, null, 2);
  }

  importJson(text: string): { ok: boolean; message: string } {
    try {
      const next = sanitize(JSON.parse(text));
      this.state = next;
      this.emit();
      return { ok: true, message: `已导入 ${next.deposits.length} 笔存入、${next.notes.length} 条便签` };
    } catch {
      return { ok: false, message: '文件不是合法的 JSON' };
    }
  }

  reset(deposits: boolean, notes: boolean): void {
    if (deposits) this.state.deposits = [];
    if (notes) this.state.notes = [];
    this.emit();
  }
}

export const store = new Store();

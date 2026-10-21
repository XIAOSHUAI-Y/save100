/**
 * 存钱打卡的数据模型与派生计算。
 *
 * 这里只放纯函数，不碰 DOM、不碰 localStorage，方便直接单测。
 * 界面上的每个数字（已攒、剩余格、点亮格）都必须能从 `derive()` 算出来，
 * 不允许各处自己拍一个——否则改目标金额后不同页面会互相矛盾。
 *
 * ## 方格是「独立」的
 *
 * 点亮不是「按总额累加出一段前缀」，而是每格单独点亮：点哪一格亮哪一格，一格 = 存 `cellValue` 元。
 *
 * 为此每笔存入带一个 `cells` 字段，记录它点亮了哪几格：
 * - 手动点格子 → 新建一笔 `cellValue` 的存入，`cells=[那一格]`
 * - 「打卡」存一个数 → 按阅读顺序（左上→右下）点亮前 floor(金额/每格) 个空格
 * - 取消点亮 → 从那笔存入里摘掉这一格，金额同时减 `cellValue`；减到 0 就删掉这笔
 *
 * 这样「金额」和「点亮格数」永远一致，不会出现攒了 8 万却一格没亮。
 */

/** 一笔存入 */
export interface Deposit {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** 金额（元），永远是正数；取钱请删记录 */
  amount: number;
  note: string;
  createdAt: number;
  /** 这笔钱点亮了哪几格（编号从左上开始，行优先） */
  cells: number[];
  /** 属于哪个目标 */
  goalId: string;
}

/** 一条便签 */
export interface Note {
  id: string;
  text: string;
  createdAt: number;
  /** 置顶 */
  pinned: boolean;
}

export type ThemeId = 'pink' | 'mint' | 'sky' | 'sand' | 'violet' | 'graphite';

export interface Settings {
  /** 目标名，例如「2026目标」 */
  goalName: string;
  /** 目标金额（元） */
  target: number;
  /** 每格金额（元） */
  cellValue: number;
  /** 开始日期 YYYY-MM-DD */
  startDate: string;
  theme: ThemeId;
  /** 每行几格，8~30。格子大小反过来由它决定（每行越多，格子越小） */
  cols: number;
}

/**
 * 一个攒钱目标。
 *
 * `Settings` 是「当前目标」的视图，`Goal` 是存起来的所有目标。
 * 切换目标时把 Goal 的内容搬进 Settings，视图层只认 Settings，不用到处改。
 */
export interface Goal {
  id: string;
  name: string;
  target: number;
  cellValue: number;
  startDate: string;
  cols: number;
}

export interface AppState {
  version: 2;
  /** 当前目标的设置（含全局的主题） */
  settings: Settings;
  /** 所有目标 */
  goals: Goal[];
  activeGoalId: string;
  /** 所有目标的存入都在这里，靠 goalId 区分 */
  deposits: Deposit[];
  notes: Note[];
  /** 已解锁的里程碑：`目标id:格数` -> 解锁日期 */
  unlocked: Record<string, string>;
}

export const DEFAULT_SETTINGS: Settings = {
  goalName: '2026目标',
  target: 100_000,
  cellValue: 500,
  startDate: todayStr(),
  theme: 'pink',
  cols: 20,
};

export const COLS_MIN = 8;
export const COLS_MAX = 30;

export function clampCols(n: unknown): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 20;
  return Math.min(COLS_MAX, Math.max(COLS_MIN, v));
}

/** 第一个目标的固定 id，迁移老数据时用它，保证每次加载结果一致 */
export const FIRST_GOAL_ID = 'g1';

export function goalFromSettings(id: string, s: Settings): Goal {
  return {
    id,
    name: s.goalName,
    target: s.target,
    cellValue: s.cellValue,
    startDate: s.startDate,
    cols: s.cols,
  };
}

/** 把目标摊回 Settings（主题是全局的，由调用方给） */
export function settingsOfGoal(g: Goal, theme: ThemeId): Settings {
  return {
    goalName: g.name,
    target: g.target,
    cellValue: g.cellValue,
    startDate: g.startDate,
    theme,
    cols: g.cols,
  };
}

export function emptyState(): AppState {
  const settings = { ...DEFAULT_SETTINGS };
  return {
    version: 2,
    settings,
    goals: [goalFromSettings(FIRST_GOAL_ID, settings)],
    activeGoalId: FIRST_GOAL_ID,
    deposits: [],
    notes: [],
    unlocked: {},
  };
}

/** 当前目标的存入 */
export function goalDeposits(state: AppState): Deposit[] {
  return state.deposits.filter((d) => d.goalId === state.activeGoalId);
}

/** 本地时区的 YYYY-MM-DD（不能用 toISOString，那是 UTC，跨时区会差一天） */
export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** 两个日期相差的天数（b - a，按自然日） */
export function daysBetween(a: string, b: string): number {
  const ms = parseDate(b).getTime() - parseDate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** 每格金额最小 0.01，避免除零 */
function safeCell(v: number): number {
  return v > 0 ? v : 1;
}

/** 一格多少钱 */
export function cellCost(settings: Settings): number {
  return safeCell(settings.cellValue);
}

/** 总格数 */
export function cellCount(settings: Settings): number {
  return Math.max(1, Math.round(settings.target / cellCost(settings)));
}

/** 已点亮的格子集合（超出总格数的脏数据直接忽略） */
export function litSet(state: AppState): Set<number> {
  const max = cellCount(state.settings);
  const set = new Set<number>();
  for (const d of goalDeposits(state)) {
    for (const c of d.cells) {
      if (Number.isInteger(c) && c >= 0 && c < max) set.add(c);
    }
  }
  return set;
}

export interface Derived {
  /** 已攒金额 */
  total: number;
  /** 总格数 */
  cells: number;
  /** 已点亮格数 */
  litCells: number;
  /** 剩余未点亮格数 */
  restCells: number;
  /** 距目标还差多少钱 */
  restAmount: number;
  /** 完成度 0..1 */
  progress: number;
  /** 已点亮的具体格子 */
  lit: Set<number>;
  /** 目标是否达成 */
  done: boolean;
  /** 存入笔数 */
  count: number;
  /** 最近一笔日期 */
  lastDate: string | null;
}

export function derive(state: AppState): Derived {
  const { target } = state.settings;
  const cells = cellCount(state.settings);
  const mine = goalDeposits(state);
  const total = mine.reduce((s, d) => s + d.amount, 0);
  const lit = litSet(state);
  const litCells = lit.size;
  const dates = mine.map((d) => d.date).sort();
  return {
    total,
    cells,
    litCells,
    restCells: Math.max(0, cells - litCells),
    restAmount: Math.max(0, target - total),
    progress: target > 0 ? Math.min(1, total / target) : 0,
    lit,
    done: total >= target,
    count: mine.length,
    lastDate: dates.length > 0 ? dates[dates.length - 1] : null,
  };
}

/**
 * 第 (col,row) 个格子的编号。
 *
 * 编号是阅读顺序：左上角 = 0，往右递增，一行满了换下一行。
 * 格子是独立点亮的，编号只需要稳定，不需要表达「点亮先后」。
 */
export function cellIndexAt(col: number, row: number, cols: number): number {
  return row * cols + col;
}

/**
 * 里程碑格数：第 1、10、50、100 格，之后每 100 格一个。
 * 只保留不超过总格数的。
 */
export function milestones(cells: number): number[] {
  const out = new Set<number>();
  for (const n of [1, 10, 50, 100]) if (n <= cells) out.add(n);
  for (let n = 200; n <= cells; n += 100) out.add(n);
  return [...out].sort((a, b) => a - b);
}

export interface MilestoneInfo {
  /** 格数 */
  n: number;
  /** 卡片正面的大字 */
  name: string;
  /** 解锁条件 */
  condition: string;
  /** 背面那句语录 */
  quote: string;
  /** 图标里点亮的方块数 1..4 */
  filled: number;
}

const QUOTES: Record<number, string> = {
  1: '0-1 与 1-100 同样重要',
  10: '十格是个信号：这件事你会继续做',
  50: '五十格。路走顺了，剩下只是重复',
  100: '一百格，半程。大多数人停在前十格',
  200: '两百格。回头看，第一天就在昨天',
};

export function milestoneInfo(n: number): MilestoneInfo {
  const filled = n >= 100 ? 4 : n >= 50 ? 3 : n >= 10 ? 2 : 1;
  return {
    n,
    name: n === 1 ? '第一格' : `第 ${n} 格`,
    condition: `点亮第 ${n} 格`,
    quote: QUOTES[n] ?? `第 ${n} 格。数字越大，越不用证明什么`,
    filled,
  };
}

/** 金额 -> 4.2万 / 1,234 这种展示文本 */
export function money(n: number): string {
  const v = Math.round(n * 100) / 100;
  if (Math.abs(v) >= 10_000) {
    const w = v / 10_000;
    return `${w >= 100 ? w.toFixed(0) : w.toFixed(2)}万`;
  }
  return v.toLocaleString('zh-CN');
}

/** 刻度/短标签用：不带尾随零，万以下带「元」。2.5万 / 5万 / 10万 / 500元 */
export function shortMoney(n: number): string {
  if (Math.abs(n) >= 10_000) {
    const w = n / 10_000;
    const t = w >= 100 ? w.toFixed(0) : w.toFixed(2).replace(/\.?0+$/, '');
    return `${t}万`;
  }
  return `${Math.round(n).toLocaleString('zh-CN')}元`;
}

/** 整数金额加千分位 */
export function yuan(n: number): string {
  return Math.round(n).toLocaleString('zh-CN');
}

export interface MonthBucket {
  /** YYYY-MM */
  key: string;
  label: string;
  total: number;
}

/** 按月汇总，从旧到新，只含有存入的月份 */
export function byMonth(deposits: readonly Deposit[]): MonthBucket[] {
  const map = new Map<string, number>();
  for (const d of deposits) {
    const key = d.date.slice(0, 7);
    map.set(key, (map.get(key) ?? 0) + d.amount);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, total]) => ({ key, label: `${Number(key.slice(5, 7))}月`, total }));
}

/** 最近 n 天每天存了多少 */
export function byDay(deposits: readonly Deposit[], n: number, today = todayStr()): number[] {
  const out = new Array<number>(n).fill(0);
  const base = parseDate(today).getTime();
  for (const d of deposits) {
    const diff = Math.round((base - parseDate(d.date).getTime()) / 86_400_000);
    if (diff >= 0 && diff < n) out[n - 1 - diff] += d.amount;
  }
  return out;
}

/** 连续打卡天数（含今天或昨天算连上） */
export function streakDays(deposits: readonly Deposit[], today = todayStr()): number {
  const days = new Set(deposits.map((d) => d.date));
  let streak = 0;
  const cursor = parseDate(today);
  // 今天还没打卡不算断，从昨天开始数
  if (!days.has(todayStr(cursor))) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const s = todayStr(cursor);
    if (!days.has(s)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface Forecast {
  /** 最近 30 天的日均存入 */
  perDay: number;
  /** 按当前速度还要多少天 */
  daysLeft: number | null;
  /** 预计达成日期 */
  eta: string | null;
}

/** 按最近 30 天的平均速度预测达成时间 */
export function forecast(state: AppState, d: Derived, today = todayStr()): Forecast {
  if (d.done) return { perDay: 0, daysLeft: 0, eta: today };
  const last30 = byDay(state.deposits, 30, today).reduce((a, b) => a + b, 0);
  const perDay = last30 / 30;
  if (perDay <= 0) return { perDay: 0, daysLeft: null, eta: null };
  const daysLeft = Math.ceil(d.restAmount / perDay);
  const etaDate = parseDate(today);
  etaDate.setDate(etaDate.getDate() + daysLeft);
  return { perDay, daysLeft, eta: todayStr(etaDate) };
}

/** 校验并修正从 localStorage / 导入文件读到的数据 */
export function sanitize(raw: unknown): AppState {
  const base = emptyState();
  if (typeof raw !== 'object' || raw === null) return base;
  const o = raw as Record<string, unknown>;
  const s = (o.settings ?? {}) as Record<string, unknown>;

  const num = (v: unknown, fb: number): number =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fb;

  const dateStr = (v: unknown, fb: string): string =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fb;

  const theme = (['pink', 'mint', 'sky', 'sand', 'violet', 'graphite'] as const).includes(s.theme as ThemeId)
    ? (s.theme as ThemeId)
    : base.settings.theme;

  // 目标列表：v2 有 goals，v1 只有一份 settings，按 v1 造一个目标
  const rawGoals = Array.isArray(o.goals) ? o.goals : [];
  const goals: Goal[] = [];
  for (const v of rawGoals) {
    const r = v as Record<string, unknown>;
    if (!r || typeof r !== 'object') continue;
    const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : uid();
    if (goals.some((g) => g.id === id)) continue;
    goals.push({
      id,
      name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : '我的目标',
      target: num(r.target, DEFAULT_SETTINGS.target),
      cellValue: num(r.cellValue, DEFAULT_SETTINGS.cellValue),
      startDate: dateStr(r.startDate, base.settings.startDate),
      cols: clampCols(r.cols),
    });
  }
  if (!goals.length) {
    goals.push(
      goalFromSettings(FIRST_GOAL_ID, {
        goalName: typeof s.goalName === 'string' && s.goalName.trim() ? s.goalName.trim() : base.settings.goalName,
        target: num(s.target, base.settings.target),
        cellValue: num(s.cellValue, base.settings.cellValue),
        startDate: dateStr(s.startDate, base.settings.startDate),
        theme,
        cols: clampCols(s.cols),
      }),
    );
  }

  base.goals = goals;
  const activeId = typeof o.activeGoalId === 'string' && goals.some((g) => g.id === o.activeGoalId)
    ? o.activeGoalId
    : goals[0].id;
  base.activeGoalId = activeId;
  base.settings = settingsOfGoal(goals.find((g) => g.id === activeId)!, theme);

  const ds = Array.isArray(o.deposits) ? o.deposits : [];
  const hadCellsField = ds.some((v) => {
    const r = v as Record<string, unknown>;
    return r !== null && typeof r === 'object' && 'cells' in r;
  });

  base.deposits = ds
    .map((v): Deposit | null => {
      const r = v as Record<string, unknown>;
      if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return null;
      const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) ? r.amount : 0;
      if (amount <= 0) return null;
      return {
        id: typeof r.id === 'string' ? r.id : uid(),
        date: r.date,
        amount,
        note: typeof r.note === 'string' ? r.note : '',
        createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
        cells: Array.isArray(r.cells)
          ? [...new Set(r.cells.filter((c): c is number => typeof c === 'number' && Number.isInteger(c) && c >= 0))]
          : [],
        // 老数据没有 goalId，全归到第一个目标
        goalId:
          typeof r.goalId === 'string' && goals.some((g) => g.id === r.goalId)
            ? r.goalId
            : goals[0].id,
      };
    })
    .filter((v): v is Deposit => v !== null);

  const us = (o.unlocked ?? {}) as Record<string, unknown>;
  base.unlocked = {};
  for (const [k, v] of Object.entries(us)) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) continue;
    // v1 的键是纯数字（当时只有一个目标），归到迁移出来的那个目标
    if (/^\d+$/.test(k)) {
      base.unlocked[`${goals[0].id}:${k}`] = v;
      continue;
    }
    const m = /^([^:]+):(\d+)$/.exec(k);
    if (m && goals.some((g) => g.id === m[1])) base.unlocked[k] = v;
  }

  const ns = Array.isArray(o.notes) ? o.notes : [];
  base.notes = ns
    .map((v): Note | null => {
      const r = v as Record<string, unknown>;
      if (typeof r.text !== 'string' || !r.text.trim()) return null;
      return {
        id: typeof r.id === 'string' ? r.id : uid(),
        text: r.text,
        createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
        pinned: r.pinned === true,
      };
    })
    .filter((v): v is Note => v !== null);

  // 老数据（格子前缀那套）根本没有 cells 字段：按金额从阅读顺序补上，
  // 否则升级后会出现「攒了 8 万却一格没亮」。用户主动清空过就是空数组，不补。
  if (!hadCellsField) migrateLegacyCells(base);

  return base;
}

function migrateLegacyCells(state: AppState): void {
  const mine = goalDeposits(state);
  if (mine.length === 0) return;
  const max = cellCount(state.settings);
  const value = cellCost(state.settings);
  let cursor = 0;
  const ordered = [...mine].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt,
  );
  for (const d of ordered) {
    const n = Math.floor(d.amount / value);
    for (let k = 0; k < n && cursor < max; k++) d.cells.push(cursor++);
  }
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

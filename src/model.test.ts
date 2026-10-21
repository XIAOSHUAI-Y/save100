import { describe, expect, it } from 'vitest';
import {
  type AppState,
  type Deposit,
  byDay,
  byMonth,
  cellCount,
  cellIndexAt,
  derive,
  emptyState,
  forecast,
  litSet,
  money,
  sanitize,
  streakDays,
  todayStr,
} from './model';

/** 造一笔带格子的存入 */
function dep(date: string, amount: number, cells: number[] = []): Deposit {
  return { id: `d${date}${amount}${cells.join('')}`, date, amount, note: '', createdAt: 0, cells };
}

function withDeposits(list: Deposit[]): AppState {
  const s = emptyState();
  s.deposits = list;
  return s;
}

describe('derive（方格独立点亮）', () => {
  it('200 格 × 500 元 = 10 万，攒 8.4 万时亮 168 格、剩 32 格', () => {
    const cells = Array.from({ length: 168 }, (_, i) => i);
    const s = withDeposits([dep('2026-01-05', 84_000, cells)]);
    const d = derive(s);
    expect(d.cells).toBe(200);
    expect(d.litCells).toBe(168);
    expect(d.restCells).toBe(32);
    expect(d.restAmount).toBe(16_000);
    expect(d.progress).toBeCloseTo(0.84);
    expect(d.done).toBe(false);
  });

  it('点哪格亮哪格：只亮第 7 格，不代表前 7 格都亮', () => {
    const s = withDeposits([dep('2026-01-05', 500, [7])]);
    const d = derive(s);
    expect(d.litCells).toBe(1);
    expect(d.lit.has(7)).toBe(true);
    expect(d.lit.has(0)).toBe(false);
    expect(d.lit.has(6)).toBe(false);
  });

  it('没点亮格子的存入照样算钱', () => {
    const s = withDeposits([dep('2026-01-05', 3_000)]);
    const d = derive(s);
    expect(d.total).toBe(3_000);
    expect(d.litCells).toBe(0);
  });

  it('多笔并存，格子取并集，重复格不重复计数', () => {
    const s = withDeposits([
      dep('2026-01-01', 1_000, [0, 1]),
      dep('2026-01-02', 1_000, [1, 2]),
    ]);
    const d = derive(s);
    expect(d.litCells).toBe(3);
    expect(d.total).toBe(2_000);
  });

  it('超出总格数的脏格子被忽略', () => {
    const s = withDeposits([dep('2026-01-05', 500, [999])]);
    expect(derive(s).litCells).toBe(0);
    expect(litSet(s).size).toBe(0);
  });

  it('没有存入时全是 0，不会算出 NaN', () => {
    const d = derive(emptyState());
    expect(d.total).toBe(0);
    expect(d.litCells).toBe(0);
    expect(d.progress).toBe(0);
    expect(Number.isNaN(d.progress)).toBe(false);
  });

  it('改每格面值后总格数跟着变', () => {
    const s = emptyState();
    s.settings.cellValue = 1000;
    expect(cellCount(s.settings)).toBe(100);
    s.settings.cellValue = 300;
    expect(cellCount(s.settings)).toBe(333);
  });
});

describe('cellIndexAt', () => {
  it('阅读顺序：左上角是第 0 格', () => {
    expect(cellIndexAt(0, 0, 20)).toBe(0);
    expect(cellIndexAt(19, 0, 20)).toBe(19);
    expect(cellIndexAt(0, 1, 20)).toBe(20);
    expect(cellIndexAt(19, 9, 20)).toBe(199);
  });
});

describe('byMonth / byDay / streakDays', () => {
  it('按月汇总并按时间排序', () => {
    const s = withDeposits([
      dep('2026-03-02', 500),
      dep('2026-01-10', 1000),
      dep('2026-01-20', 500),
    ]);
    expect(byMonth(s.deposits)).toEqual([
      { key: '2026-01', label: '1月', total: 1500 },
      { key: '2026-03', label: '3月', total: 500 },
    ]);
  });

  it('byDay 只统计窗口内的天数', () => {
    const days = byDay(withDeposits([dep('2026-01-10', 500)]).deposits, 3, '2026-01-10');
    expect(days).toEqual([0, 0, 500]);
  });

  it('连续打卡：今天没打但昨天打了，仍算连上', () => {
    expect(streakDays(withDeposits([
      dep('2026-01-08', 100),
      dep('2026-01-09', 100),
    ]).deposits, '2026-01-10')).toBe(2);
    expect(streakDays(withDeposits([
      dep('2026-01-10', 100),
      dep('2026-01-09', 100),
    ]).deposits, '2026-01-10')).toBe(2);
    expect(streakDays(withDeposits([dep('2026-01-01', 100)]).deposits, '2026-01-10')).toBe(0);
  });
});

describe('forecast', () => {
  it('没有近期存入时不给预测', () => {
    const s = withDeposits([dep('2025-01-01', 500)]);
    const f = forecast(s, derive(s), '2026-01-10');
    expect(f.perDay).toBe(0);
    expect(f.daysLeft).toBeNull();
    expect(f.eta).toBeNull();
  });

  it('按最近 30 天日均速度推算剩余天数', () => {
    const list: Deposit[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 0, 10);
      d.setDate(d.getDate() - i);
      list.push(dep(todayStr(d), 100));
    }
    const s = withDeposits(list);
    const f = forecast(s, derive(s), '2026-01-10');
    expect(f.perDay).toBeCloseTo(100);
    expect(f.daysLeft).toBe(970);
    expect(f.eta).toBe('2028-09-06');
  });

  it('已达成时直接返回今天', () => {
    const s = withDeposits([dep('2026-01-01', 200_000)]);
    const f = forecast(s, derive(s), '2026-01-10');
    expect(f.daysLeft).toBe(0);
    expect(f.eta).toBe('2026-01-10');
  });
});

describe('sanitize', () => {
  it('丢掉脏数据并补齐缺省值', () => {
    const s = sanitize({
      settings: { target: -1, cellValue: 'x', theme: 'nope' },
      deposits: [
        { date: '2026-01-01', amount: 500, cells: [3] },
        { date: 'bad', amount: 500 },
        { date: '2026-01-02', amount: -3 },
      ],
      notes: [{ text: '  ' }, { text: '打卡' }],
    });
    expect(s.settings.target).toBe(100_000);
    expect(s.settings.cellValue).toBe(500);
    expect(s.settings.theme).toBe('pink');
    expect(s.deposits).toHaveLength(1);
    expect(s.deposits[0].cells).toEqual([3]);
    expect(s.notes).toHaveLength(1);
    expect(s.notes[0].text).toBe('打卡');
  });

  it('老数据没有 cells 字段时按金额补点亮格，不让钱白攒', () => {
    const s = sanitize({
      settings: { target: 100_000, cellValue: 500 },
      deposits: [
        { date: '2026-01-01', amount: 1_500 },
        { date: '2026-01-02', amount: 1_000 },
      ],
    });
    expect(derive(s).litCells).toBe(5);
    expect(derive(s).total).toBe(2_500);
  });

  it('用户主动清空过格子（cells: []）就不要自动补', () => {
    const s = sanitize({
      settings: { target: 100_000, cellValue: 500 },
      deposits: [{ date: '2026-01-01', amount: 1_500, cells: [] }],
    });
    expect(derive(s).litCells).toBe(0);
    expect(derive(s).total).toBe(1_500);
  });

  it('非对象输入返回空状态', () => {
    expect(sanitize(null).deposits).toEqual([]);
    expect(sanitize('x').settings.target).toBe(100_000);
  });
});

describe('money', () => {
  it('万元以上折成万', () => {
    expect(money(84_000)).toBe('8.40万');
    expect(money(100_000)).toBe('10.00万');
    expect(money(1_000_000)).toBe('100万');
    expect(money(1_234)).toBe('1,234');
  });
});

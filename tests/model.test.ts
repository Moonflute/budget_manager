import { describe, expect, it } from 'vitest';
import { balances, demoData, emptyData, makeBackup, monthlyFlow, parseBackup, project, shiftMonth, takeSnapshot, validateData } from '../src/model';

function plan() {
  const data = emptyData();
  data.assets = [{ id: 'cash', kind: 'cash', name: '현금', amount: 10_000_000 }];
  data.flows = [
    { id: 'income', name: '월급', kind: 'income', amount: 3_000_000 },
    { id: 'expense', name: '생활비', kind: 'expense', amount: 1_800_000 },
    { id: 'saving', name: '적금', kind: 'saving', amount: 700_000 },
    { id: 'investment', name: '투자', kind: 'investment', amount: 300_000 },
  ];
  return data;
}
describe('financial projection', () => {
  it('counts contributions as transfers and retains 1.2 million net gain', () => {
    const data = plan();
    expect(monthlyFlow(data)).toMatchObject({ cash: 200_000, surplus: 1_200_000 });
    expect(project(data, 1, {}, '2026-12')[1]).toMatchObject({ month: '2027-01', cash: 10_200_000, savings: 700_000, investment: 300_000, net: 11_200_000 });
    expect(project(data, 12, {}, '2026-12')[12].net).toBe(24_400_000);
  });
  it('extra investment shifts cash, without inventing net assets', () => {
    const base = project(plan(), 12);
    const changed = project(plan(), 12, { extraInvestment: 500_000 });
    expect(changed[12].net).toBe(base[12].net);
    expect(changed[12].cash).toBe(base[12].cash - 6_000_000);
  });
  it('expense reduction increases net assets, capped at actual expense', () => {
    const base = project(plan(), 12)[12];
    const changed = project(plan(), 12, { expenseReduction: 200_000 })[12];
    expect(changed.net - base.net).toBe(2_400_000);
    expect(project(plan(), 1, { expenseReduction: 99_000_000 })[1].net).toBe(13_000_000);
  });
  it('uses monthly compound return then adds month-end contributions', () => {
    const data = emptyData();
    data.assets = [{ id: 'i', name: '투자', kind: 'investment', amount: 10_000_000 }];
    data.assumptions.investmentRate = 12;
    expect(project(data, 12)[12].net).toBeCloseTo(11_200_000, -1);
    data.flows = [{ id: 'add', name: '투자', kind: 'investment', amount: 1_000_000 }];
    const first = project(data, 1)[1];
    expect(first.investment).toBe(Math.round(10_000_000 * Math.pow(1.12, 1 / 12) + 1_000_000));
    expect(first.cash).toBe(-1_000_000);
  });
  it('handles a total investment loss without NaN', () => {
    const data = demoData();
    const first = project(data, 2, { investmentRate: -100 })[1];
    expect(first.investment).toBe(600_000);
    expect(Number.isFinite(first.net)).toBe(true);
  });
  it('applies a dated event once, never retroactively', () => {
    const data = plan();
    data.events = [
      { id: 'old', name: '현재까지 반영한 비용', month: '2026-11', kind: 'expense', amount: 1_000_000 },
      { id: 'trip', name: '여행', month: '2027-01', kind: 'expense', amount: 2_000_000 },
      { id: 'bonus', name: '성과급', month: '2027-01', kind: 'income', amount: 500_000 },
    ];
    const points = project(data, 14, {}, '2026-11');
    expect(points[1].net).toBe(11_200_000);
    expect(points[2].net).toBe(10_900_000);
    expect(points[14].net).toBe(10_000_000 + 14 * 1_200_000 - 1_500_000);
  });
  it('retains debt and reports negative cash without automatic borrowing', () => {
    const data = plan();
    data.assets = [{ id: 'debt', name: '대출', kind: 'debt', amount: 5_000_000 }];
    const points = project(data, 1, { extraInvestment: 1_000_000 });
    expect(points[1].cash).toBe(-800_000);
    expect(points[1].debt).toBe(5_000_000);
    expect(points[1].net).toBe(-3_800_000);
  });
  it('does not mutate inputs and snapshots capture actual balances', () => {
    const data = plan(), before = structuredClone(data);
    project(data, 120);
    expect(data).toEqual(before);
    expect(takeSnapshot(data, '2026-11')).toMatchObject({ month: '2026-11', cash: 10_000_000, income: 3_000_000, expense: 1_800_000 });
    expect(balances(data.assets).net).toBe(10_000_000);
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});
describe('portable backup validation', () => {
  it('round trips all user records and assumptions', () => {
    const data = demoData();
    expect(parseBackup(makeBackup(data))).toEqual(data);
  });
  it('rejects invalid, foreign, too large, and future-version data', () => {
    expect(() => parseBackup('not-json')).toThrow();
    expect(() => parseBackup('{"app":"other"}')).toThrow();
    expect(() => parseBackup(' '.repeat(2_000_001))).toThrow();
    expect(() => validateData({ ...emptyData(), version: 2 })).toThrow();
  });
  it('rejects invalid amounts, rates, IDs and dates instead of corrupting local data', () => {
    const data = plan();
    expect(() => validateData({ ...data, assets: [{ ...data.assets[0], amount: -1 }] })).toThrow();
    expect(() => validateData({ ...data, assets: [{ ...data.assets[0], amount: 1.5 }] })).toThrow();
    expect(() => validateData({ ...data, assets: [data.assets[0], data.assets[0]] })).toThrow();
    expect(() => validateData({ ...data, assumptions: { ...data.assumptions, investmentRate: -101 } })).toThrow();
    expect(() => validateData({ ...data, events: [{ id: 'x', name: 'x', month: '2026-13', kind: 'income', amount: 1 }] })).toThrow();
  });
});

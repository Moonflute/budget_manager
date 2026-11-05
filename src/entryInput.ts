import { currentMonth, shiftMonth, uid, validMonth, validateInstallmentTerms, type Asset, type AssetKind, type Flow, type FlowKind, type InvestmentAccount, type InvestmentProduct, type PlannedEvent } from './model';

export type EntryMode = 'asset' | 'flow' | 'event';
export type Entry = Asset | Flow | PlannedEvent;
export type PreparedEntry =
  | { mode: 'asset'; entry: Asset }
  | { mode: 'flow'; entry: Flow }
  | { mode: 'event'; entry: PlannedEvent };

export interface EntryInput {
  name: string;
  value: string;
  month?: string;
  installment?: { termMonths: string; annualRate: string };
  investment?: { product: InvestmentProduct | ''; account: InvestmentAccount | ''; monthlyBuy?: string };
}

export const maxManWon = 1_000_000_000;

export function amountInWon(value: string, min = 0): number | null {
  const amount = Number(value);
  if (!value.trim() || !Number.isFinite(amount) || amount < min || amount > maxManWon) return null;
  return Math.round(amount * 10_000);
}

export function prepareEntry(mode: EntryMode, kind: string, input: EntryInput, id: string = uid()): PreparedEntry {
  const name = input.name.trim();
  if (!name || name.length > 40) throw new Error('항목 이름을 1~40자로 입력해 주세요.');
  const amount = amountInWon(input.value);
  if (amount === null) throw new Error('0 이상의 유효한 금액을 입력해 주세요.');
  const common = { id, name, amount };

  if (mode === 'event') {
    const month = validMonth(input.month);
    const now = currentMonth();
    if (kind === 'expense' && (month < shiftMonth(now, 1) || month > shiftMonth(now, 120))) {
      throw new Error('예정 지출 월은 다음 달부터 10년 이내로 선택해 주세요.');
    }
    return { mode, entry: { ...common, month, kind: kind as PlannedEvent['kind'] } };
  }

  if (mode === 'asset') {
    const entry: Asset = { ...common, kind: kind as AssetKind };
    if (kind === 'investment' && input.investment) {
      const { product, account, monthlyBuy: value } = input.investment;
      const monthlyBuy = value === undefined ? 0 : amountInWon(value);
      if (monthlyBuy === null) throw new Error('월 매수액을 확인해 주세요.');
      entry.investment = { product: product || null, account: account || null, monthlyBuy };
    }
    return { mode, entry };
  }

  const entry: Flow = { ...common, kind: kind as FlowKind };
  if (kind === 'saving' && input.installment) {
    entry.installment = validateInstallmentTerms({
      termMonths: Number(input.installment.termMonths),
      annualRate: input.installment.annualRate.trim() ? Number(input.installment.annualRate) : NaN,
    });
  }
  return { mode, entry };
}

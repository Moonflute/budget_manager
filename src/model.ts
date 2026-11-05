export type AssetKind = 'cash' | 'savings' | 'investment' | 'debt';
export type FlowKind = 'income' | 'expense' | 'saving' | 'investment';
export const investmentProductLabels = { stock: '주식', etf: 'ETF', bond: '채권', fund: '펀드', other: '기타' } as const;
export const investmentAccountLabels = { general: '일반 계좌', isa: 'ISA', pension: '연금저축', irp: 'IRP', other: '기타' } as const;
export type InvestmentProduct = keyof typeof investmentProductLabels;
export type InvestmentAccount = keyof typeof investmentAccountLabels;
export interface InvestmentDetails {
  product: InvestmentProduct | null;
  account: InvestmentAccount | null;
  monthlyBuy: number;
}
export interface Asset { id: string; name: string; kind: AssetKind; amount: number; investment?: InvestmentDetails }
export interface InstallmentTerms { termMonths: number; annualRate: number }
export interface Flow { id: string; name: string; kind: FlowKind; amount: number; installment?: InstallmentTerms }
export interface PlannedEvent { id: string; name: string; month: string; kind: 'income' | 'expense'; amount: number }
export interface Snapshot { id: string; month: string; recordedAt: string; cash: number; savings: number; investment: number; debt: number; income: number; expense: number }
export interface BudgetData {
  version: 1;
  assets: Asset[];
  flows: Flow[];
  events: PlannedEvent[];
  history: Snapshot[];
  assumptions: { savingsRate: number; investmentRate: number; target: number };
  updatedAt: string | null;
  lastBackupAt: string | null;
}
export interface Balances { cash: number; savings: number; investment: number; debt: number; total: number; net: number }
export interface MonthlyFlow { income: number; expense: number; saving: number; investment: number; surplus: number; cash: number }
export interface ProjectionPoint extends Balances { month: string; step: number }
export interface Scenario { expenseReduction?: number; extraInvestment?: number; investmentRate?: number }

export const assetLabels: Record<AssetKind, string> = { cash: '현금·입출금', savings: '예금·적금', investment: '투자', debt: '부채' };
export const flowLabels: Record<FlowKind, string> = { income: '수입', expense: '생활 지출', saving: '저축', investment: '투자' };
export const uid = () => crypto.randomUUID();
export function currentMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
export function shiftMonth(month: string, offset: number): string {
  const [year, mon] = month.split('-').map(Number);
  const date = new Date(year, mon - 1 + offset, 1);
  return currentMonth(date);
}
export function monthLabel(month: string): string {
  const [year, mon] = month.split('-');
  return `${year}년 ${Number(mon)}월`;
}
export function money(value: number): string {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}
export function compactMoney(value: number): string {
  const sign = value < 0 ? '−' : '';
  const n = Math.abs(value);
  if (n >= 100_000_000) return `${sign}${(n / 100_000_000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}억`;
  if (n >= 10_000) return `${sign}${(n / 10_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만`;
  return `${sign}${Math.round(n).toLocaleString('ko-KR')}`;
}
export function balances(assets: Asset[]): Balances {
  const result = { cash: 0, savings: 0, investment: 0, debt: 0, total: 0, net: 0 };
  for (const a of assets) result[a.kind] += a.amount;
  result.total = result.cash + result.savings + result.investment;
  result.net = result.total - result.debt;
  return result;
}
export function monthlyFlow({ flows, assets }: Pick<BudgetData, 'flows' | 'assets'>): MonthlyFlow {
  const result = { income: 0, expense: 0, saving: 0, investment: 0, surplus: 0, cash: 0 };
  for (const f of flows) result[f.kind] += f.amount;
  for (const asset of assets) {
    if (asset.kind === 'investment') result.investment += asset.investment?.monthlyBuy ?? 0;
  }
  result.surplus = result.income - result.expense;
  result.cash = result.surplus - result.saving - result.investment;
  return result;
}

export function flowsForMonth({ flows, events }: Pick<BudgetData, 'flows' | 'events'>, month: string): Flow[] {
  return [...flows, ...events.filter(event => event.month === month)];
}

// Each step is the end of the NEXT month. Opening balances already represent now.
// Contributions occur at month end; transfers change allocation, not net worth.
export function project(data: BudgetData, months: number, scenario: Scenario = {}, start = currentMonth()): ProjectionPoint[] {
  const b = balances(data.assets);
  const flow = monthlyFlow(data);
  const reduction = Math.min(Math.max(scenario.expenseReduction ?? 0, 0), flow.expense);
  const extraInvestment = Math.max(scenario.extraInvestment ?? 0, 0);
  const savingsMonthlyRate = Math.pow(1 + data.assumptions.savingsRate / 100, 1 / 12) - 1;
  const investmentMonthlyRate = Math.pow(1 + (scenario.investmentRate ?? data.assumptions.investmentRate) / 100, 1 / 12) - 1;
  const points: ProjectionPoint[] = [{ ...b, month: start, step: 0 }];
  for (let step = 1; step <= months; step++) {
    const month = shiftMonth(start, step);
    b.cash += flow.cash + reduction - extraInvestment;
    b.savings = Math.round(b.savings * (1 + savingsMonthlyRate) + flow.saving);
    b.investment = Math.round(b.investment * (1 + investmentMonthlyRate) + flow.investment + extraInvestment);
    for (const event of data.events) {
      if (event.month === month) b.cash += event.kind === 'income' ? event.amount : -event.amount;
    }
    b.total = b.cash + b.savings + b.investment;
    b.net = b.total - b.debt;
    points.push({ ...b, month, step });
  }
  return points;
}

export function takeSnapshot(data: BudgetData, month = currentMonth()): Snapshot {
  const b = balances(data.assets);
  const f = monthlyFlow({ assets: data.assets, flows: flowsForMonth(data, month) });
  return { id: uid(), month, recordedAt: new Date().toISOString(), cash: b.cash, savings: b.savings, investment: b.investment, debt: b.debt, income: f.income, expense: f.expense };
}

export function emptyData(): BudgetData {
  return { version: 1, assets: [], flows: [], events: [], history: [], assumptions: { savingsRate: 0, investmentRate: 0, target: 100_000_000 }, updatedAt: null, lastBackupAt: null };
}
export function demoData(): BudgetData {
  const d = emptyData();
  d.assets = [
    { id: 'demo-cash', name: '생활비 통장', kind: 'cash', amount: 4_200_000 },
    { id: 'demo-savings', name: '차곡차곡 적금', kind: 'savings', amount: 18_000_000 },
    { id: 'demo-emergency', name: '비상금 예금', kind: 'savings', amount: 10_000_000 },
    { id: 'demo-investment', name: '장기 투자', kind: 'investment', amount: 12_500_000 },
  ];
  d.flows = [
    { id: 'demo-income', name: '급여', kind: 'income', amount: 3_200_000 },
    { id: 'demo-side-income', name: '부수입', kind: 'income', amount: 300_000 },
    { id: 'demo-home', name: '주거·공과금', kind: 'expense', amount: 650_000 },
    { id: 'demo-food', name: '식비·생활비', kind: 'expense', amount: 650_000 },
    { id: 'demo-etc', name: '교통·구독', kind: 'expense', amount: 250_000 },
    { id: 'demo-save', name: '목표 저축', kind: 'saving', amount: 900_000 },
    { id: 'demo-invest', name: '매달 투자', kind: 'investment', amount: 600_000 },
  ];
  d.assumptions = { savingsRate: 2.5, investmentRate: 4, target: 100_000_000 };
  d.history = Array.from({ length: 6 }, (_, i) => ({ id: `demo-snapshot-${i}`, month: shiftMonth(currentMonth(), i - 5), recordedAt: new Date().toISOString(), cash: 4_200_000, savings: 23_500_000 + i * 900_000, investment: 9_500_000 + i * 600_000, debt: 0, income: 3_500_000, expense: 1_550_000 }));
  return d;
}

const maxAmount = 10_000_000_000_000;
function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('올바른 백업 데이터가 아니에요.');
  return value as Record<string, unknown>;
}
function str(value: unknown, max = 100): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('이름 또는 항목 ID를 확인해 주세요.');
  return value;
}
function amount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maxAmount) throw new Error('금액은 0 이상의 유효한 원 단위 숫자여야 해요.');
  return value;
}
function rate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -100 || value > 100) throw new Error('수익률은 −100%에서 100% 사이여야 해요.');
  return value;
}
export function validateInstallmentTerms(value: unknown): InstallmentTerms {
  const { termMonths, annualRate } = obj(value);
  if (typeof termMonths !== 'number' || !Number.isSafeInteger(termMonths) || termMonths < 1) throw new Error('적금 기간을 1개월 이상의 정수로 입력해 주세요.');
  if (typeof annualRate !== 'number' || !Number.isFinite(annualRate) || annualRate < 0 || annualRate > 100) throw new Error('적금 연이율은 0%에서 100% 사이여야 해요.');
  return { termMonths, annualRate };
}
function timestamp(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('백업의 날짜가 올바르지 않아요.');
  return value;
}
export function validMonth(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value < '1900-01' || value > '2200-12') throw new Error('월 형식이 올바르지 않아요.');
  return value;
}
function list<T extends { id: string }>(value: unknown, parse: (item: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(value) || value.length > 1000) throw new Error('백업 항목 수가 올바르지 않아요.');
  const result = value.map(item => parse(obj(item)));
  if (new Set(result.map(x => x.id)).size !== result.length) throw new Error('중복된 항목 ID가 있어요.');
  return result;
}
function kind<T extends string>(value: unknown, options: readonly T[]): T {
  if (!options.includes(value as T)) throw new Error('알 수 없는 항목 분류가 있어요.');
  return value as T;
}
export function validateData(value: unknown): BudgetData {
  const d = obj(value);
  if (d.version !== 1) throw new Error('지원하지 않는 백업 버전이에요.');
  const a = obj(d.assumptions);
  const history = list(d.history, h => ({ id: str(h.id), month: validMonth(h.month), recordedAt: timestamp(h.recordedAt) ?? new Date(0).toISOString(), cash: amount(h.cash), savings: amount(h.savings), investment: amount(h.investment), debt: amount(h.debt), income: amount(h.income), expense: amount(h.expense) }));
  if (new Set(history.map(h => h.month)).size !== history.length) throw new Error('같은 달의 기록이 여러 개 있어요.');
  return {
    version: 1,
    assets: list(d.assets, x => {
      const asset: Asset = { id: str(x.id), name: str(x.name, 40), kind: kind(x.kind, ['cash', 'savings', 'investment', 'debt'] as const), amount: amount(x.amount) };
      if (x.investment !== undefined) {
        if (asset.kind !== 'investment') throw new Error('투자 정보는 투자 자산에만 입력할 수 있어요.');
        const details = obj(x.investment);
        asset.investment = {
          product: details.product === null ? null : kind(details.product, Object.keys(investmentProductLabels) as InvestmentProduct[]),
          account: details.account === null ? null : kind(details.account, Object.keys(investmentAccountLabels) as InvestmentAccount[]),
          monthlyBuy: amount(details.monthlyBuy),
        };
      }
      return asset;
    }),
    flows: list(d.flows, x => {
      const flow: Flow = { id: str(x.id), name: str(x.name, 40), kind: kind(x.kind, ['income', 'expense', 'saving', 'investment'] as const), amount: amount(x.amount) };
      if (x.installment !== undefined) {
        if (flow.kind !== 'saving') throw new Error('적금 조건은 저축 항목에만 입력할 수 있어요.');
        flow.installment = validateInstallmentTerms(x.installment);
      }
      return flow;
    }),
    events: list(d.events, x => ({ id: str(x.id), name: str(x.name, 40), month: validMonth(x.month), kind: kind(x.kind, ['income', 'expense'] as const), amount: amount(x.amount) })),
    history,
    assumptions: { savingsRate: rate(a.savingsRate), investmentRate: rate(a.investmentRate), target: amount(a.target) },
    updatedAt: timestamp(d.updatedAt), lastBackupAt: timestamp(d.lastBackupAt),
  };
}
export function parseBackup(text: string): BudgetData {
  if (text.length > 2_000_000) throw new Error('백업 파일은 2MB 이하로 선택해 주세요.');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('JSON 백업 파일을 읽을 수 없어요.'); }
  const envelope = obj(parsed);
  if (envelope.app !== 'moa-budget-manager') throw new Error('Budget Manager에서 내보낸 백업 파일을 선택해 주세요.');
  return validateData(envelope.data);
}
export function makeBackup(data: BudgetData): string {
  return JSON.stringify({ app: 'moa-budget-manager', exportedAt: new Date().toISOString(), data: validateData(data) }, null, 2);
}

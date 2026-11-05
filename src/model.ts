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
export interface InstallmentTerms { termMonths: number; annualRate: number; startMonth?: string; assetId?: string }
export interface Flow { id: string; name: string; kind: FlowKind; amount: number; installment?: InstallmentTerms }
export interface PlannedEvent { id: string; name: string; month: string; kind: 'income' | 'expense'; amount: number }
export interface ImportedExpense { id: string; date: string; time: string; name: string; category: string; subcategory: string; amount: number }
export interface Snapshot { id: string; month: string; recordedAt: string; cash: number; savings: number; investment: number; debt: number; income: number; expense: number }
export interface BudgetData {
  version: 1;
  assets: Asset[];
  flows: Flow[];
  events: PlannedEvent[];
  importedExpenses: ImportedExpense[];
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
export function installmentActive(terms: InstallmentTerms, month: string): boolean {
  return !terms.startMonth || (month >= terms.startMonth && month < shiftMonth(terms.startMonth, terms.termMonths));
}

export function monthlyFlow({ flows, assets }: Pick<BudgetData, 'flows' | 'assets'>, month?: string): MonthlyFlow {
  const result = { income: 0, expense: 0, saving: 0, investment: 0, surplus: 0, cash: 0 };
  for (const f of flows) {
    if (month && f.installment && !installmentActive(f.installment, month)) continue;
    result[f.kind] += f.amount;
  }
  for (const asset of assets) {
    if (asset.kind === 'investment') result.investment += asset.investment?.monthlyBuy ?? 0;
  }
  result.surplus = result.income - result.expense;
  result.cash = result.surplus - result.saving - result.investment;
  return result;
}

export function flowsForMonth({ flows, events }: Pick<BudgetData, 'flows' | 'events'>, month: string): Flow[] {
  return [
    ...flows.filter(flow => !flow.installment || installmentActive(flow.installment, month)),
    ...events.filter(event => event.month === month),
  ];
}

export function expenseGroups(expenses: ImportedExpense[], month?: string) {
  const groups = new Map<string, { name: string; amount: number; items: ImportedExpense[] }>();
  for (const expense of expenses) {
    if (month && expense.date.slice(0, 7) !== month) continue;
    let group = groups.get(expense.category);
    if (!group) {
      group = { name: expense.category, amount: 0, items: [] };
      groups.set(expense.category, group);
    }
    group.amount += expense.amount;
    group.items.push(expense);
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'ko'));
}

export function recordedFlowsForMonth(data: Pick<BudgetData, 'flows' | 'events' | 'importedExpenses'>, month: string): Flow[] {
  const plan = flowsForMonth(data, month);
  const groups = expenseGroups(data.importedExpenses ?? [], month);
  if (!groups.length) return plan;
  return [
    ...plan.filter(flow => flow.kind !== 'expense'),
    ...groups.map((group, index): Flow => ({ id: `imported-expense:${index}`, kind: 'expense', name: group.name, amount: group.amount })),
  ];
}

export function recentExpenseAverage(expenses: ImportedExpense[], before = currentMonth()) {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const month = expense.date.slice(0, 7);
    if (month >= before) continue;
    totals.set(month, (totals.get(month) ?? 0) + expense.amount);
  }
  const months = [...totals.keys()].sort().reverse().slice(0, 3);
  const amount = months.length ? Math.round(months.reduce((sum, month) => sum + totals.get(month)!, 0) / months.length) : 0;
  return { months, amount };
}

// Each step is the end of the NEXT month. Opening balances already represent now.
// General contributions occur at month end. Installments use month-start payments
// and simple interest earned after the opening balance, paid at maturity.
export function project(data: BudgetData, months: number, scenario: Scenario = {}, start = currentMonth()): ProjectionPoint[] {
  const b = balances(data.assets);
  const reduction = Math.min(Math.max(scenario.expenseReduction ?? 0, 0), monthlyFlow(data).expense);
  const extraInvestment = Math.max(scenario.extraInvestment ?? 0, 0);
  const savingsMonthlyRate = Math.pow(1 + data.assumptions.savingsRate / 100, 1 / 12) - 1;
  const investmentMonthlyRate = Math.pow(1 + (scenario.investmentRate ?? data.assumptions.investmentRate) / 100, 1 / 12) - 1;
  const points: ProjectionPoint[] = [{ ...b, month: start, step: 0 }];
  const installments = data.flows.flatMap(flow => {
    const terms = flow.installment;
    if (!terms?.startMonth) return [];
    const maturity = shiftMonth(terms.startMonth, terms.termMonths);
    if (maturity <= start) return [];
    const asset = data.assets.find(asset => asset.id === terms.assetId && asset.kind === 'savings');
    return [{ flow, terms, maturity, principal: asset?.amount ?? 0, interest: 0 }];
  });
  let ordinarySavings = b.savings - installments.reduce((sum, plan) => sum + plan.principal, 0);
  for (let step = 1; step <= months; step++) {
    const month = shiftMonth(start, step);
    const flow = monthlyFlow({ assets: data.assets, flows: flowsForMonth(data, month) });
    b.cash += flow.cash + reduction - extraInvestment;
    let installmentPayments = 0;
    for (const plan of installments) {
      if (month === plan.maturity) {
        b.cash += plan.principal + Math.round(plan.interest);
        plan.principal = 0;
        plan.interest = 0;
      } else if (installmentActive(plan.terms, month)) {
        installmentPayments += plan.flow.amount;
        plan.principal += plan.flow.amount;
        plan.interest += plan.principal * plan.terms.annualRate / 1200;
      }
    }
    ordinarySavings = Math.round(ordinarySavings * (1 + savingsMonthlyRate) + flow.saving - installmentPayments);
    b.savings = ordinarySavings + installments.reduce((sum, plan) => sum + plan.principal, 0);
    b.investment = Math.round(b.investment * (1 + investmentMonthlyRate) + flow.investment + extraInvestment);
    b.total = b.cash + b.savings + b.investment;
    b.net = b.total - b.debt;
    points.push({ ...b, month, step });
  }
  return points;
}

export function takeSnapshot(data: BudgetData, month = currentMonth()): Snapshot {
  const b = balances(data.assets);
  const f = monthlyFlow({ assets: data.assets, flows: recordedFlowsForMonth(data, month) });
  return { id: uid(), month, recordedAt: new Date().toISOString(), cash: b.cash, savings: b.savings, investment: b.investment, debt: b.debt, income: f.income, expense: f.expense };
}

export function emptyData(): BudgetData {
  return { version: 1, assets: [], flows: [], events: [], importedExpenses: [], history: [], assumptions: { savingsRate: 0, investmentRate: 0, target: 100_000_000 }, updatedAt: null, lastBackupAt: null };
}
export function exampleFlows(): Flow[] {
  return [
    { id: 'demo-income', name: '급여', kind: 'income', amount: 3_200_000 },
    { id: 'demo-side-income', name: '부수입', kind: 'income', amount: 300_000 },
    { id: 'demo-home', name: '주거·공과금', kind: 'expense', amount: 650_000 },
    { id: 'demo-food', name: '식비·생활비', kind: 'expense', amount: 650_000 },
    { id: 'demo-etc', name: '교통·구독', kind: 'expense', amount: 250_000 },
    { id: 'demo-save', name: '목표 저축', kind: 'saving', amount: 900_000 },
    { id: 'demo-invest', name: '매달 투자', kind: 'investment', amount: 600_000 },
  ];
}
export function demoData(): BudgetData {
  const d = emptyData();
  d.assets = [
    { id: 'demo-cash', name: '생활비 통장', kind: 'cash', amount: 4_200_000 },
    { id: 'demo-savings', name: '차곡차곡 적금', kind: 'savings', amount: 18_000_000 },
    { id: 'demo-emergency', name: '비상금 예금', kind: 'savings', amount: 10_000_000 },
    { id: 'demo-investment', name: '장기 투자', kind: 'investment', amount: 12_500_000 },
  ];
  d.flows = exampleFlows();
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
  const { termMonths, annualRate, startMonth, assetId } = obj(value);
  if (typeof termMonths !== 'number' || !Number.isSafeInteger(termMonths) || termMonths < 1) throw new Error('적금 기간을 1개월 이상의 정수로 입력해 주세요.');
  if (typeof annualRate !== 'number' || !Number.isFinite(annualRate) || annualRate < 0 || annualRate > 100) throw new Error('적금 연이율은 0%에서 100% 사이여야 해요.');
  const terms: InstallmentTerms = { termMonths, annualRate };
  if (startMonth !== undefined) {
    terms.startMonth = validMonth(startMonth);
    validMonth(shiftMonth(terms.startMonth, termMonths));
  }
  if (assetId !== undefined) terms.assetId = str(assetId);
  return terms;
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
function list<T extends { id: string }>(value: unknown, parse: (item: Record<string, unknown>) => T, limit = 1000): T[] {
  if (!Array.isArray(value) || value.length > limit) throw new Error('백업 항목 수가 올바르지 않아요.');
  const result = value.map(item => parse(obj(item)));
  if (new Set(result.map(x => x.id)).size !== result.length) throw new Error('중복된 항목 ID가 있어요.');
  return result;
}
function kind<T extends string>(value: unknown, options: readonly T[]): T {
  if (!options.includes(value as T)) throw new Error('알 수 없는 항목 분류가 있어요.');
  return value as T;
}
export const maxImportedExpenses = 10_000;
export const maxBackupBytes = 10_000_000;

export function validateImportedExpense(value: unknown): ImportedExpense {
  const item = obj(value);
  const date = str(item.date, 10);
  const dateValue = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(dateValue.getTime()) || dateValue.toISOString().slice(0, 10) !== date) {
    throw new Error('지출일이 올바르지 않아요.');
  }
  validMonth(date.slice(0, 7));
  if (typeof item.time !== 'string' || (item.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time))) throw new Error('지출시간이 올바르지 않아요.');
  if (typeof item.subcategory !== 'string' || item.subcategory.length > 60) throw new Error('세부카테고리를 확인해 주세요.');
  const valueInWon = amount(item.amount);
  if (!valueInWon) throw new Error('지출금액이 올바르지 않아요.');
  return { id: str(item.id), date, time: item.time, name: str(item.name, 120).trim(), category: str(item.category, 60).trim(), subcategory: item.subcategory.trim(), amount: valueInWon };
}

export function newImportedExpenses(rows: ImportedExpense[], existing: ImportedExpense[]): ImportedExpense[] {
  const key = (row: ImportedExpense) => JSON.stringify([row.date, row.time, row.name, row.category, row.subcategory, row.amount]);
  const counts = new Map<string, number>();
  for (const row of existing) {
    const signature = key(row);
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }
  return rows.filter(row => {
    const signature = key(row);
    const count = counts.get(signature) ?? 0;
    if (!count) return true;
    counts.set(signature, count - 1);
    return false;
  });
}
export function validateData(value: unknown): BudgetData {
  const d = obj(value);
  if (d.version !== 1) throw new Error('지원하지 않는 백업 버전이에요.');
  const a = obj(d.assumptions);
  const history = list(d.history, h => ({ id: str(h.id), month: validMonth(h.month), recordedAt: timestamp(h.recordedAt) ?? new Date(0).toISOString(), cash: amount(h.cash), savings: amount(h.savings), investment: amount(h.investment), debt: amount(h.debt), income: amount(h.income), expense: amount(h.expense) }));
  if (new Set(history.map(h => h.month)).size !== history.length) throw new Error('같은 달의 기록이 여러 개 있어요.');
  const data: BudgetData = {
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
    importedExpenses: d.importedExpenses === undefined ? [] : list(d.importedExpenses, validateImportedExpense, maxImportedExpenses),
    history,
    assumptions: { savingsRate: rate(a.savingsRate), investmentRate: rate(a.investmentRate), target: amount(a.target) },
    updatedAt: timestamp(d.updatedAt), lastBackupAt: timestamp(d.lastBackupAt),
  };
  const linkedAssets = new Set<string>();
  for (const flow of data.flows) {
    const assetId = flow.installment?.assetId;
    if (!assetId) continue;
    if (!data.assets.some(asset => asset.id === assetId && asset.kind === 'savings')) throw new Error('적금에 연결할 예금·적금 자산을 확인해 주세요.');
    if (linkedAssets.has(assetId)) throw new Error('같은 자산을 여러 적금에 연결할 수 없어요.');
    linkedAssets.add(assetId);
  }
  return data;
}
export function parseBackup(text: string): BudgetData {
  if (text.length > maxBackupBytes) throw new Error('백업 파일은 10MB 이하로 선택해 주세요.');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('JSON 백업 파일을 읽을 수 없어요.'); }
  const envelope = obj(parsed);
  if (envelope.app !== 'moa-budget-manager') throw new Error('Budget Manager에서 내보낸 백업 파일을 선택해 주세요.');
  return validateData(envelope.data);
}
export function makeBackup(data: BudgetData): string {
  return JSON.stringify({ app: 'moa-budget-manager', exportedAt: new Date().toISOString(), data: validateData(data) }, null, 2);
}

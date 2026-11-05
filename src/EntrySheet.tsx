import { Fragment, useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { maxManWon, prepareEntry, type EntryMode, type PreparedEntry } from './entryInput';
import { assetLabels, currentMonth, flowLabels, investmentAccountLabels, investmentProductLabels, shiftMonth, uid, type Asset, type InvestmentAccount, type InvestmentProduct } from './model';

const categories = {
  'flow:income': { label: '정기 수입', mode: 'flow', kind: 'income', amount: '매달 금액' },
  'event:income': { label: '비정기 수입', mode: 'event', kind: 'income', amount: '수입 금액' },
  'flow:expense': { label: flowLabels.expense, mode: 'flow', kind: 'expense', amount: '매달 금액' },
  'event:expense': { label: '예정 지출', mode: 'event', kind: 'expense', amount: '예정 금액' },
  'flow:saving': { label: '일반 저축', mode: 'flow', kind: 'saving', amount: '매달 금액' },
  'flow:installment': { label: '적금', mode: 'flow', kind: 'saving', amount: '월 납입액' },
  'flow:investment': { label: '추가 투자 납입', mode: 'flow', kind: 'investment', amount: '매달 금액' },
  'asset:cash': { label: assetLabels.cash, mode: 'asset', kind: 'cash', amount: '현재 잔액' },
  'asset:savings': { label: assetLabels.savings, mode: 'asset', kind: 'savings', amount: '현재 잔액' },
  'asset:investment': { label: '투자 포트폴리오', mode: 'asset', kind: 'investment', amount: '현재 평가액' },
  'asset:debt': { label: assetLabels.debt, mode: 'asset', kind: 'debt', amount: '남은 원금' },
} as const;

export type EntryCategory = keyof typeof categories;

export function entryCategory(mode: EntryMode, kind?: string): EntryCategory {
  const fallback = { asset: 'asset:cash', flow: 'flow:income', event: 'event:expense' } as const;
  const key = `${mode}:${kind}`;
  return Object.hasOwn(categories, key) ? key as EntryCategory : fallback[mode];
}

interface DraftRow {
  id: string;
  name: string;
  value: string;
  month: string;
  termMonths: string;
  annualRate: string;
  startMonth: string;
  assetId: string;
  product: InvestmentProduct | '';
  account: InvestmentAccount | '';
  monthlyBuy: string;
  loanRate: string;
  monthlyPayment: string;
}

function emptyRow(category: EntryCategory, month: string): DraftRow {
  return {
    id: uid(), name: '', value: '', termMonths: '', annualRate: '', startMonth: month, assetId: '', product: '', account: '', monthlyBuy: '', loanRate: '', monthlyPayment: '',
    month: category === 'event:expense' && month <= currentMonth() ? shiftMonth(currentMonth(), 1) : month,
  };
}

function hasInput(row: DraftRow): boolean {
  return Boolean(row.name.trim() || row.value || row.termMonths || row.annualRate || row.product || row.account || row.monthlyBuy || row.loanRate || row.monthlyPayment);
}

export function EntrySheet({ initialCategory, initialMonth, assets, save, busy }: { initialCategory: EntryCategory; initialMonth: string; assets: Asset[]; save: (entries: PreparedEntry[]) => Promise<boolean>; busy: boolean }) {
  const [category, setCategory] = useState(initialCategory);
  const [drafts, setDrafts] = useState<Partial<Record<EntryCategory, DraftRow[]>>>(() => ({ [initialCategory]: [emptyRow(initialCategory, initialMonth)] }));
  const [error, setError] = useState('');
  const rows = drafts[category] ?? [];
  const fields = categories[category];
  const pending = Object.values(drafts).reduce((count, items) => count + (items?.filter(hasInput).length ?? 0), 0);
  const hasMonth = fields.mode === 'event';
  const hasInstallment = category === 'flow:installment';
  const hasPortfolio = category === 'asset:investment';
  const hasLoan = category === 'asset:debt';

  function changeCategory(next: EntryCategory) {
    if (!drafts[next]) setDrafts(previous => ({ ...previous, [next]: [emptyRow(next, initialMonth)] }));
    setCategory(next);
    setError('');
  }

  function updateRow(id: string, change: Partial<DraftRow>) {
    setDrafts(previous => ({ ...previous, [category]: (previous[category] ?? []).map(row => row.id === id ? { ...row, ...change } : row) }));
    setError('');
  }

  function removeRow(id: string) {
    const remaining = rows.filter(row => row.id !== id);
    setDrafts(previous => ({ ...previous, [category]: remaining.length ? remaining : [emptyRow(category, initialMonth)] }));
    setError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !pending) return;
    const entries: PreparedEntry[] = [];
    for (const key of Object.keys(drafts) as EntryCategory[]) {
      const definition = categories[key];
      for (const [index, row] of (drafts[key] ?? []).entries()) {
        if (!hasInput(row)) continue;
        try {
          entries.push(prepareEntry(definition.mode, definition.kind, {
            name: row.name,
            value: row.value,
            month: row.month,
            installment: key === 'flow:installment' ? { termMonths: row.termMonths, annualRate: row.annualRate, startMonth: row.startMonth, assetId: row.assetId } : undefined,
            investment: key === 'asset:investment' ? { product: row.product, account: row.account, monthlyBuy: row.monthlyBuy || undefined } : undefined,
            loan: key === 'asset:debt' ? { annualRate: row.loanRate, monthlyPayment: row.monthlyPayment } : undefined,
          }, row.id));
        } catch (problem) {
          setCategory(key);
          setError(`${index + 1}행 · ${problem instanceof Error ? problem.message : '입력값을 확인해 주세요.'}`);
          return;
        }
      }
    }
    if (!await save(entries)) setError('저장하지 못했어요.');
  }

  return (
    <form className="entry-form entry-sheet" onSubmit={submit} noValidate>
      <fieldset disabled={busy}>
        <label className="entry-sheet-category">
          분류
          <select aria-label="분류" value={category} onChange={event => changeCategory(event.target.value as EntryCategory)}>
            {Object.entries(categories).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
        </label>
        <table aria-label={`${fields.label} 입력 표`}>
          <colgroup><col /><col className="entry-sheet-amount" /><col className="entry-sheet-control" /></colgroup>
          <thead>
            <tr><th scope="col">항목 이름</th><th scope="col">{fields.amount} (만 원)</th><th scope="col" aria-label="행 삭제" /></tr>
          </thead>
          <tbody>{rows.map((row, index) => {
            const line = `${index + 1}행`;
            return (
              <Fragment key={row.id}>
                <tr>
                  <td><input aria-label={`${line} 항목 이름`} maxLength={40} value={row.name} onChange={event => updateRow(row.id, { name: event.target.value })} /></td>
                  <td><input aria-label={`${line} ${fields.amount}`} type="number" inputMode="decimal" min="0" max={maxManWon} step="0.0001" value={row.value} onChange={event => updateRow(row.id, { value: event.target.value })} /></td>
                  <td className="entry-sheet-remove"><button type="button" className="icon-button" aria-label={`${line} 삭제`} onClick={() => removeRow(row.id)}><X size={17} aria-hidden="true" /></button></td>
                </tr>
                {hasMonth || hasInstallment || hasPortfolio || hasLoan ? (
                  <tr className="entry-sheet-detail-row">
                    <td colSpan={3}>
                      <div className="entry-sheet-details">
                        {hasMonth ? (
                          <label>
                            {fields.kind === 'income' ? '수입 월' : '예정 월'}
                            <input aria-label={`${line} ${fields.kind === 'income' ? '수입 월' : '예정 월'}`} type="month" value={row.month} onChange={event => updateRow(row.id, { month: event.target.value })} />
                          </label>
                        ) : null}
                        {hasInstallment ? <>
                          <label>시작 월<input aria-label={`${line} 시작 월`} type="month" min="1900-01" max="2200-12" value={row.startMonth} onChange={event => updateRow(row.id, { startMonth: event.target.value })} /></label>
                          <label>기간 (개월)<input aria-label={`${line} 기간 (개월)`} type="number" inputMode="numeric" min="1" step="1" value={row.termMonths} onChange={event => updateRow(row.id, { termMonths: event.target.value })} /></label>
                          <label>연이율 (%)<input aria-label={`${line} 연이율 (%)`} type="number" inputMode="decimal" min="0" max="100" step="any" value={row.annualRate} onChange={event => updateRow(row.id, { annualRate: event.target.value })} /></label>
                          <label>현재 잔액 계좌<select aria-label={`${line} 현재 잔액 계좌`} value={row.assetId} onChange={event => updateRow(row.id, { assetId: event.target.value })}><option value="">미연결 · 신규 납입만</option>{assets.filter(asset => asset.kind === 'savings').map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
                        </> : null}
                        {hasPortfolio ? <>
                          <label>투자 상품<select aria-label={`${line} 투자 상품`} value={row.product} onChange={event => updateRow(row.id, { product: event.target.value as DraftRow['product'] })}><option value="">미분류</option>{Object.entries(investmentProductLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                          <label>계좌 유형<select aria-label={`${line} 계좌 유형`} value={row.account} onChange={event => updateRow(row.id, { account: event.target.value as DraftRow['account'] })}><option value="">미지정</option>{Object.entries(investmentAccountLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                          <label>월 매수액 (만 원)<input aria-label={`${line} 월 매수액`} type="number" inputMode="decimal" min="0" max={maxManWon} step="0.0001" value={row.monthlyBuy} onChange={event => updateRow(row.id, { monthlyBuy: event.target.value })} /></label>
                        </> : null}
                        {hasLoan ? <>
                          <label>대출 연이율 (%)<input aria-label={`${line} 대출 연이율 (%)`} type="number" inputMode="decimal" min="0" max="100" step="any" value={row.loanRate} onChange={event => updateRow(row.id, { loanRate: event.target.value })} /></label>
                          <label>월 상환액 (만 원·원금+이자)<input aria-label={`${line} 월 상환액`} type="number" inputMode="decimal" min="0" max={maxManWon} step="0.0001" value={row.monthlyPayment} onChange={event => updateRow(row.id, { monthlyPayment: event.target.value })} /></label>
                        </> : null}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}</tbody>
        </table>
        {error ? <p className="form-error entry-sheet-error" role="alert">{error}</p> : null}
        <div className="entry-sheet-actions">
          <button type="button" className="button secondary" onClick={() => setDrafts(previous => ({ ...previous, [category]: [...(previous[category] ?? []), emptyRow(category, initialMonth)] }))}><Plus size={16} aria-hidden="true" />행 추가</button>
          <button type="submit" className="button primary" aria-label="저장하기" disabled={!pending || busy}>{busy ? '저장 중…' : pending ? `${pending}개 저장하기` : '저장하기'}</button>
        </div>
      </fieldset>
    </form>
  );
}

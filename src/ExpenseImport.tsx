import { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { SectionTitle } from './components';
import { currentMonth, expenseGroups, maxImportedExpenses, money, monthLabel, newImportedExpenses, type ImportedExpense } from './model';

export function ExpenseImport({ existing, save, busy }: { existing: ImportedExpense[]; save: (rows: ImportedExpense[]) => Promise<boolean>; busy: boolean }) {
  const [preview, setPreview] = useState<{ rows: ImportedExpense[]; duplicates: number; invalid: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const groups = useMemo(() => expenseGroups(preview?.rows ?? []), [preview]);
  const chosen = preview?.rows.filter(row => selected.has(row.category)) ?? [];
  const months = [...new Set(preview?.rows.map(row => row.date.slice(0, 7)))].sort();

  async function selectFile(file: File) {
    setReading(true);
    setPreview(null);
    setError('');
    try {
      const { readExpenseWorkbook } = await import('./expenseWorkbook');
      const result = await readExpenseWorkbook(file);
      const rows = newImportedExpenses(result.rows, existing);
      setSelected(new Set(rows.map(row => row.category)));
      setPreview({ rows, duplicates: result.rows.length - rows.length, invalid: result.invalid });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : '엑셀 파일을 읽을 수 없어요.');
    } finally {
      setReading(false);
    }
  }

  async function importSelected() {
    if (!chosen.length || busy) return;
    if (chosen.length + existing.length > maxImportedExpenses) {
      setError('가져온 지출은 최대 10,000건까지 저장할 수 있어요.');
      return;
    }
    if (!await save(chosen)) setError('가져온 지출을 저장하지 못했어요.');
  }

  return (
    <div className="expense-import">
      <label className={`button secondary file-button ${reading || busy ? 'disabled' : ''}`}>
        <FileSpreadsheet size={17} aria-hidden="true" />{reading ? '읽는 중…' : '엑셀 파일 선택'}
        <input aria-label="지출 엑셀 파일 선택" type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={reading || busy} onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void selectFile(file);
        }} />
      </label>
      {preview ? (
        <div className="expense-preview">
          {months.length ? <p className="expense-period">{monthLabel(months[0])}{months.length > 1 ? ` ~ ${monthLabel(months.at(-1)!)}` : ''}</p> : <p>새로 가져올 지출이 없어요.</p>}
          {preview.duplicates || preview.invalid ? <p className="expense-period">{[preview.duplicates ? `중복 ${preview.duplicates}건` : '', preview.invalid ? `읽지 못한 행 ${preview.invalid}건` : ''].filter(Boolean).join(' · ')}</p> : null}
          {groups.length ? (
            <div className="expense-categories">
              {groups.map(group => (
                <label className="expense-preview-row" key={group.name}>
                  <input type="checkbox" checked={selected.has(group.name)} disabled={busy} onChange={event => {
                    const checked = event.target.checked;
                    setSelected(previous => {
                      const next = new Set(previous);
                      if (checked) next.add(group.name);
                      else next.delete(group.name);
                      return next;
                    });
                    setError('');
                  }} />
                  <span>{group.name}<small>{group.items.length}건</small></span>
                  <strong>{money(group.amount)}</strong>
                </label>
              ))}
            </div>
          ) : null}
          {chosen.length ? <p className="expense-period" aria-live="polite">{chosen.length}건 · {money(chosen.reduce((sum, row) => sum + row.amount, 0))}</p> : null}
          <button className="button primary full" type="button" disabled={!chosen.length || busy} onClick={importSelected}>{busy ? '저장 중…' : '선택한 지출 가져오기'}</button>
        </div>
      ) : null}
      {error ? <p className="form-error expense-period" role="alert">{error}</p> : null}
    </div>
  );
}

export function ImportedExpenseHistory({ expenses }: { expenses: ImportedExpense[] }) {
  const [selection, setSelection] = useState('');
  const months = useMemo(() => [...new Set(expenses.map(row => row.date.slice(0, 7)))].sort().reverse(), [expenses]);
  const current = currentMonth();
  const month = months.includes(selection) ? selection : months.includes(current) ? current : months[0];
  const groups = useMemo(() => expenseGroups(expenses, month), [expenses, month]);
  if (!month) return null;

  return (
    <section className="panel history-panel imported-expenses">
      <SectionTitle title="가져온 지출" action={
        <select className="expense-month" aria-label="가져온 지출 월" value={month} onChange={event => setSelection(event.target.value)}>
          {months.map(value => <option key={value} value={value}>{monthLabel(value)}</option>)}
        </select>
      } />
      <p className="expense-period">{groups.reduce((sum, group) => sum + group.items.length, 0)}건 · <strong>{money(groups.reduce((sum, group) => sum + group.amount, 0))}</strong></p>
      <div className="expense-categories">
        {groups.map(group => (
          <details key={group.name}>
            <summary><span>{group.name}<small>{group.items.length}건</small></span><strong>{money(group.amount)}</strong></summary>
            <ul className="imported-expense-items">
              {group.items.map(row => (
                <li key={row.id}>
                  <span>{row.name}<small>{row.date}{row.subcategory ? ` · ${row.subcategory}` : ''}</small></span>
                  <strong>{money(row.amount)}</strong>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}

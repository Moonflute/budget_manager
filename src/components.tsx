import { useId, useLayoutEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { Plus, X, Wallet, Landmark, TrendingUp, CreditCard, ArrowDownLeft, ShoppingBag, PiggyBank, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { assetLabels, flowLabels, compactMoney, money, monthLabel, currentMonth, shiftMonth, investmentProductLabels, investmentAccountLabels, type Asset, type InvestmentProduct, type InvestmentAccount, type ProjectionPoint } from './model';
import { amountInWon, maxManWon, prepareEntry, type Entry, type EntryMode, type PreparedEntry } from './entryInput';

export const assetIcons = { cash: Wallet, savings: Landmark, investment: TrendingUp, debt: CreditCard };
export const flowIcons = { income: ArrowDownLeft, expense: ShoppingBag, saving: PiggyBank, investment: TrendingUp };

export function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span className="brand-name">Budget Manager</span></div>;
}
export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return <div className="section-title"><div><h2>{title}</h2></div>{action}</div>;
}
export function Empty({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return <div className="empty">{icon ? <div className="empty-icon">{icon}</div> : null}<h3>{title}</h3>{description ? <p>{description}</p> : null}{action}</div>;
}
export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="button primary" onClick={onClick}><Plus size={17} />{children}</button>;
}
export function MonthControl({ month, change }: { month: string; change: (month: string) => void }) {
  return <div className="month-control" role="group" aria-label="표시 월">
    <button type="button" className="icon-button" aria-label="이전 달" disabled={month <= '1900-01'} onClick={() => change(shiftMonth(month, -1))}><ChevronLeft size={19} aria-hidden="true" /></button>
    <input aria-label="표시 월 선택" type="month" min="1900-01" max="2200-12" value={month} onChange={event => { if (event.target.validity.valid && event.target.value) change(event.target.value); }} />
    <button type="button" className="icon-button" aria-label="다음 달" disabled={month >= '2200-12'} onClick={() => change(shiftMonth(month, 1))}><ChevronRight size={19} aria-hidden="true" /></button>
  </div>;
}
export function Modal({ title, subtitle, children, close, busy = false, className = '', notice }: { title: string; subtitle?: string; children: ReactNode; close: () => void; busy?: boolean; className?: string; notice?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby={heading} onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <div className="modal-head"><div><h2 id={heading}>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div><button className="icon-button" aria-label="닫기" disabled={busy} onClick={close}><X size={20} /></button></div>
    {notice}
    {children}
  </dialog>;
}

export function TrendChart({ points, comparison, detailed = false, actual = false }: { points: ProjectionPoint[]; comparison?: ProjectionPoint[]; detailed?: boolean; actual?: boolean }) {
  const id = useId().replaceAll(':', '');
  const chartRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(720);
  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const updateWidth = () => setWidth(Math.max(240, Math.round(chart.getBoundingClientRect().width)));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);
  const [selected, setSelected] = useState<number | null>(null);
  const index = Math.min(selected ?? points.length - 1, points.length - 1);
  const p = points[index];
  const comparePoint = comparison?.[index];
  const selectedPoint = comparePoint ?? p;
  const all = [...points, ...(comparison ?? [])].map(p => p.net);
  const maximum = Math.max(10_000, ...all);
  const minimum = Math.min(0, ...all);
  const range = maximum - minimum || 1;
  const top = maximum + range * .15;
  const bottom = minimum < 0 ? minimum - range * .1 : 0;
  const w = width, h = width < 480 ? 220 : 245, left = 56, right = 20, pad = 16, floor = h - 36;
  const x = (i: number) => left + i / Math.max(1, points.length - 1) * (w - left - right);
  const y = (v: number) => pad + (top - v) / (top - bottom) * (floor - pad);
  const path = (items: ProjectionPoint[]) => items.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.net).toFixed(1)}`).join(' ');
  const mainPath = path(comparison ?? points);
  const dateTicks = width < 480 ? [0, points.length - 1] : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  return <figure className="chart" ref={chartRef}>
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-labelledby={`${id}-title`}>
      <title id={`${id}-title`}>{actual ? '실제 순자산 기록' : '가정에 따른 순자산 예상'}: {monthLabel(points[0].month)} {money(points[0].net)}에서 {monthLabel(points.at(-1)!.month)} {money((comparison ?? points).at(-1)!.net)}</title>
      <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6b99e4" stopOpacity=".22" /><stop offset="100%" stopColor="#6b99e4" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3].map(i => { const value = bottom + (top - bottom) * i / 3; return <g key={i}><line x1={left} x2={w - right} y1={y(value)} y2={y(value)} stroke="#e0e8f4" strokeDasharray="3 5" /><text x={left - 12} y={y(value) + 4} textAnchor="end" className="chart-label">{compactMoney(value)}</text></g>; })}
      <path d={`${mainPath} L${x(points.length - 1)},${floor} L${left},${floor} Z`} fill={`url(#${id}-fill)`} />
      {comparison ? <path d={path(points)} fill="none" stroke="#a2b5d1" strokeWidth="2" strokeDasharray="6 5" /> : null}
      <path d={mainPath} fill="none" stroke="#2864c7" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points.length === 1 ? <circle cx={x(0)} cy={y(points[0].net)} r="5" fill="#2864c7" /> : null}
      <line x1={x(index)} x2={x(index)} y1={pad} y2={floor} stroke="#a6bde1" strokeDasharray="3 5" />
      <circle cx={x(index)} cy={y((comparison ?? points)[index].net)} r="5" fill="#fff" stroke="#2864c7" strokeWidth="3" />
      {dateTicks.filter((v, i, arr) => arr.indexOf(v) === i).map(i => <text key={i} x={x(i)} y={h - 7} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} className="chart-label">{i === 0 && !actual ? '현재' : `${points[i].month.slice(2, 4)}년 ${Number(points[i].month.slice(5))}월`}</text>)}
    </svg>
    {detailed && points.length > 1 ? <label className="chart-scrubber"><span>{actual ? '기록 월 선택' : '예상 월 선택'}</span><input type="range" min="0" max={points.length - 1} value={index} onChange={e => setSelected(Number(e.target.value))} aria-label={actual ? '기록 월 선택' : '예상 월 선택'} /></label> : null}
    {detailed ? <figcaption className="chart-detail">
      <div><span>{monthLabel(p.month)}{actual ? ' 기록' : ' 예상'}</span><strong>{money(selectedPoint.net)}</strong></div>
      <div><span>현금</span><b className={selectedPoint.cash < 0 ? 'negative' : ''}>{compactMoney(selectedPoint.cash)}원</b></div>
      <div><span>저축</span><b>{compactMoney(selectedPoint.savings)}원</b></div>
      <div><span>투자</span><b>{compactMoney(selectedPoint.investment)}원</b></div>
      <div><span>부채</span><b>{compactMoney(selectedPoint.debt)}원</b></div>
      {selectedPoint.loanPayment !== undefined ? <>
        <div><span>해당 월 상환</span><b>{money(selectedPoint.loanPayment)}</b></div>
        <div><span>해당 월 이자</span><b>{money(selectedPoint.loanInterest ?? 0)}</b></div>
      </> : null}
    </figcaption> : null}
  </figure>;
}

function AmountInput({ label, value, change, min = 0 }: { label: string; value: string; change: (value: string) => void; min?: number }) {
  const amount = amountInWon(value, min);
  return (
    <label>
      {label}
      <div className="unit-input">
        <input required type="number" inputMode="decimal" min={min} max={maxManWon} step="0.0001" value={value} onChange={e => change(e.target.value)} placeholder="0" />
        <span>만 원</span>
      </div>
      {amount !== null ? <small>{money(amount)}</small> : null}
    </label>
  );
}

export function EntryForm({ mode, entry, assets, save, remove, busy }: { mode: EntryMode; entry: Entry; assets: Asset[]; save: (entry: PreparedEntry) => Promise<boolean>; remove: () => void; busy: boolean }) {
  const [name, setName] = useState(entry.name);
  const [kind, setKind] = useState<string>(entry.kind);
  const [value, setValue] = useState(String(entry.amount / 10_000));
  const thisMonth = currentMonth();
  const nextMonth = shiftMonth(thisMonth, 1);
  const [month, setMonth] = useState('month' in entry ? entry.month : nextMonth);
  const existingInstallment = 'installment' in entry ? entry.installment : undefined;
  const [savingMethod, setSavingMethod] = useState(existingInstallment ? 'installment' : 'regular');
  const [termMonths, setTermMonths] = useState(existingInstallment ? String(existingInstallment.termMonths) : '');
  const [annualRate, setAnnualRate] = useState(existingInstallment ? String(existingInstallment.annualRate) : '');
  const [startMonth, setStartMonth] = useState(existingInstallment ? existingInstallment.startMonth ?? '' : thisMonth);
  const [assetId, setAssetId] = useState(existingInstallment?.assetId ?? '');
  const existingInvestment = 'investment' in entry ? entry.investment : undefined;
  const [product, setProduct] = useState<InvestmentProduct | ''>(existingInvestment?.product ?? '');
  const [account, setAccount] = useState<InvestmentAccount | ''>(existingInvestment?.account ?? '');
  const [buyFrequency, setBuyFrequency] = useState(existingInvestment?.monthlyBuy ? 'monthly' : 'none');
  const [buyAmount, setBuyAmount] = useState(existingInvestment?.monthlyBuy ? String(existingInvestment.monthlyBuy / 10_000) : '');
  const existingLoan = 'loan' in entry ? entry.loan : undefined;
  const [loanRate, setLoanRate] = useState(existingLoan ? String(existingLoan.annualRate) : '');
  const [monthlyPayment, setMonthlyPayment] = useState(existingLoan ? String(existingLoan.monthlyPayment / 10_000) : '');
  const [error, setError] = useState('');
  const isSaving = mode === 'flow' && kind === 'saving';
  const isInstallment = isSaving && savingMethod === 'installment';
  const isInvestment = mode === 'asset' && kind === 'investment';
  const isDebt = mode === 'asset' && kind === 'debt';
  const hasMonthlyBuy = isInvestment && buyFrequency === 'monthly';
  const isIrregularIncome = mode === 'event' && kind === 'income';
  const options = mode === 'asset' ? assetLabels : mode === 'flow' ? { ...flowLabels, income: '정기 수입' } : { expense: '예정 지출', income: '비정기 수입' };
  const amountLabel = {
    asset: isInvestment ? '현재 평가액' : isDebt ? '남은 원금' : '현재 잔액',
    flow: isInstallment ? '월 납입액' : '매달 금액',
    event: isIrregularIncome ? '수입 금액' : '예정 금액',
  }[mode];
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const prepared = prepareEntry(mode, kind, {
        name,
        value,
        month,
        installment: isInstallment ? { termMonths, annualRate, startMonth, assetId } : undefined,
        investment: isInvestment ? { product, account, monthlyBuy: hasMonthlyBuy ? buyAmount : undefined } : undefined,
        loan: isDebt ? { annualRate: loanRate, monthlyPayment } : undefined,
      }, entry.id);
      if (!await save(prepared)) setError('저장하지 못했어요.');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : '입력값을 확인해 주세요.');
    }
  }
  return <form onSubmit={submit} className="entry-form">
    <fieldset disabled={busy}>
      <label>
        분류
        <select aria-label="분류" value={kind} onChange={e => setKind(e.target.value)}>
          {Object.entries(options).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      {isSaving ? (
        <label>
          저축 방식
          <select value={savingMethod} onChange={e => setSavingMethod(e.target.value)}>
            <option value="regular">일반 저축</option>
            <option value="installment">적금</option>
          </select>
        </label>
      ) : null}
      <label>항목 이름<input autoFocus required maxLength={40} value={name} onChange={e => setName(e.target.value)} /></label>
      {isInvestment ? (
        <div className="form-grid">
          <label>
            투자 상품
            <select value={product} onChange={e => setProduct(e.target.value as InvestmentProduct | '')}>
              <option value="">미분류</option>
              {Object.entries(investmentProductLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label>
            계좌 유형
            <select value={account} onChange={e => setAccount(e.target.value as InvestmentAccount | '')}>
              <option value="">미지정</option>
              {Object.entries(investmentAccountLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        </div>
      ) : null}
      <AmountInput label={amountLabel} value={value} change={setValue} />
      {isDebt ? <div className="form-grid">
        <label>대출 연이율 (%)<input type="number" inputMode="decimal" min="0" max="100" step="any" required={!!monthlyPayment.trim()} value={loanRate} onChange={event => setLoanRate(event.target.value)} /></label>
        <label>월 상환액 (만 원·원금+이자)<input type="number" inputMode="decimal" min="0" max={maxManWon} step="0.0001" required={!!loanRate.trim()} value={monthlyPayment} onChange={event => setMonthlyPayment(event.target.value)} /></label>
      </div> : null}
      {isInvestment ? (
        <label>
          정기 매수
          <select value={buyFrequency} onChange={e => setBuyFrequency(e.target.value)}>
            <option value="none">없음</option>
            <option value="monthly">매월</option>
          </select>
        </label>
      ) : null}
      {hasMonthlyBuy ? <AmountInput label="월 매수액" value={buyAmount} change={setBuyAmount} min={0.0001} /> : null}
      {isInstallment ? (
        <div className="form-grid">
          <label>시작 월<input type="month" min="1900-01" max="2200-12" required value={startMonth} onChange={e => setStartMonth(e.target.value)} /></label>
          <label>기간 (개월)<input type="number" inputMode="numeric" min="1" step="1" required value={termMonths} onChange={e => setTermMonths(e.target.value)} /></label>
          <label>연이율 (%)<input type="number" inputMode="decimal" min="0" max="100" step="any" required value={annualRate} onChange={e => setAnnualRate(e.target.value)} /></label>
          <label>현재 잔액 계좌<select value={assetId} onChange={e => setAssetId(e.target.value)}><option value="">미연결 · 신규 납입만</option>{assets.filter(asset => asset.kind === 'savings').map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
        </div>
      ) : null}
      {mode === 'event' ? (
        <label>
          {isIrregularIncome ? '수입 월' : '예정 월'}
          <input required type="month" min={isIrregularIncome ? '1900-01' : nextMonth} max={isIrregularIncome ? '2200-12' : shiftMonth(thisMonth, 120)} value={month} onChange={e => setMonth(e.target.value)} />
          {!isIrregularIncome ? <small>다음 달부터 입력 가능 · 해당 월에 1회 반영</small> : null}
        </label>
      ) : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="form-actions"><button type="button" className="button danger subtle" onClick={remove}><Trash2 size={16} />삭제</button><button type="submit" className="button primary">{busy ? '저장하는 중…' : '저장하기'}</button></div>
    </fieldset>
  </form>;
}

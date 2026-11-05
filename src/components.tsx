import { useEffect, useId, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { ArrowUpRight, Plus, X, Wallet, Landmark, TrendingUp, CreditCard, ArrowDownLeft, ShoppingBag, PiggyBank, Trash2 } from 'lucide-react';
import { assetLabels, flowLabels, compactMoney, money, monthLabel, currentMonth, shiftMonth, uid, type Asset, type AssetKind, type Flow, type FlowKind, type PlannedEvent, type ProjectionPoint, type Balances } from './model';

export const assetIcons = { cash: Wallet, savings: Landmark, investment: TrendingUp, debt: CreditCard };
export const flowIcons = { income: ArrowDownLeft, expense: ShoppingBag, saving: PiggyBank, investment: TrendingUp };
export const colors = { cash: '#a9c8b6', savings: '#39765c', investment: '#c3a361', debt: '#d27b67', income: '#39765c', expense: '#d3a06a', saving: '#80ac93' };

export function Brand() {
  return <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span>모아<span className="brand-en">moa</span></span></div>;
}
export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="section-title"><div>{eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}<h2>{title}</h2></div>{action}</div>;
}
export function Empty({ icon, title, description, action }: { icon?: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="empty">{icon ? <div className="empty-icon">{icon}</div> : null}<h3>{title}</h3><p>{description}</p>{action}</div>;
}
export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="button primary" onClick={onClick}><Plus size={17} />{children}</button>;
}
export function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button className="text-button" onClick={onClick}>{children}<ArrowUpRight size={16} /></button>;
}
export function Modal({ title, subtitle, children, close, busy = false }: { title: string; subtitle?: string; children: ReactNode; close: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="modal" aria-labelledby={heading} onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <div className="modal-head"><div><h2 id={heading}>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div><button className="icon-button" aria-label="닫기" disabled={busy} onClick={close}><X size={20} /></button></div>
    {children}
  </dialog>;
}

export function Allocation({ values }: { values: Balances }) {
  const items = (['cash', 'savings', 'investment'] as const).map(key => ({ key, value: values[key], label: assetLabels[key] }));
  let angle = 0;
  const parts = items.map(item => {
    const start = angle;
    angle += values.total ? item.value / values.total * 360 : 0;
    return `${colors[item.key]} ${start}deg ${angle}deg`;
  });
  return <div className="allocation">
    <div className="donut" role="img" aria-label={`자산 구성. ${items.map(i => `${i.label} ${money(i.value)}`).join(', ')}`} style={{ background: values.total ? `conic-gradient(${parts.join(',')})` : '#edf0e9' }}><div><span>총자산</span><strong>{compactMoney(values.total)}<small>원</small></strong></div></div>
    <div className="allocation-list">{items.map(i => <div key={i.key}><span><i className="dot" style={{ background: colors[i.key] }} />{i.label}</span><b>{values.total ? Math.round(i.value / values.total * 100) : 0}<small>%</small></b></div>)}</div>
  </div>;
}

export function TrendChart({ points, comparison, detailed = false, actual = false }: { points: ProjectionPoint[]; comparison?: ProjectionPoint[]; detailed?: boolean; actual?: boolean }) {
  const id = useId().replaceAll(':', '');
  const [selected, setSelected] = useState<number | null>(null);
  const index = Math.min(selected ?? points.length - 1, points.length - 1);
  const p = points[index];
  const comparePoint = comparison?.[index];
  const all = [...points, ...(comparison ?? [])].map(p => p.net);
  const maximum = Math.max(10_000, ...all);
  const minimum = Math.min(0, ...all);
  const range = maximum - minimum || 1;
  const top = maximum + range * .15;
  const bottom = minimum < 0 ? minimum - range * .1 : 0;
  const w = 720, h = 245, left = 70, right = 20, pad = 16, floor = h - 36;
  const x = (i: number) => left + i / Math.max(1, points.length - 1) * (w - left - right);
  const y = (v: number) => pad + (top - v) / (top - bottom) * (floor - pad);
  const path = (items: ProjectionPoint[]) => items.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.net).toFixed(1)}`).join(' ');
  const mainPath = path(comparison ?? points);
  return <figure className="chart">
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-labelledby={`${id}-title`}>
      <title id={`${id}-title`}>{actual ? '실제 순자산 기록' : '가정에 따른 순자산 예상'}: {monthLabel(points[0].month)} {money(points[0].net)}에서 {monthLabel(points.at(-1)!.month)} {money((comparison ?? points).at(-1)!.net)}</title>
      <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5d9675" stopOpacity=".22" /><stop offset="100%" stopColor="#5d9675" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3].map(i => { const value = bottom + (top - bottom) * i / 3; return <g key={i}><line x1={left} x2={w - right} y1={y(value)} y2={y(value)} stroke="#e7eae3" strokeDasharray="3 5" /><text x={left - 12} y={y(value) + 4} textAnchor="end" className="chart-label">{compactMoney(value)}</text></g>; })}
      <path d={`${mainPath} L${x(points.length - 1)},${floor} L${left},${floor} Z`} fill={`url(#${id}-fill)`} />
      {comparison ? <path d={path(points)} fill="none" stroke="#b8bfb3" strokeWidth="2" strokeDasharray="6 5" /> : null}
      <path d={mainPath} fill="none" stroke="#377759" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points.length === 1 ? <circle cx={x(0)} cy={y(points[0].net)} r="5" fill="#377759" /> : null}
      <line x1={x(index)} x2={x(index)} y1={pad} y2={floor} stroke="#a1b7a5" strokeDasharray="3 5" />
      <circle cx={x(index)} cy={y((comparison ?? points)[index].net)} r="5" fill="#fff" stroke="#377759" strokeWidth="3" />
      {[0, Math.floor((points.length - 1) / 2), points.length - 1].filter((v, i, arr) => arr.indexOf(v) === i).map(i => <text key={i} x={x(i)} y={h - 7} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} className="chart-label">{i === 0 && !actual ? '현재' : `${points[i].month.slice(2, 4)}년 ${Number(points[i].month.slice(5))}월`}</text>)}
    </svg>
    {detailed && points.length > 1 ? <label className="chart-scrubber"><span>{actual ? '기록 월 선택' : '예상 월 선택'}</span><input type="range" min="0" max={points.length - 1} value={index} onChange={e => setSelected(Number(e.target.value))} aria-label={actual ? '기록 월 선택' : '예상 월 선택'} /></label> : null}
    {detailed ? <figcaption className="chart-detail"><div><span>{monthLabel(p.month)}{actual ? ' 기록' : ' 예상'}</span><strong>{money((comparePoint ?? p).net)}</strong></div><div><span>현금</span><b className={(comparePoint ?? p).cash < 0 ? 'negative' : ''}>{compactMoney((comparePoint ?? p).cash)}원</b></div><div><span>저축</span><b>{compactMoney((comparePoint ?? p).savings)}원</b></div><div><span>투자</span><b>{compactMoney((comparePoint ?? p).investment)}원</b></div></figcaption> : null}
  </figure>;
}

export type EntryMode = 'asset' | 'flow' | 'event';
export type Entry = Asset | Flow | PlannedEvent;
export function EntryForm({ mode, entry, initialKind, save, remove, busy }: { mode: EntryMode; entry?: Entry; initialKind?: string; save: (entry: Entry) => Promise<boolean>; remove?: () => void; busy: boolean }) {
  const [name, setName] = useState(entry?.name ?? '');
  const [kind, setKind] = useState(entry?.kind ?? initialKind ?? (mode === 'asset' ? 'cash' : mode === 'flow' ? 'income' : 'expense'));
  const [value, setValue] = useState(entry ? String(entry.amount / 10_000) : '');
  const [month, setMonth] = useState(entry && 'month' in entry ? entry.month : shiftMonth(currentMonth(), 1));
  const [error, setError] = useState('');
  const options = mode === 'asset' ? assetLabels : mode === 'flow' ? flowLabels : { expense: '예정 지출', income: '예정 수입' };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setError('항목 이름을 입력해 주세요.'); return; }
    const n = Number(value);
    if (value.trim() === '' || !Number.isFinite(n) || n < 0 || n > 1_000_000_000) { setError('0 이상의 금액을 입력해 주세요.'); return; }
    setError('');
    const common = { id: entry?.id ?? uid(), name: name.trim(), amount: Math.round(n * 10_000) };
    const next: Entry = mode === 'event' ? { ...common, month, kind: kind as 'income' | 'expense' } : mode === 'asset' ? { ...common, kind: kind as AssetKind } : { ...common, kind: kind as FlowKind };
    await save(next);
  }
  return <form onSubmit={submit} className="entry-form">
    <fieldset disabled={busy}>
      <label>분류<select value={kind} onChange={e => setKind(e.target.value)}>{Object.entries(options).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>항목 이름<input autoFocus required maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder={mode === 'asset' ? '예: 생활비 통장' : mode === 'flow' ? '예: 월급 · 세후' : '예: 여행 경비'} /></label>
      <label>{mode === 'asset' ? '현재 잔액' : mode === 'flow' ? '매달 금액' : '예정 금액'}<div className="unit-input"><input required type="number" inputMode="decimal" min="0" max="1000000000" step="0.0001" value={value} onChange={e => setValue(e.target.value)} placeholder="0" /><span>만 원</span></div><small>{value && Number.isFinite(Number(value)) ? money(Number(value) * 10_000) : '대략적인 금액으로 시작해도 괜찮아요.'}</small></label>
      {mode === 'event' ? <label>예정 월<input required type="month" min={shiftMonth(currentMonth(), 1)} max={shiftMonth(currentMonth(), 120)} value={month} onChange={e => setMonth(e.target.value)} /><small>다음 달 이후의 일회성 수입·지출을 예상에 반영해요.</small></label> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="form-actions">{remove ? <button type="button" className="button danger subtle" onClick={remove}><Trash2 size={16} />삭제</button> : <span />}<button type="submit" className="button primary">{busy ? '저장하는 중…' : '저장하기'}</button></div>
    </fieldset>
  </form>;
}

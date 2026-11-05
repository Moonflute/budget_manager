import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, CircleHelp, Download, FolderOpen, History, Pencil, Plus, ShieldCheck, Smartphone, Target, CalendarDays } from 'lucide-react';
import { AddButton, Empty, SectionTitle, TrendChart, assetIcons, flowIcons } from './components';
import type { Entry, EntryMode } from './entryInput';
import { assetLabels, flowLabels, investmentProductLabels, investmentAccountLabels, balances, flowsForMonth, monthlyFlow, project, money, compactMoney, monthLabel, currentMonth, type AssetKind, type BudgetData, type ProjectionPoint } from './model';

export type Page = 'overview' | 'assets' | 'budget' | 'forecast' | 'records';
export interface ViewProps {
  data: BudgetData;
  add: (mode: EntryMode, kind?: string) => void;
  edit: (mode: EntryMode, entry: Entry) => void;
}

export function Assets({ data, add, edit }: ViewProps) {
  const b = balances(data.assets);
  return <>
    <div className="page-intro"><div><h1>나의 자산</h1></div><AddButton onClick={() => add('asset')}>자산 추가</AddButton></div>
    <div className="balance-strip"><div><span>총자산</span><strong>{money(b.total)}</strong></div><span className="math-sign">−</span><div><span>총부채</span><strong>{money(b.debt)}</strong></div><span className="math-sign">=</span><div><span>순자산</span><strong className="accent">{money(b.net)}</strong></div></div>
    <div className="two-column">{(Object.keys(assetLabels) as AssetKind[]).map(kind => {
      const Icon = assetIcons[kind];
      const entries = data.assets.filter(asset => asset.kind === kind);
      return (
        <section className="panel asset-group" key={kind}>
          <div className="group-head"><span className={`category-icon ${kind}`}><Icon size={21} /></span><div><h2>{assetLabels[kind]}</h2><span>{entries.length}개 항목</span></div><strong>{money(b[kind])}</strong></div>
          {entries.length ? (
            <div className="entry-list">{entries.map(asset => {
              const details = asset.investment;
              const summary = [
                details?.product && investmentProductLabels[details.product],
                details?.account && investmentAccountLabels[details.account],
                details?.monthlyBuy && `월 ${money(details.monthlyBuy)} 매수`,
              ].filter(Boolean).join(' · ');
              return (
                <button className="entry-row" key={asset.id} onClick={() => edit('asset', asset)}>
                  <span>{asset.name}{summary ? <small className="entry-detail">{summary}</small> : null}</span>
                  <b>{money(asset.amount)}</b><Pencil size={15} />
                </button>
              );
            })}</div>
          ) : <div className="group-empty">항목 없음</div>}
          <button className="add-row" onClick={() => add('asset', kind)}><Plus size={16} />{assetLabels[kind]} 추가</button>
        </section>
      );
    })}</div>
    <div className="info-note"><CircleHelp size={17} /><span>투자는 현재 평가액 기준</span></div>
  </>;
}

export function Budget({ data, add, edit }: ViewProps) {
  const month = currentMonth();
  const recurringIncome = monthlyFlow(data).income;
  const f = monthlyFlow({ assets: data.assets, flows: flowsForMonth(data, month) });
  const irregularIncome = data.events.filter(event => event.kind === 'income').sort((a, b) => b.month.localeCompare(a.month));
  const monthlyBuys = data.assets.flatMap(asset => {
    const amount = asset.investment?.monthlyBuy ?? 0;
    return asset.kind === 'investment' && amount > 0 ? [{ asset, amount }] : [];
  });
  return <>
    <div className="page-intro"><div><h1>월 예산</h1></div><AddButton onClick={() => add('flow')}>예산 항목 추가</AddButton></div>
    <div className={`budget-equation ${f.cash < 0 ? 'over-budget' : ''}`}><div><span>이번 달 수입</span><strong>{compactMoney(f.income)}원</strong></div><span>−</span><div><span>생활 지출</span><strong>{compactMoney(f.expense)}원</strong></div><span>−</span><div><span>저축·투자</span><strong>{compactMoney(f.saving + f.investment)}원</strong></div><span>=</span><div><span>남는 현금</span><strong>{compactMoney(f.cash)}원</strong></div></div>
    {f.cash < 0 ? <div className="warning-note">월 배분 초과 {money(-f.cash)} · 기존 현금에서 충당</div> : null}
    <div className="two-column">{(['income', 'irregular-income', 'expense', 'saving', 'investment'] as const).map(kind => {
      if (kind === 'irregular-income') {
        return (
          <section className="panel" key={kind}>
            <div className="group-head">
              <span className="category-icon income"><CalendarDays size={21} /></span>
              <div><h2>비정기 수입</h2><span>이번 달</span></div>
              <strong>{money(f.income - recurringIncome)}</strong>
            </div>
            {irregularIncome.length ? (
              <div className="entry-list">{irregularIncome.map(entry => (
                <button className="entry-row" onClick={() => edit('event', entry)} key={entry.id}>
                  <span>{entry.name}<small className="entry-detail">{monthLabel(entry.month)}</small></span>
                  <b>{money(entry.amount)}</b><Pencil size={15} />
                </button>
              ))}</div>
            ) : <div className="group-empty">항목 없음</div>}
            <button className="add-row" onClick={() => add('event', 'income')}><Plus size={16} />비정기 수입 추가</button>
          </section>
        );
      }
      const Icon = flowIcons[kind];
      const title = kind === 'income' ? '정기 수입' : flowLabels[kind];
      const entries = data.flows.filter(x => x.kind === kind);
      const linkedBuys = kind === 'investment' ? monthlyBuys : [];
      return (
        <section className="panel" key={kind}>
          <div className="group-head"><span className={`category-icon ${kind}`}><Icon size={21} /></span><div><h2>{title}</h2></div><strong>{money(kind === 'income' ? recurringIncome : f[kind])}</strong></div>
          {entries.length || linkedBuys.length ? (
            <div className="entry-list">
              {entries.map(entry => (
                <button className="entry-row" onClick={() => edit('flow', entry)} key={entry.id}>
                  <span>
                    {entry.name}
                    {entry.installment ? <small className="entry-detail">적금 · {entry.installment.termMonths}개월 · 연 {entry.installment.annualRate}%</small> : null}
                  </span>
                  <b>{money(entry.amount)}</b><Pencil size={15} />
                </button>
              ))}
              {linkedBuys.map(({ asset, amount }) => (
                <button className="entry-row" onClick={() => edit('asset', asset)} key={asset.id}>
                  <span>{asset.name}<small className="entry-detail">정기 매수</small></span>
                  <b>{money(amount)}</b><Pencil size={15} />
                </button>
              ))}
            </div>
          ) : <div className="group-empty">항목 없음</div>}
          <button className="add-row" onClick={() => add('flow', kind)}><Plus size={16} />{title} 추가</button>
        </section>
      );
    })}</div>
    <div className="info-note"><CircleHelp size={18} /><span>저축·투자는 현금에서 각 자산으로 이동</span></div>
  </>;
}

export function Forecast({ data, add, edit, saveAssumptions, busy }: ViewProps & { saveAssumptions: (value: BudgetData['assumptions']) => Promise<boolean>; busy: boolean }) {
  const [years, setYears] = useState(3);
  const [reduction, setReduction] = useState(0);
  const [extra, setExtra] = useState(0);
  const [rate, setRate] = useState(data.assumptions.investmentRate);
  const flow = monthlyFlow(data);
  const baseline = project(data, years * 12);
  const modified = reduction > 0 || extra > 0 || rate !== data.assumptions.investmentRate;
  const scenario = project(data, years * 12, { expenseReduction: reduction * 10_000, extraInvestment: extra * 10_000, investmentRate: rate });
  const last = scenario.at(-1)!;
  const firstShortfall = scenario.find(p => p.cash < 0);
  const goalPoint = scenario.find(p => p.net >= data.assumptions.target);
  const upcoming = data.events.filter(e => e.month > currentMonth()).sort((a, b) => a.month.localeCompare(b.month));
  return <>
    <div className="page-intro"><div><h1>자산 예측</h1></div><div className="segmented" aria-label="예측 기간">{[1, 3, 5, 10].map(y => <button aria-pressed={years === y} className={years === y ? 'active' : ''} key={y} onClick={() => setYears(y)}>{y}년</button>)}</div></div>
    <div className="forecast-layout"><section className="panel forecast-main"><div className="chart-heading"><div><span>{years}년 뒤 예상 순자산</span><strong>{money(last.net)}</strong></div>{modified ? <span className="comparison-chip">기존보다 {last.net >= baseline.at(-1)!.net ? '+' : ''}{compactMoney(last.net - baseline.at(-1)!.net)}원</span> : <span className="chip">현재 계획</span>}</div><div className="chart-legends"><span className="legend"><i className="dot" />{modified ? '바꾼 계획' : '현재 계획'}</span>{modified ? <span className="legend muted"><i className="dash" />기존 계획</span> : null}</div><TrendChart points={baseline} comparison={modified ? scenario : undefined} detailed /><div className="forecast-result"><Target size={21} /><div><strong>{goalPoint ? goalPoint.step === 0 ? '목표 달성' : `${monthLabel(goalPoint.month)}, 목표 달성 예상` : `${years}년 후 목표까지 ${money(Math.max(0, data.assumptions.target - last.net))}`}</strong><p>순자산 목표 {money(data.assumptions.target)} · 현재 가정 기준</p></div></div>{firstShortfall ? <div className="warning-note">{firstShortfall.step === 0 ? '현재' : monthLabel(firstShortfall.month)}부터 현금 부족 · 자동 대출 없음</div> : null}</section>
      <section className="panel scenario-panel"><h2>시나리오</h2><p className="panel-description">비교용 · 월 예산에 저장되지 않음</p><label className="slider-label"><span>월 생활비 줄이기<strong>{reduction}만 원</strong></span><input type="range" min="0" max={Math.floor(flow.expense / 10_000)} step="1" value={Math.min(reduction, Math.floor(flow.expense / 10_000))} onChange={e => setReduction(Number(e.target.value))} /><small>절감액은 현금에 남음</small></label><label className="slider-label"><span>월 투자 늘리기<strong>{extra}만 원</strong></span><input type="range" min="0" max="200" step="5" value={extra} onChange={e => setExtra(Number(e.target.value))} /><small>추가액은 현금에서 이동</small></label><label className="slider-label"><span>투자 연수익률 가정<strong>{rate}%</strong></span><input type="range" min="-30" max="30" step="0.5" value={rate} onChange={e => setRate(Number(e.target.value))} /></label><button className="button secondary full" onClick={() => { setReduction(0); setExtra(0); setRate(data.assumptions.investmentRate); }}>현재 계획으로 되돌리기</button></section></div>
    <div className="two-column"><section className="panel"><SectionTitle title="기본 가정과 목표" /><AssumptionsForm key={JSON.stringify(data.assumptions)} data={data} save={saveAssumptions} busy={busy} /><p className="fine-print">다음 달부터 월 단위 계산 · 연수익률 월 복리 · 월말 납입 · 부채 고정. 세금·수수료·물가·대출 이자·상환 미반영.</p></section><section className="panel"><SectionTitle title="예정 수입·지출" action={<button className="icon-button" aria-label="예정 항목 추가" onClick={() => add('event')}><Plus size={20} /></button>} />{upcoming.length ? <div className="entry-list">{upcoming.map(e => <button className="entry-row event-row" key={e.id} onClick={() => edit('event', e)}><span><b>{e.name}</b><small>{monthLabel(e.month)}</small></span><strong className={e.kind === 'income' ? 'accent' : ''}>{e.kind === 'income' ? '+' : '−'}{compactMoney(e.amount)}원</strong><Pencil size={14} /></button>)}</div> : <Empty icon={<CalendarDays size={26} />} title="예정 항목 없음" description="해당 월에 1회 반영" action={<button className="button secondary" onClick={() => add('event')}>예정 항목 추가</button>} />}</section></div>
  </>;
}

function AssumptionsForm({ data, save, busy }: { data: BudgetData; save: (a: BudgetData['assumptions']) => Promise<boolean>; busy: boolean }) {
  const [savingsRate, setSavingsRate] = useState(String(data.assumptions.savingsRate));
  const [investmentRate, setInvestmentRate] = useState(String(data.assumptions.investmentRate));
  const [target, setTarget] = useState(String(data.assumptions.target / 10_000));
  async function submit(e: FormEvent) { e.preventDefault(); await save({ savingsRate: Number(savingsRate), investmentRate: Number(investmentRate), target: Math.round(Number(target) * 10_000) }); }
  return <form className="assumptions-form" onSubmit={submit}><fieldset disabled={busy}><div className="form-grid"><label>저축 연이율 (%)<input type="number" required min="-100" max="100" step="0.1" value={savingsRate} onChange={e => setSavingsRate(e.target.value)} /></label><label>투자 연수익률 (%)<input type="number" required min="-100" max="100" step="0.1" value={investmentRate} onChange={e => setInvestmentRate(e.target.value)} /></label></div><label>순자산 목표 (만 원)<input type="number" required min="1" max="1000000000" step="0.0001" value={target} onChange={e => setTarget(e.target.value)} /></label><button className="button secondary" type="submit"><Check size={16} />가정 저장</button></fieldset></form>;
}

export function Records({ data, snapshot, backup, restore, persist, persistence, install, canInstall, busy }: { data: BudgetData; snapshot: () => void; backup: () => void; restore: (file: File) => void; persist: () => void; persistence: string; install: () => void; canInstall: boolean; busy: boolean }) {
  const history = [...data.history].sort((a, b) => a.month.localeCompare(b.month));
  const points: ProjectionPoint[] = history.map((h, step) => ({ ...h, step, total: h.cash + h.savings + h.investment, net: h.cash + h.savings + h.investment - h.debt }));
  return <>
    <div className="page-intro"><div><h1>기록과 백업</h1></div><button className="button primary" disabled={busy} onClick={snapshot}><Plus size={17} />이번 달 기록</button></div>
    <section className="panel backup-panel">
      <SectionTitle title="JSON 백업" action={<span className="chip">최근 백업 {data.lastBackupAt ? new Date(data.lastBackupAt).toLocaleDateString('ko-KR') : '없음'}</span>} />
      <div className="button-pair">
        <button type="button" className="button primary" aria-label="백업 내보내기" disabled={busy} onClick={backup}>
          <Download size={17} aria-hidden="true" />내보내기
        </button>
        <label className={`button secondary file-button ${busy ? 'disabled' : ''}`}>
          <FolderOpen size={17} aria-hidden="true" />불러오기
          <input aria-label="백업 파일 선택" type="file" accept=".json,application/json" disabled={busy} onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) restore(file);
          }} />
        </label>
      </div>
      <p className="fine-print">백업 파일은 암호화되지 않음 · 기기 밖에 보관</p>
    </section>
    <section className="panel history-panel"><SectionTitle title="순자산 기록" action={<span className="chip">실제 기록 {history.length}개월</span>} />{points.length ? <TrendChart points={points} detailed actual /> : <Empty icon={<History size={28} />} title="월별 기록 없음" />}</section>
    {history.length ? <section className="panel history-panel"><SectionTitle title="월별 기록" /><div className="table-scroll"><table><thead><tr><th>기록 월</th><th>현금</th><th>저축</th><th>투자</th><th>부채</th><th>순자산</th></tr></thead><tbody>{[...points].reverse().map(h => <tr key={h.month}><th>{monthLabel(h.month)}</th><td>{compactMoney(h.cash)}원</td><td>{compactMoney(h.savings)}원</td><td>{compactMoney(h.investment)}원</td><td>{compactMoney(h.debt)}원</td><td><strong>{compactMoney(h.net)}원</strong></td></tr>)}</tbody></table></div></section> : null}
    <div className="two-column"><section className="panel"><SectionTitle title="설치 및 보관" /><div className="settings-item"><span className="soft-icon"><Smartphone size={21} /></span><div><h3>홈 화면 설치</h3></div></div><button className="button secondary full" onClick={install}>{canInstall ? '홈 화면에 설치하기' : '설치 방법 보기'}<ArrowUpRight size={16} /></button><div className="settings-divider" /><div className="settings-item"><span className="soft-icon"><ShieldCheck size={21} /></span><div><h3>기록 보존 요청</h3><p>{persistence}</p></div></div><button className="button secondary full" onClick={persist}>브라우저에 보존 요청</button><p className="fine-print">보존 승인 후에도 직접 삭제하면 기록이 사라져요.</p></section></div>
  </>;
}

import { useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowRight, Check, CircleHelp, Download, FolderOpen, History, Landmark, Leaf, Pencil, Plus, ShieldCheck, Smartphone, Sparkles, Target, TrendingUp, Wallet, CalendarDays, HardDrive } from 'lucide-react';
import { Allocation, AddButton, Empty, LinkButton, SectionTitle, TrendChart, assetIcons, flowIcons, colors, type Entry, type EntryMode } from './components';
import { assetLabels, flowLabels, balances, monthlyFlow, project, money, compactMoney, monthLabel, currentMonth, type AssetKind, type FlowKind, type BudgetData, type ProjectionPoint } from './model';

export type Page = 'overview' | 'assets' | 'budget' | 'forecast' | 'records';
export interface ViewProps {
  data: BudgetData;
  go: (page: Page) => void;
  add: (mode: EntryMode, kind?: string) => void;
  edit: (mode: EntryMode, entry: Entry) => void;
}

export function Overview({ data, go, add }: ViewProps) {
  const b = balances(data.assets), f = monthlyFlow(data.flows);
  const forecast = project(data, 36);
  const year = forecast[12];
  const savingRatio = f.income ? Math.round((f.saving + f.investment) / f.income * 100) : 0;
  const target = data.assumptions.target;
  const progress = target ? Math.max(0, Math.min(b.net / target * 100, 100)) : 0;
  const hasData = data.assets.length > 0 || data.flows.length > 0;
  return <>
    <div className="page-intro"><div><span className="eyebrow">MY FINANCIAL OVERVIEW</span><h1>오늘의 나, 내일의 여유<span className="title-dot">.</span></h1><p>지금의 돈을 정리하고, 앞으로의 가능성을 그려보세요.</p></div><span className="date-chip"><CalendarDays size={16} />{monthLabel(currentMonth())}</span></div>
    {!hasData ? <div className="getting-started"><div className="soft-icon"><Leaf size={24} /></div><div><strong>작은 기록에서 시작하는 나의 재정</strong><p>현재 자산과 매달 금액을 입력하면, 내 돈의 흐름이 보여요.</p></div><button className="button primary" onClick={() => add('asset')}>첫 자산 입력<ArrowRight size={16} /></button></div> : null}
    <div className="summary-grid">
      <section className="net-card"><div className="card-top"><span>현재 순자산</span><span className="inverse-icon"><Wallet size={19} /></span></div><div className="hero-number">{compactMoney(b.net)}<small>원</small></div><p>총자산 {compactMoney(b.total)}원 <span>·</span> 부채 {compactMoney(b.debt)}원</p><div className="net-card-bottom"><span>오늘부터 차곡차곡</span><button aria-label="자산 자세히 보기" onClick={() => go('assets')}><ArrowUpRight size={22} /></button></div><div className="card-orbit" aria-hidden="true" /></section>
      <section className="metric-card"><div className="card-top"><span>매달 남는 현금</span><span className="soft-icon"><ArrowDownLeft size={19} /></span></div><div className={`metric-number ${f.cash < 0 ? 'negative' : ''}`}>{compactMoney(f.cash)}<small>원</small></div><p>생활비·저축·투자를 배분한 후</p><div className={`metric-foot ${f.cash < 0 ? 'negative' : ''}`}><span className="status-dot" />{f.cash < 0 ? '월 배분을 조정해 보세요' : f.income ? '예산 안에서 잘 배분하고 있어요' : '월 예산을 입력해 주세요'}</div></section>
      <section className="metric-card"><div className="card-top"><span>저축·투자 비율</span><span className="soft-icon gold"><Landmark size={19} /></span></div><div className="metric-number">{savingRatio}<small>%</small></div><p>월 수입 중 미래를 위한 금액</p><div className="mini-track"><span style={{ width: `${Math.min(savingRatio, 100)}%` }} /></div><div className="mini-track-label">월 {compactMoney(f.saving + f.investment)}원 저축·투자</div></section>
      <section className="metric-card"><div className="card-top"><span>1년 뒤 예상 순자산</span><span className="soft-icon lavender"><TrendingUp size={19} /></span></div><div className="metric-number">{compactMoney(year.net)}<small>원</small></div><p>현재 예산과 수익률 가정 기준</p><div className="metric-foot"><ArrowUpRight size={15} /><span>지금보다 {year.net >= b.net ? '+' : ''}{compactMoney(year.net - b.net)}원</span></div></section>
    </div>
    <div className="overview-grid">
      <section className="panel forecast-panel"><SectionTitle eyebrow="LOOKING AHEAD" title="내 돈의 다음 장" action={<LinkButton onClick={() => go('forecast')}>시뮬레이션</LinkButton>} /><div className="chart-heading"><div><span>지금 흐름으로 3년 후</span><strong>{money(forecast.at(-1)!.net)}</strong></div><span className="legend"><i className="dot" />예상 순자산</span></div><TrendChart points={forecast} /><div className="chart-note"><CircleHelp size={14} />수익률과 월 예산이 유지된다는 가정이에요.</div></section>
      <section className="panel allocation-panel"><SectionTitle eyebrow="ASSET MIX" title="어디에 모여 있을까" action={<button className="icon-button" aria-label="자산 구성 자세히 보기" onClick={() => go('assets')}><ArrowUpRight size={20} /></button>} /><Allocation values={b} /><div className="panel-foot">자산 {data.assets.filter(a => a.kind !== 'debt').length}개를 함께 보고 있어요</div></section>
      <section className="panel"><SectionTitle eyebrow="MONTHLY FLOW" title="이번 달 돈의 흐름" action={<LinkButton onClick={() => go('budget')}>예산 관리</LinkButton>} /><div className="flow-overview"><div><span>들어오는 돈</span><strong>{money(f.income)}</strong></div><ArrowRight size={22} /><div><span>생활에 쓰는 돈</span><strong>{money(f.expense)}</strong></div></div><div className="flow-bar" role="img" aria-label={`생활 지출 ${money(f.expense)}, 저축 ${money(f.saving)}, 투자 ${money(f.investment)}, 남는 현금 ${money(f.cash)}`}>{([{ key: 'expense', n: f.expense }, { key: 'savings', n: f.saving }, { key: 'investment', n: f.investment }, { key: 'cash', n: Math.max(0, f.cash) }] as const).map(s => <span key={s.key} style={{ width: `${s.n / Math.max(1, f.income, f.expense + f.saving + f.investment) * 100}%`, background: colors[s.key] }} />)}</div><div className="flow-legend">{([{ label: '생활 지출', key: 'expense', n: f.expense }, { label: '저축', key: 'savings', n: f.saving }, { label: '투자', key: 'investment', n: f.investment }, { label: '남는 현금', key: 'cash', n: f.cash }] as const).map(s => <div key={s.key}><span><i className="dot" style={{ background: colors[s.key] }} />{s.label}</span><b className={s.n < 0 ? 'negative' : ''}>{compactMoney(s.n)}원</b></div>)}</div></section>
      <section className="goal-card"><div className="goal-icon"><Target size={24} /></div><span className="eyebrow">ONE STEP CLOSER</span><h2>내가 그리는 여유</h2><p>나의 순자산 목표</p><strong>{money(target)}</strong><div className="goal-track"><span style={{ width: `${progress}%` }} /></div><div className="goal-progress"><span>지금까지 {progress.toFixed(1)}%</span><button className="text-button" onClick={() => go('forecast')}>목표 바꾸기<ArrowUpRight size={14} /></button></div></section>
    </div>
    <div className="bottom-note"><ShieldCheck size={15} />내 기록은 이 기기에 저장돼요. 가끔 백업 파일도 챙겨주세요.</div>
  </>;
}

export function Assets({ data, add, edit }: ViewProps) {
  const b = balances(data.assets);
  return <>
    <div className="page-intro"><div><span className="eyebrow">MY ASSETS</span><h1>지금 가진 돈을 한눈에<span className="title-dot">.</span></h1><p>통장, 저축, 투자와 부채를 큰 금액부터 정리해요.</p></div><AddButton onClick={() => add('asset')}>자산 추가</AddButton></div>
    <div className="balance-strip"><div><span>총자산</span><strong>{money(b.total)}</strong></div><span className="math-sign">−</span><div><span>총부채</span><strong>{money(b.debt)}</strong></div><span className="math-sign">=</span><div><span>순자산</span><strong className="green">{money(b.net)}</strong></div></div>
    <div className="two-column">{(Object.keys(assetLabels) as AssetKind[]).map(kind => { const Icon = assetIcons[kind]; const entries = data.assets.filter(a => a.kind === kind); return <section className="panel asset-group" key={kind}><div className="group-head"><span className={`category-icon ${kind}`}><Icon size={21} /></span><div><h2>{assetLabels[kind]}</h2><span>{entries.length}개 항목</span></div><strong>{money(b[kind])}</strong></div>{entries.length ? <div className="entry-list">{entries.map(a => <button className="entry-row" key={a.id} onClick={() => edit('asset', a)}><span>{a.name}</span><b>{money(a.amount)}</b><Pencil size={15} /></button>)}</div> : <div className="group-empty">{kind === 'debt' ? '등록한 부채가 없어요.' : '아직 등록한 자산이 없어요.'}</div>}<button className="add-row" onClick={() => add('asset', kind)}><Plus size={16} />{assetLabels[kind]} 추가</button></section>; })}</div>
    <div className="info-note"><CircleHelp size={17} /><span>투자는 현재 평가액을 입력해 주세요. 잔액은 직접 수정하고, 월별 기록에 따로 남길 수 있어요.</span></div>
  </>;
}

export function Budget({ data, add, edit }: ViewProps) {
  const f = monthlyFlow(data.flows);
  return <>
    <div className="page-intro"><div><span className="eyebrow">MONTHLY PLAN</span><h1>한 달의 돈에 자리 만들기<span className="title-dot">.</span></h1><p>반복되는 수입과 지출, 저축·투자 금액을 설정해요.</p></div><AddButton onClick={() => add('flow')}>예산 항목 추가</AddButton></div>
    <div className={`budget-equation ${f.cash < 0 ? 'over-budget' : ''}`}><div><span>월 수입</span><strong>{compactMoney(f.income)}원</strong></div><span>−</span><div><span>생활 지출</span><strong>{compactMoney(f.expense)}원</strong></div><span>−</span><div><span>저축·투자</span><strong>{compactMoney(f.saving + f.investment)}원</strong></div><span>=</span><div><span>남는 현금</span><strong>{compactMoney(f.cash)}원</strong></div></div>
    {f.cash < 0 ? <div className="warning-note">월 배분이 수입보다 {money(-f.cash)} 많아요. 이 상태가 이어지면 기존 현금을 사용하게 돼요.</div> : null}
    <div className="two-column">{(Object.keys(flowLabels) as FlowKind[]).map(kind => { const Icon = flowIcons[kind]; const entries = data.flows.filter(x => x.kind === kind); return <section className="panel" key={kind}><div className="group-head"><span className={`category-icon ${kind}`}><Icon size={21} /></span><div><h2>{flowLabels[kind]}</h2><span>매달 반복</span></div><strong>{money(f[kind])}</strong></div>{entries.length ? <div className="entry-list">{entries.map(entry => <button className="entry-row" onClick={() => edit('flow', entry)} key={entry.id}><span>{entry.name}</span><b>{money(entry.amount)}</b><Pencil size={15} /></button>)}</div> : <div className="group-empty">대략적인 월 금액으로 시작해 보세요.</div>}<button className="add-row" onClick={() => add('flow', kind)}><Plus size={16} />{flowLabels[kind]} 추가</button></section>; })}</div>
    <div className="info-note"><CircleHelp size={18} /><span><strong>저축·투자도 내 자산이에요.</strong> 생활 지출만 순자산에서 빠지고, 저축·투자 금액은 현금에서 각각의 자산으로 이동해요.</span></div>
  </>;
}

export function Forecast({ data, add, edit, saveAssumptions, busy }: ViewProps & { saveAssumptions: (value: BudgetData['assumptions']) => Promise<boolean>; busy: boolean }) {
  const [years, setYears] = useState(3);
  const [reduction, setReduction] = useState(0);
  const [extra, setExtra] = useState(0);
  const [rate, setRate] = useState(data.assumptions.investmentRate);
  const flow = monthlyFlow(data.flows);
  const baseline = project(data, years * 12);
  const modified = reduction > 0 || extra > 0 || rate !== data.assumptions.investmentRate;
  const scenario = project(data, years * 12, { expenseReduction: reduction * 10_000, extraInvestment: extra * 10_000, investmentRate: rate });
  const last = scenario.at(-1)!;
  const firstShortfall = scenario.find(p => p.cash < 0);
  const goalPoint = scenario.find(p => p.net >= data.assumptions.target);
  const upcoming = data.events.filter(e => e.month > currentMonth()).sort((a, b) => a.month.localeCompare(b.month));
  return <>
    <div className="page-intro"><div><span className="eyebrow">FUTURE, IN YOUR HANDS</span><h1>조금 바꾸면, 얼마나 달라질까<span className="title-dot">.</span></h1><p>숫자를 움직여 보고 나에게 맞는 내일을 찾아보세요.</p></div><div className="segmented" aria-label="예측 기간">{[1, 3, 5, 10].map(y => <button aria-pressed={years === y} className={years === y ? 'active' : ''} key={y} onClick={() => setYears(y)}>{y}년</button>)}</div></div>
    <div className="forecast-layout"><section className="panel forecast-main"><div className="chart-heading"><div><span>{years}년 뒤 예상 순자산</span><strong>{money(last.net)}</strong></div>{modified ? <span className="comparison-chip">기존보다 {last.net >= baseline.at(-1)!.net ? '+' : ''}{compactMoney(last.net - baseline.at(-1)!.net)}원</span> : <span className="chip">현재 계획</span>}</div><div className="chart-legends"><span className="legend"><i className="dot" />{modified ? '바꾼 계획' : '현재 계획'}</span>{modified ? <span className="legend muted"><i className="dash" />기존 계획</span> : null}</div><TrendChart points={baseline} comparison={modified ? scenario : undefined} detailed /><div className="forecast-result"><Target size={21} /><div><strong>{goalPoint ? goalPoint.step === 0 ? '이미 목표에 도달했어요' : `${monthLabel(goalPoint.month)}, 목표에 닿아요` : `${years}년 후 목표까지 ${money(Math.max(0, data.assumptions.target - last.net))}`}</strong><p>순자산 목표 {money(data.assumptions.target)} · 현재 가정 기준</p></div></div>{firstShortfall ? <div className="warning-note">{firstShortfall.step === 0 ? '현재' : monthLabel(firstShortfall.month)}부터 현금이 부족해져요. 부족분은 음수로 표시하며 자동으로 대출하지 않아요.</div> : null}</section>
      <section className="panel scenario-panel"><span className="eyebrow">WHAT IF</span><h2>나의 작은 변화</h2><p className="panel-description">이 화면에서만 비교해요.<br />원래 월 예산은 그대로 유지돼요.</p><label className="slider-label"><span>월 생활비 줄이기<strong>{reduction}만 원</strong></span><input type="range" min="0" max={Math.floor(flow.expense / 10_000)} step="1" value={Math.min(reduction, Math.floor(flow.expense / 10_000))} onChange={e => setReduction(Number(e.target.value))} /><small>줄인 금액은 현금에 남아요.</small></label><label className="slider-label"><span>월 투자 늘리기<strong>{extra}만 원</strong></span><input type="range" min="0" max="200" step="5" value={extra} onChange={e => setExtra(Number(e.target.value))} /><small>추가 투자액만큼 현금에서 이동해요.</small></label><label className="slider-label"><span>투자 연수익률 가정<strong>{rate}%</strong></span><input type="range" min="-30" max="30" step="0.5" value={rate} onChange={e => setRate(Number(e.target.value))} /><small>예측을 위한 가정이며 보장 수익률이 아니에요.</small></label><button className="button secondary full" onClick={() => { setReduction(0); setExtra(0); setRate(data.assumptions.investmentRate); }}>현재 계획으로 되돌리기</button></section></div>
    <div className="two-column"><section className="panel"><SectionTitle title="기본 가정과 목표" /><AssumptionsForm key={JSON.stringify(data.assumptions)} data={data} save={saveAssumptions} busy={busy} /><p className="fine-print">다음 달 말부터 월 단위로 계산해요. 연수익률을 월 복리로 환산하고 월말에 저축·투자를 더해요. 세금·수수료·물가·대출 이자와 상환은 반영하지 않으며, 부채 잔액은 유지돼요.</p></section><section className="panel"><SectionTitle title="앞으로의 큰 수입·지출" action={<button className="icon-button" aria-label="예정 항목 추가" onClick={() => add('event')}><Plus size={20} /></button>} />{upcoming.length ? <div className="entry-list">{upcoming.map(e => <button className="entry-row event-row" key={e.id} onClick={() => edit('event', e)}><span><b>{e.name}</b><small>{monthLabel(e.month)}</small></span><strong className={e.kind === 'income' ? 'green' : ''}>{e.kind === 'income' ? '+' : '−'}{compactMoney(e.amount)}원</strong><Pencil size={14} /></button>)}</div> : <Empty icon={<CalendarDays size={26} />} title="미리 알고 있는 큰돈이 있나요?" description="여행, 이사, 보너스 등을 해당 월의 현금 흐름에 반영해요." action={<button className="button secondary" onClick={() => add('event')}>예정 항목 추가</button>} />}</section></div>
  </>;
}

function AssumptionsForm({ data, save, busy }: { data: BudgetData; save: (a: BudgetData['assumptions']) => Promise<boolean>; busy: boolean }) {
  const [savingsRate, setSavingsRate] = useState(String(data.assumptions.savingsRate));
  const [investmentRate, setInvestmentRate] = useState(String(data.assumptions.investmentRate));
  const [target, setTarget] = useState(String(data.assumptions.target / 10_000));
  async function submit(e: FormEvent) { e.preventDefault(); await save({ savingsRate: Number(savingsRate), investmentRate: Number(investmentRate), target: Math.round(Number(target) * 10_000) }); }
  return <form className="assumptions-form" onSubmit={submit}><fieldset disabled={busy}><div className="form-grid"><label>저축 연이율 (%)<input type="number" required min="-100" max="100" step="0.1" value={savingsRate} onChange={e => setSavingsRate(e.target.value)} /></label><label>투자 연수익률 (%)<input type="number" required min="-100" max="100" step="0.1" value={investmentRate} onChange={e => setInvestmentRate(e.target.value)} /></label></div><label>순자산 목표 (만 원)<input type="number" required min="1" max="1000000000" step="0.0001" value={target} onChange={e => setTarget(e.target.value)} /></label><button className="button secondary" type="submit"><Check size={16} />가정 저장</button></fieldset></form>;
}

export function Records({ data, snapshot, backup, restore, persist, persistence, install, canInstall, busy, demo }: { data: BudgetData; snapshot: () => void; backup: () => void; restore: (file: File) => void; persist: () => void; persistence: string; install: () => void; canInstall: boolean; busy: boolean; demo: boolean }) {
  const history = [...data.history].sort((a, b) => a.month.localeCompare(b.month));
  const points: ProjectionPoint[] = history.map((h, step) => ({ ...h, step, total: h.cash + h.savings + h.investment, net: h.cash + h.savings + h.investment - h.debt }));
  return <>
    <div className="page-intro"><div><span className="eyebrow">YOUR JOURNEY</span><h1>차곡차곡, 나의 기록<span className="title-dot">.</span></h1><p>월말의 실제 잔액을 남기고 소중한 기록을 챙겨요.</p></div><button className="button primary" disabled={busy} onClick={snapshot}><Plus size={17} />이번 달 기록</button></div>
    <section className="panel"><SectionTitle title="실제로 쌓아온 순자산" action={<span className="chip">실제 기록 {history.length}개월</span>} />{points.length ? <TrendChart points={points} detailed actual /> : <Empty icon={<History size={28} />} title="첫 번째 달을 기록해 보세요" description="자산 화면에서 현재 잔액을 수정한 뒤 ‘이번 달 기록’을 누르면 실제 자산 변화를 볼 수 있어요." />}</section>
    {history.length ? <section className="panel history-panel"><SectionTitle title="월별 기록" /><div className="table-scroll"><table><thead><tr><th>기록 월</th><th>현금</th><th>저축</th><th>투자</th><th>부채</th><th>순자산</th></tr></thead><tbody>{[...points].reverse().map(h => <tr key={h.month}><th>{monthLabel(h.month)}</th><td>{compactMoney(h.cash)}원</td><td>{compactMoney(h.savings)}원</td><td>{compactMoney(h.investment)}원</td><td>{compactMoney(h.debt)}원</td><td><strong>{compactMoney(h.net)}원</strong></td></tr>)}</tbody></table></div></section> : null}
    <div className="two-column"><section className="panel"><SectionTitle eyebrow="KEEP IT SAFE" title="기록을 오래 간직하기" /><div className="storage-summary"><span className="category-icon savings"><HardDrive size={23} /></span><div><strong>{demo ? '예시 데이터 살펴보는 중' : '이 기기에 저장하고 있어요'}</strong><p>기기 간 자동 동기화는 사용하지 않아요.</p></div></div><div className="backup-status"><span>최근 백업 파일 생성</span><strong>{data.lastBackupAt ? new Date(data.lastBackupAt).toLocaleDateString('ko-KR') : '아직 백업하지 않았어요'}</strong></div><div className="button-pair"><button className="button primary" disabled={busy || demo} onClick={backup}><Download size={17} />백업 내보내기</button><label className={`button secondary file-button ${busy || demo ? 'disabled' : ''}`}><FolderOpen size={17} />백업 불러오기<input aria-label="백업 파일 선택" type="file" accept=".json,application/json" disabled={busy || demo} onChange={e => { const file = e.target.files?.[0]; if (file) restore(file); e.target.value = ''; }} /></label></div><p className="fine-print">백업 파일에는 실제 금액이 포함돼요. 다운로드한 파일을 PC나 개인 드라이브 등 기기 밖에도 보관해 주세요. 브라우저 데이터 삭제·기기 분실 시에는 백업 파일로 복원할 수 있어요.</p></section>
      <section className="panel"><SectionTitle eyebrow="MAKE YOURSELF AT HOME" title="앱처럼 편하게" /><div className="settings-item"><span className="soft-icon"><Smartphone size={21} /></span><div><h3>홈 화면에 모아 두기</h3><p>처음 접속해 오프라인 준비가 완료되면<br />인터넷 없이도 기록할 수 있어요.</p></div></div><button className="button secondary full" onClick={install}>{canInstall ? '홈 화면에 설치하기' : '설치 방법 보기'}<ArrowUpRight size={16} /></button><div className="settings-divider" /><div className="settings-item"><span className="soft-icon"><ShieldCheck size={21} /></span><div><h3>기록 보존 요청</h3><p>{persistence}</p></div></div><button className="button secondary full" onClick={persist} disabled={demo}>브라우저에 보존 요청</button><p className="fine-print">브라우저가 요청을 승인해도 직접 삭제는 막을 수 없어요. 파일 백업도 함께 사용해 주세요.</p></section></div>
    <div className="bottom-note"><Sparkles size={15} />모아 v0.1 · 오늘의 작은 기록이 내일의 여유가 되도록.</div>
  </>;
}

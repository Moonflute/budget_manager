import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { ArrowUpRight, ChartNoAxesCombined, Check, CircleAlert, CloudOff, History, LayoutDashboard, PanelLeftClose, Play, SlidersHorizontal, Wallet, X, RefreshCw } from 'lucide-react';
import { Brand, EntryForm, Modal, type Entry, type EntryMode } from './components';
import { Overview, Assets, Budget, Forecast, Records, type Page, type ViewProps } from './views';
import { balances, currentMonth, demoData, emptyData, makeBackup, money, parseBackup, takeSnapshot, type Asset, type BudgetData, type Flow, type PlannedEvent } from './model';
import { readData, writeData } from './storage';

type DialogState = { type: 'entry'; mode: EntryMode; entry?: Entry; kind?: string } | { type: 'confirm'; title: string; description: string; action: () => Promise<boolean>; button: string; danger?: boolean } | { type: 'install' };
interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
const nav: { id: Page; label: string; icon: typeof Wallet }[] = [
  { id: 'overview', label: '한눈에 보기', icon: LayoutDashboard },
  { id: 'assets', label: '나의 자산', icon: Wallet },
  { id: 'budget', label: '월 예산', icon: SlidersHorizontal },
  { id: 'forecast', label: '미래 그리기', icon: ChartNoAxesCombined },
  { id: 'records', label: '기록과 백업', icon: History },
];
const errorMessage = (error: unknown) => error instanceof Error ? error.message : '작업을 완료하지 못했어요. 다시 시도해 주세요.';

export default function App() {
  const [real, setReal] = useState<BudgetData>(emptyData);
  const [example, setExample] = useState<BudgetData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [page, setPage] = useState<Page>('overview');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const revision = useRef(0);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [persistence, setPersistence] = useState('보존 상태를 확인하고 있어요.');
  const data = example ?? real;
  const demo = example !== null;
  const { needRefresh: [needRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW({ onRegisterError: () => setError('오프라인 준비를 완료하지 못했어요. 연결 상태를 확인한 뒤 새로고침해 주세요.') });

  useEffect(() => {
    let active = true;
    readData().then(stored => { if (active) { setReal(stored.data); revision.current = stored.revision; setStorageReady(true); } }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoaded(true); });
    navigator.storage?.persisted?.().then(value => { if (active) setPersistence(value ? '브라우저가 지속 보존을 승인했어요.' : '일반 저장 중이에요. 보존 요청을 할 수 있어요.'); }).catch(() => { if (active) setPersistence('보존 상태를 확인할 수 없어요.'); });
    const connectivity = () => setOnline(navigator.onLine);
    const capture = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    const installed = () => setInstallPrompt(null);
    window.addEventListener('online', connectivity);
    window.addEventListener('offline', connectivity);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', installed);
    return () => { active = false; window.removeEventListener('online', connectivity); window.removeEventListener('offline', connectivity); window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', installed); };
  }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);

  const apply = useCallback(async (next: BudgetData, message = '이 기기에 저장했어요.'): Promise<boolean> => {
    if (busyRef.current) return false;
    if (example !== null) { setExample(next); setToast('예시에서 변경했어요. 실제 기록에는 반영되지 않아요.'); return true; }
    if (!storageReady) { setError('기기 저장소를 사용할 수 없어요. 기록을 저장하려면 저장 권한을 확인하고 새로고침해 주세요.'); return false; }
    busyRef.current = true; setBusy(true); setError('');
    try {
      const value = { ...next, updatedAt: new Date().toISOString() };
      revision.current = await writeData(value, revision.current);
      setReal(value); setToast(message); return true;
    } catch (e) { setError(errorMessage(e)); return false; }
    finally { busyRef.current = false; setBusy(false); }
  }, [example, storageReady]);

  function go(next: Page) { setPage(next); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function add(mode: EntryMode, kind?: string) { setDialog({ type: 'entry', mode, kind }); }
  function edit(mode: EntryMode, entry: Entry) { setDialog({ type: 'entry', mode, entry }); }
  async function saveEntry(entry: Entry) {
    if (dialog?.type !== 'entry') return false;
    const key = dialog.mode === 'asset' ? 'assets' : dialog.mode === 'flow' ? 'flows' : 'events';
    const entries: Entry[] = [...data[key]];
    const index = entries.findIndex(x => x.id === entry.id);
    if (index >= 0) entries[index] = entry; else entries.push(entry);
    const success = await apply({ ...data, [key]: entries as Asset[] & Flow[] & PlannedEvent[] });
    if (success) setDialog(null);
    return success;
  }
  function removeEntry() {
    if (dialog?.type !== 'entry' || !dialog.entry) return;
    const entry = dialog.entry;
    const key = dialog.mode === 'asset' ? 'assets' : dialog.mode === 'flow' ? 'flows' : 'events';
    setDialog({ type: 'confirm', title: '이 항목을 삭제할까요?', description: `‘${entry.name}’을 삭제해요. 이미 남긴 월별 기록은 유지돼요.`, button: '항목 삭제', danger: true, action: () => apply({ ...data, [key]: data[key].filter(x => x.id !== entry.id) }) });
  }
  function snapshot() {
    const month = currentMonth();
    const existing = data.history.some(h => h.month === month);
    setDialog({ type: 'confirm', title: existing ? '이번 달 기록을 갱신할까요?' : '이번 달의 나를 기록할까요?', description: `현재 순자산 ${money(balances(data.assets).net)}을 실제 기록으로 남겨요. ${existing ? '기존 이번 달 기록은 현재 잔액으로 바뀌어요.' : '먼저 자산 화면의 잔액이 실제와 맞는지 확인해 주세요.'}`, button: existing ? '기록 갱신' : '기록 남기기', action: () => apply({ ...data, history: [...data.history.filter(h => h.month !== month), takeSnapshot(data, month)] }, '이번 달 실제 잔액을 기록했어요.') });
  }
  async function backup() {
    if (demo || busy) return;
    const exported = { ...real, lastBackupAt: new Date().toISOString() };
    // Export remains available if saving is temporarily unavailable.
    try {
      const text = makeBackup(exported);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `moa-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      await apply(exported, '백업 파일을 생성했어요. 다운로드한 파일을 보관해 주세요.');
    } catch (e) { setError(errorMessage(e)); }
  }
  async function restore(file: File) {
    try {
      if (file.size > 2_000_000) throw new Error('2MB 이하의 백업 파일을 선택해 주세요.');
      const imported = parseBackup(await file.text());
      setDialog({ type: 'confirm', title: '백업에서 기록을 불러올까요?', description: `자산 ${imported.assets.length}개, 예산 ${imported.flows.length}개, 월별 기록 ${imported.history.length}개가 있어요. 현재 이 기기의 기록 전체가 백업 내용으로 바뀌어요. 필요한 기록은 먼저 내보내 주세요.`, button: '백업으로 교체', action: () => apply(imported, '백업에서 기록을 복원했어요.') });
    } catch (e) { setError(errorMessage(e)); }
  }
  async function persist() {
    if (!navigator.storage?.persist) { setPersistence('이 브라우저에서는 보존 요청을 지원하지 않아요.'); return; }
    try { const granted = await navigator.storage.persist(); setPersistence(granted ? '브라우저가 지속 보존을 승인했어요.' : '아직 승인되지 않았어요. 파일 백업도 챙겨주세요.'); } catch { setPersistence('보존 요청을 완료하지 못했어요.'); }
  }
  async function install() {
    if (!installPrompt) { setDialog({ type: 'install' }); return; }
    try { await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); } catch { setDialog({ type: 'install' }); }
  }
  const props: ViewProps = { data, go, add, edit };
  if (!loaded) return <div className="loading-screen"><Brand /><span className="loading-dot" /><p>내 기록을 불러오고 있어요.</p></div>;
  return <div className="app-shell">
    <a className="skip-link" href="#main">본문으로 이동</a>
    <aside className="sidebar"><a className="brand-link" href="#" onClick={event => { event.preventDefault(); go('overview'); }} aria-label="모아 홈"><Brand /></a><div className="sidebar-caption">나의 돈, 앞으로의 가능성</div><div className="nav-caption">MY SPACE</div><nav aria-label="주 메뉴">{nav.map(item => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} aria-current={page === item.id ? 'page' : undefined} onClick={() => go(item.id)}><item.icon size={20} /><span>{item.label}</span>{page === item.id ? <i /> : null}</button>)}</nav><div className="sidebar-bottom"><div className="little-plant" aria-hidden="true">✳</div><strong>내 속도로, 차곡차곡.</strong><p>작은 계획이 쌓여<br />나만의 여유가 되도록.</p><span><span className="status-dot" />이 기기에 보관</span></div></aside>
    <div className="workspace"><header className="topbar"><div className="topbar-brand"><Brand /></div><div className="breadcrumb">나의 공간<span>/</span><strong>{nav.find(n => n.id === page)?.label}</strong></div><div className="topbar-actions"><span className={`save-state ${error ? 'negative' : ''}`} aria-live="polite">{demo ? <Play size={14} /> : !online ? <CloudOff size={15} /> : busy ? <RefreshCw size={14} className="spin" /> : <Check size={15} />}{demo ? '예시 데이터' : busy ? '저장 중' : !storageReady ? '저장 불가' : !online ? '오프라인' : real.updatedAt ? '기기에 저장됨' : '기기 저장 준비됨'}</span><button className={`button small ${demo ? 'primary' : 'secondary'}`} disabled={busy} onClick={() => { setExample(demo ? null : demoData()); go('overview'); }}>{demo ? <PanelLeftClose size={15} /> : <Play size={14} />}{demo ? '내 기록으로' : '예시 둘러보기'}</button></div></header>
      {demo ? <div className="demo-banner"><SparkleMark /><span>예시 데이터로 둘러보고 있어요. 변경해도 내 기록에는 영향을 주지 않아요.</span><button onClick={() => { setExample(null); go('assets'); }}>내 자산 입력<ArrowUpRight size={15} /></button></div> : null}
      {error ? <div className="error-banner" role="alert"><CircleAlert size={19} /><span>{error}</span><button className="text-button" onClick={() => window.location.reload()}>새로고침</button><button className="icon-button" aria-label="오류 알림 닫기" onClick={() => setError('')}><X size={17} /></button></div> : null}
      <main id="main" className="main-content" key={demo ? `demo-${page}` : page}>{page === 'overview' ? <Overview {...props} /> : page === 'assets' ? <Assets {...props} /> : page === 'budget' ? <Budget {...props} /> : page === 'forecast' ? <Forecast {...props} busy={busy} saveAssumptions={a => apply({ ...data, assumptions: a })} /> : <Records data={data} snapshot={snapshot} backup={backup} restore={restore} persist={persist} persistence={persistence} install={install} canInstall={!!installPrompt} busy={busy} demo={demo} />}</main>
    </div>
    <nav className="mobile-nav" aria-label="모바일 주 메뉴">{nav.map(item => <button key={item.id} aria-current={page === item.id ? 'page' : undefined} className={page === item.id ? 'active' : ''} onClick={() => go(item.id)}><item.icon size={21} /><span>{item.label}</span></button>)}</nav>
    {toast ? <div className="toast" role="status"><Check size={17} />{toast}</div> : null}
    {(needRefresh || offlineReady) ? <div className="pwa-notice" role="status"><div><strong>{needRefresh ? '새로운 모아가 준비됐어요' : '오프라인 준비 완료'}</strong><p>{needRefresh ? '저장한 기록을 유지하고 새 버전으로 열어요.' : '인터넷 없이도 기록하고 확인할 수 있어요.'}</p></div>{needRefresh ? <button className="button small primary" disabled={busy || !!dialog} onClick={() => updateServiceWorker(true)}>업데이트</button> : <button className="icon-button" aria-label="오프라인 안내 닫기" onClick={() => setOfflineReady(false)}><X size={18} /></button>}</div> : null}
    {dialog?.type === 'entry' ? <Modal title={`${dialog.mode === 'asset' ? '자산' : dialog.mode === 'flow' ? '월 예산' : '예정'} 항목 ${dialog.entry ? '수정' : '추가'}`} subtitle="나에게 맞는 이름과 대략적인 금액을 입력해요." close={() => setDialog(null)} busy={busy}><EntryForm mode={dialog.mode} entry={dialog.entry} initialKind={dialog.kind} save={saveEntry} remove={dialog.entry ? removeEntry : undefined} busy={busy} /></Modal> : null}
    {dialog?.type === 'confirm' ? <Modal title={dialog.title} close={() => setDialog(null)} busy={busy}><p className="confirm-description">{dialog.description}</p><div className="form-actions"><button className="button secondary" disabled={busy} onClick={() => setDialog(null)}>취소</button><button className={`button ${dialog.danger ? 'danger solid' : 'primary'}`} disabled={busy} onClick={async () => { if (await dialog.action()) setDialog(null); }}>{busy ? '처리 중…' : dialog.button}</button></div></Modal> : null}
    {dialog?.type === 'install' ? <Modal title="모아를 홈 화면에 추가하기" close={() => setDialog(null)}><div className="install-instructions"><h3>아이폰·아이패드</h3><p>브라우저의 공유 메뉴에서 <strong>홈 화면에 추가</strong>를 선택해 주세요.</p><h3>안드로이드</h3><p>Chrome 또는 삼성 인터넷 메뉴에서 <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 선택해 주세요.</p><p className="fine-print">설치 방식은 브라우저에 따라 달라요. 기록은 사용한 브라우저와 기기에 저장되므로 다른 환경으로 옮길 때는 백업 파일을 사용해 주세요.</p></div><button className="button primary full" onClick={() => setDialog(null)}>확인했어요</button></Modal> : null}
  </div>;
}
function SparkleMark() { return <span className="demo-spark" aria-hidden="true">✳</span>; }

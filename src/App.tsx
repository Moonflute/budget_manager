import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { ChartNoAxesCombined, Check, CircleAlert, CloudOff, History, GitFork, Plus, SlidersHorizontal, Wallet, X, RefreshCw } from 'lucide-react';
import { Brand, EntryForm, Modal } from './components';
import { EntrySheet, entryCategory, type EntryCategory } from './EntrySheet';
import type { Entry, EntryMode, PreparedEntry } from './entryInput';
import { Assets, Budget, Forecast, Records, type Page, type ViewProps } from './views';
import { MonthlySankey } from './MonthlySankey';
import { balances, currentMonth, emptyData, makeBackup, money, parseBackup, takeSnapshot, type BudgetData } from './model';
import { readData, writeData } from './storage';

type DialogState = { type: 'sheet'; category: EntryCategory } | { type: 'entry'; mode: EntryMode; entry: Entry } | { type: 'confirm'; title: string; description: string; action: () => Promise<boolean>; button: string; danger?: boolean } | { type: 'install' };
interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
const shortcuts: { id: Page; label: string; shortLabel: string; icon: typeof Wallet }[] = [
  { id: 'overview', label: '월 현금 흐름', shortLabel: '홈', icon: GitFork },
  { id: 'assets', label: '나의 자산', shortLabel: '자산', icon: Wallet },
  { id: 'budget', label: '월 예산', shortLabel: '예산', icon: SlidersHorizontal },
  { id: 'records', label: '기록과 백업', shortLabel: '백업', icon: History },
  { id: 'forecast', label: '자산 예측', shortLabel: '예측', icon: ChartNoAxesCombined },
];
const errorMessage = (error: unknown) => error instanceof Error ? error.message : '작업을 완료하지 못했어요. 다시 시도해 주세요.';

function upsert<T extends Entry>(entries: T[], entry: T) {
  const index = entries.findIndex(item => item.id === entry.id);
  if (index < 0) entries.push(entry);
  else entries[index] = entry;
}

export default function App() {
  const [data, setData] = useState<BudgetData>(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [page, setPage] = useState<Page>('overview');
  const [forecastVisit, setForecastVisit] = useState(0);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const revision = useRef(0);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [persistence, setPersistence] = useState('보존 상태를 확인하고 있어요.');
  const { needRefresh: [needRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW({ onRegisterError: () => setError('오프라인 준비를 완료하지 못했어요. 연결 상태를 확인한 뒤 새로고침해 주세요.') });

  useEffect(() => {
    let active = true;
    readData().then(stored => { if (active) { setData(stored.data); revision.current = stored.revision; setStorageReady(true); } }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoaded(true); });
    navigator.storage?.persisted?.().then(value => { if (active) setPersistence(value ? '브라우저가 지속 보존을 승인했어요.' : '일반 저장 중'); }).catch(() => { if (active) setPersistence('보존 상태를 확인할 수 없어요.'); });
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

  const apply = useCallback(async (next: BudgetData, message = '저장 완료'): Promise<boolean> => {
    if (busyRef.current) return false;
    if (!storageReady) { setError('기기 저장소를 사용할 수 없어요. 기록을 저장하려면 저장 권한을 확인하고 새로고침해 주세요.'); return false; }
    busyRef.current = true; setBusy(true); setError('');
    try {
      const value = { ...next, updatedAt: new Date().toISOString() };
      revision.current = await writeData(value, revision.current);
      setData(value); setToast(message); return true;
    } catch (e) { setError(errorMessage(e)); return false; }
    finally { busyRef.current = false; setBusy(false); }
  }, [storageReady]);

  function go(next: Page) { setPage(next); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function openForecast() {
    setForecastVisit(visit => visit + 1);
    go('forecast');
  }
  function add(mode: EntryMode, kind?: string) { setDialog({ type: 'sheet', category: entryCategory(mode, kind) }); }
  function edit(mode: EntryMode, entry: Entry) { setDialog({ type: 'entry', mode, entry }); }
  async function saveEntries(entries: PreparedEntry[]) {
    if (dialog?.type !== 'entry' && dialog?.type !== 'sheet') return false;
    const next = { ...data, assets: [...data.assets], flows: [...data.flows], events: [...data.events] };
    for (const item of entries) {
      if (item.mode === 'asset') upsert(next.assets, item.entry);
      else if (item.mode === 'flow') upsert(next.flows, item.entry);
      else upsert(next.events, item.entry);
    }
    const success = await apply(next);
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
    setDialog({ type: 'confirm', title: existing ? '이번 달 기록을 갱신할까요?' : '이번 달 기록을 남길까요?', description: `현재 순자산 ${money(balances(data.assets).net)}. ${existing ? '기존 기록을 현재 잔액으로 덮어써요.' : '현재 자산 잔액을 기록해요.'}`, button: existing ? '기록 갱신' : '기록 남기기', action: () => apply({ ...data, history: [...data.history.filter(h => h.month !== month), takeSnapshot(data, month)] }, '이번 달 기록 완료') });
  }
  async function backup() {
    if (busy) return;
    const exported = { ...data, lastBackupAt: new Date().toISOString() };
    // Export remains available if saving is temporarily unavailable.
    try {
      const text = makeBackup(exported);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `budget-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      await apply(exported, '백업 파일 생성 완료');
    } catch (e) { setError(errorMessage(e)); }
  }
  async function restore(file: File) {
    try {
      if (file.size > 2_000_000) throw new Error('2MB 이하의 백업 파일을 선택해 주세요.');
      const imported = parseBackup(await file.text());
      setDialog({
        type: 'confirm',
        title: '백업에서 기록을 불러올까요?',
        description: `자산 ${imported.assets.length}개 · 월 예산 ${imported.flows.length}개 · 일회성 항목 ${imported.events.length}개 · 월별 기록 ${imported.history.length}개. 현재 기기의 기록 전체를 교체해요.`,
        button: '백업으로 교체',
        action: () => apply(imported, '백업에서 기록을 복원했어요.'),
      });
    } catch (e) { setError(errorMessage(e)); }
  }
  async function persist() {
    if (!navigator.storage?.persist) { setPersistence('이 브라우저에서는 보존 요청을 지원하지 않아요.'); return; }
    try { const granted = await navigator.storage.persist(); setPersistence(granted ? '브라우저가 지속 보존을 승인했어요.' : '보존 요청이 승인되지 않았어요.'); } catch { setPersistence('보존 요청을 완료하지 못했어요.'); }
  }
  async function install() {
    if (!installPrompt) { setDialog({ type: 'install' }); return; }
    try { await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); } catch { setDialog({ type: 'install' }); }
  }
  const props: ViewProps = { data, add, edit };
  const saveStatus = busy ? '저장 중' : !storageReady ? '저장 불가' : !online ? '오프라인' : data.updatedAt ? '기기에 저장됨' : '기기 저장 준비됨';
  if (!loaded) return <div className="loading-screen"><Brand /><span className="loading-dot" /><p>불러오는 중…</p></div>;
  return <div className="app-shell">
    <a className="skip-link" href="#main">본문으로 이동</a>
    <div className="workspace">
      <header className="topbar">
        <a className="topbar-brand brand-link" href="#" onClick={event => { event.preventDefault(); go('overview'); }} aria-label="Budget Manager 홈"><Brand /></a>
        <div className="topbar-actions">
          <span className={`save-state ${error ? 'negative' : ''}`} title={saveStatus} aria-live="polite">
            {!online ? <CloudOff size={15} aria-hidden="true" /> : busy ? <RefreshCw size={14} className="spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
            <span className="save-state-label">{saveStatus}</span>
          </span>
          <div className="topbar-main-actions">
            <nav className="topbar-navigation" aria-label="주 메뉴">
              {shortcuts.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className="button secondary topbar-shortcut"
                  aria-label={item.label}
                  title={item.label}
                  aria-current={page === item.id ? 'page' : undefined}
                  onClick={item.id === 'forecast' ? openForecast : () => go(item.id)}
                >
                  <item.icon size={17} aria-hidden="true" /><span>{item.shortLabel}</span>
                </button>
              ))}
            </nav>
            <button type="button" className="button primary topbar-input" disabled={busy} aria-label="입력" title="입력" aria-haspopup="dialog" onClick={() => add('flow')}>
              <Plus size={17} aria-hidden="true" /><span className="topbar-input-label">입력</span>
            </button>
          </div>
        </div>
      </header>
      {error ? <div className="error-banner" role="alert"><CircleAlert size={19} /><span>{error}</span><button className="text-button" onClick={() => window.location.reload()}>새로고침</button><button className="icon-button" aria-label="오류 알림 닫기" onClick={() => setError('')}><X size={17} /></button></div> : null}
      <main id="main" className="main-content" key={page}>{page === 'overview' ? <MonthlySankey flows={data.flows} assets={data.assets} events={data.events} /> : page === 'assets' ? <Assets {...props} /> : page === 'budget' ? <Budget {...props} /> : page === 'forecast' ? <Forecast key={forecastVisit} {...props} busy={busy} saveAssumptions={a => apply({ ...data, assumptions: a })} /> : <Records data={data} snapshot={snapshot} backup={backup} restore={restore} persist={persist} persistence={persistence} install={install} canInstall={!!installPrompt} busy={busy} />}</main>
    </div>
    {toast ? <div className="toast" role="status"><Check size={17} />{toast}</div> : null}
    {(needRefresh || offlineReady) ? <div className="pwa-notice" role="status"><div><strong>{needRefresh ? '새로운 Budget Manager가 준비됐어요' : '오프라인 준비 완료'}</strong></div>{needRefresh ? <button className="button small primary" disabled={busy || !!dialog} onClick={() => updateServiceWorker(true)}>업데이트</button> : <button className="icon-button" aria-label="오프라인 안내 닫기" onClick={() => setOfflineReady(false)}><X size={18} /></button>}</div> : null}
    {dialog?.type === 'sheet' ? (
      <Modal title="항목 입력" className="entry-sheet-modal" close={() => setDialog(null)} busy={busy}>
        <EntrySheet initialCategory={dialog.category} save={saveEntries} busy={busy} />
      </Modal>
    ) : null}
    {dialog?.type === 'entry' ? (
      <Modal
        title={`${
          dialog.mode === 'event' && dialog.entry.kind === 'income'
            ? '비정기 수입'
            : { asset: '자산 항목', flow: '월 예산 항목', event: '예정 항목' }[dialog.mode]
        } 수정`}
        close={() => setDialog(null)}
        busy={busy}
      >
        <EntryForm mode={dialog.mode} entry={dialog.entry} save={entry => saveEntries([entry])} remove={removeEntry} busy={busy} />
      </Modal>
    ) : null}
    {dialog?.type === 'confirm' ? <Modal title={dialog.title} close={() => setDialog(null)} busy={busy}><p className="confirm-description">{dialog.description}</p><div className="form-actions"><button className="button secondary" disabled={busy} onClick={() => setDialog(null)}>취소</button><button className={`button ${dialog.danger ? 'danger solid' : 'primary'}`} disabled={busy} onClick={async () => { if (await dialog.action()) setDialog(null); }}>{busy ? '처리 중…' : dialog.button}</button></div></Modal> : null}
    {dialog?.type === 'install' ? <Modal title="Budget Manager를 홈 화면에 추가하기" close={() => setDialog(null)}><div className="install-instructions"><h3>아이폰·아이패드</h3><p>공유 메뉴 → <strong>홈 화면에 추가</strong></p><h3>안드로이드</h3><p>브라우저 메뉴 → <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong></p></div><button className="button primary full" onClick={() => setDialog(null)}>확인했어요</button></Modal> : null}
  </div>;
}

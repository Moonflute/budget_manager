import { useState } from 'react';
import { ChartPie, GitFork } from 'lucide-react';
import { MonthlySankey } from './MonthlySankey';
import { AssetAllocation } from './AssetAllocation';
import { demoData, type BudgetData } from './model';

const exampleAssets = demoData().assets;

export function HomeOverview({ data, month, changeMonth, addAsset }: {
  data: BudgetData;
  month: string;
  changeMonth: (month: string) => void;
  addAsset: () => void;
}) {
  const [view, setView] = useState<'flow' | 'assets'>('flow');
  const [basis, setBasis] = useState<'plan' | 'recorded'>('recorded');
  const example = ![data.assets, data.flows, data.events, data.importedExpenses, data.history].some(items => items.length);

  return <>
    <div className="home-chart-switch" role="group" aria-label="홈 그래프">
      <button type="button" aria-label="수입·지출" title="수입·지출" aria-pressed={view === 'flow'} aria-controls="home-chart" onClick={() => setView('flow')}>
        <GitFork size={18} aria-hidden="true" />
      </button>
      <button type="button" aria-label="자산 비중" title="자산 비중" aria-pressed={view === 'assets'} aria-controls="home-chart" onClick={() => setView('assets')}>
        <ChartPie size={18} aria-hidden="true" />
      </button>
    </div>
    <div id="home-chart">
      {view === 'flow'
        ? <MonthlySankey data={data} month={month} changeMonth={changeMonth} basis={basis} changeBasis={setBasis} />
        : <AssetAllocation assets={example ? exampleAssets : data.assets} example={example} addAsset={addAsset} />}
    </div>
  </>;
}

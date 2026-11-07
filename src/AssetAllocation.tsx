import { useCallback, useMemo, useState } from 'react';
import ReactEChartsCore from 'echarts-for-react/esm/core';
import * as echarts from 'echarts/core';
import { PieChart, type PieSeriesOption } from 'echarts/charts';
import { TooltipComponent, type TooltipComponentOption } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { assetLabels, balances, compactMoney, investmentAccountLabels, investmentProductLabels, money, type Asset } from './model';

echarts.use([PieChart, TooltipComponent, SVGRenderer]);

type AllocationOption = echarts.ComposeOption<PieSeriesOption | TooltipComponentOption>;
const chartRenderer = { renderer: 'svg' } as const;
const assetColors = {
  cash: ['#527cbd', '#7e9dcc', '#365d96', '#a1b8da'],
  savings: ['#429686', '#79b4a7', '#2d7266', '#a0cec1'],
  investment: ['#8d78b8', '#b09bd2', '#6d5797', '#c8b8e0'],
};

function share(amount: number, total: number) {
  const percent = total > 0 ? amount / total * 100 : 0;
  return percent > 0 && percent < 0.1 ? '<0.1%' : `${percent.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;
}

function assetDetail(asset: Asset) {
  const investment = asset.investment;
  return [assetLabels[asset.kind],
    investment?.product ? investmentProductLabels[investment.product] : null,
    investment?.account ? investmentAccountLabels[investment.account] : null,
  ].filter(Boolean).join(' · ');
}

export function AssetAllocation({ assets, example, addAsset }: { assets: Asset[]; example: boolean; addAsset: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const totals = balances(assets);
  const parts = useMemo(() => {
    const colorIndex = { cash: 0, savings: 0, investment: 0 };
    return assets.filter(asset => asset.kind !== 'debt' && asset.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map(asset => {
        const kind = asset.kind as keyof typeof assetColors;
        const palette = assetColors[kind];
        return { ...asset, color: palette[colorIndex[kind]++ % palette.length] };
      });
  }, [assets]);
  const selected = parts.find(part => part.id === selectedId);
  const select = useCallback((id: string) => setSelectedId(previous => previous === id ? null : id), []);
  const events = useMemo(() => ({ click: (params: { data?: { id?: string } }) => {
    if (params.data?.id) select(params.data.id);
  } }), [select]);
  const option = useMemo<AllocationOption>(() => ({
    animation: false,
    tooltip: {
      trigger: 'item',
      confine: true,
      renderMode: 'richText',
      formatter: params => {
        const item = Array.isArray(params) ? params[0] : params;
        return `${item.name}\n${money(Number(item.value))} · ${share(Number(item.value), totals.total)}`;
      },
    },
    series: [{
      type: 'pie',
      radius: ['63%', '86%'],
      center: ['50%', '50%'],
      startAngle: 90,
      label: { show: false },
      labelLine: { show: false },
      stillShowZeroSum: false,
      showEmptyCircle: true,
      emptyCircleStyle: { color: '#e2e8f1' },
      emphasis: { scale: false },
      data: parts.map(part => ({
        id: part.id,
        name: part.name,
        value: part.amount,
        itemStyle: { color: part.color, opacity: selected && selected.id !== part.id ? 0.3 : 1 },
      })),
    }],
  }), [parts, selected, totals.total]);
  const description = parts.length
    ? `현재 자산 비중 · 총자산 ${money(totals.total)} · ${parts.map(part => `${part.name} ${money(part.amount)} ${share(part.amount, totals.total)}`).join(', ')}`
    : '현재 자산 비중 · 자산 항목 없음';

  return <section className="asset-allocation" aria-label="현재 자산">
    <div className="allocation-caption">
      <span>현재 자산{example ? ' · 예시' : ''}</span>
      {selected ? <button type="button" className="text-button" onClick={() => setSelectedId(null)}>전체 보기</button> : null}
    </div>
    <div className="allocation-donut">
      <div className="allocation-canvas" role="img" aria-label={description}>
        <ReactEChartsCore echarts={echarts} option={option} onEvents={events} opts={chartRenderer} style={{ width: '100%', height: '100%' }} />
      </div>
      <div className="allocation-center" aria-live="polite" aria-atomic="true">
        <span>{selected?.name ?? '총자산'}</span>
        <strong>{compactMoney(selected?.amount ?? totals.total)}<small>원</small></strong>
        <span>{selected ? share(selected.amount, totals.total) : `${parts.length}개 항목`}</span>
      </div>
    </div>
    <dl className="allocation-totals">
      <div><dt>순자산</dt><dd title={money(totals.net)}>{compactMoney(totals.net)}원</dd></div>
      <div><dt>부채</dt><dd title={money(totals.debt)}>{compactMoney(totals.debt)}원</dd></div>
    </dl>
    {parts.length ? <ul className="allocation-items" aria-label="자산별 금액과 비중">
      {parts.map(part => <li key={part.id}>
        <button type="button" aria-pressed={selected?.id === part.id} onClick={() => select(part.id)}>
          <span className="allocation-swatch" style={{ backgroundColor: part.color }} aria-hidden="true" />
          <span className="allocation-name"><strong>{part.name}</strong><small>{assetDetail(part)}</small></span>
          <span className="allocation-value"><strong>{money(part.amount)}</strong><small>{share(part.amount, totals.total)}</small></span>
        </button>
      </li>)}
    </ul> : <div className="allocation-empty"><p>자산 항목 없음</p><button type="button" className="button secondary" onClick={addAsset}>자산 추가</button></div>}
  </section>;
}

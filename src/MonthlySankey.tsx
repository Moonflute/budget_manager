import { useMemo, useState } from 'react';
import ReactEChartsCore from 'echarts-for-react/esm/core';
import * as echarts from 'echarts/core';
import { SankeyChart, type SankeySeriesOption } from 'echarts/charts';
import { TooltipComponent, type TooltipComponentOption } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { GitFork } from 'lucide-react';
import { MonthControl } from './components';
import { compactMoney, currentMonth, exampleFlows, flowLabels, flowsForMonth, recordedFlowsForMonth, money, monthLabel, monthlyFlow, type BudgetData, type Flow, type FlowKind } from './model';

echarts.use([SankeyChart, TooltipComponent, SVGRenderer]);

type SankeyOption = echarts.ComposeOption<SankeySeriesOption | TooltipComponentOption>;
type ChartPart = { id: string; name: string; value: number; color: string };
const chartRenderer = { renderer: 'svg' } as const;
const colors = {
  income: '#2864c7',
  expense: '#c34553',
  saving: '#168164',
  investment: '#744cb5',
  cash: '#68778a',
  deficit: '#93364d',
};

function visibleItems(flows: Flow[], kind: 'income' | 'expense'): ChartPart[] {
  const items = flows
    .filter(flow => flow.kind === kind && flow.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const visible = items.length > 3 ? items.slice(0, 2) : items;
  const parts = visible.map(item => ({
    id: `${'month' in item ? 'event' : 'item'}:${item.id}`, name: item.name, value: item.amount, color: colors[kind],
  }));
  if (items.length > visible.length) {
    parts.push({
      id: `other:${kind}`,
      name: kind === 'income' ? '기타 수입' : '기타 지출',
      value: items.slice(visible.length).reduce((sum, item) => sum + item.amount, 0),
      color: colors[kind],
    });
  }
  return parts;
}

function chartNode(part: ChartPart, depth: number, position: 'left' | 'right' | 'top' | 'bottom') {
  const inside = position === 'top' || position === 'bottom';
  return {
    id: part.id,
    name: part.name,
    value: part.value,
    depth,
    itemStyle: { color: part.color },
    label: {
      position,
      color: inside ? part.color : '#1c304d',
      textBorderColor: '#fff',
      textBorderWidth: inside ? 3 : 0,
    },
  };
}

function monthlySankey({ flows, assets }: Pick<BudgetData, 'flows' | 'assets'>, expenseLabel: string) {
  const flow = monthlyFlow({ flows, assets });
  if (!flow.income && !flow.expense && !flow.saving && !flow.investment) return null;
  const deficit = Math.max(0, -flow.cash);
  const sources = visibleItems(flows, 'income');
  if (deficit) sources.push({ id: 'deficit', name: '부족액', value: deficit, color: colors.deficit });

  // The shortfall contributes to the planned allocation, not to reported income.
  const total = {
    id: 'total', name: deficit ? '월 배분' : '총수입', value: flow.income + deficit,
    color: deficit ? '#526782' : colors.income,
  };
  const branches = [
    {
      id: 'expenses', name: expenseLabel, value: flow.expense, color: colors.expense,
      items: visibleItems(flows, 'expense'),
    },
    {
      id: 'allocations', name: '저축·투자', value: flow.saving + flow.investment, color: colors.saving,
      items: [
        { id: 'saving', name: flowLabels.saving, value: flow.saving, color: colors.saving },
        { id: 'investment', name: flowLabels.investment, value: flow.investment, color: colors.investment },
      ].filter(part => part.value > 0),
    },
  ].filter(branch => branch.value > 0);
  const remaining = flow.cash > 0 ? [{ id: 'cash', name: '남는 현금', value: flow.cash, color: colors.cash }] : [];
  const destinations = [...branches.flatMap(branch => branch.items), ...remaining];
  const nodes = [
    ...sources.map(part => chartNode(part, 0, 'left')),
    chartNode(total, 1, 'top'),
    ...branches.map(branch => chartNode(branch, 2, 'bottom')),
    ...destinations.map(part => chartNode(part, 3, 'right')),
  ];
  const links: NonNullable<SankeySeriesOption['links']> = [
    ...sources.map(part => ({ source: part.id, target: total.id, value: part.value, lineStyle: { color: 'source' } })),
    ...branches.flatMap(branch => [
      { source: total.id, target: branch.id, value: branch.value },
      ...branch.items.map(part => ({ source: branch.id, target: part.id, value: part.value })),
    ]),
    ...remaining.map(part => ({ source: total.id, target: part.id, value: part.value })),
  ];
  const names = new Map(nodes.map(node => [node.id, node.name]));

  const option: SankeyOption = {
    animation: false,
    tooltip: {
      trigger: 'item',
      renderMode: 'richText',
      confine: true,
      formatter: params => {
        const item = Array.isArray(params) ? params[0] : params;
        const edge = item.data as { source?: string; target?: string };
        const name = edge.source && edge.target ? `${names.get(edge.source)} → ${names.get(edge.target)}` : item.name;
        return `${name}\n${money(Number(item.value))}`;
      },
    },
    series: [{
      type: 'sankey',
      orient: 'horizontal',
      data: nodes,
      links,
      left: 72,
      right: 72,
      top: 42,
      bottom: 36,
      nodeWidth: 10,
      nodeGap: 34,
      nodeAlign: 'justify',
      layoutIterations: 0,
      draggable: false,
      lineStyle: { color: 'target', opacity: 0.52, curveness: 0.48 },
      emphasis: { focus: 'adjacency' },
      label: {
        position: 'right',
        distance: 5,
        color: '#1c304d',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 15,
        width: 67,
        overflow: 'truncate',
        formatter: ({ name, value }) => `${name}\n${compactMoney(Number(value))}원`,
      },
    }],
  };

  const description = [...sources, total, ...branches, ...destinations].map(part => `${part.name} ${money(part.value)}`).join(', ');
  return { option, description };
}

export function MonthlySankey({ data, month, changeMonth }: { data: BudgetData; month: string; changeMonth: (month: string) => void }) {
  const [basis, setBasis] = useState<'plan' | 'recorded'>('recorded');
  const { flows, assets, events, importedExpenses, history } = data;
  const example = month === currentMonth() && !(flows.length || assets.length || events.length || importedExpenses.length || history.length);
  const hasRecords = importedExpenses.some(row => row.date.slice(0, 7) === month);
  const recorded = hasRecords && basis === 'recorded';
  const displayedFlows = useMemo(() => {
    if (example) return exampleFlows();
    const monthlyData = { flows, events, importedExpenses };
    return recorded ? recordedFlowsForMonth(monthlyData, month) : flowsForMonth(monthlyData, month);
  }, [example, recorded, flows, events, importedExpenses, month]);
  const chart = useMemo(() => monthlySankey({ flows: displayedFlows, assets }, recorded ? '기록 지출' : flowLabels.expense), [displayedFlows, assets, recorded]);
  const details = [
    ...displayedFlows,
    ...assets.filter(asset => asset.kind === 'investment' && asset.investment?.monthlyBuy).map(asset => ({ id: `asset:${asset.id}`, name: asset.name, kind: 'investment' as const, amount: asset.investment!.monthlyBuy })),
  ];

  return (
    <>
      <header className="sankey-toolbar">
        <MonthControl month={month} change={changeMonth} />
        <div className="flow-basis">
          {hasRecords ? <div className="flow-view-toggle" role="group" aria-label="지출 표시 기준">
            <button type="button" aria-pressed={!recorded} onClick={() => setBasis('plan')}>계획</button>
            <button type="button" aria-pressed={recorded} onClick={() => setBasis('recorded')}>지출 기록</button>
          </div> : <span>{example ? '예시' : '계획'}</span>}
          {recorded ? <small>수입·저축·투자는 계획 기준</small> : null}
        </div>
      </header>
      <div className="h-[clamp(340px,calc(100svh_-_305px),440px)] w-full md:h-[clamp(410px,56vh,620px)]">
        {chart ? (
          <div className="h-full" role="img" aria-label={`${monthLabel(month)} · ${chart.description}`}>
            <ReactEChartsCore echarts={echarts} option={chart.option} opts={chartRenderer} style={{ width: '100%', height: '100%' }} />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-[#526782]">
            <GitFork size={28} aria-hidden="true" />
            <p>월 예산 항목 없음</p>
          </div>
        )}
      </div>
      {chart ? <details className="flow-details">
        <summary>항목별 금액</summary>
        {(Object.keys(flowLabels) as FlowKind[]).map(kind => {
          const items = details.filter(item => item.kind === kind && item.amount > 0);
          if (!items.length) return null;
          return <div className="flow-detail-group" key={kind}>
            <h2>{flowLabels[kind]}</h2>
            <ul>{items.map(item => <li key={`${'month' in item ? 'event' : 'flow'}:${item.id}`}><span>{item.name}</span><strong>{money(item.amount)}</strong></li>)}</ul>
          </div>;
        })}
      </details> : null}
    </>
  );
}

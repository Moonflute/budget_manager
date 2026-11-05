import { useEffect, useMemo, useRef, useState } from 'react';
import ReactEChartsCore from 'echarts-for-react/esm/core';
import * as echarts from 'echarts/core';
import { SankeyChart, type SankeySeriesOption } from 'echarts/charts';
import { TooltipComponent, type TooltipComponentOption } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { GitFork } from 'lucide-react';
import { MonthControl } from './components';
import { compactMoney, currentMonth, exampleFlows, flowLabels, flowsForMonth, recordedFlowsForMonth, money, monthLabel, monthlyFlow, loanMonth, type BudgetData, type Flow } from './model';

echarts.use([SankeyChart, TooltipComponent, SVGRenderer]);

type SankeyOption = echarts.ComposeOption<SankeySeriesOption | TooltipComponentOption>;
type ChartPart = { id: string; name: string; value: number; color: string };
type ChartSize = { width: number; height: number };
const chartRenderer = { renderer: 'svg' } as const;
const colors = {
  income: '#527cbd',
  expense: '#cc7278',
  saving: '#429686',
  investment: '#8d78b8',
  cash: '#8a98ab',
  deficit: '#b24d63',
  repayment: '#bb9153',
};

function visibleItems(flows: Flow[], kind: 'income' | 'expense', color = colors[kind], otherName = kind === 'income' ? '기타 수입' : '기타 지출'): ChartPart[] {
  const items = flows
    .filter(flow => flow.kind === kind && flow.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const visible = items.length > 3 ? items.slice(0, 2) : items;
  const parts = visible.map(item => ({
    id: `${'month' in item ? 'event' : 'item'}:${item.id}`, name: item.name, value: item.amount, color,
  }));
  if (items.length > visible.length) {
    parts.push({
      id: `other:${otherName}`,
      name: otherName,
      value: items.slice(visible.length).reduce((sum, item) => sum + item.amount, 0),
      color,
    });
  }
  return parts;
}

function chartNode(part: ChartPart, depth: number, position: 'left' | 'right', labelWidth: number) {
  return {
    id: part.id,
    name: part.name,
    value: part.value,
    depth,
    itemStyle: { color: part.color, borderRadius: 2, borderWidth: 0 },
    label: {
      position,
      width: labelWidth,
    },
  };
}

function monthlySankey({ flows, assets }: Pick<BudgetData, 'flows' | 'assets'>, expenseLabel: string, { width, height }: ChartSize) {
  const flow = monthlyFlow({ flows, assets });
  if (!flow.income && !flow.expense && !flow.saving && !flow.investment && !flow.repayment) return null;
  const repayments: Flow[] = assets.filter(asset => asset.kind === 'debt' && asset.loan).map(asset => ({
    id: `loan:${asset.id}`, name: asset.name, kind: 'expense', amount: loanMonth(asset.amount, asset.loan!).payment,
  }));
  const deficit = Math.max(0, -flow.cash);
  const sources = visibleItems(flows, 'income');
  if (deficit) sources.push({ id: 'deficit', name: '부족액', value: deficit, color: colors.deficit });

  // The shortfall contributes to the planned allocation, not to reported income.
  const total = {
    id: 'total', name: deficit ? '배분액' : '총수입', value: flow.income + deficit,
    color: '#8498b6',
  };
  const destinations = [
    ...visibleItems(flows, 'expense'),
    ...visibleItems(repayments, 'expense', colors.repayment, '기타 상환'),
    { id: 'saving', name: flowLabels.saving, value: flow.saving, color: colors.saving },
    { id: 'investment', name: flowLabels.investment, value: flow.investment, color: colors.investment },
    { id: 'cash', name: '남는 현금', value: Math.max(0, flow.cash), color: colors.cash },
  ].filter(part => part.value > 0);
  const compact = width < 480;
  const left = compact ? 64 : 124;
  const right = compact ? 90 : 144;
  const nodeGap = 36;
  const rowCount = Math.max(sources.length, destinations.length);
  const plotHeight = Math.min(height - 48, (compact ? 220 : 260) + (rowCount - 1) * nodeGap);
  const valueHeight = plotHeight - (rowCount - 1) * nodeGap;
  // Keep categories in a stable order and center each column without distorting amounts.
  function column(parts: ChartPart[], depth: number, position: 'left' | 'right', labelWidth: number) {
    let y = (rowCount - parts.length) * nodeGap / 2;
    return parts.map(part => {
      const node = { ...chartNode(part, depth, position, labelWidth), localY: y / plotHeight };
      y += part.value / total.value * valueHeight + nodeGap;
      return node;
    });
  }
  const nodes = [
    ...column(sources, 0, 'left', left - 10),
    { ...column([total], 1, 'right', 0)[0], label: { show: false } },
    ...column(destinations, 2, 'right', right - 10),
  ];
  const links: NonNullable<SankeySeriesOption['links']> = [
    ...sources.map(part => ({ source: part.id, target: total.id, value: part.value })),
    ...destinations.map(part => ({ source: total.id, target: part.id, value: part.value })),
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
      left,
      right,
      top: (height - plotHeight) / 2,
      bottom: (height - plotHeight) / 2,
      nodeWidth: 5,
      nodeGap,
      nodeAlign: 'justify',
      layoutIterations: 0,
      draggable: false,
      lineStyle: { color: 'gradient', opacity: 0.38, curveness: 0.5 },
      emphasis: { focus: 'adjacency', lineStyle: { opacity: 0.65 } },
      label: {
        position: 'right',
        distance: 9,
        color: '#1c304d',
        fontFamily: 'Pretendard, "Noto Sans KR", "Malgun Gothic", sans-serif',
        fontSize: compact ? 11 : 13,
        lineHeight: compact ? 19 : 23,
        overflow: 'truncate',
        rich: {
          amount: { color: '#20334d', fontSize: compact ? 14 : 17, fontWeight: 600, lineHeight: compact ? 21 : 26 },
          unit: { color: '#63758c', fontSize: compact ? 10 : 12 },
        },
        formatter: ({ name, value }) => `${name}\n{amount|${compactMoney(Number(value))}}{unit|원}`,
      },
    }],
  };

  const description = [...sources, total, { name: expenseLabel, value: flow.expense }, ...destinations].map(part => `${part.name} ${money(part.value)}`).join(', ');
  return { option, description, income: flow.income, deficit, minHeight: Math.max(340, Math.max(sources.length, destinations.length) * 52 + 48) };
}

export function MonthlySankey({ data, month, changeMonth }: { data: BudgetData; month: string; changeMonth: (month: string) => void }) {
  const [basis, setBasis] = useState<'plan' | 'recorded'>('recorded');
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ChartSize>({ width: 320, height: 360 });
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { flows, assets, events, importedExpenses, history } = data;
  const example = month === currentMonth() && !(flows.length || assets.length || events.length || importedExpenses.length || history.length);
  const hasRecords = importedExpenses.some(row => row.date.slice(0, 7) === month);
  const recorded = hasRecords && basis === 'recorded';
  const displayedFlows = useMemo(() => {
    if (example) return exampleFlows();
    const monthlyData = { flows, events, importedExpenses };
    return recorded ? recordedFlowsForMonth(monthlyData, month) : flowsForMonth(monthlyData, month);
  }, [example, recorded, flows, events, importedExpenses, month]);
  const chart = useMemo(() => monthlySankey({ flows: displayedFlows, assets }, recorded ? '기록 지출' : flowLabels.expense, size), [displayedFlows, assets, recorded, size]);
  const details = [
    ...displayedFlows,
    ...assets.filter(asset => asset.kind === 'investment' && asset.investment?.monthlyBuy).map(asset => ({ id: `asset:${asset.id}`, name: asset.name, kind: 'investment' as const, amount: asset.investment!.monthlyBuy })),
    ...assets.filter(asset => asset.kind === 'debt' && asset.loan).map(asset => ({ id: `loan:${asset.id}`, name: asset.name, kind: 'repayment' as const, amount: loanMonth(asset.amount, asset.loan!).payment })),
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
          {recorded ? <small>수입·저축·투자·상환은 계획 기준</small> : null}
        </div>
      </header>
      {chart ? <div className="sankey-summary">
        <span>총수입</span>
        <strong>{compactMoney(chart.income)}<small>원</small></strong>
        {chart.deficit > 0 ? <span className="sankey-shortfall">부족액 {compactMoney(chart.deficit)}원</span> : null}
      </div> : null}
      <div ref={container} className="sankey-chart" style={{ minHeight: chart?.minHeight }}>
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
        {Object.entries({ ...flowLabels, repayment: '대출 상환' }).map(([kind, label]) => {
          const items = details.filter(item => item.kind === kind && item.amount > 0);
          if (!items.length) return null;
          return <div className="flow-detail-group" key={kind}>
            <h2>{label}</h2>
            <ul>{items.map(item => <li key={`${'month' in item ? 'event' : 'flow'}:${item.id}`}><span>{item.name}</span><strong>{money(item.amount)}</strong></li>)}</ul>
          </div>;
        })}
      </details> : null}
    </>
  );
}

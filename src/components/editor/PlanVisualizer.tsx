import React, { useState } from 'react';
import styles from '../../styles/components/PlanVisualizer.module.css';

interface PlanNode {
  Plan?: PlanNode;
  Plans?: PlanNode[];
  'Node Type'?: string;
  'Actual Rows'?: number;
  'Actual Total Time'?: number;
  'Actual Loops'?: number;
  'Plan Rows'?: number;
  'Total Cost'?: number;
  'Startup Cost'?: number;
  'Relation Name'?: string;
  'Index Name'?: string;
  'Filter'?: string;
  'Index Cond'?: string;
  'Join Type'?: string;
  'Shared Hit Blocks'?: number;
  'Shared Read Blocks'?: number;
  'Output'?: string[];
}

interface PlanVisualizerProps {
  rawPlan: any; // JSON from EXPLAIN (ANALYZE, FORMAT JSON)
}

function getCostColor(totalCost: number, maxCost: number): string {
  if (maxCost === 0) return 'var(--text-primary)';
  const ratio = totalCost / maxCost;
  if (ratio < 0.1) return 'var(--success)';
  if (ratio < 0.5) return 'var(--warning)';
  return 'var(--error)';
}

function PlanNodeView({ node, maxCost, depth = 0 }: { node: PlanNode; maxCost: number; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const plan = node.Plan || node;
  const children = plan.Plans || [];
  const nodeType = plan['Node Type'] || 'Unknown';
  const totalCost = plan['Total Cost'] || 0;
  const actualTime = plan['Actual Total Time'] || 0;
  const actualRows = plan['Actual Rows'] || 0;
  const loops = plan['Actual Loops'] || 1;
  const relation = plan['Relation Name'] || plan['Index Name'] || '';
  const color = getCostColor(totalCost, maxCost);

  return (
    <div style={{ marginLeft: depth * 20 }}>
      <div
        onClick={() => setExpanded(!expanded)}
        className={styles.nodeRow}
        style={{ borderLeftColor: color }}
      >
        <span className={styles.expandIcon}>{expanded ? '▼' : '▶'}</span>
        <span className={styles.nodeType} style={{ color }}>{nodeType}</span>
        {relation && <span className={styles.nodeRelation}>on <b>{relation}</b></span>}
        <span className={styles.nodeStats}>
          cost={totalCost.toFixed(2)} · rows={actualRows} · time={actualTime.toFixed(3)}ms
          {loops > 1 && ` · loops=${loops}`}
        </span>
      </div>
      {expanded && children.map((child, i) => (
        <PlanNodeView key={i} node={child} maxCost={maxCost} depth={depth + 1} />
      ))}
    </div>
  );
}

export const PlanVisualizer: React.FC<PlanVisualizerProps> = ({ rawPlan }) => {
  // The plan is typically wrapped in an array: [{Plan: {...}}]
  let planArray: any[] = [];
  if (Array.isArray(rawPlan)) {
    planArray = rawPlan;
  } else if (rawPlan && Array.isArray(rawPlan.Plans)) {
    planArray = rawPlan.Plans;
  } else if (rawPlan && rawPlan.Plan) {
    planArray = [rawPlan];
  }

  // Compute max cost across all nodes
  function collectCosts(node: any): number {
    let max = node?.['Total Cost'] || 0;
    if (node?.Plans) {
      for (const child of node.Plans) {
        max = Math.max(max, collectCosts(child));
      }
    }
    return max;
  }

  const maxCost = planArray.reduce((m, p) => Math.max(m, collectCosts(p.Plan || p)), 0);
  const totalTime = rawPlan?.['Execution Time'] || rawPlan?.['Total Runtime'] || 0;
  const planningTime = rawPlan?.['Planning Time'];

  return (
    <div className={styles.container}>
      <div className={styles.summary}>
        Planning Time: {planningTime != null ? planningTime.toFixed(3) : '?'}ms · Execution Time: {totalTime.toFixed(3)}ms
      </div>
      {planArray.map((entry, i) => (
        <PlanNodeView key={i} node={entry.Plan || entry} maxCost={maxCost} />
      ))}
    </div>
  );
};

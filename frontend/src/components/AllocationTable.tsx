import React, { useState } from 'react';
import { AllocationItem, UnmetDemandItem } from '../api/client';

export interface AllocationTableProps {
  allocations: AllocationItem[];
  unmetDemands: UnmetDemandItem[];
}

export const AllocationTable: React.FC<AllocationTableProps> = ({
  allocations,
  unmetDemands,
}) => {
  const [commodityFilter, setCommodityFilter] = useState<string>('ALL');

  const uniqueCommodities = Array.from(
    new Set([
      ...allocations.map((a) => a.commodity_id),
      ...unmetDemands.map((u) => u.commodity_id),
    ])
  );

  const filteredAllocations = commodityFilter === 'ALL'
    ? allocations
    : allocations.filter((a) => a.commodity_id === commodityFilter);

  const filteredUnmet = commodityFilter === 'ALL'
    ? unmetDemands
    : unmetDemands.filter((u) => u.commodity_id === commodityFilter);

  return (
    <div className="glass-card rounded-3xl p-6 shadow-glass-card border border-palette-frost/25 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-palette-slate/25 gap-3 mb-4">
        <div>
          <h3 className="text-base font-bold text-palette-cream">Humanitarian Commodity Allocation</h3>
          <p className="text-xs text-palette-frost mt-0.5">
            Dispatch assignment of vehicles and delivered relief quantities by demand point.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="commodity-filter" className="text-xs font-semibold text-palette-frost">
            Filter:
          </label>
          <select
            id="commodity-filter"
            value={commodityFilter}
            onChange={(e) => setCommodityFilter(e.target.value)}
            className="text-xs glass-input rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-palette-frost text-palette-cream"
          >
            <option value="ALL" className="bg-palette-deep">All Commodities ({allocations.length})</option>
            {uniqueCommodities.map((cid) => (
              <option key={cid} value={cid} className="bg-palette-deep">
                {cid}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs font-mono">
          <thead className="bg-palette-deep/80 border-b border-palette-slate/25 text-palette-frost text-[11px]">
            <tr>
              <th className="py-3 px-3">Destination Node</th>
              <th className="py-3 px-3">Commodity ID</th>
              <th className="py-3 px-3">Assigned Vehicle</th>
              <th className="py-3 px-3">Delivered Qty</th>
              <th className="py-3 px-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-palette-slate/20 text-palette-cream font-sans">
            {filteredAllocations.map((a, i) => (
              <tr key={i} className="hover:bg-palette-steel/20 transition-colors">
                <td className="py-2.5 px-3 font-semibold text-palette-cream">{a.demand_node_id}</td>
                <td className="py-2.5 px-3 font-mono text-palette-frost">{a.commodity_id}</td>
                <td className="py-2.5 px-3 font-mono text-palette-frost">{a.vehicle_id}</td>
                <td className="py-2.5 px-3 font-mono font-bold text-emerald-300">
                  {a.quantity_delivered}
                </td>
                <td className="py-2.5 px-3">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-800/40">
                    Dispatched
                  </span>
                </td>
              </tr>
            ))}

            {filteredUnmet.map((u, i) => (
              <tr key={`unmet-${i}`} className="bg-rose-950/20 text-rose-300">
                <td className="py-2.5 px-3 font-semibold text-rose-300">
                  {u.demand_node_id}
                  <span className="text-[10px] text-palette-slate block font-sans">
                    ({u.vulnerable_group || 'Standard Pop'})
                  </span>
                </td>
                <td className="py-2.5 px-3 font-mono">{u.commodity_id}</td>
                <td className="py-2.5 px-3 font-mono text-palette-slate">—</td>
                <td className="py-2.5 px-3 font-mono font-bold text-rose-400">
                  -{u.unmet_quantity}
                </td>
                <td className="py-2.5 px-3">
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/70 text-rose-300 border border-rose-800/40">
                    Deficit
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

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
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2 mb-3">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Humanitarian Commodity Allocation</h3>
          <p className="text-xs text-slate-500">
            Dispatch assignment of vehicles and delivered relief quantities by demand point.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="commodity-filter" className="text-xs font-medium text-slate-600">
            Filter:
          </label>
          <select
            id="commodity-filter"
            value={commodityFilter}
            onChange={(e) => setCommodityFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Commodities ({allocations.length})</option>
            {uniqueCommodities.map((cid) => (
              <option key={cid} value={cid}>
                {cid}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
            <tr>
              <th className="py-2 px-3">Destination Node</th>
              <th className="py-2 px-3">Commodity</th>
              <th className="py-2 px-3">Assigned Vehicle</th>
              <th className="py-2 px-3 text-right">Delivered Units</th>
              <th className="py-2 px-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAllocations.map((item, idx) => (
              <tr key={`alloc-${idx}`} className="hover:bg-slate-50 transition-colors">
                <td className="py-2.5 px-3 font-medium text-slate-800">{item.demand_node_id}</td>
                <td className="py-2.5 px-3 font-mono text-xs text-slate-700">{item.commodity_id}</td>
                <td className="py-2.5 px-3 font-mono text-xs text-blue-600 font-medium">
                  {item.vehicle_id}
                </td>
                <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                  {item.quantity_delivered.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                    Delivered
                  </span>
                </td>
              </tr>
            ))}

            {filteredUnmet.map((item, idx) => (
              <tr key={`unmet-${idx}`} className="bg-red-50/40 hover:bg-red-50 transition-colors">
                <td className="py-2.5 px-3 font-medium text-red-900">
                  {item.demand_node_id}
                  <span className="ml-1.5 text-[10px] text-red-600 bg-red-100 px-1 py-0.5 rounded">
                    {item.vulnerable_group}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-mono text-xs text-slate-700">{item.commodity_id}</td>
                <td className="py-2.5 px-3 font-mono text-xs text-slate-400 italic">Unassigned</td>
                <td className="py-2.5 px-3 text-right font-semibold text-rose-700">
                  -{item.unmet_quantity.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span className="text-[11px] font-semibold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
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


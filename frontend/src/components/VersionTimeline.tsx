import React from 'react';

export interface SnapshotItem {
  snapshot_id: string;
  created_at: string;
  region_name: string;
  edge_count: number;
  node_count: number;
  source_attribution: string;
}

interface VersionTimelineProps {
  snapshots: SnapshotItem[];
  activeSnapshotId: string | null;
  onSelectSnapshot?: (id: string) => void;
}

export const VersionTimeline: React.FC<VersionTimelineProps> = ({
  snapshots,
  activeSnapshotId,
  onSelectSnapshot,
}) => {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-800">Immutable Snapshot Timeline</h3>
      <div className="relative border-l-2 border-slate-200 ml-3 space-y-4 py-2">
        {snapshots.map((snap) => {
          const isActive = snap.snapshot_id === activeSnapshotId;
          return (
            <div key={snap.snapshot_id} className="relative pl-6">
              {/* Dot indicator */}
              <div
                className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 bg-white ${
                  isActive ? 'border-blue-600 bg-blue-50' : 'border-slate-300'
                }`}
              />
              <div
                onClick={() => onSelectSnapshot && onSelectSnapshot(snap.snapshot_id)}
                className={`p-3 rounded-md border text-xs cursor-pointer transition ${
                  isActive
                    ? 'border-blue-300 bg-blue-50/50 shadow-sm'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold text-slate-900">{snap.region_name}</span>
                  <span className="text-slate-400 font-mono text-[10px]">
                    {new Date(snap.created_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="font-mono text-slate-600 truncate text-[11px] mb-1">
                  SHA-256: {snap.snapshot_id.slice(0, 16)}...
                </div>
                <div className="flex space-x-3 text-slate-500 text-[11px]">
                  <span>{snap.edge_count} Edges</span>
                  <span>&bull;</span>
                  <span>{snap.node_count} Nodes</span>
                  {isActive && (
                    <span className="ml-auto font-bold text-blue-600 uppercase text-[10px]">Active</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

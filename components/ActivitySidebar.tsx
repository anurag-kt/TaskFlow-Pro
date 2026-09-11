'use client';

import React from 'react';
import { ActivityLog } from '@/lib/types';
import { Activity, Clock } from 'lucide-react';

interface ActivitySidebarProps {
  activities: ActivityLog[];
}

export default function ActivitySidebar({ activities }: ActivitySidebarProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 h-full">
      <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 mb-3">
        <Activity className="w-4 h-4 text-blue-600" />
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Live DAG Activity Stream
        </h3>
      </div>

      <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
        {activities.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No activity recorded yet.</p>
        ) : (
          activities.map((log) => (
            <div
              key={log.id}
              className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-2.5 space-y-1"
            >
              <p className="leading-snug">{log.message}</p>
              <div className="flex items-center space-x-1 text-[10px] text-slate-400">
                <Clock className="w-3 h-3" />
                <span>{log.created_at || 'Just now'}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

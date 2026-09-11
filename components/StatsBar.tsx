'use client';

import React from 'react';
import { Task, Column } from '@/lib/types';
import { CheckCircle2, AlertOctagon, Clock, Flame, ShieldCheck } from 'lucide-react';

interface StatsBarProps {
  columns: Column[];
  projectDurationDays: number;
  criticalCount: number;
}

export default function StatsBar({
  columns,
  projectDurationDays,
  criticalCount,
}: StatsBarProps) {
  const allTasks = columns.flatMap((c) => c.tasks);
  const totalTasks = allTasks.length;
  const blockedTasks = allTasks.filter((t) => t.isBlocked).length;
  const readyTasks = allTasks.filter((t) => !t.isBlocked && t.status !== 'Done').length;
  const doneTasks = allTasks.filter((t) => t.status === 'Done').length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* Total Tasks */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
        <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium">Total Tasks</p>
          <p className="text-lg font-bold text-slate-900">{totalTasks}</p>
        </div>
      </div>

      {/* Blocked Tasks */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
        <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600">
          <AlertOctagon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium">Blocked (Prereqs Pending)</p>
          <div className="flex items-center space-x-1.5">
            <span className="text-lg font-bold text-rose-600">{blockedTasks}</span>
            <span className="text-[10px] text-rose-500 font-medium bg-rose-50 px-1.5 py-0.5 rounded">
              Drag Guard Active
            </span>
          </div>
        </div>
      </div>

      {/* Ready Tasks */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
        <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium">Ready to Work</p>
          <p className="text-lg font-bold text-emerald-700">{readyTasks}</p>
        </div>
      </div>

      {/* Completed Tasks */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
        <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium">Completed (Done)</p>
          <p className="text-lg font-bold text-indigo-700">{doneTasks} / {totalTasks}</p>
        </div>
      </div>

      {/* Critical Path Duration */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3 col-span-2 sm:col-span-4 lg:col-span-1">
        <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
          <Flame className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium">Critical Path (CPM)</p>
          <div className="flex items-center space-x-1.5">
            <span className="text-lg font-bold text-amber-700">{projectDurationDays} Days</span>
            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
              {criticalCount} critical
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

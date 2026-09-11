'use client';

import React from 'react';
import { Column, Task, TaskDependency } from '@/lib/types';
import { Flame, Clock, Calendar, CheckCircle2, ShieldCheck, AlertOctagon, GitFork } from 'lucide-react';
import { addDays, daysBetween } from '@/lib/dag-engine';

interface TimelineViewProps {
  columns: Column[];
  dependencies: TaskDependency[];
  criticalPath: {
    criticalTaskIds: string[];
    projectDurationDays: number;
  };
  onEditTask: (task: Task) => void;
  onOpenDependencies: (task: Task) => void;
}

export default function TimelineView({
  columns,
  dependencies,
  criticalPath,
  onEditTask,
  onOpenDependencies,
}: TimelineViewProps) {
  const allTasks = columns.flatMap((c) => c.tasks);

  if (allTasks.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-slate-400">
        No tasks available to plot on timeline.
      </div>
    );
  }

  // Calculate earliest start date across all tasks
  const baselineDate = allTasks.reduce(
    (min, t) => (t.start_date < min ? t.start_date : min),
    allTasks[0].start_date
  );

  // Total project days span
  const totalDays = Math.max(criticalPath.projectDurationDays + 4, 14);

  // Generate day columns array (Day 0 to Day totalDays - 1)
  const dayColumns = Array.from({ length: totalDays }, (_, i) => ({
    dayOffset: i,
    dateStr: addDays(baselineDate, i),
  }));

  const getStatusColor = (status: string, isCritical?: boolean) => {
    if (status === 'Done') {
      return 'bg-emerald-600 text-white shadow-xs';
    }
    if (isCritical) {
      return 'bg-amber-500 text-slate-950 font-bold ring-2 ring-amber-400 shadow-sm';
    }
    return 'bg-blue-600 text-white shadow-xs';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden">
        {/* Timeline Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Gantt Timeline & Critical Path (CPM)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Minimum total project duration: <span className="font-semibold text-slate-800">{criticalPath.projectDurationDays} Days</span> based on longest dependency chain.
            </p>
          </div>

          <div className="flex items-center space-x-2.5 text-xs">
            <div className="flex items-center space-x-1.5 px-3 py-1 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 font-semibold shadow-2xs">
              <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
              <span>Critical Path (Slack = 0)</span>
            </div>
            <div className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Done</span>
            </div>
            <div className="flex items-center space-x-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <span>Standard Task</span>
            </div>
          </div>
        </div>

        {/* Gantt Grid Container */}
        <div className="overflow-x-auto pt-5">
          <div className="min-w-[950px]">
            {/* Header Row */}
            <div className="flex items-center pb-3 border-b border-slate-200 text-xs font-bold text-slate-500">
              {/* Task Column */}
              <div className="w-80 shrink-0 pl-2">Task Details</div>

              {/* Day Columns */}
              <div 
                className="flex-1 grid gap-1 text-center"
                style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))` }}
              >
                {dayColumns.map((d) => (
                  <div key={d.dayOffset} className="py-1 px-0.5 rounded bg-slate-50 border border-slate-100">
                    <div className="text-[11px] font-bold text-slate-700">D{d.dayOffset + 1}</div>
                    <div className="text-[9px] font-mono text-slate-400">{d.dateStr.substring(5)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Task Rows */}
            <div className="divide-y divide-slate-100">
              {allTasks.map((task) => {
                const dayOffset = daysBetween(baselineDate, task.start_date);
                const duration = task.estimated_days;
                const isCritical = criticalPath.criticalTaskIds.includes(task.id);

                return (
                  <div
                    key={task.id}
                    className={`flex items-center py-3.5 hover:bg-slate-50/80 transition-colors group ${
                      isCritical ? 'bg-amber-50/20' : ''
                    }`}
                  >
                    {/* Left: Task Info */}
                    <div className="w-80 shrink-0 pl-2 pr-4 flex items-center justify-between">
                      <div className="truncate pr-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-semibold text-slate-900 truncate">
                            {task.title}
                          </span>
                          {isCritical && (
                            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] rounded font-bold shrink-0">
                              CPM
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5">
                          <span>{task.start_date}</span>
                          <span>•</span>
                          <span>{task.estimated_days}d</span>
                          {task.slack !== undefined && task.slack > 0 && (
                            <span className="text-blue-600 font-medium">({task.slack}d slack)</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => onOpenDependencies(task)}
                        className="opacity-0 group-hover:opacity-100 text-xs text-blue-600 font-semibold hover:underline shrink-0 px-2 py-1 bg-blue-50 rounded"
                        title="Manage Dependencies"
                      >
                        Deps
                      </button>
                    </div>

                    {/* Right: Gantt Bar Container */}
                    <div 
                      className="flex-1 relative h-9 bg-slate-100/60 rounded-xl flex items-center px-1"
                    >
                      {/* Grid Guide Lines */}
                      <div 
                        className="absolute inset-0 grid gap-1 pointer-events-none opacity-20"
                        style={{ gridTemplateColumns: `repeat(${totalDays}, minmax(0, 1fr))` }}
                      >
                        {Array.from({ length: totalDays }).map((_, i) => (
                          <div key={i} className="border-r border-slate-400 h-full" />
                        ))}
                      </div>

                      {/* Interactive Gantt Bar */}
                      <div
                        onClick={() => onEditTask(task)}
                        style={{
                          left: `${(Math.max(0, dayOffset) / totalDays) * 100}%`,
                          width: `${Math.max(4, (duration / totalDays) * 100)}%`,
                        }}
                        className={`absolute top-1.5 bottom-1.5 rounded-lg px-2.5 flex items-center justify-between text-xs cursor-pointer hover:brightness-105 transition-all select-none ${getStatusColor(
                          task.status,
                          isCritical
                        )}`}
                        title={`${task.title} (${task.status})\nStart: ${task.start_date}\nDuration: ${duration} day(s)\nSlack: ${task.slack ?? 0} day(s)`}
                      >
                        <span className="truncate text-[11px] font-medium pr-1">
                          {task.title}
                        </span>
                        <span className="text-[10px] font-mono shrink-0 opacity-90 font-bold">
                          {duration}d
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

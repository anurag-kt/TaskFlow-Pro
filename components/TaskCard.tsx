'use client';

import React from 'react';
import { Task, Priority } from '@/lib/types';
import { 
  Calendar, 
  Clock, 
  AlertOctagon, 
  ShieldCheck, 
  Flame, 
  GitFork,
  MoreVertical,
  Edit2
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onOpenDependencies: (task: Task) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
}

export default function TaskCard({
  task,
  onEdit,
  onOpenDependencies,
  onDragStart,
}: TaskCardProps) {
  const getPriorityStyle = (priority: Priority) => {
    switch (priority) {
      case 'Urgent':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'High':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Medium':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Low':
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      className={`bg-white rounded-xl p-4 border transition-all duration-150 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing select-none group relative ${
        task.isCritical
          ? 'border-amber-400/80 ring-1 ring-amber-400/50'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Top Badges Header */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center flex-wrap gap-1.5">
          <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${getPriorityStyle(task.priority)}`}>
            {task.priority}
          </span>

          {task.isCritical && (
            <span className="flex items-center space-x-1 px-2 py-0.5 text-[11px] font-semibold bg-amber-500/10 text-amber-800 border border-amber-300 rounded-md">
              <Flame className="w-3 h-3 text-amber-600 fill-amber-500" />
              <span>Critical Path</span>
            </span>
          )}
        </div>

        {/* Action button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task);
          }}
          className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 opacity-80 group-hover:opacity-100 transition-opacity"
          title="Edit Task"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Title & Description */}
      <h4 className="text-sm font-semibold text-slate-900 leading-snug mb-1 group-hover:text-blue-600 transition-colors">
        {task.title}
      </h4>

      {task.description && (
        <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Dynamic Status Badges (Blocked vs Ready) */}
      <div className="mb-3">
        {task.isBlocked ? (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              onOpenDependencies(task);
            }}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium cursor-pointer hover:bg-rose-100 transition-colors"
            title={task.blockedBy?.map(p => p.title).join(', ')}
          >
            <AlertOctagon className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="truncate">Blocked ({task.blockedBy?.length} prerequisite{task.blockedBy && task.blockedBy.length > 1 ? 's' : ''})</span>
          </div>
        ) : task.status !== 'Done' ? (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Ready to Work</span>
          </div>
        ) : null}
      </div>

      {/* Card Footer: Dates & Dependencies Button */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-1" title={`Start Date: ${task.start_date}`}>
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{task.start_date.substring(5)}</span>
          </div>

          <div className="flex items-center space-x-1" title="Duration">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{task.estimated_days}d</span>
          </div>
        </div>

        {/* Manage Dependencies Link Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenDependencies(task);
          }}
          className="flex items-center space-x-1 px-2 py-1 rounded text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors font-medium"
        >
          <GitFork className="w-3.5 h-3.5" />
          <span>Deps</span>
        </button>
      </div>
    </div>
  );
}

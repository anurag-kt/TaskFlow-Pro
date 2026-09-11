'use client';

import React, { useState } from 'react';
import { Column, Task } from '@/lib/types';
import TaskCard from './TaskCard';
import { Plus, CheckCircle2, ListTodo, PlayCircle, Eye } from 'lucide-react';

interface KanbanBoardProps {
  columns: Column[];
  onEditTask: (task: Task) => void;
  onOpenDependencies: (task: Task) => void;
  onOpenCreateTask: (columnId?: string) => void;
  onMoveTask: (taskId: string, targetColumnId: string, prevIndex?: number, nextIndex?: number) => void;
}

export default function KanbanBoard({
  columns,
  onEditTask,
  onOpenDependencies,
  onOpenCreateTask,
  onMoveTask,
}: KanbanBoardProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  const getColumnIcon = (title: string) => {
    switch (title) {
      case 'Backlog':
        return <ListTodo className="w-4 h-4 text-slate-500" />;
      case 'In Progress':
        return <PlayCircle className="w-4 h-4 text-blue-500" />;
      case 'Review':
        return <Eye className="w-4 h-4 text-amber-500" />;
      case 'Done':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      default:
        return null;
    }
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', task.id);
    setDraggedTaskId(task.id);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (dragOverColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetColumn: Column) => {
    e.preventDefault();
    setDragOverColumnId(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;

    // Fractional indexing: insert at the end of target column
    const targetTasks = targetColumn.tasks.filter((t) => t.id !== taskId);
    const lastTask = targetTasks[targetTasks.length - 1];
    const prevIndex = lastTask ? lastTask.order_index : undefined;

    onMoveTask(taskId, targetColumn.id, prevIndex, undefined);
    setDraggedTaskId(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
        {columns.map((column) => (
          <div
            key={column.id}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column)}
            className={`bg-slate-100/90 rounded-2xl p-3.5 border transition-all duration-200 flex flex-col max-h-[calc(100vh-210px)] min-h-[350px] ${
              dragOverColumnId === column.id
                ? 'border-blue-400 bg-blue-50/50 ring-2 ring-blue-400/20'
                : 'border-slate-200/80'
            }`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between px-2 py-2 mb-3">
              <div className="flex items-center space-x-2">
                {getColumnIcon(column.title)}
                <h3 className="text-sm font-bold text-slate-800 tracking-tight">{column.title}</h3>
                <span className="px-2 py-0.5 text-xs font-semibold bg-white text-slate-600 border border-slate-200 rounded-full shadow-2xs">
                  {column.tasks.length}
                </span>
              </div>

              <button
                onClick={() => onOpenCreateTask(column.id)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
                title={`Add task to ${column.title}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Task List / Drop Zone */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
              {column.tasks.length === 0 ? (
                <div className="h-32 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                  <p className="text-xs font-medium">No tasks in {column.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Drag cards here</p>
                </div>
              ) : (
                column.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={onEditTask}
                    onOpenDependencies={onOpenDependencies}
                    onDragStart={handleDragStart}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

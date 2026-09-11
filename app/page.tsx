'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { BoardPayload, Column, Task, TaskDependency } from '@/lib/types';
import Navbar from '@/components/Navbar';
import StatsBar from '@/components/StatsBar';
import KanbanBoard from '@/components/KanbanBoard';
import TimelineView from '@/components/TimelineView';
import DAGArchitectureView from '@/components/DAGArchitectureView';
import DependencyModal from '@/components/DependencyModal';
import TaskModal from '@/components/TaskModal';
import ActivitySidebar from '@/components/ActivitySidebar';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { decorateTasksWithGraphMetadata, computeCriticalPath } from '@/lib/dag-engine';

export default function HomePage() {
  const [boardData, setBoardData] = useState<BoardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'kanban' | 'timeline' | 'architecture'>('kanban');

  // Modals state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createDefaultColumnId, setCreateDefaultColumnId] = useState<string | undefined>(undefined);
  const [dependencyModalTask, setDependencyModalTask] = useState<Task | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const fetchBoard = useCallback(async (isInitial = false) => {
    try {
      const res = await fetch('/api/board');
      if (!res.ok) throw new Error('Failed to load board');
      const data: BoardPayload = await res.json();
      setBoardData(data);
    } catch (err: any) {
      if (isInitial) showToast(err.message || 'Error fetching board', 'error');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoard(true);
  }, [fetchBoard]);

  // OPTIMISTIC UI: Move card instantly in client memory (0ms latency), then sync with server
  const handleMoveTask = async (
    taskId: string,
    targetColumnId: string,
    prevIndex?: number,
    nextIndex?: number
  ) => {
    if (!boardData) return;

    // Snapshot previous state for rollback on error
    const previousState = boardData;

    // Optimistically update client state
    const targetColumn = boardData.columns.find((c) => c.id === targetColumnId);
    if (!targetColumn) return;

    let movedTask: Task | null = null;
    const newColumns = boardData.columns.map((col) => {
      const existing = col.tasks.find((t) => t.id === taskId);
      if (existing) {
        movedTask = { ...existing, column_id: targetColumnId, status: targetColumn.title };
      }
      return {
        ...col,
        tasks: col.tasks.filter((t) => t.id !== taskId),
      };
    });

    if (movedTask) {
      const targetColIndex = newColumns.findIndex((c) => c.id === targetColumnId);
      if (targetColIndex !== -1) {
        newColumns[targetColIndex].tasks.push(movedTask);
      }

      // Re-decorate tasks with graph metadata in memory
      const allTasks = newColumns.flatMap((c) => c.tasks);
      const decorated = decorateTasksWithGraphMetadata(allTasks, boardData.dependencies);
      const cpm = computeCriticalPath(allTasks, boardData.dependencies);

      const updatedColumns = newColumns.map((col) => ({
        ...col,
        tasks: decorated.filter((t) => t.column_id === col.id),
      }));

      setBoardData({
        ...boardData,
        columns: updatedColumns,
        criticalPath: {
          criticalTaskIds: Array.from(cpm.criticalTaskIds),
          projectDurationDays: cpm.projectDurationDays,
        },
      });
    }

    try {
      const res = await fetch('/api/tasks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, targetColumnId, prevIndex, nextIndex }),
      });

      const json = await res.json();
      if (!res.ok) {
        // Rollback optimistic update
        setBoardData(previousState);
        showToast(json.error || 'Failed to move task', 'error');
        return;
      }

      // Silent background sync
      fetchBoard();
    } catch (err: any) {
      setBoardData(previousState);
      showToast(err.message || 'Failed to move task', 'error');
    }
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    if (taskData.id) {
      const res = await fetch(`/api/tasks/${taskData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      const json = await res.json();
      if (!res.ok) {
        return { error: json.error || 'Failed to update task' };
      }
      showToast('Task updated successfully.');
      fetchBoard();
      return { success: true };
    } else {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      const json = await res.json();
      if (!res.ok) {
        return { error: json.error || 'Failed to create task' };
      }
      showToast('Task created successfully.');
      fetchBoard();
      return { success: true };
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || 'Failed to delete task', 'error');
        return;
      }
      showToast('Task deleted successfully.');
      fetchBoard();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete task', 'error');
    }
  };

  const handleAddDependency = async (taskId: string, dependsOnId: string) => {
    try {
      const res = await fetch('/api/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, dependsOnId }),
      });

      const json = await res.json();
      if (!res.ok) {
        return { error: json.error, path: json.path };
      }

      showToast('Dependency linked and schedule recalculated.');
      fetchBoard();
      return { success: true };
    } catch (err: any) {
      return { error: err.message || 'Failed to add dependency' };
    }
  };

  const handleDeleteDependency = async (dependencyId: string) => {
    try {
      const res = await fetch(`/api/dependencies?id=${dependencyId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error || 'Failed to remove dependency', 'error');
        return;
      }
      showToast('Dependency unlinked.');
      fetchBoard();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete dependency', 'error');
    }
  };

  const handleResetData = async () => {
    if (!confirm('Reset the board back to the initial sample engineering sprint?')) return;

    setIsResetting(true);
    try {
      const res = await fetch('/api/board/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      showToast('Database reset and re-seeded with demo data.');
      await fetchBoard();
    } catch (err: any) {
      showToast(err.message || 'Failed to reset data', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const allTasks = useMemo(() => {
    return boardData ? boardData.columns.flatMap((c) => c.tasks) : [];
  }, [boardData]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Loading DAG Dependency Engine...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div
            className={`p-4 rounded-xl border shadow-xl flex items-start space-x-3 max-w-md ${
              toast.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <div className="text-xs font-medium leading-relaxed">{toast.message}</div>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenCreateTask={() => {
          setCreateDefaultColumnId(undefined);
          setIsCreateModalOpen(true);
        }}
        onResetData={handleResetData}
        isResetting={isResetting}
      />

      {/* Stats Summary Bar */}
      {boardData && (
        <StatsBar
          columns={boardData.columns}
          projectDurationDays={boardData.criticalPath.projectDurationDays}
          criticalCount={boardData.criticalPath.criticalTaskIds.length}
        />
      )}

      {/* Main View Area */}
      <main className="flex-1 pb-10">
        {currentView === 'kanban' && boardData && (
          <div className="space-y-6">
            <KanbanBoard
              columns={boardData.columns}
              onEditTask={(task) => setEditingTask(task)}
              onOpenDependencies={(task) => setDependencyModalTask(task)}
              onOpenCreateTask={(columnId) => {
                setCreateDefaultColumnId(columnId);
                setIsCreateModalOpen(true);
              }}
              onMoveTask={handleMoveTask}
            />

            {/* Bottom Activity Stream */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <ActivitySidebar activities={boardData.activities} />
            </div>
          </div>
        )}

        {currentView === 'timeline' && boardData && (
          <TimelineView
            columns={boardData.columns}
            dependencies={boardData.dependencies}
            criticalPath={boardData.criticalPath}
            onEditTask={(task) => setEditingTask(task)}
            onOpenDependencies={(task) => setDependencyModalTask(task)}
          />
        )}

        {currentView === 'architecture' && <DAGArchitectureView />}
      </main>

      {/* Create / Edit Task Modal */}
      {(isCreateModalOpen || editingTask) && boardData && (
        <TaskModal
          task={editingTask}
          columns={boardData.columns}
          defaultColumnId={createDefaultColumnId}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingTask(null);
          }}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      )}

      {/* Dependency Manager Modal */}
      {dependencyModalTask && boardData && (
        <DependencyModal
          task={dependencyModalTask}
          allTasks={allTasks}
          dependencies={boardData.dependencies}
          onClose={() => setDependencyModalTask(null)}
          onAddDependency={handleAddDependency}
          onDeleteDependency={handleDeleteDependency}
        />
      )}
    </div>
  );
}

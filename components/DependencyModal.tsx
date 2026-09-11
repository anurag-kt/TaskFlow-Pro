'use client';

import React, { useState } from 'react';
import { Task, TaskDependency } from '@/lib/types';
import { X, GitFork, Trash2, Plus, AlertOctagon, ArrowRight, ShieldCheck } from 'lucide-react';

interface DependencyModalProps {
  task: Task;
  allTasks: Task[];
  dependencies: TaskDependency[];
  onClose: () => void;
  onAddDependency: (taskId: string, dependsOnId: string) => Promise<{ success?: boolean; error?: string; path?: string[] }>;
  onDeleteDependency: (dependencyId: string) => Promise<void>;
}

export default function DependencyModal({
  task,
  allTasks,
  dependencies,
  onClose,
  onAddDependency,
  onDeleteDependency,
}: DependencyModalProps) {
  const [selectedDependsOnId, setSelectedDependsOnId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Current prerequisites: tasks that THIS task depends on (this task is blocked by them)
  const currentPrereqDeps = dependencies.filter((d) => d.task_id === task.id);
  const currentPrereqIds = currentPrereqDeps.map((d) => d.depends_on_id);

  // Available tasks to add as prerequisite (cannot depend on itself or already linked)
  const availablePrereqs = allTasks.filter(
    (t) => t.id !== task.id && !currentPrereqIds.includes(t.id)
  );

  // Downstream tasks that depend on THIS task
  const downstreamDeps = dependencies.filter((d) => d.depends_on_id === task.id);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDependsOnId) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await onAddDependency(task.id, selectedDependsOnId);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSelectedDependsOnId('');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to add dependency.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <GitFork className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Manage Dependencies</h3>
              <p className="text-xs text-slate-500 truncate max-w-xs">{task.title}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Error Banner for Cycle Detection */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start space-x-2.5">
              <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Circular Dependency Blocked (Trapdoor 1 Guard)</p>
                <p className="mt-0.5 leading-relaxed text-rose-700">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Section 1: Prerequisite Blockers */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Prerequisite Tasks (This task is blocked by:)
            </h4>

            {currentPrereqDeps.length === 0 ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>No prerequisites linked. This task is ready to start.</span>
              </div>
            ) : (
              <div className="space-y-2">
                {currentPrereqDeps.map((dep) => {
                  const prereqTask = allTasks.find((t) => t.id === dep.depends_on_id);
                  if (!prereqTask) return null;

                  return (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center space-x-2.5 truncate pr-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            prereqTask.status === 'Done' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {prereqTask.title}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border">
                          {prereqTask.status}
                        </span>
                      </div>

                      <button
                        onClick={() => onDeleteDependency(dep.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors"
                        title="Remove dependency"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Add Prerequisite Form */}
          <form onSubmit={handleAdd} className="pt-2 border-t border-slate-200">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Add New Blocker Prerequisite
            </label>
            <div className="flex space-x-2">
              <select
                value={selectedDependsOnId}
                onChange={(e) => setSelectedDependsOnId(e.target.value)}
                className="flex-1 text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">-- Select a prerequisite task --</option>
                {availablePrereqs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.status})
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={!selectedDependsOnId || isSubmitting}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Link</span>
              </button>
            </div>
          </form>

          {/* Section 3: Downstream Dependents Info */}
          {downstreamDeps.length > 0 && (
            <div className="pt-2 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Downstream Dependent Tasks (Blocked by this task):
              </h4>
              <div className="space-y-1.5">
                {downstreamDeps.map((dep) => {
                  const downTask = allTasks.find((t) => t.id === dep.task_id);
                  if (!downTask) return null;

                  return (
                    <div
                      key={dep.id}
                      className="text-xs text-slate-600 flex items-center space-x-2 pl-2"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span>{downTask.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

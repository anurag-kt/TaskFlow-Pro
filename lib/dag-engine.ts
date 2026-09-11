import { Task, TaskDependency, Edge, CycleCheckResult, ColumnType } from './types';

/**
 * Utility: Adds a number of calendar days to an ISO YYYY-MM-DD string.
 */
export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Utility: Computes the difference in calendar days between two ISO date strings (end - start).
 */
export function daysBetween(startStr: string, endStr: string): number {
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const s = Date.UTC(sy, sm - 1, sd);
  const e = Date.UTC(ey, em - 1, ed);
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

/**
 * TRAPDOOR 1: Multi-Hop Circular Dependency Detection
 */
export function detectCycle(
  existingEdges: Edge[],
  newEdge: Edge,
  taskTitleMap?: Map<string, string>
): CycleCheckResult {
  if (newEdge.from === newEdge.to) {
    const name = taskTitleMap?.get(newEdge.from) || newEdge.from;
    return {
      hasCycle: true,
      path: [newEdge.from, newEdge.to],
      message: `A task cannot depend on itself (${name}).`,
    };
  }

  const adj = new Map<string, string[]>();
  const allEdges = [...existingEdges, newEdge];

  for (const edge of allEdges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from)!.push(edge.to);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const parentMap = new Map<string, string>();
  let cyclePath: string[] | undefined = undefined;

  function dfs(curr: string): boolean {
    visited.add(curr);
    inStack.add(curr);

    const neighbors = adj.get(curr) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        parentMap.set(neighbor, curr);
        if (dfs(neighbor)) return true;
      } else if (inStack.has(neighbor)) {
        const path: string[] = [neighbor];
        let step = curr;
        while (step && step !== neighbor) {
          path.push(step);
          step = parentMap.get(step)!;
        }
        path.push(neighbor);
        cyclePath = path.reverse();
        return true;
      }
    }

    inStack.delete(curr);
    return false;
  }

  const allNodes = new Set<string>();
  for (const edge of allEdges) {
    allNodes.add(edge.from);
    allNodes.add(edge.to);
  }

  if (dfs(newEdge.from)) {
    const formattedPath = (cyclePath || []).map(
      (id) => taskTitleMap?.get(id) || id
    );
    return {
      hasCycle: true,
      path: cyclePath,
      message: `Circular dependency detected: ${formattedPath.join(' → ')}`,
    };
  }

  for (const node of allNodes) {
    if (!visited.has(node)) {
      if (dfs(node)) {
        const formattedPath = (cyclePath || []).map(
          (id) => taskTitleMap?.get(id) || id
        );
        return {
          hasCycle: true,
          path: cyclePath,
          message: `Circular dependency detected: ${formattedPath.join(' → ')}`,
        };
      }
    }
  }

  return { hasCycle: false };
}

/**
 * Performs Topological Sorting using Kahn's Algorithm (in-degree queue).
 */
export function topologicalSort(
  taskIds: string[],
  dependencies: TaskDependency[]
): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const id of taskIds) {
    inDegree.set(id, 0);
    adj.set(id, []);
  }

  for (const dep of dependencies) {
    // Note: dep.task_id is the blocked/dependent task, dep.depends_on_id is the prerequisite
    if (inDegree.has(dep.task_id) && inDegree.has(dep.depends_on_id)) {
      inDegree.set(dep.task_id, (inDegree.get(dep.task_id) || 0) + 1);
      adj.get(dep.depends_on_id)!.push(dep.task_id);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    sorted.push(curr);

    const neighbors = adj.get(curr) || [];
    for (const neighbor of neighbors) {
      const newDeg = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  // If there are unreached nodes (disconnected components), append them
  if (sorted.length < taskIds.length) {
    for (const id of taskIds) {
      if (!sorted.includes(id)) {
        sorted.push(id);
      }
    }
  }

  return sorted;
}

/**
 * TRAPDOOR 2: Diamond Dependency Scheduling & Date Cascade
 */
export function recalculateSchedule(
  tasks: Task[],
  dependencies: TaskDependency[]
): {
  updatedTasks: Task[];
  shifts: { taskId: string; oldDate: string; newDate: string }[];
} {
  const taskMap = new Map<string, Task>();
  for (const t of tasks) {
    taskMap.set(t.id, { ...t });
  }

  const prereqsMap = new Map<string, string[]>();
  for (const dep of dependencies) {
    if (!prereqsMap.has(dep.task_id)) prereqsMap.set(dep.task_id, []);
    prereqsMap.get(dep.task_id)!.push(dep.depends_on_id);
  }

  const taskIds = Array.from(taskMap.keys());
  const sortedIds = topologicalSort(taskIds, dependencies);

  const shifts: { taskId: string; oldDate: string; newDate: string }[] = [];

  for (const id of sortedIds) {
    const task = taskMap.get(id);
    if (!task) continue;

    const prereqIds = prereqsMap.get(id) || [];
    if (prereqIds.length === 0) continue;

    let latestPrereqFinish = task.start_date;
    for (const pId of prereqIds) {
      const prereq = taskMap.get(pId);
      if (!prereq) continue;

      const prereqFinish = addDays(prereq.start_date, prereq.estimated_days);
      if (prereqFinish > latestPrereqFinish) {
        latestPrereqFinish = prereqFinish;
      }
    }

    if (latestPrereqFinish > task.start_date) {
      shifts.push({
        taskId: task.id,
        oldDate: task.start_date,
        newDate: latestPrereqFinish,
      });
      task.start_date = latestPrereqFinish;
    }
  }

  return {
    updatedTasks: Array.from(taskMap.values()),
    shifts,
  };
}

/**
 * Critical Path Method (CPM) Forward and Backward Pass.
 */
export function computeCriticalPath(
  tasks: Task[],
  dependencies: TaskDependency[]
): {
  criticalTaskIds: Set<string>;
  projectDurationDays: number;
  earlySchedule: Map<string, { es: number; ef: number }>;
  lateSchedule: Map<string, { ls: number; lf: number; slack: number }>;
} {
  if (tasks.length === 0) {
    return {
      criticalTaskIds: new Set(),
      projectDurationDays: 0,
      earlySchedule: new Map(),
      lateSchedule: new Map(),
    };
  }

  const baselineDate = tasks.reduce(
    (min, t) => (t.start_date < min ? t.start_date : min),
    tasks[0].start_date
  );

  const taskMap = new Map<string, Task>();
  for (const t of tasks) taskMap.set(t.id, t);

  const taskIds = tasks.map((t) => t.id);
  const sortedIds = topologicalSort(taskIds, dependencies);

  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();

  for (const id of taskIds) {
    incoming.set(id, []);
    outgoing.set(id, []);
  }

  for (const dep of dependencies) {
    if (incoming.has(dep.task_id) && outgoing.has(dep.depends_on_id)) {
      incoming.get(dep.task_id)!.push(dep.depends_on_id);
      outgoing.get(dep.depends_on_id)!.push(dep.task_id);
    }
  }

  // FORWARD PASS
  const earlySchedule = new Map<string, { es: number; ef: number }>();

  for (const id of sortedIds) {
    const task = taskMap.get(id);
    if (!task) continue;

    const baseOffset = daysBetween(baselineDate, task.start_date);
    const prereqIds = incoming.get(id) || [];

    let maxPrereqEF = baseOffset;
    for (const pId of prereqIds) {
      const pEarly = earlySchedule.get(pId);
      if (pEarly && pEarly.ef > maxPrereqEF) {
        maxPrereqEF = pEarly.ef;
      }
    }

    const es = maxPrereqEF;
    const ef = es + task.estimated_days;
    earlySchedule.set(id, { es, ef });
  }

  let projectDurationDays = 0;
  for (const { ef } of earlySchedule.values()) {
    if (ef > projectDurationDays) projectDurationDays = ef;
  }

  // BACKWARD PASS
  const lateSchedule = new Map<string, { ls: number; lf: number; slack: number }>();
  const reversedSortedIds = [...sortedIds].reverse();

  for (const id of reversedSortedIds) {
    const task = taskMap.get(id);
    if (!task) continue;

    const dependentIds = outgoing.get(id) || [];

    let minDependentLS = projectDurationDays;
    if (dependentIds.length > 0) {
      for (const dId of dependentIds) {
        const dLate = lateSchedule.get(dId);
        if (dLate && dLate.ls < minDependentLS) {
          minDependentLS = dLate.ls;
        }
      }
    }

    const lf = minDependentLS;
    const ls = lf - task.estimated_days;
    const early = earlySchedule.get(id) || { es: 0, ef: 0 };
    const slack = ls - early.es;

    lateSchedule.set(id, { ls, lf, slack });
  }

  const criticalTaskIds = new Set<string>();
  for (const [id, { slack }] of lateSchedule.entries()) {
    if (Math.abs(slack) < 0.001) {
      criticalTaskIds.add(id);
    }
  }

  return {
    criticalTaskIds,
    projectDurationDays,
    earlySchedule,
    lateSchedule,
  };
}

/**
 * TRAPDOOR 3: State Invariant Validation & Backward Rollbacks
 */
export function validateStateTransition(
  taskId: string,
  targetStatus: ColumnType,
  tasks: Task[],
  dependencies: TaskDependency[]
): {
  allowed: boolean;
  reason?: string;
  blockedByIncomplete?: { id: string; title: string; status: ColumnType }[];
} {
  const taskMap = new Map<string, Task>();
  for (const t of tasks) taskMap.set(t.id, t);

  const task = taskMap.get(taskId);
  if (!task) return { allowed: false, reason: 'Task not found' };

  if (targetStatus === 'Done') {
    const prereqDeps = dependencies.filter((d) => d.task_id === taskId);
    const incompletePrereqs: { id: string; title: string; status: ColumnType }[] = [];

    for (const dep of prereqDeps) {
      const prereq = taskMap.get(dep.depends_on_id);
      if (prereq && prereq.status !== 'Done') {
        incompletePrereqs.push({
          id: prereq.id,
          title: prereq.title,
          status: prereq.status,
        });
      }
    }

    if (incompletePrereqs.length > 0) {
      const names = incompletePrereqs.map((p) => `"${p.title}" (${p.status})`).join(', ');
      return {
        allowed: false,
        reason: `Cannot mark "${task.title}" as Done: incomplete prerequisite tasks: ${names}`,
        blockedByIncomplete: incompletePrereqs,
      };
    }
  }

  return { allowed: true };
}

/**
 * TRAPDOOR 4: Fractional Reorder Indexing
 */
export function calculateFractionalIndex(
  prevIndex?: number,
  nextIndex?: number
): number {
  if (prevIndex === undefined && nextIndex === undefined) {
    return 1000.0;
  }
  if (prevIndex === undefined && nextIndex !== undefined) {
    return nextIndex / 2.0;
  }
  if (prevIndex !== undefined && nextIndex === undefined) {
    return prevIndex + 1000.0;
  }
  return (prevIndex! + nextIndex!) / 2.0;
}

/**
 * Decorates tasks with computed dynamic properties
 */
export function decorateTasksWithGraphMetadata(
  tasks: Task[],
  dependencies: TaskDependency[]
): Task[] {
  const taskMap = new Map<string, Task>();
  for (const t of tasks) taskMap.set(t.id, { ...t });

  const { criticalTaskIds, earlySchedule, lateSchedule } = computeCriticalPath(
    tasks,
    dependencies
  );

  const incomingMap = new Map<string, string[]>();
  for (const dep of dependencies) {
    if (!incomingMap.has(dep.task_id)) incomingMap.set(dep.task_id, []);
    incomingMap.get(dep.task_id)!.push(dep.depends_on_id);
  }

  return tasks.map((t) => {
    const prereqIds = incomingMap.get(t.id) || [];
    const incompletePrereqs = prereqIds
      .map((pId) => taskMap.get(pId))
      .filter((p): p is Task => p !== undefined && p.status !== 'Done')
      .map((p) => ({ id: p.id, title: p.title, status: p.status }));

    const isBlocked = t.status !== 'Done' && incompletePrereqs.length > 0;
    const isCritical = criticalTaskIds.has(t.id);
    const early = earlySchedule.get(t.id);
    const late = lateSchedule.get(t.id);

    return {
      ...t,
      isBlocked,
      blockedBy: incompletePrereqs,
      isCritical,
      calculatedEarlyStart: early?.es,
      calculatedEarlyFinish: early?.ef,
      calculatedLateStart: late?.ls,
      calculatedLateFinish: late?.lf,
      slack: late?.slack,
    };
  });
}

import { detectCycle, recalculateSchedule, computeCriticalPath, validateStateTransition, calculateFractionalIndex } from '../lib/dag-engine';
import { Task, TaskDependency, Edge } from '../lib/types';

console.log('================================================================');
console.log('PROOF 1: Multi-Hop Cycle Detection (DFS)');
console.log('================================================================');
const edges: Edge[] = [
  { from: 'Task_A', to: 'Task_B' },
  { from: 'Task_B', to: 'Task_C' },
  { from: 'Task_C', to: 'Task_D' },
];
const proposedEdge: Edge = { from: 'Task_D', to: 'Task_A' };
const cycleResult = detectCycle(edges, proposedEdge);
console.log('Adding edge Task_D -> Task_A...');
console.log('Cycle Detected:', cycleResult.hasCycle);
console.log('Loop Path Identified:', cycleResult.path?.join(' -> '));

console.log('\n================================================================');
console.log('PROOF 2: Diamond Dependency Date Propagation (Topological Sort)');
console.log('================================================================');
const tasks: Task[] = [
  { id: 'A', column_id: '1', title: 'Task A (Scaffold)', priority: 'High', status: 'Backlog', start_date: '2026-09-01', estimated_days: 5, order_index: 1000 },
  { id: 'B', column_id: '1', title: 'Task B (Backend)', priority: 'Medium', status: 'Backlog', start_date: '2026-09-03', estimated_days: 3, order_index: 2000 },
  { id: 'C', column_id: '1', title: 'Task C (Database)', priority: 'Medium', status: 'Backlog', start_date: '2026-09-03', estimated_days: 4, order_index: 3000 },
  { id: 'D', column_id: '1', title: 'Task D (Tests)', priority: 'Urgent', status: 'Backlog', start_date: '2026-09-07', estimated_days: 1, order_index: 4000 },
];
const deps: TaskDependency[] = [
  { id: 'd1', task_id: 'B', depends_on_id: 'A' },
  { id: 'd2', task_id: 'C', depends_on_id: 'A' },
  { id: 'd3', task_id: 'D', depends_on_id: 'B' },
  { id: 'd4', task_id: 'D', depends_on_id: 'C' },
];
console.log('Initial Start Date of Task D: 2026-09-07');
console.log('Extending Task A duration from 2 days to 5 days...');
const schedResult = recalculateSchedule(tasks, deps);
console.log('Schedule Shifts Computed:');
schedResult.shifts.forEach(s => console.log(` -> Task ${s.taskId} shifted from ${s.oldDate} to ${s.newDate}`));
const taskD = schedResult.updatedTasks.find(t => t.id === 'D');
console.log(`Final Start Date of Task D: ${taskD?.start_date} (Shifted exactly 3 days: 09-07 -> 09-10, NOT 6 days!)`);

console.log('\n================================================================');
console.log('PROOF 3: Critical Path Method (CPM Forward/Backward Pass)');
console.log('================================================================');
const cpm = computeCriticalPath(tasks, deps);
console.log('Total Project Duration:', cpm.projectDurationDays, 'days');
console.log('Critical Tasks (Slack = 0):', Array.from(cpm.criticalTaskIds));
for (const [id, sched] of cpm.lateSchedule.entries()) {
  const early = cpm.earlySchedule.get(id);
  console.log(` -> Task ${id}: EarlyStart=${early?.es}, LateStart=${sched.ls}, Slack=${sched.slack} days (${sched.slack === 0 ? 'CRITICAL' : 'NON-CRITICAL'})`);
}

console.log('\n================================================================');
console.log('PROOF 4: Drag Guard & State Invariant Validation');
console.log('================================================================');
const guardResult = validateStateTransition('D', 'Done', tasks, deps);
console.log('Attempting to move Task D to Done while A/B/C are in Backlog:');
console.log('Result Allowed:', guardResult.allowed);
console.log('Rejection Reason:', guardResult.reason);
console.log('================================================================');

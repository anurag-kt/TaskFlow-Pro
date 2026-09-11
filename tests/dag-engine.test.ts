import {
  detectCycle,
  recalculateSchedule,
  computeCriticalPath,
  validateStateTransition,
  calculateFractionalIndex,
  decorateTasksWithGraphMetadata,
} from '../lib/dag-engine';
import { Task, TaskDependency, Edge } from '../lib/types';

describe('DAG Engine - Core Algorithmic Tests', () => {
  describe('Trapdoor 1: Cycle Detection (DFS)', () => {
    it('should reject self-dependency (A -> A)', () => {
      const edges: Edge[] = [];
      const newEdge: Edge = { from: 'task_A', to: 'task_A' };
      const result = detectCycle(edges, newEdge);
      expect(result.hasCycle).toBe(true);
      expect(result.message).toContain('cannot depend on itself');
    });

    it('should detect a direct 2-node cycle (A -> B, then B -> A)', () => {
      const edges: Edge[] = [{ from: 'task_A', to: 'task_B' }];
      const newEdge: Edge = { from: 'task_B', to: 'task_A' };
      const result = detectCycle(edges, newEdge);
      expect(result.hasCycle).toBe(true);
    });

    it('should detect a multi-hop 4-node cycle (A -> B -> C -> D -> A)', () => {
      const edges: Edge[] = [
        { from: 'task_A', to: 'task_B' },
        { from: 'task_B', to: 'task_C' },
        { from: 'task_C', to: 'task_D' },
      ];
      const newEdge: Edge = { from: 'task_D', to: 'task_A' };
      const result = detectCycle(edges, newEdge);
      expect(result.hasCycle).toBe(true);
      expect(result.path?.length).toBe(5);
    });

    it('should allow valid non-cyclic diamond graph edges (A->B, A->C, B->D, C->D)', () => {
      const edges: Edge[] = [
        { from: 'task_A', to: 'task_B' },
        { from: 'task_A', to: 'task_C' },
        { from: 'task_B', to: 'task_D' },
      ];
      const newEdge: Edge = { from: 'task_C', to: 'task_D' };
      const result = detectCycle(edges, newEdge);
      expect(result.hasCycle).toBe(false);
    });
  });

  describe('Trapdoor 2: Diamond Dependency Scheduling', () => {
    it('should shift Task D by exactly 3 days when Task A extends by 3 days in a diamond graph', () => {
      const tasks: Task[] = [
        { id: 'A', column_id: '1', title: 'Task A', priority: 'High', status: 'Backlog', start_date: '2026-09-01', estimated_days: 5, order_index: 1000 },
        { id: 'B', column_id: '1', title: 'Task B', priority: 'Medium', status: 'Backlog', start_date: '2026-09-03', estimated_days: 3, order_index: 2000 },
        { id: 'C', column_id: '1', title: 'Task C', priority: 'Medium', status: 'Backlog', start_date: '2026-09-03', estimated_days: 4, order_index: 3000 },
        { id: 'D', column_id: '1', title: 'Task D', priority: 'Urgent', status: 'Backlog', start_date: '2026-09-07', estimated_days: 1, order_index: 4000 },
      ];

      const dependencies: TaskDependency[] = [
        { id: 'd1', task_id: 'B', depends_on_id: 'A' },
        { id: 'd2', task_id: 'C', depends_on_id: 'A' },
        { id: 'd3', task_id: 'D', depends_on_id: 'B' },
        { id: 'd4', task_id: 'D', depends_on_id: 'C' },
      ];

      const { updatedTasks, shifts } = recalculateSchedule(tasks, dependencies);

      const taskMap = new Map(updatedTasks.map((t) => [t.id, t]));
      expect(taskMap.get('B')!.start_date).toBe('2026-09-06');
      expect(taskMap.get('C')!.start_date).toBe('2026-09-06');
      expect(taskMap.get('D')!.start_date).toBe('2026-09-10');
      expect(shifts.length).toBe(3);
    });
  });

  describe('Critical Path Method (CPM)', () => {
    it('should correctly identify the critical path in a project network', () => {
      const tasks: Task[] = [
        { id: 'A', column_id: '1', title: 'Task A', priority: 'High', status: 'Backlog', start_date: '2026-09-01', estimated_days: 2, order_index: 1000 },
        { id: 'B', column_id: '1', title: 'Task B', priority: 'Medium', status: 'Backlog', start_date: '2026-09-03', estimated_days: 3, order_index: 2000 },
        { id: 'C', column_id: '1', title: 'Task C', priority: 'Medium', status: 'Backlog', start_date: '2026-09-03', estimated_days: 5, order_index: 3000 },
        { id: 'D', column_id: '1', title: 'Task D', priority: 'Urgent', status: 'Backlog', start_date: '2026-09-08', estimated_days: 1, order_index: 4000 },
      ];

      const dependencies: TaskDependency[] = [
        { id: 'd1', task_id: 'B', depends_on_id: 'A' },
        { id: 'd2', task_id: 'C', depends_on_id: 'A' },
        { id: 'd3', task_id: 'D', depends_on_id: 'B' },
        { id: 'd4', task_id: 'D', depends_on_id: 'C' },
      ];

      const { criticalTaskIds, projectDurationDays, lateSchedule } = computeCriticalPath(tasks, dependencies);

      expect(projectDurationDays).toBe(8);
      expect(criticalTaskIds.has('A')).toBe(true);
      expect(criticalTaskIds.has('C')).toBe(true);
      expect(criticalTaskIds.has('D')).toBe(true);
      expect(criticalTaskIds.has('B')).toBe(false);

      expect(lateSchedule.get('B')!.slack).toBe(2);
      expect(lateSchedule.get('C')!.slack).toBe(0);
    });
  });

  describe('Trapdoor 3: State Invariant & Blocked Drag Validation', () => {
    it('should disallow moving task to Done when prerequisites are incomplete', () => {
      const tasks: Task[] = [
        { id: 'A', column_id: '1', title: 'Backend API', priority: 'High', status: 'In Progress', start_date: '2026-09-01', estimated_days: 2, order_index: 1000 },
        { id: 'B', column_id: '1', title: 'Integration Tests', priority: 'Urgent', status: 'Backlog', start_date: '2026-09-03', estimated_days: 1, order_index: 2000 },
      ];
      const dependencies: TaskDependency[] = [
        { id: 'd1', task_id: 'B', depends_on_id: 'A' },
      ];

      const validation = validateStateTransition('B', 'Done', tasks, dependencies);
      expect(validation.allowed).toBe(false);
      expect(validation.reason).toContain('incomplete prerequisite tasks');
    });

    it('should allow moving task to Done when all prerequisites are Done', () => {
      const tasks: Task[] = [
        { id: 'A', column_id: '1', title: 'Backend API', priority: 'High', status: 'Done', start_date: '2026-09-01', estimated_days: 2, order_index: 1000 },
        { id: 'B', column_id: '1', title: 'Integration Tests', priority: 'Urgent', status: 'In Progress', start_date: '2026-09-03', estimated_days: 1, order_index: 2000 },
      ];
      const dependencies: TaskDependency[] = [
        { id: 'd1', task_id: 'B', depends_on_id: 'A' },
      ];

      const validation = validateStateTransition('B', 'Done', tasks, dependencies);
      expect(validation.allowed).toBe(true);
    });
  });

  describe('Trapdoor 4: Fractional Reorder Indexing', () => {
    it('should compute correct midpoint indexes between cards', () => {
      expect(calculateFractionalIndex(undefined, undefined)).toBe(1000.0);
      expect(calculateFractionalIndex(undefined, 1000.0)).toBe(500.0);
      expect(calculateFractionalIndex(1000.0, undefined)).toBe(2000.0);
      expect(calculateFractionalIndex(1000.0, 2000.0)).toBe(1500.0);
      expect(calculateFractionalIndex(1000.0, 1500.0)).toBe(1250.0);
    });
  });

  describe('Task Decoration Metadata', () => {
    it('should decorate tasks with isBlocked and isCritical properties', () => {
      const tasks: Task[] = [
        { id: 'A', column_id: '1', title: 'Task A', priority: 'High', status: 'Done', start_date: '2026-09-01', estimated_days: 2, order_index: 1000 },
        { id: 'B', column_id: '1', title: 'Task B', priority: 'Medium', status: 'In Progress', start_date: '2026-09-03', estimated_days: 3, order_index: 2000 },
        { id: 'C', column_id: '1', title: 'Task C', priority: 'Medium', status: 'Backlog', start_date: '2026-09-03', estimated_days: 5, order_index: 3000 },
        { id: 'D', column_id: '1', title: 'Task D', priority: 'Urgent', status: 'Backlog', start_date: '2026-09-08', estimated_days: 1, order_index: 4000 },
      ];

      const dependencies: TaskDependency[] = [
        { id: 'd1', task_id: 'B', depends_on_id: 'A' },
        { id: 'd2', task_id: 'C', depends_on_id: 'A' },
        { id: 'd3', task_id: 'D', depends_on_id: 'B' },
        { id: 'd4', task_id: 'D', depends_on_id: 'C' },
      ];

      const decorated = decorateTasksWithGraphMetadata(tasks, dependencies);
      const map = new Map(decorated.map((t) => [t.id, t]));

      expect(map.get('A')!.isBlocked).toBe(false);
      expect(map.get('B')!.isBlocked).toBe(false); // A is Done, so B is not blocked
      expect(map.get('C')!.isBlocked).toBe(false); // A is Done, so C is not blocked
      expect(map.get('D')!.isBlocked).toBe(true);  // B and C are not Done, so D is blocked!
      expect(map.get('D')!.blockedBy?.length).toBe(2);
      expect(map.get('D')!.isCritical).toBe(true);
    });
  });
});

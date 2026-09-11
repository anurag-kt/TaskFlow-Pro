import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Task, TaskDependency, Edge } from '@/lib/types';
import { detectCycle, recalculateSchedule } from '@/lib/dag-engine';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { taskId, dependsOnId } = body;

    if (!taskId || !dependsOnId) {
      return NextResponse.json({ error: 'taskId and dependsOnId are required' }, { status: 400 });
    }

    if (taskId === dependsOnId) {
      return NextResponse.json({ error: 'A task cannot depend on itself.' }, { status: 400 });
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Task | undefined;
    const prereq = db.prepare('SELECT * FROM tasks WHERE id = ?').get(dependsOnId) as Task | undefined;

    if (!task || !prereq) {
      return NextResponse.json({ error: 'One or both tasks not found' }, { status: 404 });
    }

    // Check if already exists
    const existing = db.prepare(`
      SELECT * FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?
    `).get(taskId, dependsOnId);

    if (existing) {
      return NextResponse.json({ error: 'This dependency already exists.' }, { status: 400 });
    }

    // Fetch all existing dependencies
    const allDeps = db.prepare('SELECT * FROM task_dependencies').all() as TaskDependency[];
    const allTasks = db.prepare('SELECT id, title FROM tasks').all() as { id: string; title: string }[];
    const titleMap = new Map<string, string>(allTasks.map((t) => [t.id, t.title]));

    const existingEdges: Edge[] = allDeps.map((d) => ({
      from: d.depends_on_id,
      to: d.task_id,
    }));

    const newEdge: Edge = {
      from: dependsOnId,
      to: taskId,
    };

    // TRAPDOOR 1: Multi-Hop Cycle Detection
    const cycleCheck = detectCycle(existingEdges, newEdge, titleMap);
    if (cycleCheck.hasCycle) {
      return NextResponse.json({
        error: cycleCheck.message || 'Circular dependency detected. Action blocked.',
        path: cycleCheck.path,
      }, { status: 400 });
    }

    // Insert new dependency
    const depId = `dep-${Date.now()}`;
    db.prepare(`
      INSERT INTO task_dependencies (id, task_id, depends_on_id)
      VALUES (?, ?, ?)
    `).run(depId, taskId, dependsOnId);

    // TRAPDOOR 2: Recalculate schedule cascade
    const currentTasks = db.prepare('SELECT * FROM tasks').all() as Task[];
    const updatedDeps = [...allDeps, { id: depId, task_id: taskId, depends_on_id: dependsOnId }];
    const { shifts } = recalculateSchedule(currentTasks, updatedDeps);

    if (shifts.length > 0) {
      const updateShiftStmt = db.prepare("UPDATE tasks SET start_date = ?, updated_at = datetime('now') WHERE id = ?");
      const tx = db.transaction(() => {
        for (const shift of shifts) {
          updateShiftStmt.run(shift.newDate, shift.taskId);
        }
      });
      tx();
    }

    const board = db.prepare('SELECT id FROM boards LIMIT 1').get() as { id: string };
    db.prepare('INSERT INTO activity_logs (id, board_id, message) VALUES (?, ?, ?)').run(
      `log-${Date.now()}`,
      board.id,
      `Linked dependency: "${task.title}" is now blocked by "${prereq.title}".`
    );

    return NextResponse.json({ success: true, dependencyId: depId });
  } catch (error: any) {
    console.error('Error adding dependency:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Dependency id is required' }, { status: 400 });
    }

    const dep = db.prepare('SELECT * FROM task_dependencies WHERE id = ?').get(id) as TaskDependency | undefined;
    if (!dep) {
      return NextResponse.json({ error: 'Dependency not found' }, { status: 404 });
    }

    const task = db.prepare('SELECT title FROM tasks WHERE id = ?').get(dep.task_id) as { title: string } | undefined;
    const prereq = db.prepare('SELECT title FROM tasks WHERE id = ?').get(dep.depends_on_id) as { title: string } | undefined;
    const board = db.prepare('SELECT id FROM boards LIMIT 1').get() as { id: string };

    db.prepare('DELETE FROM task_dependencies WHERE id = ?').run(id);

    db.prepare('INSERT INTO activity_logs (id, board_id, message) VALUES (?, ?, ?)').run(
      `log-${Date.now()}`,
      board.id,
      `Removed dependency: "${task?.title}" is no longer blocked by "${prereq?.title}".`
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting dependency:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

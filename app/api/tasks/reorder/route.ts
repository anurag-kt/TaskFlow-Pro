import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Task, Column, TaskDependency } from '@/lib/types';
import { validateStateTransition, calculateFractionalIndex } from '@/lib/dag-engine';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { taskId, targetColumnId, prevIndex, nextIndex } = body;

    if (!taskId || !targetColumnId) {
      return NextResponse.json({ error: 'taskId and targetColumnId are required' }, { status: 400 });
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Task | undefined;
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const targetColumn = db.prepare('SELECT * FROM columns WHERE id = ?').get(targetColumnId) as Column | undefined;
    if (!targetColumn) {
      return NextResponse.json({ error: 'Target column not found' }, { status: 404 });
    }

    const allTasks = db.prepare('SELECT * FROM tasks').all() as Task[];
    const allDeps = db.prepare('SELECT * FROM task_dependencies').all() as TaskDependency[];
    const board = db.prepare('SELECT id FROM boards LIMIT 1').get() as { id: string };

    // TRAPDOOR 3: Validate Drag Guard when moving to Done column
    if (targetColumn.title === 'Done' && task.status !== 'Done') {
      const validation = validateStateTransition(taskId, 'Done', allTasks, allDeps);
      if (!validation.allowed) {
        return NextResponse.json({ error: validation.reason }, { status: 400 });
      }
    }

    // TRAPDOOR 4: Fractional Reordering Index
    const newOrderIndex = calculateFractionalIndex(prevIndex, nextIndex);

    db.prepare(`
      UPDATE tasks 
      SET column_id = ?, status = ?, order_index = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(targetColumn.id, targetColumn.title, newOrderIndex, taskId);

    if (task.column_id !== targetColumn.id) {
      db.prepare('INSERT INTO activity_logs (id, board_id, message) VALUES (?, ?, ?)').run(
        `log-${Date.now()}`,
        board.id,
        `Moved "${task.title}" to ${targetColumn.title}.`
      );
    }

    return NextResponse.json({ success: true, order_index: newOrderIndex });
  } catch (error: any) {
    console.error('Error reordering task:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

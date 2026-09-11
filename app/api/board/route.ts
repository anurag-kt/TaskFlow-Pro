import { NextResponse } from 'next/server';
import { db, initDB } from '@/lib/db';
import { Board, Column, Task, TaskDependency, ActivityLog, BoardPayload } from '@/lib/types';
import { decorateTasksWithGraphMetadata, computeCriticalPath, recalculateSchedule } from '@/lib/dag-engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    initDB();

    const board = db.prepare('SELECT * FROM boards LIMIT 1').get() as Board;
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    const columns = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY order_index ASC').all(board.id) as Column[];
    const rawTasks = db.prepare(`
      SELECT * FROM tasks 
      WHERE column_id IN (SELECT id FROM columns WHERE board_id = ?)
      ORDER BY order_index ASC
    `).all(board.id) as Task[];

    const dependencies = db.prepare(`
      SELECT * FROM task_dependencies
      WHERE task_id IN (SELECT id FROM tasks WHERE column_id IN (SELECT id FROM columns WHERE board_id = ?))
    `).all(board.id) as TaskDependency[];

    const activities = db.prepare(`
      SELECT * FROM activity_logs 
      WHERE board_id = ? 
      ORDER BY created_at DESC 
      LIMIT 15
    `).all(board.id) as ActivityLog[];

    // Ensure downstream schedule is synced
    const { updatedTasks, shifts } = recalculateSchedule(rawTasks, dependencies);
    if (shifts.length > 0) {
      const updateStmt = db.prepare("UPDATE tasks SET start_date = ?, updated_at = datetime('now') WHERE id = ?");
      const tx = db.transaction(() => {
        for (const shift of shifts) {
          updateStmt.run(shift.newDate, shift.taskId);
        }
      });
      tx();
    }

    // Decorate with graph metadata
    const decoratedTasks = decorateTasksWithGraphMetadata(updatedTasks, dependencies);
    const { criticalTaskIds, projectDurationDays } = computeCriticalPath(updatedTasks, dependencies);

    // Group tasks into columns
    const columnsWithTasks = columns.map((col) => ({
      ...col,
      tasks: decoratedTasks.filter((t) => t.column_id === col.id),
    }));

    const payload: BoardPayload = {
      board,
      columns: columnsWithTasks,
      dependencies,
      activities,
      criticalPath: {
        criticalTaskIds: Array.from(criticalTaskIds),
        projectDurationDays,
      },
    };

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error('Error fetching board:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

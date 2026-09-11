import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Task, Column } from '@/lib/types';
import { calculateFractionalIndex } from '@/lib/dag-engine';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, priority, start_date, estimated_days, column_id } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
    }

    const board = db.prepare('SELECT id FROM boards LIMIT 1').get() as { id: string };
    const defaultColumn = column_id 
      ? db.prepare('SELECT * FROM columns WHERE id = ?').get(column_id) as Column
      : db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY order_index ASC LIMIT 1').get(board.id) as Column;

    if (!defaultColumn) {
      return NextResponse.json({ error: 'Column not found' }, { status: 404 });
    }

    const lastTask = db.prepare(`
      SELECT order_index FROM tasks WHERE column_id = ? ORDER BY order_index DESC LIMIT 1
    `).get(defaultColumn.id) as { order_index: number } | undefined;

    const order_index = calculateFractionalIndex(lastTask?.order_index, undefined);
    const taskId = `task-${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];

    db.prepare(`
      INSERT INTO tasks (id, column_id, title, description, priority, status, start_date, estimated_days, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      defaultColumn.id,
      title.trim(),
      description?.trim() || '',
      priority || 'Medium',
      defaultColumn.title,
      start_date || today,
      Number(estimated_days) || 1,
      order_index
    );

    // Log activity
    db.prepare('INSERT INTO activity_logs (id, board_id, message) VALUES (?, ?, ?)').run(
      `log-${Date.now()}`,
      board.id,
      `Created task "${title.trim()}".`
    );

    return NextResponse.json({ success: true, taskId });
  } catch (error: any) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Task, Column, TaskDependency } from '@/lib/types';
import { validateStateTransition, recalculateSchedule } from '@/lib/dag-engine';

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;
    const body = await req.json();
    const { title, description, priority, start_date, estimated_days, column_id } = body;

    const existingTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Task | undefined;
    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const board = db.prepare('SELECT id FROM boards LIMIT 1').get() as { id: string };
    const allTasks = db.prepare('SELECT * FROM tasks').all() as Task[];
    const allDeps = db.prepare('SELECT * FROM task_dependencies').all() as TaskDependency[];

    let newStatus = existingTask.status;
    let newColumnId = existingTask.column_id;

    if (column_id && column_id !== existingTask.column_id) {
      const targetColumn = db.prepare('SELECT * FROM columns WHERE id = ?').get(column_id) as Column | undefined;
      if (targetColumn) {
        newStatus = targetColumn.title;
        newColumnId = targetColumn.id;

        // TRAPDOOR 3: Validate Drag Guard when moving to Done
        const validation = validateStateTransition(taskId, newStatus, allTasks, allDeps);
        if (!validation.allowed) {
          return NextResponse.json({ error: validation.reason }, { status: 400 });
        }
      }
    }

    const updatedStartDate = start_date || existingTask.start_date;
    const updatedEstimatedDays = Number(estimated_days) || existingTask.estimated_days;
    const updatedTitle = title ? title.trim() : existingTask.title;
    const updatedDesc = description !== undefined ? description.trim() : existingTask.description;
    const updatedPriority = priority || existingTask.priority;

    db.prepare(`
      UPDATE tasks 
      SET title = ?, description = ?, priority = ?, status = ?, column_id = ?, start_date = ?, estimated_days = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      updatedTitle,
      updatedDesc,
      updatedPriority,
      newStatus,
      newColumnId,
      updatedStartDate,
      updatedEstimatedDays,
      taskId
    );

    // TRAPDOOR 2: If start_date or estimated_days changed, cascade date shifts to downstream dependent tasks
    if (updatedStartDate !== existingTask.start_date || updatedEstimatedDays !== existingTask.estimated_days) {
      const currentTasks = db.prepare('SELECT * FROM tasks').all() as Task[];
      const { shifts } = recalculateSchedule(currentTasks, allDeps);

      if (shifts.length > 0) {
        const updateShiftStmt = db.prepare("UPDATE tasks SET start_date = ?, updated_at = datetime('now') WHERE id = ?");
        const tx = db.transaction(() => {
          for (const shift of shifts) {
            updateShiftStmt.run(shift.newDate, shift.taskId);
          }
        });
        tx();

        const shiftedNames = shifts.map((s) => {
          const t = currentTasks.find((item) => item.id === s.taskId);
          return t ? `"${t.title}" (shifted to ${s.newDate})` : s.taskId;
        }).join(', ');

        db.prepare('INSERT INTO activity_logs (id, board_id, message) VALUES (?, ?, ?)').run(
          `log-${Date.now()}`,
          board.id,
          `Automated Date Shift: Updated downstream schedule for ${shiftedNames}.`
        );
      }
    }

    // Log update
    if (newStatus !== existingTask.status) {
      db.prepare('INSERT INTO activity_logs (id, board_id, message) VALUES (?, ?, ?)').run(
        `log-${Date.now()}`,
        board.id,
        `Moved "${updatedTitle}" from ${existingTask.status} to ${newStatus}.`
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = params.id;
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Task | undefined;
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const board = db.prepare('SELECT id FROM boards LIMIT 1').get() as { id: string };

    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);

    db.prepare('INSERT INTO activity_logs (id, board_id, message) VALUES (?, ?, ?)').run(
      `log-${Date.now()}`,
      board.id,
      `Deleted task "${task.title}".`
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

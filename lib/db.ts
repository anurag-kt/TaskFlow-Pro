import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Board, Column, Task, TaskDependency, ActivityLog, BoardPayload } from './types';
import { decorateTasksWithGraphMetadata, computeCriticalPath } from './dag-engine';

const dbPath = path.join(process.cwd(), 'taskflow.db');
const db = new Database(dbPath);

// High-Performance SQLite Pragmas
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -64000');
db.pragma('mmap_size = 268435456');
db.pragma('temp_store = MEMORY');

// Initialize Tables
export function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS columns (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      title TEXT NOT NULL,
      order_index REAL NOT NULL,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      column_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'Medium',
      status TEXT NOT NULL DEFAULT 'Backlog',
      start_date TEXT NOT NULL,
      estimated_days INTEGER NOT NULL DEFAULT 1,
      order_index REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_column ON tasks(column_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

    CREATE TABLE IF NOT EXISTS task_dependencies (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      depends_on_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (depends_on_id) REFERENCES tasks(id) ON DELETE CASCADE,
      UNIQUE (task_id, depends_on_id)
    );

    CREATE INDEX IF NOT EXISTS idx_deps_task ON task_dependencies(task_id);
    CREATE INDEX IF NOT EXISTS idx_deps_prereq ON task_dependencies(depends_on_id);

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
    );
  `);

  const boardCount = db.prepare('SELECT COUNT(*) as count FROM boards').get() as { count: number };
  if (boardCount.count === 0) {
    seedDatabase();
  }
}

export function seedDatabase() {
  db.exec(`
    DELETE FROM activity_logs;
    DELETE FROM task_dependencies;
    DELETE FROM tasks;
    DELETE FROM columns;
    DELETE FROM boards;
  `);

  const boardId = 'board-default';
  db.prepare('INSERT INTO boards (id, title) VALUES (?, ?)').run(
    boardId,
    'Core Platform Engineering Sprint'
  );

  const columns = [
    { id: 'col-backlog', title: 'Backlog', order_index: 1000 },
    { id: 'col-in-progress', title: 'In Progress', order_index: 2000 },
    { id: 'col-review', title: 'Review', order_index: 3000 },
    { id: 'col-done', title: 'Done', order_index: 4000 },
  ];

  const insertCol = db.prepare('INSERT INTO columns (id, board_id, title, order_index) VALUES (?, ?, ?, ?)');
  for (const c of columns) {
    insertCol.run(c.id, boardId, c.title, c.order_index);
  }

  const today = new Date().toISOString().split('T')[0];

  const sampleTasks = [
    {
      id: 'task-1',
      column_id: 'col-done',
      title: 'Task A: API Architecture & RFC',
      description: 'Define OpenAPI specifications, data schemas, and authentication flow contracts.',
      priority: 'High',
      status: 'Done',
      start_date: today,
      estimated_days: 2,
      order_index: 1000,
    },
    {
      id: 'task-2',
      column_id: 'col-in-progress',
      title: 'Task B: Backend Scaffold & Endpoints',
      description: 'Implement Express/FastAPI handlers and relational database models.',
      priority: 'Medium',
      status: 'In Progress',
      start_date: today,
      estimated_days: 3,
      order_index: 1000,
    },
    {
      id: 'task-3',
      column_id: 'col-in-progress',
      title: 'Task C: Database Schema & Migrations',
      description: 'PostgreSQL tables, indices, foreign keys, and migration rollback scripts.',
      priority: 'High',
      status: 'In Progress',
      start_date: today,
      estimated_days: 4,
      order_index: 2000,
    },
    {
      id: 'task-4',
      column_id: 'col-backlog',
      title: 'Task D: Integration & E2E Tests',
      description: 'Automated test suite verifying end-to-end user journeys and edge cases.',
      priority: 'Urgent',
      status: 'Backlog',
      start_date: today,
      estimated_days: 2,
      order_index: 1000,
    },
    {
      id: 'task-5',
      column_id: 'col-backlog',
      title: 'Task E: Staging Deployment & CDN Setup',
      description: 'Deploy containerized service to staging environment with CDN caching.',
      priority: 'Medium',
      status: 'Backlog',
      start_date: today,
      estimated_days: 1,
      order_index: 2000,
    },
    {
      id: 'task-6',
      column_id: 'col-review',
      title: 'Task F: Security & Penetration Audit',
      description: 'Run static security analysis (SAST) and OWASP vulnerability scanner.',
      priority: 'High',
      status: 'Review',
      start_date: today,
      estimated_days: 2,
      order_index: 1000,
    },
  ];

  const insertTask = db.prepare(`
    INSERT INTO tasks (id, column_id, title, description, priority, status, start_date, estimated_days, order_index)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const t of sampleTasks) {
    insertTask.run(
      t.id,
      t.column_id,
      t.title,
      t.description,
      t.priority,
      t.status,
      t.start_date,
      t.estimated_days,
      t.order_index
    );
  }

  const sampleDeps = [
    { id: 'dep-1', task_id: 'task-2', depends_on_id: 'task-1' },
    { id: 'dep-2', task_id: 'task-3', depends_on_id: 'task-1' },
    { id: 'dep-3', task_id: 'task-4', depends_on_id: 'task-2' },
    { id: 'dep-4', task_id: 'task-4', depends_on_id: 'task-3' },
    { id: 'dep-5', task_id: 'task-5', depends_on_id: 'task-4' },
  ];

  const insertDep = db.prepare(`
    INSERT INTO task_dependencies (id, task_id, depends_on_id)
    VALUES (?, ?, ?)
  `);

  for (const d of sampleDeps) {
    insertDep.run(d.id, d.task_id, d.depends_on_id);
  }

  const insertLog = db.prepare(`
    INSERT INTO activity_logs (id, board_id, message)
    VALUES (?, ?, ?)
  `);

  insertLog.run('log-1', boardId, 'System initialized with Core Platform Engineering Sprint.');
  insertLog.run('log-2', boardId, 'Task A marked as Done.');
  insertLog.run('log-3', boardId, 'Dependencies established: Task D blocked by Task B and Task C.');
}

initDB();

export { db };

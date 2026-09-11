# TaskFlow Pro — DAG Dependency Workflow Engine

A full-stack project management platform powered by a Directed Acyclic Graph (DAG) dependency engine. Designed as the reference solution for the campus hiring engineering challenge.

---

## 🌟 Key Features

1. **Interactive Kanban Board:** 4 columns (`Backlog`, `In Progress`, `Review`, `Done`) with drag-and-drop card positioning.
2. **Dynamic Dependency Linker:** Link prerequisite blocker tasks (`[Blocked by X]` vs `[Ready to Work]` badges).
3. **Automated Timeline & Date-Shift Engine:** Automatically shifts downstream deadlines forward when parent task dates change, correctly handling diamond dependencies without double-shifting.
4. **Gantt Timeline & Critical Path (CPM):** Interactive timeline highlighting the critical path (longest dependent chain) with calculated slack for non-critical tasks.
5. **Drag Guards & State Invariants:** Prevents blocked tasks from being dragged directly to `Done` column.
6. **Fractional Reorder Indexing:** $O(1)$ reordering calculations avoiding mass batch updates.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Unit Tests (DAG Engine)
```bash
npm test
```

### 3. Start Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 4. Build Production Bundle
```bash
npm run build
npm start
```

---

## 🏗️ Project Structure

```
taskflow-pro/
├── app/
│   ├── api/
│   │   ├── board/             # GET /api/board & POST /api/board/reset
│   │   ├── tasks/             # POST /api/tasks & PUT/DELETE /api/tasks/[id]
│   │   ├── tasks/reorder/     # POST /api/tasks/reorder (Fractional indexing)
│   │   └── dependencies/      # POST/DELETE /api/dependencies (DFS Cycle Guard)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # Main Interactive Dashboard
├── components/
│   ├── Navbar.tsx             # Top bar & view switcher
│   ├── StatsBar.tsx           # Real-time metrics
│   ├── KanbanBoard.tsx        # Drag & Drop Kanban
│   ├── TaskCard.tsx           # Card with status & priority badges
│   ├── TimelineView.tsx       # Gantt Timeline & CPM visualization
│   ├── DAGArchitectureView.tsx# 4 Trapdoors breakdown
│   ├── DependencyModal.tsx    # Manage blockers & cycle error UI
│   ├── TaskModal.tsx          # Create/Edit task modal
│   └── ActivitySidebar.tsx    # Live DAG audit log
├── lib/
│   ├── types.ts               # Data models & interfaces
│   ├── db.ts                  # SQLite database with foreign keys & seed data
│   └── dag-engine.ts          # Core Graph Algorithms (DFS, Kahn's, CPM, State)
├── tests/
│   └── dag-engine.test.ts     # Complete Jest unit test harness
└── package.json
```

---

## 🪤 The 4 Algorithmic Trapdoors Solved

1. **Multi-Hop Cycle Detection:** Implemented using recursive Depth-First Search (DFS) with recursion stack tracking (`detectCycle`), returning the exact loop path.
2. **Diamond Dependency Date Scheduling:** Implemented using Kahn's Topological Sort (`recalculateSchedule`), evaluating `Start(D) = max(End(B), End(C))`.
3. **State Invariant & Rollback Guards:** Implemented via `validateStateTransition` and reactive badge decorator.
4. **Fractional Reorder Indexing:** Implemented via `calculateFractionalIndex` computing midpoint $(prev + next) / 2$.

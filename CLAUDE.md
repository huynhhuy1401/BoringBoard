# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**BoringBoard** — a PostgreSQL GUI desktop client built with Tauri 2. It provides a SQL editor with Monaco, schema explorer, data grid browsing/editing, and SSH tunnel support for connecting to remote databases. The app dynamically resizes from a compact login window (800×640) to a full workspace (1200×800) upon connecting.

## Build / Run / Test

```bash
# Frontend-only dev server (Vite on port 1420)
npm run dev

# Full Tauri dev (frontend + Rust backend)
npm run tauri dev

# Production build
npm run tauri build

# Rust tests (in src-tauri/)
cargo test

# TypeScript type-check + Vite bundle
npm run build
```

## Architecture

### Rust Backend (`src-tauri/`)

The backend is organized into five layers:

| Module | Purpose |
|---|---|
| `commands/` | Tauri `#[tauri::command]` handlers — the IPC boundary. Each file wraps a domain module and is registered in `lib.rs`'s `generate_handler!` macro. |
| `db/` | `PoolManager` holds a `HashMap<String, DbConnection>` mapping connection IDs to `sqlx::PgPool` + optional `SshTunnel`. Also contains raw `sqlx` query execution and schema introspection queries against `pg_catalog`. |
| `config/` | File-based persistence (`connections.json`, `settings.json`) in the OS config directory (`dirs::config_dir`). Password storage uses the system keyring via the `keyring` crate with a JSON fallback file for unsigned/dev builds. URL parser converts `postgresql://` strings into `ConnectionConfig`. |
| `ssh/` | SSH port forwarding via `russh`. `SshTunnel::start()` binds a random local port, authenticates (password or private key), then spawns a background task that forwards TCP connections to the remote database host. Tunnel is torn down on disconnect. |
| `models/` | Serde-serializable structs shared across the backend and mirrored in the frontend `types/` directory. Schema types derive `sqlx::FromRow` for direct query mapping. |

**Shared state** (`AppState` in `lib.rs`): A single `Arc<Mutex<PoolManager>>` managed by Tauri. All commands acquire the lock, look up the pool by connection ID, and delegate to the appropriate domain module.

**Error handling**: `AppError` enum (`error.rs`) with variants for Database, Ssh, Config, Keychain, Io, Internal. Implements `From` for common error types and serializes to JSON for the frontend.

### React Frontend (`src/`)

**State management** — four Zustand stores:

- `connectionStore` — CRUD for saved connections, connect/disconnect lifecycle, active database/schema tracking.
- `tabStore` — manages open editor tabs and table-viewer tabs, each with its own SQL, query results, loading/error state.
- `schemaStore` — caches schema objects (databases → schemas → tables → columns/indexes/constraints/triggers) with per-key loading flags. Fetches happen lazily on sidebar tree expansion.
- `settingsStore` — theme (light/dark), font size, word wrap; persisted to `settings.json` via backend commands.

**Component tree**:

```
App → AppShell
        ├── WelcomePage (when disconnected)
        └── [connected]
            ├── Splitter (horizontal)
            │   ├── Sidebar
            │   │   ├── Tab switcher: Explorer | History
            │   │   ├── SchemaTree (lazy-loaded hierarchy with context menus)
            │   │   └── QueryHistoryPanel (searchable, click-to-load)
            │   └── workspace
            │       ├── TabBar
            │       └── tab content
            │           ├── SqlEditor → Splitter (vertical) [Monaco | DataGrid]
            │           ├── DataGrid (for table-viewer tabs)
            │           └── PlanVisualizer (EXPLAIN tree view)
            └── StatusBar
```

**Key libraries**: `@monaco-editor/react` for the SQL editor, `@tanstack/react-virtual` for the data grid, `zustand` for state, `lucide-react` for icons.

**Tauri IPC pattern**: All backend communication uses `invoke('<command_name>', { args })` from `@tauri-apps/api/core`. Command names are snake_case and must match the function name in the Rust `generate_handler!` macro.

**CSS**: CSS Modules (one `.module.css` per component) plus a `globals.css` with CSS custom properties for theming. Dark theme uses `body.dark` overrides in each component CSS module.

### Type Synchronization

Rust model types in `src-tauri/src/models/` and TypeScript types in `src/types/` must stay in sync. The Rust types derive `Serialize`/`Deserialize` with `#[serde(rename_all = "kebab-case")]` for enum variants; the TypeScript side uses string literal unions. When adding a new Tauri command, register it in both `lib.rs`'s `generate_handler!` and create the corresponding `invoke` call in the frontend store or component.

## Key Features Added (Post-Phase-1)

### SQL Autocomplete (`src/editor/`)
- `autocomplete.ts` — Monaco `CompletionItemProvider` with regex-based SQL context detection (table suggestions after FROM/JOIN, columns after SELECT/WHERE/ON, `table.` column completion)
- `keywords.ts` — 100+ PostgreSQL keywords and functions with documentation
- `schemaProvider.ts` — live cache over Zustand schemaStore for fast synchronous lookups (no IPC during typing)

### Data Grid (`src/components/grid/DataGrid.tsx`)
- Column sorting (click header to cycle ASC/DESC/none) — backend-driven for table tabs, client-side for query results
- Column filtering (per-column ILIKE filter) — backend-driven for table tabs, client-side for query results
- Pagination (rows-per-page selector, prev/next) — backend limit/offset for table tabs, client-side slicing for query results
- Row insert (modal form, excludes identity/generated columns) and delete (checkbox selection + batch delete)
- Export menu (CSV download, JSON download, TSV/JSON clipboard copy)

### Query Cancel & SSH Agent (`src-tauri/src/`)
- Query cancellation: tracks `pg_backend_pid()` per connection, uses `pg_cancel_backend()` via a dedicated pool connection. Cancel button appears in editor toolbar during execution.
- SSH Agent auth: connects to `SSH_AUTH_SOCK` via `russh_keys::agent::AgentClient`, tries each identity via `authenticate_future()`

### Tab Persistence (`src-tauri/src/config/tab_state.rs`)
- Open tabs saved to `tab_state.json` in OS config dir with 1s debounced autosave
- Restored on app launch; save on `tauri://close-requested` event

### Dark Theme
- CSS custom property overrides in `body.dark` block (`globals.css`)
- Per-component dark overrides in `WelcomePage.module.css`, `ConnectionForm.module.css`, `AppShell.module.css`
- Monaco editor switches between `light` and `vs-dark` based on settings

### Query History
- Backend: `query_history.json` in config dir, rolling 500-entry max, search support
- Frontend: `QueryHistoryPanel` in sidebar (Explorer/History tab switcher), click to load query into new editor tab

### Keyboard Shortcuts
- Cmd+N: new query tab, Cmd+W: close tab, Cmd+D: toggle dark mode

### EXPLAIN Plan Visualization
- `PlanVisualizer.tsx` — parses PostgreSQL EXPLAIN (ANALYZE, FORMAT JSON) into color-coded collapsible tree (green/yellow/red by relative cost), shows node type, relation, cost, rows, time, loops

## Design System & UI Coding Rules

When creating components or changing layouts, follow these guidelines:
- **Typography & Font**: UI text must use `--font-sans` (`'Inter'`). Monospace text (SQL queries, table/column names, schema names, DDL code, database metrics, configuration options) must use `--font-mono` (`'JetBrains Mono'`).
- **Monaco Editor settings**: Font family should be `'JetBrains Mono', 'Fira Code', 'SF Mono', monospace`, `lineHeight: 20` or `21`, and map theme dynamically between `vs-dark` and `light` based on settings.
- **Design Tokens**: Do not hardcode values; reference CSS variables (e.g. `--bg-primary` for panels, `--bg-secondary` for sidebars/headers, `--border-color` for borders/dividers, `--text-primary` for main labels, `--accent` for focus/primary actions).
- **Modularity & Tailwind**: Component styles must be kept inside localized CSS module files (e.g. `MyComponent.module.css`). Do not write Tailwind CSS classes (such as `flex flex-col gap-2 bg-slate-900`) unless explicitly requested; use standard CSS layout properties or flex classes defined in `globals.css`.
- **UI Components**:
  - *Explorer Tree*: Highlight when hovering over an explorer row must span the entire width of the explorer row. Use transition: `all var(--transition-fast)`.
  - *Data Grids/Tables*: Keep cell padding compact. Render numeric/OIDs/IDs/keys in `--font-mono`. Align headers to match cell alignment. Use badges for key columns (PK, FK) with `--warning` and `--info` colors.
- **Rust Backend Utilities**:
  - Utility commands (e.g., `VACUUM` or `ANALYZE`) must bypass transaction blocks and run directly on a raw database connection.
  - Wrap database errors in `AppError::Database(err.to_string())` instead of throwing unhandled panics (`unwrap()` is prohibited in command modules).

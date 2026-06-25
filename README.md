# BoringBoard

A minimal PostgreSQL desktop client. No bloat, no distractions — just the tools you need.

Built with [Tauri 2](https://v2.tauri.app/) (Rust backend) and React.

## Download

| Platform | File |
|---|---|
| macOS (Apple Silicon) | `BoringBoard_aarch64.dmg` |
| macOS (Intel) | `BoringBoard_x64.dmg` |
| Windows | `BoringBoard_x64-setup.exe` |
| Linux (Debian/Ubuntu) | `BoringBoard_amd64.deb` |
| Linux (AppImage) | `BoringBoard_amd64.AppImage` |

Download the latest build from [Releases](../../releases).

> macOS users: right-click the app and select "Open" on first launch to bypass Gatekeeper.

## Features

**SQL Editor**
- Monaco-based editor with SQL autocomplete and formatting
- Schema-aware suggestions (tables, columns, functions)
- Run queries with `⌘⏎`, explain with `⌘⇧⏎`
- Cancel long-running queries
- Binds to a schema via `search_path` — unqualified table names just work

**Schema Explorer**
- Browse databases, schemas, tables, views, functions, sequences, extensions
- Right-click context menus for common actions
- Table search/filter
- Lazy-loaded tree navigation

**Data Grid**
- Virtualized grid for large datasets
- Column sorting, filtering, pagination
- Inline cell editing (double-click)
- Row insert and batch delete
- Export to CSV, JSON, SQL, Markdown, TSV

**DDL Operations**
- Create, alter, drop tables, columns, indexes, constraints, triggers
- Add column dialog with type, nullable, default options
- Create index with ASC/DESC and NULLS FIRST/LAST per column
- Add UNIQUE, CHECK, and FOREIGN KEY constraints

**Connections**
- Save and manage multiple connections
- SSH tunnel support (password and key-based auth)
- System keyring for password storage
- Switch databases without reconnecting

**Script Management**
- Save queries as `.sql` files to `~/boringboard-scripts/`
- Open scripts via native OS file picker (`⌘O`)
- Manual save with `⌘S`

**Other**
- Query history with search
- EXPLAIN plan visualization
- Keyboard shortcuts throughout
- Dark/light theme

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) (v18+)
- PostgreSQL (local or remote)

### Development

```bash
# Install dependencies
npm install

# Run with hot-reload (frontend + Rust backend)
npm run tauri dev

# Frontend only (no backend)
npm run dev
```

### Build

```bash
npm run tauri build
```

The built app will be in `src-tauri/target/release/bundle/`.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘N` | New query tab |
| `⌘W` | Close tab |
| `⌘S` | Save script |
| `⌘O` | Open `.sql` file |
| `⌘⏎` | Run query |
| `⌘⇧⏎` | Explain query |
| `⌘⇧F` | Format SQL |
| `⌘D` | Toggle dark mode |
| `⌘,` | Settings |
| `⌘[` / `⌘]` | Previous / next tab |
| `⌘1`–`⌘9` | Jump to tab |
| `⌘Z` | Undo changes (data grid) |
| `Escape` | Close dialog / blur input |

## Tech Stack

- **Backend**: Rust, Tauri 2, sqlx, russh
- **Frontend**: React, TypeScript, Monaco Editor, Zustand
- **Grid**: @tanstack/react-virtual

## License

MIT

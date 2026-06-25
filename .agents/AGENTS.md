# Design System & UI Development Rules for pgLens

Future AI agents working on **pgLens** must strictly adhere to the rules, styling guidelines, and design tokens documented below. pgLens is a premium developer tool built with Tauri, React, and Rust, demanding clean layouts, rich aesthetics, and consistent micro-interactions.

---

## 1. Typography & Layout Systems

*   **Fonts**:
    *   **UI Typography**: Always use the sans-serif font stack `--font-sans` (`'Inter'`).
    *   **Monospace Text**: Always use the monospace font stack `--font-mono` (`'JetBrains Mono'`) for SQL queries, table/column names, schema names, DDL code, database metrics, and configuration options.
*   **Editor Standard Configuration**:
    *   For Monaco Editor widgets (e.g., query editor, DDL panels), set `fontFamily` to `'JetBrains Mono', 'Fira Code', 'SF Mono', monospace`, `lineHeight: 20` or `21`, and map theme dynamically between `vs-dark` and `light` based on settings.
*   **Layout Anchors**:
    *   Sidebar width is fixed or scaled using the CSS variable `--sidebar-width` (`260px`).
    *   Tab bars should conform to `--tabbar-height` (`38px`).
    *   Status bars should conform to `--statusbar-height` (`26px`).
    *   Toolbars should conform to `--toolbar-height` (`42px`).

---

## 2. Design Tokens (CSS Variables)

Always reference variables instead of hardcoding absolute values.

| Category | Token Variable | Light Value (Default) | Dark Value (`body.dark`) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Backgrounds** | `--bg-primary` | `#ffffff` | `#0f172a` (Slate 900) | Primary panels, grid background |
| | `--bg-secondary` | `#f8fafc` | `#1e293b` (Slate 800) | Sidebar, toolbars, headers |
| | `--bg-tertiary` | `#f1f5f9` | `#334155` (Slate 700) | Splitters, card inner regions |
| | `--bg-hover` | `#e2e8f0` | `#475569` (Slate 600) | Button hover, list node hover |
| | `--bg-active` | `#cbd5e1` | `#64748b` (Slate 500) | Scrollbar thumb, active state |
| **Borders** | `--border-color` | `#e2e8f0` | `#334155` | General dividers, cell borders |
| | `--border-hover` | `#cbd5e1` | `#475569` | Interactive element hover |
| **Typography** | `--text-primary` | `#0f172a` | `#f8fafc` | Main labels, primary headings |
| | `--text-secondary` | `#475569` | `#cbd5e1` | Sub-labels, table records |
| | `--text-muted` | `#94a3b8` | `#64748b` | Placeholders, row counters |
| **Accents** | `--accent` | `#2563eb` (Blue 600) | `#3b82f6` (Blue 500) | Focus states, primary actions |
| | `--accent-hover` | `#1d4ed8` | `#60a5fa` | Hover active action state |

---

## 3. Padding, Margins & Spaces

Do not use arbitrary pixel values for padding or margins. Use the defined space scale:

*   `--space-1`: `4px`
*   `--space-2`: `6px` (Default gap between icons and labels)
*   `--space-3`: `8px` (Standard small item padding)
*   `--space-4`: `12px` (Medium panel padding)
*   `--space-5`: `16px` (Standard layout margins / card spacing)
*   `--space-6`: `20px`
*   `--space-7`: `24px`
*   `--space-8`: `32px`

---

## 4. CSS Modularity & Tailwind Policy

*   **CSS Modules**: Component styles must be kept inside localized CSS module files (e.g. `MyComponent.module.css`).
*   **TailwindCSS**: Do not write Tailwind CSS classes (such as `flex flex-col gap-2 bg-slate-900`) unless explicitly requested by the user. Use standard vanilla CSS layout properties or the custom flex classes (`.flex`, `.flex-col`, `.gap-2`, etc.) defined in `globals.css`.

---

## 5. UI Component Rules

### Interactive Tree Explorer (`SchemaTree`)
*   Highlight when hovering over an explorer node (e.g., table, view, function) must span the **entire width** of the explorer row.
*   Hover states should apply a subtle background transition: `transition: all var(--transition-fast)`.
*   Clicking database objects must open a dedicated property or data panel tab, not write disposable query tabs (unless explicit SQL generation or definition scripting is requested).

### Tables & Data Grids
*   Cell padding should remain compact to allow high data density.
*   Numeric values, OIDs, IDs, timestamps, and keys must be rendered in `--font-mono`.
*   Header elements must have text alignment matching the content cell text alignment (left-aligned text, right-aligned numbers).
*   Always render badges for special column traits (like `PK` or `FK`) using the variables `--warning` and `--info` with clear contrast text.

### Utility Commands & Transactions (Rust Backend)
*   When executing utility queries (e.g., `VACUUM` or `ANALYZE`), bypass transaction blocks. Acquire a raw database connection from the connection pool and run directly.
*   Always wrap errors in `AppError::Database(err.to_string())` instead of throwing unhandled panics (`unwrap()` is prohibited in command modules).

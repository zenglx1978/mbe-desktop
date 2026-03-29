# MBE Desktop

> AI-powered professional services, delivered as a desktop app.
> One installer, all industry solutions.

MBE Desktop is an Electron-based desktop client for the **MBE (Mises Behavior Engine)** platform. Users select an industry solution (legal, finance, HR, healthcare, etc.) and get an AI expert team ready to work — with data stored locally, offline calculations, and large-file processing without network transfer.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 33, Chromium 130, Node 20.18 |
| Frontend | React 18, Vite 5, TailwindCSS, Zustand |
| Routing | react-router-dom (HashRouter) |
| Local DB | sql.js (SQLite in WASM) |
| Doc Generation | docx / pptxgenjs / exceljs |
| Calc Engine | Pure TypeScript, zero Python deps, works offline |
| Build | electron-builder (MSI / NSIS / portable) |
| Testing | Vitest (unit) + Playwright (E2E) |

## Getting Started

```bash
# Install dependencies
npm install

# Development (Electron + Vite hot reload)
npm run dev:electron       # http://localhost:5180

# Frontend only (browser mode, no Electron)
npm run dev

# Build
npm run build              # Vite + TypeScript compilation
npm run pack:win           # Windows installer (MSI/NSIS/portable)
npm run pack:mac           # macOS
npm run pack:linux         # Linux (AppImage/deb/snap)

# Test
npm run test               # Vitest unit tests
npm run test:e2e           # Playwright E2E tests
npm run test:e2e:ui        # Playwright interactive UI

# Code quality
npm run lint               # ESLint
npm run type-check         # TypeScript type checking
```

## Project Structure

```
src/
├── main/                  # Electron main process
│   ├── index.ts           # Window lifecycle, IPC handlers, auto-update
│   ├── preload.ts         # contextBridge API exposure
│   ├── database.ts        # sql.js local database
│   ├── calc-engine.ts     # Deterministic calculators (tax, legal fees, cost engineering, clinical scores)
│   ├── docgen/            # Document generation (Word, PPT, Excel)
│   └── ...                # Bridges, schedulers, observers
└── renderer/              # React renderer process
    ├── App.tsx            # Root component (ErrorBoundary + HashRouter)
    ├── stores/            # Zustand state management
    ├── pages/             # Route pages
    ├── components/        # UI components (chat, charts, workbench, visualization)
    ├── lib/               # Utilities, API client, solution registry
    └── types/             # TypeScript type definitions
```

## Security

- **Context Isolation** — renderer process has no direct Node.js access
- **No Node Integration** — renderer does not load Node modules
- **IPC Whitelisting** — all main-process APIs exposed via `contextBridge`
- **Path Safety** — file system operations restricted to allowed directories
- **Command Safety** — external command execution uses strict whitelisting
- **CSP Headers** — Content Security Policy injected on all responses
- **Session Encryption** — sensitive fields encrypted with `safeStorage`

## Key Features

- **Industry Solutions** — select your industry, get a tailored AI expert team
- **Offline Calculations** — tax, legal fees, cost engineering, clinical scores — all computed locally in TypeScript
- **Document Generation** — produce Word, PowerPoint, Excel reports from AI analysis
- **Local-First Data** — user data stays on device, never uploaded without consent
- **Auto Update** — built-in update mechanism via electron-updater

## License

[MIT](./LICENSE) — see `package.json` for details.

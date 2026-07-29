# Fabrica Next.js Client Application

This directory contains the Next.js 16 static client frontend for **Fabrica — The Autonomous Business Partner**.

## Architectural Highlights

- **3-Panel Dashboard (`app/dashboard/page.tsx`)**:
  - **Panel A**: System Maps, 3-level Autonomy Selector (`FULL AUTO`, `SEMI-AUTO`, `SUPERVISED`), micro-events timeline, Cytoscape flow graph.
  - **Panel B**: Horizontal Missions Board (Drafting → Planning → Execution → Archive), interactive chat stream, Quick Injections prompt grid.
  - **Panel C**: 50/50 Split view for **Your Data** (`raw_data`) and **Your Artifacts** (`system_components`) divided by a crisp 1.5px vertical separator line.
- **Persistent Chat Sessions & Config**: Bidirectional sync between local storage (`pboot_chat_sessions_${tenantKey}`) and backend `app_config` API endpoints.
- **Live 5s Polling**: Auto-refreshes mission board, runtime logs, and deployed system components when `FULL AUTO` mode is active.
- **Static Export**: Built via `npm run build:frontend` into `frontend-next/out/` and served directly on Port 3000 by Express in production.

## Development Commands

```bash
# Build static frontend output to frontend-next/out/
npm run build

# Run Next.js standalone dev server
npm run dev
```


# POMASA Dashboard

A web-based control panel for visualizing and monitoring POMASA multi-agent system (MAS) execution.

## Quick Start

```bash
npx @chenbihao/pomasa-dashboard
```

The dashboard will start at `http://localhost:3001` and open in your browser automatically.

### Options

```bash
# Custom port
npx @chenbihao/pomasa-dashboard --port 8080

# Or via environment variable
PORT=8080 npx @chenbihao/pomasa-dashboard
```

## Features

- **Project Overview** — card grid with stats (total, running, completed, alerts), progress bars, and status badges
- **Pipeline Visualization** — interactive DAG view of agent execution pipelines
- **Event Timeline** — real-time event and log monitoring
- **File Viewer** — browse and view project files with syntax highlighting
- **Embedded Terminal** — built-in web terminal for interacting with projects
- **Project Creation** — create new MAS projects from templates
- **i18n** — English and Chinese interface

## Development

```bash
# Install dependencies
npm install

# Start dev server (frontend + backend with hot reload)
npm run dev

# Build for production
npm run build

# Lint
npm run lint
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, ReactFlow
- **Backend**: Express 5, WebSocket, node-pty
- **Terminal**: xterm.js with WebGL renderer

## License

MIT

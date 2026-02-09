# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is AVAIL DMS (Data Management System) - a React-based documentation/content management site built with Vite. The site uses the `@availabs/dms` library (included as a git submodule in `src/dms/`) to provide dynamic page routing, admin patterns, and content management.

## Commands

```bash
# Development
npm run dev          # Start Vite dev server
npm run start        # Alias for dev

# Build
npm run build        # Production build (outputs to dist/)

# Linting
npm run lint         # ESLint check

# Preview
npm run preview      # Preview production build locally

# Deployment (Netlify)
npm run deploy              # Deploy to primary Netlify site
npm run deploy-b3nson       # Deploy to b3nson site
npm run deploy-wcdb         # Deploy to wcdb site
npm run deploy-dmsdocs      # Deploy to dmsdocs site

# Bundle analysis
npm run analyze      # Run vite-bundle-analyzer
```

## Architecture

### Core Structure

- **`src/App.jsx`** - Main entry point configuring `DmsSite` with API hosts, themes, and admin config
- **`src/themes/`** - Theme definitions (catalyst, mny) exported via `src/themes/index.js`
- **`src/dms/`** - Git submodule containing `@availabs/dms` library source

### DMS Library (`src/dms/src/`)

The DMS library provides a pattern-based routing system:

- **`patterns/`** - Contains pattern types: `admin`, `auth`, `page`, `forms`, `datasets`
  - Each pattern has a `siteConfig.jsx` that defines routes and components
  - Patterns are registered in `patterns/index.js`
- **`render/spa/dmsSiteFactory.jsx`** - Creates React Router routes from pattern configs
- **`api/`** - Data loading/editing functions for DMS content
- **`ui/`** - Shared UI components (Tabs, Dialog, Select, etc.)

### How Patterns Work

1. `DmsSite` component fetches site data from API
2. `pattern2routes()` converts pattern configs into React Router routes
3. Each pattern type (admin, page, forms, etc.) defines its own route structure
4. Patterns can be subdomain-specific or global (`subdomain: '*'`)

### Key Exports from `@availabs/dms`

```javascript
// Main site components
export { DmsSite, dmsSiteFactory, dmsPageFactory }
// Data operations
export { dmsDataLoader, dmsDataEditor }
// Auth
export { withAuth, useAuth }
// Component registration
export { registerComponents }
// Admin configuration
export { adminConfig }
```

### Theming

Themes are JS objects defining navigation layout, styling classes, and component configurations. See `src/themes/catalyst/theme.jsx` for structure including:
- `layout` - Wrapper class definitions
- `sidenav`/`topnav` - Navigation styling
- `button`, `tabs`, etc. - Component styling

## Task Management

The DMS library (in `src/dms/`) has a planning system for tracking work. **Before implementing any task, read `src/dms/planning/planning-rules.md`** — it defines the workflow for task files, progress tracking, and completion. The task file in `planning/tasks/current/` is the source of truth for implementation status and must be updated as work progresses, not just at the end.

## Tech Stack

- React 19 with Vite 7
- React Router 7 (via `react-router`)
- TailwindCSS 4 (via `@tailwindcss/vite`)
- Babel with React Compiler plugin
- Falcor for data fetching (`@availabs/avl-falcor`)
- Lexical for rich text editing
- MapLibre GL for maps

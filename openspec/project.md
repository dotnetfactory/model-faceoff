# Project Context

## Purpose

Model Faceoff is an Electron desktop application that lets users compare AI models from different providers side-by-side. It enables streaming responses, markdown rendering, conversation history, and usage tracking via the OpenRouter API.

**Goals:**
- Allow users to evaluate and compare different LLM models simultaneously
- Track token usage, latency, and costs across models
- Provide persistent conversation history with shareable links
- Deliver a polished desktop experience with auto-updates

## Tech Stack

**Core:**
- **Electron 38** - Desktop application framework
- **React 19** - UI framework with functional components and hooks
- **TypeScript 5** - Type safety throughout the codebase
- **Vite 6** - Build tool and dev server
- **Tailwind CSS 3** - Utility-first styling

**Database:**
- **better-sqlite3** - SQLite database with WAL mode for concurrent access

**Build & Deploy:**
- **electron-forge** - Build and packaging
- **electron-updater** - Auto-updates via GitHub Releases

**UI Libraries:**
- **Radix UI** - Accessible component primitives (Dialog, Tabs, Label)
- **Lucide React** - Icon library
- **Sonner** - Toast notifications
- **react-markdown** + **remark-gfm** - Markdown rendering

## Project Conventions

### Code Style

- **Formatting:** Prettier with default settings
- **Linting:** ESLint with TypeScript, React, and React Hooks plugins
- **Naming:**
  - Components: PascalCase (e.g., `ModelComparison.tsx`)
  - Files: PascalCase for components, camelCase for utilities
  - Variables/functions: camelCase
  - Constants: SCREAMING_SNAKE_CASE for module-level constants
- **Unused variables:** Prefix with underscore (`_`) to indicate intentionally unused
- **Avoid `any`:** Use proper types; `any` triggers a warning

### Architecture Patterns

**Electron Process Model:**
1. **Main Process** (`src/main.ts`) - Node.js environment, window management, system APIs
2. **Preload Script** (`src/preload.ts`) - Secure bridge exposing `window.api`
3. **Renderer Process** (`src/renderer/`) - React application in isolated browser context

**IPC Pattern:**
- All IPC handlers return `IPCResponse<T>` with `success`, `data?`, and `error?` fields
- Handlers registered in `src/ipc/handlers.ts`
- Exposed via `contextBridge` in preload script
- Types defined in `src/types/window.ts`

**Component Organization:**
- Feature-based folders under `src/renderer/components/`
- Each feature folder contains component file and `index.ts` barrel export
- State managed via React hooks (`useState`, `useCallback`, `useEffect`)

**Configuration:**
- `app.config.ts` is the single source of truth for app configuration
- Injected at build time via Vite's `define` as `__APP_CONFIG__`
- Environment variables (`.env`) only for secrets (API keys, signing credentials)

### Testing Strategy

- **Framework:** Vitest with React Testing Library
- **Commands:**
  - `npm run test` - Run tests
  - `npm run test:ui` - Run tests with UI

### Git Workflow

- **Main branch:** `main`
- **Versioning:** Semantic versioning via npm version scripts
  - `npm run version:patch` - Bump patch version and push
  - `npm run version:minor` - Bump minor version
  - `npm run version:major` - Bump major version
- Auto-updates published to GitHub Releases

## Domain Context

**OpenRouter API:**
- Unified API for accessing multiple LLM providers
- Handles model fetching, streaming completions, and usage tracking
- Models cached for 5 minutes to reduce API calls
- Free models available for title generation (Llama 3.2)

**Conversation Flow:**
- User sends a prompt to multiple models simultaneously
- Each model streams its response in a separate panel
- Responses tracked with tokens, latency, and cost
- Conversations auto-titled using a free LLM model

**Database Tables:**
- `settings` - Key-value app configuration
- `presets` - Saved model comparison configurations
- `conversations` - Conversation sessions with model selections
- `messages` - Individual messages with metrics
- `api_logs` - Complete API call history
- `shares` - Share links for conversations

## Important Constraints

- **Security:** API keys stored locally in SQLite, never sent to share service
- **Platform:** macOS primary, with Windows and Linux support via Electron
- **Performance:** WAL mode SQLite for concurrent reads during streaming
- **Updates:** Auto-updates only in packaged builds (`app.isPackaged`)

## External Dependencies

**OpenRouter API:**
- Base URL: `https://openrouter.ai/api/v1`
- Required: User-provided API key stored in settings
- Used for: Model listing, chat completions, title generation

**Share Service:**
- Production: `https://www.modelfaceoff.com`
- Development: `http://localhost:3000`
- Web app located at: `../model-faceoff-web`
- Endpoints: `/api/share/token`, `/api/share`

**GitHub Releases:**
- Owner: `dotnetfactory`
- Repo: `model-faceoff`
- Used for auto-update distribution

Original prompt: Generate a complete, production-ready, offline-capable multi-game arcade platform using React + TypeScript + Vite + Canvas + PWA with all listed engine systems, games, UI, AI, PWA, and Playwright tests.

Completed:
- Bootstrapped React + TypeScript + Vite project with full requested directory structure.
- Implemented engine systems: scene + transition manager, game loop with deterministic stepping, canvas layer manager, input manager with tap/swipe/long-press/drag, particle engine, theme manager (5 themes including CRT overlay), audio manager, settings/profile/achievement managers, responsive canvas scaler, AI manager with global/per-game toggles and player override stop.
- Implemented app shell and pages/components: header, footer, main menu, settings menu, theme selector, profile, achievements, debug overlay, UI primitives.
- Implemented game registry and all 15 game modules with canvas rendering + controls + AI hooks:
  - tetris, snake, pong, flappy, chess, neon_blob_dash, game_2048, breakout, space_invaders, endless_metro_run, minesweeper, memory_match, connect4, sudoku, asteroids.
- Implemented complete chess subsystem files: ChessBoard.tsx, ChessEngine.ts, MoveGenerator.ts, MinimaxAI.ts, ArrowSystem.ts, HighlightSystem.ts, EvaluationBar.ts, ReplaySystem.ts, PGNParser.ts.
- Added PWA source files: src/pwa/manifest.json, src/pwa/service-worker.ts, src/pwa/icons/*.
- Added Vite plugin pipeline to emit manifest + icons + compiled service worker and inject precache file list from dist for hashed assets.
- Added Playwright config + required specs:
  - tests/main-menu.spec.ts
  - tests/tetris.spec.ts
  - tests/snake.spec.ts
  - tests/pong.spec.ts
  - tests/flappy.spec.ts
  - tests/chess.spec.ts
  - tests/pwa-install.spec.ts

Validation status:
- Could not run npm install/build/tests in this sandbox due network restriction to npm registry:
  - npm fetch fails with ENOTFOUND for registry.npmjs.org.
- No placeholder/TODO strings remain in source.

Next-agent TODOs (after network is available):
- Run `npm install`.
- Run `npm run build` and fix any TS/runtime issues.
- Run `npx playwright test`.
- Verify SW offline behavior manually in browser devtools (Application -> Service Workers + offline reload).
- Optional polish: tune game balance constants and add richer animation/audio assets.

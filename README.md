<div align="center">
  <img src="public/logo-new.svg" width="120" alt="Rooke logo" />

  # Rooke

  **A 3D chess app that shows its work.**
</div>

---

## What this is

Rooke is a 3D chess game that runs in the browser, and the main point of it is that you get to watch the computer think.

Every chess engine I've played against felt like a black box. You make a move, there's a pause, and then it plays something that's either brilliant or completely baffling, and you never find out why. I wanted to see inside that pause. So the engine here narrates itself: every candidate move it considers gets drawn on the board as an arrow, the line it expects to follow shows up as a glowing wireframe piece, and a running log tells you what it thinks of each option and how good the position looks to it. You can watch it get excited about a capture, talk itself out of it, and settle on something else.

It's mainly for people who are still learning (me included) and want some visual intuition for why the obvious move is sometimes a trap. It is not trying to beat Stockfish. It plays a decent, honest game and tells you what it's doing.

There are two ways to play:

- **Versus AI.** You play white, the engine plays black, and all the "AI thought process" stuff is switched on. There's a button in the sidebar to hide it if you just want to play.
- **Sandbox.** No engine at all. Move both sides yourself, set up ideas, or play a friend on the same screen.

---

## Running it

```bash
git clone https://github.com/kaificial/rooke.git
cd rooke
npm install
npm run dev
```

That starts the Vite dev server. Open the `localhost` address it prints and you're in.

The other scripts:

```bash
npm test          # unit tests (rules, engine, clock)
npm run typecheck # tsc, no emit
npm run build     # type-check, then a production build in dist/
npm run preview   # serve that build through Vite
npm start         # serve dist/ with the small Express server (server.cjs)
```

`npm start` only works after `npm run build`, since it just serves whatever is in `dist/`.

---

## Playing

**Moving.** Press Start, then click one of your pieces and every legal square for it lights up. Click a lit square to move there. Captures, castling, en passant and promotion all work. When a pawn reaches the far rank, a small picker appears in the sidebar asking what you want it to become. You can't move before pressing Start, and you can't move while it's the engine's turn.

**Camera.** The board is a real 3D scene, so you can look at it from anywhere:

- rotate with left click and drag
- zoom with the scroll wheel or trackpad
- pan with right click and drag

It starts out looking at the board from white's side, and the camera can't dip below the board, which is deliberate. Looking up at the underside of a chess table is not useful.

**Sidebar.** Start and Exit, whose turn it is, a running move list in standard algebraic notation (`Nbd7`, `exd5`, `O-O`, `e8=Q#`), and the "Hide AI Thoughts" toggle, which disappears in sandbox mode since there's nothing to hide.

**Clocks and pieces.** Each side gets ten minutes, and the clock at the top highlights whoever is on the move. The corners show the pieces each side still has on the board. If someone's time hits zero the other side wins.

**How games end.** Checkmate, stalemate, the fifty-move rule, threefold repetition, insufficient material (like king versus king and a bishop) and running out of time are all detected, and the status line tells you which one it was.

---

## Watching the engine think

This is the part I care most about. When it's the engine's turn, four things happen:

<p align="center">
  <img src="docs/ai-overlay.svg" alt="The overlay: arrows, ghost line, king aura and thought log" width="100%" />
</p>

1. **Arrows.** Each candidate move is drawn as a cyan arrow while the engine reviews it. When it finally decides, the arrow turns thick and gold.
2. **A ghost line.** The first move of the line it's calculating gets a wireframe copy of the piece sitting on its destination square, and the replies it expects after that are traced as a line across the board.
3. **An aura around the black king.** It's a glowing ring that changes color with how the engine feels about the position: green when it thinks it's winning, red when it thinks it's losing, blue when it's roughly level. It follows the king around.
4. **The text log.** A line for each candidate ("Thinking about moving Knight to f6 to improve its position (-0.45)") and a final "Decided to move..." line. The number is the evaluation in pawns, positive for white and negative for black, and forced mates show up as "White mates in 3".

The engine searches far faster than anyone can read, so the pacing is handled on purpose. Candidates are replayed one at a time, about 0.8 seconds each. If it finds more than about twenty, only the last handful are shown. After the final decision there's a two second pause before the piece actually moves, so you can take in the gold arrow. If you've hidden the thoughts, it skips all of that and just waits half a second.

The log's explanations ("to control the center", "to capture White's knight") come from a few simple rules of thumb sitting on top of the real search scores. The scores and moves are the engine's actual output. The "why" is a friendly gloss.

---

## How it's put together

<p align="center">
  <img src="docs/architecture.svg" alt="Module layout: core rules shared by the main thread and the engine worker" width="100%" />
</p>

The rule I tried to hold myself to: dependencies only point down, and `core/` knows nothing about anything above it.

- **`core/`** is the chess itself, in plain TypeScript with no DOM, no Three.js and no timers. It has the board (`Position`, which can make and unmake moves in place), the move generator, a `Game` that adds the things you can only know from history (the move list, repetition, the result) and standard algebraic notation. Both the UI and the engine use this one implementation. That matters: an earlier version of this project had one set of rules for the board and a second, weaker one inside the engine, and they disagreed about castling and promotion.
- **`engine/`** is the search, and it runs inside a Web Worker. More on it below.
- **`scene/`** is everything Three.js: the stage (renderer, camera, lights), the board and piece models, and `BoardView`, which turns "this move happened" into animations. It knows nothing about the rules.
- **`ai/`** connects the engine to the screen: a typed client for the worker, `AiPlayer` (which asks for a move and then replays the thinking at a readable pace), the narrator that writes the log lines, and the visualizer that draws arrows, ghosts and the aura.
- **`ui/`** is the DOM: the home page and the HUD (sidebar, clocks, AI log, piece trays). Styles live in plain CSS files in `styles/`.
- **`game/`** holds `GameController`, which is the one place that knows about both the rules and the pictures. It decides what happens when: you tapped a piece, here are its moves, you picked a square, play it in the rules, animate it, switch the clock, hand the engine its turn. It also has the chess clock and the tap detector.

The reason for all the separation is testability as much as tidiness. The rules and the search can be tested in milliseconds without a browser, and they are.

---

## The engine

The engine is in `src/engine/` and I wrote it from scratch, with no chess library. It runs in a Web Worker, so the search happens on a separate thread. In a 3D app that matters: if it ran on the main thread, the scene would freeze every time the engine thought, and the orbit controls and animations would stutter. With the worker you can keep spinning the board while it calculates.

<p align="center">
  <img src="docs/alpha-beta.svg" alt="Alpha-beta pruning on a small tree" width="100%" />
</p>

What's in it:

- **Negamax with alpha-beta pruning.** The classic approach: try every move, then every reply, assuming both sides play their best. Alpha-beta lets it skip branches it can prove won't change the answer, which is what makes searching deep enough possible at all.
- **Move ordering (MVV-LVA).** Pruning works best when good moves are tried first, so captures come before quiet moves, and among captures "take a valuable piece with a cheap one" comes first. MVV-LVA stands for Most Valuable Victim, Least Valuable Attacker. Promotions are looked at early too.
- **Quiescence search.** When the main search runs out of depth, it doesn't score the position there, because it might be halfway through a trade. It keeps searching captures and promotions only until things calm down, which fixes the classic horizon effect. It's capped at ten extra plies.
- **Check extensions.** If the search would stop while a king is in check, it looks one ply further, so a mate at the edge of the horizon is seen as a mate. This is also capped, so a long run of checks can't blow up the tree.
- **Mate and draw scores.** Checkmate is scored higher the sooner it comes, so the engine prefers the fastest mate and delays being mated. Stalemate and the fifty-move rule are scored as draws, which also means it won't throw away a winning position by stalemating you.
- **Evaluation.** Material, plus piece-square tables so a piece is worth something for where it stands as well as what it is. Knights like the center, rooks like the seventh rank, kings want to stay tucked away. The tables are the standard "simplified evaluation function" from the Chess Programming Wiki.
- **Fixed depth of 3.** The search goes three plies deep, plus quiescence. That's quick enough to feel instant, and strong enough to punish hung pieces and simple tactics. It will lose to anyone who calculates more than a couple of moves ahead.

**How it talks to the UI.** The main thread sends the worker a FEN string and a depth. The worker searches every root move and, after finishing each one, posts a `thinking` message with the move, its score, the line it expects, the node count and the time. When it's done it sends a `bestMove`. Every message carries a request id so a stale result from an abandoned search can never be played by mistake. That stream of messages is what drives the arrows, ghosts, aura and log, so the visualization is the real search as it happens, not a recording.

One deliberate tradeoff: each root move is searched with a full window, instead of sharing a narrowing window the way a normal engine would. That's slower, but it means every candidate gets an exact score, and those scores are exactly what the visualization shows.

---

## How it was built

**The 3D scene** is Three.js. There are no imported models anywhere in the project. Every piece is built in code:

<p align="center">
  <img src="docs/lathe-pieces.svg" alt="Building a pawn from a list of points with LatheGeometry" width="100%" />
</p>

- Pawns, rooks, bishops, queens and kings are mostly lathe geometry. I write down a 2D profile of half the piece (a list of radius and height points) and Three.js spins it around an axis, like a wood lathe. Details like the pawn's head, the queen's crown and the king's cross are spheres, cylinders and boxes on top.
- Knights are the exception, because you can't spin a horse. The head is an extruded 2D outline with a bevel, sitting on a lathe base, turned to face the right way for each side.
- Geometry is built once per piece type and shared by every piece of that type, so thirty-two pieces don't mean thirty-two copies of the same mesh data.
- The board is 64 beveled boxes on a darker base. The materials are slightly glossy and pick up a faint reflection from a tiny baked "room" environment map. One directional light casts soft shadows.
- Picking uses a raycaster. Highlighted target squares are checked before pieces, so clicking a square that has an enemy piece on it captures it instead of selecting the piece.

**Animation** is GSAP. Pieces glide to their squares, captured pieces shrink away, the rook swings across during castling, and a promoted pawn is swapped for its new model once it lands. `BoardView` is told which moves happened and animates them; it never decides what's legal.

**Game rules** are in `core/` and are checked with perft, the standard test for move generators. Perft counts every reachable position to a given depth from some starting position and compares the total to known-good numbers. If castling, en passant, promotion or pins are even slightly wrong, the count is off. Rooke matches the published numbers for the starting position and four notoriously tricky test positions, plus tests for check, stalemate, draws, notation and disambiguation.

**The home page** is HTML and CSS with a dotted grid background, thin guide lines, bracketed corners on the tagline and rectangular buttons with a gold sweep on hover. The big rook is an isometric rook built from voxels and drawn as SVG polygons: I list the cubes layer by layer, sort them back to front, and draw three shaded faces per cube to fake lighting. Each cube drops in with a staggered GSAP tween and lifts when hovered.

**The HUD** shares that look, so going from the home page into a game doesn't feel like switching apps.

**Tooling.** Vite for the dev server and bundling (the worker is imported with `new Worker(new URL(...))`, which Vite bundles automatically, and Three.js gets its own chunk), strict TypeScript, Vitest for tests, GitHub Actions running typecheck, tests and build on every push, and a tiny Express server for serving the built files.

---

## Tech stack

| Layer | Tools |
|---|---|
| Language | TypeScript (strict) |
| 3D graphics | Three.js |
| Animation | GSAP |
| AI | Custom engine in a Web Worker |
| Styling | Plain CSS |
| Build | Vite |
| Tests | Vitest |
| CI | GitHub Actions |
| Production server | Express |
| Fonts | Space Mono and Inter (Google Fonts) |

---

## Project layout

```text
├── src/
│   ├── main.ts             # Entry: builds the scene, shows the home page
│   ├── app.ts              # Wires a game together for the chosen mode
│   ├── config.ts           # Tunables: clock, engine depth, pacing, links
│   ├── core/               # Pure chess: Position, movegen, Game, SAN (+ perft tests)
│   ├── engine/             # Search and evaluation, runs in a Web Worker
│   ├── scene/              # Three.js: stage, board, pieces, BoardView
│   ├── ai/                 # Worker client, AiPlayer, narrator, visualizer
│   ├── game/               # GameController, chess clock, tap input
│   ├── ui/                 # Home page and HUD components
│   └── styles/             # base.css, landing.css, hud.css
├── docs/                   # The diagrams used in this README (plain SVG)
├── public/                 # Logo
├── .github/workflows/      # CI
├── index.html              # App shell and font links
├── server.cjs              # Express server for the production build
├── vite.config.ts          # Build and test config
└── package.json
```

---

## Things that aren't done yet

I'd rather list these than have you find them by surprise:

- **You always play white against the AI.** The engine side is a setting, but there's no menu for choosing a color yet.
- **Depth is fixed at 3.** No difficulty setting, and the engine doesn't have iterative deepening, a transposition table or an opening book, so it will happily repeat its way through the first few moves.
- **The engine can't see repetition.** It gets a position and not the history that led to it, so it doesn't know when it's about to draw by repetition.
- **No takebacks, resign button or draw offers.**
- **The narration is heuristic.** The scores are real; the reasons are rules of thumb.
- **Only tested in Chrome.** It should work in anything with WebGL and module workers, but that's the only browser I've actually checked.

If any of these bother you, they're also a good list of things to work on.

---

## Why Rooke

Chess AI has always felt a little intimidating from the outside, so this is my attempt at making it less of a mystery. Issues, pull requests and "hey, your move ordering is wrong" corrections are all welcome.

---

Kai Kim, 2026

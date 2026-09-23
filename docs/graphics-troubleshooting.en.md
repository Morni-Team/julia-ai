# How Julia fixes graphics problems (blank window / crash on start)

A short, plain-English overview of how we solved the "black or empty window /
app crashes on start" problems, and which checks now run automatically. Julia is
an Electron app, so the screen is drawn by Chromium – most of these issues come
from a weak or broken GPU driver, not from Julia's own code.

## The self-healing ladder (automatic)

When the window would otherwise stay black or empty, Julia does **not** just give
up. It walks down a ladder of graphics backends and remembers the first one that
works:

1. **Normal** (hardware GPU)
2. **ANGLE d3d9** (older Direct3D path)
3. **ANGLE OpenGL**
4. **SwiftShader** (pure software OpenGL – no GPU needed)
5. **Hardware acceleration off**

If a GPU or renderer process crashes on start, Julia immediately switches to
software rendering and **restarts once** by itself. If it still fails, it shows a
clear message instead of restarting forever. (There is no "custom renderer" –
Chromium is the engine; switching backends is the professional Electron way.)

## The checks we built in

- **GPU/driver logging at start** – the startup log records the GPU vendor and
  driver. If the driver info is missing, the GPU is flagged as "degraded".
- **Startup crash guard** – the first GPU/renderer crash in the start window sets
  the software-rendering marker and triggers one automatic restart.
- **Repeated-renderer-crash guard** – if the renderer keeps crashing *after*
  start, Julia counts the crashes and switches to software rendering past a
  threshold.
- **Conflicting-flag check** – known conflicting graphics flags are detected and
  Julia falls back to software rendering.
- **Blank-UI healthcheck** – shortly after loading, Julia checks that the
  stylesheets and page content are actually there. If the page is truly empty
  (missing body/CSS), it logs `ui-healthcheck` and reloads **once** (no loop,
  thanks to a session marker).
- **"Empty labels" is treated separately** – if only the *text labels* are empty
  (not the layout), that is reported as `ui-texte-leer` and never triggers the
  graphics ladder or a restart, because it is not a graphics problem.
- **Renderer-error reporting** – uncaught errors in any window are caught and
  written to the startup log as `RENDERER-FEHLER` (kept local, never sent).
- **Global crash safety net** – one unhandled error no longer kills the whole app
  silently: at startup it shows a clear message; during use Julia just keeps
  running.
- **Locked data folder fallback** – if Julia's data folder is not writable
  (permissions, antivirus), it falls back to a replacement folder instead of
  failing to start.

## Manual rescue (if the automatic path ever isn't enough)

- **Settings → System → one-click graphics repair**: switches to software
  graphics and restarts (reversible).
- **Start flag**: run `Julia AI.exe --reparatur` (or `--software` / `--safe`) to
  force software graphics.
- **Driver hint**: if the GPU looks degraded, the repair section shows a link to
  the official driver page (NVIDIA / AMD / Intel). Julia deliberately installs
  nothing itself – a wrong driver can break the whole PC.

## The key lesson

Blank-UI self-healing is only for **real** graphics/renderer crashes. A slow start
or empty text labels must **not** trigger it – otherwise the safety measures fight
each other and end in a restart loop. That is why "graphics problem" and "content
problem" are now detected and handled as two different things.

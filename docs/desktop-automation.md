# Desktop automation

How Kairos gets hands on the whole computer, not just the browser. This is the plan; no code is written yet. Read `what-is-missing.md` first — desktop automation was deliberately sequenced last there, because it inherits three things that now exist and are tested: the **approval gate** (`consequence.js`), the **workspace file sandbox** (`client/src/files/`), and the **offline eval** (`cloud/eval/`). Building it first would have meant building those three again, worse, under a bigger blast radius.

The rules from `architecture.md` still govern every line of it:

- **LLM-first. If the agent picks wrong, fix the prompt or the snapshot. Never add a regex.** The desktop is just another surface the model reads and acts on, exactly like a web page.
- **The client owns the machine; the cloud only decides.** Desktop control lives entirely on the laptop, next to the browser and the secrets, and never leaves it.
- **No build toolchain.** This laptop has no C/C++ compiler and no Python on PATH. That single constraint already decided the voice stack (PowerShell SAPI, not compiled whisper.cpp) and it decides this too.

## Where desktop stands today

There are pre-rebuild stubs, and they are not wired to anything:

- `client/src/automation/desktop/windows/apps.js` — `openApp` works (launches via `explorer shell:AppsFolder\<AppID>` from `Get-StartApps`, or a hardcoded process name), `closeApp` only knows two process names, `focusApp` is a no-op that returns success.
- `client/src/executor/desktopAdapter.js` routes `open_app` / `close_app` / `focus_app` to those functions.
- `client/src/executor/deviceAdapter.js` already forks desktop vs browser actions by type.

But the **cloud never emits these actions** — they are absent from `agentLoop.js`'s `BROWSER_ACTIONS`, from `actionSchema.js`, and from `prompt.js`. And the code is in the old verbose, comment-free-but-sprawling style that violates the current standard. So today: the model cannot ask for a desktop action, and if it could, only launching would work. Phase D1 fixes exactly that gap first.

## The two hard problems, kept separate

Every desktop automation system is really two capabilities, and they fail independently:

1. **Introspection** — *read* the UI as structured elements (this window has a button named "Save", a text field, a menu). This is the "inner thing" and it is the primary path, the desktop equivalent of the browser's ARIA snapshot.
2. **Actuation** — *act* on an element (invoke it, type into it, toggle it). Best done through the accessibility API's own patterns, not blind coordinate clicks.

When introspection fails — a game, a custom-drawn canvas, an app with no accessibility tree — we fall back to the **image thing**: screenshot, OCR through the Tesseract worker that already exists in `visionReader.js`, and coordinate clicks. Backup, never primary, for the same reason OCR is a last resort in the browser (`architecture.md` §Vision).

## Cross-platform research — the three OSes really are different

There is no single API. Each OS has its own accessibility framework and its own input-injection story, and they are not interchangeable. The cheap, no-build path on every OS is to shell out to a tool the OS already ships, and parse JSON back — the same shape as the SAPI and `Get-StartApps` bridges already in the codebase.

| | Windows | macOS | Linux |
|---|---|---|---|
| Introspection API | **UI Automation (UIA)** — `System.Windows.Automation` | **Accessibility API (AX)** — `AXUIElement` | **AT-SPI2** over D-Bus |
| No-build bridge | PowerShell + `Add-Type -AssemblyName UIAutomationClient` (assemblies ship with Windows) | `osascript` driving **System Events** UI scripting (ships with macOS) | `gdbus`/`busctl` to the AT-SPI2 bus, or `python3-pyatspi` if present |
| Element data | Name, AutomationId, ControlType, BoundingRectangle, IsEnabled, IsOffscreen, control **patterns** | role, title, value, position, size, actions | name, role, states, text, actions |
| Actuation (preferred) | control patterns: `InvokePattern`, `ValuePattern`, `TogglePattern`, `ExpandCollapsePattern`, `SelectionItemPattern` | `AXPress` and friends via System Events | AT-SPI `Action` interface (`do_action`) |
| Keyboard/text | `ValuePattern.SetValue`, else `SendKeys` | `keystroke` via System Events | AT-SPI text, else **ydotool** |
| Input injection caveat | works unelevated except **into elevated apps** (UIPI blocks it) | needs per-app **Accessibility permission** granted by the user | X11: `xdotool`. **Wayland**: xdotool doesn't work; `ydotool` needs a `/dev/uinput` daemon and root-ish perms, types slowly, can't target a window |
| Launch | `explorer shell:AppsFolder\<AppID>` (already used) | `open -a "App"` | `.desktop` exec / `gtk-launch` |

**Why not a native Node library (nut.js / robotjs).** They are the obvious choice and they are the wrong one here. Both need `node-gyp`: Windows build tools, Xcode CLT on Mac, and on Linux Python + make + GCC + `libxtst-dev` + `libpng++-dev`. This laptop has none of that. nut.js has moved to N-API + prebuilt `libnut`, which *sometimes* installs without a compiler, but relying on a prebuild matching this exact Node/OS is fragile, and robotjs/nut.js are primarily **mouse+keyboard+screen** — coordinate-level, not accessibility-tree-level. They would push us toward the image fallback as the primary path, which is precisely backwards. The OS-native bridge gives the structured tree for free and needs nothing installed.

**Conclusion, and the order.** One common `DesktopDriver` interface, three implementations behind it, chosen at runtime by `process.platform`. **Windows first** — it is the dev machine, its UIA tree is the richest of the three, and the no-build PowerShell path is already proven here. macOS and Linux drivers slot in behind the same interface later; the permission and Wayland caveats above are why they are separate phases, not an afternoon each.

## Architecture — it maps onto the loop we already have

Nothing about the agent loop changes. The desktop is a surface with a snapshot and an element registry, identical in shape to the browser:

```
readDesktop()  → { window, elements[] }         mirrors readPage()
formatDesktopSnapshot(...) → compact text        mirrors formatSnapshot()
registry: numeric id → element handle            mirrors elements/registry.js
execute: one desktop action → one observation    mirrors executor.js
```

**New client modules (Windows first):**

| Path | Role |
|---|---|
| `client/src/automation/desktop/driver.js` | picks the driver for `process.platform`; common interface |
| `client/src/automation/desktop/windows/bridge.js` | one **persistent** PowerShell host; line-delimited JSON in/out |
| `client/src/automation/desktop/windows/uia.js` | enumerate the focused window's tree, invoke patterns, set focus |
| `client/src/automation/desktop/windows/apps.js` | launch / list / focus / close (reworked from the stub, to standard) |
| `client/src/automation/desktop/snapshot.js` | elements → compact text with numeric ids (OS-agnostic) |
| `client/src/automation/desktop/registry.js` | id → element handle, cleared each read |
| `client/src/automation/desktop/vision.js` | OCR + coordinate fallback via `visionReader.js` |

**The persistent bridge is the key performance decision.** Spawning `powershell.exe` per action costs 200–500ms of startup every step — unacceptable when we snapshot every turn. Instead the client keeps **one** long-lived PowerShell host open (as the browser keeps one Playwright process) and sends it commands over stdin, reading one JSON line per reply over stdout. Startup is paid once. The host loads the UIA assemblies once. This is the single most important thing to get right and the easiest to get wrong.

**Cloud side:** new action types added to `agentLoop.js` `BROWSER_ACTIONS`, to `actionSchema.js`, and documented in `prompt.js`. Proposed set, kept small and typed:

| Action | Params | Notes |
|---|---|---|
| `list_apps` | — | idempotent, like `list_browsers` |
| `open_app` | `app` | launch by name |
| `focus_app` | `app` | bring to front, make it the active window |
| `close_app` | `app` | **consequential** — see safety |
| `read_desktop` | — | snapshot the focused window |
| `click_element` | `id` | invoke via pattern, not coordinates |
| `type_into` | `id`, `text`, `submit?` | `ValuePattern.SetValue`, secret-aware |
| `set_toggle` | `id`, `on` | checkboxes/switches |
| `select_menu` | `id`, `value` | menus / expandable lists |
| `press_keys` | `keys` | e.g. `Ctrl+S`; global to the focused app |
| `click_at` | `x`, `y` | **fallback only**, offered when a `read_desktop` fell back to OCR |

`open_app` / `open_for_user` stay distinct: `open_for_user` is the browser courtesy tab; `open_app` drives a native app Kairos will then act on.

## The Windows driver in detail

- **Enumerate.** `[System.Windows.Automation.AutomationElement]::RootElement`, then the focused window via `GetFocusedElement`/`FromHandle(MainWindowHandle)`. Walk with a `TreeWalker` (ControlView) or `FindAll(TreeScope.Descendants, condition)`. **Scope to the focused window, cap depth and element count** exactly as the browser snapshot caps links — a full-desktop walk is huge and slow.
- **Per element, emit:** `AutomationId`, `Name`, `ControlType.ProgrammaticName` (Button/Edit/CheckBox/MenuItem/…), `BoundingRectangle`, `IsEnabled`, `IsOffscreen`, and which **patterns** it supports. The supported-patterns list is what tells the model (and the executor) whether an element is invokable, editable, or toggleable — the desktop equivalent of an ARIA role.
- **Act through patterns, not pixels.** `InvokePattern.Invoke()` for buttons, `ValuePattern.SetValue()` for text, `TogglePattern.Toggle()`, `ExpandCollapsePattern`, `SelectionItemPattern.Select()`. Pattern invocation is reliable and windowless; coordinate clicking is the fallback of the fallback.
- **Type secrets safely.** `type_into` resolves `{{secret:name}}` through the existing vault at the client boundary, same as browser `type` — the cloud only ever sees the placeholder. Prefer `ValuePattern.SetValue` (atomic, no keylogging surface) and never log the resolved value.
- **Known caveats to encode, not discover the hard way:** a non-elevated Kairos cannot inspect or drive an **elevated** app (UIPI) — detect and report honestly rather than hang. Chromium/Electron apps need accessibility forced on to expose a full tree; note it, don't fight it. A `SetValue` on a password field may be masked in readback — verify by pattern success, not by reading the value back (we learned this class of bug in the browser `type.js` this month).

## Safety — the gate is not optional here

Desktop actions are irreversible in ways browser actions are not: closing an unsaved document, `Ctrl+Shift+Del`, deleting a file in Explorer, hitting Send in a mail client. The approval gate in `consequence.js` already exists and already keys off **action type plus the element's accessible label** against an auditable verb list — it does not read page prose, so working agreement #1 stands. Extending it to desktop is mostly feeding it desktop labels:

- `close_app` is treated as consequential when the app has unsaved state we can detect (title bar `*`/"unsaved", a "Save changes?" dialog present) — pause and confirm.
- `click_element` whose `Name` matches the existing irreversible verb set (delete, send, buy, …) — same gate as the browser, unchanged.
- `type_into` with `submit:true` carrying a `{{secret:…}}` — same secret gate as the browser.
- `press_keys` for known destructive chords (`Delete`, `Ctrl+Shift+Del`) in a file-manager context — confirm.

`DRY_RUN=true` must cover desktop from day one: narrate every `click_element` / `type_into` / `set_toggle` / `press_keys` / `close_app` without executing, exactly as it refuses browser mutations today. This is worth more than a demo video for showing the safety story.

## Vision / OCR backup

When `read_desktop` yields almost nothing (fewer than N elements, or the focused window exposes no tree), fall back automatically — same trigger discipline as the browser's OCR (`readPage` only calls vision when ARIA+DOM is near-empty):

1. Screenshot the focused window (a bridge command; or `takeScreenshot` generalised off the browser).
2. OCR through `visionReader.js`'s existing Tesseract worker — no new dependency, RAM budget intact.
3. Emit OCR text boxes as vision elements with bounding boxes, and offer only `click_at{x,y}` and `press_keys` against them.

The model is told plainly in the snapshot that it is in fallback mode and coordinates are approximate, so it prefers a real element whenever one exists.

## Phases

Sequenced by leverage and dependency. Each phase is shippable, tested, and leaves `main` green. Windows-only through D6; other OSes are D7–D8.

### Phase D1 — Launch and window control (rework the stubs, wire to the cloud)

*The smallest honest end-to-end slice: the model can open, focus, and close a named app.*

- **Parts.** (a) Rewrite `apps.js` to the current standard — compact, no comments, real `focusApp` (via `AutomationElement.FromHandle` + `SetFocus`, or `Get-Process` MainWindowHandle) and a `closeApp` that works by window/AppID not a two-entry lookup. (b) `list_apps` from `Get-StartApps`, idempotent. (c) Add `open_app`/`focus_app`/`close_app`/`list_apps` to `agentLoop.js`, `actionSchema.js`, and `prompt.js`. (d) Route through `desktopAdapter.js`.
- **Tests.** Unit: `Get-StartApps` JSON → app list parser (fixtures); action→command builder; app-name resolver (exact/startsWith/includes, from the existing `findApp`). Mock the bridge. Live smoke: open/focus/close Notepad.
- **Done when** "open Notepad", "focus Notepad", "close Notepad" work through the real loop, and the eval still passes.

### Phase D2 — Read the desktop (the inner thing)

*Introspection: the focused window becomes a snapshot the model can read.*

- **Parts.** (a) `bridge.js` — the persistent PowerShell host with line-delimited JSON and a request/timeout protocol (mirror `executeActionRemotely`'s correlation + 60s timeout). (b) `uia.js` — enumerate the focused window, scoped and capped, emitting the per-element fields above. (c) `registry.js` — id→handle, cleared each read. (d) `snapshot.js` — elements → compact text with numeric ids and control types, capped like the browser snapshot. (e) `read_desktop` action wired end to end.
- **Tests.** Unit: UIA JSON → elements parser; snapshot formatter (dedupe, cap, offscreen filtered); registry. A **simulated-desktop** fixture suite modelled on the simulated-browser suite — recorded UIA trees replayed through the formatter, no PowerShell. Live smoke: snapshot Notepad and the Calculator.
- **Done when** `read_desktop` on Calculator lists its buttons with stable ids and control types, from cache-free fixtures in CI.

### Phase D3 — Act on elements (patterns, not pixels)

*Actuation through the accessibility patterns.*

- **Parts.** `click_element` (InvokePattern), `type_into` (ValuePattern.SetValue, secret-aware), `set_toggle` (TogglePattern), `select_menu` (ExpandCollapse/SelectionItem), `press_keys`. Each returns an honest observation with a re-`read_desktop` after settle, like the browser executor. Reuse the browser's success philosophy: **honest failure over false success** (the `click.js`/`type.js` lesson — verify by pattern result, never by "something changed").
- **Tests.** Unit: action→command builder per pattern; secret resolution goes through the vault and never appears in logs; observation shape. Mock the bridge to assert the right pattern call is issued. Live smoke: type into Notepad, compute `7 × 8` on Calculator and read the result back.
- **Done when** a full task — "open Notepad, type a line, save it to the Kairos folder" — runs end to end, the save going through the file sandbox.

### Phase D4 — Extend the safety gate + dry-run to desktop

*Autonomy stays trustworthy on the more dangerous surface.*

- **Parts.** Feed desktop labels/contexts into `consequence.js` (close-with-unsaved, irreversible verbs, secret submits, destructive chords). Make `DRY_RUN` refuse every desktop mutation and narrate it. `/status` shows the gate covers desktop.
- **Tests.** Unit (cloud): `classifyConsequence` on desktop actions — close-with-unsaved confirms, plain close does not; delete/send labels confirm; dry-run refuses each mutating desktop type. These are pure and fully unit-testable, no desktop needed.
- **Done when** Kairos will not close an unsaved document, delete a file, or submit a stored password on the desktop without an explicit yes — proven by cloud unit tests.

### Phase D5 — OCR / coordinate fallback

*The image thing, as backup only.*

- **Parts.** Auto-trigger when `read_desktop` is near-empty; screenshot the focused window; OCR via `visionReader.js`; emit vision elements + `click_at`; snapshot tells the model it is in fallback mode.
- **Tests.** Unit: fallback trigger threshold; vision-element formatting; `click_at` clamps to screen bounds. Reuse the existing `visionReader` OCR tests. Live smoke: a canvas/game window with no tree.
- **Done when** an app with no accessibility tree is still actionable via OCR, and a tree-bearing app never falls back.

### Phase D6 — Eval cases + prompt integration

*Regression safety, the same bar as the browser.*

- **Parts.** Record desktop decision traces (the loop already produces the right structure via `trace.js`) and add cases to `cloud/eval/cases.json`: "open the app, don't open the browser", "use the element id, don't invent one", "fall back to OCR only when the tree is empty", "confirm before closing unsaved". Tighten `prompt.js` so desktop and browser actions don't bleed into each other.
- **Tests.** `npm run eval` stays green with the new cases; token budget stays under ceiling (desktop prompt additions are the risk — measure, don't guess).
- **Done when** a prompt change that breaks desktop task success fails the build, same guarantee the browser has.

### Phase D7 — macOS driver

- **Parts.** `macos/bridge.js` (osascript / System Events), `macos/ax.js` (AX tree → the same element shape), launch via `open -a`. Handle the **Accessibility permission** grant explicitly: detect when it's missing and tell the user exactly which toggle to flip, rather than failing opaquely.
- **Tests.** AX output → elements parser (fixtures); the OS-agnostic snapshot/registry/gate get reused unchanged. Live smoke on a Mac: TextEdit.
- **Done when** the same "open, type, save" task runs on macOS behind the identical action set.

### Phase D8 — Linux driver

- **Parts.** `linux/bridge.js` to AT-SPI2 over D-Bus (`gdbus`/`busctl`, or `pyatspi` when present), launch via `gtk-launch`/`.desktop`. Input injection: `xdotool` on X11, `ydotool` on Wayland — **detect the session type** and pick, and degrade honestly on Wayland where injection is restricted (introspection still works; injection may not).
- **Tests.** AT-SPI JSON → elements parser; session-type detection; injector selection. Live smoke on X11 and Wayland: gedit.
- **Done when** the task runs on at least X11, with Wayland limitations documented and reported at runtime rather than hung on.

## Testing strategy — how to test desktop code without a desktop

The lesson from the browser suite: **make the pure parts pure, and mock the bridge.** Everything valuable is testable in CI with zero real UI:

- **Parsers** (PowerShell/osascript/AT-SPI JSON → elements) are pure functions over fixture strings. This is where real bugs live and where unit tests earn their keep.
- **Snapshot formatter, registry, action→command builder, consequence gate** are all pure and OS-agnostic — the bulk of the code, fully unit-tested.
- **The bridge is injected** (a `runCommand` function), so tests pass a fake that returns recorded fixtures — the simulated-browser pattern, now a simulated-desktop suite.
- **Live smoke tests** against Notepad / Calculator (Windows), TextEdit (Mac), gedit (Linux) are the honest end-to-end check, run by hand like the voice mic-loopback test — never in CI, because they need a real session.
- **Every phase leaves both suites green and the eval passing.** No phase merges on vibes.

## What not to build

- **A coordinate-first automator (robotjs/nut.js as the primary path).** It inverts the design — pixels as truth, tree as afterthought — and drags in the build toolchain this machine refuses. Accessibility tree first, always.
- **Regexes that interpret window text to decide actions.** Same working agreement as the browser. The model reads the snapshot; code executes; the gate keys off structure, never prose.
- **A per-action PowerShell spawn.** The 200–500ms startup tax makes the loop unusable. One persistent host, always.
- **Driving elevated apps from an unelevated Kairos.** UIPI forbids it; detect and report, don't try to escalate.
- **Fighting Wayland's injection restrictions.** They are a security feature. Introspect what we can, inject where allowed, and say so when we can't.

## Cost

Zero new install on any OS. Every bridge shells out to a tool the OS already ships (PowerShell, osascript, gdbus/xdotool/ydotool). OCR reuses the resident Tesseract worker. The only new runtime cost is one persistent PowerShell host (~30–60MB) while desktop mode is active, released when it isn't — the same shape as keeping a browser process alive.

## References

- Microsoft — Obtaining UI Automation Elements: https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-obtainingelements
- Microsoft — AutomationElement class: https://learn.microsoft.com/en-us/dotnet/api/system.windows.automation.automationelement
- Apple — Automate the User Interface (System Events UI scripting, accessibility permission): https://developer.apple.com/library/archive/documentation/LanguagesUtilities/Conceptual/MacAutomationScriptingGuide/AutomatetheUserInterface.html
- freedesktop — AT-SPI2: https://www.freedesktop.org/wiki/Accessibility/AT-SPI2/
- ydotool (Wayland/X11 input via /dev/uinput): https://github.com/ReimuNotMoe/ydotool
- nut.js (native automation, N-API/cmake-js build) : https://nutjs.dev/
- robotjs (node-gyp build requirements): https://github.com/octalmage/robotjs

# Markooj — Architecture contract

Every module codes against this file. If you need something that is not here, add it to **your own** file
and expose it through `app` (see "Extending the contract"); never edit a file you do not own.

Stack: Electron 45 (`main.js`, `preload.js`) + plain browser JavaScript in `src/` (no bundler, no frameworks,
no network). The window loads `markooj://app/src/index.html`: main registers a privileged custom protocol
`markooj` (standard, secure, supportFetchAPI, corsEnabled, stream) that serves files from the app root (works inside asar),
so `fetch`, ES-module `import()`, Web Workers, pdf.js and Pyodide all work with relative URLs like `../node_modules/...`.
The protocol refuses paths outside the app root. Scripts load with classic `<script src>` tags in `src/index.html` in this order:

```
../node_modules/katex/dist/katex.min.js, ../node_modules/mermaid/dist/mermaid.min.js,
core.js, shell.js, exporter.js, editor-source.js, editor-word.js, editor-inline.js, editor-read.js,
equation-editor.js, commands.js, viewers.js, research.js, xref.js, recovery-ui.js, developer.js, addons.js,
tooltips.js, integration.js, app.js (boot, last)
```

CSS: `../node_modules/katex/dist/katex.min.css`, `../node_modules/highlight.js/styles/github.css`
(and `github-dark.css` under dark), `styles.css`, `editor-inline.css`, `equation-editor.css`, `xref.css`.

Security: `contextIsolation: true`, `nodeIntegration: false`. The renderer only touches Node through
`window.mk` (preload). Rendered Markdown HTML is sanitized (DOMPurify) before it enters the DOM.
CSP in index.html: `default-src 'self' file: data: blob:; script-src 'self' file: 'unsafe-eval' blob:; style-src 'self' file: 'unsafe-inline'; img-src * file: data: blob:; worker-src 'self' file: blob:; connect-src 'self' file: data: blob:`.
(`unsafe-eval` is needed for JS macros/add-ins and Pyodide.)

## Files and owners

| File | Owner (workflow agent) | Purpose |
|---|---|---|
| `src/core.js` | lead (written) | `window.app`: events, commands, ribbon registry, docs model, editor registry, settings, UI helpers, tests |
| `src/index.html`, `src/styles.css`, `src/shell.js`, `src/exporter.js`, `src/app.js` | **shell** | Port of `design/mock.html`: title bar, ribbon renderer, doc tabs (top/bottom/left), outline, canvas, status bar, zoom, theme, popovers, dialogs, toasts, backstage (File view) frame + New/Open/Save/Save As/Print/Options pages, command palette (Ctrl K), keyboard shortcut dispatch, the **View** ribbon tab, `app.exporter`, boot |
| `src/editor-source.js`, `src/editor-word.js`, `src/commands.js` | **editor** | Simple mode (source + live preview), Word mode (WYSIWYG on rendered page), all Home / Insert / Layout commands and their ribbon groups, equation editor dialog |
| `src/viewers.js`, `src/research.js` | **research** | PDF / DjVu page viewers, References + Review tabs (citations/BibTeX, TOC, footnotes, cross-refs, equation numbering, word count, spelling, find/replace dialog, outline data) |
| `src/developer.js`, `src/py-worker.js`, `src/addons.js`, `addons/*.js` | **developer** | Developer tab: Python (Pyodide) + JS macros, editor, recorder, shortcuts, math macros; add-in manager + Add-ins tab; sample add-ons |
| `src/recovery-ui.js` | **main** | File → Recover and File → Info (metadata) backstage pages, Options page section for retention |
| `scripts/fetch-tools.js`, `vendor/`, `licenses/`, `THIRD_PARTY_NOTICES.md` | **tools** | Download official Pandoc + DjVuLibre/pdf2djvu binaries into `vendor/<platform>/` (layout below), license texts |
| `main.js`, `preload.js`, `package.json`, `scripts/smoke.js` | **main** | IPC, files, conversions, bundled tools, recovery store, metadata, settings file, smoke test, packaging |

## Preload bridge: `window.mk`

Already present (keep these): `render(text, {bib, macros}) → {html, meta, frontMatter, cited}`,
`detectFlavor(text) → {name, features[]}`, `toMarkdown(html, {inlineMath}) → string`, `parseBib(src) → {key: entry}`,
`inlineMath(tex)`, `displayMath(tex)`, `platform`, `versions`, `invoke(channel, ...args)`, `on(channel, fn)`.

`render` must also accept `macros` (KaTeX macro object, from Developer → Math macros) and return sanitized HTML.
Front matter helpers to add: `mk.frontMatter.parse(text) → {meta, body, raw}`, `mk.frontMatter.write(text, meta) → text`.

### IPC channels (`mk.invoke`) — implemented by **main**

| Channel | Args | Returns |
|---|---|---|
| `open-dialog` | – | `string[]` paths |
| `read-file` | path | `{path, ext, mtime, kind:'markdown'|'html'|'pdf'|'djvu', text?, html?, data?(base64), pages?, meta?}` |
| `write-text` | path, text | mtime |
| `save-dialog` | `{defaultPath, filters}` | path or null |
| `export` | `{format, out, html, md, title, meta}` | out path (throws Error with a plain-English message) |
| `export-formats` | – | `[{id, label, ext, available:boolean, via:'built-in'|'pandoc'|'djvulibre'}]` |
| `tools` | – | `{pandoc, pdf2djvu, ddjvu, djvutxt, bundled:boolean}` resolved paths or null |
| `file-info` | path | `{size, created, modified, path}` |
| `djvu-page` | path, pageIndex, dpi | `{png: base64, width, height, pages}` |
| `djvu-text` | path | string |
| `settings-get` | – | object |
| `settings-set` | patch | object (merged, written to `userData/settings.json`) |
| `recovery-save` | `{docId, path, title, text}` | – (writes `userData/recovery/<docId>.json` with timestamps) |
| `recovery-list` | – | `[{docId, path, title, savedAt, closedAt, preview, size}]` (purges entries older than retention days) |
| `recovery-get` | docId | `{docId, path, title, text, savedAt}` |
| `recovery-delete` | docId | – |
| `recovery-mark-closed` | docId | – (keeps the entry, stamps closedAt) |
| `macros-list` / `macros-save` / `macros-delete` | – / `{name, lang, code, shortcut, ribbon}` / name | stored in `userData/macros/` |
| `user-addons` | – | `{dir, list:[{name, code, user}]}` |
| `addon-install` | – | opens a picker, copies a `.js` into the add-ons folder, returns name |
| `reveal`, `open-folder`, `open-external` | path / url | – |
| `print` | `{html, title}` | prints a standalone HTML document through the system print dialog |
| `save-asset` | `{docPath, name, data(base64)}` | saves an image next to the doc in `assets/`, returns relative path (or a data URI when the doc is unsaved) |
| `smoke-shot` | name | captures the window to `<outDir>/<name>.png` (smoke mode only) |
| `confirm-close` | – | closes the window for real |
| `smoke-done` | results | writes results and quits (smoke mode only) |

Events from main (`mk.on`): `open-path` (path), `request-close`, `smoke` (outDir) — in smoke mode, after load.

## `window.app` (src/core.js)

- `app.events.on(name, fn) / off / emit(name, payload)`
  Events: `doc:opened`, `doc:active`, `doc:changed` ({doc, origin}), `doc:saved`, `doc:closed`, `mode:changed` ('word'|'simple'),
  `zoom:changed` (pct), `theme:changed`, `settings:changed`, `selection:changed`, `ribbon:changed`, `command:ran` ({id, args}), `ready`.
- `app.commands.register(id, {label, icon, shortcut, run(args), isActive(), isEnabled()})`, `app.commands.run(id, args)`,
  `app.commands.get(id)`, `app.commands.list()`. Every ribbon button runs a command. `command:ran` drives the macro recorder.
  Command id convention: `area.action` e.g. `format.bold`, `insert.table`, `view.zoomIn`, `file.save`, `dev.runMacro`.
- `app.ribbon.addTab({id, label, order})`, `app.ribbon.addGroup(tabId, {id, label, order, items})`, `app.ribbon.tabs()`.
  Item shapes: `{type:'big', command, label, icon}`, `{type:'small', command, label, icon, text?}` (`text` shows instead of icon, e.g. **B**),
  `{type:'select', command, label, options:[{value,label}], value()}`, `{type:'gallery', command, options:[{value,label,preview}]}`,
  `{type:'seg', command, options:[{value,label}], value()}`, `{type:'row', items:[...]}`, `{type:'col', items:[...]}`, `{type:'sep'}`,
  `{type:'custom', render(el)}`. Icons are names of `<symbol id>` in index.html (the mock's set; shell may add more).
  Tab ids: `home, insert, layout, references, review, view, developer, addins` (File is the backstage, not a ribbon tab).
- `app.backstage.addPage({id, label, icon, order, render(el)})`, `app.backstage.open(pageId)`, `app.backstage.close()`.
  Page ids: `new, open, save, saveas (Save As / Export), print, info, recover, addins, options`.
- `app.options.addSection({id, label, render(el)})` — sections inside the Options backstage page.
- `app.docs`: `list()`, `active()`, `get(id)`, `create({text, path, title, ext, kind, html, data, readOnly})`, `activate(id)`,
  `close(id, {force})`, `open(path)`, `save(doc)`, `saveAs(doc)`.
  Doc: `{id, path, title, ext, kind, text, savedText, dirty, flavor, meta, readOnly, viewer?}` and `doc.setText(text, origin)`
  (emits `doc:changed`, updates `dirty`, re-detects flavor, debounced recovery save).
  `kind`: `markdown` (editable), `pdf`, `djvu` (viewer; "Edit as text" creates a new markdown doc).
- `app.editors.register(name, adapter)`, `app.editors.active()`; `app.mode` ('word'|'simple'); `app.setMode(m)`.
  EditorAdapter: `mount(container, doc)`, `unmount()`, `getSelection() → {text, start, end}` (offsets in Markdown source when known),
  `replaceSelection(md)`, `insert(md)`, `wrap(before, after)`, `format(kind)` (bold, italic, underline, strike, code, sub, sup, highlight, h1..h6, p, quote, ul, ol, task, indent, outdent, alignLeft/Center/Right/Justify),
  `focus()`, `scrollToLine(n)`, `getText()`, `refresh()`, `find(query, opts)`.
- `app.render(text, opts) → Promise<{html, meta, cited}>` (calls `mk.render` with bib + math macros, then runs `app.hooks.postRender` and Mermaid).
- `app.hooks.postRender(fn(el, doc))`, `app.hooks.preRender(fn(text, doc) → text)` — for add-ons.
- `app.settings.get(key, fallback)`, `app.settings.set(key, value)`. Keys: `theme`, `tabPosition` ('top'|'bottom'|'left'),
  `defaultMode`, `zoom`, `outline`, `recoveryDays` (7), `inlineMath` ('d'|'paren'), `mathMacros` (string), `fontFamily`, `fontSize`, `recent` (paths).
- `app.ui.toast(msg, {kind})`, `app.ui.dialog({title, body (html string or Element), buttons:[{label, value, primary, danger}]}) → Promise<value>`,
  `app.ui.prompt(title, label, value) → Promise<string|null>`, `app.ui.confirm(title, text) → Promise<boolean>`, `app.ui.popover(anchorEl, contentEl)`.
  (Implemented by **shell**; core provides fallbacks.)
- `app.status.addItem({id, side:'left'|'right', order, render(el)})` and `app.status.refresh()`.
- `app.tests.register(name, async fn)` — smoke tests; `app.tests.run() → [{name, ok, error}]`.

## Ribbon tabs and who fills them

- **home** (editor): Clipboard, Font, Paragraph, Styles gallery, Editing (Find → research's find dialog command `edit.find`, Equation).
- **insert** (editor): Table, Picture, Diagram (Mermaid), Equation, Code, Callout, Link, Divider, Page break, Footnote, Citation (research command).
- **layout** (editor): page size, margins, columns, line spacing, paragraph spacing, document theme.
- **references** (research): Contents, Footnote, Cite, Library (.bib), Citation style, Cross-ref, Number equations, Bibliography.
- **review** (research): Spelling, Word count, Comments (`<!-- comment -->` stored in Markdown), Compare with saved.
- **view** (shell): Print/Web/Focus layout, Outline, Tab position, Zoom group, Word/Simple mode, Theme.
- **developer** (developer): Macros, Record, Python, JavaScript, Math macros, Add-ins manager, Run selection.
- **addins** (developer): installed add-on cards and the buttons add-ons register.

## Bundled tools layout (tools → main)

```
vendor/win32/pandoc/pandoc.exe
vendor/win32/djvulibre/ddjvu.exe, djvutxt.exe, djvused.exe, c44.exe, djvm.exe (+ DLLs)
vendor/win32/pdf2djvu/pdf2djvu.exe (+ DLLs)
(vendor/darwin-arm64/..., vendor/darwin-x64/..., vendor/linux-x64/...: Pandoc only, same names without .exe; DjVu tools come from PATH, Homebrew or apt)
```
Packaged: `process.resourcesPath/vendor/...` (electron-builder `extraResources` from `vendor/win32`, `vendor/darwin-${arch}` or `vendor/linux-${arch}`); dev: `<appRoot>/vendor/<platform>/...` or `vendor/<platform>-<arch>/...`; then PATH (and Homebrew/system folders on macOS and Linux).
`licenses/` ships as `extraResources` too.

## Markdown round-trip conventions (preload toMarkdown ↔ editors/research)

Kept as raw HTML inside Markdown: `<u>`, `<mark>` (also written as `==x==`), `<div align="center|right|justify">`,
`<div class="page-break"></div>`, `<br>`, `<kbd>`, `<details>`. Comments: Markdown `<!-- comment: text -->`; research's postRender
turns them into `<span class="mk-comment" contenteditable="false" data-text="...">` and toMarkdown turns that back into the HTML comment.
Math spans/blocks, citations, Mermaid and front matter round-trip exactly as in preload.js today.

## Smoke test

`npx electron . --smoke <outDir>`: window loads hidden, main sends `smoke` → renderer runs `app.tests.run()`
plus an export of a sample doc to every available format into `outDir`, then `mk.invoke('smoke-done', results)`;
it also calls `smoke-shot` for `word`, `simple`, `backstage`, `dark` screenshots; main writes `outDir/smoke.json` and exits with code 0 when all pass, 1 otherwise. Every module registers tests for its features.

## Extending the contract

Need a new IPC channel? Ask the **main** agent's file to provide it by putting it in your report; meanwhile call it inside
try/catch and degrade gracefully. Need a shared helper? Put it on `app.<yourArea>` in your own file.

## Integration additions (2026-11-21)

Added while wiring the modules together. They extend the contract above; nothing above changed.

- **IPC (main):** `pick-file(filters, {title, defaultPath})`, `read-text(path)`, `app-info`, `recovery-dir`, `recovery-delete-all`.
  `read-file` also returns `meta` for PDF (pdf-lib) and DjVu (`djvused print-meta`), and `convertedFrom` for files Pandoc turned into Markdown (core keeps it, so Save goes to Save As).
  `export` accepts `{format:'raw', out, text | data(base64)}` for exporters that add-ins register.
- **Preload:** `mk.pathForFile(file)` (Electron's `webUtils.getPathForFile`) for files dropped on the window.
- **Core:** `app.commands.unregister(id)`; `app.assetUrl(doc, src)` turns a picture path next to a saved document into `markooj://local/<absolute path>`; `app.tests` gives each test 30 s (Python 120 s) and exposes `tests.current`.
  Mermaid follows the app theme on screen and is always light in exports.
- **Exporter:** `app.exporter.register({id, label, ext, description, run(doc, ctx)})` adds a format to File → Save As ("From add-ins"); `run` returns text or bytes. Exports read `app.layout.cssFor(doc)` (page size, margins, fonts, columns) and flush the Word editor first.
- **Editors:** the Word adapter has `getSurface()` (the `.mk-page`). Commands may carry `altShortcuts` (keys that apply only while typing in the editor); the shell shows them in tooltips, the palette and the shortcuts list but never dispatches them globally.
- **Shell:** keys inside `[data-mk-keys="own"]` (the Macro Editor) are left alone. `app.shell.selectTab(id)`.
- **Research:** `ref.editCitation {element}` (double-click a citation in Word mode).
- **Smoke:** `npm run smoke:report` also opens the exported DOCX, EPUB, ODT, RTF, LaTeX, PDF and DjVu files, checks the recovery copy of a tab closed without saving and the left tab strip, and takes screenshots `word, simple, backstage, developer, info, recover, home, dark`.
- **Dev profile:** `MARKOOJ_USER_DATA=<folder> npx electron .` runs with throwaway settings and recovery store.
- **Packaging:** `build/icon.png` is the app icon; `vendor/` and `vendor-src/` are git-ignored and fetched with `npm run fetch-tools`.

## Round 2 additions (2026-11-21, PLAN-v2 items 21–29)

### New files and owners

| File | Owner | Purpose |
|---|---|---|
| `src/equation-editor.js`, `src/equation-editor.css` | **equations** | `app.equationEditor`: MathLive (local, `node_modules/mathlive`) + LaTeX box, palettes, matrix picker, recent/favorites, Inline/Display, Numbered, label |
| `src/xref.js`, `src/xref.css` | **xref** | `app.xref`: the only numbering system (equations, figures, tables, sections), captions, cross-references, hover cards, dialogs |
| `src/editor-inline.js`, `src/editor-inline.css`, `src/editor-read.js` | **modes** | Inline (live) mode, Read mode, `app.typing`, `app.notes` |
| `src/tooltips.js` | **ux** | `app.tooltips` ScreenTips |
| `src/integration.js` | **integrator** | `editor:rendered` bridge and cross-module smoke tests (round-trips, ribbon hygiene, ScreenTip coverage) |

### Modes
`app.modes = ['word','inline','simple','read']`; `app.setMode(m)` returns true/false and records `app.prevMode`.
Body classes `mode-word|mode-inline|mode-simple|mode-read`. Keys: Ctrl+Shift+M cycles, Ctrl+1…4 (`view.modeWord|modeInline|modeSimple|modeRead`), Esc leaves Read (`app.shell.backToEditing`).
Events: `mode:changed` (m), `mode:shown` ({mode, view}) after the cross-fade, `editor:rendered` ({mode, doc, page}), which integration.js
emits whenever `word:rendered`, `inline:rendered` or `read:rendered` fires.
Optional adapter methods the shell uses to keep the position: `getTopLine()`, `revealLine(line, {frac, offset})`, `getCaretLine()`, `setCaretLine(line)`, `setSelection(start, end)`
(lines count from the top of the file, front matter included).

### Markdown syntax (Pandoc-crossref; parsed in preload, numbered by `app.xref`)
- Labels: `$$ … $$ {#eq:x}` (also after `\end{equation}`), `![Cap](a.png){#fig:x}`, `: Caption {#tbl:x}` or `Table: Caption {#tbl:x}` (above or below a table), `# H {#sec:x}`. `{-}` / `.unnumbered` turn numbering off.
- References: `@eq:x`, `[@fig:x; @fig:y]`, `[-@tbl:x]` (number only), `@Fig:x` (capitalized). Rendered as `span.mk-xref[contenteditable=false][data-ref][data-raw]`; never counted as citations.
- KaTeX `\tag{}` is never written for automatic numbers. Preload strips `\tag`, `\label`, `\notag`, `\nonumber` before KaTeX draws (kept as `data-tag`, `data-tex-label`, `data-notag`); KaTeX's own `.eqn-num` is hidden. A custom `\tag{A}` shows as a fixed number in the same gutter.
- Numbers are painted as `span.mk-eqno[data-mk-ui]` (equations, in a fixed right gutter; `.mk-math` is a 3-column grid) and `span.mk-xnum[data-mk-ui]` (caption prefixes). Anything with `[data-mk-ui]` never reaches the Markdown. Read mode shows both.
- Hidden notes `%%…%%`: `app.notes` (postRender) keeps the `%%` marks as hidden `.mk-note-mark` spans, so Word mode writes them back exactly (no toMarkdown rule needed). Notes and `<!-- comment: … -->` are hidden in Read mode, print and exports unless "Include comments" is on. Margin comment bubbles show in Word and Inline modes.
- `mk.xref = {scan(text), parseAttrs, buildAttrs, eqMeta, attrPattern}` (preload). `scan` items carry absolute `line` numbers (front matter included).

### `app.xref`
`config(doc)`, `setConfig(patch, 'app'|'doc'|'both'|'auto')`, `model(doc)`, `targets(text)`, `apply(el, doc)`, `refresh()`, `refText`, `numberOf(label)` (`"(1.2)"` for equations),
`fullLabel`, `format(kind, num, {full})`, `suggestLabel(kind, item)`, `setLabel({...})`, `equationInfo(el)`, `equationMarkdown(tex, {display, label, numbered})`,
`referenceMarkdown`, `insertReference({...})`, `renameRefs`, `itemForElement`, `jump(label)`, `exportMarkdown(text, doc, {format})`, `exportCss()`, `convertTags()`, `dialogs.{crossref, caption, numbering}`.
Events `xref:config`, `xref:changed`. Front matter `xref:` (`numbering: chapter|plain`, `separator`, `numberAll`, `eq`, `fig`, `tbl`, `sec`; pandoc-crossref keys too) overrides app settings.
Chapter style counts from the top heading level; a lone H1 at the top is the title (chapters are then H2) unless the front matter already has a `title`.
Commands: `xref.crossref` (Ctrl+Alt+R), `xref.caption` (Ctrl+Alt+Shift+C), `xref.numberAll`, `xref.style`, `xref.separator`, `xref.numbering`, `xref.update` (F9), `xref.goto`, `xref.convertTags`; hidden `xref.fixReference`, `xref.setLabel`.
`ref.crossref` and `ref.numberEquations` (research) stay as hidden aliases. Ribbon: References → `xref-captions` (order 40), Insert → `xref-insert` (order 45). There is one Cross-reference button per tab and one equation-numbering control (smoke-tested).

### `app.equationEditor`
`open({tex, display, label, numbered, unnumbered, delim, numberText, editing, onDone}) → Promise<{tex, display, label, numbered, unnumbered, delim, markdown} | null>`,
helpers `markdown`, `findInSource`, `labelOf`, `unnumberedOf`, `numberTextOf`, `suggestLabel`, `normLabel`, `cleanLatex`, `migrateTags`, `load`, `palettes`, `current`.
`insert.equation` opens it (args `{tex, display, label, unnumbered, direct}`); Word and Inline open it on double-click of a math atom. The dialog root has `data-mk-keys="own"`.

### `app.typing`, `app.notes`
`app.typing`: `correct(before, {context})` (AutoCorrect `--` `---` `(c)` `(r)` `(tm)` `...`, smart quotes), `mdContext`, `diff`, `mapOffset`, `createHistory()`,
`correctContentEditable`, `attachWordPage(page, adapter)`, `wireWord()`. Word mode is wired through `word:rendered` (per-keystroke undo + AutoCorrect).
`app.notes`: `strip(md, {comments})`, `wrap(el)`, `has(md)`.

### Shell, ScreenTips, feedback
- Ribbon `select` items now call their command with `{value}` (set `rawValue: true` on an item for the old bare value).
- `app.tooltips = {info(id), register(id, {title, description, markdown}), show, hide, map}`. Every ribbon/palette command must have a title and a description (smoke-tested).
  Controls carry `data-tip-cmd`; plain controls use `data-tip` / `data-tip-d` / `data-key`.
- `app.ui.check(el)`, `app.ui.glow(el)`, `app.ui.ripple(el)` for click confirmation.
- Word habits: `format.growFont` / `format.shrinkFont` (Ctrl+Shift+> / <), `edit.changeCase` (Shift+F3), `edit.changeCaseMenu`, `edit.case.*`, `view.showMarkdown` (Ctrl+Shift+/), `review.spelling` (F7), `edit.findPrev` (Shift+F4).
- Simple mode colors `%%notes%%`, `{#…}` labels and bare `@eq:` references, and a `$$ {#eq:x}` line closes the math block (also in the outline).

### Settings keys added
`smartQuotes` (true), `autocorrect` (true), `undoPerKeystroke` (true), `showComments` (true), `exportComments` (false), `showMarkdownPeek`,
`xrefStyle` ('plain'|'chapter'), `xrefSeparator` ('.'|'-'), `xrefNumberAll` (false), `xrefPrefixes` ({eq, fig, tbl, sec}),
`eqDisplay`, `eqTab`, `eqRecent`, `eqFavorites`, `eqHelp`, `eqMxRows`, `eqMxCols`, `eqMxKind`.

### Exporter additions
`app.exporter.stripHidden`, `visibleHidden`, `exportMarkdown(doc, format, opts)`, `addCss(css | fn)`, `addMarkdownTransform(fn)`.
Pandoc formats get `app.xref.exportMarkdown(...)` (plain numbers, `\qquad (1)`, or `\tag{1}` for LaTeX); HTML/PDF/print add `app.xref.exportCss(doc)`.
Comments and notes are stripped unless `exportComments` / `opts.includeComments`; with them, DOCX/ODT get real Word comments.

### Smoke additions
- `npx electron . --smoke <outDir> --smoke-only <regex>` runs only the matching in-app tests (no exports or e2e), for quick checks while developing. `app.tests.run(filter)` takes an optional filter.
- Screenshots: `word, simple, inline, read, equation-editor, crossref-dialog, backstage, developer, info, recover, home, dark`, plus test shots
  `equation, xref, xref-dialog, xref-caption, xref-ribbon, numbering, tooltip, mdpeek, options-typing`.
- The sample paper uses chapter numbering, a labeled equation and table, `@eq:`/`@tbl:` references, a comment and a hidden note.

## Review fixes (2026-11-21)

- **IPC:** `write-text(path, text, {expectMtime})` returns `{conflict:true, mtime}` instead of writing when the file changed on disk
  (core asks Overwrite / Save as Copy / Cancel). `close-cancelled` (the renderer answered a close request and stayed open),
  `spell-add(word)` (Review → Spelling → Add to Dictionary). `export` also takes `layout` (`app.layout.get(doc)`), `citeStyle`
  (`apa|ieee|chicago`, bundled `csl/*.csl`) and `renderAs` (File → Render as; picks the Pandoc reader).
- **Pandoc safety:** the document's front matter never reaches Pandoc directly (`-yaml_metadata_block`); main passes a cleaned copy
  as a second `--metadata-file` (no `css`, `bibliography`, `csl`, `epub-*`, `include-*`, `reference-doc` …). Bibliographies and CSL
  files named in the front matter are passed as `--bibliography` / `--csl` only when they are existing local files. Network
  paths (`\host`, `//host`) in links and pictures are dropped. Opening converted files runs Pandoc with `--sandbox`.
  `markooj://local` refuses network paths. http(s) loads are blocked unless the `remoteImages` setting is on (Options → Privacy).
- **Exports:** Pandoc formats get Developer math macros as `\newcommand` lines (developer.js transform), Obsidian callouts as a quote
  with a bold title, and Mermaid diagrams as PNG pictures (text formats write them to `<name>-media/`). DOCX/ODT get the Layout tab's
  page size, margins, columns and spacing; LaTeX gets `papersize`, `geometry`, `linestretch`, `classoption`.
- **Preload:** generic Pandoc fenced divs (`::: name`, `::: {#id .class}`, `.callout-*`) with `data-fence` for the round trip; every
  block carries `data-line` (fences, indented code, raw HTML, `dl`, divs); Pandoc citations with prefixes, per-key locators and
  narrative `@key` (when a library is loaded); MDX import/export lines and top-level JSX as locked `.mk-mdx` chips; inline notes keep
  `data-src`; `mk.spell.{misspelled, suggestions}`. Raw inline HTML with the author's own attributes, autolinks and escaped `\$`
  are written back as typed.
- **Commands:** `review.spelling` (F7) steps through unknown words; `review.spellingAsYouType` is the on/off switch.
  `view.focusRibbon` (F10, or Alt alone), `view.nextPane` (F6), `view.prevPane` (Shift+F6). The palette is Alt+Q (and Ctrl+Shift+P);
  Ctrl+K stays Link. `dev.runSelection` is Ctrl+Alt+Enter and asks once per document before running code that came with it.
- **UI:** `app.ui.plainError(e, fallback)`; `app.commands.run` flushes the active editor first. Settings `remoteImages`, `pyTrustedFiles`.

## Round 3 additions (2026-11-22, PLAN-v3 items 30–41, 46)

### New files and owners

| File | Owner | Purpose |
|---|---|---|
| `src/writing/rules.js` | **writing** | Rule engine (no DOM; page and worker): blanks non-prose to spaces (offsets stay true), 20+ rule families, Harper kind explanations, score, language-pack regex rules |
| `src/writing/worker.js` | **writing** | Module worker: Harper `LocalLinter` (full `binary.js` + `harper_wasm_bg.wasm`), per-paragraph cache, batches nearest the caret first |
| `src/writing/writing.js`, `src/writing/ui.js`, `src/writing/tests.js`, `src/writing.css` | **writing** | `app.writing`: languages, user dictionary, nspell spelling, underlines (CSS Custom Highlight API), cards, Writing Assistant / Thesaurus pane, F7 dialog, context menu, synonyms, ghost-text completion |
| `scripts/make-thesaurus.js` → `data/thesaurus-en.json` | **writing** | WordNet → 19.5k-word offline thesaurus (license: `licenses/wordnet-LICENSE.txt`) |
| `src/lang.js`, `src/lang.css`, `fonts/` | **languages** | `app.lang`: bidi per block, Home → Paragraph LTR/RTL, document language picker, Options → Language, pack install/remove, RTL export hooks; bundled OFL fonts (Arabic subsets) |
| `main-langpacks.js` | **languages** | Pack IPC (required from main.js). Packs are built in the separate `datakeen/markooj-language-packs` repository (`npm run build` → `dist/`) and published to its `packs` release |
| `src/word-keys.js`, `src/keytips.js` | **ribbon** | Word key map, `app.keys`, File → Options → Keyboard; KeyTips (`app.keytips`) |
| `src/tables.js`, `src/tables.css` | **tables** | `app.tables`: Markdown table operations, Word/Inline/Simple cell editing, Insert → Table picker, contextual Table Design / Table Layout |
| `src/goals.js`, `src/goals.css` | **developer** | `app.goals`: word target ring, daily goal, streak, sprints, celebration, typewriter scrolling |
| `src/health.js` | **platform** | `app.health`: bundled-tools self-check, warning toast and status item, details dialog |
| `build/portable-zip.js`, `.github/workflows/release.yml`, `pages.yml`, `check.yml` | **platform** | Portable zip (`portable.txt`), installers for Windows, macOS and Linux, website, checks |

Script order in `src/index.html` (after round 2's list): `… addons.js, tooltips.js, health.js, goals.js, lang.js, tables.js, word-keys.js, keytips.js,
writing/rules.js, writing/writing.js, writing/ui.js, writing/tests.js, integration.js, app.js`. CSS after `xref.css`: `goals.css, lang.css, tables.css, writing.css`.
The CSP is unchanged: `'unsafe-eval'` already allows WebAssembly, and the worker is same-origin (`markooj://app/src/writing/worker.js`).

### Ribbon (shell.js)
- `app.ribbon.addTab(id, {title, contextual, accent, group, description, order})` (the old `addTab({id, label, order})` still works),
  `app.ribbon.showContextual(id, on)`, `app.ribbon.isContextualShown(id)`, `app.ribbon.whyDisabled(id)`. `accent` is a CSS color or
  `table|picture|equation|chart|code|diagram`. Contextual tabs sit last; when the shown one hides, the ribbon returns to the last plain tab.
- Commands may declare `why()` → a reason string; any control whose command cannot run is dimmed and its ScreenTip shows the reason.
- Ribbon display: setting `ribbonDisplay` = `pinned|tabs|full` (old `ribbonCollapsed` kept in sync). Ctrl+F1 or a double-click on a tab toggles
  pinned ↔ tabs only; full-screen mode reveals on the top edge, the "…" button, Alt or F10.
- Review tab groups: `rev-proof` (order 10) and `rev-writing` (order 12) from writing. View tab: `Writing` group (order 15, goals.js), Show → Ribbon and
  Formatting marks. Home → Font row: Grow / Shrink Font and Change Case "Aa▾" (the old Home → Text group is gone). Home → Paragraph's alignment row
  ends with `para.ltr` / `para.rtl` (lang.js re-adds them on `ribbon:changed` if a rebuild drops them). Contextual tabs `tableDesign` (order 92) and
  `tableLayout` (order 93), accent `table`.
- `app.shell` additions: `ribbonDisplay, setRibbonDisplay, ribbonOptionsMenu, revealChrome, hideChrome, endPeek, focusRibbon, ribbonKeys,
  whyDisabled, docFontSize, setDocFontSize, fontSteps, caseMenu, cases, isEditable`.
- Status bar: `#sbLang` opens `app.lang.pickLanguage` and is labeled with `app.lang.nameOf`; `#sbSpell` opens the Writing Assistant
  (F7 still steps through issues one by one). Status items added: writing score (writing), goals ring and sprint timer (goals), tools warning (health).

### Keyboard (word-keys.js, keytips.js)
- `app.keys = {list, wordMap, notes, conflicts, apply, moved, moveText, units, format}`. `list()` → `[{id, keys, typing, title, group, word, description}]`
  (it includes Ctrl+Right Shift → `para.rtl` and Ctrl+Left Shift → `para.ltr`, which lang.js handles with its own keyup listener).
  `wordMap()` → `[{key, id, group}]`; `notes()` → Word keys that work differently here; `conflicts()` must stay empty (smoke-tested).
- The Word map is applied again on every command registration: each key belongs to exactly one command; keys a user gave to a macro win.
  Targets may be lists or RegExps: F7 → `review.spelling`, Shift+F7 → `review.thesaurus`, F1 → `help.manual|help.reference|help.open|help.show|app.help`,
  else `app.shortcuts`.
- Moved keys: zoom in Ctrl+= → Ctrl+Alt+= (Ctrl+= is Subscript); bullets Ctrl+Shift+8 → Ctrl+Shift+L (Ctrl+Shift+8 is formatting marks);
  increase indent Ctrl+] → Ctrl+M (Ctrl+] / Ctrl+[ are Grow / Shrink Font); F12 is Save As (DevTools is Ctrl+Shift+I only). Ctrl+1…4 still switch modes.
- New commands: `edit.repeat` (F4), `edit.goTo` (Ctrl+G), `format.clearParagraph` (Ctrl+Q), `layout.lineSpacing15` (Ctrl+5), `para.promote|demote`
  (Alt+Shift+Left/Right), `para.moveUp|moveDown` (Alt+Shift+Up/Down), `view.ribbonOptions|ribbonTabsAndCommands|ribbonTabsOnly|ribbonFullScreen|ribbonDisplay|pinRibbon`,
  `view.formattingMarks` (Ctrl+Shift+8), `edit.case.titleCase`.
- `app.keytips = {start, stop, press, back, active, level, keys, assign}`: Alt alone or F10 shows letters (File F, tabs H N P S R W L X, JT/JL for the
  table tabs); letters come from `e.code`, so Urdu, Arabic and Persian keyboard layouts work.

### `app.writing` (writing)
- Languages: `registerLanguage({code, name, nativeName?, dir, aff?, dic?, rules?, font?, spellingMode?, lexicon?, clitics?})` (aff/dic may be undefined:
  rules and fonts only; `spellingMode: 'near-miss'` with `lexicon` ({fields, rows} or a function returning a Promise of it) and `clitics` {prefix, suffix}),
  `unregisterLanguage(code)`, `languages()`, `languageFor(doc)` (front matter `lang:`/`language:`, else setting `proofingLanguage`).
  Pack rules may use either shape: `{id, pattern, flags, replacement|replace, message, title?, explain|why, wrong, right, category, safe?}`;
  categories outside `correctness|clarity|engagement|delivery` map to correctness (punctuation, spelling, grammar, typography) or clarity (style).
- Checking: `check(doc|text, opts)`, `checkText(text, {lang, goals, longSentence, harper, spelling})` → findings
  `{id, rule, cat, start, end, text, title, message, replacements[], safe, wide?, source?}`; `explain(f)` → `{text, wrong, right}`.
- Actions: `accept(finding, replacement, doc)`, `acceptAllSafe`, `dismiss`, `ignoreRule`, `ignoreWord`, `addToDictionary`, `dictionary.{list, add, remove, set, has}`.
  Every fix goes through `doc.setText(…, 'writing')` or the editor's `execCommand('insertText')`, so Undo works in every mode.
- Also `suggest`, `isWordCorrect`, `fixesFor`, `synonyms` / `synonymsSync`, `lemmas`, `loadThesaurus`, `thesaurusLicense`, `pane.{open, close, view}`,
  `openThesaurus`, `synonymsPopup`, `editorReview`, `goalsDialog`, `autocomplete.{complete, visible, hide}`, `state(doc)`, `painted`, `repaint`,
  `applySpellcheckAttr`, `statusText`, `engine.{harper, worker, warm, last}`, `rulesEngine`.
- Commands: `review.spelling` (F7), `review.spellingAsYouType`, `review.writingAssistant`, `review.thesaurus` (Shift+F7), `writing.toggle`, `writing.goals`,
  `writing.acceptAll`, `writing.nextIssue` (Alt+F7), `writing.prevIssue` (Alt+Shift+F7), `writing.setLanguage {value}`, `writing.dictionary`,
  `writing.synonyms`, `writing.autocomplete`. `research.js` no longer has its own spelling: `applySpell` and `app.research.spelling.status` delegate here.
- Word completion: ghost text is driven by capture-phase `input` / `keydown` listeners on `#editorHost` (Word, Inline and Simple); Tab or → accepts,
  Esc hides. `app.typing.onKey(fn(e, ctx))` / `app.typing.onInput(fn(ctx))` exist for other typing add-ons; `ctx = {mode, adapter, element, inTable, inputType, data}`.

### `mk.spell` (preload)
`normalize, languages, has, load, register(code, aff, dic), check(code, words[]) → bad indexes, correct, suggest, setPersonal(words), words(code)`:
nspell with `dictionary-en` and `dictionary-en-gb`, loaded on first use (UK accepts Oxford -ize). The round 2 `misspelled` / `suggestions` remain.

### `app.lang` (languages)
`languages, info, nameOf, isRtlLang, firstStrongDir, scriptOf, docLang, docDir, setBlockDir, wrapAutoDirection, applyBlocks, exportCss,
setDocLanguage, setDocDirection, pickLanguage(anchor), currentDir, setParagraphDir, openOptions, packs:{list, installed, install, remove, index, registerAll},
fonts:{defaults, fontFor, load}`. Commands `para.ltr`, `para.rtl`, `lang.pick`, `lang.setDocLanguage {value}`, `lang.docDirection {value}`, `lang.options`,
`lang.installFromFile`. Options section `language` (order 25). Installed packs register with `app.writing.registerLanguage` on `ready`.
Rendering: leaf blocks get `dir="auto"` and `data-mk-script="ur|ar|fa"` for Arabic script; containers are measured in JS; the page root gets `dir`, `lang`
and `--mk-base-font`. Exports: Pandoc formats get `dir: rtl` and `::: {dir=…}` divs (markdown transform); HTML/PDF/print get RTL CSS and the font as a data URI.

### `app.tables` (tables)
`find, parse, serialize, cellAt, cellRange, apply(text, line, op, args), fromText, make, escapeCell, unescapeCell, run, locate, commit, sourceTab,
contextMenu, insertPicker, insert, styles, style(doc), setStyle, inTable, refresh`. Ops: `rowAbove, rowBelow, colLeft, colRight, deleteRow, deleteCol,
deleteTable, align, header, sort, setCell, clear, format, distribute, toText`. Word and Inline adapters add `inTable, tableAt, applyTableEdit` (one undo step),
`selectTableCells, selectionLines` (Inline also `openTableCell, tableCell`; `openBlock` reports an open cell). Commands `insert.table` and `table.*`.
Every operation edits the Markdown source, so the rest of the document stays byte-identical; output is always valid GFM.

### `app.goals` and developer additions
- `app.goals = {progress, streak, today, dailyGoal, docTarget, wordsOf, ring, setDailyGoal, measureNow, startSprint, stopSprint, sprint, celebrate,
  lastCelebration, setTypewriter, typewriter, openPanel, paint, centerCaret}`. Commands `goals.open`, `goals.dailyGoal`, `goals.sprint {minutes}`,
  `goals.sprint15|25|45`, `goals.stopSprint`, `view.typewriter`. Words are counted per day (net, 700 ms debounce); opening, recovery, front matter edits,
  jumps over 1,500 words and `test*` origins are not counted.
- Math macros: `parseMathDetailed(src)` → `{macros, errors:[{line,text,message}], notes:[{line,kind,message,from,to}], defs}`; accepts `\newcommand`,
  `\renewcommand`, `\providecommand`, `\DeclareRobustCommand`, `\def`, `\gdef`, `\edef`, `\xdef`, `\let`, `\DeclareMathOperator(*)`, `[n]` and `[n][default]`,
  several per line, `%` comments and continued lines. Text after a definition (`\newcommand{\R}{\mathbb{R}}$\R$`) is a note with "Remove the extra text",
  not an error. `app.developer.openMathDialog({scope, panel:'preview'|'examples'})` → sheet with `code, preview, gallery, scope, setScope, setPanel, save, addExample, details`.
- Recorder: `body.mk-recording`, status pill `.mkd-rec`, event `recorder:changed {active}`; recorded Python writes `await run("…")`.

### `app.health` (platform)
`{check, last, describe, summary, showDetails, notify, refreshFormats}`; command `help.checkTools`. It calls `app.exporter.refreshFormats()` (new) to drop
the 30 s Save As format cache.

### Layout and font size
One body size per document: front matter `fontsize: 14pt`, written only when it differs from the setting `fontSize` ("Default text size").
`app.layout.fontSize(doc)`, `app.layout.setFontSize(pt, doc)`, `app.layout.fontSteps` (Word's steps 8 … 36). Exports: Pandoc formats get `fontsize:` in the
front matter (LaTeX); the `export` IPC gets `layout.fontSize` in points, which main writes into DOCX (`w:docDefaults` and the body styles, `w:sz` = pt × 2;
the html-to-docx fallback too) and ODT (the default paragraph style's `fo:font-size`).

### IPC (main)
| Channel | Args | Returns |
|---|---|---|
| `tools-health` | `{refresh}` | `{ok, missing[], notBundled[], tools:{pandoc,pdf2djvu,ddjvu:{ok,path,bundled,version,error}}, fix, bundleExpected, toolsDir, portable, checkedAt}` |
| `langpack-index` | – | `{updated, format, packs:[{code, name, nativeName, region, dir, version, format, file, url, size, sha256, spelling, spellingMode, license, font, words, checked}], source}` (GitHub hosts only; the download address is always the `packs` release + file name) |
| `langpack-install` | `{url}` or `{file}` or `{data(base64)}`, optional `sha256` | `{code, dir, …}`; zip-slip, per-file SHA-256 and size checks; nothing is written unless every check passes |
| `langpack-list`, `langpack-remove(code)`, `langpack-files(code)`, `langpack-local-dir` | | installed list (adds format, spellingMode, words, checked, region, lexicon, roman); –; `{manifest, aff, dic, rules, spellingMode, clitics}`; the packs checkout's `dist/` (development copies) or null |
| `langpack-lexicon(code)`, `langpack-roman(code)` | | `{fields, rows}` or null (loaded on demand; `app.lang.lexicon(code)`, `app.lang.roman(code)`) |
| `portable-probe`, `tools-simulate-gone` | | smoke mode only |

`app-info` adds `name, author, license, copyright, homepage, bugs, repository, arch, versions, resourcesDir, licenseFile, noticesFile, licensesDir, portable,
userDataFrom, portableInfo`. Event from main: `tools-health` (with `reason`, `failedTool`). A spawn failure of a bundled tool throws `code: 'TOOL_GONE'`.
Main process errors: an uncaught exception while starting shows one plain message (no stack trace) and quits; in smoke mode it goes to stderr with exit
code 3, and an output folder that cannot be created exits with code 2. `unhandledRejection` is only logged.

### Events added
`ribbon:display`, `ribbon:contextual`, `ribbon:reveal`, `keytips:level`, `writing:changed`, `writing:status`, `writing:engine`, `writing:card`, `writing:pane`,
`writing:accepted`, `writing:languages`, `spelling:changed {count}` (kept), `lang:packs`, `table:changed`, `recorder:changed`, `goals:sprint`, `goals:reached`,
`tools:health`.

### Markdown syntax added
- Paragraph direction: Pandoc fenced div `::: {dir="rtl"}` … `:::` (or `{dir="ltr"}`); inside an existing div the attribute goes on that div. Document:
  front matter `lang:` (en-US, en-GB, ur, ar, fa, he …) and `dir: rtl|ltr` (an RTL `lang` without `dir:` is drawn right to left).
- Front matter `fontsize: Npt` (one body size per document) and `table-style:` (Plain, Grid, Banded rows, Academic, Accent; screen, print and HTML/PDF only).
- Tables: Shift+Enter in a cell writes `<br>`; a typed `|` is escaped; Header Row off keeps an empty header row (hidden in Read mode, print and HTML/PDF).

### Settings keys added
`ribbonDisplay`, `showFormattingMarks`, `writingAssistant` (true), `proofingLanguage` ('en-US'), `writingLongSentence` (30), `writingGoals` ({audience,
formality, domain}), `writingCategories`, `writingIgnoredRules`, `writingDictionary`, `writingAutocomplete` (false), `writingSynonymsOnDoubleClick` (true),
`rtlFonts` ({ur, ar, fa}), `tableGridlines` (true), `tableLastRows`, `tableLastCols`, `tableTextSep`, `tableTextHeader`, `mathMacrosHelp`, `dailyWordGoal`,
`writingLog`, `writingMet`, `goalsCelebrate`, `goalsCelebrated`, `goalsStatus`, `sprintLog`, `sprintMinutes`, `typewriter`.

### Packaging and release
- `package.json` `build.files` adds `main-langpacks.js`, `data/**`, `fonts/**`, `docs/help/**` (`licenses/**` comes through `extraResources`, see Round 3 review fixes); it excludes Harper's `*Inlined.js`, `slimBinary.js`
  and `harper_wasm_slim_bg.wasm` (the worker imports the full `binary.js`), `@fontsource/**` (copies live in `fonts/`), `wordnet-db/**` (the app reads
  `data/thesaurus-en.json`) and `private/**`.
- Windows targets: NSIS installer `Markooj-<v>-win-x64-setup.exe` and portable zip `Markooj-<v>-win-x64-portable.zip` (with `portable.txt`, settings live in
  `<exe dir>/data`). userData precedence: `--smoke`, then `MARKOOJ_USER_DATA`, then portable.
- `THIRD_PARTY_NOTICES.md` and `licenses/` (generated by `scripts/fetch-tools.js --notices`) cover Harper, nspell, the SCOWL dictionaries, Lilak, WordNet,
  write-good, the three OFL fonts and Electron/Chromium. Language packs carry their own licenses inside the zip.
- Build only from a quiet tree or a snapshot copy: electron-builder writes a corrupt asar if files change while it packs.

### Smoke additions
Screenshots added: `writing-assistant, synonyms, writing-review-tab, writing-options, rtl, rtl-simple, rtl-read, options-language, table-word, table-picker,
table-design, table-inline, ribbon-tabs-only, ribbon-full-screen, change-case, keytips, options-keyboard, dimmed-tip, math-macros, math-macros-examples,
macro-recording, goals, goals-celebration, tools-health`. Test prefixes: `writing:`, `lang:`, `tables:`, `shell:`, `keys:`, `keytips:`, `developer:`, `goals:`,
`health:`, and `round3:` (integration seams: language-pack rules in the Writing Assistant, Word keys, contextual tabs, status bar language).

### Round 3 integration fixes (integrator)
- Writing ↔ languages: pack rules written as `replace`/`why` (and categories such as `punctuation`) now give fixes, a Why? text and a valid category.
  Spelling skips words in another script than the proofing language (`app.writing.scriptOfWord`, `scriptOfLang`), so Urdu, Arabic and Persian words in an
  English document are no longer marked as misspelled. Options → Writing and Options → Language show the same `proofingLanguage` and stay in step.
- Word mode: a paragraph made with Enter no longer inherits the `data-line` of the paragraph it was split from (paragraph commands used to act on the
  wrong paragraph); `refresh()` keeps the caret also while a ribbon control has the focus. Change Case (shell) now reaches the Markdown (it dispatches an
  `input` event) and keeps the changed text selected.
- Word completion: the ghost text hides when the setting is turned off, and accepting a word does not chain a second suggestion.
- Shell: a document shown for the first time starts at the top; `#sbLang` / `#sbSpell` call `app.lang` / the Writing Assistant directly.
- Main: F12 is Save As only (DevTools: Ctrl+Shift+I); DOCX/ODT exports get the document's body size; startup errors per item 46.
- `goals.js` declared `sprint` after the status item first rendered (ReferenceError at start); `editor-inline.js` and `editor-source.js` guard work queued
  before an unmount.
- Packaging: `harper.js/dist/slimBinary.js` and `harper_wasm_slim_bg.wasm` are excluded; the thesaurus points at `licenses/wordnet-LICENSE.txt`.

## Round 3 help, tutorials, public material and license (2026-11-22, PLAN-v3 items 38, 42–45, 47)

### New files and owners

| File | Owner | Purpose |
|---|---|---|
| `src/help.js`, `src/help.css` | **help & tutorials** | `app.help`: Help ribbon tab, File → Help page with About, About Markooj dialog with credits, offline reference manual viewer, Keyboard Shortcuts, What's New, Report a Problem, Project Page |
| `src/tours.js`, `src/tours.css` | **help & tutorials** | `app.tours`: guided tours (spotlight, steps, "Do it for me"), 14 tutorials, first-launch offer |
| `docs/help/*.md` (22 pages), `docs/ADDINS.md`, `docs/BUILDING.md`, `docs/RELEASING.md`, `docs/downloads/README.md` | **docs** | Reference manual shown in the app (F1) and on GitHub; developer and release guides |
| `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `ROADMAP.md`, `SECURITY.md` | **docs** | Public repository files. CHANGELOG's format is what What's New parses (`## [x.y.z] - date`, an empty `[Unreleased]` is skipped) |
| `scripts/make-store-images.js`, `samples/`, `marketing/`, `docs/images/` | **images** | `npm run images`: drives the real app with a throwaway profile and writes the store images, social preview, banner and docs screenshots |
| `private/` (git-ignored, never packaged) | **docs** | Listing texts, upload steps and notes for the maintainer only |

Script order in `src/index.html`: `… writing/tests.js, help.js, tours.js, integration.js, app.js`. CSS after `writing.css`: `help.css, tours.css`.

### `app.help`
`{open, close, show, pages, load, manual, search, checkLinks, viewFile, viewLicense, viewNotices, about, aboutCard, aboutFacts, creditsBox, credits,
creditVersion, shortcuts, shortcutsHtml, shortcutRows, whatsNew, latestChanges, reportProblem, projectPage, tutorials, tutorialsList, info, versionText,
viewer, links}`. The manual is built from `docs/help/index.md` (its `##` headings are the sidebar sections; pages are found by following links), drawn with
`mk.render` without document hooks. Facts for About come from the `app-info` IPC (version, author, `license`, `copyright`, homepage, license and notices
files). Events `help:opened`, `help:page`, `help:closed`. Icons are `<symbol id="mkh-i-*">` in `svg#mkh-icons`.
- Ribbon tab `help` (order 85, KeyTip Y): Help (F1), Tutorials, Shortcuts · What's New · Report a Problem, Project Page, Check Tools · About.
- Backstage page `help` (order 95): six cards, the About Markooj section (version, "Made by Ahmed Bilal", "Copyright © 2026 Ahmed Bilal and
  contributors.", the AGPL v3 line with View license, Credits and Licenses, Third-Party Notices, Copy Version Info) and the tutorials list.
- Commands `help.manual {page, hash, query}` (F1 through `app.keys`), `help.tutorials`, `help.shortcuts {query}`, `help.whatsNew`, `help.reportProblem`,
  `help.projectPage`, `help.about`. `app.shortcuts` (Ctrl+/, View → Commands → Shortcuts) now runs `help.shortcuts`, so there is one shortcuts dialog.

### `app.tours`
`{register, list, get, start(id, {auto, delay, doc}) → report, stop, next, back, active, isDone, markDone, resetDone, tutorialText}`. Tours: getting-started,
modes, macro, python, js-macro, equations, crossref, tables, writing, rtl, export, recover, ribbon, keys; each also has a command `tour.<camelId>`
("Tutorial: …", found with Alt+Q) and a section with the same title in `docs/help/tutorials.md` (smoke-tested both ways). Hidden `help.stopTour`.
A tour runs in a scratch "Tutorial document" and puts back the mode, ribbon tab and display, File view and Writing Assistant pane when it ends.
Settings `toursDone` (`toursOffered` is gone in 1.1.1: the Welcome screen replaced the first-launch toast). Events `tour:started`, `tour:step`,
`tour:ended`, `tours:changed`.

### License (item 47)
Markooj is `AGPL-3.0-or-later`: `LICENSE` is the full AGPL v3 text (same file as Sungfluence), shipped as `LICENSE.txt`; `package.json` `license` says so,
and `app-info` reports it. `build.copyright` is "Copyright © 2026 Ahmed Bilal and contributors"; main falls back to the same line when the packaged
package.json has no `build` field. `THIRD_PARTY_NOTICES.md` (generated by `scripts/fetch-tools.js --notices`) states the license and the compatibility
of every bundled part: Pandoc, DjVuLibre (GPL-2.0-or-later) and pdf2djvu (GPL-2.0-only) are separate programs run as tools, never linked.

### Packaging
`build.files` adds `CHANGELOG.md` (What's New reads it). `LICENSE`, `licenses/` and `THIRD_PARTY_NOTICES.md` ship only in `resources/`
(`extraResources`; electron-builder leaves every extraResources source out of `app.asar`), and the app reads them through the `app-info` paths
(`licenseFile`, `noticesFile`, `licensesDir`). `docs/help/**` was already listed. `docs/images/`, `marketing/` and `private/` are never packaged; of `samples/` only `samples/sediment-transport/**` ships (1.1.1, Welcome → Open a sample document).

### Integration fixes (integrator 2)
- `app.version` is read from `app-info` at boot (Options footer showed 0.2.0). Smoke timeout in main is 420 s.
- Outline: Pandoc attributes `{-}`, `{.unnumbered}` and `{#id}` at the end of a heading are not shown as text. The Document card counts narrative
  citations (`@key`) when the front matter names a `bibliography:`.
- `mk.parseBib` decodes LaTeX accents and symbols (`{\"u}` → ü, `\'{e}` → é, `{\ss}` → ß, `--` → –) and allows two levels of braces.
- Writing Assistant: Harper findings on a word in the personal dictionary (or ignored for the session) are hidden; the "unneeded word" fix at a
  sentence start covers the whole next word ("Basically the" → "The").
- Goals: the saved `writingLog` / `writingMet` are merged in again after settings load (the streak looked empty after a restart and the next save
  erased the history), and follow outside changes to those settings.
- Citation style menu says "APA" (the bundled `csl/apa.csl` is the 6th edition); `layout.columns` ScreenTip says one or two columns.
- Smoke tests `round3: Help tab, F1, Ctrl+/ and the manual’s tutorials page agree with the app` and `round3: routed fixes (…)`.

## Round 3 review fixes (2026-11-22)

Fixes for the round 3 review findings. Smoke tests: `src/review3-tests.js` (`review3: …`, loaded right before `integration.js`) plus the updated
tests named below.

### Shell, Help and keys
- Ribbon: `renderRibbon` no longer overwrites the wanted tab while Home has no groups yet (first paint before `commands.js` loads). The wanted tab
  (`settings.ribbonTab`, default **Home**) is kept apart and selected as soon as it has groups; `applySettings` uses `settings.get('ribbonTab') || 'home'`.
  `app.shell.bootTab()` → `{saved, tab}` records what boot showed (test: a fresh profile opens on Home).
- AltGr: on Windows AltGr arrives as Ctrl+Alt with `getModifierState('AltGraph')`. Both shortcut layers (shell's global keydown and
  `app.editor.dispatchShortcut`) now let a printable AltGr character through (`app.editor.isAltGrChar(e)`), like Word: German ² ³ µ and the backslash
  are typed, not Heading 2/3, Comment or Zoom out.
- About: license links (View license, View Notices, each credit's license) close the About dialog first, so the license viewer is never hidden behind it
  (`.dlg` z-index 81 > `.mkh-viewer` 75). The About card adds the AGPL "Appropriate Legal Notices" line: "Markooj comes with ABSOLUTELY NO WARRANTY. You
  may share and change it under the terms of this license." The credits list no longer scrolls inside the scrolling dialog.
- Help viewer: F1 / Help with no page reopens the last manual page but never a license or notices page (`about:` keys open Help home). The viewer bar has
  a Tutorials button, and the Tutorials page gets a **Start this tutorial** button under every heading that names a tour.
- `word-keys.js` NOTES ("Word keys that work differently here", `app.keys.notes()` and `docs/help/keyboard-shortcuts.md`): + Ctrl+Shift+C (citation;
  Format Painter for formatting), Ctrl+Shift+E, Ctrl+Alt+C, Ctrl+Alt+R, Ctrl+Alt+P, Ctrl+Shift+P; the Ctrl+K row (works like Word) is gone.
- Tables: Enter in a cell starts a new line in the cell (`<br>`), like Word, in Word and Inline modes; Down in the last row leaves the table. Left/Right at
  a cell edge follow the cell's direction (mirrored in right-to-left tables, Word mode) and the line's first strong letter (Inline blocks and cells).

### Right-to-left text
- `lang.js` `markScript` looks for a `lang` only up to the page (`blockLang`), so the app's `<html lang="en">` no longer overrides `lang: ur|ar|fa`
  (every block of an Urdu document gets `data-mk-script="ur"`, pages and exports).
- `markDir`: a block with no letters (a number, a picture, math) takes the page direction (no `dir`); `dir="auto"` only on blocks with letters
  (Chromium resolves `dir=auto` with no strong letter to ltr). `firstStrongDir` ignores a picture's alt text. Leaf blocks now carry `data-mk-autodir` too.
- `styles.css`: the "H1 after a title block" rule is `.mk-page h1:where(header.mk-front ~ h1)` (weight of `.mk-page h1`), so the script fonts of
  `lang.css` win (Urdu H1 in Nastaliq).
- Inline mode: the block being edited keeps its script font (`app.lang.markScript(el, doc)` on open; the lang input handler also marks `.mk-il-edit`).
- `setBlockDir` on a callout: going back to the natural direction removes the `dir` attribute again (`{.note}` → `note`).
- Exports (main): `rtlInfo(meta, M)` → `{rtl, lang, script, font, fontFile, locale}`. EPUB (Pandoc) of an rtl document: the body is wrapped in one
  `{dir="rtl"}` div, `page-progression-direction=rtl`, a stylesheet (Pandoc's own `epub.css` + `body{direction:rtl}` + the script font) and the bundled
  font embedded (`--epub-embed-font`, copied out of the asar). DOCX: `patchDocxRtl` adds `<w:bidi/>` to the Title/Subtitle/Author/Date/Abstract styles,
  `<w:bidiVisual/>` to tables whose text starts right to left, `w:lang w:bidi` = the document locale (ur-PK, fa-IR, ar-SA …) and `w:rFonts w:cs` = the
  script font. The export toast says Word uses that font when it is installed. Smoke-only IPC `smoke-zip-text (file, entry|regex|null)` reads an entry
  of an exported zip (null lists the names).

### Writing Assistant
- Start: `applyDictionary()` runs again on `ready` (the personal dictionary is in settings, which load after `writing.js`), and other open documents are
  checked again. Before, saved words were marked wrong after every restart.
- Worker: the Harper lint config is set again after every `setDialect` (harper.js builds a new inner linter with default rules on a dialect switch).
  Harper messages show “x” instead of backticks; `OrthographicConsistency` is skipped on tokens with digits or next to `/` (m3/s, CO2).
- `R.HARPER_OFF` + `PassedPast`, `ThereToTheir`, `MergeWords` (false alarms on "The test passed.", "I went there.") and `VeryUnique` (Markooj's
  absolute-adjective rule gives the better fix). `W.explain` hides placeholder Harper descriptions ("A collection of linters…") and shows an example only
  for its own rule: `R.HARPER_EXAMPLES[rule]`, or the kind's example when `R.HARPER_KIND_RULE[kind]` is that rule (checked against harper.js 3.2.0).
- Rules (`rules.js`): `its` only before words that cannot follow a possessive (a/an/the/been/going/getting/becoming, or "clear/likely/… that|to"), plus
  "lost it’s accuracy"; never `safe`. `articleFor`: a capital before a hyphen is a letter name (an X-ray, an F-test, a U-turn), "a URL"; article fixes on
  abbreviations are not safe. Wordy "the majority of the …" → "most of the …"; "in terms of the" removed; "made a decision on" → "decided on";
  "provide assistance with" keeps "with". `capableTo` → "capable of lifting" (`R.conj`); `explainMe` is message-only. New rule cards `usage` (learner
  and South Asian English: reach to, do the needful, revert/at the earliest, have a doubt, Myself X, request you to please, your welcome, between you
  and I, who’s book, less people, Me and him went, I seen, there going to, irregardless) and `agreement` (plural subject + -s verb: "the results shows").
  US/UK: math/maths, license/licence, practice/practise (the verb forms are not flagged in UK documents). `R.IRREG` (about 90 irregular verbs) and
  doubled final consonants in `R.conj`.
- `prose()` also masks raw LaTeX commands (`\ref{…}`, `\cite[…]{…}`), emoji shortcodes (`:tada:`) and wikilink targets (`[[Page|label]]`).
- Words: U+200C/U+200D inside a word stay part of it (Persian کتاب‌ها is one word, for spelling and counts). `spellTokens` skips "et al.", ibid, viz,
  cf … and prefixes before a hyphen (pre-, intra-, …).
- Language-pack rules: the fix is worked out on the whole block at the match (sticky regex), so lookbehind/lookahead see the context; a fix that
  changes nothing is dropped; `replace` may be a list (several fixes, `safe` only with one).
- `W.suggest`: a short list of common slips (teh → the, thier → their, Wensday → Wednesday …), then swapped neighboring letters found in the
  dictionary, then nspell's own list.
- Synonyms: `W.lemmas` knows irregular forms (went → go, children → child, better → good); `W.synonymsSync(word, {before})` re-inflects every choice to the
  form of the word (shows → presents, went → moved, happier → brighter), ranks the likely part of speech first (from the form, an adjective list, or the
  word before: "the shows" noun, "the data shows" verb), drops spellings of the other variety of English and comparatives of a plain adjective.
  `W.inflectLike(choice, word)`. Right-click, double-click and the overused-word card pass the text before the word.
- Word completion: the lexicon is sorted by its lower-case key (the search was invalid before), a list of common English words ranks first, names are
  not offered for a lower-case start, document words come from the prose only and skip misspellings, no completion inside code, math or front matter
  in Simple and Inline modes (`app.writing.autocomplete.inNonProse(text, at)`), and the ghost text is drawn right to left with ← accepting in Urdu,
  Arabic and Persian words.
- Tests: the 20,000-word test warms up on part of the same text and scales its limits by a measured machine-load factor (shown in the message); the
  e2e PDF test waits for the drawn page (up to 15 s) like the DjVu test.

### Language packs
- Round 4: the in-app builder (`scripts/make-langpacks.js`, `language-packs/`) is gone. Packs (ur, ar, pnb, fa 2.0.0, zip format 2) are built from
  TSV sources in `datakeen/markooj-language-packs` (`tools/build.js`; word lists and rules CC-BY-SA-4.0, the Persian word list Apache-2.0).
  Format 2 adds `lexicon.json`, `roman.json` (`{map: {roman: [letters]}}`, handed to the page as `{fields, rows}`), `clitics`, `spelling.mode`
  (`near-miss` | `full`) and `counts` (`{words, checked, rules}`; `stats` is accepted too). Near-miss spelling (`R.nm*` in `src/writing/rules.js`)
  ignores harakat (not the madda of آ), tatweel and ZWNJ, and treats ݨ/ن and ݪ/ل as the same letter.
  `langpack-local-dir` finds `../<markooj-language-packs checkout>/dist` (or `$MARKOOJ_PACKS_DIST`) in a development copy; the smoke tests then
  install the real ur, ar, pnb and fa zips (rules fix their own examples; near-miss flags a typo and passes 30 listed words).
- `main-langpacks.js`: a 404 on the index says "No language packs are published on GitHub yet. You can install one from a file."; packs with an English
  code (en, en-*) are refused at install and ignored when listed. `app.writing.registerLanguage` never changes a built-in language.

### Release material
- `THIRD_PARTY_NOTICES.md` (from `fetch-tools.js --notices`): elkjs (compiled into `mermaid.min.js`) is used under its GPL-3.0-or-later option
  (AGPL v3 section 13); the compatibility paragraph says so, and `licenses/GPL-3.0.txt` (taken from JSZip's license file) ships. The maintainer note is
  gone from the public notices (the step is in `docs/RELEASING.md`). The DjVuLibre entry explains that package 3.5.30-2 prints 3.5.29; Check Tools
  shows "3.5.29 (package 3.5.30)".
- `scripts/make-store-images.js`: `settle()` waits until the Writing Assistant's status bar no longer says "Checking…".

## Round 4 additions (2026-11-22, PLAN-v4 items 58 and 59)

### New files and owners

| File | Owner | Purpose |
|---|---|---|
| `main-addins.js` | **store** | Add-in store IPC (required from main.js after main-langpacks.js; listed in package.json `build.files`) |
| `src/addin-store.js`, `src/addin-store.css` | **store** | `app.addinStore`: File → Add-ins tabs Installed / Browse / Language packs, the Store ribbon group, palette commands, the daily quiet update check, smoke tests |

Script order in `src/index.html`: `… tours.js, addin-store.js, review3-tests.js, integration.js, app.js`; `addin-store.css` after `tours.css`.

### Add-in store

- The registry `datakeen/markooj-addins` publishes `index.json` as an asset of its release `index`
  (`https://github.com/datakeen/markooj-addins/releases/download/index/index.json`):
  `{format:1, updated, addins:[{id, name, author, description, repo, category, tags, verified, version, minMarkooj, tag,
  assets:[{name, url, size, sha256}], readmeUrl, homepage, updatedAt, icon?, color?, authorUrl?, permissions?}]}`.
  The app rebuilds every asset URL as `https://github.com/<repo>/releases/download/<tag>/<name>` (other URLs are dropped),
  works out `verified` itself (repo owner `datakeen`), and treats `format` > 1 as "needs a newer Markooj".
- Limits, the same in the registry checks (`markooj-addins/tools/lib.js` LIMITS) and the app: manifest 64 KB, main.js 2 MB,
  styles.css 2 MB, everything 50 MB, at most 50 data files. File names `^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$`, no trailing dot,
  no Windows device names, never manifest.json / main.js / styles.css / .install.json. Release tags have no spaces or slashes.
- Installed store add-ins: `<userData>/addons/<id>/` (portable: `data/addons/<id>/`) with manifest.json, main.js, styles.css,
  data files and `.install.json` `{source:'store', id, version, repo, tag, verified, sha256s, installedAt}`. A folder with a
  manifest but no `.install.json` is a local folder add-in (for authors testing): it runs without the community switch, and
  the store never installs over it. Single-file `.js` add-ins keep working; a folder wins over a file with the same id.
- Runtime shape: `new Function('app', 'markooj', 'addin', code)`; `addin = {id, version, dir, name, file(name, {encoding})}`
  (`file` only for folder add-ins, only for names listed in `manifest.files`). The registry and the template's
  `tools/check.js` compile main.js with the same three parameters. styles.css goes into `<style data-mk-addin="<id>">`
  while the add-in is on.
- IPC: `addins-index({refresh})`, `addins-readme({id} | url)` (raw.githubusercontent.com only, ≤ 512 KB), `addins-install({id})`,
  `addins-uninstall(id)` (store folders only; trash, else `<userData>/addons-removed/`), `addins-installed()`,
  `addins-update-all()`, `addins-folder-list()`, `addins-file(id, name, opts)`; smoke only: `addins-test-mock(o)`,
  `addins-test-template()` (the sample add-in of a sibling `markooj-addin-template` checkout as a registry-style release).
- Settings: `addins.community` (default false; store add-ins never run while it is off), `addins.lastCheck`.
  Events: `addins:updates` (count), `addins:community` (bool).
- `app.addinStore` = {renderPage, open, selectTab, install, uninstall, updateAll, checkUpdates, loadIndex, refreshInstalled,
  showDetails, filterAddins, compareVersions, shouldCheck, categories, state, updates}. New `app.addons` members: rescan,
  renderInstalled, renderPage, needsReload, community {isOn, enable, disable}, styles {inject, remove, element}, colorFor,
  verifiedBadge.
- Palette commands: `addins.browse`, `addins.checkUpdates`, `addins.updateAll`, `addins.languagePacks`.
- Removal helpers (integrator): `app.options.removeSection(id)`, `app.status.removeItem(id)`, `app.exporter.unregister(id)`,
  next to the existing `app.commands.unregister(id)` and `app.ribbon.removeGroup(tab, id)`.

### Language packs: full spelling from a word list

- `spelling.mode: "full"` with `lexicon.json` (format 2) means full spelling from the word list (`src/writing/rules.js`
  `R.fsBuild`, `fsSuggest`, `fsIndex`, `fsRank`, `nmFlag`); "full" without a lexicon still uses nspell (Persian).
  Ranking: log(count) plus a bonus for similar-letter swaps from `similar.json`.
- New IPC: `langpack-wordlist(code)` → `{list: 'w\nw…', freq, count, words}`; `langpack-phrases(code)` (not used yet).
  `langpack-files` adds `lexicon`, `similar`, `phrases`, `sources`; `langpack-list` and `langpack-index` entries add
  `sources`, `sourceWords`, `similar`, `phrases`.
- Packs `index.json` entries carry `credits`, `sources` (`[{what, license, url, credit?}]`) and `sourceWords`.
- `registerLanguage` takes spellingMode `'full'` with a lexicon, plus `similar`; `app.writing.nearMiss.mode(code)`;
  spelling findings from a full pack carry `fullSpelling: true`. The worker `nearmiss` message has a
  `{mode:'full', list, rank, similar}` form.

### Smoke additions

- Store: search/filter/version logic; a mocked-registry install flow; the community switch, ribbon, palette and Language
  packs tab; the real template add-in (installed from a registry-style list, command and exporter run, uninstalled).
  Screenshots `addin-store`, `addin-details`, `addin-installed`.
- Languages: a full-spelling pack with counts, similar letters, phrases and credits; the real `ur` 2.1.0 pack from a sibling
  `markooj-language-packs/dist` in full mode (CLE credit, common words known, typos flagged with the right suggestion, speed).

## 1.1.1 additions (2026-11-22): solution-first messages, quiet tool checks, Welcome

The message rule (CONTRIBUTING.md → "Writing messages") applies to every toast, dialog, status line, error card and help
text about a problem: lead with what the user can do (a button that does it when possible), then what still works,
raw codes only under "Technical details". Optional tools never warn at start; help comes when the user tries the feature.

### New files and owners

| File | Owner | Purpose |
|---|---|---|
| `src/welcome.js`, `src/welcome.css` | **welcome** | `app.welcome`: Welcome sheet (8 feature cards with "Show me" tours), What's new after an update, status-bar chip, sample document |

Script order in `src/index.html`: `… writing/tests.js, help.js, tours.js, welcome.js, addin-store.js, review3-tests.js, integration.js, app.js`;
CSS `… help.css, tours.css, welcome.css, addin-store.css`.

### Tools check (main.js)
- `toolAnswered(id, {started, code, out})` → `{ok, version, usage, state: 'ok'|'blocked'|'failed'}` is the whole decision. A DjVuLibre
  program (ddjvu, djvutxt, djvused, djvm, c44) that started and printed its usage text counts as working whatever its exit code: the
  official SourceForge build for Windows prints no version for `ddjvu --help` and exits 1 (djvutxt/djvused exit 10). Markooj 1.1.0
  wrongly reported that build as missing.
- The startup check stays quiet. The only startup toast is for Pandoc, when it is broken and the user has exported with it 3+ times
  (setting `toolUse.pandoc`).
- `tools-health` adds per tool `state` ('ok'|'missing'|'failed'|'blocked'), `output` (failed), `remedy` `{text, steps:[{text, command?}], actions}`
  (missing); top level `version`, `downloadUrl`, `issuesUrl`; `fix` is the first missing tool's remedy text. `tools-simulate-gone` also
  returns `actions` and `details`.
- `read-file` for DjVu adds `missingTool: 'ddjvu'` when the tools are absent. `export-formats` entries add `needs` ('pandoc'|'pdf2djvu')
  and, when unavailable, a short `reason`.

### Errors from main carry buttons
- Main errors may carry `actions` `[{id, label, url?, text?, tool?, path?}]`, `details` and `code`. main.js wraps `ipcMain.handle`, so every
  channel (langpack and addin channels too) sends them after an invisible marker in the message; preload strips it, so the window still
  gets a plain Error (`e.code` set when main gave one).
- `mk.errorInfo(e)` → `{message, actions, details, code, tool}` or null. `mk.copyText(text)` (IPC `clipboard-write`).
- Action ids: `retry`, `save-as`, `choose-format`, `open-file`, `check-tools`, `open-url` (url), `copy` (text), `copy-details` (text),
  `report` (url), `tool` (tool: pandoc|pdf2djvu|ddjvu), `open-folder` (path).
- Codes: `TOOL_MISSING`, `TOOL_GONE`, `DJVU_FAILED`, `EXPORT_FAILED`, `OPEN_FAILED`, `NOT_MARKDOWN`, `NO_SAMPLE`, plus the fs codes.
- New IPC `sample-open(name)`: copies `<appRoot>/samples/<name>/` (inside the asar when packaged) to `<userData>/samples/<name>/` when that
  copy is missing and returns the `.md` path. Smoke only: `tools-verdict(id, probe)`, `tools-remedy-probe(id, {platform, packaged, portable})`,
  `errors-probe(codes[])`, `errors-probe-throw`.

### `app.health` (src/health.js)
`{check, last, describe, summary, showDetails, remedy(id, r?), offer(id, opts?), runAction(action, ctx?), errorActions(e, ctx?), toastError(e, opts?),
showError(e, opts?), markTried(id), noteUse(id), notify(r, ids?), refreshFormats, copy(text, okMsg?), detailsText(r?, id?), relevant(r)}`.
- `remedy()` → `{id, label, state, ok, title, text, fix, steps, works, actions, details}`. `offer(id)` is the "how to get it" dialog shown when a
  feature needs a tool (uses `app.ui.solution`; close button "Not now"). `ctx` for runAction/errorActions/toastError may give `retry, saveAs,
  chooseFormat, openFile, onChecked(result), tool, details`.
- Check Tools (command `help.checkTools`, label "Check Tools") is titled "Your tools are ready" or "Almost everything is ready".
- Settings `toolsTried` (string[]), `toolUse` ({pandoc: n}).

### Window helpers (src/shell.js; core.js has fallbacks)
- `app.ui.toast(msg, {kind, action|actions, details, detailsTitle, timeout})`: `details` adds a Details button; every call is logged in
  `app.ui.toastLog` `{msg, kind, actions, details, test, at}`. Error/warning toasts with buttons stay 10 s.
- `app.ui.fail(e, {lead, retry, actions, still, kind, details, hideReason, ctx})`: lead, then the error's plain text (or `friendlyError`), then
  `still`; code-like text under Details; Try again with `retry`. When `mk.errorInfo(e)` has an answer, main's message leads (no `lead` in front
  unless `hideReason`), its buttons come along through `app.health.errorActions(e, ctx)`, and its details go under Details.
- `app.ui.solution({title, lead, steps:[{os?, text, command?, link?}], still, details, actions, icon, kind, closeLabel})` → Promise<value>: steps for
  this system first (Copy button per command), other systems folded, then `still`, then Technical details.
- Also `showDetails, friendlyError, technicalText, copyText, reportProblem, isActionable(msg, {actions}), remedyVerbs, platformName`;
  `app.messages.audit(since)` → `{checked, bad[]}`.
- Save As: cards of unavailable formats stay clickable and call `app.exporter.export(id)`, which opens `app.health.offer(f.needs)`.
- Smoke rule (src/app.js): an error or warning toast must have a real button (not Details/Dismiss/OK/Close) or start a sentence with a remedy
  verb (`app.ui.remedyVerbs`); tests `messages: …` (in-app and end of run).

### `app.welcome` (src/welcome.js)
`{open('welcome'|'whatsnew', {markSeen}) → Promise<how>, close(how), isOpen, mode, startup(opts), decide({fresh, seen, version, showOnStart}),
compareVersions, cards, highlights, highlightsFor(v), sample: {available, open}, chip: {show(mode), hide, shown}}`.
- Fresh profile → Welcome; an update (or a 1.1.0 profile with no record) → What's new; never in smoke mode; it waits for an idle window and
  shows a status-bar chip (status item `welcome`) instead when a file was opened at start or the user is already working.
- Command `help.welcome` (Help tab group `help-news`, now labeled "Welcome"; File → Help card). Events `welcome:opened {mode}`,
  `welcome:closed {mode, how}`. Settings `welcome.seenVersion`, `welcome.showOnStart` (false). Sheet z-index 84, `data-mk-keys="own"`.
- Every release needs a `HIGHLIGHTS` entry for its version in src/welcome.js (a smoke test fails as the reminder).
- New tour `citations` ("Citations from a BibTeX library", command `tour.citations`).
- `scripts/make-store-images.js` writes `welcome.seenVersion` so What's new never covers the store screenshots.

## Round 5 additions (1.2.0)

PLAN-v5 items 60–82: optional Features and a smaller install, Split / Side by Side / New Window and the ruler, typing aids, writing
quality, tables with Office, numbering in tables, pictures from other editors, in-app keyboards and aarab, the livelier website.

### New files and owners

| File | Owner | Purpose |
|---|---|---|
| `main-features.js` | **install** | Optional Features in main: catalog, download list (manifest), download (SHA-256, progress, cancel), streaming safe unzip, install/remove, tool lookup bases, Pyodide over markooj://, first-run.json |
| `src/features.js`, `src/features.css` | **install** | `app.features`: File → Options → Features, progress card, Welcome step, first-run handling, commands, Help tab button |
| `scripts/make-features.js` | **install** | Deterministic feature zips and `markooj-features.json` (`--platform/--arch, --python, --embed, --nsh, --merge-dir, --sizes`) |
| `scripts/after-pack.js` | **install** | electron-builder `afterPack`: removes `dxcompiler.dll` / `dxil.dll` on Windows (`MARKOOJ_KEEP_DXC=1` keeps them) |
| `build/installer.nsh` | **install** | NSIS include: language page, features page, silent options, writes first-run.json, removes features on full uninstall (UTF-8 with BOM) |
| `build/portable-zip.js` | **install** | Puts portable.txt, `resources/vendor` and `resources/pyodide` into the Windows portable zip (the full offline copy); fails under `CI=true` when vendor/win32 is missing |
| `main-windows.js` | **windows** | Second and later windows and the IPC that links documents between windows; `require('./main-windows')(ctx)` |
| `src/windows.js` | **windows** | `app.windows`: linked documents, New Window, Open in New Window, Arrange All, Switch Windows, next/previous window |
| `src/split-view.js`, `src/split-view.css` | **windows** | `app.split`: Split, View Side by Side, Synchronous Scrolling, View → Window group, Options section `window` |
| `src/ruler.js`, `src/ruler.css` | **windows** | `app.ruler`: canvas rulers and guides |
| `src/typing-aids.js`, `src/typing-aids.css` | **typing** | `app.typingAids`: auto-pairing, slash commands, Ctrl+A scoping, Paste as plain text, Options switches |
| `src/dates.js`, `src/dates.css` | **typing** | `app.dates`: Date & time dialog, formats, Hijri dates, date/time commands |
| `src/multicursor.js` | **typing** | `app.multicursor`: several cursors in Simple mode's textarea |
| `src/keyboards.js`, `src/keyboards.css` | **rtl** | `app.keyboards`: Urdu Phonetic (CRULP v1.1), Arabic 101, Persian Standard (ISIRI 9147), Punjabi Shahmukhi; status chip, on-screen keyboard, View → Keyboard |
| `src/aarab.js` | **rtl** | `app.aarab`: remove/add aarab, Hide Aarab view, aarab from the word list, Home → Aarab group |
| `src/pictures.js`, `src/pictures.css` | **tables** | `app.pictures`: picture paths from other editors, missing-picture card, Find Missing Pictures, picture paths for exports |
| `data/words-technical-en.txt`, `data/places-en.txt`, `data/words-rank-en.txt` | **writing** | Domain word lists and English word-frequency tiers |
| `scripts/make-word-ranks.js` | **writing** | Builds `data/words-rank-en.txt` from wordnet-db (not loaded by the app) |
| `test/fixtures/clipboard/*` | **tables** | Clipboard HTML from Word, Excel, Google Sheets, LibreOffice (smoke tests only, not packaged) |
| `site/fx.js`, `site/demo.js`, `site/vendor/`, `site/404.html` | **website** | Website effects, the "Try it" preview, vendored KaTeX/Marked/Mermaid, the 404 page |
| `licenses/keyman-keyboards-LICENSE.txt` | **rtl** | MIT (SIL Global) for the Urdu Phonetic layout check |

Script order in `src/index.html`: `… equation-editor.js, commands.js, typing-aids.js, dates.js, multicursor.js, viewers.js, … lang.js,
keyboards.js, aarab.js, tables.js, pictures.js, word-keys.js, keytips.js, writing/*, help.js, tours.js, welcome.js, features.js,
addin-store.js, windows.js, split-view.js, ruler.js, review3-tests.js, integration.js, app.js`. windows.js must load before app.js (its
`request-close` listener runs first). CSS: `… lang.css, keyboards.css, tables.css, pictures.css, writing.css, help.css, tours.css,
welcome.css, features.css, addin-store.css, split-view.css, ruler.css, typing-aids.css, dates.css`.

main.js requires, after main-langpacks and main-addins: `main-features` (`FEATURES.init({smoke, tool, findTool, onToolsChanged})`) and
`main-windows` (`ctx = {START_URL, APP_ROOT, SMOKE, getMain, setMain, bgColor, showContextMenu, saveRecovery({docId, path, title, text})}`,
returns `{windows(), promote(closed), count(), createExtra(o)}`). Both are in package.json `build.files`.

### Optional Features and a smaller install (item 64; owner install)

- **Ids:** `pandoc` (tool pandoc), `djvu` (ddjvu, djvutxt, djvused, djvm, c44, pdf2djvu; win32-x64 only), `python` (Pyodide; platform `any`).
  Platform keys `win32-x64`, `darwin-arm64`, `darwin-x64`, `linux-x64`, `any`.
- **Folders:** `<userData>/features/<id>/<version>/` (portable copy: `data/` next to Markooj.exe). Registry `installed.json` =
  `{format:1, features:{id:{version, installedAt, source:'download'|'file', sha256, size, file}}}`. Temporary `.downloads/*.part`,
  `<id>/.staging-*`, `.trash-*`, cleaned 4 s after start. Install unpacks into staging and renames into place; Remove unregisters first.
- **Feature zip:** `markooj-feature-<id>-<version>-<platform>.zip`; program files at vendor-relative paths (`pandoc/`, `djvulibre/`, `pdf2djvu/`,
  `pyodide/`), plus `licenses/`, `SOURCE.txt`, `feature.json` = `{format:1, id, name, version, platform, license, installedSize, files, executables}`;
  the djvu zip also carries `MANIFEST.json`. Unzip refuses absolute paths, drive letters, `..`, backslashes, device names, links, encryption,
  zip64, duplicate names, oversize or mismatched entries, and checks CRC32. Limits: zip ≤ 400 MB, unpacked ≤ 900 MB, ≤ 20000 entries.
- **Download list `markooj-features.json`** (format 1): `{format:1, updated, markooj, tag, features:{<id>:{name, license, version,
  files:{<platform>:{file, size, sha256, installedSize, version}}}}}`. Read from the packaged `build/features-manifest.json` first, then
  `releases/download/v<version>/`, `releases/download/tools/`, `releases/latest/download/`. Asset URL `releases/download/<tag>/<file>`, then
  `releases/download/tools/<file>` (never taken from the list). Hosts: github.com and GitHub's release-asset hosts only, over Node https.
- **IPC:** `features-list({refresh})` → `{platform, root, portable, manifest:{source:'built-in'|'online'|'test', tag, updated}|null,
  downloadPage, features:[{id, name, what, powers[], without, license, homepage, tools[], platform, available, elsewhere, download,
  installedSize, exact, version, state:'installed'|'included'|'system'|'available'|'unavailable'|'installing', installed:{version,
  installedAt, source, size, dir}|null, foundAt, update, job}]}`; `features-install(id, {refresh})` → `{id, version, dir, source}`;
  `features-install-file({file?, id?})` (null when the picker is closed); `features-remove(id)` → `{id, removed, cleaned}`;
  `features-cancel(id?)` → count; `features-first-run()` → `{found, path, key, valid, language, features[], chose, errors[]}`;
  `features-folder()`. Events `features-progress {id, name, phase:'manifest'|'download'|'verify'|'unpack'|'done'|'error'|'cancelled',
  received, total, percent}`, `features-changed {id, installed}`. Smoke only: `features-test-setup|reset|fixtures|first-run|lookup|resolve|exists|ls`.
- **Error codes** (all with actions and details): FEATURE_OFFLINE, FEATURE_DOWNLOAD, FEATURE_NOT_PUBLISHED, FEATURE_CHECK_FAILED,
  FEATURE_UNSAFE, FEATURE_UNKNOWN_FILE, FEATURE_WRONG_FILE, FEATURE_UNAVAILABLE, FEATURE_CANCELLED, FEATURE_NO_FILE, FEATURE_UNKNOWN, ENOSPC.
  New `app.health.runAction` ids: `install-feature {feature}`, `feature-from-file {feature}`, `open-features`.
- **main.js hooks:** `findTool` looks in feature folders first (`{path, bundled:false, feature:id}`), then vendor, Program Files, PATH, system
  dirs. `manifestBases()` = djvu feature folder + vendorBases. `bundleExpected()` is true only when `<resources>/vendor/MANIFEST.json` exists
  (portable full copy) or vendor/win32 in a dev checkout. `tools-health` adds `tools[id].feature`. `toolRemedy` says "Install X from File →
  Options → Features (N MB to download)…" with `actions[0] = {id:'install-feature', label:'Install X', feature}` when the feature can be
  downloaded. `export-formats` `reason` = "Install Pandoc from File → Options → Features to use this" (same for the DjVu tools).
  markooj:// `/node_modules/pyodide/*` → `FEATURES.resolveAppFile(rel)`: the feature folder, else the app, else `<resources>/pyodide`, else a
  stand-in `pyodide.mjs` whose `loadPyodide()` calls `app.features.ensure('python')` and then imports the real file.
- **`app.features`:** `list({refresh}), get(id), last(), install(id, {quiet, file, refresh, throw}) → Promise<boolean>, installMany(ids,
  {background}), installFromFile(id?), remove(id, {confirm}), cancel(id?), ensure(id, {goal}) → Promise<boolean>, open(), forTool(toolId,
  platform) → {id, name, available, download, downloadText}, welcomeStep(sheet), firstRun({test}), applyFirstRun(r, {list, install}),
  progress:{show, hide, update, element}, sizeText(bytes, {exact}), jobs(), _test`. `app.firstRun = {language, features, chose, handled?}`.
  Events `features:changed`, `features:installed {id, version}`, `features:removed {id}`, `features:progress`.
- **Commands:** `features.open`, `features.installPandoc`, `features.installDjvu`, `features.installPython`, `features.installFromFile`,
  `features.cancel` (dimmed while nothing downloads). No key binding. Ribbon: Help tab group `help-features` (order 35). Options section
  `features` (order 27). welcome.js `render('welcome')` calls `app.features.welcomeStep(sheet)` (skipped when the installer already asked).
- **Settings:** `uiLanguage` (set from first-run.json only when empty), `features.firstRunKey`, `features.welcomeDone`.
- **first-run.json:** `<resources>/first-run.json` (or `$MARKOOJ_FIRST_RUN`): `{"language":"en|zh-CN|ur|ur-Latn|pnb|ja|ar|sv|es|fr|pt-BR",
  "features":["pandoc","djvu","python"],"from":"installer","version":"x.y.z"}`; BOM, any case, comma strings and the aliases
  pyodide→python, djvulibre→djvu accepted. Only features in state `available` are queued; downloads start 2.5 s after the check.
- **NSIS:** `build.nsis.include = build/installer.nsh`. Pages: language (first), features (after the folder page), both skipped with
  `--updated`, which also never writes first-run.json (an update cannot start downloads nobody chose). Silent `/LANGUAGE=<code>` and `/FEATURES=a,b` (no /FEATURES = no features). Pandoc checked by default; language follows
  GetUserDefaultUILanguage. Sizes `MK_SIZE_PANDOC|DJVU|PYTHON` from `build/features-sizes.nsh`. customUnInstall removes
  `$APPDATA\${PRODUCT_NAME}\features` unless `/KEEP_APP_DATA` or `--updated`.
- **Packaging:** no `extraResources` vendor on any platform (slim everywhere; the portable zip adds them). `files` adds `main-features.js`,
  `build/features-manifest.json` and node_modules exclusions (pyodide, dictionary-fa, Mermaid's ESM-only dependencies, extra builds of
  MathLive, pdf.js, pdf-lib, highlight.js, KaTeX sources and ttf/woff fonts, `*.ts`, README/CHANGELOG). `electronLanguages`: en-US, zh-CN, ur,
  ar, ja, sv, es, fr, pt-BR, fa. `afterPack: scripts/after-pack.js`. `build/features-manifest.json` and `build/features-sizes.nsh` are
  generated in CI and git-ignored.
- **Environment:** `MARKOOJ_FEATURES_DIR`, `MARKOOJ_FIRST_RUN`, `MARKOOJ_FEATURES_UNVERIFIED=1` (dev only), `MARKOOJ_KEEP_DXC=1`.
- **Release workflow:** each build job runs fetch-tools, make-features (its platform + python), `--embed` (and `--nsh` on Windows), then
  electron-builder, and uploads its zips and `markooj-features-<platform>.json`. The release job merges the lists (the Python zip must have the
  same sha256 from every job), checks every zip, writes SHA256SUMS including the feature zips, adds a features table to the notes, and uploads
  to vN and to a stable `tools` release (created once with `--latest=false`).

### Windows, Split, View Side by Side and the ruler (items 72, 79, 80; owner windows)

- **Second windows:** `markooj://app/src/index.html?mkwin=1[&link=<key>][&mode=word|inline|simple|read]`, same webPreferences, navigation
  lock-down, context menu, crash reload and `request-close`/`confirm-close` handshake as the first window. Smoke mode: invisible
  (`setOpacity(0)` + `showInactive`), never focused. When the first window closes, `win` becomes another window (`mkWindows.promote`).
  `confirm-close` closes the sender's window. `dlgWin(e)`: open-dialog, pick-file, save-dialog and addon-install open over the asking window.
- **IPC:** `win-new {key?, path?, mode?}` → `{id}`; `win-list` → `[{id, title, focused, current, minimized, bounds, main}]`; `win-focus(id)`;
  `win-cycle(±1)` → id; `win-arrange` → list; `win-doc-join {key?, path?, text, title, savedText, mtime}` → `{key, version, joined, peers,
  text?, savedText?, mtime?, path?, title?}`; `win-doc-get(key)`; `win-doc-edit {key, base, text}` → `{version, text|null}` or `{missing:true}`
  (base = current version: taken as is; else a three-way merge like core's merge3, 24 versions of history; overlapping edits: the incoming text
  wins and the replaced text goes to File → Recover); `win-doc-saved {key, path, title, ext, savedText, mtime}`; `win-doc-leave(key)`; smoke
  only `win-smoke-eval(id, js)`, `win-smoke-close(id?)`. Events `win-doc-update {key, version, text}`, `win-doc-peers {key, peers}`,
  `win-doc-saved {…}`.
- **`app.windows`:** `{isExtra, join(doc, key), links, linkOf(doc), sharedElsewhere(doc), sendNow(doc), list(), newWindow(),
  openInNewWindow(path), switchWindows({anchor}), merge3}`. Every Markdown document joins on `doc:opened` (by path, else by key); edits are sent
  only while `peers > 1`; incoming text is applied with `doc.setText(text, 'window-sync')`. Each window keeps its own `recoveryId`. Event
  `windows:peers {doc, peers}`. Hooks: core `docs.close` and app.js `onRequestClose` skip the save prompt for documents where
  `app.windows.sharedElsewhere(doc)` is true; welcome.js never shows Welcome in a second window.
- **`app.split`:** `{open({kind:'split'|'side', docId, mode}), close(), sideBySide({docId, mode, ask}), setPaneMode(m), swap(), setRatio(r),
  setSync(bool), alignNow(fromPane), readPos, reveal, focusPane(1|2), state, on, kind, mode, adapter, host, ratio, orientation()}`. DOM:
  `.mk-split-div` (role=separator) and `section.mk-split-pane` (`.mk-split-bar`, `.mk-split-host`) after `#editorHost`; body classes
  `mk-split`, `mk-split-stacked`, `mk-split-p2`, `mk-split-dragging`; `.mid-inner` becomes a grid (`--mk-sa`, `--mk-sb`). The second pane's
  editor gets `Object.create(doc)` whose `setText` calls `doc.setText(text, 'split-<origin>')`; outside changes come back as `doc:changed
  {doc: <stand-in>, origin: 'split-sync'|'split-merge'}` (same `id`). `app.editors.active()` returns the second pane's adapter while it has
  the cursor. Events `split:changed {on, kind, mode}`, `split:layout {on, orientation, ratio}`, `split:focus {pane}`.
- **`app.ruler`:** `{setOn(bool), on, shown, geom(), unit(), localeUnit(), parsePos(str, unit), fmt(px), list(doc), addGuide(axis 'h'|'v', pos,
  page), setGuide, removeGuide, clearGuides, editGuide, guidesDialog, addGuideDialog({axis, pos, page}), renderOptions(el), redraw(),
  screenOf, fromScreen, indents, PX, state}`. A guide is `{id, axis, pos, page}` (CSS px at 100% from the margin; right margin in RTL). DOM
  `.mk-ruler-h`, `.mk-ruler-v` (canvas), `.mk-ruler-corner`, `.mk-guides`, `.mk-guide.h|.v` (role=slider). Body classes `mk-ruler-on`,
  `mk-ruler-show`, `mk-guide-dragging`. CSS variables `--mk-r-bg|paper|margin|tick|text|accent|edge`, `--mk-guide`. Events
  `ruler:changed (on)`, `ruler:shown (bool)`, `ruler:guides {doc, guides}`. Guides never enter the Markdown, print or exports.
- **Commands:** `view.split` (Ctrl+Alt+S), `view.sideBySide {docId, mode, ask}`, `view.syncScroll`, `view.syncScrollBy {value:'text'|'position'}`,
  `view.resetWindowPosition`, `view.splitOrientation {value:'side'|'stacked'}`, `view.swapPanes`, `view.closeSplit`, `view.otherPane`,
  `view.splitPaneMode {value}`, `view.splitPaneWord|Inline|Simple|Read`, `view.newWindow`, `view.openInNewWindow {path}`, `view.arrangeAll`,
  `view.switchWindows {anchor}`, `view.nextWindow` (Ctrl+F6), `view.prevWindow` (Ctrl+Shift+F6), `view.ruler`, `view.guides`,
  `view.addGuide {axis, pos, page}`, `view.clearGuides` (→ count), `view.rulerUnits {value:'auto'|'cm'|'in'}`, `view.rulerUnitToggle`.
- **Ribbon:** View → `window` group (order 35): New Window, Arrange All, Split, a column (View Side by Side, Synchronous Scrolling, Reset Window
  Position), Switch Windows. View → Show gets a column with Ruler and Guides. KeyTips RU, GU, N, A, S, B, YS, T, W. F6 / Shift+F6 include
  `.mk-split-pane`. Icons: sprite `svg#mkw-icons` (`mkw-newwin, mkw-arrange, mkw-split, mkw-side, mkw-sync, mkw-reset, mkw-switch, mkw-stack,
  mkw-cols, mkw-swap, mkw-close, mkw-save, mkw-ruler, mkw-guides`); `app.windowIcons.add({id: svgBody})`.
- **Settings:** `splitOrientation` ('side'|'stacked'), `splitRatio` (0.5, 0.15–0.85), `splitPaneMode`, `splitSync` (false), `sideBySideSync`
  (true), `splitSyncBy` ('text'|'position'), `ruler` (false), `rulerUnit` ('auto'|'cm'|'in'; auto = inches for en-US, en-LR, en-MM, plain en),
  `rulerGuidesPerFile` (false), `rulerGuides` ({lowercase path: guides}, newest 100 files). Options section `window` ("Window and ruler", order 18).

### Typing aids (items 67, 68, 69, 71, 74; owner typing)

- **`app.typingAids`:** `decide({text, s, e, key, markup, markupOn, smart, context, pairs, math, lastDollar})` → `null | {a, b, insert, s, e,
  kind:'pair'|'wrap'|'over'|'delete'|'dollar'}` (pure; `key` is one character or 'Backspace'); `contextAt(text, s, {base})` →
  `'text'|'code'|'math'|'yaml'|'html'|'url'|'attr'`; `handleKey(e, ctx)` (through `app.typing.onKey`), `options()`, `slashCommands()`,
  `runSlash(name, ctx, tail)`, `hideSlashHint()`, `selectAll({target})`, `selectAllTarget(el)`, `insertPlain(text, editor?)`,
  `clipboardText()`, `renderOptions(card, {settingSwitch, optRow})`. Changes apply through the textarea adapter (native undo), the Inline
  adapter's new `editOpenBlock(a, b, text, s, e)` (one undo step), or `execCommand('insertText')` on contenteditable. editor-source.js
  `typeChar`/`pairBackspace` hand over whenever `app.typingAids.decide` exists. Ctrl+A is a document capture keydown for non-field targets,
  plus a `selectionchange` safety net that narrows a window-wide selection to the document.
- **`app.dates`:** `format(date, pattern, {calendar:'gregorian'|'hijri', lang, dayName, adjust, noEra})` (tokens `yyyy yy MMMM MMM MM M dddd ddd
  dd d HH H hh h mm ss a tt 'literal'`), `hijriParts(date, adjust)` → `{y, m, d, source:'umalqura'|'tabular'}`, `text('date'|'time'|'hijri',
  date?)`, `current()`, `patterns`, `kindOf(pattern)`, `languages()`, `insert(text)`, `openDialog({date, settingsOnly})`, `renderOptions(box)`.
  Event `dates:format`. Month and day names for en, ur, ar are in the file; others from Intl.
- **`app.multicursor`:** `isActive(ta)`, `cursors(ta)` → `[{start, end, anchor, head}]`, `clear(ta, keep?)`, `type(ta, text)`, `paste(ta, text)`,
  `selectNext(ta)`, `selectAll(ta)`, `addLine(ta, ±1)`, `addAt(ta, {a, h}, keep?)`, `caretRect(ta, offset)`, `redraw(ta)`. Extra cursors are
  drawn in `.mk-mc-layer`; `.mk-src` gets `.mk-mc-on`. Document capture listeners for keydown (`textarea.mk-src-ta` only), copy, cut, paste,
  mousedown, mouseup, input, focusout.
- **Commands:** `edit.selectAll` (hint Ctrl+A; Home → Editing; KeyTip SL), `edit.pastePlain` (Ctrl+Shift+V, Ctrl+Alt+V from the Word map;
  re-registered in typing-aids.js over the commands.js version; reads the clipboard through IPC `clipboard-read-text`), `insert.dateTime` (opens
  the dialog; `{value}` still accepted), `insert.date` (Alt+Shift+D), `insert.time` (Alt+Shift+T), `insert.hijriDate`,
  `edit.selectNextOccurrence` (Ctrl+D in Simple mode), `edit.selectAllOccurrences` (Alt+F3; Ctrl+Shift+L only while several cursors are on),
  `edit.addCursorAbove` / `edit.addCursorBelow` (Ctrl+Alt+Up / Down), `edit.singleCursor` (Esc). Simple mode's Duplicate line moved from
  Ctrl+D to Ctrl+Shift+D. Home → Editing is now Find, a column (Replace, Select all), Equation; icons `mk-selall`, `mk-replace`.
- **IPC:** `clipboard-read-text` → string.
- **Settings:** `autoPair`, `autoPairMarkup`, `autoPairMath`, `slashCommands` (all true), `dateFormat` ('MMMM d, yyyy'), `dateLang` ('en'),
  `dateCalendar` ('gregorian'|'hijri'), `dateDayName` (false), `dateCustom`, `timeFormat` ('h:mm a'), `hijriFormat` ('d MMMM yyyy'),
  `hijriLang` ('en'), `hijriAdjust` (0; -1, 0 or 1). The Options typing card calls `app.typingAids.renderOptions(card, {settingSwitch, optRow})`.

### Writing quality (items 70, 73, 75, 76, 77; owner writing)

- **Setting** `writingDomainWords` (true): File → Options → Writing, "Accept technical terms and place names"; changing it calls
  `applyDictionary()` and checks open documents again. **Command** `writing.domainWords` (toggle, Review → Proofing "Technical terms", palette).
- **Data:** `data/words-technical-en.txt`, `data/places-en.txt` (`#` comments; words separated by spaces or new lines; `word/s`, `word/es`
  add a plural; case matters). `data/words-rank-en.txt`: `<tier 1–9> word word …` (lower case), built by `scripts/make-word-ranks.js`.
- **`app.writing`:** `domainWords.{load() → Promise<count>, list(), added(), has(word)}` (only words the en-US dictionary lacks are added, through
  `mk.spell.setPersonal`), `parseWordList(text)`, `wordFreq(lowerWord) → 0–9`, `spellReady(code='en-US')`, `warmSpelling(code)` (idle slices;
  runs 1.2 s after `ready`), `qualityCorpus`. `suggest(word, lang)` for English: COMMON_TYPOS, swaps, `R.spellNear`, `R.spellMorph`, then
  `R.spellRank`; Hunspell's `mk.spell.suggest` runs only when the best candidate costs > 0.6 or fewer than 3 candidates exist. `explain(f)`
  prefers `f.explain`. `finish()` / `checkText()` run `R.vary()` after dedupe; Harper findings on domain words are dropped.
- **Rules (src/writing/rules.js, page + worker):** new rule `confusable` (correctness, "Commonly confused words"; subs effectVerb, affectNoun,
  thenThan, thanThen, yourYoure, youreYour, loseLoose, looseLose, principle, principal, complement, compliment, advise, advice; never safe; each
  finding carries `explain`, `wrong`, `right`). New rule `adjCommas` (clarity, "Commas between describing words"; serial comma in US documents
  only). Article rule sub `and` ("A, an or and", replacements `['and', 'a']`). Functions `R.confusables(text)`, `R.CONFUSABLE_WORD`,
  `R.harperKeep(f, blockText, cfList?)`, `R.CF_WHY`, `R.CF_PAIR`, `R.isAdj`, `R.isQualityAdj`, `R.anMeansAnd`; varied messages `R.PHRASES`,
  `R.say(key, vars)`, `R.vary(list)` (fields `vk`, `vv`, `vg`, `message0`, `variant`; Harper varies only AnA, ThenThan, RepeatedWords,
  ItsContraction, PossessiveYour, CapitalizePersonalPronouns, ModalOf); spelling helpers `R.phoneKey`, `R.spellDistance`, `R.spellIndex`,
  `R.spellIndexStart|Add|End`, `R.spellNear(idx, word, max=1.9, limit=30)`, `R.spellMorph(idx, word)`, `R.spellRank(word, cands, {freq, max,
  withScore})`. Passive voice: one hint per paragraph, skips `PASSIVE_AS` participles + "as"/"to as" and when/if/once/… clauses.
  `R.HARPER_OFF` adds ExpandMemoryShorthands, ExpandTimeShorthands, ExpandControl; KNOWN_ACR adds units and engineering software.
- **Worker:** `mapHarper` drops a Harper finding on a confused word unless `R.confusables(block.text)` marks the same span.

### Tables with Office, numbering in tables, pictures from other editors (items 62, 63, 78; owner tables)

- **Preload:** `mk.homeDir`; DOMPurify `ALLOWED_URI_REGEXP` also allows `[a-z]:[\\/]`; `picturePaths(body)` (used by `render` and `xrefScan`,
  drawing only, same line count: spaces → `<…>`, `file:///` prefix dropped, `C:\a\b.png` → `C:/a/b.png`, code skipped); inline rule
  `wiki_embed` (`![[x.png]]`, `![[x.png|300]]` → `img.mk-wiki-embed[data-raw]`, toMarkdown rule `wikiEmbed`); `xrefScan` gives table-cell
  inline tokens the line of their row.
- **Core:** `app.assetUrl(doc, src)` accepts `file:///C:/…`, `file:///home/…`, `file://localhost/…` (never `file://host/…`) and `~/…`.
- **`app.tables` additions:** op `paste {row, col, cells}`; `TB.tableBlocks(text)`; `TB.exportMarkdown(md, format)` (DOCX `<w:br/>`, ODT
  `<text:line-break/>` for `<br>` in rows; caption after a labeled picture in a cell; registered with `app.exporter.addMarkdownTransform`);
  `TB.office = {fromHtml(html, {merged}) → {tables:[{md, lines, grid, plain, rows, cols, merged, pictures}], md, onlyTables,
  source:'word'|'excel'|'sheets'|'libreoffice'|'docs'|'markooj'|'web'}, fromTsv, parseTsv, looksLikeTsv, sourceOf, cellMarkdown(el,
  classStyles), toOffice(rows, {header}) → {html, tsv}, copyTable({editor, write}) → {html, text}, insert(conv, editor), paste, copyEvent,
  enabled(), busy, last}`. Document capture listeners for paste and copy run before the editors'. Markooj's clipboard HTML is wrapped in
  `<div data-markooj-copy="simple|page|table">`.
- **`app.xref` additions:** `cellEquationMarkdown(res, doc)` (one line `$$tex$$ {#eq:x}`, `|` → `\|`, `%` comments dropped), `tellCell()`,
  `equationMarkdown(tex, {inCell:true})`; `decorateModel` counts picture indexes across a table row; `itemForElement` / `itemAtCaret` resolve a
  picture in a cell; `rewriteItem` (fig) never splits a table row; labeled pictures in cells get `span.mkx-cellcap[data-mk-ui]`; `EXPORT_CSS`
  adds the cell equation grid. `insert.equation` with the caret in a cell writes the one-line form.
- **`app.pictures`:** `classify, absPath(doc, src), fileUrl(abs), localUrl(abs), relPath(docPath, abs), sameSrc, occurrences(text) →
  [{form:'md'|'html'|'wiki', start, end, dest, destStart, destEnd, alt?, opt?}], replaceSrc, removeAt, exists(paths)` (file-info IPC, 4 s
  cache), `nearby(doc, src), forget, paint(el, doc), missing(root), locate, relink(doc, item, file), remove, findMissing(), exportMarkdown(md,
  doc)`. A postRender hook marks missing pictures (`img.mk-pic-gone` + `span.mk-pic-missing[data-mk-ui][contenteditable=false]` with
  `button[data-pic-act=locate|remove|save]`); `data-mk-pic` keeps the original src. On the export stage it writes `data-mk-file-src`
  (integration: the exporter turns it into `src` only after moving the stage into an inert document, so the window never tries to load
  `file:///`; print keeps `markooj://local`). The exporter's stage also parses its HTML in an inert document first and shows `C:/…` and
  `file:` pictures through `markooj://local` (original in `data-mk-src`, restored for HTML exports).
- **Commands:** `table.copyOffice` ("Copy for Word/Excel"; Table Design → Convert, Table Layout → Data, right-click table menu),
  `pictures.findMissing` (Insert → `pictures-find` group "Pictures", order 11). No new shortcuts. Status item `pictures-missing` (left, order 46).
- **Settings:** `tablePasteOffice` (true), `tablePasteMerged` ('blank'|'repeat'), `tableCopyOffice` (true); Options section `tables` (order 28).
- **Markdown:** Obsidian `![[file.png]]` / `![[file.png|300]]`; `$$…$$ {#eq:x}` and labeled pictures inside pipe-table cells are numbered.

### Keyboards, mixed direction and aarab (items 60, 61, 82; owner rtl)

- **`app.keyboards`:** `{layouts(), get(id), current(), lastRtl(), isRtl(), set(id, {quiet}), toggle(), charFor(code, layer 0|1|2, id) → string |
  '' | null, insertText(text, target), openMenu(anchor), menuItems(), openOptions(), renderOptions(el), onScreen:{open, close, toggle, isOpen,
  paint, flash(code), element}}`. Layout ids `en`, `ur`, `ar`, `fa`, `pnb`; data `{id, chip, name, native, title, hint, lang, script, dir,
  keys:{KeyboardEvent.code: [normal, Shift, AltGr]}, about}`. Typing is a capture-phase keydown on document for editable targets in
  `#editorHost` (and Inline mode's page before a block is open); elsewhere only with `keyboard.everywhere` or `[data-mk-kbd]`; never in
  `.palette`, `[data-mk-keys="own"]`, `.mk-osk`; skipped with Ctrl/Alt (except AltGr), on IME/Process/Dead keys and when `e.key` is already
  Arabic script. Right Alt counts as AltGr while a layout is on. Status item `keyboard` (right, order 4); View → `keyboard` group (order 22).
- **`app.aarab`:** `{marks(), strip(text) → {text, n}, mapProse(md, fn), applyMark(marks, mark), addFromMap(text, Map), readingsOf({fields,
  rows}), canon, addMark(ch), remove({whole}), fromWordList({whole, lexicon, lang, quiet}) → {text, added, ambiguous[], unknown, chosen, lang},
  toggleView(on?), hidden(), applyView(), hideIn(page), showIn(page), updateGroup(), wantGroup(), renderOptions(el), chooseReading: null}`.
  Remove takes U+064B–0652, U+0656, U+0657, U+0670 (never madda/hamza U+0653–0655; code left alone). Hook for language roadmap Part 4:
  `app.aarab.chooseReading = async ({word, readings, lang}) => reading | null`. Hide Aarab rewrites text nodes of `.mk-read-page` and
  `.mk-preview-page` only. Home → `aarab` group (order 35), shown for Arabic-script documents or a right-to-left keyboard (setting
  `aarab.group` overrides). Icons `mk-aarab-x`, `mk-aarab-eye`, `mk-aarab-list`, `mk-kbd`, `mk-kbd-osk`, `mk-kbd-switch`.
- **`app.lang.bidi`:** `{isolateInline(block), isolateRuns(page), atoms}`. `markDir` gives a block with math, code, `[data-mk-ui]`, `.mk-xref`
  or `.mk-cite` an explicit `dir` from its first real letter; inline elements of the other direction get `data-mk-iso="ltr|rtl"` (UI only, never
  in the Markdown); Read mode and the Simple preview wrap opposite-direction runs in `<bdi dir data-mk-iso>`. CSS `[data-mk-iso]{unicode-bidi:
  isolate}`; `[data-mk-autodir][dir=auto]` gets `unicode-bidi:plaintext`. Options → Language calls `app.keyboards.renderOptions` and
  `app.aarab.renderOptions`.
- **Commands:** `keyboard.toggle` (Ctrl+Shift+K, global), `keyboard.menu {value}`, hidden `keyboard.set {value}`,
  `keyboard.english|urdu|arabic|persian|punjabi`, `keyboard.onScreen`, `keyboard.options`; `aarab.zabar` (Ctrl+Alt+Shift+A), `aarab.zer` (I),
  `aarab.pesh` (U), `aarab.shadd` (S), `aarab.jazm` (J), `aarab.tanweenZabar` (N), `aarab.tanweenZer`, `aarab.tanweenPesh`,
  `aarab.khariZabar` (K), `aarab.remove` (R), `aarab.removeAll`, `aarab.toggleView` (H), `aarab.fromWordList` (W). KeyTips DA, DI, DU, DS,
  DJ, DN, DE, DP, DK, DR, DH, DW; View KB, KT, KS. word-keys.js NOTES: Ctrl+Shift+K (Word: Small caps).
- **Settings:** `keyboard.layout` ('en'), `keyboard.lastRtl` ('ur'), `keyboard.everywhere` (false), `keyboard.onScreen` (false), `aarab.group`
  ('auto'|'always'|'never'), `aarab.hidden` (false). **Events:** `keyboard:changed {id, prev, layout}`, `keyboard:onscreen (bool)`.
- **Language packs repo:** ROADMAP Part 3 done; CONTRIBUTING.md and docs/FORMAT.md explain the aarab column; aarab added to 55 Urdu and 3
  Punjabi words (pack versions not bumped yet).

### Website (items 65, 66; owner website)

- `site/fx.js` (effects), `site/demo.js` ("Try it"), `site/vendor/` (KaTeX 0.19.1, Marked 16.4.2, Mermaid 12.3.0 with licenses and
  `README.txt`), self-contained `site/404.html` (`<base href="/markooj/">`, switched to "/" outside /markooj/; noindex). Scripts load with
  `defer`: main.js, fx.js, demo.js (independent IIFEs).
- fx.js: `fx-fine` on `<html>` for `(hover: hover) and (pointer: fine)`; the lens clones `.lens-host h1` into `.lens-src` (aria-hidden,
  `clip-path: circle()`, marks `.mk-h|.mk-l|.mk-r` of zero width, so the clone keeps the h1's exact structure); drifting symbols in `.fx-layer`;
  chips `.chip-type` (`.tc-text`, `.tc-fmt`, `is-fmt`) and `.chip-file`; `.spot` cards use `::before` with `--mx`/`--my`.
- main.js reveal: `.reveal` then `.in`, both removed about 950 ms after arrival; row stagger (index mod 3) × 90 ms.
- demo.js: `#demo[data-mode=word|inline|simple|read]`, tabs `[role=tab][data-mode]`, actions `[data-act=bold|italic|heading|table|math|diagram|
  reset|retry|diagram-retry]`, `#demo-canvas`, `#demo-toast` (role=status), `#demo-title`, `#demo-mode-name`, `#demo-words`. Marked + KaTeX load
  within 500 px of the screen (or on pointerenter/focusin); Mermaid on the first diagram (`securityLevel:'strict'`). Raw HTML escaped, pictures
  never fetched, only http, https, mailto and # links. No storage and no network calls besides the three vendor files.

### Integration (round 5)

- **Welcome:** `HIGHLIGHTS['1.2.0']` added (five highlights), so What's new is ready when package.json becomes 1.2.0.
- **app.js:** `onRequestClose` leaves out documents where `app.windows.sharedElsewhere(d)` (alongside windows.js's own listener).
- **exporter.js:** see pictures above (inert stage parsing; `data-mk-src` / `data-mk-file-src` resolved after the stage leaves the window).
- **developer.js:** a Python macro that cannot start because Python is missing says "Install Python macros from File → Options → Features
  (about 6 MB), then run the macro again" with an **Install Python macros** button that installs and reruns.
- **scripts/fetch-tools.js:** the notices generator now writes the WordNet word-frequency line, the Keyboard layouts section and the Website
  copies line, so `--notices` keeps them.
- **main-features.js:** never goes online in smoke mode (tests bring their own list with `features-test-setup`), and remembers a failed online
  list fetch for 60 s so an offline computer does not wait again on every Options visit (`refresh` still retries at once).
- **Tests adjusted to the slim install:** `viewers: a DjVu file …` expects "Install DjVu tools" when Features can download them; `main: export
  formats and tools` checks the bundle only when `tools-health.bundleExpected`; the developer Python tests and the Python replay skip when the
  Python macros feature is neither installed nor included; the end-to-end checks take a third argument `needs` ('pandoc' | 'djvu') and report
  `{ok: true, skipped}` when that tool is missing; `pictures: … DOCX` checks media only on the Pandoc path; `tables: Office paste …` has a
  packaged stand-in for its (unpackaged) Excel fixture.
- **Test robustness:** `ruler: drag …` measures the guide against the live page; `xref: page, hover card and dialogs` waits up to 4 s for the
  dialog list and always closes its dialog; `aarab: Home → Aarab group …` waits for the Home KeyTips and always stops KeyTips; the mode
  cross-fade test waits for `.mk-mode-ghost` to leave.
- **Smoke prefixes added this round:** `features:`, `windows:`, `split:`, `ruler:`, `typing:`, `writing: quality:`, `kbd:`, `aarab:`,
  `bidi:`, `tables: Office …`, `xref: … table cells`, `pictures:`.
- **Options:** the Word-keys section `keyboard` is labeled **Keyboard shortcuts** (it was "Keyboard"), so it is not confused with the typing
  layouts under **Language → Keyboard**. Section orders: window 18, writing 22, language 25, features 27, tables 28, recovery and keyboard 60.
- **Feature zips are byte-identical across build jobs** (fixed date, sorted entries, license texts normalized to LF), so the release job can
  merge the per-platform lists and require one SHA-256 per file name.
- **Integration check (1.2.0):** no duplicate shortcut (`app.keys.conflicts()` and the KeyTips uniqueness test pass), no duplicate settings
  keys, script and CSS order as listed above. Full dev smoke and a packaged slim build subset pass (numbers in the round-5 integrator report).

## Interface translations (1.2.0)

PLAN-v5 item 81: the interface in en (source), zh-CN, ur, ur-Latn, pnb, ja, ar, sv, es, fr, pt-BR; ur, pnb and ar mirror the whole
interface. The full contract for developers and translators is **docs/I18N.md**; this section lists the moving parts.

### New files and owners

| File | Owner | Purpose |
|---|---|---|
| `src/i18n-core.js` | **i18n** | Pure engine (UMD: window `mkI18nCore`, Node `require`): `parseKey`, `stripContext`, `placeholders`, `tags`, `pluralCategory`, `pluralCategories`, `pickPlural`, `pseudo`, `looksPseudo`, `interpolate`, `escHtml`, `createTranslator({code, entries, en, plural, intl}) → {t, tn, th, has, raw, missing, formatNumber}` |
| `src/i18n.js`, `src/i18n.css` | **i18n** | `app.t/tn/th/tm`, `app.i18n`, `<html lang dir>` and hook classes, data-i18n helper, live switching, status chip, menu, Options row, Welcome step, coverage scan; interface fonts |
| `src/i18n-tests.js` | **i18n** | Smoke tests `i18n:` |
| `main-i18n.js` | **i18n** | Main side: language choice, catalogs, `I18N.t/tn/language/dir/onChange/setLanguage`, IPC |
| `locales/languages.json`, `locales/<code>/{shell,app,editors,language,system}.json`, `locales/<code>/GLOSSARY.md` | **i18n** (en), translators (others) | Catalogs; keys are the US English text |
| `scripts/i18n-check.js` | **i18n** | Catalog checks and `--scan` of the code |
| `docs/I18N.md` | **i18n** | The contract |

Load order: `src/index.html` loads `i18n-core.js` and `i18n.js` in `<head>`, before the stylesheets and every other script;
`i18n.css` is the last stylesheet; `i18n-tests.js` loads after `uxreview-tests.js`. `core.js` calls `window.mkI18n.attach(app)` right
after `window.app` exists (English stand-ins for `app.t/tn/th/tm` if i18n.js is missing). `package.json` `build.files` adds `main-i18n.js`
and `locales/**/*.json` (inside app.asar; main reads them with fs at `<appRoot>/locales`). main.js requires main-i18n after the settings
helpers: `I18N = require('./main-i18n').init({appRoot, smokeDir, getSettings, saveSetting})`.

### Keys, values, API (summary of docs/I18N.md)
- Key = exact US English text; context marker `Text@@context` (lower-case words at the end; never shown); keys starting with `@` are notes
  (`@notes`, `@same`). Values: string, or plural object `{zero, one, two, few, many, other}` (Intl.PluralRules of `plural` in
  languages.json); the key of a plural is its English `other` form. Placeholders `{name}`; `{count}` gets digit grouping. Missing or empty →
  English, silently (reported by the check script and `app.i18n.missing()`).
- Window: `app.t(text, vars)`, `app.tn(text, count, vars)` (= `t` with `vars.count`), `app.th` (vars HTML-escaped), `app.tm(text)` (marker,
  returns text). `app.i18n = {language, setting, source, setLanguage(code, {quiet}), languages({all}), info, nativeName, dir, isRtl, locale,
  onChange, apply(el), number, percent, date, time, dateTime, list, compare, relative, plural, has, missing, pseudo, core, picker, menuItems,
  openMenu, openOptions, renderOptions, welcomeStep, refresh, scanUntranslated, scanThreshold, state}`. `window.mkI18n` = `{t, tn, th, tm,
  attach, api, state, core}` before core.js.
- Static HTML: `data-i18n`, `data-i18n-html`, `data-i18n-title|aria-label|placeholder|alt|tip|tip-d|label`, `data-i18n-vars` (JSON).
- Data tables register English with `app.tm(…)`; every renderer calls `app.t(label)` when drawing (unknown labels come back unchanged).
- Main: `I18N.t`, `I18N.tn`, `I18N.language()`, `I18N.dir()`, `I18N.onChange(fn)`; macOS's Edit menu is built by `setAppMenu()` and
  rebuilt on change.
- Scanner aliases: a file that calls a short name (`const t = app.t`) declares `/* i18n-aliases: t, tn */`.

### Language choice and switching
- Setting `uiLanguage` (`''` = follow the system). Resolution in main: the setting; `MARKOOJ_UI_LANGUAGE` (developers); English in smoke runs;
  first-run.json `language` (installer); the first supported entry of `app.getPreferredSystemLanguages()` (zh-Hans → zh-CN, pt-* → pt-BR,
  ur-Latn → ur-Latn, ur-* → ur, pa-Arab / pa-PK / pnb → pnb; zh-Hant and Gurmukhi pa are not matched); else English.
  `app.commandLine.appendSwitch('lang', 'en-US')` is unchanged (Chromium's own text and `navigator.language` stay US English).
- No English flash: preload `mk.i18n.boot()` is `ipcRenderer.sendSync('i18n-boot')` → `{language, info, entries, en, setting, source,
  languages, system, smoke}`; `mk.i18n.catalog(code)` (sendSync `i18n-catalog`) → `{language, info, entries, en}`.
- IPC: `i18n-set(code)` → `{language, setting}` (saves the setting, switches main, sends `i18n-changed {language, setting}` to every other
  window); `i18n-info` → `{language, setting, source, dir, system, languages}`; `i18n-t(text, vars)` → main's translation; `i18n-match(tags[])`;
  smoke only `i18n-smoke-write(name, data)` → `<smokeDir>/<name>.json`.
- Switching is **live**; documents are never touched and nothing reloads. Order: catalogs installed, `<html>` updated, `onChange` listeners,
  event `i18n:changed {language, prev, dir, rtl}`, then `app.i18n.refresh()`: data-i18n nodes, palette closed, `app.shell.renderRibbon()`,
  `renderTabs()`, `status:changed` + `updateStatus()`, the open File page reopened. Modules that keep other interface open redraw on
  `i18n:changed`. A toast confirms the switch with **Undo**.
- Where users switch: status item `ui-language` (right, order 3; `button.sb.mk-i18n-chip`, icon `#mk-ui-lang`, a new "A文" symbol in
  index.html, while the globe `#lang` stays the document language; native name; menu with all languages, completeness, Match the system
  language, Language options…); File → Options → Language, first card (`.opt-card.opt-lead[data-lead="ui-language"]`); command
  `i18n.pick` "Change interface language" (palette; `{value}` switches directly), hidden `i18n.set {value}`, `i18n.togglePseudo`; the
  Welcome sheet gets `section.mk-i18n-wel` as its first step on `welcome:opened` (mode welcome).
- **Core/shell additions:** `app.options.addLead(sectionId, {id, order, render(el)})` and `app.options.leads(sectionId)`; the Options page
  draws each lead as `div.opt-card.opt-lead[data-lead][data-lead-for]` between the section title and the section's own card.

### Right to left and fonts
- `<html>` gets `lang` (qps → en), `dir`, `data-ui-lang`, and the classes `mk-ui-rtl` (ur, pnb, ar), `mk-ui-lang-<code>`,
  `mk-ui-font-<font>` (`system`, `cjk-sc`, `cjk-jp`, `naskh`, `naskh-nastaliq`). Mirroring CSS for the interface is the RTL block at the end of i18n.css (see "Right to left" below);
  i18n.css only keeps `#editorHost` left to right (the page sets its own `dir`/`lang` per document and paragraph).
- Fonts (`--font` per class): CJK system UI fonts; Arabic: system font, then Noto Naskh Arabic; Urdu and Punjabi: bundled Noto Naskh Arabic for
  all interface text, Noto Nastaliq Urdu (`--mk-ui-heading-font`, line-height 2) only for `.bs-page > h2`, `.opt-sec-title`, the Welcome title
  and `.mk-i18n-heading`.

### Pseudo-locale, tests, checks
- `qps` (`developer: true` in the list from main; shown only with setting `i18n.showPseudo` or while active): `[Šåṽé åš… ~~~]` for every
  string through `t()`, catalog or not. `app.i18n.scanUntranslated(root)` → `[{text, kind:'text'|'attr:<name>', where, n}]`.
- Smoke prefix `i18n:` (11 tests): lookup and fallback, placeholders, plurals (ar six forms, ja/zh other only, fr 0 → one), context markers,
  setLanguage + dir + persistence + chip, no English flash, data-i18n, pickers, main t() and system-language matching, Urdu interface fonts,
  the coverage scan (writes `i18n-untranslated.json`; fails above `app.i18n.scanThreshold`, 0 since the sweep). Screenshots `i18n-en`, `i18n-qps`,
  `i18n-qps-options`, `i18n-rtl-ur`, `i18n-ur-fonts`, `i18n-options`, `i18n-menu`.
- `node scripts/i18n-check.js [--lang a,b] [--scan] [--strict] [--write] [--json] [--verbose] [--locales dir]`; errors exit 1.
- Settings added: `uiLanguage` (already written by first-run handling), `i18n.showPseudo` (false).

### Catalogs and groups (after extraction and review)
- `locales/en/` holds 3,899 entries (3,858 unique strings) in five groups: `app` 890, `editors` 875, `system` 778, `shell` 705,
  `language` 651; plural objects 100, translator notes in `"@notes"`. 41 keys sit in both `app.json` and `language.json` (Cancel, OK, Close,
  Save, Copy, `{count} words`, language names…): allowed, the check warns, and every language gives both copies the same value.
- Every language in `locales/<code>/` is 100% (3858/3858, 0 errors, 0 plural gaps); `completeness` in `languages.json` is written by
  `node scripts/i18n-check.js --write` and must be re-run when strings are added. Each language has a `GLOSSARY.md` with its decided terms.
- pt-BR uses `"plural": "pt-PT"`: CLDR's pt-BR puts 0 under `one` ("0 palavra"); pt-PT keeps 1 → one and 0 → other with the same categories.
- Wrapping rules: data tables register English with `app.tm` and every renderer calls `app.t(label)` when it draws; sentences are whole keys with
  named placeholders; counts use `app.tn`; context markers `Text@@context` split meanings (`Insert@@verb`, `Inline@@editing mode`…).
  Not translated on purpose: document content (bibliography words, cross-reference prefixes, inserted dates, template bodies), bug-report
  text, brand/font/format names, key names, developer errors, grammar-rule texts from rules.js (English this round).
- Main process: `I18N.t` in main.js and the `main-*.js` files; error-action labels and dialog filters are built per call so they follow the
  current language. The app menu (`setAppMenu()`) is rebuilt on a switch.
- `addons/` (bundled add-ins) are scanned by `--scan` and wrapped like modules.

### Right to left (ui-rtl)
- Interface CSS uses logical properties (`margin-inline-*`, `inset-inline-*`…). Physical left/right remain only for document content in
  `#editorHost`, elements JS positions in pixels (seg thumbs, ribbon ink, popovers, tooltips, KeyTips, chevrons), and the ruler/guides.
- The RTL block at the end of `src/i18n.css`: direction icons flip (`back`, `chevr`, `undo`, `redo`, `indent`, `outdent`, `ul`, `toc`,
  `side`, `tabsleft`); user text (document names, outline, paths, previews, inputs) gets `unicode-bidi: plaintext`; `kbd`, code, equations,
  LaTeX fields, template pictures, help content and the on-screen keyboard stay LTR. Split view keeps documents in reading order (first pane left).
- Long labels: big ribbon buttons wrap to two lines then "…", group names stop at 180px, ribbon tabs shrink to min 2.5em (File never), the
  title bar is a 3-column grid, the status bar is a size container (`mk-status`) that squeezes add-in and `.hide-narrow` items first.
- shell.js (integrator): ribbon overflow chevrons and wheel scrolling read RTL `scrollLeft` (0 at the right edge, negative leftwards);
  `placePop` aligns menus to the anchor's right edge in RTL unless `align: 'left'`; `makeSeg` arrow keys follow the visual direction and every
  `.seg` re-places its thumb after `i18n:changed`.

### Live switching
- `app.i18n.setLanguage(code)` → main (`i18n-set`, persists `uiLanguage`, broadcasts `i18n-changed` to other windows) → `install()` →
  `i18n:changed {language, prev, dir, rtl}` → modules redraw their persistent UI; open one-shot dialogs keep the old language until reopened.
- Never touched by a switch: document text, dirty state, undo, split/side-by-side layout. Unsaved documents still named the previous
  language's "Untitled" (no path) are renamed to the new language's word (shell.js).
- Checked by the integrator: 13 switches (en ↔ ur, ja, ar, fr, pnb, zh-CN, ur-Latn, sv, es, pt-BR) with two unsaved documents and split
  view open, then side by side: text and dirty state kept, `dir`/`lang` flip, ribbon labels and main's `i18n-t` follow, seg thumbs aligned.

### Installer (Windows, NSIS)
- `build/installer-*.nsh`: in `customInit`, a LangDLL screen lists the 11 languages (native names, Windows display language preselected);
  skipped for `/S`, `--updated`, `/LANGUAGE=<code>` (case-insensitive, `_` or `-`) and the elevated copy (choice passed via UAC). The choice
  sets NSIS's language (8 `installerLanguages`; ur, ur-Latn, pnb fall back to English pages, NSIS has no Urdu/Punjabi) and is written to
  `first-run.json` `language`, which main-i18n reads on first start. The features page is translated in all 11 (`build/installer-strings.nsh`)
  and mirrored with `nsDialogs::SetRTL` for ur, pnb, ar. Test: `node build/installer-lang-test.js` (Windows; `--static` elsewhere).

### Packaging
- `build.files` includes `main-i18n.js` and `locales/**/*.json` (glossaries stay out). Chromium locale paks kept: ar, en-US, es-419, es, fa,
  fr, ja, pt-BR, sv, ur, zh-CN. The unpacked Windows app grew by about 4.9 MB (app.asar 66.4 → 71.3 MB), almost all of it catalogs.

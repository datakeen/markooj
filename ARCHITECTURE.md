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
Settings `toursDone`, `toursOffered` (the first-launch offer shows once, only on a fresh profile, never in smoke mode). Events `tour:started`, `tour:step`,
`tour:ended`, `tours:changed`.

### License (item 47)
Markooj is `AGPL-3.0-or-later`: `LICENSE` is the full AGPL v3 text (same file as Sungfluence), shipped as `LICENSE.txt`; `package.json` `license` says so,
and `app-info` reports it. `build.copyright` is "Copyright © 2026 Ahmed Bilal and contributors"; main falls back to the same line when the packaged
package.json has no `build` field. `THIRD_PARTY_NOTICES.md` (generated by `scripts/fetch-tools.js --notices`) states the license and the compatibility
of every bundled part: Pandoc, DjVuLibre (GPL-2.0-or-later) and pdf2djvu (GPL-2.0-only) are separate programs run as tools, never linked.

### Packaging
`build.files` adds `CHANGELOG.md` (What's New reads it). `LICENSE`, `licenses/` and `THIRD_PARTY_NOTICES.md` ship only in `resources/`
(`extraResources`; electron-builder leaves every extraResources source out of `app.asar`), and the app reads them through the `app-info` paths
(`licenseFile`, `noticesFile`, `licensesDir`). `docs/help/**` was already listed. `docs/images/`, `marketing/`, `samples/` and `private/` are never packaged.

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

# Writing a Markooj add-in

An add-in adds commands, ribbon buttons, Markdown features, status bar items, settings or export formats to Markooj. It is plain JavaScript: either one `.js` file, or a small folder with a `manifest.json`, a `main.js` and an optional `styles.css`. If you can write a little JavaScript, you can write an add-in. There is nothing to build or install.

Users find add-ins in the add-in store (**File → Add-ins → Browse**) and manage them in **File → Add-ins**. The user help page is [docs/help/add-ins.md](help/add-ins.md). To put your add-in in the store, see [Publish your add-in in the store](#publish-your-add-in-in-the-store) below.

## Where add-ins live

| Where | What |
| --- | --- |
| `addons/` in this repository | The add-ins that come with Markooj: `readability.js`, `si-units.js` and `word-frequency.js`. Read them as examples. |
| `%APPDATA%\Markooj\addons` | The user's own add-ins (an installed copy). |
| `data\addons` next to `Markooj.exe` | The user's own add-ins (a portable copy). |
| `<id>\` inside either folder | An add-in installed from the store: its `manifest.json`, `main.js`, `styles.css` and data files, and an `.install.json` that Markooj writes. |

**File → Add-ins → Open add-ins folder** opens the user folder, and **Install from file…** copies a `.js` file into it. A user add-in with the same file name as a bundled one replaces it.

## How an add-in runs

When Markooj starts, it reads every `.js` file in both folders and runs the ones that are switched on, once, in the Markooj window. Your code runs as the body of a function with two names in scope:

- `app`: the whole Markooj application object, the same one Markooj's own modules use.
- `markooj`: the easy document API that macros use (`markooj.doc`, `markooj.ui`, `markooj.run`). See [Macros and scripting](help/macros-and-scripting.md).

If your code throws an error while it loads, Markooj shows the error on the add-in's card in File → Add-ins and carries on without it. After you change an add-in, click **Reload add-ins**. It restarts the window and keeps the open documents.

An add-in runs with the same rights as Markooj itself. Write add-ins that do one clear thing, and tell your users what yours does.

## The header

Start the file with comment lines. Markooj reads them up to the first line of code.

```js
// @name Abbreviations
// @description List the abbreviations defined in a document
// @version 1.0
// @author Your Name
// @icon table
// @color #30b0c7
```

| Field | Use |
| --- | --- |
| `@name` | The name on the add-in's card. Without it, the file name is used. |
| `@description` | One line about what it does. |
| `@version`, `@author` | Shown on the card. |
| `@icon` | An icon name (list below). Default: `puzzle`. |
| `@color` | The card's color, as `#rrggbb`. |

Icon names you can use for the card and for ribbon buttons include `puzzle`, `sparkle`, `sigma`, `spell`, `count`, `cite`, `bib`, `table`, `image`, `code`, `doc`, `md`, `link`, `flow`, `comment`, `toc`, `xref`, `lang`, `info`, `gear`, `check`, `export`, `print`, `folder`, `keyboard`, `terminal`, `python`, `js`, `macro`, `play`, `stop`, `history`, `search`, `function` and `bracket`.

## A complete example

This add-in finds abbreviations defined in a document, such as "sediment delivery ratio (SDR)". It shows most of what an add-in can do: a command, a ribbon button, a status bar item, a Save As format, a setting and a test. Save it as `abbreviations.js` in the add-ins folder and click **Reload add-ins**.

```js
// @name Abbreviations
// @description List the abbreviations defined in a document
// @version 1.0
// @author Your Name
// @icon table
// @color #30b0c7
//
// Finds definitions such as "sediment delivery ratio (SDR)" and can insert them as a table,
// count them on the status bar, and save them as a CSV file from File → Save As.

// 1. The logic: plain functions, easy to test.
function findAbbreviations(markdown) {
  const found = new Map();
  const re = /((?:[A-Za-z][\w-]*\s+){1,6}?)\(([A-Z][A-Za-z0-9]{1,9})\)/g;
  for (const m of String(markdown || '').matchAll(re)) {
    const short = m[2];
    const words = m[1].trim().split(/\s+/);
    // keep as many words as the abbreviation has capital letters, e.g. SDR → three words
    const n = Math.min(words.length, short.replace(/[^A-Z]/g, '').length || 1);
    if (!found.has(short)) found.set(short, words.slice(-n).join(' '));
  }
  const list = [...found.entries()].map(([short, long]) => ({ short, long }));
  if (app.settings.get('abbreviations.sort', true)) list.sort((a, b) => a.short.localeCompare(b.short));
  return list;
}

function toTable(list) {
  return ['| Abbreviation | Meaning |', '| --- | --- |', ...list.map(a => `| ${a.short} | ${a.long} |`)].join('\n');
}

// 2. A command: it works from a button, the command search (Alt+Q), a shortcut and macros.
app.commands.register('abbreviations.insert', {
  label: 'Insert list of abbreviations',
  icon: 'table',
  description: 'Insert a table of the abbreviations defined in this document, at the cursor.',
  run: () => {
    const doc = app.docs.active();
    if (!doc || doc.kind !== 'markdown' || doc.readOnly) { app.ui.toast('Open an editable Markdown document first.'); return; }
    const list = findAbbreviations(doc.text);
    if (!list.length) { app.ui.toast('No abbreviations found. Define one like this: sediment delivery ratio (SDR).'); return; }
    markooj.doc.insert('\n\n' + toTable(list) + '\n\n: Abbreviations\n');
    app.ui.toast(`Inserted ${list.length} abbreviations.`, { kind: 'success' });
  },
});

// 3. A button on the Add-ins tab.
app.ribbon.addGroup('addins', {
  id: 'abbreviations', label: 'Abbreviations', order: 70,
  items: [{ type: 'big', command: 'abbreviations.insert', label: 'Abbreviations', icon: 'table' }],
});

// 4. A count on the status bar that follows the document.
app.status.addItem({
  id: 'abbreviations', side: 'right', order: 40,
  render(el) {
    const doc = app.docs.active();
    const n = doc && doc.kind === 'markdown' ? findAbbreviations(doc.text).length : 0;
    el.textContent = n ? `${n} abbr.` : '';
    el.title = 'Abbreviations defined in this document';
  },
});
app.events.on('doc:changed', () => app.status.refresh());
app.events.on('doc:active', () => app.status.refresh());

// 5. A new format in File → Save As → From add-ins.
app.exporter.register({
  id: 'abbreviations-csv', label: 'Abbreviations (CSV)', ext: 'csv',
  description: 'Every abbreviation and its meaning, for Excel.',
  run: (doc, ctx) => {
    const q = s => '"' + String(s).replace(/"/g, '""') + '"';
    return ['abbreviation,meaning', ...findAbbreviations(ctx.markdown).map(a => q(a.short) + ',' + q(a.long))].join('\r\n') + '\r\n';
  },
});

// 6. A setting in File → Options.
app.options.addSection({
  id: 'abbreviations', label: 'Abbreviations',
  render(el) {
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = app.settings.get('abbreviations.sort', true);
    box.addEventListener('change', () => app.settings.set('abbreviations.sort', box.checked));
    label.append(box, ' Sort the list of abbreviations from A to Z');
    el.append(label);
  },
});

// 7. A test that runs with Markooj's smoke test.
app.tests.register('add-in abbreviations: finds definitions', () => {
  const list = findAbbreviations('The sediment delivery ratio (SDR) and the Water Resources Board (WRB) agree.');
  app.assert(list.length === 2, JSON.stringify(list));
  app.assert(list[0].short === 'SDR' && list[0].long === 'sediment delivery ratio', JSON.stringify(list[0]));
});
```

After a reload you get:

- an **Abbreviations** button on the **Add-ins** tab that inserts a table at the cursor;
- a count such as "2 abbr." on the status bar;
- **Abbreviations (CSV)** in **File → Save As → From add-ins**;
- an **Abbreviations** section in **File → Options**;
- a test that runs with Markooj's smoke test.

## The API

The full contract is in [ARCHITECTURE.md](../ARCHITECTURE.md). These are the parts add-ins use most.

### Commands

```js
app.commands.register('myaddin.doThing', {
  label: 'Do the thing',              // the name in ScreenTips and the command search
  description: 'One sentence about what it does.',
  icon: 'sparkle',
  shortcut: 'Ctrl+Alt+Shift+T',       // optional
  run(args) { /* … */ },
  isEnabled() { return true; },       // optional: dims the button when false
  isActive() { return false; },       // optional: shows a toggle as on
  why() { return 'Open a document first.'; },  // optional: shown in the ScreenTip when the button is dimmed
});
app.commands.run('format.bold');      // run any command
```

Command ids are listed in [docs/help/keyboard-shortcuts.md](help/keyboard-shortcuts.md), and `commands()` lists them all in a macro. Use your own prefix for ids, such as `abbreviations.insert`, so they never clash with Markooj's own.

### Ribbon

```js
app.ribbon.addGroup('addins', {       // or 'home', 'insert', 'layout', 'references', 'review', 'view', 'developer'
  id: 'myaddin', label: 'My add-in', order: 70,
  items: [
    { type: 'big', command: 'myaddin.doThing', label: 'Do it', icon: 'sparkle' },
    { type: 'col', items: [
      { type: 'small', command: 'myaddin.a', label: 'A', icon: 'check' },
      { type: 'small', command: 'myaddin.b', label: 'B', icon: 'x' },
    ] },
  ],
});
```

Item types: `big`, `small` (with `text` to show text instead of an icon), `select`, `gallery`, `seg`, `row`, `col`, `sep` and `custom` (with `render(el)`). Every button runs a command, so it also works from the keyboard, the command search and macros.

### Documents and editing

```js
const doc = app.docs.active();            // {id, title, path, kind, text, dirty, meta, readOnly}
doc.setText(newText, 'myaddin');          // replace the whole Markdown text
app.editors.active().insert('**hi**');    // insert Markdown at the cursor, in any mode
markooj.doc.replace('colour', 'color');   // the macro API: insert, replace, find, selection, meta …
app.docs.create({ title: 'New', text: '# Hello' });
```

Always change documents through these calls, so undo, recovery and the editors stay in step.

### Rendering hooks

```js
app.hooks.preRender((text, doc) => text.replace(/:smile:/g, '🙂'));  // change the Markdown before it is drawn
app.hooks.postRender((el, doc) => { /* decorate the drawn page; read-only changes are safest */ });
```

Changes made in `postRender` are only on screen. Give anything you add to the page that must never reach the Markdown the attribute `data-mk-ui`.

### Export formats

```js
app.exporter.register({
  id: 'myformat', label: 'My format', ext: 'txt',
  description: 'Shown under the name in File → Save As.',
  run: async (doc, ctx) => {
    // ctx.markdown: the text, without comments and hidden notes unless the user asked for them
    // ctx.meta: the front matter; await ctx.html(): the export HTML; await ctx.plainText(): plain text
    return 'text, or a Uint8Array, ArrayBuffer or Blob';
  },
});
```

### Status bar, options and settings

```js
app.status.addItem({ id: 'myaddin', side: 'right', order: 40, render(el) { el.textContent = '…'; } });
app.status.refresh();
app.options.addSection({ id: 'myaddin', label: 'My add-in', render(el) { /* build your settings */ } });
app.settings.get('myaddin.size', 12);     // start your keys with your add-in's name
app.settings.set('myaddin.size', 14);
```

### Messages and dialogs

```js
app.ui.toast('Done.', { kind: 'success' });
const ok = await app.ui.confirm('Delete?', 'This cannot be undone.');
const name = await app.ui.prompt('Name', 'Your name', '');
const v = await app.ui.dialog({ title: 'Choose', body: '<p>HTML or an Element</p>',
  buttons: [{ label: 'Cancel', value: null }, { label: 'OK', value: 'ok', primary: true }] });
```

### Events

```js
app.events.on('doc:changed', ({ doc, origin }) => { /* … */ });
```

Useful events: `ready`, `doc:opened`, `doc:active`, `doc:changed`, `doc:saved`, `doc:closed`, `mode:changed`, `theme:changed`, `settings:changed`, `selection:changed`, `command:ran` and `editor:rendered`.

### Tests

```js
app.tests.register('add-in myaddin: does the thing', async () => {
  app.assert(1 + 1 === 2, 'arithmetic');
});
```

Tests run with Markooj's smoke test. See [BUILDING.md](BUILDING.md).

## Good habits

- Keep the interface text short and plain, in US English, like the rest of Markooj.
- Give every command a `description`: it becomes the ScreenTip.
- Do heavy work only when the user asks for it, not on every keystroke.
- Never send the user's text anywhere. Markooj works offline, and people count on that.
- Put a license line at the top of your file. An add-in is your own work, and you can choose its license.

## Publish your add-in in the store

The add-in store lists add-ins that live in their authors' own GitHub repositories. You keep your code, your license and your release schedule; the store only points to your releases. Markooj reads one list from the registry, [datakeen/markooj-addins](https://github.com/datakeen/markooj-addins), which is rebuilt every day and after every change, and downloads your files from your releases.

### 1. The folder format

A store add-in is a folder with these files:

| File | What it holds |
| --- | --- |
| `manifest.json` | Who and what the add-in is (below). |
| `main.js` | The code, at most 2 MB. It has the same shape as a single-file add-in: it runs as the body of a function with `app` and `markooj` in scope, plus `addin`: your add-in's `id`, `version` and folder (`dir`), and `addin.file(name)`, which reads a data file listed in `files` (pass `{ encoding: 'base64' }` for binary files). The header comment lines are not needed; the manifest replaces them. |
| `styles.css` | Optional styles (at most 2 MB), loaded while the add-in is on. Start your class names with your add-in's id so they never clash with Markooj's own. |
| Data files | Optional extra files, such as a word list, each listed in `files` in the manifest. All files together may be at most 50 MB. |

```json
{
  "id": "abbreviations",
  "name": "Abbreviations",
  "version": "1.0.0",
  "minMarkooj": "1.1.0",
  "author": "Your Name",
  "authorUrl": "https://github.com/your-name",
  "description": "List the abbreviations defined in a document.",
  "icon": "table",
  "color": "#30b0c7",
  "category": "writing",
  "files": []
}
```

| Field | Use |
| --- | --- |
| `id` | Required. 3 to 40 characters: lowercase letters, digits and hyphens. It never changes, and it names the folder the add-in is installed in. |
| `name`, `description`, `author` | Required. Shown on the card and the details page. |
| `version` | Required. A version number such as `1.2.0` ([semantic versioning](https://semver.org)). Raise it with every release. |
| `minMarkooj` | Required. The oldest Markooj version your add-in works with, such as `1.1.0`. |
| `authorUrl`, `icon`, `color` | Optional. A link for your name, an icon name from the list above, and the card's color as `#rrggbb`. |
| `category` | Optional. One of `writing`, `research`, `math`, `languages`, `export`, `productivity`, `developer`, `fun` or `other`. |
| `files` | Optional. Extra data files, as `[{"name": "words.txt", "size": 12345}]`. |

### 2. Start from the template

The easiest way is the [add-in template](https://github.com/datakeen/markooj-addin-template). It holds the Abbreviations example from this guide as a folder add-in, a README to fill in, and a GitHub Actions workflow that makes a release for you.

1. Open the template on GitHub and click **Use this template → Create a new repository**. Give it a name such as `markooj-abbreviations`, and make it **Public**.
2. Change `manifest.json` (a new `id`, your name and description) and write your code in `main.js`.
3. Try it in Markooj. The template's README shows how to load the folder while you work on it; then click **Reload add-ins** after each change.
4. Describe your add-in in `README.md`: what it does, how to use it, and anything it needs. The store shows this page as the add-in's details.

### 3. Publish a release

Markooj installs only what is attached to a GitHub Release: `manifest.json`, `main.js`, `styles.css` if you have one, and the data files listed in `files`.

With the template, set `version` in `manifest.json`, then make a tag with the same number and push it, for example `v1.0.0`. The workflow checks the manifest and publishes the release with the right files attached. You can also make the release by hand on GitHub (**Releases → Draft a new release**) and attach the files yourself.

### 4. Ask for your add-in to be listed

Open a pull request to [datakeen/markooj-addins](https://github.com/datakeen/markooj-addins) that adds one entry to `community-addins.json`:

```json
{
  "id": "abbreviations",
  "name": "Abbreviations",
  "author": "Your Name",
  "description": "List the abbreviations defined in a document.",
  "repo": "your-name/markooj-abbreviations",
  "category": "writing",
  "tags": ["abbreviations", "academic"]
}
```

An automatic check looks at the entry and at your latest release. A maintainer then reads the add-in and merges the pull request. [SUBMITTING.md](https://github.com/datakeen/markooj-addins/blob/main/SUBMITTING.md) in the registry lists every step and what is not allowed.

### 5. Updates

To update your add-in, raise `version` in `manifest.json` and publish a new release. The registry picks up your latest release within a day, and Markooj shows **Update** on your add-in's card. You do not need another pull request, unless you change the name, the description, the category or the tags.

People install your add-in because they trust what it says it does, so keep that trust: say in the README what the add-in does, never send the user's text anywhere without asking, and keep `main.js` readable.

## Sharing an add-in without the store

Share a single `.js` file however you like: a GitHub repository, a gist or an email. Users install it with **File → Add-ins → Install from file…**. If you think an add-in belongs in Markooj itself, open an issue or a pull request (see [CONTRIBUTING.md](../CONTRIBUTING.md)).

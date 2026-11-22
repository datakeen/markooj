# Add-ins

Add-ins add buttons, tools, Markdown features and export formats to Markooj. Find them in the add-in store inside Markooj and install them with one click, or write your own.

## The add-ins that come with Markooj

| Add-in | What it adds |
| --- | --- |
| **Readability** | **Add-ins → Readability**: a report with the Flesch reading ease, grade level and sentence lengths. **Long sentences** highlights sentences that are hard to read; click again to clear. |
| **SI Units** | **Add-ins → Format units**: turns quantities in the selection, such as `5 m/s^2`, into math with upright units and a thin space. |
| **Word Frequency** | **Add-ins → Word list**: inserts a table of the most used words. It also adds **Word list (CSV)** to File → Save As, with every word and its count, for Excel. |

## Browse the add-in store

1. Click **File → Add-ins**, then **Browse**.
2. Type in the search box, or pick a category: writing, research, math, languages, export, productivity, developer, fun or other.
3. Click an add-in to see its details: what it does, its version, its author, anything more it does (such as using the internet, under **Also does**), and the instructions from its author's page.
4. Click **Install**. The first time, Markooj asks you to turn on community add-ins: click **Turn on**. The add-in is ready at once; its buttons appear on the **Add-ins** tab or wherever it puts them.

The **Get add-ins** button on the **Add-ins** tab of the ribbon opens the same page, and **Updates** next to it checks for new versions.

Markooj reads the store's list from GitHub when you open Browse, and, while community add-ins are on and you have one from the store, checks for updates quietly once a day. Without an internet connection, Browse shows the last list it read and your installed add-ins keep working as before; installs and updates wait until you are back online.

## Update add-ins

When an author publishes a new version, its card says **Update**. Click it to update that add-in, or click **Update all** to bring every add-in up to date at once. Your settings for the add-in stay as they were.

Some add-ins need a moment to restart after an update. If Markooj asks, click **Reload add-ins**, which restarts the window. Your documents stay open.

## Turn add-ins on or off, or remove them

Click **File → Add-ins** (or **Add-ins → Manage**). Each installed add-in has a card with its name, version, author and what it does, and a switch to turn it on or off. If an add-in has a problem, its card shows the error, and the rest of Markooj carries on.

- **Turn off** an add-in to keep it but stop it from running.
- **Uninstall** moves it to the trash. You can install it again from Browse at any time.

Some changes take effect after **Reload add-ins**, which restarts the window. Your documents stay open.

## Markooj team and community add-ins

- Add-ins **made by the Markooj team** carry a check mark next to their name. They are published in repositories under [datakeen](https://github.com/datakeen) on GitHub.
- **Community** add-ins are written by other people and published from their own GitHub repositories. Each one was looked at when it was first added to the store, but later versions come straight from its author.

Add-ins from the store run only while the **Community add-ins** switch is on. It is at the top of the **Installed** tab and is off at first. The first time you install an add-in, Markooj explains in a few lines what an add-in can do and asks before it turns the switch on. You can turn the switch off again at any time: add-ins from the store then stop after a reload, and stay installed until you uninstall them.

## Safety

An add-in can do anything Markooj can do, including reading and changing your documents. So Markooj is careful about where add-ins come from:

- It downloads add-ins only from GitHub, from the author's own releases.
- It checks every file against the SHA-256 checksum in the store's list before it installs anything. If one check fails, nothing is installed.
- It refuses files that are too large (more than 50 MB for one add-in) and add-ins whose description file is not valid.

That keeps out broken and changed downloads, but it cannot tell whether an author means well. Install add-ins from people you trust, read an add-in's details page before you install it, and uninstall anything you no longer use. If you find an add-in in the store that does something it should not, please [report it](https://github.com/datakeen/markooj-addins/issues).

## Install an add-in from a file

You can still install an add-in that is not in the store:

- Click **Install from file…** and pick the add-in's `.js` file. Markooj copies it into your add-ins folder.
- Or put the file in the add-ins folder yourself: **Open add-ins folder** shows where it is. Then reload.

Read the file first if you can, and install it only if you trust the person who gave it to you.

## Write your own

An add-in starts with a few comment lines that name it, and then uses the same `app` object that Markooj is built on:

```js
// @name Hello
// @description Says hello from the ribbon
// @version 1.0
// @author You
// @icon sparkle
app.commands.register('hello.say', {
  label: 'Say hello',
  run: () => app.ui.toast('Hello, ' + (app.docs.active()?.title || 'world') + '!'),
});
app.ribbon.addGroup('addins', {
  id: 'hello', label: 'Hello',
  items: [{ type: 'big', command: 'hello.say', label: 'Hello', icon: 'sparkle' }],
});
```

Save it as `hello.js` in the add-ins folder and reload. A **Hello** button appears on the Add-ins tab.

What an add-in can use:

| Code | What it does |
| --- | --- |
| `app.commands.register(id, {label, run})` | A command for buttons, shortcuts, the command search and macros. |
| `app.ribbon.addGroup('addins', {id, label, items})` | Buttons on the Add-ins tab, or on any other tab. |
| `app.hooks.preRender(fn(text, doc))` | Change the Markdown before it is shown. Return the new text. |
| `app.hooks.postRender(fn(el, doc))` | Change the shown page after it is drawn. Read-only decorations are safest. |
| `app.exporter.register({id, label, ext, run(doc, ctx)})` | A new format in File → Save As. Return text or bytes. |
| `app.status.addItem({id, side, render(el)})` | Something on the status bar. |
| `app.options.addSection({id, label, render(el)})` | Settings for your add-in in File → Options. |
| `app.events.on('doc:changed', fn)` | React to edits. Also `doc:active`, `doc:saved` and `ready`. |
| `markooj.doc`, `markooj.ui` | The same document API that macros use. See [Macros and scripting](macros-and-scripting.md). |

The **Copy example** button on the File → Add-ins page copies the Hello example. The full guide for add-in authors, with a complete example, is [docs/ADDINS.md](https://github.com/datakeen/markooj/blob/main/docs/ADDINS.md) on GitHub.

## Put your add-in in the store

Start from the [add-in template](https://github.com/datakeen/markooj-addin-template) on GitHub: click **Use this template**, change the example, and publish a release. Then ask for your add-in to be listed with a small pull request to [datakeen/markooj-addins](https://github.com/datakeen/markooj-addins/blob/main/SUBMITTING.md). The steps are in [docs/ADDINS.md](https://github.com/datakeen/markooj/blob/main/docs/ADDINS.md#publish-your-add-in-in-the-store).

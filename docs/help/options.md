# Options

Click **File → Options**. Changes apply right away; there is no OK button to press.

## Appearance

- **Theme:** Match system, Light or Dark.
- **Start in:** the editing mode for new windows: Word, Inline, Simple or Read.
- **Document tabs:** at the top, at the bottom or on the left.
- **Page layout:** Print (paper pages) or Web (full width).

## Editor

- **Document font:** the reading font on the page, such as Charter (the default), Georgia, Cambria, Times New Roman, Palatino, Iowan Old Style, Segoe UI, Calibri, Arial or the system font. Exports use the fonts of the document theme (Layout → Theme).
- **Default text size:** in points, for documents that do not set their own. Home → Font Size changes the size of one document.
- **Inline math style:** how Word mode writes inline equations into the file, as `$…$` or `\(…\)`. Both always show.

## Typing and review

- **Smart quotes:** straight quotes become curly quotes as you type.
- **AutoCorrect as you type:** `--` becomes –, `(c)` ©, `(r)` ®, `(tm)` ™ and `...` …
- **Show comments and hidden notes while editing.**
- **Include comments in exports and prints:** off by default, so shared files and printouts never show your notes.

## Writing

- **Proofing language:** the language for documents that do not name their own.
- **Check writing as you type** and **Check spelling as you type.**
- **Long sentences:** mark sentences longer than this many words (30 to start with).
- **Audience**, **Formality** and **Domain:** the same goals as Review → Goals.
- **Show suggestions for:** Correctness, Clarity, Engagement and Delivery, each on or off.
- **Suggest words as I type:** gray word completion. Off by default.
- **Show synonyms when I double-click a word.**
- **Dictionary and rules:** your dictionary, and the rules you turned off (turn them back on here).

See [Writing Assistant](writing-assistant.md).

## Language

- **Default proofing language:** English (US) or English (UK), or a language from an installed pack.
- **Languages in Markooj:** the built-in languages and your installed packs, with **Remove** for packs. Packs with a word list show how many words they have, how many are checked so far, and a **Help improve** link.
- **Get more languages:** **Check for language packs** and **Install from file…**
- **Fonts for right-to-left languages:** the font for Urdu, Arabic, Persian and Punjabi (Shahmukhi) text.

See [Languages and right-to-left text](languages-and-rtl.md).

## Recovery

- **Keep unsaved text for** 7, 14, 30 or 90 days.
- **Open recovery folder** and **See recovered documents.**

See [Recover unsaved work](recover.md).

## Keyboard

Every keyboard shortcut, grouped like the ribbon, with Word's shortcuts marked. Search by name or by key. See [Keyboard shortcuts](keyboard-shortcuts.md).

## Privacy

- **Load pictures from the web in documents:** off by default. A picture on someone's server tells them when you opened their document. Links still open in your browser when you click them.

See [Privacy](privacy.md).

## Writing goals

- **Daily goal:** words a day, or empty for none.
- **Show the goal ring in the status bar.**
- **Celebrate when I reach a goal.** It stays still when your system asks for reduced motion.
- **Typewriter scrolling.**

## Developer

- **Language for new macros:** Python or JavaScript.
- **Stop macros that run longer than** this many seconds (0 means no limit).
- **Start Python in the background when Markooj opens**, so the first Python run is faster.

## Add-ins

Add-ins can add their own sections to Options. See [Add-ins](add-ins.md).

## Where settings are kept

Settings are kept in a file called `settings.json` in your Markooj settings folder:

- Installed copy: `%APPDATA%\Markooj` (for example `C:\Users\you\AppData\Roaming\Markooj`).
- Portable copy: the `data` folder next to `Markooj.exe`.

The same folder holds recovered text, your macros and your add-ins. Your documents are never stored there.

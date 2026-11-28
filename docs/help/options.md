# Options

Click **File → Options**. Changes apply right away; there is no OK button to press.

## Appearance

- **Theme:** Match system, Light or Dark.
- **Start in:** the editing mode for new windows: Word, Inline, Simple or Read.
- **Document tabs:** at the top, at the bottom or on the left.
- **Page layout:** Print (paper pages) or Web (full width).

## Window and ruler

- **Split panes:** stacked or side by side, for View → Split and View Side by Side. Until you choose, Split stacks the panes like Word and View Side by Side puts the documents next to each other.
- **Second pane starts in:** the editing mode the second pane uses first. Each pane's own bar changes it any time.
- **Synchronous Scrolling follows:** at the same place in the text (the same paragraph in a split, the same heading for two documents) or at the same distance from the top.
- **Scroll side-by-side documents together:** on by default, like Word. **Scroll split panes together:** off by default.
- **Ruler units:** Automatic (inches in the United States, centimeters everywhere else), Centimeters or Inches.
- **Show the ruler:** the same as View → Ruler.
- **Remember guides for each file:** off by default, so guides last until you close the document. When on, Markooj keeps them in its settings by file name, never in the file.

## Editor

- **Document font:** the reading font on the page, such as Charter (the default), Georgia, Cambria, Times New Roman, Palatino, Iowan Old Style, Segoe UI, Calibri, Arial or the system font. Exports use the fonts of the document theme (Layout → Theme).
- **Default text size:** in points, for documents that do not set their own. Home → Font Size changes the size of one document.
- **Inline math style:** how Word mode writes inline equations into the file, as `$…$` or `\(…\)`. Both always show.

## Typing and review

- **Smart quotes:** straight quotes become curly quotes as you type.
- **AutoCorrect as you type:** `--` becomes –, `(c)` ©, `(r)` ®, `(tm)` ™ and `...` …
- **Close brackets and quotes automatically:** ( [ { and quotes add their closing partner, with the cursor in between. On to start with.
- **Close Markdown marks too:** `*`, `_`, a backtick and `~~` close themselves in Simple and Inline mode.
- **Close $ for math:** `$` adds the closing `$`; a number right after it keeps the dollar sign as typed.
- **Slash commands:** `/today`, `/date`, `/time` and `/hijri` while you type.
- **Date and time format:** what Alt+Shift+D, Alt+Shift+T, `/today` and `/time` insert. **Change…** opens the Date and time dialog.
- **Show comments and hidden notes while editing.**
- **Include comments in exports and prints:** off by default, so shared files and printouts never show your notes.

## Writing

- **Proofing language:** the language for documents that do not name their own.
- **Check writing as you type** and **Check spelling as you type.**
- **Long sentences:** mark sentences longer than this many words (30 to start with).
- **Audience**, **Formality** and **Domain:** the same goals as Review → Goals.
- **Show suggestions for:** Correctness, Clarity, Engagement and Delivery, each on or off.
- **Suggest words as I type:** gray word completion. Off by default.
- **Accept technical terms and place names:** hydraulics, hydropower and fluid mechanics terms, engineering software and units, and US, world and Pakistani place names are never marked as misspelled. On by default.
- **Show synonyms when I double-click a word.**
- **Dictionary and rules:** your dictionary, and the rules you turned off (turn them back on here).

See [Writing Assistant](writing-assistant.md).

## Language

- **Interface language:** the language of menus, buttons and messages (11 languages, each shown in its own script). The change is immediate and your documents are not touched. **Match the system language** follows your computer. The status bar's **A文** button and the command search (Alt+Q, *Change interface language*) change it too. The help pages are in English for now.
- **Default proofing language:** English (US) or English (UK), or a language from an installed pack.
- **Keyboard:** the **Typing keyboard** (English, Urdu Phonetic, Arabic 101, Persian Standard or Punjabi Shahmukhi; nothing is installed on your computer), the right-to-left keyboard that **Ctrl+Shift+K** switches to (**Keyboard for Ctrl+Shift+K**), **Also type in search boxes and dialogs** (off: only the document), and **Show the on-screen keyboard**.
- **Aarab:** when the **Aarab group** shows on Home (Automatic, Always or Never), and **Hide aarab in Read mode**.
- **Languages in Markooj:** the built-in languages and your installed packs, with **Remove** for packs. Packs with a word list show how many words they have, how many are checked so far, and a **Help improve** link.
- **Get more languages:** **Check for language packs** and **Install from file…**
- **Fonts for right-to-left languages:** the font for Urdu, Arabic, Persian and Punjabi (Shahmukhi) text.

See [Languages and right-to-left text](languages-and-rtl.md).

## Features

Optional parts of Markooj that download only when you want them. Each shows what it powers, its download size and the space it uses.

- **Pandoc:** save as LaTeX, OpenDocument, Rich Text, PowerPoint, Typst and more, and open those files. About 40 MB to download.
- **DjVu tools** (Windows): open DjVu files and save as DjVu. About 15 MB. On macOS and Linux, Markooj shows the Homebrew or apt command instead.
- **Python macros:** run macros written in Python on the Developer tab. About 6 MB.
- **Install**, **Update**, **Remove** and **Cancel** next to each; **Install from file…** for a feature file you downloaded yourself; **Check for updates**; **Open folder**.

Every download is checked against the checksum that came with Markooj before anything is installed. The Windows installer asks which features you want, and the Welcome screen asks on other systems; both download in the background on the first start. The Windows portable zip includes every feature. Help → Features and **Features** in the command search (Alt+Q) open this section too.

## Tables

- **Turn tables pasted from Word, Excel and Google Sheets into Markdown tables:** on by default. Paste as plain text (Ctrl+Shift+V) skips this for one paste.
- **Merged cells:** a merged cell is split when you paste it. Choose **Leave the extra cells empty** (the default) or **Repeat the text in each cell**.
- **Copy tables so Word and Excel paste them as real tables:** on by default. Copying cells or a whole table adds a bordered table and tab-separated text to the clipboard.

See [Figures and tables](figures-and-tables.md).

## Recovery

- **Keep unsaved text for** 7, 14, 30 or 90 days.
- **Open recovery folder** and **See recovered documents.**

See [Recover unsaved work](recover.md).

## Keyboard shortcuts

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

The same folder holds recovered text, your macros, your add-ins and the features you installed (in `features`). Your documents are never stored there. Uninstalling Markooj removes the downloaded features; updating keeps them.

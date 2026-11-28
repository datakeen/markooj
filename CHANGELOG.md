# Changelog

All notable changes to Markooj are listed here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and version numbers follow [Semantic Versioning](https://semver.org/): a bug fix raises the last number (1.0.1), a new feature the middle one (1.1.0), and a change that can break documents, macros or add-ins the first one (2.0.0).

## [Unreleased]

## [1.2.0] - 2026-11-28

Markooj in 11 languages, a Windows install half the size, split and side-by-side windows, rulers and guides, built-in right-to-left keyboards, and tables that travel to and from Word and Excel.

### Added

- **Markooj in 10 more languages.** Menus, buttons, ScreenTips, dialogs and messages now come in Chinese (Simplified), Urdu, Roman Urdu, Punjabi (Shahmukhi), Japanese, Arabic, Swedish, Spanish, French and Portuguese (Brazil), as well as English. To switch, click the **A文** button on the status bar, or use **File → Options → Language → Interface language**, the command search (Alt+Q, *Change interface language*) or the first step of the Welcome screen. The interface changes right away; your documents, saved or not, stay exactly as they are, and they keep their own language. **Match the system language** follows your computer. Help pages are in English for now; native speakers can send corrections through the contact form.
- **Right-to-left interface.** In Urdu, Punjabi and Arabic the whole window mirrors: ribbon, File pages, Options, menus, dialogs, panes and the status bar read from right to left, while your document keeps its own direction. Keyboard shortcuts, code and equations always read left to right. Urdu and Punjabi menus use the bundled Noto Naskh Arabic font, with Nastaliq for large headings.
- **Numbers, dates and counts in your language.** Word, page and issue counts use the right singular and plural forms ("1 word", "3 words") and your language's digit grouping; dates in File → Info, Recover, Writing goals and the Add-in Store follow the interface language. In English, messages that used to say "1 words" or "1 fixes" now use the singular.
- **Windows installer asks for your language.** Its first screen lists all 11 languages, each in its own script, starting with your Windows display language. The installer and Markooj both use your choice. The installer's own steps are translated into Chinese, Japanese, Arabic, Swedish, Spanish, French and Portuguese (Brazil); the "Choose extra features" step is translated into all 11 languages and reads right to left in Urdu, Punjabi and Arabic. For IT departments, `/LANGUAGE=` accepts the same 11 codes and skips the screen.
- **Optional features.** Pandoc (more file formats), the DjVu tools and Python macros now download only when you want them. **File → Options → Features** lists each one with what it does, its download size and the space it takes, with **Install**, **Update**, **Remove** and **Cancel**. **Help → Features** and the command search (Alt+Q) open it too. Every download is checked against the checksum that came with Markooj before anything is installed, and Cancel keeps nothing.
- **Install from file…** in File → Options → Features: on a computer without internet, download a feature file on another computer and install it from there.
- **The Windows installer asks for your language first** (English, 中文(简体), اردو, Roman Urdu, پنجابی (Shahmukhi), 日本語, العربية, Svenska, Español, Français, Português (Brasil)), then which extra features you want, each with its size. Markooj downloads them in the background the first time it starts, with a progress card you can cancel. On macOS and Linux, the Welcome screen asks **Choose extra features** (or Skip). Silent installs accept `/LANGUAGE=` and `/FEATURES=`, for example `/S /LANGUAGE=ur /FEATURES=pandoc,python`.
- **Python macros install on first use.** The first time you run a Python macro without Python, Markooj offers to install it and then runs the macro.
- **View → Window, like Word:** New Window, Arrange All, Split, View Side by Side, Synchronous Scrolling, Reset Window Position and Switch Windows.
  - **Split** (Ctrl+Alt+S) shows the document in two panes, side by side or one above the other, each with its own editing mode (for example Word next to Simple). Typing in one pane shows up in the other at once. Drag the divider to resize; double-click it for two equal panes; Esc on the divider closes the split.
  - **View Side by Side** shows two open documents next to each other, both editable, with Swap and its own Save (Ctrl+S in that pane).
  - **Synchronous Scrolling** keeps both panes at the same paragraph (in a split) or the same heading (for two documents), or at the same distance from the top.
  - **New Window** opens the document in a second window, for example on a second screen. Both windows show the same text, and saving from either one saves the same file. If both change the same words at the same moment, the replaced text is kept in File → Recover. **Open in New Window…** opens another file in a window of its own, and Ctrl+F6 / Ctrl+Shift+F6 move between Markooj windows.
- **View → Ruler** shows rulers above and beside the page in Word, Inline and Read modes, with margins and paragraph indents, in centimeters or inches (inches in the United States). They stay sharp at every zoom and work in dark mode and right-to-left documents.
- **Guides,** as in Adobe Illustrator: drag from a ruler onto the page to add one, drag it back to remove it, double-click it to type an exact position. **View → Guides** and **Add a guide…** do the same from the keyboard, and **Clear guides** removes them all. Guides never print, export or enter your file, and can be remembered for each file.
- **File → Options → Window and ruler.**
- **Brackets and quotes close themselves** in Word, Inline and Simple mode. Type ( [ { or a quote and the closing one appears with the cursor between; type the closing one and the cursor steps over it; select text first and it gets wrapped; Backspace removes an empty pair. With smart quotes on, " gives “ ” and ' gives ‘ ’. In Simple and Inline mode `*`, `_`, backticks and `~~` close too (type ** for bold), and `$` closes for math while a price like $5 stays as typed. Each can be turned off in **File → Options → Typing and review**.
- **Date and time dialog** (Insert → Date & time): a calendar, formats such as 27/11/2026, November 27, 2026, ISO or your own pattern, the day name if you want it, and Gregorian or Hijri dates with month names in English, Urdu or Arabic and a one-day adjustment for local moon sighting. **Alt+Shift+D** inserts today's date and **Alt+Shift+T** the time, in the format you used last, as in Word.
- **Slash commands:** type /today, /time or /hijri and press Space or Enter; /date opens the date dialog. A small list shows the choices; Esc closes it.
- **Multiple cursors in Simple mode:** Alt+click adds a cursor, Ctrl+Alt+Up and Ctrl+Alt+Down add one above or below, Ctrl+D selects the next match, Alt+F3 selects all matches, and Esc goes back to one cursor. Typing, deleting, moving and pasting happen at every cursor, and Ctrl+Z undoes it all at once.
- **Home → Select all** and **Home → Replace** buttons.
- **Better spelling suggestions:** the word you most likely meant now comes first. "calander" offers calendar before colander, "coreection" offers correction, "syncrounus" offers synchronous, and "monotonusity" offers monotony and monotonousness. Markooj weighs common slips (swapped letters, a missed double letter, one vowel for another, a neighboring key), how a word sounds and how common it is.
- **Technical terms and place names** are no longer marked as misspelled: hydraulics, hydropower, river engineering and fluid mechanics terms (penstock, feedwater, tailrace, spillway, hydrograph, Manning, Froude …), engineering software and units, US states and places, the world's countries and major cities, and the provinces, cities, rivers, dams and barrages of Pakistan. Names keep their capital letters ("Lahore" is fine, "lahore" is marked). Turn the list off in File → Options → Writing, with **Review → Proofing → Technical terms**, or from the command search.
- **"An" or "and"?** When "an" sits between two describing words ("black an white"), the card suggests "and" first and "a" second.
- **Commas between describing words:** a gentle style hint for three or more describing words in a row, such as "a beautiful, engaging, modern, and surprising page".
- **Varied explanations:** when the same mistake appears several times, each card words its message a little differently. The meaning, the fix and the Why? text stay the same.
- **Paste tables from Word, Excel, Google Sheets and LibreOffice** in any mode, and they become real Markdown tables, with the header row, bold, italic, strikethrough, links, superscript, line breaks in cells and column alignment (numbers from Excel line up on the right). Office styling is left out. Pasting several cells into a table fills it from the cell with the cursor, like Excel.
- **Copy tables to Word and Excel:** select cells (or the whole table) and press Ctrl+C, or click **Table Design → Copy for Word/Excel**. Word and Excel paste a real table with borders, and Excel gets every value in its own cell.
- **File → Options → Tables:** turn Office table pasting and copying on or off, and choose what happens to merged cells.
- **Numbered equations and pictures with captions inside table cells.** They are numbered in document order, listed in the Cross-reference dialog and kept in Word, PDF and web page exports. Insert → Equation in a cell writes the equation on one line so it fits, and Insert Caption on a picture in a cell captions the picture.
- **Pictures from MarkText, Typora, Obsidian and other editors** now show in every mode, in print and PDF, and in exports: full Windows paths, backslashes, paths with spaces or %20, file:/// addresses, ~/ paths, paths relative to the document's folder, HTML `<img>` and Obsidian `![[picture.png]]`.
- **"Find this picture: it was at …"** shows where a picture is missing, with **Locate…** and **Remove**. Locating one also fixes the other missing pictures in the same folder. **Insert → Find Missing Pictures** and a note in the status bar list them all.
- **Type Urdu, Arabic, Persian and Punjabi without installing a keyboard.** Four built-in layouts: Urdu Phonetic (CRULP), the one most people use in Pakistan; Arabic (101); Persian (Standard, ISIRI 9147); and Punjabi Shahmukhi (Urdu Phonetic plus ݨ, ڵ, ݪ and ۓ). Keys are read by their place on the keyboard, so they work with any keyboard, in Word, Inline and Simple modes. If your computer already types these letters, Markooj leaves your keyboard alone.
- **Switch keyboards in one click or one key:** the keyboard chip on the status bar (EN / اردو / عربي / فارسی / پنجابی), **Ctrl+Shift+K** (English and your last right-to-left keyboard), View → Keyboard, Alt+Q "keyboard", or File → Options → Language → Keyboard.
- **On-screen keyboard** (View → On-screen): every key of the layout with its Shift and AltGr layers. Click a key to type it.
- **Home → Aarab**, shown while you write Urdu, Arabic, Persian or Punjabi: **Remove Aarab** (the selection, or the whole document, with Undo), buttons for zabar, zer, pesh, shadd, jazm, tanween and khari zabar on the letter before the cursor (click again to take a mark off), **Hide Aarab** (Read mode without the marks; your file keeps them) and **From Word List** (adds aarab to words the language pack knows with only one reading). Ctrl+Alt+Shift shortcuts and KeyTips (Alt, H, D …) for all of them.
- The Urdu and Punjabi word lists have aarab for 58 more very common words (in the next language pack release).
- **Website:** a "Try it" section that switches a short sample document between Word, Inline, Simple and Read modes, with bold, italic, a table, an equation and a diagram; nothing you type leaves your browser. A Markdown lens over the headline, Markdown symbols that drift away from the mouse and turn into what they mean, a small card that types Markdown and shows the result, and a new 404 page whose `# 404` turns into a heading when you point at it.

### Changed

- **Markooj installs much smaller.** On Windows it takes about 360 MB instead of 730 MB, and the installer is about 120 MB instead of 178 MB. The Mac and Linux downloads leave Pandoc out too, so they are smaller as well. Markooj keeps only the Chromium language files for its interface languages and leaves out the WebGPU shader compiler it never uses.
- **The Windows portable zip is the full offline copy:** Pandoc, the DjVu tools and Python macros are all included.
- **When Pandoc or the DjVu tools are missing,** the messages, Check Tools and Save As say "Install … from File → Options → Features", with an Install button, instead of "Repair Markooj".
- **Uninstalling Markooj on Windows** also removes the features it downloaded; updating keeps them.
- **Ctrl+A selects only your document:** the Markdown in Simple mode, the page in Word and Read mode, or the preview after you click in it. The ribbon, outline and status bar are never selected, also with right-click → Select all.
- **Paste as plain text** (Ctrl+Shift+V or Ctrl+Alt+V) reads the clipboard more reliably and works in every editing mode; Read mode tells you how to go back to editing.
- In Simple mode, **Ctrl+Shift+D** now duplicates a line; Ctrl+D selects the next match.
- **Commonly confused words** (affect/effect, then/than, your/you're, lose/loose, principal/principle, complement/compliment, advice/advise) are marked only when the words around them leave no doubt.
- **A quieter passive-voice hint:** at most one per paragraph, and never for phrases such as "is marked as" or "is known as", or clauses such as "when the file is opened".
- **Unit and key names stay as written:** MB, min and Ctrl are no longer "corrected" to megabytes, minutes or Control, and software names such as MATLAB and ANSYS are not treated as abbreviations to spell out.
- **Word and LibreOffice exports** keep line breaks inside table cells and show the caption under a picture in a table cell.
- **Mixed Urdu or Arabic and English is steadier:** a paragraph reads in the direction of its first real letter even when it starts with math or code; English links, bold words, code and math inside an Urdu paragraph (and Urdu inside English) stay together; lines broken with Shift+Enter each find their own direction; and Read mode keeps numbers and punctuation next to the words you put them with. Choosing a right-to-left keyboard in an empty paragraph moves the cursor to the right at once.
- **Open, Save As and Choose a file dialogs** open over the window you are working in, and **F6** also stops at the second pane of a split.
- **File → Options → Keyboard** is now called **Keyboard shortcuts**, so it is not mixed up with the typing keyboards in File → Options → Language → Keyboard.
- **Website:** sections fade in as you scroll, cards and links get small hover motions and a soft light that follows the mouse, and every effect stays still when your system asks for reduced motion. KaTeX, Marked and Mermaid are kept on the site with their licenses and load only when "Try it" needs them. The "Open, convert and export" card says that Pandoc and the DjVu tools are optional features.

### Fixed

- With smart quotes on, typing “ now adds the closing ” right away, and pressing " again steps over it instead of adding a second “.
- "effects" used as a plural noun was marked as a mistake for "affects".
- Technical words such as penstock, feedwater and tailrace were marked as typos for "pen stock", "feed water" and "tail race".
- Numbered equations written inside a line of text lost a "$" in Word, LaTeX and other Pandoc exports.
- Pasting from Excel into Word mode could insert a picture of the cells instead of the table.
- An Urdu paragraph that started with an equation or `code` was laid out left to right.
- The installed copy no longer carries unused copies of libraries (extra builds of MathLive, pdf.js, pdf-lib and highlight.js, and parts of Mermaid already inside its bundled file).

## [1.1.1] - 2026-11-23

A Welcome screen, a short What's new after each update, and messages that start with what you can do.

### Added

- **A Welcome screen.** The first time you start Markooj, it shows the main features: Word-like writing, the Writing Assistant, equations and cross-references, citations, Save As, the four modes, right-to-left languages and the add-in store. Each has a **Show me** button that starts a short guided tour on the real buttons. **Take the 2-minute tour** and **Start writing** are one click away. Open it any time from **Help → Welcome**, or press **Alt+Q** and type `welcome`.
- **What's new after each update.** Once after an update, Markooj shows the main changes of the new version, with **See all changes** for the full list.
- **A calm start when you open a file.** If you start Markooj by opening a document, the Welcome waits as a small button in the status bar instead of covering your page.
- **A new tutorial: Citations from a BibTeX library.**
- **Writing messages** in CONTRIBUTING.md: how every message in Markooj is written.

### Changed

- **Messages lead with what you can do.** Toasts, dialogs and error cards now say first how to fix things, often with a button that does it (**Try again**, **Check again**, **Copy command**, **Open folder** …), then what still works. Technical details stay one click away, under **Technical details**.
- **Optional tools stay quiet at start.** Markooj no longer warns about DjVuLibre or pdf2djvu when it starts. It helps at the moment you open a DjVu file or pick DjVu in Save As, and **Help → Check Tools** always shows the full status.
- **Help → Check Tools** opens "Your tools are ready" or "Almost everything is ready". Each tool says what it is for and either **Ready** or how to fix it, with **Check again**, **Copy details** and **Report this**.
- **Save As** cards for formats that need a tool you do not have yet stay clickable: a click shows how to get the tool for your system, with a **Copy command** button for macOS and Linux.
- The old "Take a two-minute tour?" message on the first start is replaced by the Welcome screen.

### Fixed

- **DjVu on Windows.** Markooj 1.1.0 said "DjVuLibre is missing" at every start, although the official DjVuLibre build for Windows was there: that build prints no version number for `ddjvu --help`. The check now recognizes that build.

## [1.1.0] - 2026-11-22

Markooj for macOS and Linux, an add-in store, a website, full Urdu spelling, and new language packs for Urdu, Arabic and Punjabi.

### Added

- **Markooj for macOS and Linux.** Disk images for Macs with an Apple chip and with an Intel chip, and an AppImage, a `.deb` package and a `.tar.gz` for Linux, next to the Windows installer and portable zip. Pandoc comes with every copy. GitHub Actions builds every installer from the same source when a version is tagged.
- **A website** at [datakeen.github.io/markooj](https://datakeen.github.io/markooj/), with every feature, screenshots of Markooj at work, and download links for each system.
- **A repository for language packs**, [datakeen/markooj-language-packs](https://github.com/datakeen/markooj-language-packs). The word lists and rules are plain spreadsheet files that native speakers can improve without writing code. GitHub checks every change and publishes the packs on its own.
- **Starter packs for Urdu (Pakistan), Arabic (Saudi Arabia, Modern Standard) and Punjabi (Pakistan, Shahmukhi, right to left).** Each has a word list of common words with aarab and Roman spellings, letter-form and punctuation checks, common misspellings and style hints. The lists are written from scratch and shared under CC BY-SA 4.0.
- **An add-in store.** **File → Add-ins → Browse** lists add-ins from the Markooj add-in registry, [datakeen/markooj-addins](https://github.com/datakeen/markooj-addins), with search, categories and a details page for each one. Install, update or remove an add-in with one click, or bring all of them up to date with **Update all**. Markooj downloads add-ins only from GitHub and checks every file against its SHA-256 checksum before it installs anything. Add-ins made by the Markooj team carry a check mark; add-ins from the store run only after you turn on **Community add-ins** (off at first; Markooj asks the first time you install one). File → Add-ins now has three tabs: **Installed**, **Browse** and **Language packs**, and the Add-ins ribbon tab has **Get add-ins** and **Updates**.
- **Add-ins in a folder**, with a `manifest.json`, a `main.js` and an optional `styles.css`, published as GitHub releases from the author's own repository. The [add-in template](https://github.com/datakeen/markooj-addin-template) has a complete example and a workflow that makes the release. Single-file add-ins keep working as before.
- **Full Urdu spelling** with about 95,000 words. Every unknown word is underlined, and suggestions are ranked by how close they are, by Urdu letters that sound or look alike, and by how common the word is. Urdu word list from the Urdu Spell Checker v1.0 by the Center for Language Engineering (CLE), KICS, UET Lahore (originally CRULP), used under the GNU GPL v3. The Urdu pack is now version 2.1.0. File → Options → Language shows the credits and word counts of each pack.
- **Near-miss spelling** for the Arabic and Punjabi packs. While a word list is still small, Markooj underlines only words that look like a typo of a known word, and suggests that word. Unknown words that are not near a known one are left alone, so you see few false alarms.
- **Punjabi (Shahmukhi)** as a document language, written right to left in the Nastaliq font.
- **Word counts and "Help improve" in Options.** File → Options → Language shows how many words each pack has, how many a native speaker has checked so far, and a **Help improve** link to the guide for contributors.

### Changed

- Language packs now come from the language packs repository. The Persian pack moved there unchanged in content, as version 2.0.0.
- Language packs use a new format with word lists, Roman spellings and near-miss spelling. Packs in the old format still install.

## [1.0.0] - 2026-11-21

The first public release.

### Writing and editing

- **Four editing modes for one Markdown file:** Word (click and type on the page), Inline (the paragraph you are in shows its Markdown), Simple (Markdown and a live preview) and Read (the finished document). Switch with Ctrl+1 to Ctrl+4 or Ctrl+Shift+M; the place you were stays put.
- **A ribbon like Word's:** File, Home, Insert, Layout, References, Review, View, Developer, Add-ins and Help, with ScreenTips on every control and a reason on every dimmed one.
- **Pin or unpin the ribbon:** Show tabs and commands, Show tabs only, or Full-screen mode. Ctrl+F1 or a double-click on a tab switches.
- **KeyTips:** press Alt or F10 and type the letters, as in Word. They also work with Urdu, Arabic and Persian keyboard layouts.
- **Word's keyboard shortcuts** wherever Markdown has the same thing, listed and searchable in File → Options → Keyboard.
- Undo one keystroke at a time, Format Painter, Styles, Find and Replace, Go To, Repeat (F4), paste from Word with its formatting, paste as plain text, drag-and-drop and pasted pictures.
- **Change Case** (Shift+F3 and the Aa menu): Sentence case, lowercase, UPPERCASE, Capitalize Each Word, tOGGLE cASE and Title Case with APA and Chicago rules.
- **One text size per document**, as Markdown allows: Font Size, Grow Font and Shrink Font change the body size (saved as `fontsize:`), used on screen, in print and in PDF and Word exports.
- AutoCorrect (`--` to –, `(c)` to ©, `...` to …) and smart quotes.
- **What's this in Markdown?** (Ctrl+Shift+/) shows the Markdown behind the selection.
- Promote, demote and move paragraphs (Alt+Shift+arrows), formatting marks (Ctrl+Shift+8), 1.5 line spacing (Ctrl+5).
- Page layout on the Layout tab: margins, page size, one or two columns, line and paragraph spacing, and four document themes. Saved in the document.
- Templates: research paper, lab notebook, thesis chapter, meeting notes and literature review.
- Document tabs at the top, bottom or left, an outline of headings, zoom, Print and Web layout, Focus, typewriter scrolling, and light and dark themes.
- The detected Markdown flavor on the status bar (CommonMark, GitHub, Pandoc, Obsidian, MultiMarkdown, R Markdown, Quarto, MDX), and **Render as** to choose the flavor exports use.

### Equations

- **Visual equation editor** with a LaTeX box kept in step: palettes (basic, big operators, brackets, matrices with a size picker, accents, Greek, symbols, arrows, units), typing shortcuts, an on-screen math keyboard, and recent and favorite equations.
- Inline and display equations, a Numbered switch and a label.
- **Math macros:** your own LaTeX commands for all documents or for one document. Accepts `\newcommand`, `\renewcommand`, `\def`, `\DeclareMathOperator` and arguments, points out extra text instead of refusing a line, and has a gallery of examples.

### Numbering, references and citations

- **One numbering system** for equations, figures, tables and sections, in the Pandoc-crossref syntax. Plain or chapter numbering, a choice of separator and label names, and numbers in a margin of their own.
- **Insert Caption** and a **Cross-reference** dialog like Word's. References update themselves, show a preview on hover, jump on Ctrl+click, and show in red with a fix when broken. Update (F9).
- **Citations** from a BibTeX library in APA, Chicago or IEEE, with page numbers and a bibliography that fills itself. Pandoc exports use citeproc with the same style.
- Footnotes, a table of contents, word count with characters, equations and citations, and a readability report.

### Writing Assistant

- Spelling for US and UK English, and grammar from Harper, all offline.
- Checks for correctness (including over 40 common wrong prepositions), clarity (long sentences, wordy phrases, passive voice, hidden verbs, undefined abbreviations, mixed spellings), engagement (weak phrases, overused words, repeated sentence starts) and delivery (contractions, informal words, hedging).
- Colored underlines, a pane with a writing score and categories, cards with Accept, Dismiss, Ignore rule, Add to dictionary and **Why?**, and Accept all safe fixes.
- Goals for audience, formality and domain (general, academic, business).
- F7 steps through suggestions like Word's Editor; Alt+F7 and Alt+Shift+F7 move between them.
- Synonyms on a double-click and a Thesaurus pane (Shift+F7) from WordNet.
- Optional word completion as you type.

### Tables

- Insert a table from a grid, click into any cell and type; Tab and Shift+Tab move between cells, and Tab in the last cell adds a row.
- Contextual **Table Design** and **Table Layout** tabs: header row, five table styles, insert and delete rows and columns, select, column alignment, sort, distribute columns, format the Markdown, and convert text to a table and back.
- Gridlines while editing, never printed. Every change rewrites only that table, as a standard pipe table.

### Languages and right-to-left text

- Right-to-left writing for Urdu, Arabic and Persian, with each paragraph finding its own direction.
- Right-to-left and Left-to-right paragraph buttons (Ctrl+Right Shift and Ctrl+Left Shift), and a document language and direction saved in the front matter and used in exports.
- Bundled fonts: Noto Nastaliq Urdu, Noto Naskh Arabic and Vazirmatn.
- **Language packs** with spelling dictionaries, Writing Assistant checks and font choices, downloaded from GitHub or installed from a file, each file checked against its SHA-256.

### Comments, notes and recovery

- Comments as margin bubbles, and hidden notes (`%%…%%`). Both stay out of Read mode, prints and exports unless you include them; Word and OpenDocument exports then get real comments.
- Compare with the saved version.
- **File → Recover** keeps the text of every unsaved document for 7, 14, 30 or 90 days, also after a crash.
- File → Info edits the document's properties (title, authors, date, keywords, abstract and more) as front matter.

### Open and export

- Opens Markdown, Word, OpenDocument, Rich Text, LaTeX, HTML, EPUB, reStructuredText, Org, MediaWiki, Typst, Jupyter notebooks and more as Markdown, and shows PDF and DjVu files page by page with Edit as text.
- Saves as Markdown, PDF, Word, EPUB, web page, plain text, LaTeX, OpenDocument, Rich Text, PowerPoint, JATS XML, reStructuredText, Org, AsciiDoc, MediaWiki, Jupyter notebook, Typst and DjVu.
- **Pandoc, pdf2djvu and DjVuLibre bundled** in every copy, with a self-check at start and **Check Bundled Tools** to see what works if one goes missing.
- Exports carry the document's properties, page layout, text size, numbering, citations, diagrams and right-to-left text.
- Print with a preview, and Save as PDF.

### Automation and add-ins

- **Macros in Python and JavaScript** with a recorder, a macro editor with an API reference and examples, a Python console, run Python code from a document, and shortcuts and ribbon buttons for macros.
- **Add-ins:** one JavaScript file adds commands, ribbon buttons, rendering hooks, status bar items, settings and export formats. Bundled: Readability, SI Units and Word Frequency.

### Writing goals

- A word target per document and a daily goal with a progress ring, a streak, 15, 25 and 45 minute sprints, and a quiet celebration when a goal is reached.

### Help

- An offline reference manual (F1), guided tutorials, a keyboard shortcut list, What's New, Report a Problem and About Markooj, on the Help tab and in File → Help.

### Install and privacy

- Windows installer and a portable zip that keeps its settings next to `Markooj.exe`.
- Works offline. The internet is used only to download language packs, for web pictures when you allow them, and for links you click.
- Free and open source under the GNU Affero General Public License, version 3 or later.

[Unreleased]: https://github.com/datakeen/markooj/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/datakeen/markooj/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/datakeen/markooj/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/datakeen/markooj/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/datakeen/markooj/releases/tag/v1.0.0

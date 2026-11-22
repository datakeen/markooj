# Changelog

All notable changes to Markooj are listed here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and version numbers follow [Semantic Versioning](https://semver.org/): a bug fix raises the last number (1.0.1), a new feature the middle one (1.1.0), and a change that can break documents, macros or add-ins the first one (2.0.0).

## [Unreleased]

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

[Unreleased]: https://github.com/datakeen/markooj/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/datakeen/markooj/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/datakeen/markooj/releases/tag/v1.0.0

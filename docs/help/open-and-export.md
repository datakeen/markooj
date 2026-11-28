# Open and export

Your documents are Markdown files. Markooj can also open many other formats, and save a copy of your work in almost any format people ask for. Most of it is built in. Pandoc (for LaTeX, OpenDocument, Rich Text and more) and the DjVu tools are optional features: install them once from **File → Options → Features**, and Markooj offers them the first time you need one. The Windows portable zip includes them.

## Open

Press **Ctrl+O**, click **File → Open**, drag files onto the window, or double-click a Markdown file in File Explorer. Each file opens in its own tab. If Markooj is already open, the file joins it as a new tab.

| Format | What happens |
| --- | --- |
| **Markdown** (`.md`, `.markdown`, `.mdown`, `.mkd`, `.mkdn`, `.mdwn`, `.mdx`, `.rmd`, `.qmd`) and **text** (`.txt`) | Opens for editing as it is. |
| **Word** (`.docx`) | Turned into Markdown with Pandoc: headings, lists, tables, footnotes, equations and pictures come along. |
| **OpenDocument** (`.odt`) and **Rich Text** (`.rtf`) | Turned into Markdown with Pandoc. |
| **LaTeX** (`.tex`, `.latex`, `.ltx`) | Turned into Markdown with Pandoc. |
| **Web page** (`.html`, `.htm`, `.xhtml`) and **EPUB** (`.epub`) | Turned into Markdown, with the title and author kept. |
| **reStructuredText**, **Org**, **Textile**, **MediaWiki**, **DocBook**, **Typst**, **Jupyter notebook** (`.ipynb`), **CSV** and **TSV** tables, **FictionBook**, **OPML**, **Muse** and **txt2tags** | Turned into Markdown with Pandoc. |
| **PDF** | Shown page by page, with thumbnails. **Edit as text** makes an editable Markdown copy. |
| **DjVu** (`.djvu`, `.djv`) | Shown page by page with DjVuLibre. **Edit as text** copies its text into a new Markdown document. |

A file that was turned into Markdown opens as a new, unsaved document. The first time you press **Ctrl+S**, Markooj asks for a name for the Markdown copy, so your original file is never overwritten.

Most of a Word file comes across, but not everything: Markdown has no text boxes, tracked changes or page headers. See [Markdown for Word users](markdown-for-word-users.md).

**File → Open** also lists your recent files, and **Open recent…** finds them by name.

## Save

**Ctrl+S** saves the document as Markdown. **Save all** saves every open document with changes. If another program changed the file after you opened it, Markooj asks you to choose how to save: **Save as Copy…** (the default, keeps both), **Overwrite**, or **Cancel**.

## Save As and export

Click **File → Save As / Export** (Ctrl+Shift+S) and pick a format. Your Markdown file stays as it is; the export is a new file.

### Built in

| Format | Good for |
| --- | --- |
| **Markdown** | A copy under another name. Opens anywhere, works with Git. |
| **PDF** | Print-ready, with sharp equations, diagrams and tables. |
| **Word document** (`.docx`) | Edit in Microsoft Word or Pages. Equations become real Word equations. |
| **EPUB e-book** | Apple Books, Kobo and other readers. |
| **Web page** (`.html`) | One self-contained file, pictures and math included. |
| **Plain text** | No formatting at all. |

### With Pandoc (an optional feature)

| Format | Good for |
| --- | --- |
| **LaTeX** (`.tex`) | Overleaf or a journal template. |
| **OpenDocument text** (`.odt`) | LibreOffice Writer. |
| **Rich Text** (`.rtf`) | Older word processors. |
| **PowerPoint slides** (`.pptx`) | One slide per heading. |
| **JATS XML** | Journal submission. |
| **reStructuredText** | Python and Sphinx documentation. |
| **Org mode** | Emacs. |
| **AsciiDoc** | Technical documentation. |
| **MediaWiki** | Pasting into a wiki. |
| **Jupyter notebook** (`.ipynb`) | Opens in Jupyter. |
| **Typst** (`.typ`) | Modern typesetting. |

### With the DjVu tools (an optional feature)

| Format | Good for |
| --- | --- |
| **DjVu** | A compact archive in the style of a scanned document. |

### From add-ins

Add-ins can add formats of their own. The **Word Frequency** add-in that comes with Markooj adds **Word list (CSV)**: every word with its count, for Excel. See [Add-ins](add-ins.md).

**File → Export…** (Ctrl+Shift+E) and the **Export as PDF**, **Export as Word document** and **Export as web page** commands are shortcuts to the same choices.

## What exports carry

- **Document properties** from File → Info (title, authors, date, keywords, abstract) go into Word, EPUB and PDF files.
- **Page layout** from the Layout tab (page size, margins, columns, spacing) and the document's **text size** go into PDF, Word and OpenDocument files. LaTeX gets the paper size, margins and spacing.
- **Numbers and cross-references** come out as plain numbers that look right in every format.
- **Citations and the bibliography** are formatted in the chosen citation style.
- **Diagrams** become pictures in Word, LaTeX and the other Pandoc formats. Text formats such as LaTeX get them in a folder named after the file, ending in `-media`.
- **Right-to-left text** keeps its direction. See [Languages and right-to-left text](languages-and-rtl.md).
- **Comments and hidden notes** are left out, so the people you share with see a clean document. To include them, turn on **Include comments** on the Save As or Print page, or in File → Options. Word and OpenDocument files then get real comments.

### Render as

Markooj reads every Markdown flavor on screen. For exports through Pandoc, you can choose which flavor's rules to use: click the flavor name on the status bar and pick one under **Render as**. The choice is saved with the document.

## Print

**Ctrl+P** (File → Print) shows the pages, then opens your system's print window, where you pick the printer, copies and pages. **Save as PDF…** on the same page saves a PDF instead, and **Page setup…** opens the Layout choices. Pages are A4 unless you set another size on the Layout tab.

## If a format is grayed out

The format says which feature it needs. Click its card and choose **Install**, or open **File → Options → Features**; on a computer without internet, use **Install from file…** there. If the feature is installed, **Check again** in Markooj's message usually brings it back; [Problems and answers](troubleshooting.md) has the steps for each system. The other formats keep working meanwhile.

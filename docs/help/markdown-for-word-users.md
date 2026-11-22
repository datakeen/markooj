# Markdown for Word users

A Word file keeps your text inside a package that only a word processor can read. A Markdown file is plain text with a few marks in it, such as `**bold**` or `# Heading`. Any program can open it, Git can track every change, and journals and tools such as Pandoc, Quarto and Overleaf can work with it.

You never have to type these marks in Markooj: in Word mode you click and type, and Markooj writes them. This page is for when you are curious, or when you open the file in another program. To see the Markdown for any part of the page, select it and press **Ctrl+Shift+/**.

## What each Word feature becomes

| In Word | In Markdown | Notes |
| --- | --- | --- |
| Heading 1, Heading 2 … | `# Heading`, `## Heading` … | Up to six levels. |
| Normal paragraph | Plain lines, with an empty line between paragraphs | |
| **Bold** | `**bold**` | |
| *Italic* | `*italic*` | |
| Underline | `<u>underline</u>` | Markdown has no underline of its own, so Markooj keeps a small piece of HTML. |
| Strikethrough | `~~struck~~` | |
| Subscript, superscript | `H~2~O`, `x^2^` | |
| Highlight | `==highlighted==` | |
| Text color | `<span style="color:#c00">red</span>` | Kept as HTML. Not every program shows it. |
| Font and font size | `fontsize: 12pt` at the top of the file | One size for the whole document. See [Writing and formatting](writing-and-formatting.md). |
| Bulleted list | `- item` | An indented item is one level below. |
| Numbered list | `1. item` | |
| Checklist | `- [ ] task` and `- [x] done` | |
| Center, right, justify | `<div align="center">…</div>` | |
| Quote | `> quoted text` | |
| Hyperlink | `[text](https://example.org)` | |
| Picture | `![Caption](assets/picture.png)` | The picture stays a separate file next to the document. |
| Table | Rows of cells with bars (\|) between them | See [Figures and tables](figures-and-tables.md). |
| Page break | `<div class="page-break"></div>` | |
| Horizontal line | `---` | |
| Footnote | `[^1]` in the text and `[^1]: The note.` below | |
| Equation | `$E = mc^2$` in a line, `$$ … $$` on its own | LaTeX math. See [Equations](equations.md). |
| Caption and number | `{#fig:flume}` after a picture, `{#eq:energy}` after an equation, `: Caption {#tbl:runs}` under a table | See [Numbering and cross-references](numbering-and-cross-references.md). |
| Cross-reference | `@fig:flume` or `[@eq:energy]` | Shows as "Fig. 1" or "Eq. (1)" and updates itself. |
| Citation | `[@smith2020]` | From your BibTeX library. See [Citations and references](citations-and-references.md). |
| Comment | `<!-- comment: Check this number. -->` | Hidden in exports unless you include them. |
| Hidden note to yourself | `%%like this%%` | Never shown when reading or exporting. |
| Note, tip or warning box | `> [!NOTE]` and lines starting with `> ` | A callout. |
| Code | `` `code` `` in a line, or between ```` ``` ```` lines | |
| Document properties (title, author …) | Lines between `---` at the top of the file | Called front matter (YAML). File → Info edits them for you. |
| Page size, margins, spacing | `markooj-page: A4` and similar lines in the front matter | Set from the Layout tab. |
| Language and direction | `lang: ur` and `dir: rtl` in the front matter | See [Languages and right-to-left text](languages-and-rtl.md). |

## Front matter

The lines between two `---` lines at the very top of a file are the document's properties. For example:

```
---
title: Sediment transport in a flume
author: A. Researcher
lang: en-US
bibliography: references.bib
fontsize: 12pt
---
```

**File → Info** shows them as a form, so you do not need to edit them by hand. Pandoc, Quarto and many journal templates read the same lines.

## Markdown flavors

Markdown has a few dialects. Markooj reads the common ones and shows the one it detected on the status bar:

- **CommonMark:** the plain standard.
- **GitHub (GFM):** adds tables, checklists and strikethrough.
- **Pandoc:** adds citations, footnotes, `:::` blocks, definition lists and labels.
- **LaTeX Markdown** and **Pandoc + LaTeX:** the same with math.
- **Obsidian:** `[[wiki links]]` and callouts.
- **MultiMarkdown**, **R Markdown**, **Quarto** and **MDX**.

Markooj writes Pandoc-style Markdown with LaTeX math by default, which most research tools understand.

## What Markdown cannot do

Some Word features have no place in a plain text file. Markooj tells you when this happens instead of quietly doing nothing:

- One font and one text size per document, not per word.
- No text boxes, shapes, or text wrapped around pictures.
- No tracked changes. Use comments and **Review → Compare** instead.

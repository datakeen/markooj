# Citations and references

Markooj cites from a BibTeX library, the format that Zotero, Mendeley, JabRef and EndNote all export. Citations are written the Pandoc way, so the same file also works with Pandoc, Quarto and R Markdown.

## Link your library

1. On the **References** tab, click **Library**.
2. Pick your `.bib` file.

Markooj writes the file name into the document's front matter as `bibliography: references.bib`, so the link travels with the document. You can also set it in **File → Info → Bibliography file**. Exports through Pandoc also accept CSL JSON and YAML libraries named there.

Changed the library in Zotero or elsewhere? Press **Alt+Q**, type `reload`, and pick **Reload citation library** to read it again.

## Cite a source

1. Put the cursor where the citation goes.
2. Click **References → Cite**, or press **Ctrl+Shift+C**.
3. Type part of an author, title or year, and pick one or more sources.
4. Add a page or section if you like, for example `4` or `ch. 2`.
5. Click **Insert**.

The citation shows in the chosen style, for example (Smith & Lee, 2020, p. 4). In the file it is written as `[@smith2020, p. 4]`. To change it later, double-click it.

Other forms Markooj reads and shows:

| In the file | Shows as (APA) |
| --- | --- |
| `[@smith2020]` | (Smith & Lee, 2020) |
| `[@smith2020; @khan2019]` | (Smith & Lee, 2020; Khan, 2019) |
| `[see @smith2020, p. 4]` | (see Smith & Lee, 2020, p. 4) |
| `@smith2020` | Smith & Lee (2020) |
| `[-@smith2020]` | (2020) |

## Citation style

**References → Citation style** offers **APA**, **Chicago** and **IEEE**. The style is used on screen and in exports. To fix a style for one document, Markooj writes `citation-style:` into its front matter. If the front matter names your own `.csl` file with `csl:`, exports through Pandoc use it.

## The bibliography

**References → Bibliography** adds a **References** heading at the end of the document. Every source you cite is listed under it, in the chosen style, and the list updates as you cite. If the document already has a heading called References, Bibliography or Works cited, the list goes there.

In Word, LaTeX, EPUB and the other Pandoc formats, the citations and the list are made by Pandoc's citeproc with the bundled style files, so they look right in every format.

## Footnotes

- **References → Footnote** (Ctrl+Alt+F) adds a numbered note at the bottom of the page.
- **Previous footnote** and **Next footnote** move between them.

In the file a footnote is `[^1]` in the text and `[^1]: The note.` further down. Markooj numbers them in order.

## Table of contents

**References → Contents** inserts a table of contents built from your headings, with links to each one. After you change headings, click **Update** next to it.

## Cross-references

To refer to a figure, table, equation or section by its number, see [Numbering and cross-references](numbering-and-cross-references.md).

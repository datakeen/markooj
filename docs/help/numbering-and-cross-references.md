# Numbering and cross-references

Markooj numbers equations, figures, tables and sections for you, and keeps every "see Fig. 2" up to date when things move. It works like captions and cross-references in Word, and it writes the same syntax that Pandoc and pandoc-crossref read.

## Give an item a number

Select a picture, a table or a display equation, then click **References → Insert Caption** (Ctrl+Alt+Shift+C). Type the caption and click OK. Markooj gives the item a label and a number:

- A figure: `![Flume set-up](assets/flume.png){#fig:flume}` shows as **Fig. 1.** Flume set-up.
- A table: a line `: Test runs {#tbl:runs}` above or below the table shows as **Table 1.** Test runs.
- An equation: `$$ … $$ {#eq:shields}` shows (1) in the right margin. The equation editor has a Numbered switch for this. See [Equations](equations.md).
- A section: `# Methods {#sec:methods}`.

Only labeled items get a number, unless you turn on **Number all equations**. To keep one item without a number, add `{-}` after it.

### Inside a table

Equations and pictures inside table cells are numbered too, in document order with all the others:

```
| Case | Equation                 | Picture                               |
| ---- | ------------------------ | ------------------------------------- |
| A    | $$ q = u h $$ {#eq:flow} | ![Flume inlet](inlet.png){#fig:inlet} |
```

The equation shows its number, such as **(2)**, in the cell. The picture shows its caption under it, **Fig. 1.** *Flume inlet* (the caption is the text in the square brackets). With the cursor in a cell, **Insert → Equation** writes the equation on one line so it fits the cell, and **Insert Caption** captions the picture in that cell rather than the table. Both are listed in the **Cross-reference** dialog like any other item. A `|` inside an equation in a cell is written as `\|`.

## Refer to an item

1. Put the cursor where the reference should go.
2. Click **Insert → Cross-ref** or **References → Cross-ref** (Ctrl+Alt+R).
3. Choose the **Reference type**: Heading, Figure, Table, Equation or Footnote.
4. Choose what to **Insert reference to**:
   - **Full label:** "Fig. 1.2", "Table 3", "Eq. (2)".
   - **Number only:** "1.2".
   - **Caption text** or **Heading text**.
   - **Above/below:** the word "above" or "below", depending on where the item is.
5. Pick the item in the list and click **Insert**.

**Insert as hyperlink** makes the reference a link in exports. Items that do not have a label yet get one made from their text, so you never have to invent labels.

In the file a reference is written as `@fig:flume`, `[@eq:shields]`, or `[-@tbl:runs]` for the number alone. On the page it shows as the live number.

## Working with references

- Rest the pointer on a reference to see a preview of what it points to.
- **Ctrl+click** a reference to jump to it. **References → Go to referenced item** does the same.
- A reference whose target is gone shows in red, with a suggestion to fix it.
- **Update** (F9) renumbers everything and refreshes every reference, like Update Field in Word. Markooj also does this as you type.

## Numbering style

On the **References** tab:

- **Numbering style:** 1, 2, 3 through the whole document, or by chapter: 1.1, 1.2, 2.1. A chapter is the top heading level. A single Heading 1 at the very top counts as the document title (unless the front matter already has a title), so chapters are then the Heading 2 headings.
- **Separator:** 1.1 or 1-1.
- **Numbering options:** the label names, such as **Eq.** or **Equation**, **Fig.** or **Figure**, **Table** or **Tab.**
- **Number all equations:** on, every display equation gets a number; off, only labeled ones do.

The style and separator buttons apply to every document. In **Numbering options**, tick **Save in this document** to keep the numbering in the file itself (in its front matter, under `xref:`), so it travels with the file. Numbering saved in a document wins over the settings.

## In exports

PDF, print and web page exports show the numbers as on screen. Word, LaTeX and the other Pandoc formats get plain numbers in the text, so the file looks right everywhere, even without pandoc-crossref. In Word and LibreOffice files, equations in table cells keep their number and pictures in cells get their caption on the line under them.

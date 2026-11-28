# Figures and tables

## Pictures

Click **Insert → Picture**, drag a picture onto the page, or paste one. Markooj copies the picture into an `assets` folder next to your document and writes a link to it:

```
![Flume set-up](assets/flume.png)
```

If the document has not been saved yet, the picture is stored inside the document itself. Keep the `assets` folder with the document when you move or share it.

To give a picture a number and a caption, select it and click **References → Insert Caption** (Ctrl+Alt+Shift+C). It then shows as **Fig. 1.** with your caption, and you can refer to it anywhere. See [Numbering and cross-references](numbering-and-cross-references.md).

Pictures from the web (links starting with `http`) are not loaded unless you allow it in File → Options → Privacy. See [Privacy](privacy.md).

### Pictures from other Markdown editors

Documents written in MarkText, Typora, Obsidian, Zettlr and similar editors show their pictures in every mode, in print and PDF, and in Word and other exports. Markooj understands all of these ways of writing a picture's place:

| Written as | Example |
| --- | --- |
| A full Windows path (MarkText, Typora) | `![](C:/Users/me/AppData/Roaming/marktext/images/image.png)` |
| A Windows path with backslashes | `![](C:\Users\me\Pictures\chart.png)` |
| A path with spaces | `![](C:/My Docs/a b.png)`, `![](<C:/My Docs/a b.png>)` or `![](C:/My%20Docs/a%20b.png)` |
| A file address | `![](file:///C:/Pictures/x.png)` |
| Your home folder | `![](~/Pictures/x.png)` |
| A path on macOS or Linux | `![](/home/me/pictures/x.png)` |
| Next to the document | `![](./assets/x.png)`, `![](assets/x.png)`, `![](../x.png)` |
| HTML | `<img src="C:\pics\x.png" width="300">` |
| Obsidian | `![[photo.png]]`, `![[photo.png|300]]` |

Markooj never changes how the path is written in your file. It only reads picture files that your document names, and never a network share.

**If a picture is not found**, a card shows where it was: *Find this picture: it was at …*

- **Locate…** opens a file picker. Choose the picture, and Markooj writes its new place into the document (a short path when it sits in the document's folder). Other missing pictures that are in the same folder are fixed at the same time.
- **Remove** takes the picture out of the document. The message that follows has an **Undo** button.
- A picture whose path starts at the document's folder (for example `assets/x.png`) shows once the document is saved. The card then offers **Save…**.

Markooj also looks for a missing picture by name in the usual picture folders next to the document (`assets`, `attachments`, `images`, `media` and others), so Obsidian embeds and documents moved together with their picture folder show without changes.

To see every missing picture at once, click **Insert → Find Missing Pictures**, click the note in the status bar, or press **Alt+Q** and type *missing pictures*.

## Diagrams

**Insert → Diagram** draws a flowchart, sequence diagram, timeline or chart from a short text description, using Mermaid. For example:

````
```mermaid
flowchart LR
  Sample --> Dry --> Sieve --> Weigh
```
````

The diagram follows the light or dark theme on screen and is always light in exports. Word, LaTeX and the other Pandoc formats get it as a picture.

## Tables

### Make a table

- **Insert → Table:** point to choose the number of columns and rows, then click. **Insert Table…** under the grid lets you type the numbers.
- **Convert Text to Table…** (also under Insert → Table) turns the selected lines into a table. Tabs, commas or semicolons mark the columns.

### Type in a table

Click into any cell and type. While you edit, dashed gridlines show every cell. They are never printed or exported; turn them off with **View → Gridlines**.

- **Tab** moves to the next cell, and **Shift+Tab** to the one before. Tab in the last cell adds a new row.
- **Enter** (or **Shift+Enter**) starts a new line inside the cell, as in Word. It is saved as `<br>` in the Markdown table.
- To leave the table, press **Down** in the last row, or click below it.
- A `|` you type in a cell is kept as text; it does not break the table.
- Right-click a cell for the table menu.

### Table Design and Table Layout

When the cursor is in a table, two extra tabs appear at the end of the ribbon:

**Table Design**
- **Header Row:** show the first row as a header. Markdown tables always have a header row, so when you turn it off, the row is left empty and hidden in Read mode, print and exports.
- **Table Styles:** Plain, Grid, Banded rows, Academic (three rules, as in research papers) or Accent (a colored header). The style applies to every table in the document. It shows on screen, in print, and in PDF and web page exports.
- **Convert to Text:** turn the table back into lines, with tabs, commas or paragraphs between the cells.
- **Copy for Word/Excel:** copy the whole table so Word and Excel paste it as a real table (also on Table Layout → Data and in the right-click menu).

**Table Layout**
- **Select:** the row, the column or the whole table.
- **Rows & Columns:** Insert Above, Insert Below, Insert Left, Insert Right, and Delete (cells, row, column or table).
- **Distribute Columns:** give all columns the same width. Pandoc uses these widths for wide tables in Word and PDF exports.
- **Alignment:** align the column with the cursor left, center or right. Right is good for numbers.
- **Sort:** Ascending or Descending by the column with the cursor, or **Sort…** to pick a column. The header row stays on top.
- **Format Table:** line up the bars in the Markdown so it is easy to read. In Simple mode, Tab does this too.

### Tables from Word, Excel and Google Sheets

Copy a table in Word, Excel, Google Sheets or LibreOffice and paste it (Ctrl+V) in any mode. It arrives as a Markdown table:

- The first row becomes the header row.
- Bold, italic, strikethrough, underline, superscript, subscript and links in the cells are kept. Several lines in one cell become `<br>`.
- Column alignment comes along. Numbers from Excel line up on the right.
- Colors, fonts, borders and other Office styling are left out.
- Markdown tables cannot merge cells, so a merged cell is split. The extra cells are left empty, or repeat the text if you choose that in **File → Options → Tables**.
- Pictures inside copied cells cannot come along; insert them with **Insert → Picture**.
- Text copied together with the table (a caption, paragraphs) keeps its place above or below it.

**Paste into a table.** With the cursor in a table cell, pasted cells fill the table from that cell on, like Excel; rows and columns are added when needed. One copied cell is pasted as text at the cursor. **Ctrl+Z** undoes the paste.

Excel's tab-separated text works too, for example when you paste from a program that copies only text. **Paste as plain text** (Ctrl+Shift+V) keeps the text exactly as copied instead. Inside a code block, pasting is never changed.

### Tables to Word and Excel

Select cells (or the whole table, with **Table Layout → Select → Select Table**) and press **Ctrl+C**, or click **Table Design → Copy for Word/Excel**. Word and Excel then paste a real table with borders and the header row; Excel gets every value in its own cell. A selection that has text around a table copies that text too. In Simple mode, Ctrl+C keeps the Markdown for Markdown editors and adds the table for Word and Excel.

To turn these off, use **File → Options → Tables**.

### A caption for a table

Put the cursor in the table and click **References → Insert Caption**. Markooj writes a line such as `: Test runs {#tbl:runs}` next to the table, and the table shows as **Table 1.** Test runs.

### Equations and pictures inside a table

Table cells can hold numbered equations and pictures with captions. Put the cursor in a cell, then:

- **Insert → Equation** (Alt+=) with *Display* and *Numbered* chosen writes the equation on one line, `$$ q = u h $$ {#eq:flow}`, because a table cell holds one line. It gets its number, such as **(2)**, inside the cell.
- **Insert → Picture** puts the picture in the cell. **References → Insert Caption** with the cursor in that cell captions the picture (not the table): the caption shows under the picture as **Fig. 1.** *Flume inlet*.

They are numbered in document order with everything else and appear in the **Cross-reference** dialog. In Word and LibreOffice exports the caption is written under the picture in the cell.

### What a table looks like in the file

```
| Run | Flow (L/s) | Depth (cm) |
| :-- | ---------: | ---------: |
| A   |       12.5 |        4.1 |
| B   |       18.0 |        5.3 |

: Test runs {#tbl:runs}
```

Every change you make in the editor rewrites only that table, so the rest of your file stays exactly as it was. Tables are always written as standard pipe tables that GitHub, Pandoc and Obsidian read.

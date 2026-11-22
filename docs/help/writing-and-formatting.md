# Writing and formatting

Most of this works the way it does in Word. The few differences come from Markdown itself, and Markooj says so where it matters.

## Typing helpers

- **Undo** (Ctrl+Z) takes back one change at a time, as in Word. **Redo** is Ctrl+Y.
- **AutoCorrect:** two hyphens `--` become a dash –, `(c)` becomes ©, `(r)` ®, `(tm)` ™, and `...` becomes …
- **Smart quotes:** straight quotes "like this" become curly “like this”.
- **Repeat** (F4) does the last formatting or insert command again.

Turn AutoCorrect and smart quotes on or off in File → Options → Typing and review.

## Clipboard

- **Paste** keeps the formatting from Word and web pages: headings, bold, lists, links and tables arrive as Markdown.
- **Paste as plain text** (Ctrl+Shift+V) leaves the formatting behind.
- **Format painter** (Home tab, in Word mode): select formatted text, click Format painter, then select the text that should look the same. Esc cancels.

## Font

- **Bold** Ctrl+B, **italic** Ctrl+I, **underline** Ctrl+U, **strikethrough** Ctrl+Shift+X.
- **Subscript** Ctrl+= (H₂O) and **superscript** Ctrl+. (x²).
- **Highlight** Ctrl+Shift+H, **text color**, and **inline code** Ctrl+` for a fixed-width code font.
- **Clear formatting** (Ctrl+Space) removes bold, italic, colors and the rest from the selection.
- **Change Case** (the Aa button, or Shift+F3 to cycle): Sentence case, lowercase, UPPERCASE, Capitalize Each Word, tOGGLE cASE and **Title Case**, which keeps short words such as *a*, *and*, *of* and *in* small, as APA and Chicago ask. With nothing selected, it changes the word at the cursor.

### Font and size: one per document

A Markdown file keeps the words and their structure, not a font and size for each word. So in Markooj:

- **Font** sets the reading font of the page. Pick it on the Home tab or in File → Options → Editor. Exports use the fonts of the document theme (Layout → Theme).
- **Font Size**, **Grow Font** (Ctrl+Shift+> or Ctrl+]) and **Shrink Font** (Ctrl+Shift+< or Ctrl+[) change the size of all body text in this document. The size is saved in the file as `fontsize: 14pt` and is used on screen, in print, and in PDF and Word exports. The default size for new documents is in File → Options → Editor.
- For bigger text in one place, use a heading.

## Paragraphs

- **Bullets** (Ctrl+Shift+L), **Numbering** (Ctrl+Shift+7) and **Checklist** (Ctrl+Shift+9). In a list, Tab moves an item in and Shift+Tab moves it out. **Increase indent** is Ctrl+M.
- **Align left** Ctrl+L, **Center** Ctrl+E, **Align right** Ctrl+R, **Justify** Ctrl+J. **Clear paragraph formatting** (Ctrl+Q) puts the paragraph back to the left.
- **Quote** (Ctrl+Alt+Q) sets a paragraph apart as a quotation. **Code block** (Ctrl+Alt+C) is for program code.
- **Promote** and **Demote** (Alt+Shift+Left and Right) make a heading one level bigger or smaller, or move a list item out or in.
- **Move paragraph up** and **down** (Alt+Shift+Up and Down) move the paragraph or list item with the cursor.
- **Left-to-right** and **Right-to-left** set the direction of one paragraph. See [Languages and right-to-left text](languages-and-rtl.md).

## Styles

The **Styles** gallery on the Home tab turns a paragraph into Normal text, Heading 1 to Heading 6 or a quote. The keys are Ctrl+Alt+1 to Ctrl+Alt+6 for headings and Ctrl+Alt+0 (or Ctrl+Shift+N) for Normal. Headings appear in the outline and in the table of contents.

## Insert

| Button | What you get |
| --- | --- |
| **Table** | A table. Point to pick the size. See [Figures and tables](figures-and-tables.md). |
| **Picture** | A picture from your computer, copied into an `assets` folder next to the document. You can also drag a picture onto the page or paste one. |
| **Diagram** | A flowchart or other diagram drawn from a short text description (Mermaid). |
| **Equation** | The equation editor (Alt+=). See [Equations](equations.md). |
| **Code** | A block of program code with syntax colors. |
| **Callout** | A colored box: Note, Tip, Warning, Important or Caution. |
| **Link** | A link to a web page or to a place in the document. Ctrl+K while you type. |
| **Divider** | A horizontal line between sections. |
| **Page break** | A new page when printing or exporting (Ctrl+Enter). |
| **Footnote** | A numbered note at the bottom of the page (Ctrl+Alt+F). |
| **Citation** | A source from your library. See [Citations and references](citations-and-references.md). |
| **Symbol** | Greek letters, arrows, math and other symbols. |
| **Date & time** | Today's date or the current time (Alt+Shift+D). |

## Page layout

The **Layout** tab sets how the pages look on screen, in print and in exports. The choices are saved in the document's front matter, so they travel with the file.

- **Margins:** Normal (1 inch), Narrow (0.5 inch) or Wide (2 inches left and right).
- **Size:** A4, Letter or A5.
- **Columns:** one or two.
- **Line spacing:** 1.0, 1.15, 1.5 or 2.0. Ctrl+5 switches 1.5 spacing on and off.
- **Space after paragraphs:** 0, 6, 8, 12 or 18 points.
- **Theme:** the fonts and colors of the whole document: Classic serif, Modern sans, Academic or Compact.

## Find and replace

- **Find** (Ctrl+F), **Replace** (Ctrl+H), **Find next** (F3) and **Find previous** (Shift+F4).
- **Go To** (Ctrl+G) jumps to a heading, or to a page in a PDF or DjVu file.

## Word count

The status bar shows the word count all the time. **Review → Word count** (Ctrl+Shift+G) also counts characters, equations and citations, for the whole document or the selection. **Review → Readability** shows the reading level and sentence lengths.

## Writing goals and sprints

Writing is easier with a target in sight. On the **View** tab, in the **Writing** group:

- **Goals** sets a word target for this document and a daily goal. The ring in the status bar fills as you write. Meeting your daily goal keeps your streak going, and Markooj celebrates quietly when you reach a goal (it stays still if your system asks for reduced motion).
- **Sprint** starts a 15, 25 or 45 minute writing sprint. The status bar counts down and counts your words.
- **Typewriter** keeps the line you type in the middle of the screen.

The document's word target is saved in the file as `word-target`. The daily goal and the streak are kept by Markooj, in File → Options → Writing goals.

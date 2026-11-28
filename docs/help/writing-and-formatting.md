# Writing and formatting

Most of this works the way it does in Word. The few differences come from Markdown itself, and Markooj says so where it matters.

## Typing helpers

- **Undo** (Ctrl+Z) takes back one change at a time, as in Word. **Redo** is Ctrl+Y.
- **AutoCorrect:** two hyphens `--` become a dash –, `(c)` becomes ©, `(r)` ®, `(tm)` ™, and `...` becomes …
- **Smart quotes:** straight quotes "like this" become curly “like this”.
- **Repeat** (F4) does the last formatting or insert command again.

Turn AutoCorrect and smart quotes on or off in File → Options → Typing and review.

### Brackets and quotes close themselves

Type an opening bracket or quote and Markooj adds the closing one, with the cursor in between. This works in Word, Inline and Simple mode.

- **( [ {** get their closing bracket. With smart quotes on, **"** gives “|” and **'** gives ‘|’. Typed **“**, **‘** and **«** pair too.
- **Type the closing one** and the cursor steps over the one that is already there, so you never get two. Pressing " right before ” steps over it.
- **Select text first** and type a bracket or quote: the text gets wrapped, and stays selected. Type * twice to make it bold.
- **Backspace** right after an opening bracket or quote removes the empty pair.
- **Apostrophes stay single:** in don’t, it’s and students’ the quote is never paired.
- **In Simple and Inline mode** the Markdown marks close too: `*` and `_` for italic, `**` for bold (type * twice), a backtick for code, and `~~` for strikethrough (type ~ twice). A * at the start of a line stays a bullet, and three backticks still start a code block.
- **$ for math** closes itself. A number right after it ($5) keeps the dollar sign as typed, so prices are safe. Type $ again inside the pair for display math $$ … $$.
- Inside code, brackets and straight quotes pair but Markdown marks do not.

Turn this off, or only the Markdown marks or the $ sign, in **File → Options → Typing and review**.

### Slash commands

Type a slash at the start of a word and a small list shows what it can do:

| Type, then Space or Enter | You get |
| --- | --- |
| `/today` | Today's date in your date format |
| `/date` | The Date and time dialog |
| `/time` | The time now |
| `/hijri` | Today's Hijri date |

Use the arrow keys and Enter to pick from the list, or keep typing. Esc closes the list. Slashes in paths and links (`/usr/bin`, `and/or`) are left alone. Turn slash commands off in File → Options → Typing and review.

### Multiple cursors (Simple mode)

In Simple mode you can type in several places at once:

| Keys | Does |
| --- | --- |
| Alt+click | Add a cursor where you click (Alt+click it again to remove it) |
| Ctrl+Alt+Up / Ctrl+Alt+Down | Add a cursor on the line above or below |
| Ctrl+D | Select the word at the cursor; press again to add the next match |
| Alt+F3 | Select every match (Ctrl+Shift+L too, once several cursors are on) |
| Esc | Back to one cursor |

Typing, Backspace, Delete, Enter, Tab, the arrow keys, Home and End work at every cursor. Paste puts one line at each cursor when the clipboard has as many lines as there are cursors, otherwise the whole text at each. Ctrl+Z undoes one change at all cursors in one step. Copy and Cut take the text of every selection, one per line.

Word and Inline mode edit a finished-looking page with one cursor. There, these keys tell you how to switch to Simple mode (Ctrl+3), where multiple cursors work. While several cursors are on, brackets do not close themselves. In Simple mode, **Ctrl+Shift+D** duplicates the line (it used to be Ctrl+D).

### Select all

**Ctrl+A** selects the document only, never the ribbon, the outline or the status bar:

- In Simple mode, the Markdown in the editor. Click in the preview first to select the finished text there instead.
- In Word and Read mode, the whole page. In Inline mode, the paragraph you are editing; press Esc first to select the whole page.
- In a dialog, the dialog's text.

**Home → Select all** does the same with the mouse.

## Clipboard

- **Paste** keeps the formatting from Word and web pages: headings, bold, lists, links and tables arrive as Markdown.
- **Paste as plain text** (Ctrl+Shift+V or Ctrl+Alt+V, or Home → Paste as plain text) leaves the formatting behind: no fonts, colors, links or tables, just the words. It works in every editing mode.
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
| **Date & time** | A date from a calendar in the format you pick. See [Date and time](#date-and-time) below. |

## Date and time

**Insert → Date & time** opens a calendar. Pick a day (arrow keys move by a day or a week, Page Up and Page Down by a month), then a format:

- **Month day, year** (November 27, 2026) or **Day month year** (27 November 2026)
- **dd/mm/yyyy**, **dd/mm/yy**, **mm/dd/yyyy** (US), **yyyy-mm-dd** (ISO) and **yyyymmdd**
- **ISO with time** (2026-11-27T14:05), and the **time** alone, 12-hour (2:05 PM) or 24-hour (14:05)
- **Custom pattern:** `yyyy` year, `MM` month number, `MMMM` month name, `dd` day, `dddd` day name, `HH` or `h` hour, `mm` minutes, `a` AM or PM, and text in single quotes, such as `dddd, d MMMM yyyy 'at' h:mm a`

**Include the day name** puts it in front: Friday, 27 November 2026.

**Calendar:** Gregorian or **Hijri**. Hijri dates follow the Umm al-Qura calendar used in Saudi Arabia. Where the new moon is sighted a day later, as in Pakistan, the local date can be one day behind: choose **One day earlier** under Hijri date, and Markooj remembers it.

**Month names:** English, Urdu or Arabic (Urdu and Arabic for Hijri dates too), and the language of the Markooj interface when it has one.

Double-click a day, or press Ctrl+Enter, to insert. Markooj remembers your choice:

- **Alt+Shift+D** inserts today's date in that format, and **Alt+Shift+T** the time, as in Word. Typing `/today` and `/time` does the same.
- Change the format without inserting anything in **File → Options → Typing and review → Date and time format**.

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

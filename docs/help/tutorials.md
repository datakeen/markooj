# Tutorials

Short walkthroughs of the main tasks, one step at a time. The same tutorials run as guided tours inside Markooj: in the Help viewer (F1), click **Start this tutorial** under a heading, or open the **Help** tab and click **Tutorials**.

- [Getting started](#getting-started)
- [Modes: Word, Inline, Simple, Read](#modes-word-inline-simple-read)
- [Equations and numbering](#equations-and-numbering)
- [Cross-references](#cross-references)
- [Tables like Word](#tables-like-word)
- [Writing Assistant](#writing-assistant)
- [Right-to-left languages and language packs](#right-to-left-languages-and-language-packs)
- [Export and convert](#export-and-convert)
- [Recover unsaved text](#recover-unsaved-text)
- [Record a macro](#record-a-macro)
- [Run Python code](#run-python-code)
- [Write a JavaScript macro](#write-a-javascript-macro)
- [Pin or unpin the ribbon](#pin-or-unpin-the-ribbon)
- [Keyboard and KeyTips](#keyboard-and-keytips)

## Getting started

1. Press **Ctrl+N** for a new document, or **File → New** for a template.
2. Click on the page and type a title. Click **Heading 1** in the Styles gallery on the Home tab.
3. Press Enter and type a paragraph. Select a word and press **Ctrl+B** to make it bold.
4. Press **Ctrl+Shift+/** to see the Markdown behind the selection.
5. Press **Ctrl+S** and choose where to save. The file is a `.md` file.
6. Click **File → Save As / Export → PDF** to share it.

More in [Getting started](getting-started.md).

## Modes: Word, Inline, Simple, Read

1. Open a document with a heading, a list and an equation.
2. Press **Ctrl+1** for **Word** mode: click and type on the page.
3. Press **Ctrl+2** for **Inline** mode: click into a paragraph and its Markdown marks appear. Click elsewhere and it looks finished again.
4. Press **Ctrl+3** for **Simple** mode: Markdown on the left, a live preview on the right.
5. Press **Ctrl+4** for **Read** mode: the finished document. Press **Esc** to go back.
6. Notice that the place you were stays put each time. **Ctrl+Shift+M** steps through the modes.

More in [The window](the-window.md).

## Equations and numbering

1. Press **Alt+=** to open the equation editor.
2. Type `a/b`: the slash makes a fraction. Press Tab to move to the bottom.
3. Look at the LaTeX box below: it shows `\frac{a}{b}`. Change it there, and the top follows.
4. Choose **Display**, switch on **Numbered**, and type a label such as `ratio`.
5. Press **Enter**. The equation shows with (1) in the right margin.
6. Add a second numbered equation above it. Both numbers update.
7. On the **References** tab, set **Numbering style** to **By chapter 1.1, 1.2**. Numbers now count by chapter, such as (1.1).

More in [Equations](equations.md).

## Cross-references

1. Insert a picture and select it. Click **References → Insert Caption**, type a caption and click OK. It shows as **Fig. 1.**
2. Click where you want to mention it, then **References → Cross-ref** (Ctrl+Alt+R).
3. Choose **Figure**, **Full label**, pick your figure and click **Insert**. "Fig. 1" appears.
4. Rest the pointer on the reference to see a preview. **Ctrl+click** it to jump to the figure.
5. Add another figure above the first. Both numbers and the reference update.

More in [Numbering and cross-references](numbering-and-cross-references.md).

## Tables like Word

1. Click **Insert → Table** and point to choose 3 columns and 3 rows. Click.
2. Type in the first cell. Press **Tab** to move to the next one.
3. In the last cell, press **Tab** again: a new row appears. **Enter** starts a new line inside a cell, as in Word; press **Down** in the last row to leave the table.
4. Notice the **Table Design** and **Table Layout** tabs at the end of the ribbon.
5. On **Table Layout**, click **Insert Right** to add a column, and **Align Column Right** for numbers.
6. On **Table Design**, try the **Academic** table style.
7. Click outside the table. The table tabs hide.

More in [Figures and tables](figures-and-tables.md).

## Writing Assistant

1. Type: *We discussed about the the results, which was very unique.*
2. Colored lines appear. Click a red one to see its card.
3. Click **Why?** to read the rule, with a wrong and a right example.
4. Click **Accept** to fix it. Press **Ctrl+Z** if you change your mind.
5. Open **Review → Writing Assistant** to see every suggestion and your score.
6. Click **Goals** and choose **Academic**. The suggestions change to suit.
7. Double-click a word to see synonyms.

More in [Writing Assistant](writing-assistant.md).

## Right-to-left languages and language packs

1. Switch your keyboard to Urdu, Arabic, Persian or Punjabi (Shahmukhi) and type a paragraph. It runs right to left on its own, in a Nastaliq or Naskh font.
2. Click in an English paragraph and click **Home → Right-to-left text direction**. Click **Left-to-right** to undo it.
3. Click the language on the status bar and pick **Urdu**. The whole page now reads right to left.
4. Open **File → Options → Language** and click **Check for language packs**.
5. Click **Download** next to a pack. Markooj checks it and installs it. The pack shows how many words it has, and **Help improve** opens the guide for helpers.
6. Export to PDF: the direction and the font come along.

More in [Languages and right-to-left text](languages-and-rtl.md).

## Export and convert

1. Open a Word file with **Ctrl+O**. It opens as Markdown in a new tab.
2. Press **Ctrl+S**. Markooj asks for a name for the Markdown copy, so the Word file stays as it was.
3. Click **File → Save As / Export**.
4. Pick **PDF**, then try **Word document** and **LaTeX**. Each is a new file; your Markdown is unchanged.
5. Notice **Include comments** on the page: off, comments and hidden notes are left out.

More in [Open and export](open-and-export.md).

## Recover unsaved text

1. Type a few words in a new document. Do not save.
2. Close the tab with **Ctrl+W** and choose **Don't Save**.
3. Click **File → Recover**. Your text is there, with the time and a preview.
4. Click **Open**. The text is back in a tab.
5. In **File → Options → Recovery**, choose how many days to keep recovered text.

More in [Recover unsaved work](recover.md).

## Record a macro

1. Click **Developer → Record**.
2. Click **Heading 2** in the Styles gallery, then press **Ctrl+B**.
3. Click **Record** again, or **Stop** on the status bar.
4. Name the macro `Heading2Bold`, choose **Python**, tick **Show on ribbon**, and click **Save**.
5. Click in another paragraph and click your new button in **Developer → My macros**.
6. Open **Developer → Editor** to see the code the recorder wrote.

More in [Macros and scripting](macros-and-scripting.md).

## Run Python code

1. Type this into a document as a code block (Insert → Code, then choose Python):

   ```python
   import statistics
   print(statistics.mean([12.5, 18.0, 15.2]))
   ```

2. Click inside the block and press **Ctrl+Alt+Enter** (Developer → Run code).
3. The first time, Markooj asks whether to run code from this document. Click **Run**.
4. The answer appears in the Python console.
5. Press **Ctrl+Alt+P** to open the console yourself and type `2 ** 10`.

More in [Macros and scripting](macros-and-scripting.md).

## Write a JavaScript macro

1. Click **Developer → Editor** (Alt+F11) and choose **JavaScript**.
2. Replace the code with:

   ```js
   const words = doc.text.split(/\s+/).filter(Boolean).length;
   ui.toast(`This document has ${words} words`);
   ```

3. Press **Ctrl+Enter** to run it. A message shows the count.
4. Name it `CountWords`, give it a **Shortcut** such as Ctrl+Alt+Shift+W, and press **Ctrl+S**.
5. Press your shortcut in any document.
6. Click the book button to see the full API and more examples.

More in [Macros and scripting](macros-and-scripting.md).

## Pin or unpin the ribbon

1. Click the small arrow at the bottom right of the ribbon (or **View → Ribbon**). Choose **Show tabs and commands**, **Show tabs only** or **Full-screen mode**, as in Word.
2. Press **Ctrl+F1**, or double-click any tab. Only the tab names stay; the page gets more room.
3. Click a tab. Its commands drop down over the page and hide again after you use one.
4. Press **Ctrl+F1** again, or click the pin on the dropped-down ribbon, to keep the commands showing.

More in [The window](the-window.md).

## Keyboard and KeyTips

1. Press and release **Alt**. Letters appear on the tabs and the File button.
2. Type **H** for Home (N is Insert, R is Review). Letters now appear on the buttons; type one to run it. **Esc** steps back.
3. Press **Alt+Q** and type what you want to do, such as "table", then press Enter.
4. Word's own shortcuts work too: **Ctrl+B** for bold, **Ctrl+K** for a link, **F7** for spelling, **F12** for Save As and **F1** for this manual.

More in [Keyboard shortcuts](keyboard-shortcuts.md).

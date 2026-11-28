# The window

From top to bottom: the title bar (with Save, Undo, Redo, the command search and the mode buttons), the ribbon, the document tabs, the page on a gray canvas with the outline beside it, and the status bar.

## The ribbon

The ribbon has the tabs you know from Word:

| Tab | What is on it |
| --- | --- |
| **File** | New, Open, Save, Save As / Export, Print, Info, Recover, Add-ins (with the add-in store) and Options. It fills the window, like Word's File view. Press Esc to go back. |
| **Home** | Clipboard, Font, Paragraph, Styles, Find and Equation. |
| **Insert** | Table, Picture, Diagram, Equation, Code, Callout, Link, Divider, Page break, Footnote, Citation, Caption, Cross-reference, Symbol, Date and time. |
| **Layout** | Margins, page size, columns, line and paragraph spacing, and the document theme. |
| **References** | Table of contents, footnotes, citations and bibliography, captions and numbering. |
| **Review** | Spelling and grammar, Thesaurus, Word count, Readability, the Writing Assistant, comments and Compare. |
| **View** | Print or Web layout, Focus, writing goals, the outline, the ruler and guides, zoom, the Window group (New Window, Arrange All, Split, View Side by Side, Synchronous Scrolling, Reset Window Position, Switch Windows), editing mode and theme. |
| **Developer** | Macros, the recorder, the macro editor, the Python console, math macros and add-ins. |
| **Add-ins** | The buttons your add-ins add. |
| **Help** | This manual (F1), Tutorials, Keyboard Shortcuts, Welcome, What's New, Report a Problem, Check Tools and About Markooj. File → Help has the same. |

Two more tabs appear only when you need them: **Table Design** and **Table Layout** show up when the cursor is in a table, in a color of their own, like Word's table tools.

Rest the pointer on any button for a moment to see a card with its name, what it does and its shortcut. When a button cannot be used right now, it is dimmed and the card says why.

### Pin or unpin the ribbon

Click the small arrow at the bottom right of the ribbon (or **View → Ribbon**) to choose how the ribbon shows:

- **Show tabs and commands:** the ribbon stays open. This is the default.
- **Show tabs only:** only the tab names show, which leaves more room for the page. Click a tab and the ribbon drops down over the page; it hides again after you use a command or click elsewhere. The pin button on the dropped-down ribbon pins it back.
- **Full-screen mode:** the title bar and ribbon hide. Move the pointer to the top edge, or press Alt, to show them.

**Ctrl+F1**, or a double-click on any tab, switches between the first two. Markooj remembers your choice.

### KeyTips

Press **Alt** on its own (or **F10**) and a letter appears on every tab: **F** File, **H** Home, **N** Insert, **P** Layout, **S** References, **R** Review, **W** View, **L** Developer, **X** Add-ins, **Y** Help, and **JT** and **JL** for the table tabs. Type a letter to open that tab; letters then appear on its buttons. Esc goes back one level. KeyTips also work with an Urdu, Arabic or Persian keyboard layout.

### Search and commands

Press **Alt+Q** (or Ctrl+Shift+P) and type a few letters to find any command, open document or heading. It is the quickest way to find something when you do not know which tab it is on.

## Editing modes

Your file is Markdown in every mode. Switch any time; the place you were reading or typing stays put.

| Mode | Keys | What it is like |
| --- | --- | --- |
| **Word** | Ctrl+1 | Click and type on the page, like Microsoft Word. Markooj writes the Markdown for you. |
| **Inline** | Ctrl+2 | The page looks finished. The paragraph with the cursor shows its Markdown, so you can edit it in place. Move away and it looks finished again. |
| **Simple** | Ctrl+3 | Markdown text on the left and a live preview on the right. For people who like to see and type the marks. |
| **Read** | Ctrl+4 | The finished document, with no editing tools, comments or hidden notes. Press Esc to go back. |

Switch with the **Word**, **Inline**, **Simple** and **Read** buttons at the top right of the window, or with the keys. **Ctrl+Shift+M** moves to the next mode. The mode you start in is set in File → Options → Appearance.

In Simple mode the ribbon becomes a slim toolbar. **View → Show full ribbon in Simple mode** brings the whole ribbon back.

## Document tabs

Each open document has a tab. A dot on a tab means unsaved changes. **Ctrl+Tab** and **Ctrl+Shift+Tab** move between tabs, and **Ctrl+W** closes one. Tabs can sit at the top, at the bottom or in a list on the left: **View → Tab position**.

## The outline

The outline on the left lists your headings. Click one to jump there. **Ctrl+\\** shows or hides it, and **Ctrl+Shift+O** jumps to a heading by name. Below the headings, a card shows the document's word count and its word target, if you set one.

## The status bar

From left to right: the page and word count, the writing score (click it to open the Writing Assistant), the Markdown flavor Markooj detected (for example CommonMark, GitHub, Pandoc or Obsidian), the text encoding, the document language (click to change it), the goal ring, the editing mode and the zoom slider.

## Zoom and layout

- **Ctrl+Alt+=** zooms in, **Ctrl+-** zooms out, **Ctrl+0** shows 100%. Ctrl and the mouse wheel zoom too. Zoom never changes printing.
- **View → Print** shows paper pages; **View → Web** lets the text use the full width.
- **Focus** (F11) hides everything but the page. Esc brings the rest back.
- **Typewriter** scrolling keeps the line you type in the middle of the screen.
- **Formatting marks** (Ctrl+Shift+8) shows a ¶ at the end of every paragraph. The marks never print.

## The ruler and guides

**View → Ruler** shows a ruler above the page and another on its left, like Word. It works in Word, Inline and Read modes (Simple mode has no page to measure) and Markooj remembers whether it is on.

- The gray parts of the ruler are the margins; the white part is where your text goes. Numbers count from the margin. In a right-to-left document (Urdu, Arabic, Persian) the top ruler counts from the right margin to the left.
- The small triangles on the top ruler show the indents of the paragraph with the cursor.
- The rulers measure in centimeters or inches. Automatic uses inches in the United States and centimeters everywhere else. Click the small **cm** or **in** button where the rulers meet to switch, or choose in **File → Options → Window and ruler**.
- The rulers stay sharp at every zoom level and follow the dark theme.

**Guides** are thin blue lines that help you line things up, as in Adobe Illustrator:

- **Add one with the mouse:** drag from the top ruler down onto the page for a horizontal guide, or from the left ruler onto the page for a vertical one. Hold Shift to snap to the ruler's marks. A small label shows the position while you drag.
- **Move it:** drag it. **Remove it:** drag it back onto a ruler.
- **Type an exact position:** double-click the guide (or press Enter on it). You can type `2.5`, `2,5 cm`, `1 in` or `30 mm`.
- **With the keyboard:** **View → Guides** lists every guide with Change and Remove buttons, and **Add guide…** places one at an exact distance from the margin. A guide you reach with Tab moves with the arrow keys (Shift for whole steps); Delete removes it.
- **Clear guides** (Alt+Q, then type "clear guides") removes them all.

Guides never become part of your document: they are not saved in the Markdown and never print or export. They stay with each open document until you close it. Turn on **Remember guides for each file** in File → Options → Window and ruler to keep them for next time (Markooj stores them in its own settings, by file name).

## Split, side by side and more windows

The **View → Window** group works like Word's.

### Split (Ctrl+Alt+S)

**Split** shows the document you are working on in two panes, so you can read one part while you write another.

- Each pane has its **own editing mode**. For example, Word mode above and Simple mode below shows the finished page with its Markdown. Choose the second pane's mode in its own bar, or press Ctrl+1 to Ctrl+4 while typing in it. The ribbon's mode buttons change the first pane.
- Each pane scrolls on its own. Typing in one pane shows up in the other right away: both panes show the same document, so there is never a second copy to keep in step.
- The ribbon, the formatting keys and Insert work on the pane with the cursor. A thin blue line marks that pane.
- **Drag the divider** to change the sizes. Double-click it (or press Enter on it) for two equal panes; arrow keys move it; Esc on the divider closes the split.
- **Stacked or side by side:** Split starts with one pane above the other, like Word; View Side by Side starts with the documents next to each other. The button in the pane's bar switches between the two, and File → Options → Window and ruler remembers your choice for both.
- **Swap** gives each pane the other pane's mode.
- To go back to one pane, click **Split** again, press Ctrl+Alt+S, or click the × in the pane's bar.
- F6 moves the keyboard through both panes.

### View Side by Side

**View Side by Side** shows two different open documents next to each other, both editable. With two documents open, it starts right away; with more, it asks which one to show. **Open a file…** in that list opens one from your computer.

- The right pane's bar names its document: click the name to show another one. Its **Save** button (or Ctrl+S while typing there) saves that document.
- **Swap** puts each document in the other pane.
- **Synchronous Scrolling** is on when it starts, like Word: both documents scroll together, lined up at the same heading. Turn it off on the ribbon or in the pane's bar.

### Synchronous Scrolling

**Synchronous Scrolling** scrolls both panes together. In a split, both panes keep the same paragraph at the top, even when one shows the page and the other the Markdown. For two documents, they keep the same heading at the top (the heading with the same name, or else the one in the same place). In File → Options → Window and ruler you can choose **Same distance** instead, which keeps both panes the same share of the way down. **Reset Window Position** makes both panes the same size again.

### New Window, Arrange All and Switch Windows

- **New Window** opens the document you are working on in a second Markooj window, for example to put it on a second screen. Both windows show the same text: typing in one shows up in the other at once, and saving from either window saves the same file. Nothing is lost when both windows change the text at the same moment: changes to different places are both kept, and if two changes land on the very same words, the version that was replaced is kept in File → Recover.
- **Open in New Window…** (Alt+Q, then type "new window") opens another file in a window of its own. Opening a file that another Markooj window already has open links the two windows in the same way.
- **Arrange All** places every Markooj window side by side on the screen. With no split open, **Reset Window Position** does the same.
- **Switch Windows** lists the open Markooj windows; pick one to bring it to the front. **Ctrl+F6** goes to the next window and **Ctrl+Shift+F6** to the previous one.
- Closing a window that shares a document with another window does not ask about saving that document: the other window still has it.

## Light and dark

**View → Theme** switches between light, dark and matching your system. The page, the ribbon and diagrams follow it. Exports and prints are always light.

## Moving around with the keyboard

**F6** moves the keyboard to the next part of the window (ribbon, document tabs, outline, page, the second pane of a split, status bar) and **Shift+F6** to the previous one. KeyTips on the View tab follow Word: **Alt, W, S** splits the window, **Alt, W, B** is View Side by Side, **Alt, W, N** New Window, **Alt, W, A** Arrange All, **Alt, W, W** Switch Windows and **Alt, W, R, U** the ruler. All shortcuts are in [Keyboard shortcuts](keyboard-shortcuts.md).

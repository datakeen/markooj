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
| **View** | Print or Web layout, Focus, writing goals, the outline, zoom, editing mode and theme. |
| **Developer** | Macros, the recorder, the macro editor, the Python console, math macros and add-ins. |
| **Add-ins** | The buttons your add-ins add. |
| **Help** | This manual (F1), Tutorials, Keyboard Shortcuts, What's New, Report a Problem, Check Tools and About Markooj. File → Help has the same. |

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

## Light and dark

**View → Theme** switches between light, dark and matching your system. The page, the ribbon and diagrams follow it. Exports and prints are always light.

## Moving around with the keyboard

**F6** moves the keyboard to the next part of the window (ribbon, document tabs, outline, page, status bar) and **Shift+F6** to the previous one. All shortcuts are in [Keyboard shortcuts](keyboard-shortcuts.md).

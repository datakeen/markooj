# Keyboard shortcuts

Markooj uses Word's shortcuts wherever Markdown has the same thing. Rows marked **Word** work as they do in Microsoft Word. The **Command** column is the name to use with `run(...)` in a macro (see [Macros and scripting](macros-and-scripting.md)).

The same list is in **File → Options → Keyboard**, where you can search by name or by key. **Ctrl+/** shows it too.

## File

| Keys | Does | Word | Command |
| --- | --- | --- | --- |
| `Ctrl+W` or `Ctrl+F4` | Close document | Word | `file.close` |
| `Ctrl+Shift+E` | Export |  | `file.export` |
| `Alt+F` | File |  | `file.backstage` |
| `Ctrl+N` | New document | Word | `file.new` |
| `Ctrl+O` or `Ctrl+F12` | Open | Word | `file.open` |
| `Ctrl+P` or `Ctrl+F2` or `Ctrl+Shift+F12` | Print | Word | `file.print` |
| `Ctrl+S` or `Shift+F12` | Save | Word | `file.save` |
| `Ctrl+Shift+S` or `F12` | Save As | Word | `file.saveAs` |

## Edit

| Keys | Does | Word | Command |
| --- | --- | --- | --- |
| `Ctrl+F` | Find | Word | `edit.find` |
| `F3` | Find next | Word | `edit.findNext` |
| `Shift+F4` | Find previous | Word | `edit.findPrev` |
| `Ctrl+G` | Go To | Word | `edit.goTo` |
| `Ctrl+Shift+V` or `Ctrl+Alt+V` | Paste as plain text | Word | `edit.pastePlain` |
| `Ctrl+Y` or `Ctrl+Shift+Z` | Redo | Word | `edit.redo` |
| `F4` | Repeat | Word | `edit.repeat` |
| `Ctrl+H` | Replace | Word | `edit.replace` |
| `Ctrl+Z` | Undo | Word | `edit.undo` |

## Font

| Keys | Does | Word | Command |
| --- | --- | --- | --- |
| `Ctrl+B` | Bold | Word | `format.bold` |
| `Shift+F3` | Change Case | Word | `edit.changeCase` |
| `Ctrl+Space` | Clear formatting | Word | `format.clear` |
| `Ctrl+Shift+>` or `Ctrl+]` | Grow Font | Word | `format.growFont` |
| `Ctrl+Alt+4` | Heading 4 |  | `format.h4` |
| `Ctrl+Alt+5` | Heading 5 |  | `format.h5` |
| `Ctrl+Alt+6` | Heading 6 |  | `format.h6` |
| `Ctrl+Shift+H` or `Ctrl+Alt+H` | Highlight | Word | `format.highlight` |
| `` Ctrl+` `` | Inline code |  | `format.code` |
| `Ctrl+I` | Italic | Word | `format.italic` |
| `Ctrl+Shift+<` or `Ctrl+[` | Shrink Font | Word | `format.shrinkFont` |
| `Ctrl+Shift+X` | Strikethrough |  | `format.strike` |
| `Ctrl+=` | Subscript | Word | `format.sub` |
| `Ctrl+.` or `Ctrl+Shift+=` | Superscript | Word | `format.sup` |
| `Ctrl+U` | Underline | Word | `format.underline` |

## Paragraph

| Keys | Does | Word | Command |
| --- | --- | --- | --- |
| `Ctrl+L` | Align left | Word | `para.alignLeft` |
| `Ctrl+R` | Align right | Word | `para.alignRight` |
| `Ctrl+Shift+L` | Bullets | Word | `list.bullet` |
| `Ctrl+E` | Center | Word | `para.alignCenter` |
| `Ctrl+Shift+9` | Checklist |  | `list.task` |
| `Ctrl+Q` | Clear paragraph formatting | Word | `format.clearParagraph` |
| `Alt+Shift+Right` | Demote | Word | `para.demote` |
| `Ctrl+Alt+1` | Heading 1 | Word | `format.h1` |
| `Ctrl+Alt+2` | Heading 2 | Word | `format.h2` |
| `Ctrl+Alt+3` | Heading 3 | Word | `format.h3` |
| `Ctrl+M` | Increase indent | Word | `para.indent` |
| `Ctrl+J` | Justify | Word | `para.alignJustify` |
| `Ctrl+Left Shift` | Left-to-right text direction | Word | `para.ltr` |
| `Ctrl+5` | Line spacing 1.5 | Word | `layout.lineSpacing15` |
| `Alt+Shift+Down` | Move paragraph down | Word | `para.moveDown` |
| `Alt+Shift+Up` | Move paragraph up | Word | `para.moveUp` |
| `Ctrl+Alt+0` or `Ctrl+Shift+N` | Normal text | Word | `format.normal` |
| `Ctrl+Shift+7` | Numbering |  | `list.number` |
| `Alt+Shift+Left` | Promote | Word | `para.promote` |
| `Ctrl+Alt+Q` | Quote |  | `para.quote` |
| `Ctrl+Right Shift` | Right-to-left text direction | Word | `para.rtl` |
| `Ctrl+Shift+8` | Show formatting marks | Word | `view.formattingMarks` |

## Insert

| Keys | Does | Word | Command |
| --- | --- | --- | --- |
| `Ctrl+Alt+C` | Code block |  | `insert.codeBlock` |
| `Alt+Shift+D` | Date and time | Word | `insert.dateTime` |
| `Alt+=` | Equation | Word | `insert.equation` |
| `Ctrl+Alt+F` or `Ctrl+Alt+D` | Insert footnote | Word | `ref.footnote` |
|  | Link |  | `insert.link` |
| `Ctrl+Enter` | Page break | Word | `insert.pageBreak` |

## References

| Keys | Does | Word | Command |
| --- | --- | --- | --- |
| `Ctrl+Alt+R` | Cross-reference |  | `xref.crossref` |
| `Ctrl+Alt+Shift+C` | Insert caption |  | `xref.caption` |
| `Ctrl+Shift+C` | Insert citation |  | `ref.cite` |
| `F9` | Update numbers |  | `xref.update` |

## Review

| Keys | Does | Word | Command |
| --- | --- | --- | --- |
| `Ctrl+Alt+M` | New comment | Word | `review.comment` |
| `Alt+F7` | Next writing issue |  | `writing.nextIssue` |
| `Alt+Shift+F7` | Previous writing issue |  | `writing.prevIssue` |
| `F7` | Spelling and Grammar | Word | `review.spelling` |
| `Shift+F7` | Thesaurus | Word | `review.thesaurus` |
| `Ctrl+Shift+G` | Word count |  | `review.wordCount` |

## View

| Keys | Does | Word | Command |
| --- | --- | --- | --- |
| `Ctrl+0` | 100% |  | `view.zoom100` |
| `F11` | Focus |  | `view.focus` |
| `Ctrl+2` | Inline mode |  | `view.modeInline` |
| `F10` | KeyTips | Word | `view.focusRibbon` |
| `Ctrl+Shift+M` | Next editing mode |  | `view.toggleMode` |
| `F6` | Next pane | Word | `view.nextPane` |
| `Ctrl+\` | Outline |  | `view.outline` |
| `Shift+F6` | Previous pane | Word | `view.prevPane` |
| `Ctrl+4` | Read mode |  | `view.modeRead` |
| `Ctrl+F1` | Show or hide ribbon commands | Word | `view.toggleRibbon` |
| `Ctrl+3` | Simple mode |  | `view.modeSimple` |
| `Ctrl+Shift+/` | What’s this in Markdown? |  | `view.showMarkdown` |
| `Ctrl+1` | Word mode |  | `view.modeWord` |
| `Ctrl+Alt+=` | Zoom in | Word | `view.zoomIn` |
| `Ctrl+-` or `Ctrl+Alt+-` | Zoom out | Word | `view.zoomOut` |

## Window

| Keys | Does | Word | Command |
| --- | --- | --- | --- |
| `Ctrl+Tab` or `Ctrl+PageDown` | Next document |  | `tab.next` |
| `Ctrl+Shift+Tab` or `Ctrl+PageUp` | Previous document |  | `tab.prev` |

## Developer

| Keys | Does | Word | Command |
| --- | --- | --- | --- |
| `Alt+F11` | Macro editor |  | `dev.editor` |
| `Alt+F8` | Macros |  | `dev.macros` |
| `Ctrl+Alt+P` | Python console |  | `dev.pythonConsole` |
| `Ctrl+Alt+Enter` | Run selection |  | `dev.runSelection` |

## Help

| Keys | Does | Word | Command |
| --- | --- | --- | --- |
| `F1` | Help: this manual | Word |  |
| `Ctrl+Shift+O` | Go to heading |  | `app.goToHeading` |
| `Ctrl+/` | Keyboard shortcuts |  | `app.shortcuts` |
| `Alt+Q` or `Ctrl+Shift+P` | Search and commands |  | `app.commandPalette` |

## PDF and DjVu viewer

| Keys | Does | Word | Command |
| --- | --- | --- | --- |
| `Ctrl+Alt+G` | Go to page |  | `viewer.goToPage` |

## While you type

| Keys | Does |
| --- | --- |
| `Tab` / `Shift+Tab` in a list | Move the list item in or out one level. |
| `Tab` / `Shift+Tab` in a table | Move to the next or previous cell. Tab in the last cell adds a row. |
| `Enter` or `Shift+Enter` in a table cell | A new line inside the cell, as in Word. Down in the last row leaves the table. |
| `Ctrl+K` | Insert or edit a link (while typing in the page). |
| `Tab` or `Right arrow` | Accept a word suggestion (when Suggest words as I type is on). |
| `Esc` | Hide a word suggestion, close a card or menu, leave Read mode or Focus. |
| `Ctrl` + click on a cross-reference | Jump to the figure, table, equation or heading it points to. |
| Double-click a word | Show synonyms (can be turned off in Options → Writing). |
| Double-click an equation | Edit it in the equation editor. |
| Double-click a citation | Edit the citation. |

## In the equation editor

| Keys | Does |
| --- | --- |
| `Enter` | Insert (or update) the equation. |
| `Esc` | Cancel. |
| `Tab` | The next box, for example from the top of a fraction to the bottom. |
| `Shift+Enter` | A new line in the LaTeX box. |
| `Alt+D` | Switch between Inline and Display. |
| `Alt+N` | Numbered on or off. |
| `Alt+L` | Go to the Label box. |
| `Alt+T` | Go to the LaTeX box. |
| `Alt+E` | Go back to the visual editor. |
| `Alt+P` | Go to the palettes. |
| `Alt+1` … `Alt+9` | Open a palette tab. |
| `Ctrl+PageDown` / `Ctrl+PageUp` | Next or previous palette tab. |
| `Alt+F` | Add the equation to your favorites. |
| `Alt+K` | Show the math keyboard on screen. |
| `Alt+H` | Show the typing shortcuts. |

## In the macro editor

| Keys | Does |
| --- | --- |
| `Ctrl+Enter` or `F5` | Run the macro. |
| `Ctrl+S` | Save the macro. |
| `F1` | Show the API reference and examples. |

## KeyTips

Press `Alt` on its own, or `F10`, to show a letter on every ribbon tab: **F** File, **H** Home, **N** Insert, **P** Layout, **S** References, **R** Review, **W** View, **L** Developer, **X** Add-ins, **Y** Help, and **JT** Table Design and **JL** Table Layout while the cursor is in a table. Type the letter to open the tab, then the letters on its buttons. `Esc` goes back one level. Arrow keys move around the ribbon.

## Word keys that work differently here

| Key | In Word | In Markooj |
| --- | --- | --- |
| `Ctrl+1` | Single line spacing | In Markooj Ctrl+1 to Ctrl+4 switch the editing mode (Word, Inline, Simple, Read). Use Layout → Line spacing. |
| `Ctrl+2` | Double line spacing | Ctrl+2 is Inline mode in Markooj. Use Layout → Line spacing. |
| `Ctrl+Shift+M` | Decrease indent | Ctrl+Shift+M switches the editing mode in Markooj. Use Alt+Shift+Left, or Shift+Tab in a list. |
| `Ctrl+D` | Font dialog | Markdown has one font per document: use Home → Font. |
| `Ctrl+Shift+A` | All caps | Use Change Case (Shift+F3) to make the text UPPERCASE. |
| `Ctrl+Shift+C` | Copy formatting | Ctrl+Shift+C inserts a citation in Markooj. To copy formatting, use Home → Format Painter. |
| `Ctrl+Shift+E` | Track changes | Ctrl+Shift+E opens Export in Markooj. Markdown has no tracked changes; use comments (Ctrl+Alt+M). |
| `Ctrl+Alt+C` | Copyright sign © | Ctrl+Alt+C inserts a code block in Markooj. Use Insert → Symbol for ©. |
| `Ctrl+Alt+R` | Registered sign ® | Ctrl+Alt+R inserts a cross-reference in Markooj. Use Insert → Symbol for ®. |
| `Ctrl+Alt+P` | Print Layout view | Ctrl+Alt+P opens the Python console in Markooj. Word mode always shows the page. |
| `Ctrl+Shift+P` | Font size box | Ctrl+Shift+P opens the command search in Markooj (like Alt+Q). Use the size box on Home → Font. |

Other editors use some of these keys for other things. Markooj follows Word:

| Key | In Markooj (as in Word) | For the other meaning |
| --- | --- | --- |
| `Ctrl+=` | Subscript | `Ctrl+Alt+=` to zoom in |
| `Ctrl+Shift+=` | Superscript | `Ctrl+Alt+=` to zoom in |
| `Ctrl+Shift+8` | Show formatting marks | `Ctrl+Shift+L` for bullets |
| `Ctrl+]` | Grow Font | `Ctrl+M` to increase indent |
| `Ctrl+[` | Shrink Font | `Shift+Tab` in a list, or `Alt+Shift+Left` |

If you give a macro a shortcut that a command already uses, the macro wins (see [Macros and scripting](macros-and-scripting.md)).

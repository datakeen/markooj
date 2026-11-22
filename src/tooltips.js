// Markooj — ScreenTips: rich hover help for every control (name, what it does, its shortcut and, for
// formatting, the Markdown it writes). Shows after 600 ms, instantly while moving across the ribbon,
// and on keyboard focus. Text comes from TIPS below, then from the command's own label/description.
(function () {
  'use strict';
  const app = window.app;
  if (!app) return;
  const esc = app.esc;

  // command id → [title, description, markdown it writes (optional)]
  const TIPS = {
    // ---- File ----
    'file.new': ['New document', 'Start a blank document in a new tab.'],
    'file.newFromTemplate': ['New from template', 'Start from a research paper, thesis, report, letter or notes template.'],
    'file.open': ['Open', 'Open Markdown, Word, PDF, DjVu, EPUB, LaTeX, HTML or text files.'],
    'file.recent': ['Open recent', 'Pick one of the files you worked on lately.'],
    'file.save': ['Save', 'Save your work as a Markdown (.md) file. The first time, Markooj asks where to put it.'],
    'file.saveAs': ['Save As', 'Save a copy under another name, or export to PDF, Word, EPUB and more.'],
    'file.saveAsMarkdown': ['Save a copy as Markdown', 'Write the document to a new .md file and keep working on that copy.'],
    'file.saveAll': ['Save all', 'Save every open document that has changes.'],
    'file.export': ['Export', 'Share the document as PDF, Word, EPUB, a web page, LaTeX and more. Your Markdown file stays as it is.'],
    'file.exportPdf': ['Export as PDF', 'Make a print-ready PDF with sharp equations.'],
    'file.exportDocx': ['Export as Word document', 'Make a .docx file that opens in Microsoft Word.'],
    'file.exportHtml': ['Export as web page', 'Make one self-contained .html file.'],
    'file.print': ['Print', 'See the pages and print them.'],
    'file.printNow': ['Print without preview', 'Go straight to the system print window.'],
    'file.close': ['Close document', 'Close this tab. Unsaved changes are kept in File → Recover.'],
    'file.closeOthers': ['Close other documents', 'Close every tab except this one.'],
    'file.info': ['Document info', 'Title, authors, keywords and other properties of this document.'],
    'file.backstage': ['File', 'New, open, save, export, print and options.'],
    'file.options': ['Options', 'Theme, start mode, fonts, typing helpers and more.'],
    'file.reveal': ['Show in folder', 'Open the folder that holds this file.'],
    'file.revealInFolder': ['Show in folder', 'Open the folder that holds this file.'],
    'file.copyPath': ['Copy file path', 'Copy where this file is saved, for pasting elsewhere.'],
    'file.recover': ['Recover unsaved documents', 'Bring back documents you closed without saving.'],
    'file.openRecoveryFolder': ['Open recovery folder', 'Show where Markooj keeps recovery copies.'],
    // ---- Edit / Clipboard ----
    'edit.undo': ['Undo', 'Take back your last change.'],
    'edit.redo': ['Redo', 'Bring back the change you just undid.'],
    'edit.cut': ['Cut', 'Remove the selection and put it on the clipboard.'],
    'edit.copy': ['Copy', 'Put a copy of the selection on the clipboard.'],
    'edit.paste': ['Paste', 'Insert what is on the clipboard. Formatting from Word and web pages is kept.'],
    'edit.pastePlain': ['Paste as plain text', 'Insert the clipboard without any formatting.'],
    'edit.find': ['Find', 'Look for words in this document.'],
    'edit.findNext': ['Find next', 'Go to the next match.'],
    'edit.findPrev': ['Find previous', 'Go to the previous match.'],
    'edit.replace': ['Replace', 'Find words and replace them with others.'],
    'edit.changeCase': ['Change Case', 'Switch the selected text between UPPERCASE, lowercase and Capitalize Each Word. Press again to cycle. With nothing selected, changes the word at the cursor.'],
    'edit.changeCaseMenu': ['Change Case', 'Change the selected text to Sentence case., lowercase, UPPERCASE, Capitalize Each Word, tOGGLE cASE or Title Case.'],
    'edit.case.sentence': ['Sentence case', 'Capitalize only the first letter of each sentence in the selection.'],
    'edit.case.lower': ['lowercase', 'Make every letter in the selection small.'],
    'edit.case.upper': ['UPPERCASE', 'Make every letter in the selection a capital.'],
    'edit.case.title': ['Capitalize Each Word', 'Start every word in the selection with a capital letter.'],
    'edit.case.toggle': ['tOGGLE cASE', 'Swap small and capital letters in the selection.'],
    'edit.case.titleCase': ['Title Case', 'Capitalize the important words and keep short words like a, and, of and in lowercase, as APA and Chicago ask for titles and headings.'],
    // ---- sample add-ins ----
    'readability.report': ['Readability report', 'Reading ease, grade level and sentence lengths for this document.'],
    'readability.highlight': ['Highlight long sentences', 'Mark sentences that are hard to read because they run long. Click again to clear.'],
    'siunits.format': ['Format numbers with units', 'Turn quantities in the selection, like 5 m/s^2, into math with upright units and a thin space.', '$5\\,\\mathrm{m/s^{2}}$'],
    'wordfreq.insert': ['Word frequency table', 'Insert a table of the words used most often in this document.'],
    // ---- Font ----
    'format.bold': ['Bold', 'Make the selected text bold.', '**bold**'],
    'format.italic': ['Italic', 'Make the selected text italic.', '*italic*'],
    'format.underline': ['Underline', 'Underline the selected text.', '<u>underline</u>'],
    'format.strike': ['Strikethrough', 'Draw a line through the selected text.', '~~text~~'],
    'format.sub': ['Subscript', 'Make small letters below the line, like H₂O.', 'H~2~O'],
    'format.sup': ['Superscript', 'Make small letters above the line, like x².', 'x^2^'],
    'format.code': ['Inline code', 'Show the selection in a fixed-width code font.', '`code`'],
    'format.highlight': ['Highlight', 'Mark the selection with a highlighter color.', '==highlighted=='],
    'format.color': ['Font color', 'Change the color of the selected text.', '<span style="color:…">text</span>'],
    'format.clear': ['Clear formatting', 'Remove bold, italic, colors and other formatting from the selection.'],
    'format.painter': ['Format painter', 'Copy the formatting of the selection, then select other text to apply it.'],
    'format.fontFamily': ['Font', 'Changes the font of all body text — Markdown has one font per document, not per word. Headings follow the document theme.'],
    'format.fontSize': ['Font Size', 'Changes the size of all body text — Markdown has one text size per document. For bigger text use a Heading.'],
    'format.growFont': ['Grow Font', 'Make all body text one size bigger — Markdown has one text size per document. For bigger text use a Heading.'],
    'format.shrinkFont': ['Shrink Font', 'Make all body text one size smaller — Markdown has one text size per document.'],
    'format.clearParagraph': ['Clear paragraph formatting', 'Remove paragraph formatting such as center or right alignment. The words and the paragraph style stay.'],
    'layout.lineSpacing15': ['Line spacing 1.5', 'Set 1.5 line spacing for the whole document. Press again for the default spacing.'],
    'para.promote': ['Promote', 'Make a heading one level bigger (Heading 2 → Heading 1), or move a list item out one level.'],
    'para.demote': ['Demote', 'Make a heading one level smaller (Heading 1 → Heading 2), or move a list item in one level.'],
    'para.moveUp': ['Move paragraph up', 'Move the paragraph or list item with the cursor above the one before it.'],
    'para.moveDown': ['Move paragraph down', 'Move the paragraph or list item with the cursor below the one after it.'],
    'edit.repeat': ['Repeat', 'Do the last formatting or insert command again.'],
    'edit.goTo': ['Go To', 'Jump to a heading in the document, or to a page in a PDF or DjVu file.'],
    'format.style': ['Styles', 'Turn the paragraph into a heading, a quote or normal text.'],
    'format.normal': ['Normal text', 'Turn a heading or quote back into a normal paragraph.'],
    'format.h1': ['Heading 1', 'A main section heading. Shows in the outline and the table of contents.', '# Heading'],
    'format.h2': ['Heading 2', 'A subsection heading.', '## Heading'],
    'format.h3': ['Heading 3', 'A smaller heading inside a subsection.', '### Heading'],
    'format.h4': ['Heading 4', 'A fourth-level heading.', '#### Heading'],
    'format.h5': ['Heading 5', 'A fifth-level heading.', '##### Heading'],
    'format.h6': ['Heading 6', 'The smallest heading.', '###### Heading'],
    // ---- Paragraph ----
    'list.bullet': ['Bullets', 'Start a bulleted list, or turn the selected lines into one.', '- item'],
    'list.number': ['Numbering', 'Start a numbered list.', '1. item'],
    'list.task': ['Checklist', 'Start a list of tasks you can tick off.', '- [ ] task'],
    'para.indent': ['Increase indent', 'Move a list item one level in. Tab does the same in a list.'],
    'para.outdent': ['Decrease indent', 'Move a list item one level out. Shift+Tab does the same in a list.'],
    'para.align': ['Align', 'Line up the paragraph left, center, right or both sides.'],
    'para.alignLeft': ['Align left', 'Line the paragraph up on the left (normal text).'],
    'para.alignCenter': ['Center', 'Center the paragraph.', '<div align="center">…</div>'],
    'para.alignRight': ['Align right', 'Line the paragraph up on the right.', '<div align="right">…</div>'],
    'para.alignJustify': ['Justify', 'Line the paragraph up on both sides.', '<div align="justify">…</div>'],
    'para.quote': ['Quote', 'Set the paragraph apart as a quotation.', '> quoted text'],
    'insert.codeBlock': ['Code block', 'A block of program code in a fixed-width font.', '```\ncode\n```'],
    // ---- Insert ----
    'insert.table': ['Table', 'Insert a table. Pick the number of rows and columns.', '| A | B |\n|---|---|'],
    'insert.image': ['Picture', 'Insert a picture from your computer. It is saved next to the document.', '![Caption](picture.png)'],
    'insert.picture': ['Picture', 'Insert a picture from your computer.', '![Caption](picture.png)'],
    'insert.diagram': ['Diagram', 'Draw a flowchart or other diagram from a short text description (Mermaid).', '```mermaid'],
    'insert.equation': ['Equation', 'Insert an equation. Type it visually or in LaTeX; both stay in sync.', '$$ E = mc^2 $$'],
    'insert.code': ['Code', 'Insert a block of program code with syntax colors.', '```python'],
    'insert.callout': ['Callout', 'A colored box for a note, tip or warning.', '> [!NOTE]'],
    'insert.link': ['Link', 'Link the selection to a web page or a place in the document.', '[text](https://…)'],
    'insert.hr': ['Divider', 'A horizontal line between sections.', '---'],
    'insert.pageBreak': ['Page break', 'Start a new page here when printing or exporting.', '<div class="page-break"></div>'],
    'insert.footnote': ['Footnote', 'Add a numbered note at the bottom of the page.', 'text[^1]'],
    'insert.citation': ['Citation', 'Cite a source from your reference library.', '[@smith2020]'],
    'insert.symbol': ['Symbol', 'Insert Greek letters, arrows, math and other symbols.'],
    'insert.dateTime': ['Date and time', 'Insert today’s date or the current time.'],
    'insert.crossref': ['Cross-reference', 'Refer to a heading, figure, table or equation by its number. The number updates when things move.', '[@fig:flume]'],
    'insert.caption': ['Insert caption', 'Give the selected figure, table or equation a numbered caption.', '{#fig:name}'],
    // ---- Layout ----
    'layout.margins': ['Margins', 'Set the white space around the text on each page.'],
    'layout.size': ['Size', 'Choose the paper size, such as Letter or A4.'],
    'layout.columns': ['Columns', 'Split the text into one or two columns.'],
    'layout.lineSpacing': ['Line spacing', 'Space between lines in a paragraph.'],
    'layout.paraSpacing': ['Paragraph spacing', 'Space after each paragraph.'],
    'layout.theme': ['Document theme', 'Fonts and colors for the whole document and its exports.'],
    // ---- References ----
    'ref.toc': ['Table of contents', 'Insert a table of contents built from your headings.'],
    'ref.tocUpdate': ['Update table', 'Refresh the table of contents after headings change.'],
    'ref.footnote': ['Insert footnote', 'Add a numbered note at the bottom of the page.', 'text[^1]'],
    'ref.prevFootnote': ['Previous footnote', 'Jump to the footnote before this point.'],
    'ref.nextFootnote': ['Next footnote', 'Jump to the next footnote.'],
    'ref.cite': ['Insert citation', 'Cite a source from your reference library (.bib).', '[@smith2020]'],
    'ref.editCitation': ['Edit citation', 'Change the sources or page numbers of this citation.'],
    'ref.library': ['Citation library', 'Choose the .bib file with your sources.'],
    'ref.reloadLibrary': ['Reload library', 'Read the .bib file again after you changed it elsewhere.'],
    'ref.style': ['Citation style', 'APA, Chicago, IEEE and other styles for citations and the bibliography.'],
    'ref.bibliography': ['Bibliography', 'Insert the list of works you cited.'],
    'ref.crossref': ['Cross-reference', 'Refer to a heading, figure, table or equation by its number. The number updates when things move.', '[@eq:shields]'],
    'ref.insertCaption': ['Insert caption', 'Give the selected figure, table or equation a numbered caption and label.', '{#fig:name}'],
    'ref.numberEquations': ['Number equations', 'Number display equations (1), (2)… in the right margin.'],
    'ref.numberAll': ['Number all equations', 'Give every display equation a number, not only the labeled ones.'],
    'ref.numberingStyle': ['Numbering style', 'Plain 1, 2, 3 or by chapter 1.1, 1.2, and the words used: Eq., Fig., Table.'],
    'ref.updateFields': ['Update numbers', 'Renumber equations, figures, tables and references.'],
    // ---- Review ----
    'review.spelling': ['Spelling', 'Go through the words the dictionary does not know, one by one, with suggestions to change, ignore or add them.'],
    'review.spellingAsYouType': ['Check spelling as you type', 'Show or hide the red lines under unknown words while you type. Right-click a red word for suggestions.'],
    'review.wordCount': ['Word count', 'Words, characters, equations and citations in the document or the selection.'],
    'review.readability': ['Readability', 'How easy the text is to read, with sentence length and reading level.'],
    'review.comment': ['New comment', 'Add a comment at the cursor. Comments never show in exports unless you ask.', '<!-- comment: … -->'],
    'review.deleteComment': ['Delete comment', 'Remove the selected comment.'],
    'review.deleteComments': ['Delete all comments', 'Remove every comment in the document.'],
    'review.prevComment': ['Previous comment', 'Jump to the comment before this point.'],
    'review.nextComment': ['Next comment', 'Jump to the next comment.'],
    'review.showComments': ['Show comments', 'Show or hide comment bubbles and hidden notes while editing.'],
    'review.compare': ['Compare', 'See what changed since the last save.'],
    'review.hiddenNote': ['Hidden note', 'A note to yourself that shows faintly while editing and never in Read mode or exports.', '%%note%%'],
    // ---- View ----
    'view.printLayout': ['Print layout', 'See the document as pages of paper.'],
    'view.webLayout': ['Web layout', 'Let the text use the full width of the window.'],
    'view.focus': ['Focus', 'Hide everything but the page. Press Esc to come back.'],
    'view.outline': ['Outline', 'Show or hide the list of headings on the left.'],
    'view.toggleRibbon': ['Show or hide ribbon commands', 'Switch between Show tabs and commands and Show tabs only. A double-click on a tab does the same.'],
    'view.ribbonOptions': ['Ribbon display options', 'Show tabs and commands, Show tabs only, or Full-screen mode.'],
    'view.ribbonTabsAndCommands': ['Show tabs and commands', 'Keep the ribbon tabs and commands showing all the time.'],
    'view.ribbonTabsOnly': ['Show tabs only', 'Show only the tab names for more room. Click a tab to drop the ribbon down over the page.'],
    'view.ribbonFullScreen': ['Full-screen mode', 'Hide the title bar and ribbon. Move the pointer to the top edge, or press Alt, to show them.'],
    'view.ribbonDisplay': ['Ribbon display', 'Set how the ribbon shows: pinned, tabs only or full screen.'],
    'view.pinRibbon': ['Pin the ribbon', 'Keep the ribbon open all the time (Show tabs and commands).'],
    'view.formattingMarks': ['Show formatting marks', 'Show a ¶ mark at the end of every paragraph, like Word. The marks never print or export.'],
    'view.showRibbon': ['Show the full ribbon', 'In Simple mode, show all ribbon tabs instead of the slim toolbar.'],
    'view.focusRibbon': ['KeyTips', 'Show a letter on every ribbon tab and button: type it to use that control. Arrow keys move around the ribbon, Esc goes back. Pressing Alt alone does the same.'],
    'view.nextPane': ['Next pane', 'Move the keyboard to the next part of the window: ribbon, document tabs, outline, page and status bar.'],
    'view.prevPane': ['Previous pane', 'Move the keyboard to the previous part of the window.'],
    'view.tabPosition': ['Tab position', 'Put the document tabs at the top, at the bottom or on the left.'],
    'view.tabsTop': ['Tabs at the top', 'Show document tabs above the page.'],
    'view.tabsBottom': ['Tabs at the bottom', 'Show document tabs below the page.'],
    'view.tabsLeft': ['Tabs on the left', 'Show document tabs in a list on the left.'],
    'view.zoomIn': ['Zoom in', 'Make the page bigger on screen. Printing is not affected.'],
    'view.zoomOut': ['Zoom out', 'Make the page smaller on screen.'],
    'view.zoom100': ['100%', 'Show the page at its real size.'],
    'view.pageWidth': ['Page width', 'Zoom so the page fills the width of the window.'],
    'view.zoom': ['Zoom', 'Pick an exact zoom level.'],
    'view.mode': ['Editing mode', 'Word, Inline, Simple or Read. Your file stays Markdown in every mode.'],
    'view.toggleMode': ['Next editing mode', 'Move to the next mode: Word, Inline, Simple, Read.'],
    'view.modeWord': ['Word mode', 'Click and type on the page, like Microsoft Word. Markooj writes the Markdown for you.'],
    'view.modeInline': ['Inline mode', 'The page looks finished, and the paragraph you are in shows its Markdown so you can edit it in place.'],
    'view.modeSimple': ['Simple mode', 'Markdown text on the left and a live preview on the right.'],
    'view.modeRead': ['Read mode', 'The finished document for reading: no editing tools, comments or hidden notes. Press Esc to go back.'],
    'view.showMarkdown': ['What’s this in Markdown?', 'Show the Markdown behind the selection in a small card, so you learn it as you go.'],
    'view.theme': ['Theme', 'Switch between matching your system, light and dark.'],
    'view.setTheme': ['Theme', 'Match system, light or dark.'],
    'view.themeLight': ['Light theme', 'Dark text on a light background.'],
    'view.themeDark': ['Dark theme', 'Light text on a dark background, easier at night.'],
    'view.themeSystem': ['Match system', 'Follow your computer’s light or dark setting.'],
    'view.wordTarget': ['Word target', 'Set how many words you are aiming for. Progress shows under the outline.'],
    'view.togglePreview': ['Preview', 'Show or hide the live preview in Simple mode.'],
    // ---- Window / help ----
    'tab.next': ['Next document', 'Switch to the next tab.'],
    'tab.prev': ['Previous document', 'Switch to the previous tab.'],
    'app.commandPalette': ['Search and commands', 'Find any command, open document or heading by typing a few letters.'],
    'app.goToHeading': ['Go to heading', 'Jump to a heading by typing part of its name.'],
    'app.shortcuts': ['Keyboard shortcuts', 'See every keyboard shortcut in one list.'],
    // ---- Viewer ----
    'viewer.editAsText': ['Edit as text', 'Make an editable Markdown copy of this PDF or DjVu file.'],
    'viewer.goToPage': ['Go to page', 'Jump to a page number.'],
    'viewer.nextPage': ['Next page', 'Show the next page.'],
    'viewer.prevPage': ['Previous page', 'Show the previous page.'],
    'viewer.thumbnails': ['Page thumbnails', 'Show small pictures of every page on the side.'],
    // ---- Developer / add-ins ----
    'dev.macros': ['Macros', 'See, run and edit your saved macros.'],
    'dev.newMacro': ['New macro', 'Write a new macro in Python or JavaScript.'],
    'dev.runMacro': ['Run macro', 'Pick a saved macro and run it.'],
    'dev.stopMacro': ['Stop macro', 'Stop the macro that is running.'],
    'dev.record': ['Record macro', 'Record what you do so you can play it back later.'],
    'dev.stopRecording': ['Stop recording', 'Finish recording and save the macro.'],
    'dev.editor': ['Macro editor', 'Write and test macros with code colors and a console.'],
    'dev.pythonConsole': ['Python console', 'Run Python right inside Markooj, no install needed.'],
    'dev.runSelection': ['Run selection', 'Run the selected code as Python and show the result.'],
    'dev.mathMacros': ['Math macros', 'Define your own LaTeX commands, like \\R for ℝ.'],
    'dev.addins': ['Manage add-ins', 'Turn add-ins on or off and see what they add.'],
    'dev.installAddin': ['Install add-in', 'Add an add-in from a .js file.'],
    'dev.openAddinsFolder': ['Add-ins folder', 'Open the folder where your add-ins live.'],
    'addins.reload': ['Reload add-ins', 'Load your add-ins again (restarts the window).'],
  };

  // ---------- lookup ----------
  const sh = () => app.shell || {};
  function keysOf(cmd) {
    if (!cmd) return [];
    const f = sh().displayShortcuts;
    if (f) return f(cmd);
    return [].concat(cmd.shortcut || [], cmd.shortcuts || [], cmd.altShortcuts || []);
  }
  /** Everything the ScreenTip shows for a command id. */
  function info(id) {
    const cmd = id ? app.commands.get(id) : null;
    const t = TIPS[id] || (id && /^format\.h([1-6])$/.test(id) ? TIPS['format.h' + id.slice(-1)] : null);
    const label = cmd && cmd.label && cmd.label !== id ? cmd.label : '';
    const title = (t && t[0]) || label || (id ? id.split('.').pop().replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()) : '');
    let desc = (t && t[1]) || cmd?.description || '';
    if (!desc && cmd?.tooltip && cmd.tooltip !== title) desc = cmd.tooltip;
    if (!desc && label && label !== title) desc = label;
    const md = (t && t[2]) || cmd?.markdown || '';
    let enabled = true;
    try { enabled = !cmd?.isEnabled || !!cmd.isEnabled(); } catch {}
    return { id, title, description: desc, markdown: md, shortcuts: keysOf(cmd), enabled, known: !!cmd };
  }
  /** Add or change ScreenTip text: app.tooltips.register('my.cmd', {title, description, markdown}) */
  function register(id, o = {}) { TIPS[id] = [o.title || '', o.description || '', o.markdown || '']; }

  // ---------- the card ----------
  const tip = document.getElementById('tooltip') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'tooltip', className: 'mk-tooltip' }));
  tip.setAttribute('role', 'tooltip');
  const SHOW_DELAY = 600, FOCUS_DELAY = 350, WARM_MS = 900;
  let target = null, timer = null, shownAt = 0, hiddenAt = 0, visible = false;

  function contentFor(el) {
    const cmdId = el.dataset.tipCmd || el.dataset.cmd || '';
    const i = cmdId ? info(cmdId) : null;
    const title = (i && i.title) || el.dataset.tip || el.getAttribute('aria-label') || '';
    let desc = el.dataset.tipD || (i && i.description) || '';
    // the element's own label wins when the command is generic (e.g. a select or a mode segment)
    if (el.dataset.tip && i && TIPS[cmdId] && el.dataset.tip !== title && /^(view\.mode|format\.style|para\.align)$/.test(cmdId)) return { title: el.dataset.tip, desc: el.dataset.tipD || desc, keys: el.dataset.key ? [el.dataset.key] : [], md: '', enabled: true };
    const keys = el.dataset.key ? [el.dataset.key, ...((i && i.shortcuts) || []).filter(k => sh().normShortcut?.(k) !== sh().normShortcut?.(el.dataset.key))] : ((i && i.shortcuts) || []);
    const enabled = (i ? i.enabled : true) && !el.disabled;
    let why = '';
    if (!enabled) why = el.dataset.tipWhy || (cmdId && app.ribbon?.whyDisabled ? app.ribbon.whyDisabled(cmdId) : '') || '';
    return { title, desc: desc === title ? '' : desc, keys: keys.slice(0, 2), md: (i && i.markdown) || el.dataset.tipMd || '', enabled, why };
  }
  function render(el) {
    const c = contentFor(el);
    if (!c.title) return false;
    const fmt = sh().fmtShortcut || (s => s);
    const keys = c.keys.map(k => `<kbd>${esc(fmt(k))}</kbd>`).join('');
    tip.className = 'mk-tooltip rich' + (c.desc || c.md ? '' : ' plain');
    tip.innerHTML = `<div class="tt-h"><b>${esc(c.title)}</b>${keys ? `<span class="tt-k">${keys}</span>` : ''}</div>`
      + (c.desc ? `<div class="tt-d">${esc(c.desc)}</div>` : '')
      + (c.md ? `<div class="tt-md"><span>Markdown</span><code>${esc(c.md)}</code></div>` : '')
      + (!c.enabled ? `<div class="tt-off">${esc(c.why || 'Not available right now.')}</div>` : '')
      + '<i class="tt-arrow"></i>';
    return true;
  }
  function place(el) {
    const r = el.getBoundingClientRect();
    tip.style.left = '0px'; tip.style.top = '0px';
    const w = tip.offsetWidth, ht = tip.offsetHeight, gap = 9, pad = 8;
    // below by default; above when there is no room (status bar, bottom tabs)
    let up = r.bottom + gap + ht > innerHeight - pad && r.top - gap - ht > pad;
    // controls on the left edge (vertical tabs, backstage nav) get the tip on their right when it fits
    const side = r.height > 26 && r.left < 260 && el.closest('.vtabs, .bs-nav, .outline') && r.right + gap + w < innerWidth - pad;
    let x, y;
    if (side) { x = r.right + gap; y = Math.max(pad, Math.min(r.top + r.height / 2 - ht / 2, innerHeight - ht - pad)); }
    else { x = Math.max(pad, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - pad)); y = up ? r.top - gap - ht : r.bottom + gap; }
    tip.style.left = Math.round(x) + 'px'; tip.style.top = Math.round(y) + 'px';
    tip.dataset.place = side ? 'right' : up ? 'top' : 'bottom';
    const arrow = tip.querySelector('.tt-arrow');
    if (arrow) {
      if (side) { arrow.style.left = ''; arrow.style.top = Math.max(10, Math.min(ht - 10, r.top + r.height / 2 - y)) + 'px'; }
      else { arrow.style.top = ''; arrow.style.left = Math.max(12, Math.min(w - 12, r.left + r.width / 2 - x)) + 'px'; }
    }
  }
  function show(el) {
    if (!el || !el.isConnected || !render(el)) return;
    place(el);
    tip.classList.add('show');
    visible = true; shownAt = Date.now();
    target = el;
    if (!el.hasAttribute('aria-describedby')) { el.setAttribute('aria-describedby', 'tooltip'); el.dataset.tipDescribed = '1'; }
  }
  function hide() {
    clearTimeout(timer); timer = null;
    if (visible) hiddenAt = Date.now();
    visible = false;
    tip.classList.remove('show');
    if (target && target.dataset.tipDescribed) { target.removeAttribute('aria-describedby'); delete target.dataset.tipDescribed; }
    target = null;
  }
  const warm = () => visible || Date.now() - hiddenAt < WARM_MS;
  function schedule(el, delay) {
    clearTimeout(timer);
    const was = warm();
    if (visible && target !== el) { tip.classList.remove('show'); visible = false; hiddenAt = Date.now(); }
    target = el;
    // moving between controls while a tip is (or was just) open: show the next one right away
    timer = setTimeout(() => { if (target === el && el.isConnected && !blocked(el)) show(el); }, was ? 30 : delay);
  }
  const SEL = '[data-tip], [data-tip-cmd], .titlebar [data-cmd], .slimbar [data-cmd]';
  function blocked(el) {
    if (document.querySelector('.pop.show')?.contains(el) && !el.closest('.mk-mdpeek')) return true; // menus explain themselves
    if (el.closest('.mk-page') && !el.closest('[data-tip]')) return true;
    if (el.closest('#searchBox') && document.querySelector('.palette.show')) return true; // the palette is open below it
    return document.body.classList.contains('mk-dragging');
  }
  document.addEventListener('mouseover', e => {
    const el = e.target.closest?.(SEL);
    if (el === target) return;
    if (!el || blocked(el)) { if (target) hide(); return; }
    schedule(el, SHOW_DELAY);
  });
  document.addEventListener('mouseout', e => {
    if (!target) return;
    const to = e.relatedTarget;
    if (to && target.contains(to)) return;
    if (to && to.closest?.(SEL)) return; // mouseover handles the switch
    if (e.target.closest?.(SEL) === target) hide();
  });
  // keyboard focus (Tab, arrow keys in the ribbon) shows the tip too, but not focus that code moves after a
  // shortcut (opening File or Print puts focus on its first item: that tip would only repeat the page heading)
  let navKeyAt = 0, quietUntil = 0;
  document.addEventListener('keydown', e => { if (/^(Tab|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Home|End|F6|F10)$/.test(e.key)) navKeyAt = Date.now(); }, true);
  app.events.on('backstage:open', () => { quietUntil = Date.now() + 400; hide(); });
  document.addEventListener('focusin', e => {
    const el = e.target.closest?.(SEL);
    if (!el || blocked(el)) return;
    if (e.target.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select, [contenteditable="true"]')) return; // typing fields explain themselves
    if (Date.now() < quietUntil || Date.now() - navKeyAt > 600) return;
    let kb = false; try { kb = e.target.matches(':focus-visible'); } catch {}
    if (kb) schedule(el, FOCUS_DELAY);
  });
  document.addEventListener('focusout', e => { if (target && e.target === target) hide(); });
  document.addEventListener('mousedown', () => hide(), true);
  document.addEventListener('keydown', e => { if (!['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) hide(); }, true);
  document.addEventListener('scroll', () => { if (visible || timer) hide(); }, true);
  addEventListener('blur', hide);
  addEventListener('resize', hide);

  app.tooltips = { info, register, show: el => { clearTimeout(timer); show(el); }, hide, isVisible: () => visible, target: () => target, map: TIPS, delay: SHOW_DELAY };

  // ---------- smoke tests ----------
  const A = app.assert, sleep = ms => new Promise(r => setTimeout(r, ms));
  app.tests.register('tooltips: every command has a ScreenTip title', () => {
    const bad = app.commands.list().filter(c => !info(c.id).title);
    A(!bad.length, 'no title for: ' + bad.map(c => c.id).join(', '));
    const curated = app.commands.list().filter(c => TIPS[c.id] || /^format\.h[1-6]$/.test(c.id)).length;
    A(curated >= 120, 'curated tips for most commands, got ' + curated);
    const i = info('format.bold');
    A(i.title === 'Bold' && /bold/i.test(i.description) && i.markdown === '**bold**', 'bold tip: ' + JSON.stringify(i));
  });
  app.tests.register('tooltips: ribbon buttons show a rich card after a delay, instantly on the next one', async () => {
    app.backstage?.close?.();
    app.shell?.selectTab?.('home'); await sleep(120);
    const btns = [...document.querySelectorAll('#ribbon .panel.on [data-tip-cmd]')].filter(b => b.offsetParent && !b.disabled);
    A(btns.length >= 4, 'home tab has tip-enabled buttons: ' + btns.length);
    const over = el => el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    hide(); hiddenAt = 0;
    over(btns[0]); await sleep(200);
    A(!visible, 'not shown before the delay');
    await sleep(SHOW_DELAY);
    A(visible && tip.classList.contains('show') && tip.querySelector('.tt-h b')?.textContent, 'shown after the delay');
    A(tip.querySelector('.tt-arrow'), 'card has an arrow');
    const t0 = Date.now(); over(btns[1]); await sleep(90);
    A(visible && target === btns[1], 'second control shows at once (' + (Date.now() - t0) + ' ms)');
    const bold = document.querySelector('#ribbon [data-tip-cmd="format.bold"]');
    if (bold) { over(bold); await sleep(90); A(/Ctrl\+B|⌘B/.test(tip.textContent) && /\*\*bold\*\*/.test(tip.textContent), 'bold tip shows shortcut and Markdown: ' + tip.textContent); }
    over(btns[1]); await sleep(260);
    try { await app.mk.invoke('smoke-shot', 'tooltip'); } catch {}
    hide();
  });
  app.tests.register('tooltips: keyboard focus shows the tip', async () => {
    const b = document.querySelector('.titlebar [data-cmd="file.save"]');
    A(b, 'save button in the title bar');
    hide(); hiddenAt = 0;
    // focus-visible needs a keyboard focus; simulate the focus path directly
    schedule(b, 10); await sleep(80);
    A(visible && /Save/.test(tip.textContent), 'tip for Save: ' + tip.textContent);
    A(b.getAttribute('aria-describedby') === 'tooltip', 'described by the tip');
    hide();
    A(!b.hasAttribute('aria-describedby'), 'aria-describedby removed');
  });
})();

// Markooj — ScreenTips: rich hover help for every control (name, what it does, its shortcut and, for
// formatting, the Markdown it writes). Shows after 600 ms, instantly while moving across the ribbon,
// and on keyboard focus. Text comes from TIPS below, then from the command's own label/description.
// 1.2.0: TIPS holds English marked with tm(); info() translates the title and description each time it is asked.
/* i18n-aliases: tm */
(function () {
  'use strict';
  const app = window.app;
  if (!app) return;
  const esc = app.esc;
  const tm = s => s; // marks English for the translation check (docs/I18N.md); app.t translates it when shown
  const tl = s => (s && /[A-Za-z]/.test(String(s)) ? app.t(String(s)) : s || '');

  // command id → [title, description, markdown it writes (optional; never translated)]
  const TIPS = {
    // ---- File ----
    'file.new': [tm('New document'), tm('Start a blank document in a new tab.')],
    'file.newFromTemplate': [tm('New from template'), tm('Start from a research paper, thesis, report, letter or notes template.')],
    'file.open': [tm('Open@@verb'), tm('Open Markdown, Word, PDF, DjVu, EPUB, LaTeX, HTML or text files.')],
    'file.recent': [tm('Open recent'), tm('Pick one of the files you worked on lately.')],
    'file.save': [tm('Save'), tm('Save your work as a Markdown (.md) file. The first time, Markooj asks where to put it.')],
    'file.saveAs': [tm('Save As'), tm('Save a copy under another name, or export to PDF, Word, EPUB and more.')],
    'file.saveAsMarkdown': [tm('Save a copy as Markdown'), tm('Write the document to a new .md file and keep working on that copy.')],
    'file.saveAll': [tm('Save all'), tm('Save every open document that has changes.')],
    'file.export': [tm('Export'), tm('Share the document as PDF, Word, EPUB, a web page, LaTeX and more. Your Markdown file stays as it is.')],
    'file.exportPdf': [tm('Export as PDF'), tm('Make a print-ready PDF with sharp equations.')],
    'file.exportDocx': [tm('Export as Word document'), tm('Make a .docx file that opens in Microsoft Word.')],
    'file.exportHtml': [tm('Export as web page'), tm('Make one self-contained .html file.')],
    'file.print': [tm('Print'), tm('See the pages and print them.')],
    'file.printNow': [tm('Print without preview'), tm('Go straight to the system print window.')],
    'file.close': [tm('Close document'), tm('Close this tab. Unsaved changes are kept in File → Recover.')],
    'file.closeOthers': [tm('Close other documents'), tm('Close every tab except this one.')],
    'file.info': [tm('Document info'), tm('Title, authors, keywords and other properties of this document.')],
    'file.backstage': [tm('File'), tm('New, open, save, export, print and options.')],
    'file.options': [tm('Options'), tm('Theme, start mode, fonts, typing helpers and more.')],
    'file.reveal': [tm('Show in folder'), tm('Open the folder that holds this file.')],
    'file.revealInFolder': [tm('Show in folder'), tm('Open the folder that holds this file.')],
    'file.copyPath': [tm('Copy file path'), tm('Copy where this file is saved, for pasting elsewhere.')],
    'file.recover': [tm('Recover unsaved documents'), tm('Bring back documents you closed without saving.')],
    'file.openRecoveryFolder': [tm('Open recovery folder'), tm('Show where Markooj keeps recovery copies.')],
    // ---- Edit / Clipboard ----
    'edit.undo': [tm('Undo'), tm('Take back your last change.')],
    'edit.redo': [tm('Redo'), tm('Bring back the change you just undid.')],
    'edit.cut': [tm('Cut'), tm('Remove the selection and put it on the clipboard.')],
    'edit.copy': [tm('Copy'), tm('Put a copy of the selection on the clipboard.')],
    'edit.paste': [tm('Paste'), tm('Insert what is on the clipboard. Formatting from Word and web pages is kept.')],
    'edit.pastePlain': [tm('Paste as plain text'), tm('Insert the clipboard without any formatting.')],
    'edit.find': [tm('Find'), tm('Look for words in this document.')],
    'edit.findNext': [tm('Find next'), tm('Go to the next match.')],
    'edit.findPrev': [tm('Find previous'), tm('Go to the previous match.')],
    'edit.replace': [tm('Replace'), tm('Find words and replace them with others.')],
    'edit.changeCase': [tm('Change Case'), tm('Switch the selected text between UPPERCASE, lowercase and Capitalize Each Word. Press again to cycle. With nothing selected, changes the word at the cursor.')],
    'edit.changeCaseMenu': [tm('Change Case'), tm('Change the selected text to Sentence case., lowercase, UPPERCASE, Capitalize Each Word, tOGGLE cASE or Title Case.')],
    'edit.case.sentence': [tm('Sentence case'), tm('Capitalize only the first letter of each sentence in the selection.')],
    'edit.case.lower': [tm('lowercase'), tm('Make every letter in the selection small.')],
    'edit.case.upper': [tm('UPPERCASE'), tm('Make every letter in the selection a capital.')],
    'edit.case.title': [tm('Capitalize Each Word'), tm('Start every word in the selection with a capital letter.')],
    'edit.case.toggle': [tm('tOGGLE cASE'), tm('Swap small and capital letters in the selection.')],
    'edit.case.titleCase': [tm('Title Case'), tm('Capitalize the important words and keep short words like a, and, of and in lowercase, as APA and Chicago ask for titles and headings.')],
    // ---- sample add-ins ----
    'readability.report': [tm('Readability report'), tm('Reading ease, grade level and sentence lengths for this document.')],
    'readability.highlight': [tm('Highlight long sentences'), tm('Mark sentences that are hard to read because they run long. Click again to clear.')],
    'siunits.format': [tm('Format numbers with units'), tm('Turn quantities in the selection, like 5 m/s^2, into math with upright units and a thin space.'), '$5\\,\\mathrm{m/s^{2}}$'],
    'wordfreq.insert': [tm('Word frequency table'), tm('Insert a table of the words used most often in this document.')],
    // ---- Font ----
    'format.bold': [tm('Bold'), tm('Make the selected text bold.'), '**bold**'],
    'format.italic': [tm('Italic'), tm('Make the selected text italic.'), '*italic*'],
    'format.underline': [tm('Underline'), tm('Underline the selected text.'), '<u>underline</u>'],
    'format.strike': [tm('Strikethrough'), tm('Draw a line through the selected text.'), '~~text~~'],
    'format.sub': [tm('Subscript'), tm('Make small letters below the line, like H₂O.'), 'H~2~O'],
    'format.sup': [tm('Superscript'), tm('Make small letters above the line, like x².'), 'x^2^'],
    'format.code': [tm('Inline code'), tm('Show the selection in a fixed-width code font.'), '`code`'],
    'format.highlight': [tm('Highlight'), tm('Mark the selection with a highlighter color.'), '==highlighted=='],
    'format.color': [tm('Font color'), tm('Change the color of the selected text.'), '<span style="color:…">text</span>'],
    'format.clear': [tm('Clear formatting'), tm('Remove bold, italic, colors and other formatting from the selection.')],
    'format.painter': [tm('Format painter'), tm('Copy the formatting of the selection, then select other text to apply it.')],
    'format.fontFamily': [tm('Font'), tm('Changes the font of all body text — Markdown has one font per document, not per word. Headings follow the document theme.')],
    'format.fontSize': [tm('Font Size'), tm('Changes the size of all body text — Markdown has one text size per document. For bigger text use a Heading.')],
    'format.growFont': [tm('Grow Font'), tm('Make all body text one size bigger — Markdown has one text size per document. For bigger text use a Heading.')],
    'format.shrinkFont': [tm('Shrink Font'), tm('Make all body text one size smaller — Markdown has one text size per document.')],
    'format.clearParagraph': [tm('Clear paragraph formatting'), tm('Remove paragraph formatting such as center or right alignment. The words and the paragraph style stay.')],
    'layout.lineSpacing15': [tm('Line spacing 1.5'), tm('Set 1.5 line spacing for the whole document. Press again for the default spacing.')],
    'para.promote': [tm('Promote'), tm('Make a heading one level bigger (Heading 2 → Heading 1), or move a list item out one level.')],
    'para.demote': [tm('Demote'), tm('Make a heading one level smaller (Heading 1 → Heading 2), or move a list item in one level.')],
    'para.moveUp': [tm('Move paragraph up'), tm('Move the paragraph or list item with the cursor above the one before it.')],
    'para.moveDown': [tm('Move paragraph down'), tm('Move the paragraph or list item with the cursor below the one after it.')],
    'edit.repeat': [tm('Repeat'), tm('Do the last formatting or insert command again.')],
    'edit.goTo': [tm('Go To'), tm('Jump to a heading in the document, or to a page in a PDF or DjVu file.')],
    'format.style': [tm('Styles'), tm('Turn the paragraph into a heading, a quote or normal text.')],
    'format.normal': [tm('Normal text'), tm('Turn a heading or quote back into a normal paragraph.')],
    'format.h1': [tm('Heading 1'), tm('A main section heading. Shows in the outline and the table of contents.'), '# Heading'],
    'format.h2': [tm('Heading 2'), tm('A subsection heading.'), '## Heading'],
    'format.h3': [tm('Heading 3'), tm('A smaller heading inside a subsection.'), '### Heading'],
    'format.h4': [tm('Heading 4'), tm('A fourth-level heading.'), '#### Heading'],
    'format.h5': [tm('Heading 5'), tm('A fifth-level heading.'), '##### Heading'],
    'format.h6': [tm('Heading 6'), tm('The smallest heading.'), '###### Heading'],
    // ---- Paragraph ----
    'list.bullet': [tm('Bullets'), tm('Start a bulleted list, or turn the selected lines into one.'), '- item'],
    'list.number': [tm('Numbering'), tm('Start a numbered list.'), '1. item'],
    'list.task': [tm('Checklist'), tm('Start a list of tasks you can tick off.'), '- [ ] task'],
    'para.indent': [tm('Increase indent'), tm('Move a list item one level in. Tab does the same in a list.')],
    'para.outdent': [tm('Decrease indent'), tm('Move a list item one level out. Shift+Tab does the same in a list.')],
    'para.align': [tm('Align'), tm('Line up the paragraph left, center, right or both sides.')],
    'para.alignLeft': [tm('Align left'), tm('Line the paragraph up on the left (normal text).')],
    'para.alignCenter': [tm('Center'), tm('Center the paragraph.'), '<div align="center">…</div>'],
    'para.alignRight': [tm('Align right'), tm('Line the paragraph up on the right.'), '<div align="right">…</div>'],
    'para.alignJustify': [tm('Justify'), tm('Line the paragraph up on both sides.'), '<div align="justify">…</div>'],
    'para.quote': [tm('Quote'), tm('Set the paragraph apart as a quotation.'), '> quoted text'],
    'insert.codeBlock': [tm('Code block'), tm('A block of program code in a fixed-width font.'), '```\ncode\n```'],
    // ---- Insert ----
    'insert.table': [tm('Table'), tm('Insert a table. Pick the number of rows and columns.'), '| A | B |\n|---|---|'],
    'insert.image': [tm('Picture'), tm('Insert a picture from your computer. It is saved next to the document.'), '![Caption](picture.png)'],
    'insert.picture': [tm('Picture'), tm('Insert a picture from your computer.'), '![Caption](picture.png)'],
    'insert.diagram': [tm('Diagram'), tm('Draw a flowchart or other diagram from a short text description (Mermaid).'), '```mermaid'],
    'insert.equation': [tm('Equation'), tm('Insert an equation. Type it visually or in LaTeX; both stay in sync.'), '$$ E = mc^2 $$'],
    'insert.code': [tm('Code'), tm('Insert a block of program code with syntax colors.'), '```python'],
    'insert.callout': [tm('Callout'), tm('A colored box for a note, tip or warning.'), '> [!NOTE]'],
    'insert.link': [tm('Link'), tm('Link the selection to a web page or a place in the document.'), '[text](https://…)'],
    'insert.hr': [tm('Divider'), tm('A horizontal line between sections.'), '---'],
    'insert.pageBreak': [tm('Page break'), tm('Start a new page here when printing or exporting.'), '<div class="page-break"></div>'],
    'insert.footnote': [tm('Footnote'), tm('Add a numbered note at the bottom of the page.'), 'text[^1]'],
    'insert.citation': [tm('Citation'), tm('Cite a source from your reference library.'), '[@smith2020]'],
    'insert.symbol': [tm('Symbol'), tm('Insert Greek letters, arrows, math and other symbols.')],
    'insert.dateTime': [tm('Date and time'), tm('Insert today’s date or the current time.')],
    'insert.crossref': [tm('Cross-reference'), tm('Refer to a heading, figure, table or equation by its number. The number updates when things move.'), '[@fig:flume]'],
    'insert.caption': [tm('Insert caption'), tm('Give the selected figure, table or equation a numbered caption.'), '{#fig:name}'],
    // ---- Layout ----
    'layout.margins': [tm('Margins'), tm('Set the white space around the text on each page.')],
    'layout.size': [tm('Size'), tm('Choose the paper size, such as Letter or A4.')],
    'layout.columns': [tm('Columns'), tm('Split the text into one or two columns.')],
    'layout.lineSpacing': [tm('Line spacing'), tm('Space between lines in a paragraph.')],
    'layout.paraSpacing': [tm('Paragraph spacing'), tm('Space after each paragraph.')],
    'layout.theme': [tm('Document theme'), tm('Fonts and colors for the whole document and its exports.')],
    // ---- References ----
    'ref.toc': [tm('Table of contents'), tm('Insert a table of contents built from your headings.')],
    'ref.tocUpdate': [tm('Update table'), tm('Refresh the table of contents after headings change.')],
    'ref.footnote': [tm('Insert footnote'), tm('Add a numbered note at the bottom of the page.'), 'text[^1]'],
    'ref.prevFootnote': [tm('Previous footnote'), tm('Jump to the footnote before this point.')],
    'ref.nextFootnote': [tm('Next footnote'), tm('Jump to the next footnote.')],
    'ref.cite': [tm('Insert citation'), tm('Cite a source from your reference library (.bib).'), '[@smith2020]'],
    'ref.editCitation': [tm('Edit citation'), tm('Change the sources or page numbers of this citation.')],
    'ref.library': [tm('Citation library'), tm('Choose the .bib file with your sources.')],
    'ref.reloadLibrary': [tm('Reload library'), tm('Read the .bib file again after you changed it elsewhere.')],
    'ref.style': [tm('Citation style'), tm('APA, Chicago, IEEE and other styles for citations and the bibliography.')],
    'ref.bibliography': [tm('Bibliography'), tm('Insert the list of works you cited.')],
    'ref.crossref': [tm('Cross-reference'), tm('Refer to a heading, figure, table or equation by its number. The number updates when things move.'), '[@eq:shields]'],
    'ref.insertCaption': [tm('Insert caption'), tm('Give the selected figure, table or equation a numbered caption and label.'), '{#fig:name}'],
    'ref.numberEquations': [tm('Number equations'), tm('Number display equations (1), (2)… in the right margin.')],
    'ref.numberAll': [tm('Number all equations'), tm('Give every display equation a number, not only the labeled ones.')],
    'ref.numberingStyle': [tm('Numbering style'), tm('Plain 1, 2, 3 or by chapter 1.1, 1.2, and the words used: Eq., Fig., Table.')],
    'ref.updateFields': [tm('Update numbers'), tm('Renumber equations, figures, tables and references.')],
    // ---- Review ----
    'review.spelling': [tm('Spelling'), tm('Go through the words the dictionary does not know, one by one, with suggestions to change, ignore or add them.')],
    'review.spellingAsYouType': [tm('Check spelling as you type'), tm('Show or hide the red lines under unknown words while you type. Right-click a red word for suggestions.')],
    'review.wordCount': [tm('Word count'), tm('Words, characters, equations and citations in the document or the selection.')],
    'review.readability': [tm('Readability'), tm('How easy the text is to read, with sentence length and reading level.')],
    'review.comment': [tm('New comment'), tm('Add a comment at the cursor. Comments never show in exports unless you ask.'), '<!-- comment: … -->'],
    'review.deleteComment': [tm('Delete comment'), tm('Remove the selected comment.')],
    'review.deleteComments': [tm('Delete all comments'), tm('Remove every comment in the document.')],
    'review.prevComment': [tm('Previous comment'), tm('Jump to the comment before this point.')],
    'review.nextComment': [tm('Next comment'), tm('Jump to the next comment.')],
    'review.showComments': [tm('Show comments'), tm('Show or hide comment bubbles and hidden notes while editing.')],
    'review.compare': [tm('Compare'), tm('See what changed since the last save.')],
    'review.hiddenNote': [tm('Hidden note'), tm('A note to yourself that shows faintly while editing and never in Read mode or exports.'), '%%note%%'],
    // ---- View ----
    'view.printLayout': [tm('Print layout'), tm('See the document as pages of paper.')],
    'view.webLayout': [tm('Web layout'), tm('Let the text use the full width of the window.')],
    'view.focus': [tm('Focus'), tm('Hide everything but the page. Press Esc to come back.')],
    'view.outline': [tm('Outline'), tm('Show or hide the list of headings on the left.')],
    'view.toggleRibbon': [tm('Show or hide ribbon commands'), tm('Switch between Show tabs and commands and Show tabs only. A double-click on a tab does the same.')],
    'view.ribbonOptions': [tm('Ribbon display options'), tm('Show tabs and commands, Show tabs only, or Full-screen mode.')],
    'view.ribbonTabsAndCommands': [tm('Show tabs and commands'), tm('Keep the ribbon tabs and commands showing all the time.')],
    'view.ribbonTabsOnly': [tm('Show tabs only'), tm('Show only the tab names for more room. Click a tab to drop the ribbon down over the page.')],
    'view.ribbonFullScreen': [tm('Full-screen mode'), tm('Hide the title bar and ribbon. Move the pointer to the top edge, or press Alt, to show them.')],
    'view.ribbonDisplay': [tm('Ribbon display'), tm('Set how the ribbon shows: pinned, tabs only or full screen.')],
    'view.pinRibbon': [tm('Pin the ribbon'), tm('Keep the ribbon open all the time (Show tabs and commands).')],
    'view.formattingMarks': [tm('Show formatting marks'), tm('Show a ¶ mark at the end of every paragraph, like Word. The marks never print or export.')],
    'view.showRibbon': [tm('Show the full ribbon'), tm('In Simple mode, show all ribbon tabs instead of the slim toolbar.')],
    'view.focusRibbon': [tm('KeyTips'), tm('Show a letter on every ribbon tab and button: type it to use that control. Arrow keys move around the ribbon, Esc goes back. Pressing Alt alone does the same.')],
    'view.nextPane': [tm('Next pane'), tm('Move the keyboard to the next part of the window: ribbon, document tabs, outline, page and status bar.')],
    'view.prevPane': [tm('Previous pane'), tm('Move the keyboard to the previous part of the window.')],
    'view.tabPosition': [tm('Tab position'), tm('Put the document tabs at the top, at the bottom or on the left.')],
    'view.tabsTop': [tm('Tabs at the top'), tm('Show document tabs above the page.')],
    'view.tabsBottom': [tm('Tabs at the bottom'), tm('Show document tabs below the page.')],
    'view.tabsLeft': [tm('Tabs on the left'), tm('Show document tabs in a list on the left.')],
    'view.zoomIn': [tm('Zoom in'), tm('Make the page bigger on screen. Printing is not affected.')],
    'view.zoomOut': [tm('Zoom out'), tm('Make the page smaller on screen.')],
    'view.zoom100': [tm('100%'), tm('Show the page at its real size.')],
    'view.pageWidth': [tm('Page width'), tm('Zoom so the page fills the width of the window.')],
    'view.zoom': [tm('Zoom'), tm('Pick an exact zoom level.')],
    'view.mode': [tm('Editing mode'), tm('Word, Inline, Simple or Read. Your file stays Markdown in every mode.')],
    'view.toggleMode': [tm('Next editing mode'), tm('Move to the next mode: Word, Inline, Simple, Read.')],
    'view.modeWord': [tm('Word mode'), tm('Click and type on the page, like Microsoft Word. Markooj writes the Markdown for you.')],
    'view.modeInline': [tm('Inline mode'), tm('The page looks finished, and the paragraph you are in shows its Markdown so you can edit it in place.')],
    'view.modeSimple': [tm('Simple mode'), tm('Markdown text on the left and a live preview on the right.')],
    'view.modeRead': [tm('Read mode'), tm('The finished document for reading: no editing tools, comments or hidden notes. Press Esc to go back.')],
    'view.showMarkdown': [tm('What’s this in Markdown?'), tm('Show the Markdown behind the selection in a small card, so you learn it as you go.')],
    'view.theme': [tm('Theme'), tm('Switch between matching your system, light and dark.')],
    'view.setTheme': [tm('Theme'), tm('Match system, light or dark.')],
    'view.themeLight': [tm('Light theme'), tm('Dark text on a light background.')],
    'view.themeDark': [tm('Dark theme'), tm('Light text on a dark background, easier at night.')],
    'view.themeSystem': [tm('Match system'), tm('Follow your computer’s light or dark setting.')],
    'view.wordTarget': [tm('Word target'), tm('Set how many words you are aiming for. Progress shows under the outline.')],
    'view.togglePreview': [tm('Preview'), tm('Show or hide the live preview in Simple mode.')],
    // ---- Window / help ----
    'tab.next': [tm('Next document'), tm('Switch to the next tab.')],
    'tab.prev': [tm('Previous document'), tm('Switch to the previous tab.')],
    'app.commandPalette': [tm('Search and commands'), tm('Find any command, open document or heading by typing a few letters.')],
    'app.goToHeading': [tm('Go to heading'), tm('Jump to a heading by typing part of its name.')],
    'app.shortcuts': [tm('Keyboard shortcuts'), tm('See every keyboard shortcut in one list.')],
    // ---- Viewer ----
    'viewer.editAsText': [tm('Edit as text'), tm('Make an editable Markdown copy of this PDF or DjVu file.')],
    'viewer.goToPage': [tm('Go to page'), tm('Jump to a page number.')],
    'viewer.nextPage': [tm('Next page'), tm('Show the next page.')],
    'viewer.prevPage': [tm('Previous page'), tm('Show the previous page.')],
    'viewer.thumbnails': [tm('Page thumbnails'), tm('Show small pictures of every page on the side.')],
    // ---- Developer / add-ins ----
    'dev.macros': [tm('Macros'), tm('See, run and edit your saved macros.')],
    'dev.newMacro': [tm('New macro'), tm('Write a new macro in Python or JavaScript.')],
    'dev.runMacro': [tm('Run macro'), tm('Pick a saved macro and run it.')],
    'dev.stopMacro': [tm('Stop macro'), tm('Stop the macro that is running.')],
    'dev.record': [tm('Record macro'), tm('Record what you do so you can play it back later.')],
    'dev.stopRecording': [tm('Stop recording'), tm('Finish recording and save the macro.')],
    'dev.editor': [tm('Macro editor'), tm('Write and test macros with code colors and a console.')],
    'dev.pythonConsole': [tm('Python console'), tm('Run Python right inside Markooj, no install needed.')],
    'dev.runSelection': [tm('Run selection'), tm('Run the selected code as Python and show the result.')],
    'dev.mathMacros': [tm('Math macros'), tm('Define your own LaTeX commands, like \\R for ℝ.')],
    'dev.addins': [tm('Manage add-ins'), tm('Turn add-ins on or off and see what they add.')],
    'dev.installAddin': [tm('Install add-in'), tm('Add an add-in from a .js file.')],
    'dev.openAddinsFolder': [tm('Add-ins folder'), tm('Open the folder where your add-ins live.')],
    'addins.reload': [tm('Reload add-ins'), tm('Load your add-ins again (restarts the window).')],
  };

  // ---------- lookup ----------
  const sh = () => app.shell || {};
  function keysOf(cmd) {
    if (!cmd) return [];
    const f = sh().displayShortcuts;
    if (f) return f(cmd);
    return [].concat(cmd.shortcut || [], cmd.shortcuts || [], cmd.altShortcuts || []);
  }
  /** Everything the ScreenTip shows for a command id, in the interface language. */
  function info(id) {
    const cmd = id ? app.commands.get(id) : null;
    const t = TIPS[id] || (id && /^format\.h([1-6])$/.test(id) ? TIPS['format.h' + id.slice(-1)] : null);
    const label = cmd && cmd.label && cmd.label !== id ? tl(cmd.label) : '';
    const title = (t && t[0] && tl(t[0])) || label || (id ? id.split('.').pop().replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()) : '');
    let desc = tl((t && t[1]) || cmd?.description || '');
    if (!desc && cmd?.tooltip && tl(cmd.tooltip) !== title) desc = tl(cmd.tooltip);
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
      + (!c.enabled ? `<div class="tt-off">${esc(c.why || app.t('Click in the document first, or select what this command works on.'))}</div>` : '')
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

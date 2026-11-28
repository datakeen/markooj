# Chinese (Simplified) (简体中文) glossary for Markooj

Code `zh-CN` · left to right · the translation rules are in [docs/I18N.md](../../docs/I18N.md).

Keep to this page in every catalog file. To change a term, change it here first, then everywhere it appears.
The base is Microsoft Office (Word) Simplified Chinese: our users know Word, so a Word command keeps Word’s Chinese name.
Only where Markooj has no Word equivalent do we choose our own word (marked “Markooj” in the notes).

## 1. Voice and register

- **Mainland China usage**, written as a careful native speaker would write Word’s menus. Translate the meaning, never word for word.
- **Address the user as 你**, never 您 (Microsoft’s current Chinese style). Better still, leave the pronoun out: Chinese rarely needs it.
  Write “保存更改？”, not “你要保存你的更改吗？”.
- **Buttons and menu items** are short verb phrases or nouns with no final punctuation: 保存、另存为…、插入表格、全部替换.
- **Messages are solution-first**, like the English: what to do first, then what still works. Use “，然后…” to join steps.
- **No 请 at the start of buttons, labels or short hints.** In a longer message one 请 is allowed when the sentence would sound curt
  without it, but never twice in one message. No exclamation marks, no 哦/啦/呢, no internet slang.
- **Avoid translationese**: no 进行 + verb (“进行保存” → “保存”), no 被 passives where an active verb works, no chains of 的,
  no “您的/你的” in front of every noun, no 一个 where Chinese drops it, no “成功地”. Prefer 无法 over 不能 for things that failed.
- **States** use 已/未/正在: 已保存、尚未保存、已安装、未安装、正在下载….
- **Markooj** as the subject of a sentence is fine: “Markooj 会保留未保存的文本。”

Three examples:

| English | Chinese (Simplified) | Why |
| --- | --- | --- |
| Free up some disk space, then try again. | 释放一些磁盘空间，然后重试。 | Solution first; 重试 is Microsoft’s word; no 请. |
| Open or create a document first, then try {command} again. | 先打开或新建一个文档，然后再试一次“{command}”。 | Command name in Chinese quotes; natural order. |
| Save changes to “{name}”? | 是否保存对“{name}”的更改？ | Word’s own wording for this dialog. |

## 2. Punctuation, spacing and numbers

- **Full-width punctuation in Chinese text**: ，。、：；？！“”‘’（）. Half-width only inside code, Markdown syntax, shortcuts, file names, web
  addresses and numbers (3.14, 1,234).
- **Spaces: one half-width space between Chinese and Latin letters or Arabic numerals**, on both sides:
  “导出为 PDF”“共 12 页”“Word 模式”“按 Alt+Q”. **No space** next to full-width punctuation (“PDF。”“（Word）”), and none before `%`
  or `°` (“50%”“30°”). Never a space between two Chinese characters.
- **Units**: a space between the number and a Latin unit (“12 pt”“41 MB”“2.5 cm”); Chinese units follow the number with a space too,
  because the number is Latin (“25 分钟”“3 天”“约 5 分钟”). Write 分钟, 小时, 天, 英寸, 厘米 in full; keep pt, KB, MB, GB, px.
  “in” (inches) becomes 英寸: “8.5 × 11 英寸”.
- **Numbers**: Arabic digits always (“3 个文件”, not “三个文件”), except fixed words such as 一栏/两栏, 一天前. `{count}` is formatted by the
  app with digit grouping (12,345). Ranges in a sentence: “50 到 300”; in a compact label: “50–300”.
- **Plurals**: Chinese uses only `other`. Write one form with the right measure word: “{count} 个文件”“{count} 页”“{count} 字”
  “{count} 天”“{count} 个问题”“{count} 条批注”“{count} 处匹配”. Common measure words: 个 (general), 页, 字, 行, 列, 段, 条 (comments,
  suggestions, rules, messages), 处 (matches, places), 项 (items, features, settings), 份 (copies), 次 (times), 天, 分钟.
- **Percent**: “100%”, “{percent}%”, no space.
- **Quotation marks**: “…” for names of files, documents, commands, buttons and quoted text; ‘…’ inside them. Not 「」, not 《》
  (book-title marks only for real book or journal titles inside example text).
- **Final punctuation follows the English**: an English sentence that ends with “.” ends with “。”; a label without a period stays
  without. A question ends with “？”. Labels that end with “:” end with “：” (“致谢：”).
- **Separators kept as in English**: “ · ” (middle dot with spaces), “ → ” in menu paths with spaces: “文件 → 选项”.
- **Dates and times** come from `Intl` (zh-CN): “2026年11月27日”“下午3:15”. In text: “今天 {time}”“昨天 {time}”“{date} {time}”.

## 3. Placeholders, keys and shortcuts in sentences

- Keep every `{placeholder}` exactly; move it wherever Chinese word order needs it.
- **Number placeholders** (`{count}`, `{n}`, `{size}`, `{percent}`, `{current}`, `{total}`) get a space on each side when next to
  Chinese: “第 {current} 页，共 {total} 页”. No space next to full-width punctuation or `%`.
- **Name placeholders** (`{name}`, `{title}`, `{file}`, `{command}`, `{feature}`, `{tool}`, `{query}`, `{style}`) that hold a file,
  document, command or button name go in Chinese quotes with no spaces: `已保存“{name}”`, `找不到与“{query}”匹配的结果。`.
  When the English already has quotes, replace them with “”. Placeholders that hold a Latin name without quotes (a program, a
  format, a version) take spaces like any Latin word: `安装 {feature}`, `{tool} 已就绪。`
- **Placeholders that hold a whole phrase or sentence** (`{title}. {works}`, `{text}`, `{goal}`, `{reason}`) are joined with full-width
  punctuation and no spaces: `{title}。{works}`. `{goal}` is a Chinese verb phrase (“另存为 DjVu”), so build the sentence around it:
  `要{goal}，Markooj 需要免费的 {tool} 程序。`
- **Keyboard keys and shortcuts stay in Latin letters exactly as in English**: Ctrl, Shift, Alt, Enter, Esc, Tab, F1, F7, Page Down,
  Ctrl+Shift+S. Never 回车键/退出键. In a sentence: “按 Esc 退出”“按 Ctrl+S 保存”. Add 键 only when the key is the subject alone and the
  sentence reads badly without it (“按 Alt 键，然后按字母”); prefer no 键.
- **A shortcut after a label** stays in half-width parentheses with a space before, as in Office ScreenTips: “加粗 (Ctrl+B)”
  “关闭 (Esc)”“下一处 (Enter)”. Parentheses that hold Chinese text are full-width: “图（暂无编号）”.
- **HTML tags** (`<kbd>`, `<b>`, `<code>`) stay exactly; translate only the words between them, never the key names in `<kbd>`.

## 4. “…” (ellipsis)

- A menu item or button that opens a dialog keeps the single character “…” (U+2026) right after the Chinese, no space:
  “另存为…”“插入表格…”“页面设置…”“选项…”. Never “...” (three dots) and never “……”.
- A label without “…” in English gets none in Chinese.
- Progress states use the same single “…”: “正在加载…”“正在安装…”“正在检查…”.
- In running text where the English uses “…” for an omission, keep the single “…”.

## 5. Brand and format names (never translated)

Markooj, Word, Microsoft Word, Excel, PowerPoint, Pandoc, KaTeX, Mermaid, Markdown, LaTeX, BibTeX, GitHub, Zotero, Mendeley, Python,
JavaScript, Electron, Harper, DjVu, DjVuLibre, pdf2djvu, Homebrew, PDF, DOCX, EPUB, HTML, CSV, RTF, CommonMark, GFM, Org mode, Jupyter,
LibreOffice, Windows, macOS, Linux. Write them with a space on each side when next to Chinese: “用 Pandoc 导出”.

## 6. Terms

### Ribbon tabs and File pages

| English | Chinese (Simplified) | Notes |
| --- | --- | --- |
| Markooj | Markooj | Never translated. |
| ribbon | 功能区 | Word’s name. “Ribbon” (small button) = 功能区. |
| tab (ribbon tab) | 选项卡 | “Click the {name} tab.” → “单击“{name}”选项卡。” |
| tab (document tab) | 标签页 | One open document. “Close tab” = 关闭标签页. Never 选项卡 here. |
| group (ribbon group) | 组 | “the Font group” = “字体”组. |
| contextual tab | 上下文选项卡 | Table Design / Table Layout. |
| File | 文件 | Ribbon tab and File page. |
| Home | 开始 | Ribbon tab, as in Word. |
| Insert (tab) | 插入 | Same word as the verb Insert. |
| Layout | 布局 | Ribbon tab (Word 2016+ name, formerly 页面布局). |
| References | 引用 | Ribbon tab. |
| Review | 审阅 | Ribbon tab. |
| View | 视图 | Ribbon tab. |
| Developer | 开发工具 | Ribbon tab, as in Word. |
| Add-ins | 加载项 | Ribbon tab and the add-ins themselves. |
| Help | 帮助 | Ribbon tab, group and window. |
| Table Design | 表设计 | Contextual tab, as in Word 365. |
| Table Layout | 表布局 | Word shows 布局; we add 表 so it differs from the Layout tab. |
| Table Tools | 表格工具 | Title over the contextual tabs. |
| Info | 信息 | File page. |
| New (File page) | 新建 | File page; also “New document” = 新建文档. |
| Open (File page) | 打开 | File page and verb. |
| Save | 保存 | |
| Save As | 另存为 | “Save As…” = 另存为…. |
| Save As / Export | 另存为/导出 | File page; no spaces around the slash. |
| Save all | 全部保存 | |
| Save as Copy… | 另存副本… | |
| Print | 打印 | Print preview = 打印预览. |
| Export | 导出 | “Export as PDF…” = 导出为 PDF…. |
| Options | 选项 | File → Options. |
| Recover | 文档恢复 | File page (Word’s Document Recovery). Not 恢复 alone: that is Redo. |
| Recent | 最近使用 | Section in File → Open. “Recent files” = 最近使用的文件. |
| Close | 关闭 | |

### Ribbon groups

| English | Chinese (Simplified) | Notes |
| --- | --- | --- |
| Clipboard | 剪贴板 | Home. |
| Font | 字体 | Home; also the Font dialog = 字体对话框. |
| Paragraph | 段落 | Home. |
| Styles | 样式 | Home. Style = 样式. |
| Editing | 编辑 | Home. |
| Direction | 文字方向 | Home: left-to-right / right-to-left. |
| Aarab | 元音符号 | Home group for Urdu/Arabic vowel marks (harakat). See Language terms. |
| Illustrations | 插图 | Insert. |
| Pictures | 图片 | Insert; also the plural noun. |
| Links & pages | 链接和页面 | Insert. Use 和, not &. |
| Text | 文本 | Insert group. As a file type (Text@@file type) = 文本文件. |
| Blocks | 内容块 | Insert: callouts, code blocks, dividers (Markooj). |
| Notes & sources | 注释和来源 | Insert (Markooj). |
| Captions | 题注 | Insert. |
| Page setup | 页面设置 | Layout. |
| Spacing | 间距 | Layout. |
| Document theme | 文档主题 | Layout. |
| Table of contents | 目录 | References. |
| Footnotes | 脚注 | References. |
| Citations & bibliography | 引文与书目 | References, as in Word. |
| Captions & numbering | 题注和编号 | References. |
| Proofing | 校对 | Review. |
| Writing | 写作 | Review and View group; Options section. Writing@@heading also 写作. |
| Comments | 批注 | Review. |
| Versions | 版本 | Review. |
| Views | 视图 | View, as in Word. |
| Show | 显示 | View, as in Word. |
| Zoom | 缩放 | View group and button; zoom level = 缩放级别. |
| Mode | 模式 | View: the editing modes. |
| Theme | 主题 | View (light/dark) and Layout → Theme. |
| Commands | 命令 | View. |
| Keyboard | 键盘 | View: the typing keyboard. |
| Tables | 表格 | View group and Options section. |
| Window | 窗口 | View, as in Word. |
| Code | 代码 | Developer. |
| Math | 数学 | Developer and add-in category. |
| My macros | 我的宏 | Developer. |
| Store | 商店 | Add-ins tab: the Add-in Store. |
| Table Styles | 表格样式 | Table Design. |
| Table Style Options | 表格样式选项 | Table Design. |
| Rows & Columns | 行和列 | Table Layout. |
| Cell Size | 单元格大小 | Table Layout. |
| Alignment | 对齐方式 | Table Layout. |
| Data | 数据 | Table Layout. |
| Convert | 转换 | Table Design / Layout group and verb. |
| Features | 可选功能 | Help group, its button and the File → Options page (the optional downloadable parts). Paths read “文件 → 选项 → 可选功能”. Features@@markdown (Markdown syntax features) = Markdown 特性. |
| Feedback | 反馈 | Help. |
| About | 关于 | Help. “About Markooj” = 关于 Markooj. |
| Welcome | 欢迎 | Help button and status-bar chip. |

### Common commands and buttons

| English | Chinese (Simplified) | Notes |
| --- | --- | --- |
| Undo | 撤消 | Microsoft spells 撤消, not 撤销. |
| Redo | 恢复 | Office’s word for Redo. |
| Repeat | 重复 | Word’s F4. |
| Cut | 剪切 | |
| Copy | 复制 | |
| Paste | 粘贴 | |
| Paste as plain text | 粘贴为纯文本 | |
| Select all | 全选 | |
| Find | 查找 | |
| Replace | 替换 | |
| Find and replace | 查找和替换 | |
| Replace all | 全部替换 | |
| Find next / Find previous | 查找下一处 / 查找上一处 | |
| Match case | 区分大小写 | As in Word. |
| Whole words | 全字匹配 | As in Word. |
| Go To | 定位 | Word’s Ctrl+G. “Go to page…” = 转到页…; “Go there” = 转到此处. |
| Insert (verb) | 插入 | |
| Delete | 删除 | Removes content or a file. |
| Remove | 删除 / 移除 | 删除 when the thing disappears (link, aarab, a language pack); 移除 when it only leaves a list (Remove from list = 从列表中移除, Remove from favorites = 从收藏中移除). |
| Clear | 清除 | “Clear formatting” = 清除所有格式 (Word). |
| Options | 选项 | File → Options. |
| Settings | 设置 | Individual settings inside Options. |
| Cancel | 取消 | |
| OK | 确定 | |
| Apply | 应用 | |
| Reset | 重置 | |
| Install | 安装 | “Install selected” = 安装所选项. |
| Uninstall | 卸载 | |
| Download | 下载 | |
| Update | 更新 | Verb on a button; “Update all” = 全部更新. |
| Check for updates | 检查更新 | |
| Try again | 重试 | In a sentence: “然后重试”. |
| Details | 详细信息 | “Copy details” = 复制详细信息. |
| Technical details | 技术详细信息 | |
| Learn more | 了解详细信息 | Microsoft’s standard link text. |
| Don’t show again | 不再显示 | |
| Don’t Save | 不保存 | Save-changes dialog, as in Word. |
| Close anyway | 仍然关闭 | |
| Not now | 暂不 | |
| Later | 稍后 | |
| Skip | 跳过 | |
| Continue | 继续 | |
| Back / Next | 上一步 / 下一步 | Tutorial steps. Help window Back/Forward = 后退 / 前进. |
| Done | 完成 | |
| Browse… | 浏览… | |
| Open… | 打开… | |
| Rename… | 重命名… | |
| Reload | 重新加载 | |
| Discard | 放弃 | “Discard changes” = 放弃更改. |
| Overwrite | 覆盖 | |
| Show / Hide | 显示 / 隐藏 | |
| Turn on / Turn off | 打开 / 关闭 | For switches and settings; On / Off on a switch = 开 / 关. For add-ins: 启用 / 禁用 (Office’s words), also “Turn add-ins on or off” = 启用或禁用加载项. |
| Show in folder / Reveal in folder | 在文件夹中显示 | |
| Copy path | 复制路径 | |
| Search (verb) | 搜索 | |
| Run | 运行 | Macros, code. |
| Stop | 停止 | |
| Accept | 接受 | Writing suggestion. |
| Ignore / Ignore All | 忽略 / 全部忽略 | As in Word (F7). Ignore Rule = 忽略规则. |
| Dismiss | 忽略 | Writing Assistant card: hide this suggestion. |
| Add to Dictionary | 添加到词典 | As in Word. |
| Change | 更改 | Spelling dialog and goal button. |
| Report a problem | 报告问题 | |
| Copied | 已复制 | Toast. |
| Saved / Edited / Not saved yet | 已保存 / 已修改 / 尚未保存 | Title-bar states. |
| Read only | 只读 | |
| Ready | 就绪 | As in Word’s status bar. |
| Loading… / Installing… / Downloading… | 正在加载… / 正在安装… / 正在下载… | |

### Editing modes and views

| English | Chinese (Simplified) | Notes |
| --- | --- | --- |
| editing mode | 编辑模式 | |
| Word (mode) / Word mode | Word / Word 模式 | Keep “Word”: it names Microsoft Word. “Try Word mode” = 试试 Word 模式. |
| Inline (mode) / Inline mode | 行内 / 行内模式 | The paragraph you are in shows its Markdown (Markooj). Same 行内 as inline math. |
| Simple (mode) / Simple mode | 简易 / 简易模式 | Markdown on the left, preview on the right. |
| Read (mode) / Read mode | 阅读 / 阅读模式 | As Word’s 阅读模式. |
| Print layout | 页面视图 | Word’s Print Layout. Short switch label (Print@@page layout) = 页面. |
| Web layout | Web 版式视图 | Word’s name. Short switch label (Web@@page layout) = Web 版式. |
| Focus | 专注 | Word’s Focus mode = 专注模式. “Leave focus” = 退出专注. |
| Full-screen mode | 全屏模式 | |
| Preview (Simple mode) | 预览 | Live preview = 实时预览. |
| Viewer | 查看器 | PDF/DjVu page viewer. |
| Show tabs only / Show tabs and commands | 仅显示选项卡 / 显示选项卡和命令 | Word’s ribbon display options. |
| Ribbon display options | 功能区显示选项 | |
| Pin the ribbon | 固定功能区 | |
| Quick access | 快速访问 | Word’s Quick Access Toolbar = 快速访问工具栏. |
| Zoom in / Zoom out | 放大 / 缩小 | |
| Page width | 页宽 | As in Word. “Fit page width” = 适应页宽. |
| Formatting marks | 格式标记 | “Show formatting marks” = 显示格式标记. |
| theme: Light / Dark / Match system | 浅色 / 深色 / 跟随系统 | System@@theme = 跟随系统. |

### Document terms

| English | Chinese (Simplified) | Notes |
| --- | --- | --- |
| document | 文档 | |
| new document / blank document | 新建文档 / 空白文档 | |
| Untitled | 无标题 | “Untitled {n}” = 无标题 {n}. |
| template | 模板 | |
| page | 页 / 页面 | 页 with numbers (“第 3 页”); 页面 as a thing (“页面设置”). |
| page break | 分页符 | |
| paragraph | 段落 | |
| heading | 标题 | “Heading 1” = 标题 1 (Word’s style name). |
| title (document title, Title style) | 标题 | Word uses 标题 for both; Subtitle = 副标题. |
| Normal (style) | 正文 | Word’s Normal style. Normal@@margins = 常规. |
| Quote (style) | 引用 | Word’s Quote style. |
| style | 样式 | |
| list | 列表 | |
| bullets / bulleted list | 项目符号 / 项目符号列表 | |
| numbering / numbered list | 编号 / 编号列表 | |
| task list / checklist | 任务列表 | |
| table | 表格 | Caption label word = 表 (“表 1”). |
| cell | 单元格 | |
| row | 行 | “Insert Above” = 在上方插入. |
| column (table) | 列 | “Insert Left” = 在左侧插入. |
| columns (page layout) | 栏 | Layout → Columns, as in Word: 一栏 / 两栏. |
| header row | 标题行 | As in Word. |
| gridlines | 网格线 | “View Gridlines” = 查看网格线. |
| merged cells | 合并的单元格 | |
| sort / ascending / descending | 排序 / 升序 / 降序 | |
| caption | 题注 | As in Word. “Insert Caption” = 插入题注. |
| figure | 图 | Caption label word = 图 (“图 2”); in lists “图片” only for the picture itself. |
| picture | 图片 | |
| diagram | 图示 | Mermaid diagram = Mermaid 图示. Keep 图表 for charts (pie = 饼图). |
| equation | 公式 | As in Word 365. Caption/label word = 式 (“式 (1)”). |
| inline equation / display equation | 行内公式 / 行间公式 | Inline math = 行内公式; display math = 行间公式. |
| equation palette | 公式面板 | |
| citation | 引文 | As in Word. Insert citation = 插入引文; Cite (short button) = 引文. |
| source (cited work) | 来源 | “{count} sources” = {count} 个来源. |
| citation library | 引文库 | BibTeX library = BibTeX 库. |
| citation key | 引文键 | Such as smith2020. Never 引用键. |
| citation style | 引文样式 | APA, IEEE, Chicago stay as is. |
| reference (cited work in the list) | 参考文献 | In body text about cited works. |
| bibliography | 书目 | Word’s term (Insert bibliography = 插入书目). |
| footnote | 脚注 | |
| comment | 批注 | As in Word. New comment = 新建批注. |
| hidden note | 隐藏注释 | A %%note%% that never prints (Markooj). |
| cross-reference | 交叉引用 | As in Word. |
| reference type / insert reference to | 引用类型 / 引用内容 | Word’s cross-reference dialog. |
| Full label / Number only / Caption text / Above/below | 只有标签和编号 / 只有编号 / 只有题注文字 / 见上方/见下方 | Word’s cross-reference choices (one pattern: 只有…). |
| label names Eq., Fig., Table | Eq.、Fig.、Table | The numbering options offer these English words as they are, so descriptions name them unchanged. The Chinese caption words (式、图、表) are only for our own UI labels such as “表 {number}”. |
| Insert as hyperlink | 插入为超链接 | As in Word. |
| label (equation/figure label code) | 标签 | Such as eq:flume (keep the code itself). |
| link | 链接 | “Edit link” = 编辑链接; “Remove link” = 删除链接. |
| callout (box) | 提示框 | GitHub-style [!NOTE] boxes. Kinds: Note 备注, Tip 提示, Important 重要, Warning 警告, Caution 注意. |
| code block / inline code | 代码块 / 行内代码 | |
| divider | 分隔线 | |
| front matter | 前置元数据 | The settings block at the top (Markooj). |
| Markdown flavor | Markdown 变体 | Detected flavor = 检测到的变体. |
| outline | 大纲 | The list of headings at the side. |
| table of contents | 目录 | |
| document properties | 文档属性 | Author 作者, Keywords 关键词, Subject 主题, Created 创建时间, Modified 修改时间. |
| word count | 字数统计 | “{count} words” = {count} 字. |
| margins | 页边距 | Narrow 窄, Wide 宽. |
| page size | 纸张大小 | As in Word. Letter stays “Letter”. |
| line spacing / paragraph spacing | 行距 / 段落间距 | “Space after paragraphs” = 段后间距. |
| indent | 缩进 | Increase indent = 增加缩进量; Decrease indent = 减少缩进量. |
| alignment | 对齐 | Align left 左对齐, Center 居中, Align right 右对齐, Justify 两端对齐. |
| Bold / Italic / Underline / Strikethrough | 加粗 / 倾斜 / 下划线 / 删除线 | Word’s names. |
| Subscript / Superscript | 下标 / 上标 | |
| Highlight / Text color / Font color | 突出显示 / 文字颜色 / 字体颜色 | Word: 文本突出显示颜色; ours is short. |
| Format painter | 格式刷 | |
| Change Case | 更改大小写 | Grow Font 增大字号, Shrink Font 减小字号, Font Size 字号. |
| Promote / Demote | 升级 / 降级 | Heading levels, as in Word’s outline. |
| Track changes | 修订 | Word’s name. |
| symbol | 符号 | |
| date & time | 日期和时间 | |

### Interface and windows

| English | Chinese (Simplified) | Notes |
| --- | --- | --- |
| window | 窗口 | New Window = 新建窗口; Switch Windows = 切换窗口; Arrange All = 全部重排. |
| pane | 窗格 | “Second pane” = 第二个窗格. |
| split | 拆分 | Word’s View → Split. Remove Split = 取消拆分. |
| side by side | 并排查看 | Word’s View Side by Side. Synchronous Scrolling = 同步滚动. |
| Reset Window Position | 重设窗口位置 | As in Word. |
| ruler | 标尺 | |
| guide | 参考线 | As in PowerPoint. Horizontal/Vertical guide = 水平/垂直参考线. |
| status bar | 状态栏 | |
| command search (palette) | 命令搜索 | Alt+Q. “Search or type a command” = 搜索或输入命令. |
| ScreenTip | 屏幕提示 | Word’s name. |
| KeyTips | 按键提示 | Word’s name. |
| dialog | 对话框 | |
| menu | 菜单 | |
| toast / message | 消息 | |
| Welcome screen | 欢迎屏幕 | |
| tutorial / guided tour | 教程 / 引导式导览 | Getting started = 入门. |
| What’s new | 新增功能 | Microsoft’s term. |
| tooltip | 提示 | Use 屏幕提示 for ScreenTip only. |

### Language and writing

| English | Chinese (Simplified) | Notes |
| --- | --- | --- |
| interface language | 界面语言 | Language of menus and buttons. |
| document language | 文档语言 | |
| proofing language | 校对语言 | As in Word. |
| keyboard (typing layout) | 键盘 | The layout: 键盘布局. Not a shortcut. |
| keyboard layout | 键盘布局 | Urdu Phonetic, Arabic 101 … (names stay). |
| on-screen keyboard | 屏幕键盘 | Windows term. Short button (On-screen) = 屏幕键盘. |
| keyboard shortcut | 快捷键 | Keyboard shortcuts (Options page) = 快捷键. |
| left to right / right to left | 从左到右 / 从右到左 | Text direction = 文字方向. |
| aarab / harakat | 元音符号 | Urdu/Arabic vowel marks. “Remove Aarab” = 删除元音符号, “Hide Aarab” = 隐藏元音符号. The mark names (zabar (fatha), zer, pesh …) stay in Latin letters as in English. |
| half space (ZWNJ) / joiner (ZWJ) | 半空格（ZWNJ）/ 连接符（ZWJ） | Keep ZWNJ/ZWJ. |
| Writing Assistant | 写作助手 | The side pane (Markooj; like Word’s Editor = 编辑器). |
| spelling | 拼写 | |
| grammar | 语法 | |
| Spelling and Grammar | 拼写和语法 | Word’s F7 dialog. |
| suggestion | 建议 | “No suggestions” = 无建议. |
| writing score | 写作评分 | |
| correctness / clarity / engagement / delivery | 正确性 / 清晰度 / 吸引力 / 表达 | Writing Assistant categories. |
| readability | 可读性 | Flesch reading ease = Flesch 易读度. |
| thesaurus | 同义词库 | As in Word. Synonyms = 同义词; Antonyms = 反义词. |
| dictionary | 词典 | My dictionary = 我的词典. |
| rule (grammar rule) | 规则 | |
| language pack | 语言包 | |
| slash commands | 斜杠命令 | /today etc. stay as is. |
| multiple cursors | 多光标 | |
| Hijri / Gregorian | 伊斯兰历 / 公历 | |
| Urdu / Arabic / Persian / Punjabi (Shahmukhi) | 乌尔都语 / 阿拉伯语 / 波斯语 / 旁遮普语（沙木基文） | Roman Urdu = 罗马化乌尔都语. |

### Add-ins, macros and features

| English | Chinese (Simplified) | Notes |
| --- | --- | --- |
| add-in | 加载项 | As in Office. |
| Add-in Store | 加载项商店 | |
| Manage add-ins | 管理加载项 | |
| community add-ins | 社区加载项 | |
| macro | 宏 | |
| Record macro / Stop recording | 录制宏 / 停止录制 | As in Word. |
| Run macro | 运行宏 | |
| Macro Editor | 宏编辑器 | |
| math macros | 数学宏 | LaTeX shorthand definitions. |
| Python console | Python 控制台 | |
| feature (optional part) | 可选功能 | Pandoc, DjVu tools, Python macros: downloaded when wanted. “Install {feature}” = 安装 {feature}. The page and button “Features” = 可选功能 too. |
| feature download | 功能下载 | |
| helper tool / program | 辅助工具 / 程序 | “Needs a helper tool” = 需要辅助工具. |
| DjVu tools | DjVu 工具 | |
| extension | 扩展 | Only for real extensions; add-ins are 加载项. |

### Files

| English | Chinese (Simplified) | Notes |
| --- | --- | --- |
| file | 文件 | |
| computer | 电脑 | Windows 10/11 usage (“此电脑”). Never 计算机 in the interface. |
| Edit as text | 以文本形式编辑 | Makes an editable Markdown copy of a PDF or DjVu file. Never 转为文本编辑 or 作为文本编辑. |
| folder | 文件夹 | Open folder = 打开文件夹. |
| path | 路径 | |
| export | 导出 | |
| import | 导入 | |
| PDF | PDF | “Save as PDF…” = 另存为 PDF…; “Export as PDF…” = 导出为 PDF…. |
| web page | 网页 | |
| plain text | 纯文本 | |
| recovery / recovered text | 恢复 / 恢复的文本 | Recovery (Options section) = 文档恢复. “Recover unsaved…” = 恢复未保存的文档…. |
| backup | 备份 | |
| autosave | 自动保存 | |
| unsaved changes | 未保存的更改 | |
| version | 版本 | |
| license | 许可证 | Third-party notices = 第三方声明; Credits = 致谢. |
| privacy | 隐私 | |
| download page | 下载页面 | |
| encoding | 文本编码 | As in Word. |
| size (file) | 大小 | File → Info row. |

### Writing goals

| English | Chinese (Simplified) | Notes |
| --- | --- | --- |
| writing goal / daily goal | 写作目标 / 每日目标 | |
| word target | 字数目标 | |
| writing sprint / Sprint | 写作冲刺 / 冲刺 | Timed session. |
| streak | 连续天数 | “{count}-day streak” = 连续 {count} 天. |
| Typewriter scrolling | 打字机滚动 | Short button (Typewriter) = 打字机. |

### Terms added during translation and review (2026-11-28)

| English | Chinese (Simplified) | Notes |
| --- | --- | --- |
| Change Case items | 句首字母大写。/ 全部小写 / 全部大写 / 每个单词首字母大写 / 切换大小写 | Word’s menu (Sentence case. keeps 。 as Word does). Title Case = 标题式大小写 (Markooj). |
| Small caps / All caps | 小型大写字母 / 全部大写 | Word’s Font dialog. |
| Single / Double / 1.5 line spacing | 单倍行距 / 双倍行距 / 1.5 倍行距 | |
| Clear paragraph formatting | 清除段落格式 | |
| Copy formatting | 复制格式 | Format Painter itself = 格式刷. |
| Font size box | 字号框 | |
| Navigate (command group) / Other | 导航 / 其他 | |
| Suggested (command search) | 推荐 | 建议 stays for Writing Assistant suggestions. |
| Open document (search kind) | 已打开的文档 | |
| Update table (of contents) | 更新目录 | Word’s button. |
| Readability report / Word frequency table | 可读性报告 / 词频表 | Word Frequency (add-in) = 词频统计. |
| Page thumbnails / Page count | 页面缩略图 / 页数 | |
| Smart quotes / AutoCorrect | 智能引号 / 自动更正 | |
| Appearance | 外观 | Options section. |
| Start in (mode for new windows) | 默认编辑模式 | “start mode” in descriptions = 默认编辑模式. |
| Page layout (Print / Web setting) | 页面版式 | Choices 页面 / Web 版式. |
| Editing style (View group) | 编辑方式 | |
| Bundled | 内置 | “{via} (bundled)” = {via}（已内置）. |
| Rich Text | 富文本格式 | The Save As card (next to an RTF badge). In format lists inside sentences: RTF. |
| Slides / Beamer slides | 幻灯片 / Beamer 幻灯片 | PowerPoint slides = PowerPoint 幻灯片. |
| Jupyter notebook | Jupyter 笔记本 | |
| Markdown features: wikilinks, containers, display math | Wiki 链接、容器、行间公式 | |
| Templates | 研究论文 / 实验记录本 / 学位论文章节 / 会议记录 / 文献综述 | Research paper / Lab notebook / Thesis chapter / Meeting notes / Literature review. |
| keyboard focus (“move the keyboard to…”) | 键盘焦点 | |
| GitHub release | 发布版本 | |
| portable copy / portable zip | 便携版 / 便携版 zip | |
| feature zip | 功能 zip 文件 | markooj-feature-….zip. |
| needs attention | 需要处理 | |
| Check again | 重新检查 | Same everywhere (app and language groups share the key). |
| Report this / How to fix / Do it for me / Show me | 报告此问题 / 如何修复 / 帮我完成 / 带我看看 | Health and Welcome cards. |
| Take the tour / practice document | 开始导览 / 练习文档 | |
| Mermaid diagram kinds | 流程图 / 时序图 / 类图 / 甘特图 / 饼图 / 思维导图 | Flowchart / Sequence / Class / Gantt / Pie / Mindmap. Mermaid source = Mermaid 源代码. |
| Flavor | 变体 | |
| Document themes | 学术 / 紧凑 / 经典衬线 / 现代无衬线 | Academic / Compact / Classic serif / Modern sans. |
| Reading font / size; Reading (time row) | 阅读字体 / 阅读字号；阅读时间 | |
| Info rows | 字符数 / 页数 / 字数 / 摘要 / 作者 / 类型 / 状态 | Characters / Pages / Words / Abstract / Author(s) / Type / Status. |
| property / name / value | 属性 / 名称 / 值 | Property name = 属性名称. |
| Colors | 自动 / 无颜色 / 蓝色 / 绿色 / 灰色 / 橙色 / 粉红色 / 紫色 / 红色 / 黄色 | No highlight = 无颜色 (Word). |
| just now / today at / yesterday at | 刚刚 / 今天 {time} / 昨天 {time} | |
| package manager / security software | 软件包管理器 / 安全软件 | |
| macOS Terminal | “终端” | In quotes, as the app name. |
| Set goal / Set target | 设置目标 / 设置字数目标 | Kept different on purpose. |
| goal ring | 目标圆环 | |
| Recovery store | “文档恢复” | Never 恢复存储. |
| Go back to saved version | 还原为保存的版本 | 恢复 is Redo. |
| safe fixes | 安全修正 | Accept all safe fixes = 接受所有安全修正. |
| Suggest words (completion) | 单词补全 | “Suggest words as I type” = 键入时补全单词. |
| Technical terms / place names | 专业术语 / 地名 | |
| Writing goals: audience, formality, domain | 受众 / 正式程度 / 领域 | Values: 通用, 熟悉主题, 专家; 非正式, 中性, 正式; 学术, 商务. |
| Score verdicts | 优秀 / 良好 / 尚可 / 有待改进 | |
| contractions / hedging / wordy phrases | 缩约形式 / 含糊措辞 / 冗词赘语 | |
| Flesch labels | 非常容易 / 容易 / 较容易 / 浅显易懂 / 较难 / 困难 / 非常困难 | |
| word list / spelling list / reading (of a word) | 词表 / 拼写词表 / 读法 | |
| Keyboard layout hints | 标准 / 按发音 | Short hints only; the full layout names stay in English (Urdu Phonetic (CRULP), Arabic (101) …). |
| Hijri months | 穆哈兰姆月 … 都尔黑哲月 | Chinese Muslim standard names. |
| Date format labels | 月名 日, 年 / 日 月名 年 | Describe MMMM d, yyyy and d MMMM yyyy. |
| 12-hour / 24-hour | 12 小时制 / 24 小时制 | Custom pattern = 自定义格式. |
| Repository | 仓库 | GitHub usage. |
| Upright (math) | 正体 | Never 直立. |

## Decisions and open questions

- 2026-11-27: Address the user as 你, not 您.
- 2026-11-27: One half-width space between Chinese and Latin letters or digits (including placeholders); none next to full-width punctuation.
- 2026-11-27: Ribbon tab = 选项卡; document tab = 标签页.
- 2026-11-27: Mode names: Word / 行内 / 简易 / 阅读 (long forms add 模式). “Word” stays.
- 2026-11-27: Redo = 恢复 (Office); the File page Recover = 文档恢复, so the two never collide.
- 2026-11-27: Undo = 撤消 (Microsoft spelling).
- 2026-11-27: Comment = 批注, equation = 公式, caption = 题注, bibliography = 书目, citation = 引文 (all as in Word).
- 2026-11-27: Table Layout = 表布局 (Word shows 布局; we add 表 to tell it from the Layout tab).
- 2026-11-27: Aarab = 元音符号.
- 2026-11-28 (review): Features = 可选功能 everywhere (paths “文件 → 选项 → 可选功能”).
- 2026-11-28 (review): Edit as text = 以文本形式编辑; computer = 电脑; citation key = 引文键; add-ins are 启用/禁用.
- 2026-11-28 (review): Cross-reference choices follow Word: 只有标签和编号 / 只有编号 / 只有题注文字.
- 2026-11-28 (review): “{count} words” is one key shared by the document word count and language-pack word lists; it is {count} 字 for both.
- Open: native reviewers may prefer 参考文献 over 书目 for researchers; change here first if so.
- Open: “General” is one key for both the audience and the domain, so the goals line can read “通用 · 中性 · 通用”. A context marker (General@@audience) would allow 大众 for the audience.
- Open: the Help window’s “Previous” (上一页) pairs with the shared “Next” (下一步, the tutorial button). A context marker (Next@@help page) would allow 下一页.
- Open: “Columns” (Layout → Columns = 栏) is also the field in the Insert table dialog, and “Size” is both Layout → Size and the file-size row; context markers would allow 列数 and 纸张大小.

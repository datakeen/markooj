# Japanese (日本語) glossary for Markooj

Code `ja` · left to right · plural category: `other` only · the translation rules are in [docs/I18N.md](../../docs/I18N.md).

Every catalog file (`shell`, `app`, `editors`, `language`, `system`) follows this page. To change a term, change it here first, then everywhere it appears. When Microsoft Word (Japanese) has a name for the same thing, use Word's name: our users know Word, and they look for 「挿入」「参考資料」「校閲」, not for a new word.

## 1. Voice and register

The interface should read like Japanese Microsoft Office written by a careful native editor: calm, polite, short, never a word-for-word copy of the English.

- **Sentences and messages: です・ます.** Do not use だ・である. Do not address the user as あなた; leave the subject out, as natural Japanese does. Use お使いの only when it is really needed (お使いのコンピューター).
- **Buttons, menu items, commands, ribbon labels, headings: noun or dictionary forms, as Office does.** 保存, 開く, 閉じる, 挿入, 表の削除, 見出しへ移動. Never です/ます, never 。 on a label.
  - Verb + object labels use the noun form with の: Insert table → 表の挿入, Delete comment → コメントの削除, Edit link → リンクの編集 (Word style). Short verb buttons stay one word: 削除, 適用, 実行.
  - Toggle options and check boxes use the dictionary form: 入力中にスペル チェックを行う, 毎回表示する.
- **ScreenTip descriptions and help sentences** (the English sentence with a period) are full sentences in です/ます: 「選択した文字列を太字にします。」
- **Requests to the user:** 〜してください。 Not 〜して下さい, not 〜しなさい, not 〜してね. Negative: 〜しないでください。
- **Solution first.** The English messages say what to do first, then what still works. Keep that order: 「別のフォルダーに保存してください。このフォルダーには書き込めません。文書は開いたままです。」 Never start with an apology and never add one (すみません／申し訳ありません) the English does not have.
- **Plain and short.** 〜することができます → 〜できます. 〜を行います → just the verb when possible (保存を行います → 保存します). No 〜させていただきます. No exclamation marks; a cheerful English line becomes a friendly but calm Japanese line (You’re all set! → 準備が整いました。).
- **Kanji vs. katakana.** Use Office's choice (段落, 見出し, 余白, 表 / リボン, タブ, スタイル, テンプレート). Do not invent katakana for words that have a kanji term in Office, and do not force kanji where Office uses katakana.
- **Long vowel mark, Microsoft style:** フォルダー, ユーザー, コンピューター, エディター, ビューアー, ルーラー, プリンター, サーバー, ヘッダー, フッター, カーソル (no ー), メニュー.
- **Spaces between katakana words, Microsoft style:** ステータス バー, クイック アクセス ツール バー, キー ヒント, テーブル デザイン, スペル チェック, フォント サイズ, マクロ エディター. Single loanwords stay one word (アドイン, テンプレート, ショートカット).

Three short examples:

| English | Japanese | Why |
| --- | --- | --- |
| Save changes to “{name}”? / Save / Don’t Save / Cancel | 「{name}」への変更を保存しますか？ / 保存 / 保存しない / キャンセル | Question in です/ます, buttons as short as Word's own dialog. |
| Click in a table cell first, then try {command} again. | 表のセル内をクリックしてから、「{command}」をもう一度実行してください。 | Solution first, polite request, command name in 「」. |
| Bold (Ctrl+B) / Make the selected text bold. | 太字 (Ctrl+B) / 選択した文字列を太字にします。 | Label is a noun; the description is a です/ます sentence. |

## 2. Punctuation, spacing and numbers

- **Japanese punctuation** in Japanese text: 、 and 。 Never a Latin comma or period after Japanese text. Follow the English: when the English ends with a period, the Japanese ends with 。 (a ScreenTip description, a card subtitle such as “No formatting at all.” → 書式は一切含みません。); when the English label has no period, the Japanese has none.
- **Question mark:** full-width ？ at the end of a Japanese question (保存しますか？). No ！.
- **Quotes:** English “…” and ‘…’ become 「…」; a quote inside a quote becomes 『…』. UI names quoted in a sentence also go in 「」: 「ファイル」→「オプション」を開いてください。
- **Parentheses:** full-width （） around Japanese content: 英語（米国）, 図（番号なし）. Half-width ( ) with one half-width space before them when the content is only Latin letters, digits or keys: 太字 (Ctrl+B), ウルドゥー語 フォネティック (CRULP), インストール (41 MB).
- **Colon:** full-width ： after Japanese text: テーマ：{theme}, キーボード：{layout}. Keep half-width `:` inside code, times (3:15) and Latin text.
- **Arrows and separators:** keep → for menu paths (「ファイル」→「回復」), keep the middle dot · used as a separator in the English (読み取り専用 · 2 ページ). Use ・ only for listing Japanese words (日付・時刻). Avoid the em dash; rephrase or use （）.
- **&** in labels becomes と: Links & pages → リンクとページ, Date & time → 日付と時刻.
- **Digits are half-width** (1, 2, 3); never full-width ０-９. Numbers in `{count}` are formatted by the app (12,345).
- **Space between Latin and Japanese:** one half-width space between a Latin word or a number and Japanese text, as Office does: Word モード, Markdown 形式, PDF として保存, 3 ページ, 25 分. No space before 。、「」（） or after them. No space before %: 50%.
- **Counters:** {count} 件 (suggestions, issues, matches, results, comments, updates, references), {count} 個 (items, files, add-ins, macros, guides), {count} 語 (words), {count} 文字 (characters), {count} ページ, {count} 行, {count} 日, {count} 分, {count} 時間, {count} 秒. Japanese has only the `other` plural form: write one form with the counter and no plural marking.
  - `"{count} files": { "other": "{count} 個のファイル" }`
- **Ranges and ratios:** Page {current} of {total} → {current}/{total} ページ (as Word's status bar); {index} of {count} → {index}/{count}; 1 to 9 → 1～9 (full-width wave dash ～).
- **Dates and times** come from Intl; do not hard-code 年/月/日 around placeholders unless the English does the same with words (today at {time} → 今日 {time}).

## 3. Placeholders, names and shortcuts in sentences

- Keep every `{placeholder}` exactly; move it to where Japanese grammar needs it (Saved {name} → 「{name}」を保存しました).
- **Names the user gave or typed** (`{name}`, `{title}`, `{query}`, `{word}`, `{text}`, `{file}`) go in 「」 with no spaces: 「{query}」に一致するものはありません。 If the English already has “{name}”, that becomes 「{name}」 (never 「“{name}”」).
- **Names of UI things that are already translated** (`{command}`, `{page}`, `{tab}`, a mode or File page name) go in 「」 inside a sentence: 「{name}」タブをクリックしてください。 In a short label they need no 「」: {name} モードを試す.
- **Numbers and Latin-only values** (`{count}`, `{n}`, `{size}`, `{version}`, `{tool}`, `{feature}` when it is Pandoc, `{format}`, `{key}`, `{keys}`, `{label}`, `{path}`) take one half-width space toward Japanese text: {tool} をインストール, バージョン {version}, {count} 件の候補. `{language}` holds a Japanese language name: no space (「{language}をダウンロード」).
- **Keyboard keys stay in Latin letters** exactly as in the English: Ctrl, Shift, Alt, Enter, Esc, Tab, Page Up, F1 … and combinations like Ctrl+Shift+K. Never 「コントロール」 or full-width ＋.
  - After a label, in half-width parentheses with no キー: 次へ (Enter), 閉じる (Esc).
  - In a sentence, add キー as Microsoft does: Alt キーを押してください。 / Ctrl+S キーを押すと保存できます。
  - Keep `<kbd>Ctrl+S</kbd>` tags and their content unchanged: <kbd>Ctrl+S</kbd> キーを押すと…
- **Product and format names stay as is** (Markooj, Word, Excel, PowerPoint, Pandoc, KaTeX, Mermaid, Markdown, LaTeX, BibTeX, GitHub, Python, JavaScript, PDF, DOCX, EPUB, DjVu, Jupyter, Electron). Join with a space: Word 文書, Markdown のテキスト.
- **Never translate** Markdown syntax, `@eq:energy`, `**bold**` markers, `word-target`, file extensions, command ids or anything inside `<code>`.

## 4. The ellipsis “…”

- Keep “…” (U+2026, one character) at the end of a menu item or button that opens a dialog, exactly where English has it, with no space before it: Save as… → 名前を付けて保存…, Options… → オプション…, Browse… → 参照…, Insert Table… → 表の挿入…
- Do not write “...” (three periods) or “・・・”.
- Progress states also keep “…”: 読み込み中…, ダウンロード中…, インストール中…, 確認中…
- An English label without “…” gets none in Japanese.

## 5. Terms

Use these in every file. “Word” in the notes means Microsoft Word for Windows in Japanese.

### 5.1 Ribbon tabs (as in Word)

| English | Japanese | Notes |
| --- | --- | --- |
| File | ファイル | The File tab and the full-window File page. |
| Home | ホーム | |
| Insert (ribbon tab) | 挿入 | Also the Insert button (`Insert@@verb`): 挿入. |
| Layout | レイアウト | Page layout tab (Word 2016+). |
| References | 参考資料 | |
| Review | 校閲 | |
| View | 表示 | |
| Developer | 開発 | |
| Add-ins | アドイン | Tab and the general word. |
| Help | ヘルプ | |
| Table Design | テーブル デザイン | Contextual tab, as in Microsoft 365 Word. |
| Table Layout | テーブル レイアウト | Contextual tab. Word calls it just レイアウト; we add テーブル so it is not confused with the Layout tab. |
| Table Tools | 表ツール | Label above the contextual tabs. |

### 5.2 Ribbon groups

| English | Japanese | Notes |
| --- | --- | --- |
| Clipboard | クリップボード | Home. |
| Font | フォント | Home. |
| Paragraph | 段落 | Home. |
| Styles | スタイル | Home. |
| Editing | 編集 | Home (Find, Replace, Select). |
| Direction | 文字の方向 | Home: left-to-right / right-to-left paragraphs. |
| Aarab | 母音記号 | Home group for Urdu/Arabic vowel marks (see 5.11). |
| Blocks | ブロック | Insert: code block, callout, divider. |
| Illustrations | 図 | Insert, as Word. |
| Pictures | 画像 | Insert → Pictures (Word: 画像). |
| Text | テキスト | Insert (Symbol, Date & time). |
| Links & pages | リンクとページ | Insert. |
| Notes & sources | 注と出典 | Insert (footnote, citation, hidden note). |
| Captions | 図表番号 | Insert / References, as Word. |
| Page setup | ページ設定 | Layout. |
| Spacing | 間隔 | Layout. |
| Document theme | 文書のテーマ | Layout. |
| Table of contents | 目次 | References. |
| Footnotes | 脚注 | References. |
| Citations & bibliography | 引用文献と文献目録 | References, Word's exact name. |
| Proofing | 文章校正 | Review. |
| Comments | コメント | Review. |
| Language | 言語 | Review. |
| Versions | バージョン | Review. |
| Writing (Review group) | 文章作成 | Writing Assistant, readability. |
| Writing@@ribbon group (View) | 執筆 | Typewriter, Goals, Sprint. |
| Views | 表示モード | View. Word 2010 used 文書の表示; 表示モード is shorter and does not clash with Show. |
| Show@@ribbon group | 表示 | View → Show (ruler, gridlines), as Word. |
| Zoom | ズーム | View. |
| Window@@ribbon group | ウィンドウ | View. |
| Mode@@ribbon group | 編集モード | View: the four editing modes. |
| Theme | テーマ | View / Layout. |
| Keyboard | キーボード | View group and the typing keyboard. |
| Commands | コマンド | View. |
| Tables | 表 | View group. |
| Code@@ribbon group | コード | Developer. |
| Macros | マクロ | Developer. |
| Math macros | 数式マクロ | Developer. |
| My macros | マイ マクロ | Developer. |
| Math@@ribbon group | 数式 | Developer. |
| Manage | 管理 | Add-ins. |
| Store@@ribbon group | ストア | Add-ins. |
| About | バージョン情報 | Help group and the About page. |
| Feedback | フィードバック | Help. |
| Welcome | ようこそ | Help button and status bar chip. |
| Features (optional parts) | 追加機能 | Help group and File → Options → Features. Not `Features@@markdown`. |
| Table Styles | 表のスタイル | Table Design. |
| Table Style Options | 表スタイルのオプション | Table Design. |
| Rows & Columns | 行と列 | Table Layout. |
| Cell Size | セルのサイズ | Table Layout. |
| Alignment | 配置 | Table Layout. |
| Data | データ | Table Layout. |

### 5.3 Common commands and buttons

| English | Japanese | Notes |
| --- | --- | --- |
| Save (command, Ctrl+S) | 上書き保存 | Word's command name; use it with the shortcut and in the Quick Access Toolbar: 上書き保存 (Ctrl+S). |
| Save (dialog button, bare key `Save`) | 保存 | Word's dialog uses 保存 / 保存しない / キャンセル. |
| Don’t Save | 保存しない | |
| Save As / Save as… | 名前を付けて保存 / 名前を付けて保存… | |
| Save all | すべて保存 | |
| Save a copy | コピーを保存 | |
| Open (verb) | 開く | Open… → 開く… |
| Open (adjective, state) | 開いている | `Open@@adjective`. |
| Close | 閉じる | |
| New | 新規 | File → New page. New document → 新規文書. |
| Undo | 元に戻す | |
| Redo | やり直し | |
| Repeat | 繰り返し | Word's F4. |
| Cut | 切り取り | |
| Copy | コピー | |
| Paste | 貼り付け | |
| Paste as plain text | テキストのみ貼り付け | Word's paste option is テキストのみ保持; as a command this is clearer. |
| Select all | すべて選択 | |
| Find | 検索 | |
| Replace | 置換 | |
| Find and replace | 検索と置換 | |
| Find next / Find previous | 次を検索 / 前を検索 | |
| Replace all | すべて置換 | |
| Match case | 大文字と小文字を区別 | |
| Whole words | 単語単位 | Word: 完全に一致する単語だけを検索する; keep it short. |
| Go To | ジャンプ | Word's Ctrl+G. “Go to page” → ページへ移動. |
| Insert (button) | 挿入 | |
| Delete | 削除 | |
| Remove | 削除 | Same word as Delete, as Word. Remove from list → 一覧から削除. |
| Rename | 名前の変更 | |
| Options | オプション | File → Options. |
| Settings | 設定 | |
| Help | ヘルプ | |
| Cancel | キャンセル | |
| OK | OK | Half-width. |
| Apply | 適用 | |
| Reset | リセット | |
| Install | インストール | |
| Uninstall | アンインストール | |
| Download | ダウンロード | |
| Update | 更新 | Update all → すべて更新. Check for updates → 更新の確認. |
| Try again | 再試行 | Button. In a sentence: もう一度お試しください。 |
| Details | 詳細 | |
| Technical details | 技術的な詳細 | |
| Learn more | 詳細情報 | |
| Don’t show again | 今後表示しない | |
| Show / Hide | 表示 / 非表示 | Hide {name} → {name} を非表示. |
| Turn on / Turn off | オンにする / オフにする | On / Off (switch) → オン / オフ. |
| Next / Previous | 次へ / 前へ | Back → 戻る, Forward → 進む. |
| Continue | 続行 | |
| Done | 完了 | |
| Skip | スキップ | |
| Not now / Later | 後で | |
| Browse… | 参照… | |
| Discard | 破棄 | |
| Overwrite | 上書き | |
| Copy path / Copy link | パスのコピー / リンクのコピー | |
| Show in folder | フォルダーに表示 | |
| Run | 実行 | |
| Stop | 停止 | |
| Close anyway | 強制的に閉じる | Button in “Close Markooj anyway?” (Markooj did not finish closing; unsaved text stays in File → Recover). |
| Report a problem | 問題を報告 | |
| Accept / Dismiss | 承諾 / 閉じる | Accept a writing suggestion → 適用 when it changes text. |
| Search (verb) | 検索 | |
| Print / Print… | 印刷 / 印刷… | Print preview → 印刷プレビュー. |
| Zoom in / Zoom out | 拡大 / 縮小 | |

### 5.4 Markooj's editing modes

The mode switch in the title bar is tiny; keep the short names short.

| English | Japanese | Notes |
| --- | --- | --- |
| Word mode | Word モード | Named after Microsoft Word; keep “Word”. Short switch label `Word` stays Word. |
| Inline@@editing mode / Inline mode | インライン / インライン モード | Live Markdown in the line. Not the inline equation (see 5.6). |
| Simple@@editing mode / Simple mode | シンプル / シンプル モード | Markdown source with a preview. |
| Read@@editing mode / Read mode | 閲覧 / 閲覧モード | Word's Read Mode is 閲覧モード. |
| Editing mode | 編集モード | |
| Viewer | ビューアー | Status bar, while a PDF or DjVu file is open. |
| Print layout / Web layout | 印刷レイアウト / Web レイアウト | Short switch labels `Print@@page layout` → 印刷, `Web@@page layout` → Web. |
| Focus | フォーカス | Word's Focus view. Leave focus → フォーカスを終了. |
| Read only | 読み取り専用 | |

### 5.5 Window, ribbon and navigation

| English | Japanese | Notes |
| --- | --- | --- |
| ribbon | リボン | |
| tab (ribbon tab) | タブ | Click the {name} tab → 「{name}」タブをクリック. |
| tab (document tab) | 文書タブ | Short form タブ when clear. |
| group (ribbon group) | グループ | |
| Quick access | クイック アクセス ツール バー | Short label クイック アクセス when space is tight. |
| status bar | ステータス バー | |
| command search (palette, Alt+Q) | コマンド検索 | Search or type a command → 検索またはコマンドを入力. |
| command | コマンド | |
| ScreenTip | ヒント | Word's name. |
| KeyTips | キー ヒント | Word's name. |
| keyboard shortcut | キーボード ショートカット | Shortcut alone: ショートカット. |
| window | ウィンドウ | New Window → 新しいウィンドウ. |
| pane (side pane: outline, Writing Assistant) | 作業ウィンドウ | Use the pane's own name when there is one (アウトライン). |
| pane (one half of a split) | ウィンドウ枠 | Excel's term (ウィンドウ枠の固定). Second pane → もう一方のウィンドウ枠 / 2 つ目のウィンドウ枠. |
| Split / Remove Split | 分割 / 分割の解除 | Word's View → 分割. |
| View Side by Side / side by side | 並べて比較 / 左右に並べる | Word's 並べて比較. |
| Synchronous Scrolling | 同時にスクロール | Word. |
| Arrange All | 整列 | Word. |
| Switch Windows | ウィンドウの切り替え | Word. |
| Reset Window Position | ウィンドウの位置を元に戻す | Word. |
| Stacked | 上下に並べる | Split panes one above the other. |
| outline | アウトライン | The list of headings at the side. |
| ruler | ルーラー | Rulers → ルーラー (no plural). |
| guide (guide line) | ガイド | As PowerPoint. Horizontal / Vertical guide → 水平ガイド / 垂直ガイド. |
| gridlines | グリッド線 | View Gridlines → グリッド線の表示. |
| formatting marks | 編集記号 | Word. Show formatting marks → 編集記号の表示. |
| Zoom / zoom level | ズーム / 倍率 | Fit page width → ページ幅に合わせる. |
| theme (interface) | テーマ | Light / Dark → ライト / ダーク; Match system → システム設定に合わせる; System@@theme → システム. |
| Appearance | 外観 | Options section. |
| full-screen mode | 全画面表示 | |
| Welcome / Welcome screen | ようこそ / ようこそ画面 | Welcome to Markooj → Markooj へようこそ. |
| tutorial / guided tour | チュートリアル / ガイド ツアー | Take the tour → ツアーを見る. |
| Getting started | はじめに | |
| What’s new | 新機能 | What’s new in {version} → バージョン {version} の新機能. |

### 5.6 Document terms

| English | Japanese | Notes |
| --- | --- | --- |
| document | 文書 | Word's word (新規文書, 白紙の文書). Not ドキュメント, except in Office names that use it. |
| Blank document | 白紙の文書 | |
| Untitled / Untitled {n} | 無題 / 無題 {n} | |
| template | テンプレート | New from template → テンプレートから新規作成. |
| page | ページ | Page break → 改ページ. |
| paragraph | 段落 | |
| heading / Heading 1 | 見出し / 見出し 1 | Word style names: 見出し 1 … 見出し 6. |
| Normal (style) / Title / Subtitle | 標準 / 表題 / 副題 | Word style names. |
| Quote (style) | 引用文 | Word style name. Block quote → 引用. |
| style | スタイル | |
| text | 文字列 / テキスト | Selected text → 選択した文字列 (Word). Text as a thing in a file → テキスト. |
| Bold / Italic / Underline / Strikethrough | 太字 / 斜体 / 下線 / 取り消し線 | |
| Subscript / Superscript | 下付き / 上付き | |
| Highlight | 蛍光ペン | No highlight → 色なし. |
| Text color / Font color | フォントの色 | Automatic (color) → 自動. |
| Clear formatting | すべての書式をクリア | Word. |
| Format painter | 書式のコピー/貼り付け | Word. |
| Change Case | 文字種の変換 | Word. |
| Grow Font / Shrink Font | フォント サイズの拡大 / フォント サイズの縮小 | Word. |
| Font size | フォント サイズ | pt → pt. |
| Align left / Center / Align right / Justify | 左揃え / 中央揃え / 右揃え / 両端揃え | |
| Line spacing / paragraph spacing | 行間 / 段落の間隔 | |
| Bullets / Numbering | 箇条書き / 段落番号 | Word. A numbered list → 番号付きリスト. |
| list | リスト | Task list / checklist → チェックリスト. |
| Increase indent / Decrease indent | インデントを増やす / インデントを減らす | |
| Promote / Demote | レベル上げ / レベル下げ | Word's outline commands. |
| table | 表 | Insert → 表 (Word). Insert table → 表の挿入. |
| row / column (table) | 行 / 列 | Insert Row Above → 上に行を挿入; Insert Column Left → 左に列を挿入. |
| cell | セル | Merged cells → 結合されたセル. |
| Header Row | タイトル行 | Word. |
| Banded rows | 縞模様 (行) | Word's exact label, half-width parentheses included (the one exception to section 2). |
| Sort / Ascending / Descending | 並べ替え / 昇順 / 降順 | |
| Convert Text to Table / Convert Table to Text | 文字列を表にする / 表の解除 | Word. |
| columns (page layout) | 段組み | One / Two → 1 段 / 2 段. |
| margins | 余白 | Normal / Narrow / Wide → 標準 / 狭い / 広い. |
| page size / Letter | サイズ / レター | |
| caption | 図表番号 | Word's term. Insert caption → 図表番号の挿入. |
| caption text | 説明文 | The words after “Figure 1:”. |
| label (caption or cross-reference label) | ラベル | |
| figure | 図 | Figure {number} → 図 {number}. |
| equation | 数式 | Insert equation → 数式の挿入. Equation {number} → 数式 {number}. |
| inline equation / display equation | 文中数式 / 独立数式 | Word's 文中数式に変更 / 独立数式に変更. Equation editor `Inline` → 文中. |
| equation editor | 数式エディター | |
| numbering (of equations, figures) | 番号付け | Number equations → 数式に番号を付ける. |
| chapter | 章 | |
| citation / cite | 引用文献 / 引用 | Insert citation → 引用文献の挿入. |
| reference (one source in the library) | 文献 | {count} references → {count} 件の文献. |
| citation library | 文献ライブラリ | BibTeX library → BibTeX ライブラリ. |
| citation style | 引用スタイル | |
| bibliography | 文献目録 | Word. Insert bibliography → 文献目録の挿入. |
| footnote | 脚注 | Insert footnote → 脚注の挿入. |
| comment | コメント | New comment → 新しいコメント. |
| hidden note (%%note%%) | 隠しメモ | Never printed. |
| cross-reference | 相互参照 | Word. Short `Cross-ref` → 相互参照. |
| table of contents | 目次 | Update table → 目次の更新. |
| link / hyperlink | リンク / ハイパーリンク | Text to show → 表示文字列; Address → アドレス. |
| picture | 画像 | Picture not found → 画像が見つかりません. |
| diagram / Mermaid diagram | ダイアグラム / Mermaid ダイアグラム | Not 図 (that is a figure). Flowchart → フローチャート, Pie → 円グラフ, Gantt → ガント チャート. |
| symbol | 記号 | Word's button is 記号と特殊文字; the short label 記号 is fine. |
| Date & time | 日付と時刻 | |
| code block / inline code | コード ブロック / インライン コード | |
| callout box (Note, Tip, Important, Warning, Caution) | 注記ボックス (注, ヒント, 重要, 警告, 注意) | GitHub-style alert boxes. |
| divider | 区切り線 | |
| front matter | フロントマター | The settings block at the top of a Markdown file. |
| Markdown flavor | Markdown の種類 | Detected flavor → 検出された種類. |
| properties / document properties | プロパティ / 文書のプロパティ | File → Info → 情報. |
| track changes | 変更履歴の記録 | Word. |
| word count / words / characters | 文字カウント / 単語数 / 文字数 | Word's dialog. {count} words → {count} 語. |
| readability | 読みやすさ | |
| version / compare | バージョン / 比較 | Compare with saved version → 保存済みのバージョンと比較. |

### 5.7 Writing and language features

| English | Japanese | Notes |
| --- | --- | --- |
| Writing Assistant | 文章作成アシスタント | Markooj's side pane (like Microsoft Editor). |
| suggestion (writing) | 提案 | {count} suggestions → {count} 件の提案. |
| suggestion (spelling replacement) | 修正候補 | No spelling suggestions → 修正候補はありません. |
| spelling | スペル チェック / スペル | Check spelling as you type → 入力時にスペル チェックを行う. |
| grammar | 文法 | |
| Spelling and grammar | スペル チェックと文章校正 | Word's button. |
| proofing / proofing language | 文章校正 / 校正言語 | |
| Add to Dictionary / Ignore / Ignore All | 辞書に追加 / 無視 / すべて無視 | Word. |
| my dictionary | ユーザー辞書 | Word's term for the custom dictionary. |
| thesaurus / synonyms / antonyms | 類義語辞典 / 類義語 / 対義語 | Word. |
| interface language | 表示言語 | Office's word for the UI language. |
| document language | 文書の言語 | |
| language pack | 言語パック | |
| keyboard (typing layout) | キーボード | Urdu Phonetic, Arabic 101… Keyboard layout → キーボード レイアウト. |
| on-screen keyboard | スクリーン キーボード | Windows term. |
| right to left / left to right | 右から左 / 左から右 | Text direction → 文字の方向. |
| half space (ZWNJ) / joiner (ZWJ) | ハーフ スペース (ZWNJ) / 結合子 (ZWJ) | On-screen keyboard keys. Half space keeps two letters apart without a full space; not 半角スペース (that is a different character). |
| readability score / writing score | 読みやすさのスコア / 文章スコア | |
| audience / formality / domain | 対象読者 / 文体 / 分野 | Writing Assistant goals. Formal / Neutral / Informal → フォーマル / 標準 / カジュアル (Word's Editor uses フォーマル and カジュアル). “casual words” in a sentence → くだけた語. |
| Correctness / Clarity / Engagement / Delivery | 正確さ / 明確さ / 魅力 / 伝わりやすさ | Writing Assistant categories. |
| safe fix | 安全な修正 | Accept all safe fixes → 安全な修正をすべて適用. |
| typewriter scrolling | タイプライター スクロール | |
| writing goal / daily goal / word target | 執筆目標 / 1 日の目標 / 目標語数 | |
| writing sprint / Sprint | 集中執筆 | Start a 25-minute sprint → 25 分間の集中執筆を開始. |
| streak | 連続記録 | {count}-day streak → {count} 日連続. |
| slash commands | スラッシュ コマンド | |
| multiple cursors | 複数カーソル | Add cursor below → 下にカーソルを追加. |
| Gregorian / Hijri calendar | 西暦 / ヒジュラ暦 | {day} {month} {year} AH → ヒジュラ暦 {year} 年 {month} {day} 日 if the order reads better. |

### 5.8 Add-ins, macros and features

| English | Japanese | Notes |
| --- | --- | --- |
| add-in | アドイン | |
| Add-in Store | アドイン ストア | |
| community add-ins | コミュニティ アドイン | |
| macro | マクロ | |
| Record macro / Stop recording | マクロの記録 / 記録終了 | Word. |
| Run macro | マクロの実行 | |
| Macro Editor | マクロ エディター | |
| math macros | 数式マクロ | LaTeX \newcommand definitions. |
| Python console | Python コンソール | Output → 出力. |
| feature (optional part to download) | 追加機能 | Pandoc, DjVu tools, Python macros. Install {feature} → {feature} をインストール. |
| feature download | 追加機能のダウンロード | Cancel feature downloads → 追加機能のダウンロードをキャンセル. |
| DjVu tools | DjVu ツール | |
| helper tool / tool | 補助ツール / ツール | Tools@@status bar → ツール. |
| Developer | 開発 | Messages for developers stay English. |

### 5.9 File terms

| English | Japanese | Notes |
| --- | --- | --- |
| file | ファイル | |
| folder | フォルダー | Microsoft long vowel. |
| file name / path | ファイル名 / パス | |
| format (file format) | 形式 / ファイル形式 | |
| export | エクスポート | Export as PDF → PDF としてエクスポート. |
| import | インポート | |
| Save as PDF… | PDF として保存… | |
| Word document | Word 文書 | |
| web page | Web ページ | |
| PDF / DjVu / EPUB e-book | PDF / DjVu / EPUB 電子書籍 | |
| plain text (format, no formatting) | 書式なしテキスト | Word's save type. Code-block language `Plain text` → プレーン テキスト. |
| Recent | 最近使ったアイテム | File → Open, as Word. Recent files → 最近使ったファイル. |
| Info | 情報 | File → Info. |
| Recover / recovery | 回復 | File → Recover → 「回復」. Recover unsaved documents → 保存されていない文書の回復. |
| recovered text / recovery copy | 回復したテキスト / 回復用コピー | |
| backup | バックアップ | |
| autosave / AutoRecover | 自動保存 / 自動回復 | |
| Saved / Edited / Not saved yet | 保存済み / 編集済み / 未保存 | Title-bar states. |
| unsaved changes | 保存されていない変更 | |
| read-only | 読み取り専用 | |
| page setup | ページ設定 | |
| Print preview | 印刷プレビュー | |
| Reveal in folder / Show file in folder | フォルダーに表示 | |
| encoding | 文字コード | Text encoding → 文字コード. |
| license / credits / third-party notices | ライセンス / クレジット / サードパーティ通知 | |
| Repair Markooj | Markooj の修復 | |
| privacy | プライバシー | |

### 5.10 States and short messages

| English | Japanese | Notes |
| --- | --- | --- |
| Loading… | 読み込み中… | |
| Checking… | 確認中… | |
| Downloading… / Installing… / Updating… | ダウンロード中… / インストール中… / 更新中… | |
| Running… / Starting… | 実行中… / 起動中… | |
| Ready | 準備完了 | |
| Installed / Not installed | インストール済み / 未インストール | |
| Copied | コピーしました | Short toast. Copied. → コピーしました。 |
| Saved {name} | 「{name}」を保存しました | |
| No results / No matches | 結果はありません / 一致するものはありません | |
| Nothing to undo | 元に戻す操作はありません | |
| just now / {count} minutes ago | たった今 / {count} 分前 | |
| today / yesterday | 今日 / 昨日 | |
| Everything else works. | その他の機能はすべて使えます。 | The “what still works” part of messages. |
| Nothing is lost | データは失われていません | |

### 5.11 Urdu and Arabic vowel marks (aarab)

Japanese users meet these only when they write Urdu or Arabic. Use 母音記号 for the general word “aarab” (Hide aarab → 母音記号を非表示). Give the mark names in katakana, with the Arabic name in （） when the English gives it:

| English | Japanese | Notes |
| --- | --- | --- |
| aarab / Aarab | 母音記号 | Urdu اعراب. |
| zabar (fatha) | ザバル（ファトハ） | |
| zer (kasra) | ゼール（カスラ） | |
| pesh (damma) | ペーシュ（ダンマ） | |
| shadd (shadda) | シャッド（シャッダ） | |
| jazm (sukun) | ジャズム（スクーン） | |
| tanween zabar / zer / pesh | タンウィーン ザバル / ゼール / ペーシュ | |
| khari zabar | カリー ザバル | |
| Urdu / Arabic / Persian / Punjabi (Shahmukhi) | ウルドゥー語 / アラビア語 / ペルシア語 / パンジャーブ語（シャームキー） | Roman Urdu → ローマ字ウルドゥー語. |
| English (US) / English (UK) | 英語（米国）/ 英語（英国） | |
| Chinese (Simplified) | 中国語（簡体字） | |

### 5.12 Terms added in the first translation round

Chosen by the reviewer from the translators' notes; every catalog already uses them.

**Window, ribbon and File pages**

| English | Japanese | Notes |
| --- | --- | --- |
| title bar | タイトル バー | |
| live preview | リアルタイム プレビュー | Never ライブ プレビュー. |
| page viewer | ページ ビューアー | PDF/DjVu viewer. |
| slim toolbar (Simple mode) | 簡易ツール バー | |
| Edit as text | テキストとして編集 | Button and command; quoted as 「テキストとして編集」 in sentences. |
| Show tabs and commands / Show tabs only | タブとコマンドの表示 / タブのみの表示 | Same wording everywhere, also inside sentences. |
| Full-screen mode | 全画面表示 | Word 365 says 全画面表示モード; the short form fits the menu. |
| Ribbon display (options) | リボンの表示オプション | Pin the ribbon → リボンの固定. |
| Next pane / Previous pane (F6) | 次のウィンドウ枠 / 前のウィンドウ枠 | Word's F6 wording. |
| Close others / Close to the right | その他を閉じる / 右側を閉じる | Document tab menu. |
| Save As / Export (File page) | 名前を付けて保存 | The long form broke inside エクスポート in the File sidebar. |
| Editing style | 編集方法 | Label above the mode switch. |
| Suggested (command search) | おすすめ | |
| Render as (flavor) | 次の種類として解釈 | render as another flavor → 別の種類として解釈. |
| Rich Text | リッチ テキスト | |
| Page thumbnails | ページのサムネイル | |
| Check Tools | ツールの確認 | Help → Check Tools. |
| Browse (File → Add-ins tab) | 探す | Browse add-ins → アドインを探す. Not 参照 (that is browsing for a file). |
| Installed (add-ins tab) | インストール済み | |
| Submit an add-in | アドインの登録 | |
| Made by / Author (add-in) | 提供元 / 作成者 | Add-ins only. A document's author is 著者. |
| Also does (add-in rights) | 追加の権限 | |
| Repository / Tags / Category / Updated / Needs | リポジトリ / タグ / カテゴリ / 更新日 / 必要条件 | Add-in details. |
| Add-in categories | すべて, 開発, エクスポート, お楽しみ, 言語, 数式, 生産性, 研究, 文章作成, その他 | All, Developer, Export, Fun, Languages, Math, Productivity, Research, Writing, Other. |
| safety check | 安全性チェック | |
| security software | セキュリティ ソフトウェア | |
| package manager | パッケージ マネージャー | |
| portable zip | ポータブル版の zip | |
| Documents (Windows folder) | 「ドキュメント」 | The real folder name, so ドキュメント is right here. |
| other (another program, other documents) | 他の | One spelling; not ほかの. |
| already | 既に | One spelling; not すでに. |
| line up / align (verb in sentences) | 揃える | As in 左揃え. |

**Split, side by side and guides**

| English | Japanese | Notes |
| --- | --- | --- |
| divider (split) | 分割線 | |
| Second pane | 2 つ目のウィンドウ枠 | |
| Stack the panes / Stacked | ウィンドウ枠を上下に並べる / 上下に並べる | |
| Swap panes / documents / modes | ウィンドウ枠の入れ替え / 文書の入れ替え / モードの入れ替え | |
| Line up panes by / Synchronous Scrolling follows | ウィンドウ枠の位置の合わせ方 / 「同時にスクロール」の基準 | |
| guide line, Add guide, Clear guides, Remove guide | ガイド, ガイドの追加, ガイドのクリア, ガイドの削除 | |

**Document, references and tables**

| English | Japanese | Notes |
| --- | --- | --- |
| Author(s), Authors (document property) | 著者 | Research front matter; also in File → Info ScreenTips. |
| Abstract / Subject / Keywords | 要旨 / 件名 / キーワード | |
| Created / Modified | 作成日時 / 更新日時 | |
| Reading (time) / Reading time | 読了時間 | speaking time → 読み上げ時間. |
| Reading font / Reading size | 表示フォント / 表示サイズ | |
| Title (style and File → Info field) | 表題 | One key for both; Word's Info pane says タイトル, the style gallery 表題. |
| Insert Caption | 図表番号の挿入 | Word. |
| Reference type / Insert reference to | 参照する項目 / 相互参照の文字列 | Word's cross-reference dialog. |
| For which equation/figure/table… | 参照先の数式 / 参照先の図 / 参照先の表 … | |
| Full label / Number only / Caption text / Above/below | ラベルと番号 / 番号のみ / 説明文 / 上/下 | Include above/below → 「上/下」を含める. |
| Heading text / Heading number | 見出し文字列 / 見出し番号 | |
| (no number yet) / (no number) | （番号未設定） / （番号なし） | |
| Display / Inline (equation editor placement) | 独立 / 文中 | |
| Numbered (switch) | 番号付き | |
| Shows (caption preview) | 表示： | |
| Locate… | 場所を指定… | missing pictures → 見つからない画像. |
| visual editor | ビジュアル エディター | |
| caret | カーソル | Same as cursor. |
| favorites (equations) | お気に入り | |
| separator | 区切り文字 | Separate text at/with → 文字列の区切り (Word). |
| label names Eq., Fig., Table | 式、図、表 | |
| Distribute Columns | 列の幅を揃える | |
| Table styles Plain / Grid / Accent | 標準 / 格子 / アクセント | |
| header row | タイトル行 | Word. |
| Flesch reading ease / grade level | Flesch の読みやすさ / 学年レベル | |
| Readability bands | 非常にやさしい, やさしい, 比較的やさしい, 平易, やや難しい, 難しい, 非常に難しい | Very easy … Very difficult; Plain English → 平易. |
| Word frequency (table) | 単語の出現頻度 / 単語の出現頻度表 | |
| Word list | 単語リスト | |
| SI Units | SI 単位 | |
| Mermaid kinds Class / Sequence / Mindmap | クラス図 / シーケンス図 / マインド マップ | |
| Theme names Academic / Classic serif / Modern sans / Compact | 学術 / クラシック セリフ / モダン サンセリフ / コンパクト | |
| Smart quotes / AutoCorrect | スマート引用符 / オートコレクト | |
| Small caps / All caps | 小型英大文字 / すべて大文字 | Word. |
| Change Case items | 文の先頭文字を大文字にする, すべて小文字にする, すべて大文字にする, 各単語の先頭文字を大文字にする, 大文字と小文字を入れ替える | Word. Title Case → 主要な単語の先頭文字を大文字にする. |
| containers / wikilinks | コンテナー / Wiki リンク | Markdown features. |
| Templates | 研究論文, 実験ノート, 学位論文の章, 議事録, 文献レビュー | Research paper, Lab notebook, Thesis chapter, Meeting notes, Literature review. |
| Math macro gallery: braces / argument / default value / Examples | 波かっこ / 引数 / 既定値 / 例 | |
| Help home / Reference Manual / About Markooj | ヘルプのホーム / リファレンス マニュアル / Markooj のバージョン情報 | |
| Project page | プロジェクト ページ | |

**Help, tours and messages**

| English | Japanese | Notes |
| --- | --- | --- |
| Take the tour / Show me / Do it for me | ツアーを見る / 見てみる / 代わりに実行 | |
| Report this / How to fix / What you can do | この問題を報告 / 解決方法 / 対処方法 | |
| needs attention | への対処が必要です | |
| Get {tool} | {tool} を入手 | |
| Optional (field placeholder) | 省略可 | |
| Recovered (new document title) | 回復した文書 | {name} (copy) → {name} - コピー, as Windows names copies. |
| Well done | よく頑張りました | Calm, not お見事. |
| Unpacking… | 展開中… | |
| Dismiss (writing suggestion) | 閉じる | Accept (suggestion) → 適用. |
| Why? (writing rule) | 理由 | |

**Sentence patterns**

- `{goal}` and `{action}` fragments are dictionary-form verb phrases (DjVu ファイルを開く, ファイルを保存する). Templates use them as 「{goal}には、…」「{goal}ことができます」「…ため、{action}ことができませんでした」.
- `{language}` holds a Japanese language name: no space before or after it (「{language}をダウンロード」).

## 6. Decisions

- 2026-11-27: document → 文書 (Word), not ドキュメント.
- 2026-11-27: Save → 上書き保存 for the command with Ctrl+S; 保存 for the bare dialog button.
- 2026-11-27: Mode names: Word (kept), インライン, シンプル, 閲覧 (Word's 閲覧モード).
- 2026-11-27: Views group → 表示モード, Show group → 表示, so the two View groups are not both 表示.
- 2026-11-27: caption → 図表番号, bibliography → 文献目録, citation → 引用文献 (Word's References tab).
- 2026-11-27: pane: side pane → 作業ウィンドウ, a half of a split → ウィンドウ枠.
- 2026-11-27: Markooj's optional Features → 追加機能; `Features@@markdown` → 使われている機能.
- 2026-11-27: parentheses: full-width （） around Japanese, half-width ( ) after a space around Latin-only content and shortcuts.
- 2026-11-28 (review): the terms in 5.12 added; formality → フォーマル / 標準 / カジュアル; live preview → リアルタイム プレビュー; a document's author → 著者 (an add-in's author stays 作成者); other → 他の, already → 既に (one spelling each); Word frequency → 単語の出現頻度.
- 2026-11-28 (review): style gallery samples stay Latin (Aa 本文, 「Aa」) because the heading samples are a fixed “Aa” in the code.
- 2026-11-28 (review): open issue for developers: the key `Columns` is both Layout → Columns (段組み) and the column-count field of the Insert Table dialog (should be 列数). It needs a separate key such as `Columns@@table size`.

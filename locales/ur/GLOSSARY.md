# Urdu (اردو) glossary for Markooj

Code `ur` · right to left · plural categories `one`, `other` · numbers `ur-PK` (Western digits) · the translation rules are in [docs/I18N.md](../../docs/I18N.md).

Every translator of the five group files (`shell`, `app`, `editors`, `language`, `system`) follows this page. To change a
term, change it here first, then everywhere it appears. When a term is missing, choose a word in the same spirit, use it the
same way in every file, and add a line under "Decisions".

The aim: the interface reads like the Urdu language pack of Microsoft Office, written by a careful Pakistani writer. Never
word-for-word. A student who uses Word in Urdu (or in English, and speaks Urdu) should find every label where they expect it
and every word familiar.

## 1. Voice and register

- **Address the user as آپ, always.** Never تم or تو. Possessives: آپ کی دستاویز، آپ کا متن، آپ کی ترتیبات.
- **Commands and buttons: polite imperative ending in ـیں.** محفوظ کریں، کھولیں، بند کریں، داخل کریں، حذف کریں، دبائیں،
  دیکھیں. Never the bare stem (کھولو، کرو), never the infinitive (کھولنا، محفوظ کرنا) on a button.
- **Prefer short, plain verbs.** کھولیں not کھولنے کا عمل انجام دیں؛ ہٹائیں not ختم کر دیں؛ چلائیں not عمل درآمد کریں.
- **Tab names, group names, dialog titles, Options section titles and headings are nouns** (فونٹ، پیراگراف، حوالہ جات،
  ظاہری شکل), except where Office itself uses a verb (the Insert tab is داخل کریں, as in Office).
- **Check boxes and switches describe what is on**, as a short verb phrase: رولر دکھائیں، ہجے کی جانچ کریں.
- **Status words are short states**: محفوظ شدہ، ترمیم شدہ، تیار، صرف پڑھنے کے لیے.
- **Progress text ends with …**: لوڈ ہو رہا ہے…، ڈاؤن لوڈ ہو رہا ہے…، جانچ ہو رہی ہے…
- **Messages stay solution-first, exactly as in English.** Put what the person can do first, then what happened, then what
  still works. Do not turn the order around because Urdu grammar is SOV: keep the remedy in the first sentence.
- **Calm, friendly, not servile.** No براہ کرم at the start of every message (use it at most where English says "please").
  No معذرت unless English apologizes. No exclamation marks unless English has one.
- **Borrowed words where Pakistanis say them** (فائل، فولڈر، فونٹ، ٹیبل، لنک، کالم، سیل، ڈاؤن لوڈ، انسٹال، اسکرین شاٹ،
  ایڈ اِن، میکرو). **Urdu words where they are everyday Urdu** (دستاویز، صفحہ، سرخی، تلاش، مدد، اختیارات، ترتیبات، تبصرہ،
  حوالہ، مساوات، ہجے). Never invent Persianized coinages that no Pakistani reader would recognize.
- **Gender agreement.** A placeholder has no gender, so build the sentence around a known noun, or use a form that does not
  agree. Write «فائل “{name}” محفوظ ہو گئی۔» (فائل is feminine) rather than «“{name}” محفوظ ہو گیا۔». When the English gives
  only the name, treat `{feature}` and `{tool}` as masculine (فیچر، پروگرام) and `{name}` of a document as feminine
  (دستاویز). See the gender column in section 7.

**Examples**

| English | Urdu |
| --- | --- |
| Check your internet connection, then try again. | اپنا انٹرنیٹ کنکشن چیک کریں، پھر دوبارہ کوشش کریں۔ |
| Close the file in the other program, then try again. | دوسرے پروگرام میں فائل بند کریں، پھر دوبارہ کوشش کریں۔ |
| {feature} was not installed. You can install it any time from File → Options → Features. | {feature} انسٹال نہیں ہوا۔ آپ اسے کسی بھی وقت فائل ← اختیارات ← فیچرز سے انسٹال کر سکتے ہیں۔ |
| Save changes to “{name}”? | کیا “{name}” میں کی گئی تبدیلیاں محفوظ کریں؟ |
| Copy some text first, then paste it as plain text. The clipboard has no text right now. | پہلے کچھ متن کاپی کریں، پھر اسے سادہ متن کے طور پر چسپاں کریں۔ کلپ بورڈ میں ابھی کوئی متن نہیں ہے۔ |

## 2. Spelling, punctuation and numbers

- **Urdu letters, not Arabic look-alikes**: ی (U+06CC) not ي, ک (U+06A9) not ك, ہ (U+06C1) for the ordinary he, ھ (U+06BE)
  only in aspirates (کھولیں، دیکھیں، رکھیں، چھپائیں), ے (U+06D2) at word ends (نئے، کے), ۃ only in fixed words.
- **Punctuation**: full stop ۔ (U+06D4), comma ، (U+060C), question mark ؟ (U+061F), semicolon ؛ (U+061B). The colon stays
  `:` (it is the same in Urdu). Parentheses `( )` are typed in normal logical order; the browser mirrors them.
- **Quotation marks**: keep the English “ ” in the same logical order around the text: “{name}”. Do not swap them and do
  not use « ».
- **Digits are Western (0–9)**, as in Pakistani software. Never type ۰۱۲۳ in the interface. `{count}` is formatted by Markooj
  (12,345). Keep `%` after the number: `{percent}%`, `100%`.
- **Units** in labels: `pt` → پوائنٹ; `in` → انچ; `cm` → سینٹی میٹر; `min` → منٹ. Keep SI symbols inside formulas (g, s, m).
- **Compound borrowed words are written with a space**, not joined: ڈاؤن لوڈ، اپ ڈیٹ، بیک اپ، شارٹ کٹ، اسکرین شاٹ،
  لے آؤٹ، کی بورڈ، اسٹیٹس بار، اَن انسٹال. Write اِن with a zer where it would otherwise be misread: ایڈ اِن، اِن لائن،
  زوم اِن.
- **Izafat**: write it without the zer (فہرست مضامین، تعداد الفاظ is avoided in favor of الفاظ کی تعداد). Prefer the کا / کی
  construction when it is just as short.
- **Plain spaces only.** Do not add zero-width characters (ZWNJ, ZWJ) or directional marks to catalog text.

### Plurals (`one`, `other`)

Urdu needs both forms. `one` is used for 1 only; `other` for 0, 2, 3 … Both forms keep `{count}`.

| English key | one | other |
| --- | --- | --- |
| {count} files | {count} فائل | {count} فائلیں |
| {count} pages | {count} صفحہ | {count} صفحات |
| {count} words | {count} لفظ | {count} الفاظ |
| {count} days | {count} دن | {count} دن |
| {count} minutes ago | {count} منٹ پہلے | {count} منٹ پہلے |
| {count} tables | {count} ٹیبل | {count} ٹیبل |
| {count} equations | {count} مساوات | {count} مساوات |
| {count} figures | {count} شکل | {count} اشکال |
| {count} comments | {count} تبصرہ | {count} تبصرے |
| {count} references | {count} حوالہ | {count} حوالے |
| {count} issues | {count} مسئلہ | {count} مسائل |
| {count} pictures | {count} تصویر | {count} تصاویر |
| {count} documents | {count} دستاویز | {count} دستاویزات |
| {count} items | {count} آئٹم | {count} آئٹمز |
| {count} matches | {count} نتیجہ | {count} نتائج |

The verb agrees with the form: «{count} تبصرہ حذف ہو گیا» / «{count} تبصرے حذف ہو گئے».

## 3. Placeholders, keys, shortcuts and paths

- **Placeholders** `{name}` stay exactly as written (same spelling, same braces) and may move anywhere. Put Urdu postpositions
  after them: «{name} کو کھولیں»، «{tool} کی ضرورت ہے»، «{count} دن کے لیے».
- **HTML tags** (`<b>`, `<kbd>`, `<code>`) stay as they are, around the same words.
- **Key names stay in Latin letters**: Ctrl, Shift, Alt, Enter, Esc, Tab, Space, Page Down, F1 … F12, and combinations such as
  Ctrl+Shift+V. Never write کنٹرول or اینٹر for them.
- **Shortcut in a label**: keep the English pattern, label first: «محفوظ کریں (Ctrl+S)»، «بند کریں (Esc)».
- **Shortcut in a sentence**: the key comes first, then the Urdu verb: «Ctrl+Z دبائیں»، «Alt+Q سے کمانڈ تلاش کھولیں».
  "Press" = دبائیں; "click" = کلک کریں; "right-click" = رائٹ کلک کریں; "double-click" = ڈبل کلک کریں; "drag" = گھسیٹیں;
  "point to" = ماؤس لے جائیں; "type" = ٹائپ کریں (لکھیں when it means "write").
- **Menu paths use ←, not →.** In right-to-left text an arrow pointing left follows the reading direction:
  `File → Options → Language` → «فائل ← اختیارات ← زبان». The same for ribbon paths: «ہوم ← اعراب». Keep the spaces around ←.
  (Arrow *keys* in shortcuts stay as written.)
- **Brand and format names** stay in Latin letters: Markooj, Word, Excel, PowerPoint, Pandoc, KaTeX, Mermaid, Markdown, LaTeX,
  BibTeX, GitHub, Python, JavaScript, PDF, DOCX, EPUB, HTML, Zotero, Mendeley, Overleaf. Urdu postpositions follow them:
  «PDF کے طور پر ایکسپورٹ کریں»، «Word میں کھولیں».
- **"Word" the product vs. "word" the unit.** `Word mode`, `Copy for Word/Excel`, `Word document` keep the Latin "Word". A
  word count is الفاظ: `Word count` → الفاظ کی تعداد, `Word target` → الفاظ کا ہدف.

## 4. The ellipsis "…"

Keep "…" (one character, U+2026) at the end of every label that has it, after the Urdu words, with no space:
«بطور محفوظ کریں…»، «پرنٹ کریں…»، «براؤز کریں…»، «زوم…». Never add "…" where English has none, and never write three dots.
In right-to-left text the ellipsis appears at the left end, which is correct.

## 5. Editing modes (decision)

The four modes sit on a small four-part switch in the title bar; keep the short names short (about 8 characters).

| English | Urdu (switch) | Urdu (full name) | Note |
| --- | --- | --- | --- |
| Word mode | Word | Word موڈ | Named after Microsoft Word: keep "Word" in Latin letters. |
| Inline@@editing mode | اِن لائن | اِن لائن موڈ | Live Markdown. Transliterated: a technical name, and سطری would be obscure. |
| Simple@@editing mode | سادہ | سادہ موڈ | Plain Markdown text. |
| Read@@editing mode | مطالعہ | مطالعہ موڈ | Reading only, as Word's Read Mode. |
| Editing mode | ترمیم کا موڈ | | |
| Inline (equation, not the mode) | سطر کے اندر | | An equation inside the line. Display (own line) = الگ سطر میں. |

## 6. Ribbon tabs and groups

| English | Urdu | Note |
| --- | --- | --- |
| File | فائل | Tab and the full-window File page. |
| Home | ہوم | As in Office Urdu. |
| Insert (tab) | داخل کریں | As in Office Urdu; the verb is the same word. |
| Layout | لے آؤٹ | |
| References | حوالہ جات | |
| Review | جائزہ | |
| View | منظر | The verb "view" (View license) is دیکھیں. |
| Developer | ڈیولپر | |
| Add-ins | ایڈ اِنز | |
| Help | مدد | |
| Table Design | ٹیبل ڈیزائن | Contextual tab. |
| Table Layout | ٹیبل لے آؤٹ | Contextual tab. |
| Table Tools | ٹیبل ٹولز | Title above the contextual tabs. |
| Clipboard | کلپ بورڈ | Group (Home). |
| Font | فونٹ | Group (Home). |
| Paragraph | پیراگراف | Group (Home). |
| Styles | اسٹائلز | Group (Home). One style = اسٹائل. |
| Editing | ترمیم | Group (Home). |
| Direction | سمت | Group (Home): text direction. |
| Aarab | اعراب | Group (Home). See section 7.6. |
| Blocks | بلاکس | Group (Insert). |
| Captions | کیپشنز | Group (Insert). |
| Illustrations | بصری مواد | Group (Insert): pictures, diagrams, charts. |
| Links & pages | لنکس اور صفحات | Group (Insert). |
| Notes & sources | نوٹس اور مآخذ | Group (Insert). |
| Pictures | تصاویر | Group (Insert). |
| Text | متن | Group (Insert). |
| Document theme | دستاویز کی تھیم | Group (Layout). |
| Page setup | صفحہ سیٹ اپ | Group (Layout) and dialog. |
| Spacing | وقفہ | Group (Layout). |
| Footnotes | فٹ نوٹس | Group (References). |
| Table of contents | فہرست مضامین | Group (References) and the inserted block. |
| Proofing | پروفنگ | Group (Review), as in Office. |
| Versions | ورژنز | Group (Review). |
| Writing@@ribbon group | تحریر | Group (View, Review): typewriter, goals, sprint. |
| Commands | کمانڈز | Group (View). |
| Keyboard | کی بورڈ | Group (View). |
| Mode@@ribbon group | موڈ | Group (View). |
| Show@@ribbon group | دکھائیں | Group (View), as Word's "Show". |
| Tables | ٹیبلز | Group (View) and Options section. |
| Theme | تھیم | Group (View). |
| Views | مناظر | Group (View). |
| Window@@ribbon group | ونڈو | Group (View). |
| Zoom | زوم | Group (View) and command. |
| Math@@ribbon group | ریاضی | Group (Developer). |
| Code@@ribbon group | کوڈ | Group (Developer). |
| My macros | میرے میکروز | Group (Developer). |
| Store@@ribbon group | اسٹور | Group (Add-ins): the Add-in Store. |
| About | تعارف | Group (Help). "About Markooj" = Markooj کے بارے میں. |
| Feedback | رائے | Group (Help). |
| Welcome | خوش آمدید | Help button, status bar chip, the Welcome screen. |
| Table Style Options | ٹیبل اسٹائل کے اختیارات | Group (Table Design). |
| Table Styles | ٹیبل اسٹائلز | Group (Table Design). |
| Convert | تبدیل کریں | Group (Table Design). |
| Rows & Columns | قطاریں اور کالم | Group (Table Layout). |
| Cell Size | سیل کا سائز | Group (Table Layout). |
| Alignment | سیدھ | Group (Table Layout). |
| Data | ڈیٹا | Group (Table Layout). |

## 7. Terms

Gender (m / f) is given for nouns that verbs must agree with.

### 7.1 Common commands and buttons

| English | Urdu | Note |
| --- | --- | --- |
| Save | محفوظ کریں | |
| Save As / Save as… | بطور محفوظ کریں / بطور محفوظ کریں… | As in Office Urdu. |
| Save all | سب محفوظ کریں | |
| Save a copy | کاپی محفوظ کریں | |
| Don’t Save | محفوظ نہ کریں | Button in the close dialog. |
| Open | کھولیں | Open@@adjective (a state) = کھلی ہوئی. |
| Open recent | حالیہ کھولیں | |
| Close | بند کریں | |
| Close anyway | پھر بھی بند کریں | |
| New | نیا | New document = نئی دستاویز. |
| Undo | کالعدم کریں | As in Office Urdu. "Undo (Ctrl+Z) brings them back" = Ctrl+Z سے واپس آ جاتی ہیں. |
| Redo | دوبارہ کریں | |
| Repeat | دہرائیں | |
| Cut | کاٹیں | |
| Copy | کاپی کریں | "Copied." = کاپی ہو گیا۔ |
| Paste | چسپاں کریں | As in Office Urdu. |
| Paste as plain text | سادہ متن کے طور پر چسپاں کریں | |
| Select / Choose | منتخب کریں | |
| Select all | سب منتخب کریں | |
| Find | تلاش کریں | Noun "search" = تلاش. |
| Find next / Find previous | اگلا تلاش کریں / پچھلا تلاش کریں | |
| Replace | بدلیں | |
| Replace all | سب بدلیں | |
| Find and replace | تلاش کریں اور بدلیں | |
| Insert | داخل کریں | |
| Delete | حذف کریں | Permanent removal. |
| Remove | ہٹائیں | Take out of a list or document. |
| Add | شامل کریں | |
| Edit | ترمیم کریں | Edit@@leave read mode = ترمیم. |
| Rename | نام بدلیں | |
| Change | بدلیں | Spelling dialog: "Change to" = اس سے بدلیں. |
| Convert | تبدیل کریں | "Convert to Text" = متن میں تبدیل کریں. |
| Options | اختیارات | File → Options. |
| Settings | ترتیبات | Only where English says settings. |
| Properties | خصوصیات | Document properties = دستاویز کی خصوصیات. |
| Help | مدد | |
| Cancel | منسوخ کریں | |
| OK | ٹھیک ہے | |
| Apply | لاگو کریں | |
| Reset | ری سیٹ کریں | |
| Done | ہو گیا | |
| Continue | جاری رکھیں | |
| Next / Previous | اگلا / پچھلا | |
| Back | واپس | |
| Skip | چھوڑیں | |
| Not now | ابھی نہیں | |
| Later | بعد میں | |
| Install | انسٹال کریں | Installed = انسٹال شدہ. |
| Uninstall | اَن انسٹال کریں | |
| Download | ڈاؤن لوڈ کریں | Noun = ڈاؤن لوڈ (m). |
| Update | اپ ڈیٹ کریں | Noun = اپ ڈیٹ (f). Check for updates = اپ ڈیٹس دیکھیں. |
| Reload | دوبارہ لوڈ کریں | |
| Restart | دوبارہ شروع کریں | |
| Try again | دوبارہ کوشش کریں | |
| Check again | دوبارہ جانچیں | |
| Details | تفصیلات | |
| Copy details | تفصیلات کاپی کریں | |
| Learn more | مزید جانیں | |
| Don’t show again | دوبارہ نہ دکھائیں | |
| Show / Hide | دکھائیں / چھپائیں | |
| Turn on / Turn off | آن کریں / آف کریں | Switch states On@@switch / Off@@switch = آن / آف. |
| Browse… | براؤز کریں… | |
| Print / Print… | پرنٹ کریں / پرنٹ کریں… | |
| Print preview / Preview | پرنٹ پیش منظر / پیش منظر | |
| Export / Export… | ایکسپورٹ کریں / ایکسپورٹ کریں… | Noun = ایکسپورٹ (f). |
| Import | امپورٹ کریں | |
| Accept | قبول کریں | |
| Ignore / Ignore All | نظر انداز کریں / سب نظر انداز کریں | |
| Dismiss | ہٹائیں | |
| Run | چلائیں | |
| Record | ریکارڈ کریں | |
| Stop | روکیں | |
| Sort | ترتیب دیں | Ascending / Descending = صعودی / نزولی. |
| Pin / Unpin | پن کریں / پن ہٹائیں | |
| Report a problem | مسئلہ رپورٹ کریں | |
| Go to | پر جائیں | "Go to page…" = صفحے پر جائیں… |

### 7.2 Window and interface

| English | Urdu | Note |
| --- | --- | --- |
| ribbon | ربن (m) | |
| tab (ribbon tab) | ٹیب (m) | "the Insert tab" = داخل کریں ٹیب. |
| tab (document tab) | دستاویز ٹیب (m) | "Document tabs" = دستاویز ٹیبز. Tab key = Tab. |
| group (ribbon group) | گروپ (m) | |
| command | کمانڈ (f) | |
| command search (palette) | کمانڈ تلاش (f) | Alt+Q. "Search or type a command" = تلاش کریں یا کمانڈ لکھیں. |
| Quick access | فوری رسائی | |
| status bar | اسٹیٹس بار (f) | |
| window | ونڈو (f) | New Window = نئی ونڈو. |
| pane | پین (m) | Outline pane = خاکے کا پین. Second pane = دوسرا پین. |
| dialog | ڈائیلاگ (m) | |
| menu | مینو (m) | |
| button | بٹن (m) | |
| ScreenTip | اسکرین ٹپ (f) | |
| KeyTips | کی ٹپس | Letters shown on the ribbon after Alt. |
| keyboard shortcut | کی بورڈ شارٹ کٹ (m) | Plural شارٹ کٹس. |
| theme | تھیم (f) | Light / Dark / System@@theme = روشن / تاریک / سسٹم. Match system = سسٹم کے مطابق. |
| zoom | زوم (m) | Zoom in / Zoom out = زوم اِن / زوم آؤٹ. Fit page width = صفحے کی چوڑائی کے مطابق. |
| Full-screen mode | فل اسکرین موڈ | |
| Focus | فوکس | The distraction-free view. Leave focus = فوکس سے باہر آئیں. |
| Print layout | پرنٹ لے آؤٹ | View. |
| Web layout | ویب لے آؤٹ | View. |
| Read only | صرف پڑھنے کے لیے | Title bar state. |
| Saved / Edited / Not saved yet | محفوظ شدہ / ترمیم شدہ / ابھی محفوظ نہیں | Title bar states. |
| outline | خاکہ (m) | The heading list at the side. |
| ruler | رولر (m) | Ruler units = رولر کی اکائیاں. |
| guide (ruler guide) | رہنما لکیر (f) | Plural رہنما لکیریں. Horizontal / Vertical = افقی / عمودی. |
| guided tour / tour | ٹور (m) | "Take the tour" = ٹور دیکھیں. |
| tutorial | ٹیوٹوریل (m) | |
| Welcome screen | خوش آمدید اسکرین (f) | |
| Split | تقسیم کریں | View → Window, as in Word. Remove Split = تقسیم ختم کریں. split (noun) = تقسیم (f). |
| side by side | ساتھ ساتھ | View Side by Side = ساتھ ساتھ دیکھیں. Arrange All = سب ترتیب دیں. |
| Synchronous Scrolling | ہم وقت اسکرولنگ | |
| Switch Windows | ونڈو بدلیں | |
| gridlines | گرڈ لائنز | View Gridlines = گرڈ لائنز دیکھیں. |
| formatting marks | فارمیٹنگ نشانات | |
| interface | انٹرفیس (m) | Menus and buttons. |
| screenshot | اسکرین شاٹ (m) | |

### 7.3 Document and text

| English | Urdu | Note |
| --- | --- | --- |
| document | دستاویز (f) | Plural دستاویزات. Blank document = خالی دستاویز. Untitled = بے عنوان. |
| page | صفحہ (m) | Plural صفحات. "Page {current} of {total}" = صفحہ {current} از {total}. |
| paragraph | پیراگراف (m) | Same in plural. |
| line | سطر (f) | Plural سطریں. |
| sentence | جملہ (m) | Plural جملے. |
| word (unit) | لفظ (m) | Plural الفاظ. |
| character | حرف (m) | Plural حروف. |
| text | متن (m) | Plain text = سادہ متن. |
| selection | انتخاب (m) | "the selected text" = منتخب متن. |
| heading | سرخی (f) | Plural سرخیاں. Heading 1 = سرخی 1. |
| title / subtitle | عنوان / ذیلی عنوان | |
| list | فہرست (f) | Bullets = بلٹس. Numbering = نمبرنگ. Numbered list = نمبر والی فہرست. Checklist = چیک لسٹ. |
| table | ٹیبل (m) | Plural ٹیبلز (with a number: {count} ٹیبل). Insert Table = ٹیبل داخل کریں. |
| cell | سیل (m) | Merged cells = ضم شدہ سیل. |
| row | قطار (f) | Plural قطاریں. Header Row = ہیڈر قطار. |
| column | کالم (m) | Table and page columns. |
| caption | کیپشن (m) | Insert Caption = کیپشن داخل کریں. |
| figure | شکل (f) | Plural اشکال. Label word in "Figure 1" = شکل 1. |
| picture | تصویر (f) | Plural تصاویر. |
| diagram | ڈایاگرام (m) | |
| chart | چارٹ (m) | |
| equation | مساوات (f) | Same in plural. Equation editor = مساوات ایڈیٹر. |
| math | ریاضی (f) | Inline math = سطری ریاضی. |
| citation | حوالہ (m) | An in-text citation. Plural حوالے. Cite / Insert citation = حوالہ دیں / حوالہ داخل کریں. |
| reference (a source in the library) | ماخذ (m) | Plural مآخذ. Citation library = حوالوں کی لائبریری. |
| References (tab) | حوالہ جات | |
| bibliography | کتابیات (f) | |
| footnote | فٹ نوٹ (m) | Plural فٹ نوٹس. Not حاشیہ (that is a margin). |
| comment | تبصرہ (m) | Plural تبصرے. New comment = نیا تبصرہ. |
| hidden note | پوشیدہ نوٹ (m) | A %%note%% that never prints. |
| cross-reference | کراس ریفرنس (m) | Plural کراس ریفرنسز. |
| label (of a numbered item) | لیبل (m) | "eq:" style labels stay as written. |
| numbering | نمبرنگ (f) | Update numbers = نمبر اپ ڈیٹ کریں. |
| link / hyperlink | لنک / ہائپر لنک (m) | |
| page break | صفحہ وقفہ (m) | |
| symbol | علامت (f) | Plural علامات. |
| quote | اقتباس (m) | |
| code / code block | کوڈ / کوڈ بلاک (m) | |
| callout | کال آؤٹ (m) | The colored note, tip or warning box. |
| divider | تقسیمی لکیر (f) | |
| front matter | فرنٹ میٹر (m) | The settings block at the top of a Markdown file. |
| Markdown flavor | Markdown کی قسم (f) | Detected flavor = پہچانی گئی قسم. |
| template | ٹیمپلیٹ (m) | New from template = ٹیمپلیٹ سے نیا. |
| style | اسٹائل (m) | Normal (style) = عام. |
| font | فونٹ (m) | Font size = فونٹ سائز. Font color = فونٹ کا رنگ. Grow / Shrink Font = فونٹ بڑا کریں / چھوٹا کریں. |
| Bold / Italic / Underline | جلی / ترچھا / خط کشیدہ | As in Office Urdu. |
| Strikethrough | قلم زد | |
| Superscript / Subscript | سپر اسکرپٹ / سب اسکرپٹ | |
| Highlight | نمایاں کریں | Text highlight. |
| Change case | کیس بدلیں | Affects Latin letters only. Match case (Find) = کیس ملائیں. |
| Clear formatting | فارمیٹنگ صاف کریں | |
| Format painter | فارمیٹ پینٹر | |
| formatting | فارمیٹنگ (f) | |
| Align left / Center / Align right / Justify | بائیں سیدھ / درمیان میں / دائیں سیدھ / دونوں طرف سیدھ | |
| indent | انڈینٹ (m) | Increase / Decrease indent = انڈینٹ بڑھائیں / گھٹائیں. |
| line spacing | سطری وقفہ (m) | Paragraph spacing = پیراگراف کا وقفہ. |
| margins | حاشیے | Page margins. Normal@@margins = عام. |
| page size | صفحے کا سائز | Letter / A4 stay as written. |
| Track changes | تبدیلیاں ٹریک کریں | |
| change (an edit) | تبدیلی (f) | Plural تبدیلیاں. Unsaved changes = غیر محفوظ تبدیلیاں. |
| version | ورژن (m) | |
| compare | موازنہ کریں | |
| document statistics | دستاویز کے اعداد و شمار | Word count = الفاظ کی تعداد. Reading time = پڑھنے کا وقت. |
| readability | پڑھنے میں آسانی (f) | Reading ease = پڑھنے میں آسانی کا اسکور. |

### 7.4 Writing and language features

| English | Urdu | Note |
| --- | --- | --- |
| Writing Assistant | تحریری معاون (m) | The side pane with suggestions. |
| spelling | ہجے | Spelling list = ہجے کی فہرست. |
| grammar | گرامر (f) | Spelling and Grammar = ہجے اور گرامر. |
| proofing | پروفنگ (f) | Proofing language = پروفنگ کی زبان. |
| suggestion | تجویز (f) | Plural تجاویز. |
| issue (a writing issue) | مسئلہ (m) | Plural مسائل. No issues = کوئی مسئلہ نہیں. |
| rule | قاعدہ (m) | Ignore Rule = قاعدہ نظر انداز کریں. |
| dictionary | لغت (f) | Add to Dictionary = لغت میں شامل کریں. My dictionary = میری لغت. |
| thesaurus | لغت مترادفات (f) | Synonyms = مترادفات. Antonyms = متضاد الفاظ. |
| writing goals / goal | تحریری اہداف / ہدف (m) | Daily goal = روزانہ ہدف. Word target = الفاظ کا ہدف. |
| writing sprint | تحریری اسپرنٹ (m) | A timed writing session. |
| streak | لگاتار دن | "{count}-day streak" = لگاتار {count} دن. |
| writing score | تحریری اسکور (m) | |
| language pack | زبان پیک (m) | Plural زبان پیکس. |
| interface language | انٹرفیس کی زبان | |
| document language | دستاویز کی زبان | |
| language | زبان (f) | |
| right to left / left to right | دائیں سے بائیں / بائیں سے دائیں | |
| direction | سمت (f) | Page direction = صفحے کی سمت. |
| keyboard (typing layout) | کی بورڈ (m) | Switch keyboard = کی بورڈ بدلیں. |
| layout (of a keyboard) | لے آؤٹ (m) | Urdu Phonetic (CRULP) = اردو فونیٹک (CRULP). |
| on-screen keyboard | آن اسکرین کی بورڈ (m) | |
| aarab / harakat | اعراب | The native term for Urdu and Arabic vowel marks. Remove Aarab = اعراب ہٹائیں. Hide Aarab = اعراب چھپائیں. |
| zabar, zer, pesh | زبر، زیر، پیش | The Arabic names in brackets: fatha = فتحہ, kasra = کسرہ, damma = ضمہ. |
| shadd, jazm | شد، جزم | shadda = تشدید, sukun = سکون. |
| tanween zabar / zer / pesh | دو زبر / دو زیر / دو پیش | |
| khari zabar, khari zer, ulta pesh | کھڑا زبر، کھڑی زیر، الٹا پیش | |
| noon ghunna mark | نون غنہ کی علامت | |
| hamza above | اوپر ہمزہ | |
| half space (ZWNJ) | ہاف اسپیس (ZWNJ) | The term Urdu typists use. |
| joiner (ZWJ) | جوائنر (ZWJ) | |
| Hijri / Gregorian | ہجری / عیسوی | |
| Date & time | تاریخ اور وقت | Today = آج. |
| slash commands | سلیش کمانڈز | |
| multiple cursors | متعدد کرسر | cursor = کرسر (m). |

Language names (in lists): English (US) = انگریزی (امریکی), English (UK) = انگریزی (برطانوی), Urdu = اردو, Arabic = عربی,
Persian = فارسی, Punjabi (Shahmukhi) = پنجابی (شاہ مکھی), Roman Urdu = رومن اردو, Hindi = ہندی, Hebrew = عبرانی,
Chinese = چینی, Japanese = جاپانی, Korean = کوریائی, German = جرمن, French = فرانسیسی, Spanish = ہسپانوی, Italian = اطالوی,
Portuguese = پرتگالی, Dutch = ڈچ, Turkish = ترکی, Russian = روسی, Swedish = سویڈش. A language name written in its own script
(اردو، العربية) stays as it is.

Hijri months: محرم، صفر، ربیع الاول، ربیع الثانی، جمادی الاول، جمادی الثانی، رجب، شعبان، رمضان، شوال، ذوالقعدہ، ذوالحجہ.

### 7.5 Add-ins, macros, features, developer

| English | Urdu | Note |
| --- | --- | --- |
| add-in | ایڈ اِن (m) | Plural ایڈ اِنز. Manage add-ins = ایڈ اِنز کا انتظام. |
| Add-in Store | ایڈ اِن اسٹور (m) | |
| macro | میکرو (m) | Plural میکروز. Macro editor = میکرو ایڈیٹر. Record macro = میکرو ریکارڈ کریں. |
| feature (optional download) | فیچر (m) | Plural فیچرز. File → Options → Features = فائل ← اختیارات ← فیچرز. Features@@markdown (math, tables in a document) = Markdown خصوصیات. |
| feature download | فیچر ڈاؤن لوڈ (m) | |
| helper tool / tool | ٹول (m) / پروگرام (m) | "{tool} is ready" = {tool} تیار ہے. |
| console | کنسول (m) | Python console = Python کنسول. |
| developer | ڈیولپر | |
| repository | ریپوزٹری (f) | |
| author | مصنف (m) | |
| category | زمرہ (m) | Add-in categories: All = سب, Productivity = پیداواری, Research = تحقیق, Fun = تفریح. |
| version | ورژن (m) | |
| license | لائسنس (m) | Third-party notices = تھرڈ پارٹی نوٹسز. Credits = اعترافات. |
| privacy | رازداری (f) | |
| feedback | رائے (f) | |

### 7.6 Files and saving

| English | Urdu | Note |
| --- | --- | --- |
| file | فائل (f) | Plural فائلیں. |
| folder | فولڈر (m) | Plural فولڈرز. Open folder = فولڈر کھولیں. Show in folder = فولڈر میں دکھائیں. |
| path | پاتھ (m) | Copy path = پاتھ کاپی کریں. |
| export | ایکسپورٹ کریں | Export as PDF = PDF کے طور پر ایکسپورٹ کریں. |
| import | امپورٹ کریں | |
| PDF / Word document / web page | PDF / Word دستاویز / ویب صفحہ | |
| Recover (File page) | بازیافت | As Word's "Recover Unsaved Documents". Recover unsaved… = غیر محفوظ متن بازیافت کریں… |
| recovery copy | بازیافتی کاپی (f) | Recovery folder = بازیافت فولڈر. Recovery (Options section) = بازیافت. |
| backup | بیک اپ (m) | |
| autosave | خودکار محفوظ کاری (f) | Auto- features start with خودکار: AutoCorrect = خودکار تصحیح. |
| recent / recent files | حالیہ / حالیہ فائلیں | |
| info | معلومات | File → Info. |
| print | پرنٹ (m) | Printer = پرنٹر. |
| clipboard | کلپ بورڈ (m) | |
| download (noun) | ڈاؤن لوڈ (m) | Downloading… = ڈاؤن لوڈ ہو رہا ہے… |
| size (of a file) | سائز (m) | |
| viewer | ویوور (m) | The page viewer for PDF and DjVu files. Edit as text = متن کے طور پر ترمیم کریں. |
| portable copy | پورٹیبل کاپی | |
| internet connection | انٹرنیٹ کنکشن (m) | |
| computer / program / browser | کمپیوٹر / پروگرام / براؤزر (m) | |
| error / warning / tip / note | خرابی / انتباہ / مشورہ / نوٹ | Callout kinds: Important = اہم, Caution = احتیاط. |
| ready / loading… / checking… | تیار / لوڈ ہو رہا ہے… / جانچ ہو رہی ہے… | |

## 8. Short labels

- Ribbon buttons, switch labels and status bar items must stay as short as the English. If the full Urdu is too long,
  drop کریں only when Office Urdu does the same for that label, otherwise choose a shorter verb.
- The check script warns when a translation is more than twice as long as a short English label; fix those.
- `@same` (values identical to English) is allowed only for brand and format names (Markooj, Word, PDF, LaTeX …).

## Decisions and open questions

- 2026-11-27: Glossary written before the five group files were translated. Base: Microsoft Office Urdu terms where they are in
  common use, borrowed English words (in Urdu letters) where Pakistani Word users say them.
- 2026-11-27: Menu and ribbon paths use ← instead of →, so they read in the right-to-left direction.
- 2026-11-27: Mode names: Word (kept), اِن لائن (transliterated), سادہ, مطالعہ.
- 2026-11-27: Insert tab = داخل کریں (as in Office Urdu); the Insert verb is the same word.
- 2026-11-27: footnote = فٹ نوٹ, because حاشیہ is needed for page margins (حاشیے).
- 2026-11-27: citation (in the text) = حوالہ; a source in the library = ماخذ; the tab = حوالہ جات.
- 2026-11-27: Recover / recovery = بازیافت everywhere.
- 2026-11-27: Paste = چسپاں کریں and Undo = کالعدم کریں (Office Urdu); Export = ایکسپورٹ کریں (the word students use).
- Open: native speakers may prefer ٹیبل or جدول, and ایکسپورٹ or برآمد; change here first if the review says so.

## 9. Terms settled in the review (2026-11-28)

The five translators added these while translating; the reviewer chose one form for each and applied it in every file.

| English | Urdu | Notes |
| --- | --- | --- |
| default / by default | ڈیفالٹ / بطور ڈیفالٹ | {font} (default) = {font} (ڈیفالٹ). Default value (macro code) = ڈیفالٹ ویلیو. |
| built in / bundled | پہلے سے شامل / ساتھ شامل | Bundled tools = ساتھ شامل ٹولز. |
| title bar / body text | ٹائٹل بار / مرکزی متن | |
| Promote / Demote | درجہ بڑھائیں / درجہ گھٹائیں | |
| Change Case items | جملے کا کیس، چھوٹے حروف، بڑے حروف، ہر لفظ کا پہلا حرف بڑا، الٹا کیس، عنوان کا کیس | Urdu has no capitals: name the effect. All caps = سب بڑے حروف, Small caps = اسمال کیپس. |
| Single / Double line spacing | ایک گنا / دو گنا سطری وقفہ | |
| Go To (Ctrl+G) | مقام پر جائیں | Go to heading / page = سرخی / صفحے پر جائیں. |
| Center (alignment) | درمیانی سیدھ | Matches بائیں سیدھ، دائیں سیدھ، دونوں طرف سیدھ. |
| Markdown flavor | Markdown کی قسم | Detected flavor = پہچانی گئی قسم; Render as = قسم کے مطابق پڑھیں. |
| Markdown features (Info card) | Markdown عناصر | Not خصوصیات (that is Properties) and not فیچرز (Markooj's optional Features). |
| property / value | خصوصیت (f) / قدر (f) | Properties = خصوصیات. |
| Smart quotes / quotation marks | اسمارٹ کوٹس / واوین | Close brackets and quotes = بریکٹس اور واوین. |
| brackets | بریکٹ (m), بریکٹس | In the equation palettes the textbook names: گول / چوکور / منجھلی / زاویائی قوسین. |
| key (on the keyboard) | کلید (f), کلیدیں | Not کی (looks like the postposition). Arrow keys = ایرو کیز. |
| Navigate (command group) | نیویگیشن | |
| thesis / theorem | تھیسس / تھیورم | Literature review = سابقہ تحقیق کا جائزہ; Lab notebook = لیب نوٹ بک. |
| display math / display equation | الگ سطر کی ریاضی / الگ سطر والی مساوات | inline code = سطری کوڈ; live preview = براہ راست پیش منظر. |
| task lists, wikilinks, callouts | چیک لسٹس، وکی لنکس، کال آؤٹس | |
| Update table (table of contents) | فہرست اپ ڈیٹ کریں | |
| cross-reference | کراس ریفرنس | Insert reference to = ریفرنس میں کیا دکھائیں (حوالہ stays for citations). |
| citation key | حوالہ کلید (f) | Library entries: {count} references = ماخذ / مآخذ (see 7.3). |
| Pick (in sentences) | چنیں | Buttons keep منتخب کریں. Locate… = ڈھونڈیں…. |
| Dismiss (writing suggestion) | رد کریں | Next to the fix chip Remove = ہٹائیں. fix = اصلاح, safe fix = محفوظ اصلاح. |
| manual / Reference Manual | مینوئل / ریفرنس مینوئل | Help home = مدد کا مرکزی صفحہ; guided tour = ٹور. |
| unzip / Unpacking… | ان زپ کریں / ان زپ ہو رہا ہے… | |
| Overwrite | اوور رائٹ کریں | |
| This cannot be undone. | یہ عمل کالعدم نہیں ہو سکتا۔ | |
| Made by | تیار کنندہ (label) | Made by {author} = تیار کردہ: {author}. |
| sprint / target / streak | اسپرنٹ / ہدف / لگاتار دن | Word target = الفاظ کا ہدف. |
| recovery store | بازیافت کا ذخیرہ | |
| writing categories | درستی / وضاحت / دلچسپی / انداز بیان | Audience = قارئین, Formality = رسمیت, Domain = شعبہ. |
| readability bands | بہت آسان / قدرے آسان / آسان / قدرے مشکل / مشکل / بہت مشکل | Reading ease = پڑھنے میں آسانی; Grade level = تعلیمی سطح; grade {n} = جماعت {n}. |
| word frequency | الفاظ کی تکرار | |
| split view | تقسیم کریں; Stacked = اوپر نیچے; Side by side = ساتھ ساتھ; Swap panes = پینز کی جگہ بدلیں | Split divider = تقسیمی لکیر. |
| add-in store words | کمیونٹی، پروجیکٹ صفحہ، مینی فیسٹ، ہوسٹ، حفاظتی جانچ | |
| macro code words | آرگومنٹ، تعریف (f)، آپریٹر، بیک سلیش، کمانڈ آئی ڈی، آؤٹ پٹ | |
| unit / SI Units | اکائی / SI اکائیاں | Unit names written out: میٹر، کلوگرام، نیوٹن … |
| maths | مشتق، تکمل، حد، کسر، جذر المربع، مطلق قیمت، میٹرکس، مقطع | Textbook terms used in Pakistan. |
| weekday column headers | full names (اتوار … ہفتہ) | Urdu has no two-letter abbreviations. |

- 2026-11-28: review pass. Terms above settled; files checked for cross-file consistency (same English = same Urdu in all five
  files), Arabic look-alike letters, Eastern digits and Latin punctuation after Urdu text.

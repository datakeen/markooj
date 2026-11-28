# Punjabi (Shahmukhi) (پنجابی) glossary for Markooj

Code `pnb` · right to left · plural rules `pa-Arab-PK` (one, other) · numbers and dates `ur-PK` · the translation rules are in
[docs/I18N.md](../../docs/I18N.md).

This page decides the voice of the whole Punjabi interface. Every catalog file (`shell`, `app`, `editors`, `language`,
`system`) uses these words and these rules. To change a term, change it here first, then everywhere it appears.

The reader: a student or researcher in Lahore, Faisalabad or Gujranwala who knows Microsoft Word (usually in English) and
reads Punjabi in Shahmukhi. The text must read as if a careful Lahori writer made it: real Punjabi grammar and verbs, not Urdu
with Punjabi endings, and not a word-for-word copy of the English.

Microsoft Office has no full Punjabi (Shahmukhi) version. Where Punjabi speakers say the Word term, we follow the Urdu Office
term they know (حاشیے، سرخی، مساوات، کتابیات، خاکہ) or the English word as they say it (فائل، ٹیب، فونٹ، ربن). Everything
around those terms (verbs, postpositions, plurals, word order) is Punjabi.

## 1. Register and voice

- **Address the user as تسیں**, always. Possessive: تہاڈا، تہاڈی، تہاڈے، تہاڈیاں. Never آپ (Urdu), never تُوں / تیرا
  (too familiar).
- **Commands and buttons use the تسیں imperative in ـو**: کھولو، بند کرو، محفوظ کرو، لبھو، بدلو، پاؤ، مٹاؤ، ہٹاؤ،
  وکھاؤ، لکاؤ، چݨو، جوڑو، چلاؤ، روکو، دباؤ، ویکھو. This is polite enough in Punjabi; do not add جی، مہربانی کر کے or
  براہ کرم to labels or messages (they make messages long and sound like a government notice). Negative: نہ + verb
  (محفوظ نہ کرو، مڑ نہ وکھاؤ).
- **Punjabi grammar, not Urdu grammar.**
  - Postpositions: دا / دی / دے / دیاں (of), نوں (to, object), توں (from, than), وچ (in), تے (on), نال (with), لئی (for),
    تک (up to), بارے (about), وانگ / ورگا (like), بنا (without), ول (towards).
  - "is / are / was / were": اے، نیں، سی، سن (not ہے، ہیں، تھا، تھے). Present tense: کھلدی اے، چلدا اے، کم کردے نیں.
  - "can": سکدے او / سکدا اے / سکدی اے. "should": چاہیدا اے. "need": لوڑ اے.
  - Everyday words: ایہہ (this), اوہ (that), ایس / اوس (oblique: ایس دستاویز وچ), کجھ (some), ہور (more, other),
    ہݨ (now), فیر (then), مڑ (again), اجے (yet), پہلاں (first, before), بعد وچ (later), ایتھے / اوتھے (here / there),
    سارا / ساری / سارے (all), کوئی نہیں (none), جے … تاں … (if … then …), کدی نہیں (never), ہمیشہ (always).
  - "and" is تے. "or" is یا.
- **Infinitive and verbal noun spelling.** Write ݨ (U+0768) where Punjabi has the retroflex n: ویکھݨا، لکھݨا، کھولݨا،
  جاݨا، چݨنا، بدلݨا، ہݨ، جاݨکاری، اپݨا، رہݨ دیو. After ر، ڑ، ڑھ the ending is a plain ن: کرنا، پڑھنا، کرن لئی، پڑھن موڈ.
  Do not use ڵ: standard Lahore Shahmukhi print writes ل (نال، گل، کل). If ݨ shows as a box in a screenshot, report it; do
  not replace it with ن.
- **Messages are solution-first**, like the English: what the person can do, then what still works. Short sentences, active
  verbs, no blame ("you did wrong") and no apology chains.
- **Short labels stay short.** A ribbon button or a switch segment should not be more than about 1.5 × the English length.
  Drop the object if the group name already gives it (Home → Font → "Grow Font" is فونٹ ودھاؤ, but a bare button "Grow" is
  ودھاؤ).
- **Gender agreement** follows the Punjabi noun (see the term table): دستاویز، فائل، تصویر، لسٹ، سرخی، مساوات، کتابیات are
  feminine (دستاویز محفوظ ہو گئی اے); صفحہ، ٹیبل، حوالہ، تبصرہ، فٹ نوٹ، کالم، فولڈر، میکرو are masculine (صفحہ مٹ گیا اے).

**Three examples (right and wrong):**

| English | Right | Wrong (and why) |
| --- | --- | --- |
| Free up some disk space, then try again. | ڈسک تے کجھ جگہ خالی کرو، فیر مڑ کوشش کرو۔ | براہ کرم ڈسک کی جگہ خالی کریں اور دوبارہ کوشش کریں۔ (Urdu, and "please" adds nothing) |
| Recovered “{name}”. Save it to keep it. | “{name}” بحال ہو گئی اے۔ سانبھݨ لئی ایہنوں محفوظ کرو۔ | بازیافت شدہ “{name}”۔ رکھنے کے لیے محفوظ کریں۔ (word for word, Urdu grammar) |
| Nothing matches “{query}”. | “{query}” نال کجھ نہیں ملدا۔ | کوئی چیز “{query}” سے میل نہیں کھاتی۔ (Urdu idiom) |

A button example: "Don’t Save" is محفوظ نہ کرو, "Close anyway" is فیر وی بند کرو, "Cancel" is رہݨ دیو.

## 2. Letters, punctuation and numbers

- **Letters:** use the Urdu code points: ک (U+06A9, not Arabic ك), ی (U+06CC, not ي), ہ (U+06C1) for h at the end or middle,
  ھ (U+06BE) only for aspiration (کھولو، ویکھو، پڑھو), ے (U+06D2), ں (U+06BA), ݨ (U+0768). Search and spell checking depend
  on this.
- **Full stop** ۔ (U+06D4), **comma** ، (U+060C), **question mark** ؟ (U+061F), **semicolon** ؛ (U+061B). The colon stays
  `:`. Labels without a full stop in English get none in Punjabi; sentences that end in "." end in ۔.
- **Exclamation mark:** avoid; use ۔ unless the English is a greeting.
- **Quotation marks:** keep the same curly quotes as the English source, “ ” and ‘ ’, around names and placeholders:
  “{name}”.
- **Brackets** ( ) [ ] stay as typed; the browser mirrors them on screen.
- **Digits** are Western (0–9), as in Pakistani software and in Intl `ur-PK`. Never ۰۱۲۳ or ٠١٢٣. Grouping 12,345, decimal
  point 2.5, percent `50%`. Units stay Latin: MB، KB، pt، px، cm.
- **Arrows in paths:** English "File → Options" becomes "فائل ← آپشنز". Use ← (U+2190) in Punjabi text, because the reading
  order runs right to left. Example: "Home → Styles → Heading 1" → "ہوم ← سٹائل ← سرخی 1".
- **Separators** · and — and / stay as in English.
- **No bidi control characters** (no RLM, LRM, RLE) in catalog values. The window is already `dir="rtl"`.

## 3. Placeholders, shortcuts, brand names, HTML

- Copy every `{placeholder}` exactly, braces and spelling included. Move it to where Punjabi word order wants it.
- Leave a space between a placeholder and a Punjabi word: `{name} نوں`, `{count} صفحے`, `“{title}” وچ`. Never glue a
  letter to a brace.
- A placeholder that holds a noun takes the Punjabi postposition after it: "Open {name}" → "{name} کھولو"; "Saved {name}" →
  "{name} محفوظ ہو گئی اے".
- **Keyboard shortcuts** stay in Latin letters, exactly as in English, with `+` and no spaces: Ctrl+S، Ctrl+Shift+K، Alt+Q،
  F7، Esc، Enter، Tab، Shift، Space. Do not translate or reverse them, and do not write کنٹرول or انٹر. In a sentence: "Esc
  دباؤ", "Ctrl+3 نال سادہ موڈ کھولو". In a label, the shortcut goes at the end in brackets, as in English: "محفوظ کرو
  (Ctrl+S)".
- **Brand and format names stay in Latin script**, never transliterated: Markooj، Word، Excel، Pandoc، KaTeX، Mermaid،
  Markdown، LaTeX، BibTeX، GitHub، PDF، DOCX، EPUB، Python، JavaScript، DjVu، Overleaf، Jupyter، Org mode. Write "Markooj"
  (not مارکوج) and "Word دستاویز" (not ورڈ دستاویز).
- **HTML tags** (`<b>`, `<kbd>`, `<code>`) stay, the same number and order; translate only the text between them.
- **Plurals:** Punjabi uses `one` and `other`. Intl `pa-Arab-PK` counts **0 and 1 as `one`** (0 فائل، 1 فائل، 2 فائلاں).
  Write the noun in the singular for `one` and in the Punjabi plural for `other`:
  `{ "one": "{count} فائل", "other": "{count} فائلاں" }`. Plurals: فائل → فائلاں، دستاویز → دستاویزاں، تصویر →
  تصویراں، سرخی → سرخیاں، لائن → لائناں، قطار → قطاراں، غلطی → غلطیاں، صلاح → صلاحاں، صفحہ → صفحے، خانہ → خانے،
  حوالہ → حوالے، تبصرہ → تبصرے، مسئلہ → مسئلے، لفظ / کالم / ٹیبل / میکرو / منٹ / دن stay the same.
- **Context markers** (`Open@@verb`, `Insert@@ribbon tab`) are not shown; translate the word for that context only.

## 4. The ellipsis "…"

- Keep the single character … (U+2026) wherever the English has it: menu items that open a dialog ("Save as…" → "وکھرا
  محفوظ کرو…") and work in progress ("Loading…" → "لوڈ ہو رہیا اے…").
- Put it right after the last Punjabi word, with no space. In the right-to-left window it shows at the left end, which is
  correct.
- Never write `...` (three dots) or ۔۔۔ and never add … where the English has none.

## 5. Editing modes

| English | Punjabi | Note |
| --- | --- | --- |
| Word mode | Word موڈ | Named after Microsoft Word; keep "Word" in Latin. On the switch: `Word`. |
| Inline (editing mode) | اِن لائن | A name, transliterated, so it does not clash with "inline equation" (لکھت دے وچ). Mode: اِن لائن موڈ. |
| Simple (editing mode) | سادہ | Mode: سادہ موڈ. |
| Read (editing mode) | پڑھن | Verbal noun (reading), not the order پڑھو. Mode: پڑھن موڈ. "Read only" is صرف پڑھن لئی. |
| mode | موڈ | Masculine: Word موڈ کھلا اے. |
| Word → Inline → Simple → Read | Word ← اِن لائن ← سادہ ← پڑھن | Arrow rule above. |

## 6. Term table

### Ribbon tabs (as in Word)

| English | Punjabi | Note |
| --- | --- | --- |
| File (tab and page) | فائل | f. Also "file": فائل، plural فائلاں. |
| Home | ہوم | As Pakistani Word users say it. Not گھر. |
| Insert (ribbon tab) | پاؤ | Same word as the Insert button: Punjabi "put in". |
| Layout | لے آؤٹ | Page layout tab. |
| References | حوالے | Plural of حوالہ (citation). |
| Review | جائزہ | |
| View | ویکھو | Tab name; the group "Views" is وکھالے. |
| Developer | ڈیولپر | |
| Add-ins (tab) | ایڈ اِنز | |
| Help (tab) | مدد | |
| Table Design | ٹیبل ڈیزائن | Contextual tab. |
| Table Layout | ٹیبل لے آؤٹ | Contextual tab. |
| Table Tools | ٹیبل ٹولز | Title above the contextual tabs. |

### Ribbon groups

| English | Punjabi | Note |
| --- | --- | --- |
| Clipboard | کلپ بورڈ | |
| Font | فونٹ | m. |
| Paragraph | پیراگراف | m. |
| Styles | سٹائل | Spelled with س, not اسٹائل. |
| Editing | ایڈیٹنگ | Group with Find, Replace, Select. |
| Direction | رخ | Text direction. |
| Aarab | اعراب | The native term for harakat (vowel marks). |
| Blocks | بلاک | |
| Captions | کیپشن | |
| Pictures | تصویراں | |
| Illustrations | تصویراں تے شکلاں | |
| Links & pages | لنک تے صفحے | |
| Notes & sources | نوٹ تے ماخذ | |
| Text (Insert group) | لکھت | |
| Page setup | صفحہ سیٹ اپ | |
| Spacing | وتھ | Punjabi for gap / space between. |
| Document theme | دستاویز دا تھیم | |
| Footnotes | فٹ نوٹ | |
| Table of contents | مضموناں دی فہرست | |
| Citations & bibliography | حوالے تے کتابیات | |
| Proofing | پڑتال | Spelling, grammar, word count. |
| Writing | لکھائی | Review group and Options section (Writing Assistant). |
| Versions | ورژن | |
| Comments | تبصرے | |
| Views | وکھالے | View → Views. |
| Show (ribbon group) | وکھاؤ | View → Show. |
| Zoom | زوم | |
| Mode (ribbon group) | موڈ | |
| Window (ribbon group) | ونڈو | |
| Theme | تھیم | m. |
| Keyboard | کی بورڈ | Typing layout, not shortcuts. |
| Tables | ٹیبل | |
| Commands | کمانڈاں | |
| Code (ribbon group) | کوڈ | |
| Math (ribbon group) | ریاضی | |
| My macros | میرے میکرو | |
| Store (ribbon group) | سٹور | |
| Table Styles | ٹیبل سٹائل | |
| Rows & Columns | قطاراں تے کالم | |
| Cell Size | خانے دا سائز | |
| Alignment | سیدھ | |
| Data | ڈیٹا | |
| Convert | روپ بدلو | Not بدلو alone (that is Replace / Change). |

### Common commands and buttons

| English | Punjabi | Note |
| --- | --- | --- |
| Save | محفوظ کرو | Status "Saved": محفوظ / محفوظ ہو گئی اے. |
| Save as / Save As… | وکھرا محفوظ کرو / وکھرا محفوظ کرو… | "Save separately": new name, place or format. Not بطور محفوظ. |
| Save all | ساریاں محفوظ کرو | |
| Save a copy | کاپی محفوظ کرو | |
| Don’t Save | محفوظ نہ کرو | |
| Open (verb) | کھولو | Open@@verb, Open@@file page, Open@@dialog title. |
| Open (state) | کھلی / کھلا | Agrees with the noun: دستاویز کھلی اے. |
| Close | بند کرو | |
| Close anyway | فیر وی بند کرو | |
| New | نواں / نویں | نواں (m.), نویں (f.): نویں دستاویز، نواں میکرو. |
| Undo | واپس کرو | ScreenTip: پچھلی تبدیلی واپس کرو۔ |
| Redo | مڑ کرو | |
| Repeat | دہراؤ | |
| Cut | کٹو | Short (ribbon). |
| Copy | کاپی کرو | Status "Copied": کاپی ہو گیا. |
| Paste | پیسٹ کرو | Not چسپاں. |
| Paste as plain text | سادی لکھت وجوں پیسٹ کرو | وجوں = "as". |
| Find | لبھو | |
| Find next / previous | اگلا لبھو / پچھلا لبھو | |
| Replace | بدلو | |
| Replace all | سارے بدلو | |
| Find and replace | لبھو تے بدلو | |
| Search (verb) | لبھو | Placeholder "Search or type a command": لبھو یا کمانڈ لکھو. |
| search (noun) | کھوج | |
| Insert (verb, button) | پاؤ | "Insert table": ٹیبل پاؤ. |
| Delete | مٹاؤ | Erases for good (text, file, comment). |
| Remove | ہٹاؤ | Takes out of a list or document (add-in, guide, aarab). |
| Add | جوڑو | "Add to Dictionary": ڈکشنری وچ جوڑو. |
| Options (File → Options) | آپشنز | The page and its button. |
| Settings | سیٹنگاں | f. pl. |
| Help | مدد | |
| Cancel | رہݨ دیو | Natural Punjabi "leave it". Not منسوخ کرو. |
| OK | ٹھیک اے | |
| Yes / No | ہاں / نہیں | |
| Apply | لاگو کرو | |
| Reset | ری سیٹ کرو | |
| Install | انسٹال کرو | State "Installed": انسٹال اے. |
| Uninstall | ان انسٹال کرو | |
| Download | ڈاؤن لوڈ کرو | |
| Update (verb) | اپ ڈیٹ کرو | "Up to date": تازہ ترین. |
| Try again | مڑ کوشش کرو | |
| Details | تفصیل | |
| Learn more | ہور جاݨو | |
| Don’t show again | مڑ نہ وکھاؤ | |
| Show / Hide | وکھاؤ / لکاؤ | |
| Turn on / Turn off | چالو کرو / بند کرو | Switch states On / Off: چالو / بند. |
| Choose / Select / Pick | چݨو | "Select all": سب چݨو. |
| Browse | براؤز کرو | |
| Back / Next | پچھے / اگے | Wizard buttons. "Next page": اگلا صفحہ. |
| Previous / Next (item) | پچھلا / اگلا | Agrees: پچھلی سرخی، اگلا تبصرہ. |
| Done | ہو گیا | |
| Skip / Ignore | چھڈو | "Ignore All": سارے چھڈو. |
| Accept | منو | "Accept safe fixes": پکیاں درستیاں منو. |
| Dismiss | ہٹاؤ | Hides a suggestion. |
| Continue | جاری رکھو | |
| Rename… | ناں بدلو… | |
| Run (macro) | چلاؤ | |
| Stop | روکو | |
| Record | ریکارڈ کرو | |
| Print / Print… | پرنٹ کرو / پرنٹ کرو… | Page title "Print": پرنٹ. |
| Preview | جھلک | "Print preview": پرنٹ دی جھلک. |
| Go to | جاؤ | "Go to page": صفحے تے جاؤ. |
| Back to document | دستاویز تے واپس جاؤ | |
| Grow / Shrink (font) | فونٹ ودھاؤ / فونٹ گھٹاؤ | ودھاؤ = increase, گھٹاؤ = decrease everywhere. |
| Promote / Demote | درجہ ودھاؤ / درجہ گھٹاؤ | Outline levels. |
| Move up / Move down | اتے کرو / تھلے کرو | |
| Merge (cells) | رلاؤ | "Merge Cells": خانے رلاؤ. |
| Sort | ترتیب دیو | |
| Ascending / Descending | چڑھدی ترتیب / لہندی ترتیب | |
| Click / Double-click / Right-click | کلک کرو / ڈبل کلک کرو / رائٹ کلک کرو | |
| Press (a key) | دباؤ | "Esc دباؤ". |
| Type / Write | ٹائپ کرو / لکھو | |
| Drag / Drop | گھسیٹو / سٹو | "Drop to open": کھولݨ لئی ایتھے سٹو. |
| Restart | ری سٹارٹ کرو | |
| Check (verify) | چیک کرو | "Check for updates": اپ ڈیٹ چیک کرو. |
| Get (packs, features) | لوو | "Get language packs": بولی پیک لوو. |
| Change | بدلو | F7 button; "Change All": سارے بدلو. |
| Custom… | اپݨا… | "your own". |
| Default | ڈیفالٹ | "{font} (default)": {font} (ڈیفالٹ). |
| Automatic | آپے | |
| Always / Never | ہمیشہ / کدی نہیں | |
| All / None / Other | سارے / کوئی نہیں / ہور | All (short tab): سب. |

### Document terms

| English | Punjabi | Note |
| --- | --- | --- |
| document | دستاویز | f.; pl. دستاویزاں. Not ڈاکومنٹ. |
| page | صفحہ | m.; pl. صفحے؛ "Page {current} of {total}": صفحہ {current} / {total}. |
| paragraph | پیراگراف | m. |
| heading | سرخی | f.; "Heading 1": سرخی 1. |
| title | سرناواں | Document or dialog title. |
| text | لکھت | f.; "plain text": سادی لکھت. |
| word / character / sentence / line | لفظ / اکھر / جملہ / لائن | "Word count": لفظاں دی گنتی. |
| list | لسٹ | f.; "bulleted list": بلٹ لسٹ؛ "numbered list": نمبر والی لسٹ. |
| table | ٹیبل | m.; pl. ٹیبل. Not جدول. |
| cell | خانہ | m.; pl. خانے. |
| row | قطار | f.; pl. قطاراں. |
| column | کالم | m.; pl. کالم. Also page columns. |
| header row | سرخی قطار | |
| caption | کیپشن | m. |
| figure | شکل | f.; "Figure 1" in a caption stays the document's own word. |
| picture / image | تصویر | f.; pl. تصویراں. |
| equation | مساوات | f.; pl. مساواتاں. "Inline equation": لکھت دے وچ. |
| citation | حوالہ | m.; "Cite" (button): حوالہ دیو. |
| reference / source | حوالہ / ماخذ | A source in the library is ماخذ. |
| bibliography | کتابیات | f. |
| citation library | حوالیاں دی لائبریری | The .bib file. |
| footnote | فٹ نوٹ | m. |
| comment | تبصرہ | m.; pl. تبصرے. |
| hidden note | لکیا نوٹ | A %%note%% that never prints. |
| cross-reference | کراس ریفرنس | m.; short ribbon "Cross-ref": کراس ریف. |
| table of contents | مضموناں دی فہرست | |
| outline | خاکہ | m.; the headings pane. |
| bold / italic / underline | موٹا / ترچھا / ہیٹھ لکیر | |
| strikethrough | وچوں لکیر | |
| highlight | ہائی لائٹ | |
| font size / font color | فونٹ سائز / فونٹ دا رنگ | |
| align left / center / right | کھبے / وچکار / سجے | Use کھبا / سجا for left / right everywhere. |
| justify | دونویں پاسے برابر | |
| line spacing | لائناں دی وتھ | |
| indent | حاشیہ اندر | "Increase indent": ہور اندر کرو. |
| margins | حاشیے | Page margins, as in Urdu Word. |
| orientation: portrait / landscape | کھڑا / لیٹا | |
| size / width / height | سائز / چوڑائی / اچائی | |
| top / bottom / left / right | اتے / تھلے / کھبے / سجے | Tab position switch too. |
| above / below | اتے / تھلے | "Insert Above": اتے پاؤ. |
| symbol | علامت | |
| date & time | تاریخ تے ویلا | ویلا = time. "Today": اج. |
| link | لنک | m. |
| quote (block) | اقتباس | |
| code block | کوڈ بلاک | |
| front matter | فرنٹ میٹر | The settings block; keep the technical name. |
| template | سانچا | m.; pl. سانچے. "New from template…": سانچے توں نویں… |
| style | سٹائل | |
| theme / light / dark | تھیم / چانݨا / ہنیرا | "Light theme": چانݨا تھیم؛ "Match system": سسٹم ورگا. |
| track changes | تبدیلیاں ٹریک کرو | |
| statistics | انکڑے | Document statistics: دستاویز دے انکڑے. |
| goal / target | ٹیچا | "Word target": لفظاں دا ٹیچا. |
| author | لکھاری | |
| properties | خاصیتاں | |
| Info (File page) | جاݨکاری | |
| version | ورژن | |
| issue (problem) | مسئلہ | pl. مسئلے؛ "No issues": کوئی مسئلہ نہیں. |
| error / warning | غلطی / دھیان دیو | |
| edited / saved / not saved yet | بدلی ہوئی / محفوظ / اجے محفوظ نہیں | Agrees with دستاویز. |
| read only | صرف پڑھن لئی | |

### Window and interface terms

| English | Punjabi | Note |
| --- | --- | --- |
| ribbon | ربن | m. "Pin the ribbon": ربن پن کرو. |
| tab (ribbon or document) | ٹیب | m.; pl. ٹیب. "Close tab": ٹیب بند کرو. |
| group (ribbon group) | گروپ | |
| button | بٹن | |
| menu | مینو | |
| window | ونڈو | f. "New Window": نویں ونڈو. Avoid the verb ونڈو (divide) next to it. |
| dialog | ونڈو | Users see a window: "the Save window": محفوظ کرن والی ونڈو. |
| pane / panel | پینل | m. "Next pane": اگلا پینل؛ "Output panel": آؤٹ پٹ پینل. |
| status bar | سٹیٹس بار | |
| command search (palette) | کمانڈ کھوج | Alt+Q. |
| command | کمانڈ | f.; pl. کمانڈاں. |
| ScreenTip | سکرین ٹپ | |
| KeyTips | کی ٹپس | |
| ruler | رولر | |
| guide (guide line) | گائیڈ لکیر | pl. گائیڈ لکیراں؛ "Add guide": گائیڈ لکیر جوڑو. |
| split | دو حصے | "Split": دو حصے کرو؛ "Remove Split": دو حصے ختم کرو. |
| side by side | نال نال | "View Side by Side": نال نال ویکھو. |
| swap / stack (panes) | ادل بدل کرو / اتے تھلے رکھو | |
| zoom in / zoom out | زوم اِن / زوم آؤٹ | |
| fit page width | صفحے دی چوڑائی جناں | |
| print layout / web layout | پرنٹ لے آؤٹ / ویب لے آؤٹ | Short switch: پرنٹ / ویب. |
| focus (mode) | دھیان | "Focus on": دھیان موڈ چالو؛ "Leave focus": دھیان موڈ چھڈو. |
| formatting marks | فارمیٹنگ نشان | |
| gridlines | گرڈ لکیراں | |
| full screen | پوری سکرین | |
| appearance | وکھالا | Options section. |
| editor | ایڈیٹر | |
| typing | ٹائپنگ | |
| keyboard shortcut | شارٹ کٹ | pl. شارٹ کٹ. "Keyboard shortcuts": کی بورڈ شارٹ کٹ. |
| welcome | جی آیاں نوں | Welcome screen title and Help button. |
| tour / tutorial | ٹور / سبق | "Start the guided tour": ٹور شروع کرو. |
| feedback / contact | رائے / رابطہ | |
| About | تعارف | Help → About. |

### Language and writing features

| English | Punjabi | Note |
| --- | --- | --- |
| language | بولی | f.; pl. بولیاں. Punjabi word; not زبان. |
| interface language | ایپ دی بولی | The language of menus and buttons. |
| document language | دستاویز دی بولی | |
| proofing language | پڑتال دی بولی | |
| language pack | بولی پیک | m. |
| keyboard (typing layout) | کی بورڈ | Urdu Phonetic, Arabic 101 … |
| layout (keyboard) | لے آؤٹ | |
| on-screen keyboard | سکرین کی بورڈ | Short ribbon "On-screen": سکرین والا. |
| switch keyboard | کی بورڈ بدلو | |
| right to left / left to right | سجے توں کھبے / کھبے توں سجے | |
| aarab (harakat) | اعراب | "Remove Aarab": اعراب ہٹاؤ؛ "Hide Aarab": اعراب لکاؤ. |
| zabar / zer / pesh | زبر / زیر / پیش | |
| shadd / jazm | شد / جزم | |
| Writing Assistant | لکھائی مددگار | m. The side pane. |
| spelling | ہجے | |
| grammar | گرامر | |
| Spelling & Grammar | ہجے تے گرامر | |
| suggestion | صلاح | f.; pl. صلاحاں. |
| correctness / clarity / engagement / delivery | درستی / صفائی / دلچسپی / انداز | Writing Assistant categories. |
| thesaurus | ہم معنی لفظ | |
| dictionary | ڈکشنری | "My dictionary": میری ڈکشنری. |
| technical terms | تکنیکی لفظ | |
| AutoCorrect | آپے درستی | |
| smart quotes | سمارٹ واوین | |
| add-in | ایڈ اِن | m.; pl. ایڈ اِنز. |
| Add-in Store | ایڈ اِن سٹور | |
| macro | میکرو | m.; pl. میکرو. "Macro Editor": میکرو ایڈیٹر. |
| feature (optional part) | فیچر | m.; pl. فیچر. "Features" (Help, Options): فیچر. |
| feature download | فیچر ڈاؤن لوڈ | |
| Markdown features (in a document) | Markdown فیچر | Features@@markdown. |

### File terms

| English | Punjabi | Note |
| --- | --- | --- |
| file | فائل | f.; pl. فائلاں. |
| folder | فولڈر | m. |
| path | پاتھ | "Copy file path": فائل دا پاتھ کاپی کرو. |
| recent (files) | تازہ | "Recent files": تازہ فائلاں؛ "Open recent…": تازہ کھولو… |
| export | ایکسپورٹ کرو | "Export as PDF…": PDF وجوں ایکسپورٹ کرو… |
| import | امپورٹ کرو | |
| PDF / Word document / web page | PDF / Word دستاویز / ویب صفحہ | |
| recovery / Recover (File page) | بحالی | "Recover unsaved…": غیر محفوظ لکھت بحال کرو… |
| recover (verb) / recovered | بحال کرو / بحال ہوئی | |
| recovery copy | بحالی کاپی | |
| backup | بیک اپ | |
| autosave | آپے محفوظ | |
| unsaved | غیر محفوظ | |
| disk space | ڈسک تے جگہ | |
| internet connection | انٹرنیٹ کنکشن | |
| loading… / checking… | لوڈ ہو رہیا اے… / چیک ہو رہیا اے… | |
| ready | تیار | |
| size (file) | سائز | "{size} MB" stays with Latin MB. |

## 7. Decisions and open questions

- 2026-11-27: Register تسیں with the ـو imperative; no جی or براہ کرم in labels and messages.
- 2026-11-27: Language is بولی (Punjabi), not زبان.
- 2026-11-27: Cancel is رہݨ دیو; OK is ٹھیک اے; Save as is وکھرا محفوظ کرو.
- 2026-11-27: Insert (tab and button) is پاؤ; View tab is ویکھو; Views group is وکھالے.
- 2026-11-27: Mode names: Word (kept), اِن لائن (transliterated name), سادہ، پڑھن.
- 2026-11-27: Delete is مٹاؤ (erase), Remove is ہٹاؤ (take out), Add is جوڑو.
- 2026-11-27: Left / right are کھبا / سجا; increase / decrease are ودھاؤ / گھٹاؤ.
- 2026-11-27: Table is ٹیبل, document is دستاویز, file is فائل (as Pakistani Word users say them).
- 2026-11-27: Arrows in menu paths are written ← in Punjabi text.
- Open: ask a Lahore reviewer whether ویکھو (View tab) and سانچا (template) read naturally to students, or whether ویو and
  ٹیمپلیٹ are better.

## 7. Terms decided in the first review

Added after the five group files were translated. Use these everywhere; the review applied them across all files.

| English | Punjabi | Note |
| --- | --- | --- |
| Edit (verb) / Edit (Read-mode button) | ایڈٹ کرو / ایڈٹ | "Edit as text": لکھت وجوں ایڈٹ کرو. |
| editable | ایڈٹ ہوݨ جوگا / جوگی | Not ایڈٹ ہوݨ والی. |
| Compare | ملا کے ویکھو | Not مقابلہ کرو (that is "compete"). |
| match (search result) | ملدی تھاں | pl. ملدیاں تھاواں؛ "{count} matches found": {count} ملدیاں تھاواں لبھیاں. "Search results": کھوج دے نتیجے. |
| citation key | حوالے دی کنجی | pl. حوالیاں دیاں کنجیاں. Not حوالہ کی (کی reads as "what"). |
| key (shortcut key) / on-screen key | کی، pl. کیز / بٹن | "Arrow keys": ایرو کیز. On the on-screen keyboard a key is a بٹن. |
| numbering | نمبر بندی | f. Not نمبرنگ. |
| Recent (files) | حالیہ | "Recent files": حالیہ فائلاں؛ "Open recent…": حالیہ کھولو…. تازہ is only for "up to date" (تازہ ترین) and "refresh". |
| window, plural | ونڈواں | Not ونڈوز (reads as the Windows brand). |
| message | سنیہا | pl. سنیہے، oblique سنیہیاں. |
| cursor / caret | کرسر | |
| clipboard | کلپ بورڈ | |
| diagram | ڈایاگرام | |
| callout / Tip / Caution / Important / Note / Warning | کال آؤٹ / صلاح / خبردار / ضروری / نوٹ / دھیان دیو | |
| Page break / Divider | صفحہ بریک / افقی لکیر | |
| case (letter case) | کیس | "Change Case": کیس بدلو؛ UPPERCASE: وڈے اکھر؛ lowercase: نکے اکھر. |
| sprint / streak / daily goal | سپرنٹ / لگاتار دن / روز دا ٹیچا | |
| export (noun) | ایکسپورٹ | |
| share | سانجھا کرو | Not ونڈو (clashes with window). |
| keywords | اہم لفظ | |
| readability / word frequency | پڑھن وچ سوکھ / لفظاں دی ورتوں | |
| research paper / literature review / thesis chapter | تحقیقی مقالہ / لٹریچر ریویو / تھیسس دا باب | |
| Manage (add-ins) | سانبھو | Ribbon group noun "Manage": انتظام. |
| Installed (state and File → Add-ins tab) / Installed (ribbon group) | انسٹال اے / انسٹال شدہ | |
| Render as (flavor list heading) | پڑھن دی قسم | |
| Left (tab position) | پاسے | In the right-to-left window the vertical tab list sits on the right, so کھبے would point the wrong way. |
| long (sentence) | لما / لمے | Written without shadd. |
| Will / is going to | جاوے گا / جاوے گی | Punjabi جاوے، never Urdu جائے. |

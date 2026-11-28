# Arabic (العربية) glossary for Markooj

Code `ar` · right to left · the translation rules are in [docs/I18N.md](../../docs/I18N.md).

Every Arabic catalog file (`shell`, `app`, `editors`, `language`, `system`) follows this page. To change a term, change it
here first, then everywhere it appears. The model is the Arabic Microsoft Office used in Saudi Arabia: a Word user should
find the same word for the same thing. Where Markooj has something Word does not, the term below was chosen to sit
naturally next to Word's words.

## 1. Register and voice

Modern Standard Arabic, plain and calm, as in Office. Never word-for-word: read the English, understand what the person
needs, then write what an Arabic Office screen would say.

| Kind of text | Form | Examples |
| --- | --- | --- |
| Buttons, menu items, commands, ribbon labels | **Verbal noun (مصدر)**, never the imperative | حفظ · فتح · إدراج · إعادة المحاولة · نسخ المسار |
| Names of things (tabs, groups, panes, options) | Noun, with **ال** when it names one specific thing in a heading or tab | الصفحة الرئيسية · المسطرة · لغة المستند |
| Instructions and hints in sentences | **Imperative, 2nd person singular masculine**, used as the generic form (as Microsoft does); no اختر/اختاري slashes | اختر مجلدًا ثم أعد المحاولة. |
| Questions in dialogs | هل تريد …؟ | هل تريد حفظ التغييرات في «{name}»؟ |
| Done / confirmation messages | تم + مصدر | تم نسخ المسار. |
| Work in progress | جارٍ + مصدر + … | جارٍ التثبيت… |
| Failures | تعذّر + مصدر (or لا يمكن + مصدر) | تعذّر حفظ الملف. |
| Option descriptions | Present tense, the feature as subject | يُظهر الصفحات كما ستُطبع. |

Rules:

- **Solution first.** The English messages start with what the person can do; keep that order. Never move the cause in
  front of the remedy.
- **Polite but not stiff.** Do not add يرجى / الرجاء / من فضلك unless the English says please; Office rarely does. Never
  "عزيزي المستخدم".
- **Address the person as "you" only when needed** (يمكنك، لديك). Prefer short impersonal phrasing for labels.
- **Markooj is masculine** (برنامج): يحتفظ Markooj بنسخة… / تعذّر على Markooj فتح الملف.
- **Short labels stay short.** A ribbon button is one or two words. Drop ال on short buttons (حفظ، لا الحفظ) but keep it
  on names of panes and tabs (الشريط، المخطط التفصيلي).
- **No added or dropped meaning.** No exclamation marks unless the English has one. "Well done." → أحسنت. (one word, not a
  speech).

Three examples (English → Arabic):

1. `Check your internet connection, then try again. GitHub did not answer in time.`
   → `تحقق من اتصالك بالإنترنت، ثم أعد المحاولة. لم يستجب GitHub في الوقت المحدد.`
   (solution first, imperative in the sentence; the Try again *button* is `إعادة المحاولة`.)
2. `Save changes to “{name}”?` → `هل تريد حفظ التغييرات في «{name}»؟` with buttons `حفظ` · `عدم الحفظ` · `إلغاء الأمر`.
3. `Installing…` → `جارٍ التثبيت…` · `Saved {name}` → `تم حفظ {name}` · `Copy path` → `نسخ المسار`.

### Sentence fragments with a placeholder

Some English keys are pieces of a sentence ("… so Markooj could not {action}."). Read the note, then write the piece so it
fits the Arabic frame: after تعذّر / لم يتمكن Markooj من the piece is a **verbal noun phrase** (حفظ الملف، فتح المجلد), not a
verb. Write the frame so the placeholder needs no article and no attached letter (see "Placeholders" below).

## 2. Punctuation, spelling and numbers

- **Arabic punctuation:** comma `،` · semicolon `؛` · question mark `؟`. Full stop `.`, colon `:`, `%` and parentheses
  `( )` are the same characters as English (the browser mirrors parentheses in right-to-left text by itself; type them in
  logical order, `(` first).
- **Quotation marks:** use `«…»` where English has `“…”` or `‘…’`: `«{name}»`. Type `«` first; it displays correctly right to
  left. No straight `"` in sentences.
- **Arrows in menu paths:** English `File → Recover` becomes `ملف ← استرداد`. The arrow points left, the way Arabic reads.
  `⇄` stays as is.
- **Digits: Western (0 1 2 3 … 9) everywhere in the interface**, never Arabic-Indic (٠١٢٣). Markooj formats `{count}` and
  other numbers itself with the `ar` locale, which gives Western digits; typed numbers in strings (`Heading 1`, `100%`,
  `Arabic (101)`, `1.1`) stay Western so they match. If a screen ever shows ٠١٢٣ next to 0123, report it; do not "fix" the
  catalog. Decimal point `.`, thousands `,` (as the app formats them).
- **Spelling:** hamza on alif where it belongs (إدراج، إزالة، إعادة، أدوات، إلغاء); ى and ي kept apart (على، إلى، مستوى؛ في،
  تلقائي); ة and ه kept apart. No tatweel (ـ) for stretching. No harakat except: tanween al-fath on the letter before
  alif where grammar needs it (تلقائيًا، أيضًا، يومًا، ملفًا), `جارٍ`, and `حواشٍ`. Write `جنبًا إلى جنب`.
- **Units and sizes:** `{size} KB / MB / GB` → `{size} كيلوبايت` / `ميغابايت` / `غيغابايت`; `pt` (font points) → `نقطة`;
  `in` → `بوصة`; `cm` → `سم`. Measurement symbols inside formulas (m/s2) stay Latin.
- **Dates:** the app formats dates. Hijri month names: محرم، صفر، ربيع الأول، ربيع الآخر، جمادى الأولى، جمادى الآخرة، رجب،
  شعبان، رمضان، شوال، ذو القعدة، ذو الحجة. Short weekday labels (Su, Mo …) on the date picker: أحد، اثنين، ثلاثاء، أربعاء،
  خميس، جمعة، سبت. Gregorian = ميلادي, Hijri = هجري.

## 3. Plurals

`Intl.PluralRules('ar')` uses all six categories; fill **every** one for each plural string:

| Category | Numbers | How to write it | `{count} words` | `{count} days ago` |
| --- | --- | --- | --- | --- |
| zero | 0 | Same as *other*, with `{count}` | `{count} كلمة` | `منذ {count} يوم` |
| one | 1 | Singular + واحد/واحدة, or the singular alone; `{count}` may be left out | `كلمة واحدة` | `منذ يوم واحد` |
| two | 2 | Dual, without `{count}`: ـان when standalone/subject, ـين after a preposition or as object | `كلمتان` | `منذ يومين` |
| few | 3–10, 103–110 … | `{count}` + broken/sound **plural** | `{count} كلمات` | `منذ {count} أيام` |
| many | 11–99, 111–199 … | `{count}` + **singular accusative** (tanween fath only on words without ة) | `{count} كلمة` | `منذ {count} يومًا` |
| other | 100–102, 1000 … | `{count}` + **singular** | `{count} كلمة` | `منذ {count} يوم` |

Common nouns (one · two · few · many · other):

| English | one | two | few | many | other |
| --- | --- | --- | --- | --- | --- |
| word | كلمة واحدة | كلمتان | كلمات | كلمة | كلمة |
| day | يوم واحد | يومان | أيام | يومًا | يوم |
| file | ملف واحد | ملفان | ملفات | ملفًا | ملف |
| page | صفحة واحدة | صفحتان | صفحات | صفحة | صفحة |
| minute (also `min`) | دقيقة واحدة | دقيقتان | دقائق | دقيقة | دقيقة |
| hour | ساعة واحدة | ساعتان | ساعات | ساعة | ساعة |
| item | عنصر واحد | عنصران | عناصر | عنصرًا | عنصر |
| line | سطر واحد | سطران | أسطر | سطرًا | سطر |
| suggestion | اقتراح واحد | اقتراحان | اقتراحات | اقتراحًا | اقتراح |
| issue | مشكلة واحدة | مشكلتان | مشكلات | مشكلة | مشكلة |
| equation / figure / table | معادلة / شكل / جدول واحد | معادلتان / شكلان / جدولان | معادلات / أشكال / جداول | معادلة / شكلًا / جدولًا | معادلة / شكل / جدول |
| reference | مرجع واحد | مرجعان | مراجع | مرجعًا | مرجع |
| update | تحديث واحد | تحديثان | تحديثات | تحديثًا | تحديث |
| macro | وحدة ماكرو واحدة | وحدتا ماكرو | وحدات ماكرو | وحدة ماكرو | وحدة ماكرو |
| shortcut | اختصار واحد | اختصاران | اختصارات | اختصارًا | اختصار |
| step | خطوة واحدة | خطوتان | خطوات | خطوة | خطوة |
| byte | بايت واحد | بايتان | بايتات | بايت | بايت |

In compact counters (status bar, chips) `one` may simply be `{count} كلمة` if `كلمة واحدة` is too long; keep the dual.
**Numbers that are not `{count}`** (`{days}`, `{target}`, `{n}`) get no plural forms, so put the noun first and avoid
agreement: `{count}-day streak` is a plural string, but `You hit your {target}-word target.` → `بلغتَ هدفك: {target} كلمة.`
or `بلغتَ عدد الكلمات المستهدف ({target}).`

## 4. Placeholders, shortcuts and Latin words in sentences

- Keep every `{placeholder}` exactly (same spelling, braces, Latin letters); move it wherever Arabic word order wants it.
- **Never attach Arabic letters to a placeholder or a Latin word.** No `ال{name}`, `ب{name}`, `لـ{name}`, `وExcel`. Put a
  noun or a free-standing word before it: `المستند «{name}»`, `باستخدام {tool}`, `إلى {name}`, `في Markooj`. Write `و`
  followed by a space before Latin words: `Word و Excel`.
- **Prefer not to start a string with a placeholder or a Latin word**; Arabic verb-first order usually avoids it
  (`يحتاج Markooj إلى …`, `تم حفظ {name}`).
- Do not add invisible direction marks (RLM/LRM) unless a screenshot shows the wrong order; then note it in the
  Decisions list.
- **Shortcuts:** key names stay in Latin letters, exactly as in English: `Ctrl`, `Shift`, `Alt`, `Enter`, `Esc`, `Tab`,
  `Space`, `F1`, `PageUp`. Write them as in English (`Ctrl+Shift+S`) and keep `<kbd>` tags: `اضغط <kbd>Alt+Q</kbd>`. In
  running text use `اضغط` for press and `مفتاح Tab` when the key itself is meant. `(Ctrl+B)` after a label stays in
  parentheses: `غامق (Ctrl+B)`.
- Brand and format names stay in Latin script, untranslated: Markooj, Word, Excel, PowerPoint, Pandoc, KaTeX, Mermaid,
  Markdown, LaTeX, BibTeX, GitHub, Python, PDF, DOCX, EPUB, HTML, YAML, DjVu, Homebrew. Microsoft Word as a product is
  `Microsoft Word`; a Word file is `مستند Word`.
- Strings that are right as in English (`Markdown`, `LaTeX`, `100%`, `Python`, `PDF`) go into `"@same"` in that file.

## 5. "…" (ellipsis)

- A menu item or button that opens a dialog keeps the single character `…` (U+2026) **directly after** the Arabic text, no
  space, never three dots: `Save As…` → `حفظ باسم…`, `Open…` → `فتح…`, `Insert table…` → `إدراج جدول…`.
- Progress text ends with `…` the same way: `جارٍ التحميل…`.
- `…` inside examples (`$…$`) is Markdown syntax: copy it unchanged.

## 6. Terms

Office's Arabic words first; **bold** marks a deliberate choice where Office has none or where Office's word would clash.

### Ribbon tabs, contextual tabs and the File page

| English | Arabic | Notes |
| --- | --- | --- |
| Markooj | Markooj | Never translated, Latin script, masculine. |
| File | ملف | The File tab (Word). |
| Home | الصفحة الرئيسية | Word's Home tab. |
| Insert (ribbon tab) | إدراج | The verb button `Insert@@verb` is also إدراج. |
| Layout | تخطيط | Word's Layout tab. |
| References | مراجع | Word's References tab. |
| Review | مراجعة | |
| View | عرض | |
| Developer | المطور | |
| Add-ins | الوظائف الإضافية | Tab and File page. |
| Help | تعليمات | Tab, command group and Help window. |
| Table Design | تصميم الجدول | Contextual tab. |
| Table Layout | تخطيط الجدول | Contextual tab (Word shows "تخطيط" under Table Tools; we name it fully). |
| Table Tools | أدوات الجدول | Contextual tab group title. |
| Info | معلومات | File page. |
| New (file page) | جديد | |
| Open (file page) / Open (verb) | فتح | |
| Recent | الأخيرة | List of recent documents: المستندات الأخيرة. |
| Save | حفظ | |
| Save As | حفظ باسم | Dialog form: حفظ باسم… |
| Save As / Export | حفظ باسم / تصدير | File page name. |
| Save all | حفظ الكل | |
| Export | تصدير | |
| Print | طباعة | Print preview: معاينة الطباعة. |
| Options | خيارات | File → Options (خيارات). Section headings inside Options are nouns. |
| Recover | استرداد | File page with unsaved text Markooj kept. |
| Properties | خصائص | Document properties: خصائص المستند. |
| Blank document | مستند فارغ | |
| Untitled | بلا عنوان | `Untitled {n}` → `بلا عنوان {n}`. |

### Ribbon groups

| English | Arabic | Notes |
| --- | --- | --- |
| Clipboard | الحافظة | Home. |
| Font | خط | Home group; the font setting itself is الخط. |
| Paragraph | فقرة | Home group; a paragraph in text is فقرة. |
| Styles | أنماط | |
| Editing | تحرير | |
| Direction | الاتجاه | Home: paragraph direction. |
| Aarab (harakat group) | التشكيل | See "Language features". |
| Blocks | كتل | Insert. |
| Captions | تسميات توضيحية | Insert. |
| Illustrations | رسومات توضيحية | Insert. |
| Pictures | صور | Insert group and file filter. |
| Links & pages | ارتباطات وصفحات | Insert. |
| Notes & sources | ملاحظات ومصادر | Insert. |
| Text (group) | نص | Insert. |
| Page setup | إعداد الصفحة | Layout. |
| Spacing | التباعد | Layout. |
| Document theme | نسق المستند | Layout. Office's word for theme is نسق. |
| Footnotes | حواشٍ سفلية | References. |
| Table of contents | جدول المحتويات | References. Short button `Contents` → المحتويات. |
| Proofing | تدقيق | Review. |
| Writing (group) | الكتابة | Review / View groups and Options section. |
| Versions | الإصدارات | Review: saved versions of the document. |
| Views | طرق العرض | View. |
| Show (group) | إظهار | View. |
| Mode (group) | الوضع | View: editing modes. |
| Zoom | تكبير/تصغير | View group, as in Word. Zoom in: تكبير · Zoom out: تصغير. |
| Window (group) | نافذة | View. |
| Keyboard (group) | لوحة المفاتيح | View. |
| Commands | الأوامر | View. |
| Theme | النسق | View group: light/dark. |
| Code (group) | تعليمات برمجية | Developer. |
| Math (group) | رياضيات | Developer. |
| Store | المتجر | Add-ins: the Add-in Store. |
| Installed (add-ins) | المثبّتة | Add-ins group: الوظائف المثبتة when space allows. |
| Table Styles | أنماط الجدول | Table Design. |
| Rows & Columns | صفوف وأعمدة | Table Layout. |
| Cell Size | حجم الخلية | |
| Alignment | محاذاة | |
| Data | بيانات | |
| Convert | تحويل | |

### Common commands and buttons

| English | Arabic | Notes |
| --- | --- | --- |
| Undo | تراجع | |
| Redo | إعادة | |
| Repeat | تكرار | |
| Cut | قص | |
| Copy | نسخ | |
| Paste | لصق | |
| Paste as plain text | لصق كنص عادي | |
| Format painter / Copy formatting | نسخ التنسيق | |
| Clear formatting | مسح التنسيق | |
| Select / Select all | تحديد / تحديد الكل | |
| Find | بحث | Find next: بحث عن التالي. |
| Replace / Replace all | استبدال / استبدال الكل | Replace with: استبدال بـ (the field label; nothing attached after it). |
| Find and replace | بحث واستبدال | |
| Search (verb, button) | بحث | |
| Go To | انتقال إلى | Go to heading…: الانتقال إلى عنوان… |
| Insert (verb) | إدراج | `Insert {symbol}` → `إدراج {symbol}`. |
| Delete | حذف | Removes content (row, comment, macro). |
| Remove | إزالة | Takes something away (link, guide, split, language pack). Keep حذف/إزالة apart. |
| Clear | مسح | Empties a field or list. |
| Close | إغلاق | Close others: إغلاق الأخرى. |
| Cancel | إلغاء الأمر | The dialog button, as in Windows and Office. In a sentence: إلغاء. |
| OK | موافق | |
| Apply | تطبيق | |
| Reset | إعادة تعيين | |
| Done | تم | |
| Yes / No | نعم / لا | |
| Don't Save | عدم الحفظ | Save-changes dialog, as in Word. |
| Close anyway | إغلاق على أي حال | |
| Discard | تجاهل التغييرات | Throwing away unsaved work; "Discard" alone on a button: إهمال. |
| Ignore / Ignore All | تجاهل / تجاهل الكل | Spelling. |
| Dismiss | إغلاق | For a message or chip; for a Writing Assistant suggestion: رفض. |
| Accept / Reject | قبول / رفض | |
| Change / Change to | تغيير / التغيير إلى | |
| Install | تثبيت | `Install ({size})` → `تثبيت ({size})`. |
| Uninstall | إلغاء التثبيت | |
| Download | تنزيل | Never تحميل (تحميل = loading/upload). |
| Update | تحديث | Update all: تحديث الكل. |
| Reload | إعادة تحميل | |
| Try again | إعادة المحاولة | Button. In a sentence: ثم أعد المحاولة. |
| Check again | التحقق مرة أخرى | |
| Details | التفاصيل | Copy details: نسخ التفاصيل. Technical details: التفاصيل الفنية. |
| Learn more | معرفة المزيد | As in Office. |
| Don't show again | عدم الإظهار مرة أخرى | |
| Not now / Later | ليس الآن / لاحقًا | |
| Skip | تخطي | The same spelling everywhere (no tanween form). |
| Next / Previous | التالي / السابق | |
| Back / Forward | رجوع / للأمام | Help window navigation. |
| Continue | متابعة | |
| Browse / Browse… | استعراض / استعراض… | As in Office. |
| Show / Hide | إظهار / إخفاء | |
| On / Off (switch) | تشغيل / إيقاف | Turn on: تشغيل. |
| Always / Never / Automatic | دائمًا / أبدًا / تلقائي | |
| Rename… | إعادة تسمية… | |
| Reveal in folder | إظهار في المجلد | |
| Copy path | نسخ المسار | |
| Overwrite | الكتابة فوقه | |
| Run / Stop | تشغيل / إيقاف | Macros and code. |
| Record / Stop recording | تسجيل / إيقاف التسجيل | |
| Manage | إدارة | |
| Sort / Ascending / Descending | فرز / تصاعدي / تنازلي | |
| Merge | دمج | |
| Preview | معاينة | |
| Report this | الإبلاغ عن ذلك | |

### Modes, views and the window

| English | Arabic | Notes |
| --- | --- | --- |
| Editing mode | وضع التحرير | |
| Word mode | وضع Word | Named after Microsoft Word: always keep "Word". On the small switch: `Word`. |
| Inline (mode) | مضمّن | **Translated.** Switch label مضمّن; long name الوضع المضمّن. Write the shadda only here (it disambiguates). |
| Simple (mode) | بسيط | Long name: الوضع البسيط. |
| Read (mode) | قراءة | Long name: وضع القراءة (Word's Read Mode). |
| Print layout | تخطيط الطباعة | Switch label `Print@@page layout`: طباعة. |
| Web layout | تخطيط ويب | Switch label `Web@@page layout`: ويب. |
| Focus | تركيز | Leave focus: الخروج من التركيز. |
| Full-screen mode | وضع ملء الشاشة | |
| Read only | للقراءة فقط | Status after the title, as in Office. |
| Saved / Edited / Not saved yet | تم الحفظ / معدّل / لم يُحفظ بعد | Title-bar states. |
| ribbon | الشريط | Ribbon display: عرض الشريط. |
| tab (ribbon tab) | علامة تبويب | In sentences: علامة التبويب {name}. |
| tab (document tab) | علامة تبويب المستند | Document tabs: علامات تبويب المستندات. |
| tab (Tab key / tab character) | Tab / حرف جدولة | Key name stays Latin. |
| group (ribbon group) | مجموعة | |
| Quick access | الوصول السريع | Word: شريط أدوات الوصول السريع. |
| status bar | شريط المعلومات | Office/Windows Arabic name for the status bar. |
| command search / Search and commands | البحث عن الأوامر / البحث والأوامر | Alt+Q. Markooj's word for the command palette; never "لوحة الأوامر". |
| ScreenTip | تلميح الشاشة | |
| KeyTips | تلميحات المفاتيح | As in Office. |
| window | نافذة | New Window: نافذة جديدة. Switch Windows: تبديل النوافذ. Arrange All: ترتيب الكل. |
| pane | جزء | As in Word (جزء التنقل). Next pane: الجزء التالي. |
| dialog box | مربع حوار | |
| Split / Remove Split | تقسيم / إزالة التقسيم | |
| side by side / View Side by Side | جنبًا إلى جنب / عرض جنبًا إلى جنب | |
| Synchronous Scrolling | التمرير المتزامن | |
| Reset Window Position | إعادة تعيين موضع النافذة | |
| ruler | المسطرة | Ruler units: وحدات المسطرة. |
| guide (on the ruler) | خط إرشادي | **Not دليل** (that is a manual). Guides: خطوط إرشادية; Horizontal/Vertical guide: خط إرشادي أفقي / رأسي. |
| Gridlines | خطوط الشبكة | |
| Formatting marks | علامات التنسيق | |
| Page width | عرض الصفحة | Word's zoom choice. |
| Theme / Light / Dark | النسق / فاتح / داكن | |
| System / Match system (theme) | النظام / مطابقة النظام | |
| Appearance | المظهر | |
| Typewriter (scrolling) | الآلة الكاتبة (تمرير الآلة الكاتبة) | |
| Welcome | مرحبًا | Welcome screen: شاشة الترحيب. |
| Tutorial | برنامج تعليمي | Tutorials: البرامج التعليمية. |
| Tip | تلميح | |

### Document terms

| English | Arabic | Notes |
| --- | --- | --- |
| document | مستند | Never وثيقة. |
| page | صفحة | `Page {n}` → `الصفحة {n}`; `of {count}` → `من {count}`. |
| paragraph | فقرة | |
| heading | عنوان | `Heading 1` → `عنوان 1` (Word's style name). Headings: العناوين. |
| Title (style / property) | العنوان | Subtitle: عنوان فرعي. |
| Normal / Normal text | عادي / نص عادي | Style names, as in Word. |
| style | نمط | |
| font / font size / font color | الخط / حجم الخط / لون الخط | Grow/Shrink Font: تكبير الخط / تصغير الخط. |
| Bold / Italic / Underline | غامق / مائل / تسطير | |
| Strikethrough / Subscript / Superscript | يتوسطه خط / منخفض / مرتفع | |
| Highlight | تمييز | Text color: لون النص. |
| Change Case | تغيير حالة الأحرف | |
| list | قائمة | |
| Bullets / Numbering | تعداد نقطي / ترقيم | |
| Checklist / task list | قائمة مهام | Chip `task lists`: قوائم المهام. |
| Increase / Decrease indent | زيادة المسافة البادئة / إنقاص المسافة البادئة | |
| Align left / Center / Align right / Justify | محاذاة إلى اليسار / توسيط / محاذاة إلى اليمين / ضبط | |
| Line spacing / Paragraph spacing | تباعد الأسطر / تباعد الفقرات | |
| Margins | الهوامش | Normal/Narrow/Wide: عادية / ضيقة / عريضة. |
| Page break / Divider | فاصل صفحات / خط فاصل | |
| Section | مقطع | As in Word. |
| Promote / Demote | ترقية / تخفيض | Heading levels. |
| table | جدول | |
| cell / row / column | خلية / صف / عمود | Header Row: صف الرأس; Banded rows: صفوف ذات نطاقات. |
| caption | تسمية توضيحية | Insert Caption: إدراج تسمية توضيحية. |
| label (caption label) | التسمية | Equation/Figure/Table label: تسمية المعادلة / الشكل / الجدول. |
| figure | شكل | `Figure {number}` → `الشكل {number}`. |
| picture | صورة | |
| diagram / flowchart | رسم تخطيطي / مخطط انسيابي | Mermaid diagram: رسم تخطيطي Mermaid. |
| equation | معادلة | `Equation ({number})` → `المعادلة ({number})`. Inline/display math: رياضيات مضمّنة / معادلة في سطر مستقل. |
| math | رياضيات | |
| citation / Cite | **استشهاد** / استشهاد | Word says اقتباس, but that is our Quote; researchers say استشهاد. Insert citation: إدراج استشهاد. |
| Quote (block quote) | اقتباس | |
| reference | مرجع | Reference type: نوع المرجع. |
| bibliography | قائمة المراجع | As in Word. |
| citation library (BibTeX) | مكتبة المراجع | Library (short button): المكتبة; `BibTeX library` → `مكتبة BibTeX`. |
| source | مصدر | |
| citation style | نمط الاستشهاد | |
| footnote | حاشية سفلية | Plural حواشٍ سفلية. Footnote text: نص الحاشية السفلية. |
| comment | تعليق | New comment: تعليق جديد. |
| hidden note | ملاحظة مخفية | A %%note%% that never prints. |
| cross-reference / Cross-ref | إسناد ترافقي / إسناد | As in Word. |
| table of contents | جدول المحتويات | |
| outline | المخطط التفصيلي | The headings pane (Word's outline). Hide outline: إخفاء المخطط التفصيلي. |
| link / hyperlink | ارتباط | Edit link: تحرير الارتباط; Remove link: إزالة الارتباط. |
| code block / inline code | كتلة تعليمات برمجية / تعليمات برمجية مضمّنة | |
| callout | وسيلة شرح | Word's word. Callout box kinds: ملاحظة، تلميح، هام، تحذير، تنبيه. |
| front matter | البيانات الوصفية | The settings block at the top of a Markdown file. |
| template | قالب | |
| properties / tags / author | الخصائص / العلامات / المؤلف | |
| word count | عدد الكلمات | |
| statistics | الإحصائيات | |
| readability | قابلية القراءة | |
| track changes | تعقب التغييرات | |
| version | إصدار | App version and saved versions. `Version {version}` → `الإصدار {version}`. |
| selection | التحديد | |
| flavor (of Markdown) | صيغة | Detected flavor: الصيغة المكتشفة. |
| viewer | عارض | `{format} viewer` → `عارض {format}`. |

### Language features

| English | Arabic | Notes |
| --- | --- | --- |
| keyboard (typing layout) | لوحة المفاتيح | `Keyboard: {layout}` → `لوحة المفاتيح: {layout}`. Typing keyboard: لوحة مفاتيح الكتابة. |
| layout (keyboard layout) | تخطيط لوحة المفاتيح | |
| keyboard shortcut | اختصار لوحة المفاتيح | Short: اختصار. Keyboard shortcuts: اختصارات لوحة المفاتيح. |
| On-screen keyboard | لوحة المفاتيح على الشاشة | Short button `On-screen`: على الشاشة. |
| Switch keyboard | تبديل لوحة المفاتيح | |
| Phonetic / Standard | صوتية / قياسية | Keyboard names; `Arabic (101)` → `العربية (101)`. |
| aarab / harakat | التشكيل | The vowel marks. One mark: حركة. Remove Aarab: إزالة التشكيل; Hide Aarab: إخفاء التشكيل; From Word List: من قائمة الكلمات. |
| zabar / zer / pesh | فتحة / كسرة / ضمة | Ribbon buttons. |
| shadd / jazm | شدة / سكون | |
| tanween zabar / zer / pesh | تنوين الفتح / تنوين الكسر / تنوين الضم | |
| khari zabar / khari zer / ulta pesh | ألف خنجرية / كسرة قائمة / ضمة مقلوبة | Urdu marks; keep the Arabic names. |
| hamza above | همزة علوية | |
| half space / joiner | نصف مسافة / واصل | ZWNJ / ZWJ. |
| interface language | لغة الواجهة | Not Office's "لغة العرض" (عرض is the View tab). |
| document language | لغة المستند | |
| proofing language | لغة التدقيق | |
| right to left / left to right | من اليمين إلى اليسار / من اليسار إلى اليمين | Page direction: اتجاه الصفحة. |
| Writing Assistant | مساعد الكتابة | The side pane. |
| writing goals / Goals | أهداف الكتابة / الأهداف | Audience: الجمهور; Formality: الرسمية; Domain: المجال. |
| Writing sprint / Sprint | جلسة كتابة مؤقتة / جلسة مؤقتة | A timed writing session. |
| streak / daily goal | أيام متتالية / الهدف اليومي | |
| spelling | التدقيق الإملائي | Short: الإملاء. Spelling & Grammar: التدقيق الإملائي والنحوي. |
| grammar | التدقيق النحوي | Short: النحو. |
| suggestion | اقتراح | Suggest words: اقتراح الكلمات. |
| correctness / clarity / engagement / delivery | الصحة / الوضوح / التفاعل / الأسلوب | Writing Assistant categories. |
| thesaurus / synonyms / antonyms | قاموس المرادفات / مرادفات / أضداد | |
| my dictionary | قاموسي | Word list: قائمة الكلمات. |
| technical terms | المصطلحات التقنية | |
| language pack | حزمة لغة | Language packs: حزم اللغات. |
| add-in | وظيفة إضافية | As in Office. Plural: وظائف إضافية. |
| Add-in Store | متجر الوظائف الإضافية | |
| macro | ماكرو | Plural وحدات ماكرو (Office). Record macro: تسجيل ماكرو; Macro editor: محرر الماكرو. |
| Python console | وحدة تحكم Python | Console: وحدة التحكم. |
| feature (optional download) | ميزة | Features page: الميزات. Install {feature}: تثبيت {feature}. Optional: اختيارية. |
| bundled / built in | مضمّنة مع Markooj / مدمج | |
| slash commands | أوامر الشرطة المائلة | |
| multiple cursors | مؤشرات متعددة | Cursor: المؤشر. |

### File terms

| English | Arabic | Notes |
| --- | --- | --- |
| file | ملف | |
| folder | مجلد | Open folder: فتح المجلد. |
| path | مسار | |
| export | تصدير | `Export as PDF…` → `تصدير بتنسيق PDF…`. |
| import | استيراد | |
| file format | تنسيق الملف | Format (of a file): تنسيق. |
| PDF | PDF | |
| Word document | مستند Word | |
| web page | صفحة ويب | |
| plain text | نص عادي | |
| recovery / Recover | استرداد | |
| recovery copy | نسخة استرداد | |
| recovered | مستردّ | `{name} (recovered)` → `{name} (مستردّ)`. |
| backup | نسخة احتياطية | |
| autosave | الحفظ التلقائي | |
| unsaved changes | تغييرات غير محفوظة | |
| recent files | الملفات الأخيرة | |
| download / downloading… | تنزيل / جارٍ التنزيل… | |
| loading… | جارٍ التحميل… | |
| install / installed / not installed | تثبيت / مثبّت / غير مثبّت | |
| license | الترخيص | Third-party notices: إشعارات الجهات الخارجية. Credits: شكر وتقدير. |
| privacy | الخصوصية | |
| feedback | الملاحظات | |
| About | حول | About Markooj: حول Markooj. |
| What's new | ما الجديد | |
| Reference manual | الدليل المرجعي | |
| Repair Markooj | إصلاح Markooj | |
| settings | الإعدادات | A single setting: إعداد. Options (the File page) stays خيارات. |

### Terms added in the native review (2026-11-28)

| English | Arabic | Notes |
|---|---|---|
| Click (in instructions) | انقر فوق | Office wording; also «انقر نقرًا مزدوجًا», «انقر بزر الماوس الأيمن». Not «انقر على». |
| pointer (mouse) | مؤشر الماوس | المؤشر alone is the text cursor (caret). |
| match (find result) | تطابق، التطابقات | Find next / previous → بحث عن التالي / السابق. Match case → مطابقة حالة الأحرف. |
| regular expression / pattern | تعبير عادي / نمط بحث | |
| word target | عدد الكلمات المستهدف | Puts the number after the noun, so no agreement is needed. |
| display equation / inline | معادلة مستقلة (في سطر مستقل) / مضمّنة | |
| live preview | معاينة مباشرة | |
| Render as (flavor) | العرض بصيغة | صيغة = Markdown flavor; «بلغة Markdown» = the markup itself. |
| Edit as text | تحرير كنص | In «» inside sentences. |
| body text | النص الأساسي | |
| Change Case items | حالة الجملة، أحرف صغيرة، أحرف كبيرة، حرف كبير في بداية كل كلمة، تبديل حالة الأحرف، حالة العنوان | Arabic has no case; these describe Latin text. All caps → كل الأحرف كبيرة, Small caps → أحرف استهلالية صغيرة. |
| Style gallery sample (Aa) | أبجد / «أبجد» | Arabic counterpart of AaBbCc. |
| Promote / Demote (outline) | رفع المستوى / خفض المستوى | As in Word's Outlining tab. |
| Go To | الانتقال إلى | |
| Recent / Recent files / Recent file / Open recent | الأخيرة / الملفات الأخيرة / ملف مستخدم مؤخرًا / فتح ملف مستخدم مؤخرًا | «ملف حديث» reads as "new file". |
| Left (document tab position) | يمين | The interface is mirrored: the "left" tab list and the outline sit on the right in Arabic (checked on screen). Sentences about them say «على اليمين». |
| Back (tutorial step) | السابق | Pairs with التالي. Help window Back stays رجوع. |
| Installed (add-ins, languages) | المثبّتة / مثبّتة | Always with shadda. |
| browser | المستعرض | Never المتصفح. |
| terminal | الوحدة الطرفية | The macOS app name Terminal stays Latin. |
| package manager | مدير الحزم | |
| security software | برنامج الحماية | |
| crash | التوقف المفاجئ | |
| recovery store / get back (text) | مخزن الاسترداد / استعادة | |
| tour / guided tour | جولة / جولة إرشادية | |
| practice document | مستند تدريبي | |
| sprint (writing) | جلسة كتابة مؤقتة (short: جلسة مؤقتة) | |
| Set goal / Set target | تعيين الهدف | |
| Created / Modified | تاريخ الإنشاء / تاريخ التعديل | File → Info rows. |
| Subject / Keywords / Abstract / Authors | الموضوع / الكلمات الأساسية / الملخص / المؤلفون | |
| Text to show / Address (link) | النص المراد عرضه / العنوان | As in Word's Insert Hyperlink. |
| No highlight | بلا تمييز | Highlight → تمييز. |
| Accent (table style) | تمييز | As Office's Accent colors. |
| Writing score; Excellent / Good / Getting there / Needs work | درجة الكتابة؛ ممتاز / جيد / مقبول / يحتاج إلى تحسين | |
| audience / tone / domain | عام، مطّلع، متخصص / غير رسمي، محايد، رسمي / أكاديمي، أعمال | |
| passive voice / hedging / wordy phrases / contractions | المبني للمجهول / عبارات التحفظ / العبارات المطوّلة / الصيغ المختصرة | |
| Hijri date shift | تعديل التاريخ الهجري (يوم واحد للخلف / حسب الحساب (أم القرى) / يوم واحد للأمام) | |
| Shahmukhi | شاهمخي | One spelling everywhere. |
| Space (on-screen keyboard key) | مسافة | Exception to the Latin key-name rule: a visible key label and screen-reader name. In shortcuts it stays `Space`. |
| braces / brackets | أقواس معقوصة {} / أقواس مربعة [] / أقواس هلالية () | |
| backslash | شرطة مائلة عكسية | |
| operator (math) / argument (macro) / definition (macro) | مؤثر / وسيطة / تعريف | |
| repository / manifest | المستودع / ملف manifest | |
| trash | سلة المحذوفات | |
| community add-ins | الوظائف الإضافية من المجتمع | |
| Output (panel) | الإخراج / لوحة الإخراج | |
| Second view / split divider / Stacked | العرض الثاني / فاصل التقسيم / أحدهما فوق الآخر | |
| Flesch reading ease / grade level / Word Frequency | سهولة القراءة (Flesch) / المستوى الدراسي / تكرار الكلمات | |
| scan / OCR | مستند ممسوح ضوئيًا / التعرف الضوئي على النصوص (OCR) | |
| source code | التعليمات البرمجية المصدر | |
| Credits and Licenses | شكر وتقدير وتراخيص | |
| hyphenation / text encoding / page thumbnails | الواصلة / ترميز النص / الصور المصغرة للصفحات | |
| Rich Text / e-book / slides / Jupyter notebook | نص منسق / كتاب إلكتروني / شرائح / دفتر Jupyter | |
| sans serif | بلا زوائد | |
| templates | ورقة بحثية، دفتر مختبر، فصل من أطروحة، محضر اجتماع، مراجعة الأدبيات | |
| Markdown chips | ارتباطات ويكي، حاويات، وسائل شرح | |
| keyboard focus | تركيز لوحة المفاتيح | |
| file extension in a sentence | `‎.md` | A left-to-right mark (U+200E) before the dot keeps it in front of the extension in right-to-left text. |

## Decisions and open questions

- 2026-11-27: Western digits (0–9) throughout the interface, matching the rest of the app and `intl: ar` (which formats
  with Western digits). Arabic-Indic digits are not used anywhere in the catalogs.
- 2026-11-27: commands are verbal nouns (حفظ), sentences use the masculine singular imperative as the generic form (اختر).
- 2026-11-27: editing modes: Word stays `Word`; Inline → مضمّن, Simple → بسيط, Read → قراءة.
- 2026-11-27: citation → استشهاد (not Word's اقتباس), because اقتباس is the block quote.
- 2026-11-27: Cancel → إلغاء الأمر (Windows/Office button); Download → تنزيل; status bar → شريط المعلومات; theme → نسق.
- 2026-11-27: ruler guide → خط إرشادي (not دليل, which means manual).
- 2026-11-27: interface language → لغة الواجهة (not لغة العرض).
- 2026-11-27: quotation marks «…»; menu-path arrow ←.
- 2026-11-28 (screenshots): Latin names, file names and `{name}` at the end of a sentence render on the correct side; no direction marks are needed except U+200E before a file extension (`‎.docx`). The interface mirrors fully, so a "left" side panel or tab list is on the right in Arabic.
- 2026-11-28: "Click" is انقر فوق everywhere (Office wording).

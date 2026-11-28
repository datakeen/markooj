# Roman Urdu glossary for Markooj

Code `ur-Latn` · left to right · plural categories `one`, `other` · the translation rules are in [docs/I18N.md](../../docs/I18N.md).

Every catalog file (`shell`, `app`, `editors`, `language`, `system`) follows this page. To change a term, change it here
first, then everywhere it appears. If a word you need is not here, pick the most common everyday form, follow the
spelling rules below, and add the word to the table.

**Who reads this interface.** Pakistani students and researchers who use Microsoft Word, usually in English, and who chat
in Roman Urdu every day. The interface must read like a careful, educated person typing on their phone: plain Urdu, no
Persianized literary style, no word-for-word English, and English only where Pakistanis really say the English word.

**Where the terms come from.** There is no Roman Urdu edition of Microsoft Office. The terms below start from Microsoft's
Urdu (Arabic script) Office and Windows terminology, written in Latin letters (for example محفوظ کریں → *Mehfooz karein*,
حوالہ جات → *Hawala jaat*, جائزہ → *Jaiza*, تبصرہ → *Tabsira*). Where Microsoft's Urdu word is stiff and people really say
the English word (کالعدم کریں for Undo, چسپاں کریں for Paste, حذف کریں for Delete), we use what people say instead.

---

## 1. Register and voice

- **Address the user as *aap*.** Polite imperative ending in **-ein**: *karein, kholein, chunein, likhein, dekhein*.
  After a vowel stem use **-yein**: *dikhayein, chhupayein, hatayein, mitayein, chalayein, dabayein, banayein, aazmayein*.
- **Never** *kijiye / farmaiye* (too formal and long), **never** *karo / kholo* (too casual), never *tum*.
- **Plain educated Urdu.** Prefer *zaroori, mumkin, dobara, pehle, baad mein, maujood, tayyar* over rare Arabic or
  Persian words. If a sixth-form student would stop to think about a word, use a simpler one.
- **Solution first, as in English.** The first sentence says what to do; then what happened; then what still works.
  Keep the same order of sentences as the English.
- **Short labels stay short.** Ribbon buttons, tabs, switch labels and status-bar items should be about as long as the
  English (the check script warns above twice the length). Drop *karein* only where a noun is the natural label
  (Table, Tasveer, Equation), never on a verb button.
- **Word order is Urdu:** object first, verb last. *Save the document* → *Document mehfooz karein*, not *Mehfooz karein document*.
- **Questions in dialogs** end with *karein?*: *Tabdeeliyan mehfooz karein?*
- **Finished actions** (toasts): *ho gaya / ho gayi / ho gaye*, or an invariant word to avoid gender agreement:
  *Copy ho gaya.* · *Mehfooz ho gaya.* · *{name} tayyar hai.*

**Three short examples**

| English | Roman Urdu |
| --- | --- |
| Try again, or choose another format. Markooj could not finish the {format} file; your document is unchanged. | Dobara koshish karein, ya koi aur format chunein. Markooj {format} file mukammal nahin kar saka; aap ka document waisa hi hai. |
| Save changes to “{name}”? | “{name}” mein tabdeeliyan mehfooz karein? |
| Click Cite or press <kbd>Ctrl+Shift+C</kbd>, type part of an author or a title, and press Enter. | “Hawala dein” par click karein ya <kbd>Ctrl+Shift+C</kbd> dabayein, musannif ya unwaan ka kuch hissa likhein aur Enter dabayein. |

---

## 2. Spelling scheme (one spelling for every word)

There is no official Roman Urdu spelling. Markooj uses this one everywhere:

| Sound | Write | Examples |
| --- | --- | --- |
| long a (آ / ا) | **aa** inside a word; **a** at the end (see the exceptions below) | *kaam, baad, aap, daakhil, haashiye, zabaan, talaash*; at the end *safha, khaaka, faasla* |
| short a | **a** | *ab, sab, kam, qadam* |
| long i (ی) | **ee** inside a word; **i** at the end | *tabdeel, tafseel, tasveer, neeche*; *bhi, abhi, zaroori, haaliya, likhaai* |
| short i | **i** | *is, kisi, likhein, misaal* |
| long u (و) | **oo** inside a word; **u** at the end | *mehfooz, mansookh, qubool, mauzoo*; at the end *shuru, laagu* |
| short u | **u** | *kuch, ruk, us* |
| e (ے) | **e**; before nasal *n* **ei** | *ke, se, pehle, naye*; *mein, karein, kholein* |
| ai (ہے, ہیں) | **ai** | *hai, hain, baithein* |
| o (و) | **o** | *ko, log, kholein, dono* |
| au | **au** | *aur, taur, maujood* |
| nasal n (ں) | **n** | *mein, hain, nahin, karein, kahin, yahan* |
| ain (ع), hamza (ء) | **not written** | *maloom* (not ma'loom), *masla, shuru, tareeqa, jama* |
| خ / غ / ق | **kh / gh / q** | *khol, ghalti, qism, qubool, qataar* |
| ش / چ / ژ | **sh / ch / zh** | *shaamil, chunein* |
| aspirates | **bh, ph, th, dh, kh, gh, chh, jh** | *bhi, phir, saath, dhoondein, chhupayein, chhota, samjhein* |
| ٹ ڈ ڑ | plain **t, d, r** | *tootna, parhein, bara, chhota* |
| ز ذ ض ظ | **z** | *zaroori, zariye, hazir, nazar* |
| س ص ث | **s** | *safha, sabaq, sahih* |
| ح ہ | **h** | *hissa, hawala, haalat* |
| izafat | **-e-** with hyphens, only in fixed terms | *Fehrist-e-mazameen, nazar-andaaz* |

**Established spellings with one *a*.** A few very common words are always typed with one *a*, and we keep that:
*hawala (hawale, hawalon, Hawala jaat), dobara, wapas, tamam, zyada, darmiyan, darmiyana, rozana, alamat, iqtibas,
kitabiyaat, riyazi, paimana, maloomat, khulasa, mawazna, tajaveez, nataij, masail*, and the verb ending **-ayein** (*dikhayein,
chhupayein, hatayein, layein*). Infinitives of these verbs also keep one *a*: *dikhane, chhupane, hatane, lagane, mitane,
chalane, banane* (not *hataane*). Everything else follows the table: *jaata/jaati/jaate, baaqi, mutaabiq, dauraan,
ijaazat, izaafi, barqaraar, zaaya, kharaab, saakin, peechhe, poochhein, bohat* (not *bahut*), *had* (limit).

**Language names** are typed the established way: *Angrezi, Arabi, Farsi, Ibraani, Turki, Roosi, Cheeni, Japani, Koriyai,
Jarman, Fransisi, Hispanvi, Italvi, Purtagaali*; *English, Dutch, Hindi, Swedish* stay English.

**Fixed spellings of frequent words** (do not vary them): *hai, hain, mein* (in), *nahin, karein, ka/ke/ki, ko, se,
par* (not *pe*), *aur, ya, bhi, ab, abhi, pehle, baad, baad mein, phir* (then — **never *tab***, which is the UI word
tab), *dobara, sab, tamam, kuch, koi, yahan, wahan, jab, agar, to, warna, taake, lekin, sirf, zyada, kam, behtar,
yeh, woh, isay, usay* (not *ise/use*: *use* reads as English), *is, us, inhein, unhein, aap ka/ki/ke* (two words),
*apna/apni/apne, kya, kyun, kaise, kaun, kitne, chahiye, sakte/sakta/sakti, raha/rahi/rahe, gaya/gayi/gaye,
hua/hui/hue, liye, wala/wali/wale, zariye* (*ke zariye*), *baghair* (not *bina*), *baare* (*ke baare mein*),
*taur* (*ke taur par*), *saath, jagah, tarah, bajaye, hamesha, kabhi, upar, neeche, andar, bahar, daayein, baayein,
darmiyan, naya/nayi/naye, purana, pehla, agla/agli/agle, pichhla/pichhli/pichhle, doosra, aakhri, aasaan, mushkil,
maujood, dastiyaab, mukammal, tayyar, zaroori, mumkin, waqt, tareeqa, masla, ghalti, shuru, khatam, maslan* (for example).

**Capital letters.** Sentence case, as in the English source: capital only on the first word of a label or sentence, on
names (Markooj, Word, Excel, Pandoc, KaTeX, Mermaid, Markdown, LaTeX, GitHub, Python, PDF), on key names, and when a
sentence names a ribbon tab, button or page by its label (*Home tab*, *File → Bahaali*). English loanwords inside a
sentence are lower case: *file kholein, table daakhil karein, link copy karein*.

---

## 3. English words that stay English

Pakistanis say these in English, so they stay English (lower case inside sentences): **file, folder, document, table,
cell, column, link, font, tab, ribbon, mode, text, code, format, style, theme, macro,
add-in, feature, version, update, install, download, export, import, copy, paste, cut, print, click, double-click,
scroll, zoom, shortcut, keyboard,
layout, window, panel, label, caption, footnote, equation, figure, heading, paragraph, list, bullets, numbering,
checklist, grammar, data, path, internet, online, store, console, output, backup, sprint, tour, default, on/off**.

Verbs from these words use **karein**: *install karein, download karein, update karein, copy karein, paste karein,
print karein, export karein, click karein, scroll karein, record karein, reset karein, on karein, off karein*.

**Gender of loanwords** (decides *ka/ki*, *gaya/gayi*, *naya/nayi*):

| Masculine | Feminine |
| --- | --- |
| document, table, column, cell, folder, link, font, tab, ribbon, mode, paragraph, macro, add-in, feature, version, update, label, caption, footnote, shortcut, keyboard, layout, panel, format, style, theme, code, text, data, path, console, status bar, group, item, tour, sprint, backup, PDF, Markdown, safha, tabsira, hawala, khaaka, paimana, saancha, hadaf, sabaq, maakhaz, masla | file, window, equation, figure, heading, list, command, grammar, line (*satar*), qataar, tasveer, zabaan, tajveez, tabdeeli, ghalti, tanbeeh, lughat, khusoosiyaat, maloomat, tareekh, alamat, guide, library, checklist, setting(s) |

**Plural of loanwords:** English loanwords keep the English *-s* (*files, tables, documents, add-ins, macros, links,
equations, columns, updates, features*). Urdu words keep Urdu plurals (*safhaat, tabsire, hawale, tajaveez,
tasveerein, tabdeeliyan, qataarein, satrein, alfaaz, haashiye, saanche*).

If the check script warns “same as English” for a string that is right in English (*File, Font, Bold, Zoom, Version,
Data, Code, Clipboard, Python console …*), add it to an `"@same": [ … ]` list at the top of that group file.

---

## 4. Punctuation, numbers and dates

- **Latin punctuation:** `.` `,` `?` `!` `:` `;` — never the Urdu full stop `۔` or the Arabic comma `،`.
- **Quotation marks:** curly “ ” as in the English (‘ ’ inside quotes). Use them to name a button or command whose label
  is a verb phrase, so it is not read as part of the sentence: *“Text ke taur par tarmeem” istemaal karein.*
- **Arrows:** keep `→` paths exactly in that order: *File → Options → Zabaan*, *Home → Styles → Heading 1*.
- **Digits:** Western digits 0–9 only. `{count}` is formatted by Markooj (12,345); never write digits as words.
- **Units:** keep *KB, MB, GB, pt, in, cm, mm, s, min, %* as in English. *{percent}%* with no space. *{size} MB*.
- **Time words:** *abhi abhi* (just now), *{count} minute pehle*, *{count} ghante pehle*, *{count} din pehle*,
  *aaj {time} baje*, *kal {time} baje* (yesterday), *{date}, {time} baje*. Minutes: *minute* (sing. and pl.),
  abbreviation *min*; hours *ghanta / ghante*, abbreviation *h* (as English).
- **“X of Y” counters:** *Safha {current} / {total}*, *{index} / {count}*; in a sentence *{total} mein se {current}*.
- **Dashes and dots:** keep `—` `–` `·` `×` as in the English.

## 5. Placeholders, shortcuts and HTML in sentences

- Keep every `{placeholder}` exactly (same spelling, same braces). Move it to where Urdu word order needs it:
  *Saved {name}* → *{name} mehfooz ho gaya*; *Remove {name}?* → *{name} hata dein?*; *Install {feature}* → *{feature} install karein*.
- Postpositions follow the placeholder with a space: *{name} ko, {name} mein, {name} ka/ki/ke, {name} se*.
- **Unknown gender:** when `{name}` could be masculine or feminine, use an invariant word (*tayyar hai, mukammal hai,
  band hai, on hai, maujood nahin*) or agree with the hidden noun in the English note (a document title → masculine;
  a file name → feminine; a feature or add-in → masculine).
- **Shortcuts and keys** stay in Latin letters exactly as written: `Ctrl+S`, `Alt+Q`, `Shift+Enter`, `Esc`, `F1`, `Tab`,
  `Backspace`, `Space`, `Page Up`. In a sentence: *Ctrl+S dabayein*; *(Esc)* stays in brackets; *Ctrl+Enter se laagu karein*.
- Tags `<kbd>`, `<b>`, `<code>` stay around the same words: *<kbd>Alt+Q</kbd> dabayein aur likhein ke aap kya karna chahte hain.*
- Text the user types into the document (`@eq:{label}`, `$$`, `/hijri`, `%%note%%`, front-matter keys like `lang`) is
  never translated.

## 6. The ellipsis “…”

Keep the single character `…` (never three dots) on every label that has it in English: it means a dialog opens.
Because the verb comes last in Urdu, the `…` goes at the **very end of the whole Urdu label**, with no space before it:

| English | Roman Urdu |
| --- | --- |
| Save as… | Bataur mehfooz karein… |
| Open… | Kholein… |
| Insert table… | Table daakhil karein… |
| Go to page… | Safhe par jayein… |
| Language options… | Zabaan ke options… |

Progress text keeps `…` too: *Loading…* → *Load ho raha hai…*; *Checking…* → *Jaanch ho rahi hai…*;
*Installing…* → *Install ho raha hai…*; *Downloading…* → *Download ho raha hai…*

---

## 7. Terms

Ribbon tabs and groups use Microsoft's Urdu Office names where Microsoft has an Urdu word (Daakhil karein, Hawala jaat,
Jaiza, Manzar, Madad), and the English word where Microsoft's Urdu Office also keeps it (File, Home, Layout, Developer).

### 7.1 Ribbon tabs

| English | Roman Urdu | Notes |
| --- | --- | --- |
| File (tab and page) | File | As in Urdu Office (فائل). |
| Home | Home | As in Urdu Office (ہوم). |
| Insert@@ribbon tab / Insert (tab) | Daakhil karein | Urdu Office داخل کریں. In running text quote it: *“Daakhil karein” tab*. |
| Layout | Layout | Page layout tab. |
| References | Hawala jaat | Urdu Office حوالہ جات. |
| Review | Jaiza | Urdu Office جائزہ. |
| View | Manzar | Urdu Office منظر. |
| Help | Madad | Tab, page and group. |
| Developer | Developer | As in Urdu Office. |
| Add-ins | Add-ins | Tab and group. |
| Table Design | Table ka design | Contextual tab. |
| Table Layout | Table ka layout | Contextual tab. |
| Table Tools | Table ke tools | Heading over the two table tabs. |

### 7.2 Ribbon groups

| English | Roman Urdu | Notes |
| --- | --- | --- |
| Clipboard | Clipboard | Home. |
| Font | Font | Home. |
| Paragraph | Paragraph | Home. |
| Direction | Simt | Home: text direction. |
| Styles | Styles | Home. |
| Editing | Tarmeem | Home (Find, Replace, Select all). |
| Aarab | Aarab | Home: the aarab group. |
| Illustrations | Tasveeri mawaad | Insert (Table, Picture, Diagram). |
| Blocks | Blocks | Insert (Equation, Code, Callout). |
| Links & pages | Links aur safhaat | Insert. |
| Notes & sources | Notes aur maakhaz | Insert. |
| Text | Text | Insert (Symbol, Date & time). |
| Pictures | Tasveerein | Insert. |
| Page setup | Safha setup | Layout. |
| Spacing | Faasla | Layout. |
| Document theme | Document theme | Layout. |
| Footnotes | Footnotes | References. |
| Table of contents | Fehrist-e-mazameen | References. |
| Citations & bibliography | Hawale aur kitabiyaat | References. |
| Captions / Captions & numbering | Captions / Captions aur numbering | References. |
| Proofing | Jaanch | Review. |
| Writing@@ribbon group | Likhaai | Review and View. |
| Comments | Tabsire | Review. |
| Versions | Versions | Review. |
| Language | Zabaan | Review; also the Options section. |
| Views | Manaazir | View (Print layout, Web layout, Read mode). |
| Show@@ribbon group | Dikhayein | View. |
| Zoom | Zoom | View. |
| Mode@@ribbon group | Mode | View. |
| Window@@ribbon group | Window | View. |
| Keyboard | Keyboard | View. |
| Theme | Theme | View. |
| Tables | Tables | View. |
| Commands | Commands | View. |
| Writing goals | Likhaai ke ahdaaf | View. |
| Code@@ribbon group | Code | Developer. |
| Run@@macro | Chalayein | Developer: run a macro. |
| Math@@ribbon group | Riyazi | Developer: math macros. |
| My macros | Mere macros | Developer. |
| Store@@ribbon group | Store | Add-ins. |
| Installed@@add-ins | Install shuda | Add-ins. |
| Readability | Parhne ki aasaani | Add-in group and report. |
| Units / SI Units | Units / SI units | Add-in group. |
| Word frequency | Alfaaz ki takraar | Add-in group. |
| About | Baare mein | Help. *About Markooj* → *Markooj ke baare mein*. |
| Features | Features | Help; File → Options page. |
| Feedback | Feedback | Help. |
| Welcome | Khush aamdeed | Help; the Welcome screen. |
| Table Style Options | Table style ke options | Table Design. |
| Table Styles | Table styles | Table Design. |
| Convert | Shakal badlein | Table Layout group and button. |
| Rows & Columns | Qataarein aur columns | Table Layout. |
| Cell Size | Cell ka size | Table Layout. |
| Alignment | Seedh | Table Layout. |
| Data | Data | Table Layout (sorting). |

### 7.3 Common commands and buttons

| English | Roman Urdu | Notes |
| --- | --- | --- |
| Save | Mehfooz karein | Never *save karein*. Toast: *Mehfooz ho gaya*. |
| Save as / Save As | Bataur mehfooz karein | Urdu Office بطور محفوظ کریں. *Save As…* → *Bataur mehfooz karein…* |
| Save all | Sab mehfooz karein | |
| Save a copy | Copy mehfooz karein | |
| Don’t Save | Mehfooz na karein | |
| Saved / Not saved yet | Mehfooz hai / Abhi mehfooz nahin | Title-bar states. |
| Edited (unsaved changes) | Tabdeeli hui | Title-bar state. **Never *ghair mehfooz*** (it means *unsafe*). |
| Unsaved changes | Tabdeeliyan mehfooz nahin huin | Same warning. |
| Open (verb) / Open… | Kholein / Kholein… | *Open@@verb*, *Open@@file page*, *Open@@dialog title*. |
| Open (state) | Khula | *Open documents* → *Khule documents*. |
| Close | Band karein | *Close document* → *Document band karein*. |
| New | Naya / Nayi | Agrees: *Naya document, Nayi window, Naya tabsira*. *New@@file page* → *Naya*. |
| Recent | Haaliya | Urdu Office حالیہ. *Recent files* → *Haaliya files*. |
| Undo | Wapas lein | |
| Redo | Dobara karein | |
| Repeat | Dohrayein | |
| Cut | Cut karein | Ribbon: *Cut karein*. |
| Copy | Copy karein | Toast *Copied* → *Copy ho gaya*. |
| Paste | Paste karein | |
| Paste as plain text | Saada text paste karein | |
| Format painter | Format painter | Word’s name. |
| Find | Talaash karein | Noun (search box title): *Talaash*. |
| Find next / Find previous | Agla talaash karein / Pichhla talaash karein | |
| Replace | Tabdeel karein | Urdu Office تبدیل کریں. |
| Replace all | Sab tabdeel karein | |
| Find and replace | Talaash aur tabdeeli | |
| Search@@verb | Talaash karein | |
| Search (noun) | Talaash | |
| Select | Chunein | *Select all* → *Sab chunein*; *Select Row* → *Qataar chunein*. |
| Selected / selection | Chuna hua / chuna hua hissa | *the selected text* → *chuna hua text*. |
| Choose / Pick | Chunein | |
| Insert (verb) / Insert@@verb | Daakhil karein | *Insert table* → *Table daakhil karein*. |
| Add | Shaamil karein | Short button may be *Shaamil*. *Added* → *Shaamil hai*. |
| Delete | Mitayein | *Delete all* → *Sab mitayein*; *Deleted* → *Mita diya*. Never *hazf*. |
| Remove | Hatayein | *Remove {name}?* → *{name} hata dein?* |
| Clear | Saaf karein | Empties a box or panel. |
| Change | Badlein | *Change to* → *Is se badlein*. |
| Convert | Badlein | *Convert to Text* → *Text mein badlein*. |
| Edit (verb) / Edit@@verb | Tarmeem karein | *Edit link* → *Link mein tarmeem karein*. |
| Edit (menu, group) | Tarmeem | *Edit@@leave read mode* → *Tarmeem*. |
| Options | Options | *File → Options*. Pakistanis say *options*. |
| Settings | Settings | |
| Help | Madad | |
| Cancel | Mansookh karein | Urdu Office منسوخ کریں. |
| OK | OK | Same as English (allowed). |
| Apply | Laagu karein | |
| Reset | Reset karein | |
| Yes / No | Haan / Nahin | |
| Install | Install karein | Tag *Installed* → *Install shuda*. *Installing…* → *Install ho raha hai…* |
| Uninstall | Uninstall karein | |
| Download | Download karein | |
| Update (verb) / Updates | Update karein / Updates | *Up to date* → *taaza*: *Sab add-ins taaza hain.* |
| Try again | Dobara koshish karein | |
| Check / Check again | Jaanchein / Dobara jaanchein | |
| Details | Tafseel | *Copy details* → *Tafseel copy karein*. |
| Technical details | Technical tafseel | |
| Learn more | Mazeed jaanein | |
| Don’t show again | Dobara na dikhayein | |
| Show / Hide | Dikhayein / Chhupayein | |
| Not now / Later | Abhi nahin / Baad mein | |
| Continue | Jaari rakhein | |
| Done | Ho gaya | |
| Next / Previous | Agla / Pichhla | Agrees: *Agla safha, Agli window*. |
| Back | Wapas | *Back to document* → *Document par wapas*. |
| Skip | Chhor dein | |
| Start / Stop | Shuru karein / Rokein | |
| Run (macro, code) | Chalayein | |
| Record | Record karein | *Recording* → *Recording ho rahi hai*. |
| Reload / Restart | Dobara load karein / Dobara shuru karein | |
| Rename… | Naam badlein… | |
| Print / Print… | Print karein / Print karein… | |
| Print preview / Preview | Print ki jhalak / Jhalak | |
| Export / Export… | Export karein / Export karein… | |
| Import | Import karein | |
| Browse… | Talaash karein… | Opens a file picker. |
| Accept / Accept all | Qubool karein / Sab qubool karein | |
| Ignore / Ignore all | Nazar-andaaz karein / Sab nazar-andaaz karein | |
| Dismiss | Band karein | |
| Fix (verb) | Theek karein | Noun *fix* → *durusti*, pl. *durustiyan*. *Safe fixes* → *be-khatar durustiyan*. |
| Turn on / Turn off | On karein / Off karein | Switch tooltips *On@@switch / Off@@switch* → *On / Off*. |
| Click / Double-click | Click karein / Double-click karein | *Click File.* → *File par click karein.* |
| Press (a key) | Dabayein | *Press Alt* → *Alt dabayein*. |
| Type (text) | Likhein | *Type a name* → *Naam likhein*. |
| Drag | Drag karein | |
| Go to | … par jayein | *Go to page* → *Safhe par jayein*. |
| Compare | Mawazna karein | |
| Report a problem | Masla report karein | |
| Copy path / Show in folder | Path copy karein / Folder mein dikhayein | |
| Look up | Dekhein | *Look up a word* → *Lafz dekhein*. |
| Zoom in / Zoom out | Bara karein / Chhota karein | |

### 7.4 Markooj’s editing modes

The four names stay recognizable on a small switch (about 8 characters). *Word* is Microsoft Word: always *Word*.

| English | Roman Urdu | Notes |
| --- | --- | --- |
| Word mode | Word mode | Switch label *Word*. |
| Inline mode / Inline@@editing mode | Inline mode / Inline | Technical name, kept. |
| Simple mode / Simple@@editing mode | Saada mode / Saada | |
| Read mode / Read@@editing mode | Parhne ka mode / Parhein | Oblique: *Parhne ke mode mein*. |
| Editing mode | Tarmeem ka mode | |
| Word → Inline → Simple → Read | Word → Inline → Saada → Parhein | |
| Read only (state) | Sirf parhne ke liye | |
| editable copy | tarmeem ke qaabil copy | |
| Focus / Full-screen mode | Focus / Poori screen | |

### 7.5 Document terms

| English | Roman Urdu | Notes |
| --- | --- | --- |
| document | document (m) | Never *dastavez*. |
| page | safha (m), pl. safhaat | Oblique *safhe*: *safhe ka size*. *Page {n}* → *Safha {n}*. |
| page break | Naya safha | Says what it does. |
| paragraph | paragraph (m) | |
| heading | heading (f) | Style names *Heading 1 … 6* stay as in Word. |
| title | unwaan (m) | Style *Title* → *Unwaan*; *Subtitle* → *Zeeli unwaan*. |
| Normal (style) | Normal | Word’s style name. |
| Quote (style) | Iqtibas | |
| list / bullets / numbering / checklist | list / Bullets / Numbering / Checklist | |
| indent | indent | *Increase indent* → *Indent barhayein*; *Decrease* → *Indent ghatayein*. |
| align left / center / align right / justify | Baayein seedh / Darmiyan / Daayein seedh / Dono taraf seedh | |
| left / right / top / bottom | baayein / daayein / upar / neeche | |
| left to right / right to left | Baayein se daayein / Daayein se baayein | |
| direction | simt (f) | |
| line (of text) | satar (f), pl. satrein | *Line spacing* → *Satron ka faasla*. *Line {line}* (code) → *Satar {line}*. |
| spacing / margins | faasla / haashiye | Margins presets: *Normal, Narrow → Tang, Wide → Chaura*. |
| size | size (m) | *Page size* → *Safhe ka size*. |
| table / cell | table (m) / cell (m) | |
| row / column | qataar (f), pl. qataarein / column (m) | *Header Row* → *Header qataar*; *Banded rows* → *Dhaari daar qataarein*. |
| gridlines | grid lines | |
| sort / ascending / descending | Tarteeb dein / Barhti tarteeb / Ghatti tarteeb | |
| caption | caption (m) | |
| figure | figure (f) | As in English-medium theses. |
| picture / image | tasveer (f), pl. tasveerein | |
| diagram | diagram (m) | |
| equation | equation (f) | *Equation editor* → *Equation editor*. |
| citation | hawala (m), pl. hawale | *Cite* → *Hawala dein*. |
| reference (an entry in the .bib library, a source) | maakhaz (m), pl. maakhaz | *{count} references* → *{count} maakhaz*. |
| cross-reference | cross-reference (m) | |
| bibliography | kitabiyaat (f) | |
| citation library / library | hawalon ki library / library (f) | |
| footnote | footnote (m) | |
| comment | tabsira (m), pl. tabsire | *New comment* → *Naya tabsira*. *Comment@@noun* → *Tabsira*. |
| hidden note | chhupa hua note | |
| note / tip / important / warning / caution (callouts) | Note / Mashwara / Aham / Tanbeeh / Ehtiyaat | |
| callout | callout | |
| quote / code block / divider | iqtibas / code block / lakeer | |
| symbol | alamat (f) | |
| date & time | tareekh aur waqt | |
| table of contents | fehrist-e-mazameen (f) | |
| outline | khaaka (m) | Urdu Office خاکہ. |
| front matter | front matter | Markdown term; note *settings block upar*. |
| properties / info | khusoosiyaat / maloomat | *Document properties* → *Document ki khusoosiyaat*. |
| author / subject / keywords / abstract | musannif / mauzoo / kaleedi alfaaz / khulasa | |
| template | saancha (m), pl. saanche | *New from template* → *Saanche se naya*. |
| style / theme / font | style / theme / font | *Font color* → *Font ka rang*; *Text color* → *Text ka rang*. |
| color | rang | |
| bold / italic / underline / strikethrough / highlight | Bold / Italic / Underline / Strikethrough / Highlight | Word’s names; descriptions in Urdu: *chuna hua text bold karein*. |
| subscript / superscript | Subscript / Superscript | |
| word / words | lafz / alfaaz | *{count} words* → one *{count} lafz*, other *{count} alfaaz*. |
| characters / sentences / paragraphs | huroof / jumle / paragraphs | |
| word count | alfaaz ki ginti | |
| word target / goal | hadaf (m), pl. ahdaaf | *Daily goal* → *Rozana hadaf*. |
| streak / sprint | silsila / sprint | |
| statistics | shumaariyaat | |
| version / versions | version / versions | |
| change(s) | tabdeeli (f), pl. tabdeeliyan | *Track changes* → *Tabdeeliyan track karein*. |
| Markdown flavor | Markdown ki qism | |
| math | riyazi | Math names (fraction, integral, matrix…) stay English, as in English-medium textbooks. |

### 7.6 Window and interface

| English | Roman Urdu | Notes |
| --- | --- | --- |
| window | window (f) | *New Window* → *Nayi window*. |
| pane | panel (m) | *Second pane* → *Doosra panel*. Never *pane*. |
| ribbon | ribbon (m) | |
| tab (ribbon or document) | tab (m) | *Document tabs* → *Document tabs*. |
| group (ribbon group) | group (m) | |
| status bar | status bar (m) | |
| title bar | title bar (m) | |
| quick access | Fori rasaai | Word’s Quick Access Toolbar. |
| command | command (f) | |
| command search / palette (Alt+Q) | Command talaash | |
| ScreenTip / KeyTips | ScreenTip / KeyTips | Word’s names. |
| keyboard shortcut | keyboard shortcut (m) | |
| ruler | paimana (m) | |
| guide (ruler) | guide (f) | *Horizontal guide* → *Pari guide*; *Vertical* → *Khari guide*. |
| split | taqseem (f) | *Split panes* → *Taqseem shuda panel*; *Remove Split* → *Taqseem khatam karein*. |
| side by side / stacked | saath saath / upar neeche | *View Side by Side* → *Saath saath dekhein*. |
| synchronous scrolling | ek saath scroll | |
| zoom | zoom | *Fit page width* → *Safhe ki chauraai ke baraabar*. |
| theme light / dark / match system | Light / Dark / System jaisa | |
| print layout / web layout | Print layout / Web layout | |
| Welcome screen / tour / tutorial | Khush aamdeed screen / tour / sabaq (pl. asbaaq) | *Take the tour* → *Tour karein*. |
| tip | mashwara | |
| automatic / auto | khudkaar / khud | |
| default | default | *{font} (default)* → *{font} (default)*. |
| none / all / other / more | koi nahin / sab / deegar / mazeed | |
| always / never | hamesha / kabhi nahin | |
| ready / loading | tayyar / load ho raha hai | |
| name / value / type / category / status | naam / qeemat / qism / zumra / haalat | |
| example / sample / practice | misaal (f) / namoona (m) / mashq (f) | |
| error / warning / problem | ghalti (f) / tanbeeh (f) / masla (m) | |
| privacy | raazdaari | |
| feedback / credits / license | feedback / credits / license | |

### 7.7 Language features

| English | Roman Urdu | Notes |
| --- | --- | --- |
| language | zabaan (f) | |
| interface language | app ki zabaan | |
| document language | document ki zabaan | |
| proofing / proofing language | jaanch / jaanch ki zabaan | |
| keyboard (typing layout) | keyboard (m) | Layout names stay: *Urdu Phonetic (CRULP), Arabic (101)*. |
| layout (keyboard) | layout | |
| on-screen keyboard | screen keyboard | Short button *On-screen* → *Screen par*. |
| switch keyboard | keyboard badlein | |
| aarab | aarab | Native term, as in the English UI. *Hide aarab* → *Aarab chhupayein*. |
| harakat names | zabar, zer, pesh, shadd, jazm, tanween zabar, tanween zer, tanween pesh, khari zabar, khari zer, ulta pesh, hamza, noon ghunna | Native terms; drop the Arabic names in brackets only if the English keeps them. |
| half space / joiner | half space / joiner | Key names. |
| Writing Assistant | Likhaai Madadgaar | Feature name, two capitals. |
| spelling | hijje | *Check spelling as you type* → *Likhte waqt hijje jaanchein*. |
| grammar | grammar (f) | *Spelling and Grammar* → *Hijje aur grammar*. |
| suggestion | tajveez (f), pl. tajaveez | |
| dictionary / my dictionary | lughat (f) / meri lughat | *Add to Dictionary* → *Lughat mein shaamil karein*. |
| thesaurus / synonyms / antonyms | Thesaurus / hum-maani alfaaz / mutazaad alfaaz | |
| readability / writing score | parhne ki aasaani / likhaai score | |
| correctness / clarity / engagement / delivery | durusti / wazaahat / dilchaspi / andaaz-e-bayaan | |
| audience / formality / domain | qaari / rasmi andaaz / shoba | |
| formal / informal / neutral / academic | rasmi / ghair rasmi / darmiyana / ilmi | |
| language pack | zabaan pack (m) | |
| add-in / Add-in Store | add-in (m) / Add-in store | *Community add-ins* → *Community add-ins*. |
| macro / macro editor | macro (m) / Macro editor | *Record macro* → *Macro record karein*; *Run macro* → *Macro chalayein*. |
| feature (optional download) | feature (m) | *Feature downloads* → *Features ka download*. |
| Hijri / Gregorian | Hijri / Eeswi | Months: *Muharram, Safar, Rabi-ul-Awwal, Rabi-us-Saani, Jamadi-ul-Awwal, Jamadi-us-Saani, Rajab, Shabaan, Ramzan, Shawwal, Zil-Qaad, Zil-Hajj*. *AH* → *Hijri*. |
| weekdays (short) | Itw, Pir, Man, Bud, Jmt, Jum, Haf | Sunday to Saturday. |
| multiple cursors | kai cursors | |
| slash commands | slash commands | |

### 7.8 File terms

| English | Roman Urdu | Notes |
| --- | --- | --- |
| file | file (f) | *Recent file* → *Haaliya file*. |
| folder | folder (m) | *Open folder* → *Folder kholein*. |
| path | path (m) | |
| export / import | export / import | *Export as PDF* → *PDF ke taur par export karein*. |
| PDF, Word document, web page | PDF, Word document, web page | |
| plain text | saada text | |
| recover / recovery | bahaal karein / bahaali (f) | *File → Recover* → *File → Bahaali*. *Recover unsaved…* → *Mehfooz na hua text bahaal karein…* |
| recovered text | bachaya gaya text | |
| backup | backup (m) | |
| autosave | apne aap mehfooz | *Autosave is on* → *Apne aap mehfooz on hai*. |
| untitled | Be-naam | *Untitled {n}* → *Be-naam {n}*. |
| (copy) | (copy) | *{name} (copy)*. |
| read-only file | sirf parhne wali file | |
| encoding | encoding | |
| internet / online | internet / online | |
| GitHub, Python, JavaScript, Pandoc | (unchanged) | Brand and language names. |

### 7.9 Terms settled in the native review

| English | Roman Urdu | Notes |
| --- | --- | --- |
| Save as PDF / Save As DjVu (labels) | PDF mein mehfooz karein / DjVu mein mehfooz karein | Short labels. In running text *PDF ke taur par mehfooz karein* is fine. |
| issue (spelling, writing) | masla (m), pl. masail | *No issues* → *Koi masla nahin*. |
| match (a search hit) | match (m), pl. matches | *Next match* → *Agla match*; *{count} matches found* → *{count} matches mile*. |
| search result(s) | natija, pl. nataij | *Commands aur talaash ke nataij*. |
| Markdown flavor / Render as | qism / Parhne ki qism | Flavor features → *khoobiyan*. |
| body text | aam text | |
| display equation / Display (placement) | alag satar wali equation / Alag satar | Pair: *Inline* placement → *Satar ke andar*. |
| chapter | chapter | *Thesis ka chapter*, *chapter ke hisaab se 1.1*. Not *baab*. |
| level (heading, list) | darja | *Promote / Demote* → *Darja barhayein / Darja ghatayein*. |
| Go To (command) | Seedha jayein | |
| Navigate (group) | Navigation | |
| Appearance / Start in / Ribbon display / Editing style | Shakal o soorat / Shuru ka mode / Ribbon ka andaaz / Tarmeem ka andaaz | |
| formatting marks | formatting ke nishaan | |
| Edit as text (button) | Text ke taur par tarmeem | Quoted in sentences. |
| Update table (TOC) / Contents | Fehrist update karein / Fehrist | |
| page viewer / Viewer | safhaat ka viewer / Viewer | |
| bundled / built in | saath shaamil / pehle se shaamil | *Built-in Word writer* → *Markooj ka apna Word writer*. |
| helper tool / tool | madadgaar tool / tool (m) | |
| optional | ikhtiyaari | |
| steps (instructions) / step (recorded) | hidayaat / qadam | |
| progress | progress (f) | Not *pesh-raft*. |
| ring (goal ring) | daaira | |
| research paper | tehqeeqi maqala | |
| Getting started / Tutorials / What’s New | Shuruaat / Asbaaq / Naya kya hai | Reference manual → *Manual*. |
| Well done | Shabaash! | |
| This cannot be undone. | Isay wapas nahin liya ja sakta. | |
| Case: Change Case, Sentence case., lowercase, UPPERCASE, Capitalize Each Word, tOGGLE cASE, Title Case | Case badlein, Jumle ka pehla harf bara., chhote huroof, BARE HUROOF, Har Lafz Ka Pehla Harf Bara, uLTA cASE, Unwaan ka Case | Names show their own effect. |
| safe (fix, HTML, rewrite) | be-khatar | Never *mehfooz* (reads as *saved*). |
| missing (picture) / Locate… | gumshuda / Dhoondein… | |
| favorites / preview | pasandeeda / jhalak | |
| Match case / Whole words / Replace with | Case milayein / Poore alfaaz / Is se tabdeel karein | |
| merged cells / Distribute Columns | mile hue cells / Columns baraabar karein | |
| rule (grammar) | qaida (m), pl. qawaid | |
| Synonyms / Antonyms | Hum-maani alfaaz / Mutazaad alfaaz | |
| tone / consistency / hedging | lehja / yaksaaniyat / ghair yaqeeni andaaz | |
| native speakers / translation | ahl-e-zabaan / tarjuma | |
| Get {name} / Browse (add-ins) / Manage | {name} haasil karein / Talaash / Intezaam | |
| Discard / Wait | Mitayein / Intezaar karein | |
| author (add-in) / Made by | musannif / Kis ne banaya | |
| split divider / Second view / Arrange All / Switch Windows | taqseem ki lakeer / Doosra manzar / Sab tarteeb dein / Windows badlein | |
| rights / trust / safety check / valid | ikhtiyaraat / bharosa / hifaazati jaanch / durust | |
| add-in categories Fun, Productivity, Research, Other | Tafreeh, Kaarkardagi, Tehqeeq, Deegar | |
| colors | Neela, Sabz, Laal, Peela, Narangi, Gulaabi, Jaamni, Surmai | |
| quantity / digits / message | miqdaar (f), pl. miqdaarein / hindse / paighaam | |

---

## 8. Words to avoid

| Avoid | Why | Use |
| --- | --- | --- |
| ghair mehfooz | means *unsafe* | *mehfooz nahin* |
| hazf karein, chaspaan karein, kaladam karein | stiff, rarely said | *mitayein, paste karein, wapas lein* |
| dastavez | not what students say | *document* |
| muntakhib | formal | *chuna hua* |
| kijiye, farmaiye, karo | wrong register | *karein* |
| tab (meaning *then*) | clashes with UI *tab* | *phir* |
| ise, use (pronouns) | *use* reads as English | *isay, usay* |
| pe | casual | *par* |
| bina | inconsistent | *baghair* |
| khana (cell) | reads as *food* | *cell* |

# Swedish (Svenska) glossary for Markooj

Code `sv` · left to right · plural categories `one`, `other` · numbers and dates `sv-SE` · the translation rules are in [docs/I18N.md](../../docs/I18N.md).

Every catalog file (`shell`, `app`, `editors`, `language`, `system`) follows this page. To change a term, change it here first, then everywhere it appears. The terms follow Microsoft Office's Swedish interface (Word 365) wherever Word has the same thing, because Markooj's users already know Word. Where Markooj has something Word does not, the term below is the agreed one.

## 1. Voice and register

- **Write natural, modern Swedish, as a careful Swedish writer at Microsoft would.** Translate the meaning, never word by word. If a sentence sounds translated, rewrite it.
- **Address the user as du** (du, din, dina, dig). Never ni, never "användaren" when you speak to the person. Often no pronoun is needed: an imperative is shorter and friendlier.
- **Buttons and commands are short imperatives** in sentence case: Spara, Spara som…, Infoga tabell, Försök igen. Never a noun or a present tense on a button ("Sparande", "Sparar" are wrong on a button).
- **Status text uses the present tense with "…"** while something runs (Sparar…, Laddar ned…, Installerar…), and the past participle when done (Sparat, Kopierat, Installerat). Agree with the noun when there is one: "Länken har kopierats", "Dokumentet är sparat".
- **Messages start with the remedy**, exactly as the English does: what to do first, then what happened, then what still works. Keep that order.
- **Questions in dialogs** use "Vill du …?": "Vill du spara ändringarna i ”{name}”?" (as Word does).
- **No "vänligen", no "var god", no exclamation marks**, no "Oops". Polite and calm, never chatty, never stiff officialese (avoid "erhålla", "ombesörja", "tillhandahålla", "vederbörande").
- **Sentence case everywhere** (Infoga tabell, not Infoga Tabell), even where the English key uses title case ("Delete Row", "Find Missing Pictures"). Names of tabs, groups and modes keep their capital only on the first word (Visa sida vid sida, Enkelt läge).
- **Avoid anglicisms** that a Word user would not see: "klicka på" (not "klicka"), "markera" (not "selektera"), "ladda ned" (not "downloada"), "inställning" (not "setting"), "funktion" (not "feature").
- **ScreenTip descriptions and command descriptions** keep the English form: an English imperative ("Make the selected text bold.") becomes a Swedish imperative ("Gör den markerade texten fet."); an English third-person description ("Asks GitHub for newer versions…") becomes a Swedish present tense ("Frågar GitHub efter nyare versioner…").
- **Compound words are written together** (dokumentflik, fotnotstext, tangentbordslayout). Never split them ("dokument flik" is wrong). With a brand name, abbreviation, number or placeholder, join with a hyphen: Word-läge, Markdown-fil, PDF-export, LaTeX-matematik, Python-makron, Mermaid-diagram, {format}-visare.

Three examples:

| English | Swedish | Why |
| --- | --- | --- |
| Save changes to “{name}”? | Vill du spara ändringarna i ”{name}”? | Word's own question form, du-form, Swedish quotation marks. |
| Check your internet connection, then try again. Markooj could not reach GitHub to look for updates. Your features keep working. | Kontrollera internetanslutningen och försök igen. Markooj kunde inte nå GitHub för att söka efter uppdateringar. Dina funktioner fungerar som vanligt. | Remedy first, plain words, no "vänligen". |
| Make the selected text bold. | Gör den markerade texten fet. | Short imperative, like a Word ScreenTip. |

## 2. Punctuation and numbers

- **Quotation marks:** Swedish uses the same mark on both sides: ”…” (U+201D). Inside a quotation use ’…’. Never „…“ or "…" (straight quotes) in interface text. Keep straight quotes only inside code, Markdown syntax and file patterns.
- **Apostrophe:** ’ (U+2019), rarely needed in Swedish. Never add a genitive -s to a placeholder ("{name}s" is wrong); rephrase: "egenskaper för ”{name}”".
- **Dash:** a spaced en dash ( – ) for a break in a sentence. No em dash.
- **Colon:** no space before it. After a colon, continue in lower case unless a full sentence or a name follows.
- **Lists:** no comma before "och" / "eller" (no Oxford comma): "kommentarer, fotnoter och dolda anteckningar".
- **Periods:** keep them where the English has them (descriptions, messages) and leave them out where it has none (labels, buttons, menu items).
- **Numbers:** decimal comma (0,5 cm, 1,5 rader). Thousands are grouped with a space (12 345); `{count}` and `{size}` are already formatted by Markooj, so never add separators yourself.
- **Space before units and percent:** write a non-breaking space (U+00A0) between a number and its unit or the percent sign: 12 MB, 2,5 cm, 100 %, {size} MB, {percent} % översatt. Exception: keep "100%" as is when it is the ribbon zoom button label (Word does the same).
- **Dates and times:** ISO dates (2026-11-27) and the 24-hour clock with a colon (14:30). Month and weekday names are lower case in running text (januari, måndag). Weekday short forms in the calendar: Må, Ti, On, To, Fr, Lö, Sö.
- **Abbreviations:** avoid them in the interface. Write "till exempel", not "t.ex.", unless the space is very short. Units keep their symbols (cm, mm, pt, s, min).
- **Language names** are lower case in running text in Swedish (svenska, urdu, arabiska) but start with a capital when they stand alone as a label or list item (Svenska, Urdu, Arabiska). Language names that come from the catalog as labels are capitalized, so write sentences where a capitalized name reads well: "Ladda ned {language}", "Teckensnitt för {language}".

## 3. Placeholders, shortcuts and "…"

- **Keep every `{placeholder}` exactly** (same spelling, same braces) and move it to where Swedish grammar wants it. Never translate the word inside the braces.
- **Never inflect a placeholder.** No -s, -en, -et after it. Put a word around it instead: "dokumentet ”{name}”", "funktionen {feature}", "språket {language}" only when needed for grammar.
- **File and document names in a sentence** stand in Swedish quotation marks: ”{name}”. Feature, language and add-in names stand without quotes.
- **Plurals:** fill `one` and `other` (the Swedish categories). Agree "en/ett": `"one": "{count} fil"`, `"other": "{count} filer"`; `"one": "{count} dokument"`, `"other": "{count} dokument"` (same form is fine). Swedish counts 0 as `other` ("0 filer").
- **Keyboard shortcuts:** key names stay in Latin letters exactly as in English: Ctrl, Shift, Alt, Enter, Esc, Tab, Delete, Backspace, Home, End, F1 … F12, and the + between them (Ctrl+Shift+K). Do not write Skift, Retur or Ctrl-S.
- **In a sentence:** "Tryck på Ctrl+S", "Tryck på Esc för att gå tillbaka", "(Ctrl+1)" in parentheses after a command exactly where the English has it. "Press Alt" → "Tryck på Alt".
- **Menu paths** keep the arrow with spaces and use the Swedish names: File → Options → Features → Arkiv → Alternativ → Funktioner; Help → Welcome → Hjälp → Välkommen; View → Split → Visa → Dela.
- **HTML tags** (`<kbd>`, `<b>`, `<code>`) stay exactly as in the English, around the same words.
- **The ellipsis "…"** is one character (U+2026), never three dots, with no space before it.
  - A command that opens a dialog keeps "…" at the end, as in Word: Spara som…, Utskriftsformat…, Infoga tabell…, Byt namn…, Bläddra…
  - A command that acts at once never gets "…".
  - A progress text keeps "…": Sparar…, Läser in…, Laddar ned…, Kontrollerar…, Avbryter…
  - A file pattern such as markooj-feature-….zip stays exactly as it is.

## 4. Markooj's editing modes

Mode names are names, so they start with a capital letter in sentences. "Word" is the product Microsoft Word and is never translated.

| English | On the small switch | In sentences | Note |
| --- | --- | --- | --- |
| Word mode | Word | Word-läge (Word-läget) | Click and type on the page, like Word. |
| Inline (mode) | Direkt | Direktläge (Direktläget) | Markdown marks show only where you type. "Inline" is not natural Swedish for students; "Direkt" is short and fits the switch. |
| Simple (mode) | Enkel | Enkelt läge | Markdown next to a preview. |
| Read (mode) | Läs | Läsläge (Läsläget) | Word's own name for Read Mode. |
| Editing mode | | Redigeringsläge | The setting that picks one of the four. |
| Edit (leave Read mode) | Redigera | | Button at the bottom of Read mode. |

Examples: "Växla till Enkelt läge (Ctrl+3) för att använda {feature}." · "Läsläge är till för att läsa. Tryck på Esc för att fortsätta redigera."

## 5. Terms

### Ribbon tabs

| English | Swedish | Note |
| --- | --- | --- |
| File | Arkiv | The File tab and the full-window File page (Word: Arkiv). |
| Home | Start | |
| Insert@@ribbon tab | Infoga | The tab name. The button "Insert@@verb" is also Infoga. |
| Layout | Layout | |
| References | Referenser | |
| Review | Granska | |
| View | Visa | |
| Developer | Utvecklare | |
| Add-ins | Tillägg | Tab, Options page and the general word for add-ins. |
| Help | Hjälp | |
| Table Design | Tabelldesign | Contextual tab. |
| Table Layout | Tabell-layout | Contextual tab. Hyphen instead of three l's in a row (Swedish spelling rule); never "Tabellayout". |
| Table Tools | Tabellverktyg | Label above the two contextual tabs. |

### Ribbon groups

| English | Swedish | Note |
| --- | --- | --- |
| Clipboard | Urklipp | |
| Font | Tecken | Ribbon group name (as in Word). The typeface itself is "teckensnitt". |
| Paragraph | Stycke | |
| Styles | Formatmallar | Word's name for styles; avoids a clash with "format" (file format). |
| Editing | Redigering | |
| Direction | Riktning | Text direction. |
| Illustrations | Illustrationer | |
| Pictures | Bilder | |
| Blocks | Block | |
| Links & pages | Länkar och sidor | Write "och", not "&". |
| Notes & sources | Anteckningar och källor | |
| Text | Text | |
| Captions | Beskrivningar | Word's term for captions. |
| Captions & numbering | Beskrivningar och numrering | |
| Page setup | Utskriftsformat | Word's group name; also the dialog "Utskriftsformat…". |
| Spacing | Avstånd | |
| Document theme | Dokumenttema | |
| Table of contents | Innehållsförteckning | |
| Footnotes | Fotnoter | |
| Citations & bibliography | Källor och litteraturförteckning | See "citation" below. |
| Proofing | Språkkontroll | |
| Writing | Skrivande | Group and add-in category. |
| Comments | Kommentarer | |
| Versions | Versioner | |
| Views | Vyer | |
| Show@@ribbon group | Visa | |
| Zoom | Zooma | Group and command. |
| Mode@@ribbon group | Läge | |
| Theme | Tema | |
| Commands | Kommandon | |
| Window@@ribbon group | Fönster | |
| Keyboard | Tangentbord | |
| Tables | Tabeller | |
| Goals | Mål | |
| Readability | Läsbarhet | |
| My macros | Mina makron | |
| Math@@ribbon group | Matematik | |
| Code@@ribbon group | Kod | |
| Store@@ribbon group | Butik | |
| Manage | Hantera | |
| Features | Funktioner | Help group and File → Options page (optional parts). |
| Feedback | Feedback | Office uses "Feedback". |
| About | Om | "About Markooj" → Om Markooj. |
| Welcome | Välkommen | |
| Updates | Uppdateringar | |
| Shortcuts | Kortkommandon | |

### Common commands and buttons

| English | Swedish | Note |
| --- | --- | --- |
| Save | Spara | |
| Save as… / Save As | Spara som… / Spara som | |
| Save all | Spara alla | |
| Don’t Save | Spara inte | |
| New@@file page | Nytt | File page (Word: Nytt). |
| New document | Nytt dokument | |
| Blank document | Tomt dokument | |
| Open@@verb / Open… | Öppna / Öppna… | |
| Open recent | Öppna senaste | |
| Recent | Senaste | |
| Close | Stäng | |
| Close anyway | Stäng ändå | |
| Close others | Stäng andra | Other document tabs. |
| Undo | Ångra | |
| Redo | Gör om | Word's term. |
| Repeat | Upprepa | |
| Cut | Klipp ut | |
| Copy | Kopiera | |
| Paste | Klistra in | |
| Paste as plain text | Klistra in som oformaterad text | |
| Select all | Markera allt | |
| Select | Markera | Never "välj" for selecting text. |
| Find | Sök | |
| Find next / Find previous | Sök nästa / Sök föregående | |
| Replace / Replace all | Ersätt / Ersätt alla | |
| Match case | Matcha gemener/VERSALER | Word's wording. |
| Whole words | Hela ord | |
| Go To / Go to | Gå till | |
| Insert@@verb | Infoga | |
| Delete | Ta bort | Word uses "Ta bort" for Delete. |
| Remove | Ta bort | |
| Delete permanently | Ta bort permanent | Only when the English stresses it. |
| Rename… | Byt namn… | |
| Edit@@verb | Redigera | |
| Options | Alternativ | File → Options (Word: Alternativ). |
| Settings | Inställningar | |
| Help | Hjälp | |
| Cancel | Avbryt | |
| OK | OK | |
| Apply | Använd | |
| Reset | Återställ | If "Återställ" (Recover) is in the same dialog, write "Återställ standard". |
| Install | Installera | |
| Uninstall | Avinstallera | |
| Update | Uppdatera | Button. The noun is "uppdatering". |
| Download | Ladda ned | Microsoft's spelling ("ned", not "ner"). |
| Try again | Försök igen | |
| Check again | Kontrollera igen | |
| Details | Information | Button that shows more about a problem; "Copy details" → Kopiera information. |
| Technical details | Teknisk information | |
| Learn more | Läs mer | |
| Don’t show again | Visa inte igen | |
| Not now | Inte nu | |
| Later | Senare | |
| Continue | Fortsätt | |
| Done | Klar | |
| Back / Next / Previous | Tillbaka / Nästa / Föregående | |
| Skip | Hoppa över | |
| Show / Hide | Visa / Dölj | |
| Turn on / Turn off | Aktivera / Inaktivera | On/Off on a switch: På / Av. |
| Browse… | Bläddra… | |
| Discard | Kassera | |
| Ignore / Ignore all | Ignorera / Ignorera alla | |
| Accept | Godkänn | |
| Dismiss | Avvisa | A suggestion. Closing a message: Stäng. |
| Run@@macro | Kör | |
| Record / Stop recording | Spela in / Stoppa inspelning | |
| Print / Print… | Skriv ut / Skriv ut… | |
| Print preview / Preview | Förhandsgranska utskrift / Förhandsgranska | Noun: förhandsgranskning. |
| Export / Export… | Exportera / Exportera… | Noun: export. |
| Import | Importera | |
| Copy path | Kopiera sökväg | |
| Open folder | Öppna mapp | |
| Repair Markooj | Reparera Markooj | |
| Report a Problem | Rapportera ett problem | |
| Show me | Visa mig | |
| Getting started | Kom igång | |

### Window, ribbon and screen parts

| English | Swedish | Note |
| --- | --- | --- |
| ribbon | menyfliksområdet | Always definite in sentences; the label "Ribbon" → Menyfliksområde. |
| tab (ribbon tab) | flik | |
| document tab | dokumentflik | One open document. |
| tab (tab character / Tab key) | tabb / Tab | The key name stays Tab. |
| group (ribbon group) | grupp | |
| Quick access | Snabbåtkomst | Word's Quick Access Toolbar: "verktygsfältet Snabbåtkomst". |
| status bar | statusfältet | |
| command search (Alt+Q), command palette | kommandosökning | One word for both "command search" and "command palette". |
| ScreenTip | skärmtips | |
| KeyTips | tangenttips | The letters shown after pressing Alt. |
| window | fönster | |
| pane | fönsterruta | Split panes; short form "ruta" when space is tight. |
| side pane (outline, Writing Assistant) | panel | "outline pane" → dispositionspanelen. |
| dialog | dialogruta | |
| outline | disposition | The list of headings at the side (Word: Disposition). |
| ruler | linjal | |
| guide (ruler guide) | stödlinje | "Add guide" → Lägg till stödlinje. |
| gridlines (table) | rutnät | "View Gridlines" → Visa rutnät. |
| Split (View → Split) | Dela | Noun: delning. "Remove Split" → Ta bort delning. |
| View Side by Side / side by side | Visa sida vid sida / sida vid sida | Word's terms. |
| Synchronous Scrolling | Synkron rullning | |
| Arrange All | Ordna alla | |
| New Window | Nytt fönster | |
| Switch Windows | Växla fönster | |
| Full-screen mode | Helskärmsläge | |
| Focus | Fokus | View mode. |
| Print layout / Web layout | Utskriftslayout / Webblayout | |
| zoom / Zoom in / Zoom out | zoom / Zooma in / Zooma ut | |
| Page width | Sidbredd | |
| Formatting marks | Formateringstecken | |
| theme: Light / Dark / System / Match system | Ljust / Mörkt / System / Följ systemet | Short: they sit on a small switch. |
| Welcome screen | välkomstskärmen | |
| guided tour / tutorial | rundtur / självstudie | "Take the tour" → Ta rundturen. |
| practice document | övningsdokument | |

### Document terms

| English | Swedish | Note |
| --- | --- | --- |
| document | dokument | |
| page | sida | |
| paragraph | stycke | |
| heading | rubrik | "Heading 1" → Rubrik 1. |
| title | rubrik / titel | Document property: Titel. |
| list | lista | |
| bulleted list / Bullets | punktlista / Punktlista | |
| numbered list / Numbering | numrerad lista / Numrering | |
| checklist, task list | checklista | |
| table | tabell | |
| cell | cell | |
| row | rad | "Header Row" → Rubrikrad; "Banded rows" → Randade rader. |
| column (table) | kolumn | |
| columns (page layout) | spalter | "One/Two@@columns" → En spalt / Två spalter. |
| merged cells | sammanfogade celler | |
| caption | beskrivning | Word's term ("Infoga beskrivning"). Not "bildtext". |
| figure | figur | |
| picture | bild | |
| equation | ekvation | |
| inline equation / display equation | ekvation i texten / fristående ekvation | Chips: "$…$ math" → $…$-matematik, "display math" → fristående matematik. |
| citation | källhänvisning | Not "citat" (that is a quote). "Cite" → Hänvisa. |
| reference (bibliography entry) | referens | "Search references" → Sök referenser. |
| citation style | referensstil | APA, Chicago … |
| bibliography | litteraturförteckning | |
| citation library, BibTeX library | referensbibliotek, BibTeX-bibliotek | |
| footnote | fotnot | |
| comment | kommentar | "New comment" → Ny kommentar. |
| hidden note | dold anteckning | A %%note%% that never prints. |
| cross-reference | korsreferens | |
| label (cross-reference label) | etikett | |
| table of contents | innehållsförteckning | |
| quote | citat | Block quote. |
| callout (box) | faktaruta | Note / Tip / Important / Warning / Caution → Obs / Tips / Viktigt / Varning / Se upp. |
| code block / inline code | kodblock / kod i texten | |
| link | länk | |
| wikilink | wikilänk | |
| divider | avdelare | Horizontal line. |
| page break | sidbrytning | |
| front matter | front matter | Markdown term researchers know; explain once as "inställningsblocket överst i filen" where the English explains it. |
| Markdown flavor | Markdown-variant | "Render as" → Visa som. |
| template | mall | |
| style | formatmall | Table styles: tabellformat. |
| font / font size | teckensnitt / teckenstorlek | |
| Bold / Italic / Underline | Fet / Kursiv / Understruken | |
| Strikethrough | Genomstruken | |
| Subscript / Superscript | Nedsänkt / Upphöjd | |
| Small caps / All caps | Kapitäler / Versaler | |
| Highlight | Textmarkering | |
| Text color / Font color | Teckenfärg | |
| Clear formatting | Radera all formatering | |
| Format painter | Hämta format | |
| Change Case | Ändra skiftläge | |
| Align left / Center / Align right / Justify | Vänsterjustera / Centrera / Högerjustera / Marginaljustera | |
| Increase / Decrease indent | Öka indrag / Minska indrag | |
| Line spacing / Paragraph spacing | Radavstånd / Styckeavstånd | |
| Margins / Page size | Marginaler / Sidstorlek | "Normal@@margins" → Normal; "Letter" stays Letter. |
| Track changes | Spåra ändringar | |
| Compare | Jämför | |
| document properties | dokumentegenskaper | Author → Författare, Subject → Ämne, Keywords → Nyckelord. |
| Info (File page) | Info | As in Word. |
| word count / words / characters | ordräkning / ord / tecken | |
| reading time | lästid | |
| Untitled / Untitled {n} | Namnlös / Namnlös {n} | |
| Read only | Skrivskyddad | |
| Edited / Saved / Not saved yet | Ändrad / Sparad / Inte sparad än | Title bar states. |

### Language and writing features

| English | Swedish | Note |
| --- | --- | --- |
| interface language | visningsspråk | Office/Windows term for the menu language. |
| document language | dokumentspråk | |
| proofing language | korrekturspråk | |
| right to left / left to right | höger till vänster / vänster till höger | |
| keyboard (typing layout) | tangentbord / tangentbordslayout | Urdu Phonetic, Arabic 101 … "Keyboard: {layout}" → Tangentbord: {layout}. |
| on-screen keyboard | skärmtangentbord | |
| keyboard shortcut | kortkommando | |
| aarab (harakat) | vokaltecken | Urdu and Arabic vowel marks. "Remove aarab" → Ta bort vokaltecken. The mark names (zabar, zer, pesh, shadd, jazm, tanween …) stay as in English, lower case in running text. |
| half space / joiner | halvt mellanslag / fogtecken | ZWNJ / ZWJ stay as is in parentheses. |
| Writing Assistant | Skrivassistenten | Name of the side pane; capital S. |
| spelling | stavning | |
| grammar | grammatik | |
| Spelling and grammar | Stavning och grammatik | |
| suggestion | förslag | "{count} suggestions" → one: {count} förslag, other: {count} förslag. |
| writing score | skrivpoäng | |
| correctness / clarity / engagement / delivery | korrekthet / tydlighet / engagemang / framförande | Writing Assistant categories. |
| thesaurus / synonyms / antonyms | synonymordlista / synonymer / antonymer | |
| My dictionary | Min ordlista | |
| readability | läsbarhet | |
| language pack | språkpaket | |
| add-in | tillägg | |
| Add-in Store | Tilläggsbutiken | "Get add-ins" → Hämta tillägg; "community add-ins" → tillägg från communityn. |
| macro | makro | Plural: makron. "Record macro" → Spela in makro. |
| Math macros | Matematikmakron | |
| feature (optional part) | funktion | Pandoc, DjVu tools, Python macros, downloaded when wanted. |
| feature download | nedladdning av funktioner | "Cancel feature downloads" → Avbryt nedladdningen av funktioner. |
| writing goals / daily goal / word target | skrivmål / dagligt mål / ordmål | |
| writing sprint / streak | skrivsprint / svit | "{count}-day streak" → one: {count} dag i rad, other: {count} dagar i rad. |
| typewriter scrolling | skrivmaskinsrullning | |
| slash commands | snedstreckskommandon | |
| multiple cursors | flera markörer | |
| calendar: Gregorian / Hijri | gregoriansk / hijri | "Hijri date" → Hijri-datum. |

### Files, saving and recovery

| English | Swedish | Note |
| --- | --- | --- |
| file | fil | |
| folder | mapp | |
| path | sökväg | |
| file type / format | filtyp / format | |
| export | exportera / export | |
| import | importera | |
| PDF | PDF | "PDF file" → PDF-fil. |
| Word document | Word-dokument | |
| web page | webbsida | |
| Recover (File page, command) | Återställ | Word: "Återställ osparade dokument". "Recover unsaved…" → Återställ osparade… |
| recovery copy | återställningskopia | Unsaved text Markooj keeps for some days. |
| Recovery (Options section) | Återställning | |
| Recovered | Återställd | |
| backup | säkerhetskopia | |
| autosave | spara automatiskt | Noun: automatisk sparning. |
| unsaved changes | osparade ändringar | |
| recent files | senaste filer | |
| encoding | teckenkodning | |
| download / downloading | ladda ned / laddar ned… | |
| update (noun) | uppdatering | "Your features are up to date." → Dina funktioner är uppdaterade. |
| version | version | |
| zip file | zip-fil | |
| license | licens | |
| third-party notices | meddelanden från tredje part | |
| credits | medverkande | |
| privacy | sekretess | |

### Added after the first translation (2026-11-28)

| English | Swedish | Note |
| --- | --- | --- |
| title bar | namnlisten | Office term. |
| Edit as text | Redigera som text | In ” ” where the English quotes it. |
| page viewer / Viewer (status bar) | sidvisaren / Visare | |
| issue (spelling, grammar) | problem | "No issues" → Inga problem; plural the same in both forms. |
| fix (noun, Writing Assistant) | korrigering | "safe fixes" → säkra korrigeringar. Never "rättning". |
| flag / mark (a writing issue) | påpeka | Keeps "markera" for selecting. |
| Highlight / Mark long sentences | Framhäv | Also "Long sentences are highlighted" → framhävs. |
| Focus mode in sentences | fokusläget | Label stays Fokus. |
| Change Case items | Versal i början av meningen. / gemener / VERSALER / Versal I Början Av Varje Ord / vÄXLA sKIFTLÄGE | Word. Title Case → Versal i Viktiga Ord (shows its effect, like the others). |
| Grow / Shrink Font | Öka teckenstorlek / Minska teckenstorlek | |
| Promote / Demote | Höj nivå / Sänk nivå | |
| Smart quotes / AutoCorrect | Typografiska citattecken / Autokorrigera | |
| Slides (format) / slide | Bildspel / bild | "PowerPoint slides" → PowerPoint-bildspel. |
| Rich Text (format) | RTF | In every format list. |
| Plain text (Markdown description) / plain text (format) | Ren text / oformaterad text | |
| citation key | referensnyckel | |
| item (figure, table, equation) | objekt | |
| broken (reference) | trasig | |
| cursor / caret | markören | "där markören står". |
| alt text | alternativtext | |
| separator / pipe ( \| ) / space (in counts) | avgränsare / lodstreck / blanksteg | |
| Display / Inline (equation placement) | Fristående / I texten | |
| Reference Manual | Handbok (handboken) | |
| Tutorials / tutorial | Självstudier / självstudie | |
| What’s New | Nyheter | "What’s new in {version}" → Nyheter i {version}. |
| Project page | Projektsida | |
| this copy (of Markooj) | den här installationen | Never "kopia" or "version" for the installation. |
| Markooj release(s) (GitHub) | Markooj-utgåvan / Markoojs utgåvor | |
| Flesch reading ease / reading ease | Läsbarhet enligt Flesch / läsbarhetsvärde | Short: Läsbarhet (Flesch). |
| grade level | årskursnivå | |
| Audience / Formality / Domain | Målgrupp / Stilnivå / Texttyp | Writing Assistant goals. |
| Google Sheets | Google Kalkylark | |
| Today (button) | I dag | Two words, as in running text. |
| arrow keys in shortcuts | Vänsterpil, Högerpil, Uppil, Nedpil | Microsoft's Swedish names; other key names stay in English (Ctrl, Shift, Tab …). |
| language pack installed/removed | Språkpaketet för {name} har installerats / har tagits bort | |
| Off on a status chip | ”X: av” | Stavning: av, Kontroll: av. |

## 6. Decisions

- 2026-11-27: The four modes on the switch are Word, Direkt, Enkel, Läs; in sentences Word-läge, Direktläge, Enkelt läge, Läsläge.
- 2026-11-27: "citation" → källhänvisning (not Word's "citat"), because "citat" is already the block quote; the References group is "Källor och litteraturförteckning".
- 2026-11-27: "caption" → beskrivning (Word's term), "Insert caption" → Infoga beskrivning.
- 2026-11-27: "Table Layout" → Tabell-layout (hyphen, Swedish rule for three equal consonants).
- 2026-11-27: "Recover" → Återställ (Word); when "Reset" stands in the same dialog, Reset → Återställ standard.
- 2026-11-27: "command search" and "command palette" → kommandosökning.
- 2026-11-27: "guide" (ruler) → stödlinje; table gridlines → rutnät, so the two never clash.
- 2026-11-27: "aarab" → vokaltecken; the individual mark names stay as in English.
- 2026-11-27: "Details" button → Information; "Download" → Ladda ned.
- 2026-11-28 (review): "fix" → korrigering; "this copy" → den här installationen; "Rich Text" → RTF; "Highlight long sentences" → Framhäv; arrow keys use Microsoft's Swedish names. Margin presets and Letter size are shown in cm (exact values, as Swedish Word does).
- 2026-11-28 (review): the key "Columns" is shared by Layout → Columns (Spalter) and the Insert table dialog (Kolumner). It is Spalter for now; the code needs a context marker to fix the dialog.

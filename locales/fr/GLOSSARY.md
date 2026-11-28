# French (Français) glossary for Markooj

Code `fr` · left to right · France French · plural categories: `one`, `many`, `other` · the translation rules are in [docs/I18N.md](../../docs/I18N.md).

Every catalog file (`shell`, `app`, `editors`, `language`, `system`) follows this page. To change a term, change it here first, then everywhere it appears. When Microsoft Word in French has a name for the same thing, use Word's name: our users know Word, and they look for « Insertion », « Références », « Révision », not for a new word. Where Markooj has no Word equivalent, write what a careful French editor would put in an Office menu.

**Notation.** In this page the sign ⍽ marks a non-breaking space (U+00A0), which French typography needs (see section 2). Never type the sign ⍽ itself into a catalog: in the JSON files write the real U+00A0 character, or the JSON escape `\u00a0` (both give the same string).

## 1. Voice and register

The interface should read like French Microsoft Office written by a careful native editor: clear, courteous, short, never a word-for-word copy of the English.

- **Address the user as « vous »**, always. Never « tu », never « on » to mean the user.
- **Buttons, menu items, commands, check boxes and options: infinitive**, as Office does. Enregistrer, Insérer un tableau, Afficher la règle, Ne plus afficher. Never an imperative (« Enregistrez ») on a button.
  - An English **noun** label stays a **noun**: Table → Tableau, Picture → Image, Footnote → Note de bas de page, Comment → Commentaire. An English **verb** label becomes an **infinitive**: Cut → Couper, Insert table → Insérer un tableau.
- **Sentence case.** Only the first word and proper names take a capital: Insert Table → Insérer un tableau, Table Style Options → Options de style de tableau, What’s New → Nouveautés. French never capitalizes Each Word, even where the English label does (Word-style title case).
- **Capital letters keep their accents:** État, À propos, Éditeur, Équation. Write É, È, À, Ç, never E, A, C for them.
- **ScreenTip descriptions** (the English sentence under a ScreenTip title): when the English starts with an imperative verb, use the infinitive, as Office ScreenTips do (Make the selected text bold. → Mettre le texte sélectionné en gras.). When the English describes something (The page looks finished…), write a normal sentence in the present tense.
- **Messages to the user: imperative with « vous »** (Cliquez…, Choisissez…, Vérifiez…, Réessayez.). No « Veuillez » in short messages; use it at most once in a long, formal message. Never add « Désolé » or « Malheureusement » when the English has no apology.
- **Solution first.** The English messages say what to do first, then what happened, then what still works. Keep that order. « Tout le reste fonctionne. » for “Everything else works.”, « Rien n’est perdu. » for “Nothing is lost.”
- **Plain and short.** Prefer « pouvez » to « avez la possibilité de », « pour » to « afin de » in short text, « Impossible de… » is acceptable in a title but a message should still lead with what to do. No exclamation marks unless the English has one; a cheerful English line becomes a friendly but calm French line (You’re all set! → Tout est prêt.).
- **Passive and impersonal forms only when natural.** Status messages may use a past participle without subject (Copié., Enregistré., Lien copié.), as Office does.
- **Avoid unknown gender agreement with placeholders.** A placeholder can be masculine or feminine (`{feature}` is « Pandoc » or « les outils DjVu »). Put a noun before it that fixes the gender: Saved {name} → Document «⍽{name}⍽» enregistré; {feature} is ready. → L’outil {feature} est prêt. / Installation de {feature} terminée. Do not write « {feature} est prêt(e) ».
- **No elision in front of a placeholder.** Write « de {name} », « le fichier {name} », never « d’{name} » or « l’{name} », because we do not know the first letter. When « de » would look wrong in front of a vowel, put a noun in between: du fichier «⍽{name}⍽», de l’outil {tool}.
- **No needless anglicisms:** use the French word Office uses (télécharger, complément, raccourci, paramètres, mise à jour, dossier, info-bulle). Keep English only for brand and format names and for the few accepted words in the term tables (sprint, zoom, Focus). « Front matter » is not kept: see 5.6.

Three short examples:

| English | French | Why |
| --- | --- | --- |
| Save changes to “{name}”? / Save / Don’t Save / Cancel | Voulez-vous enregistrer les modifications apportées à «⍽{name}⍽»⍽? / Enregistrer / Ne pas enregistrer / Annuler | Word's own dialog wording; buttons as infinitives. |
| Check your internet connection, then try again. | Vérifiez votre connexion Internet, puis réessayez. | Solution first, imperative with « vous », short. |
| Bold (Ctrl+B) / Make the selected text bold. | Gras (Ctrl+B) / Mettre le texte sélectionné en gras. | Label is Word's name; the ScreenTip description is an infinitive, as in Office. The key stays Ctrl+B (Markooj's own shortcut, not Word's French Ctrl+G). |

## 2. Punctuation, spacing and numbers

- **Non-breaking space (U+00A0) before `:` `;` `!` `?` and inside « » guillemets.** Use U+00A0 everywhere (not U+202F): it shows in every interface font. In the JSON files write the real U+00A0 character or the escape `\u00a0` (shown here as ⍽): `"Thème⍽: {theme}"`, `"Supprimer {name}⍽?"`, `"«⍽{query}⍽»"`. Never a normal space there (the line could break before the `?`) and never no space at all.
  - No space before `.` `,` `…` `)` and after `(`.
  - A colon that ends a label before a value or a list (Credits: → Crédits⍽:) also takes the non-breaking space.
- **Quotes.** English “…” become « … » with `⍽` inside: “{name}” → «⍽{name}⍽». A quote inside a quote uses “…” (no spaces). When the English quotes a UI name in a sentence (Use “Edit as text”…), French quotes it too: Utilisez «⍽Modifier comme texte⍽»…
- **Apostrophe:** always the typographic ’ (U+2019), as the English catalog does: l’onglet, d’abord, aujourd’hui. Never the straight '.
- **Menu paths** keep the arrow → with normal spaces: Fichier → Options → Langue.
- **Middle dot ·** used as a separator in the English stays as is, with normal spaces around it (Lecture seule · 3 pages).
- **Dashes:** an English em dash (—) becomes a spaced en dash « – » or, better, a rephrase with a colon or parentheses. Keep the “—” only in “{language} — {native}” (language list).
- **&** in labels becomes « et »: Links & pages → Liens et pages, Date & time → Date et heure.
- **Numbers written in the text** use French style: decimal comma (1,5 ; 0,5), a non-breaking space between thousands (the app formats `{count}`, `{size}` and dates with `fr-FR` already, so do not add anything around them).
  - Line spacing 1.5 → Interligne 1,5; Line spacing {value} → Interligne {value} (the app formats the value).
- **Units:** a non-breaking space between number and unit: `{count}⍽min`, `{size}⍽Mo`, `{size}⍽pt`, `100⍽%`, `{percent}⍽%`. File sizes use French units: **o, Ko, Mo, Go** (octets, kilo-octets…): {size} KB → `{size}⍽Ko`, {size} MB → `{size}⍽Mo`, {size} GB → `{size}⍽Go`, {count} bytes → `{count} octets`. Inch → po (pouce), centimeter → cm.
- **Percentages:** `{percent}⍽%` (50⍽%), never 50%.
- **Ranges and ratios:** Page {current} of {total} → Page {current} sur {total}; {index} of {count} → {index} sur {count}; {cols} × {rows} table → Tableau {cols} × {rows}.
- **Dates and times** come from `Intl` (fr-FR: 27 nov. 2026, 15:15). Do not hard-code AM/PM. today at {time} → aujourd’hui à {time}; yesterday at {time} → hier à {time}; {date} at {time} → {date} à {time}; just now → à l’instant; {count} minutes ago → il y a {count} minutes.
- **Days and months are lower case** in running text (lundi, novembre). Day abbreviations for the calendar: Lu, Ma, Me, Je, Ve, Sa, Di.
- **Language names** are lower case inside a sentence (le français, en ourdou) and capitalized when they stand alone as a list item or label (Français, Ourdou).
- **Plurals.** French uses `one` for 0 and 1, `other` from 2, and `many` for round millions. Fill all three:
  - `"{count} files": { "one": "{count} fichier", "many": "{count} de fichiers", "other": "{count} fichiers" }`
  - `many` is « {count} de … » (1 000 000 de fichiers). Past participles and adjectives agree in every form: `"one": "{count} document récupéré", "many": "{count} de documents récupérés", "other": "{count} documents récupérés"`.
  - When the English `one` form writes the number as a word (“one file”), you may do the same (« un fichier »), but remember that `one` also covers 0 in French: if the text can be shown for 0, keep `{count}`.

## 3. Placeholders, names and shortcuts in sentences

- Keep every `{placeholder}` exactly as written (same spelling, same braces). Move it to where French grammar needs it.
- **Names the user gave or typed** (`{name}`, `{title}`, `{query}`, `{word}`, `{text}`, `{file}`, `{href}`) go in « » with `⍽` inside: Nothing matches “{query}”. → Aucun résultat pour «⍽{query}⍽». If the English has no quotes around the placeholder in a short label (Saved {name}), French may add a noun instead of quotes (Document «⍽{name}⍽» enregistré).
- **Names of UI things already translated** (`{command}`, `{page}`, `{tab}`, a mode or a File page) go in « » inside a sentence: Cliquez sur l’onglet «⍽{name}⍽». In a short label they need no quotes: Essayer le mode {name}.
- **Numbers and technical values** (`{count}`, `{n}`, `{size}`, `{version}`, `{tool}`, `{format}`, `{key}`, `{keys}`, `{path}`) need no quotes.
- **Keyboard keys stay in Latin letters exactly as in the English:** Ctrl, Shift, Alt, Enter, Esc, Tab, Page Up, Home, F1, F7 … and combinations like Ctrl+Shift+K. Do not write Maj, Entrée, Échap or Ctrl+G: the key names must match what Markooj shows elsewhere and what the user presses.
  - After a label, in parentheses with a normal space: Suivant (Enter), Fermer (Esc), Gras (Ctrl+B).
  - In a sentence: « Appuyez sur Ctrl+S pour enregistrer. », « Appuyez sur Alt. », « Ctrl+Shift+K passe à… ». The key name takes no article (« sur Alt », not « sur la touche Alt »), except where it reads better: « la touche Alt » is allowed once in a tutorial sentence.
  - Keep `<kbd>Ctrl+S</kbd>`, `<b>…</b>`, `<code>…</code>` tags and their key content unchanged: <kbd>Ctrl+S</kbd> enregistre le document…
- **Product and format names stay as is** and are not declined: Markooj, Word, Excel, PowerPoint, Pandoc, KaTeX, Mermaid, Markdown, LaTeX, BibTeX, GitHub, Python, JavaScript, PDF, DOCX, EPUB, DjVu, DjVuLibre, Jupyter, Electron, Homebrew, CommonMark. Gender: « le Markdown », « le format PDF », « un fichier Word » (Word = the program; « un document Word »).
- **Never translate** Markdown syntax, `@eq:energy`, `**bold**` markers (translate the word inside), `[!NOTE]`, `word-target`, file extensions, command ids, `shields1936` or anything inside `<code>`.

## 4. The ellipsis “…”

- Keep the single character **…** (U+2026) exactly where the English has it, with **no space before it**: Save as… → Enregistrer sous…, Print… → Imprimer…, Insert Table… → Insérer un tableau…
- On a menu item or button it means “opens a dialog or a page”: keep it even if the French label becomes longer, and do not add one where the English has none.
- In a progress message it means “in progress”: Loading… → Chargement…, Installing… → Installation…, Checking… → Vérification…, Downloading… → Téléchargement…, Starting… → Démarrage…, Saving… → Enregistrement… Use the noun form, as Office does (not « Chargement en cours… »).
- Never write three dots `...`.

## 5. Terms

Gender: **m.** masculine, **f.** feminine, given for the nouns that drive agreement.

### 5.1 Ribbon tabs (as in Word)

| English | French | Notes |
| --- | --- | --- |
| File | Fichier | The File tab and the full-window File page. |
| Home | Accueil | |
| Insert (ribbon tab, `Insert`) | Insertion | The tab. The button/verb `Insert@@verb` is « Insérer ». |
| Layout | Mise en page | Word's Layout tab. |
| References | Références | |
| Review | Révision | |
| View | Affichage | |
| Developer | Développeur | |
| Add-ins | Compléments | Office's word for add-ins. |
| Help | Aide | |
| Table Design | Création de tableau | Contextual tab, as in Word. |
| Table Layout | Disposition du tableau | Contextual tab, as in Word. |
| Table Tools | Outils de tableau | Label over the contextual tabs. |

### 5.2 Ribbon groups

| English | French | Notes |
| --- | --- | --- |
| Clipboard | Presse-papiers | Home. |
| Font | Police | Home. |
| Paragraph | Paragraphe | Home. |
| Styles | Styles | Home. |
| Editing | Modification | Home (Find, Replace, Select). Word's name. |
| Direction | Sens du texte | Home: left to right / right to left. |
| Aarab | Vocalisation | Home: Urdu/Arabic vowel marks. See 5.14. |
| Blocks | Blocs | Insert. |
| Captions | Légendes | Insert and References. |
| Illustrations | Illustrations | Insert. |
| Links & pages | Liens et pages | Insert. |
| Notes & sources | Notes et sources | Insert. |
| Text | Texte | Insert (Symbol, Date and time). |
| Pictures | Images | |
| Tables | Tableaux | |
| Page setup | Mise en page | Layout → Page setup; Word also repeats « Mise en page » as group name. |
| Document theme | Thème du document | Layout. |
| Spacing | Espacement | Layout. |
| Theme | Thème | |
| Footnotes | Notes de bas de page | References. |
| Table of contents | Table des matières | References. |
| Citations and bibliography | Citations et bibliographie | References, as in Word. |
| Proofing | Vérification | Review, as in Word. |
| Comments | Commentaires | Review. |
| Versions | Versions | Review. |
| Writing (Review group, Options section) | Rédaction | The Writing Assistant group. |
| Writing@@ribbon group (View) | Rédaction | Typewriter, Goals, Sprint. Same word as above: both are about writing. |
| Views | Affichages | View, as in Word. |
| Show@@ribbon group | Afficher | View, as in Word. |
| Zoom | Zoom | View. |
| Window@@ribbon group | Fenêtre | View. |
| Mode@@ribbon group | Mode | View: the editing modes. |
| Commands | Commandes | View. |
| Keyboard | Clavier | View: the typing keyboard (layout). |
| Code@@ribbon group | Code | Developer. |
| Math@@ribbon group | Maths | Developer (Math macros). Short. |
| My macros | Mes macros | Developer. |
| Math macros | Macros mathématiques | |
| Store@@ribbon group | Boutique | Add-ins tab: the Add-in Store. |
| Installed@@add-ins | Installés | Add-ins tab: add-ins on this computer (compléments, m. pl.). |
| Rows & Columns | Lignes et colonnes | Table Layout. |
| Cell Size | Taille de la cellule | Table Layout. |
| Alignment | Alignement | Table Layout. |
| Data | Données | Table Layout (sorting). |
| Table Styles | Styles de tableau | Table Design. |
| Table Style Options | Options de style de tableau | Table Design. |
| About | À propos | Help. |
| Features (Help group) | Fonctionnalités | Help. |
| Feedback | Votre avis | Help. Not « Commentaires » (that is review comments). |
| Welcome | Bienvenue | Help. |

### 5.3 Common commands and buttons

| English | French | Notes |
| --- | --- | --- |
| Save | Enregistrer | |
| Save As / Save as… | Enregistrer sous / Enregistrer sous… | Word's name. |
| Save all | Enregistrer tout | |
| Save as Copy… | Enregistrer une copie… | |
| Save as PDF… | Enregistrer au format PDF… | |
| Don’t Save | Ne pas enregistrer | |
| Open / Open… / Open@@verb | Ouvrir / Ouvrir… / Ouvrir | |
| Open recent | Ouvrir un document récent | Command name. |
| Recent | Récent | File → Open section, as in Word. |
| New / New document | Nouveau / Nouveau document | |
| Blank document | Document vierge | As in Word. |
| New from template… | Nouveau à partir d’un modèle… | |
| Close | Fermer | |
| Close others / Close other documents | Fermer les autres / Fermer les autres documents | |
| Close anyway | Fermer quand même | |
| Undo | Annuler | Word's name (Ctrl+Z). |
| Redo | Rétablir | Word's name. |
| Repeat | Répéter | Word's F4. |
| Cut | Couper | |
| Copy | Copier | |
| Paste | Coller | |
| Paste as plain text | Coller en texte brut | Ctrl+Shift+V. |
| Copy formatting / Format painter | Reproduire la mise en forme | Word's name for the brush. |
| Find | Rechercher | |
| Replace | Remplacer | |
| Find and replace | Rechercher et remplacer | |
| Find next / Find previous | Rechercher le suivant / Rechercher le précédent | |
| Replace all | Remplacer tout | |
| Go To | Atteindre | Word's Ctrl+G command name. |
| Go to page… / Go to heading… | Atteindre la page… / Atteindre le titre… | |
| Select / Select all | Sélectionner / Sélectionner tout | |
| Insert@@verb | Insérer | Button in dialogs. |
| Delete | Supprimer | |
| Remove | Supprimer | Same as Delete, as Word does. « Retirer » only for « Retirer des favoris ». |
| Remove from list | Supprimer de la liste | |
| Clear | Effacer | |
| Rename… | Renommer… | |
| Edit@@verb / Edit (group) | Modifier / Édition | Verb on buttons; « Édition » as the name of the command group / macOS Edit menu. |
| Edit@@leave read mode | Modifier | Button at the bottom of Read mode. |
| Change… | Modifier… | Change case: see 5.7. |
| Options | Options | File → Options. |
| Settings | Paramètres | |
| Help | Aide | |
| Cancel | Annuler | Same word as Undo, as in Word. |
| OK | OK | |
| Apply | Appliquer | |
| Reset | Réinitialiser | |
| Install / Uninstall | Installer / Désinstaller | |
| Download | Télécharger | |
| Update (verb) / Update all | Mettre à jour / Tout mettre à jour | |
| Check for updates | Rechercher des mises à jour | |
| Try again | Réessayer | In a sentence: « puis réessayez ». |
| Check again | Vérifier à nouveau | |
| Details / Technical details | Détails / Détails techniques | |
| Copy details | Copier les détails | |
| Learn more | En savoir plus | |
| Don’t show again | Ne plus afficher | |
| Show / Hide | Afficher / Masquer | |
| Turn on / Turn off | Activer / Désactiver | Turn {name} on → Activer {name}. |
| On@@switch / Off@@switch | Activé / Désactivé | |
| Continue | Continuer | |
| Back / Next / Previous | Précédent / Suivant / Précédent | Tutorial and wizard buttons. « Back » to a page: « Retour ». |
| Back to document / Back to editing | Retour au document / Retour à l’édition | |
| Done | Terminé | |
| Skip | Passer | |
| Not now / Later | Plus tard / Plus tard | |
| Browse… / Browse (add-ins tab) | Parcourir… / Parcourir | |
| Print / Print… | Imprimer / Imprimer… | |
| Print preview | Aperçu avant impression | Word's name. |
| Export / Export… | Exporter / Exporter… | |
| Import | Importer | |
| Overwrite | Remplacer | |
| Discard | Abandonner | A recording or a draft. For unsaved text use « Ne pas enregistrer ». |
| Dismiss | Rejeter | Writing Assistant: hide a suggestion. |
| Accept | Accepter | |
| Ignore / Ignore All / Ignore Rule | Ignorer / Ignorer tout / Ignorer la règle | Word's Spelling pane. |
| Add to Dictionary | Ajouter au dictionnaire | |
| Reload | Recharger | |
| Report a problem / Report this | Signaler un problème / Signaler | |
| Copy path / Copy file path | Copier le chemin d’accès | |
| Show in folder / Reveal in folder | Afficher dans le dossier | |
| Open folder | Ouvrir le dossier | |
| Run / Stop | Exécuter / Arrêter | Macros and code. |
| Compare | Comparer | |
| Sort / Sort… | Trier / Trier… | |
| Wait | Attendre | |
| Start Markooj again | Redémarrer Markooj | |
| Do it for me | Le faire pour moi | Tutorial button. |
| Show me | Me montrer | Welcome card button. |

### 5.4 Markooj's editing modes

Decision: **Word** stays « Word » (it names Microsoft Word). **Inline** is translated as « Sur place » (in-place editing); never « En ligne », which means *online* in French. **Simple** stays « Simple » (the same word in French). **Read** is « Lecture », as Word's « Mode Lecture ». The word « mode » is lower case and comes first: le mode Word, le mode Sur place, le mode Simple, le mode Lecture. The mode name keeps its capital.

| English | French | Notes |
| --- | --- | --- |
| Word (mode name) / Word mode | Word / Mode Word | Never translated. |
| Inline@@editing mode / Inline mode | Sur place / Mode Sur place | Short label on the four-part switch. |
| Simple@@editing mode / Simple mode | Simple / Mode Simple | Add to `@same` where identical. |
| Read@@editing mode / Read mode | Lecture / Mode Lecture | As in Word. |
| Editing mode / Next editing mode | Mode d’édition / Mode d’édition suivant | « édition » here; the Home group Editing stays « Modification » (Word). |
| Four editing modes / Four modes | Quatre modes d’édition / Quatre modes | |
| Try {name} mode | Essayer le mode {name} | |
| Viewer | Visionneuse | Shown instead of a mode while a PDF or DjVu file is open. |
| Inline (equation) | Dans le texte | Equation inside the line. Not the mode. |

### 5.5 Window, ribbon and navigation

| English | French | Notes |
| --- | --- | --- |
| ribbon / Ribbon | ruban (m.) / Ruban | |
| tab (ribbon tab) | onglet (m.) | Cliquez sur l’onglet Insertion. |
| tab (document tab) / Document tabs | onglet / Onglets de documents | One open document. Tab position → Position des onglets. |
| Top / Bottom / Left (tab position) | En haut / En bas / À gauche | |
| group (ribbon group) | groupe (m.) | |
| Ribbon display options | Options d’affichage du ruban | |
| Pin the ribbon / Show tabs only / Show the ribbon | Épingler le ruban / Afficher uniquement les onglets / Afficher le ruban | |
| Full-screen mode | Mode plein écran | |
| Quick access | Accès rapide | Word's « barre d’outils Accès rapide ». |
| ScreenTip | info-bulle (f.) | Office's word. |
| KeyTips | Info-bulles de touches | Office's word for the letters shown with Alt. |
| status bar | barre d’état (f.) | |
| command search / Search and commands | recherche de commandes (f.) / Recherche et commandes | Alt+Q. Search@@verb (ribbon button) → Rechercher. |
| Search or type a command | Rechercher ou taper une commande | Search box placeholder. |
| palette (command search) | recherche de commandes | Never « palette » in the interface. |
| Equation palettes | Palettes d’équations | Only the equation editor keeps « palette ». |
| window / New Window | fenêtre (f.) / Nouvelle fenêtre | |
| Next window / Previous window | Fenêtre suivante / Fenêtre précédente | |
| Switch Windows | Changer de fenêtre | Word's name. |
| Arrange All | Réorganiser tout | Word's name. |
| Reset Window Position | Rétablir la position de la fenêtre | |
| pane / Next pane | volet (m.) / Volet suivant | Word's word for side panels. |
| Split / Remove Split | Fractionner / Supprimer le fractionnement | Word's View → Window. |
| Split panes / Second pane / Second view | Volets fractionnés / Second volet / Second affichage | |
| Side by side / Stacked | Côte à côte / Superposés | |
| Swap panes / Swap documents | Permuter les volets / Permuter les documents | |
| Synchronous Scrolling | Défilement synchrone | Word's name. |
| ruler / Show the ruler / Ruler units | règle (f.) / Afficher la règle / Unités de la règle | |
| guide / Add a guide… / Clear guides | repère (m.) / Ajouter un repère… / Effacer les repères | Horizontal guide → Repère horizontal; Vertical guide → Repère vertical. |
| outline / Hide outline | plan (m.) / Masquer le plan | The heading list at the side. |
| Print layout / Print@@page layout | Page | Word's view name. |
| Web layout / Web@@page layout | Web | |
| Focus | Focus | Word's « Mode Focus ». |
| Zoom / Zoom in / Zoom out / Zoom level | Zoom / Zoom avant / Zoom arrière / Niveau de zoom | |
| Zoom to 100% / 100% | Zoom à 100⍽% / 100⍽% | |
| Fit page width / Page width | Largeur de la page | |
| Formatting marks / Show formatting marks | Marques de mise en forme / Afficher les marques de mise en forme | |
| Typewriter / Typewriter scrolling | Machine à écrire / Défilement machine à écrire | |
| Theme: Light / Dark / System / Match system | Clair / Sombre / Système / Utiliser le paramètre système | |
| More@@scroll right / Scroll left | Plus / Défiler vers la gauche | Ribbon arrows. |
| Navigate (command group) | Navigation | |
| Window (command group) | Fenêtre | |
| Keyboard shortcuts | Raccourcis clavier | |
| shortcut | raccourci (m.) | |
| Welcome / Welcome to Markooj | Bienvenue / Bienvenue dans Markooj | |
| tutorial / Tutorials | tutoriel (m.) / Tutoriels | |
| tour / Take the tour | visite guidée (f.) / Faire la visite guidée | |
| Getting started | Prise en main | |
| What’s new / What’s new in {version} | Nouveautés / Nouveautés de la version {version} | |
| Help home / Search help | Accueil de l’aide / Rechercher dans l’aide | |
| About Markooj | À propos de Markooj | |
| Credits / Credits and Licenses | Crédits / Crédits et licences | |
| Third-Party Notices | Avis de tiers | Microsoft's term. |
| license | licence (f.) | French spelling with c. |
| Privacy | Confidentialité | |
| Project page | Page du projet | |
| Reference manual | Manuel de référence | |

### 5.6 Document terms

| English | French | Notes |
| --- | --- | --- |
| document | document (m.) | |
| page | page (f.) | Page {n} → Page {n}. |
| paragraph | paragraphe (m.) | |
| line | ligne (f.) | |
| heading | titre (m.) | As in Word (Titre 1, volet « Titres »). Go to heading → Atteindre le titre. |
| Heading 1 … Heading 6 | Titre 1 … Titre 6 | Word's style names. |
| Title | Titre | Style name and File → Info field. |
| Subtitle | Sous-titre | |
| Promote / Demote | Hausser d’un niveau / Abaisser d’un niveau | Word's Outline names. |
| list / bulleted list / numbered list | liste (f.) / liste à puces / liste numérotée | |
| task list / Checklist | liste de tâches / Liste à cocher | |
| table | tableau (m.) | Never « table » except in « table des matières ». |
| cell | cellule (f.) | |
| row / column | ligne (f.) / colonne (f.) | Of a table. Text columns (Layout → Columns) are also « colonnes ». |
| Header Row | Ligne d’en-tête | Word's name. |
| Banded rows | Lignes à bandes | Word's name. |
| Gridlines / View Gridlines | Quadrillage / Afficher le quadrillage | |
| caption | légende (f.) | Insert Caption → Insérer une légende. |
| label (caption label: Figure, Table) | étiquette (f.) | Word's caption dialog. |
| figure | figure (f.) | Caption label « Figure ». |
| equation | équation (f.) | Caption label « Équation ». |
| Display (equation on its own line) / display math | Hors texte / maths hors texte | LaTeX's French term. |
| citation / Cite / Insert citation | citation (f.) / Citer / Insérer une citation | Bibliographic citation, as Word. |
| Quote (style and button) | Citation | Word's style name. If « Citation » would be ambiguous next to bibliographic citations, write « Bloc de citation ». |
| reference (library entry) | référence (f.) | {count} references → {count} références. |
| citation library / library | bibliothèque de références (f.) / bibliothèque | The BibTeX library. Citation library → Bibliothèque de références. |
| Citation style | Style de citation | |
| bibliography | bibliographie (f.) | |
| footnote | note de bas de page (f.) | Short label: « Note de bas de page »; in counts « notes de bas de page ». |
| comment / New comment | commentaire (m.) / Nouveau commentaire | Comment@@noun → Commentaire. |
| cross-reference | renvoi (m.) | Word's name. Insert cross-reference → Insérer un renvoi. Cross-ref (short) → Renvoi. |
| Reference type / Insert reference to | Catégorie / Insérer un renvoi à | Word's cross-reference dialog. |
| Table of contents | Table des matières | |
| hidden note | note masquée (f.) | A %%note%% that never prints. |
| callout / callout box | encadré (m.) | Kinds: Note → Remarque, Tip → Conseil, Important → Important, Warning → Avertissement, Caution → Attention. |
| code block / inline code | bloc de code (m.) / code dans le texte | |
| link / Edit link / Remove link | lien (m.) / Modifier le lien / Supprimer le lien | Text to show → Texte à afficher; Address → Adresse. |
| hyperlink | lien hypertexte | |
| wikilinks | liens wiki | |
| containers | conteneurs | ::: blocks. |
| picture / Pictures | image (f.) / Images | Word's name. |
| diagram | diagramme (m.) | Mermaid kinds: Flowchart → Organigramme, Sequence → Séquence, Gantt → Gantt, Pie → Secteurs, Class → Classes, Mindmap → Carte mentale. |
| symbol | symbole (m.) | |
| Page break | Saut de page | |
| Divider | Ligne de séparation | The --- rule. |
| front matter | métadonnées (f. pl.) / bloc de métadonnées | The settings block at the top of the file. Not « front matter », not « en-tête » (that is a page header). |
| template | modèle (m.) | |
| Untitled / Untitled {n} | Sans titre / Sans titre {n} | |
| Document properties / Properties | Propriétés du document / Propriétés | Subject → Objet; Keywords → Mots clés; Author(s) → Auteur(s). |
| word / character | mot (m.) / caractère (m.) | Characters (with spaces) → Caractères (espaces compris); (no spaces) → Caractères (espaces non compris). |
| Word count | Nombre de mots | |
| Document statistics | Statistiques du document | |
| Reading time / Speaking time | Temps de lecture / Temps de parole | |
| flavor (Markdown flavor) | variante (f.) | Detected Markdown flavor → Variante de Markdown détectée. |
| Features@@markdown | Éléments Markdown | Markdown features found in the document. Not « Fonctionnalités ». |
| track changes | suivi des modifications | Word's name. |

### 5.7 Formatting and page layout

| English | French | Notes |
| --- | --- | --- |
| Formatting / Clear formatting | Mise en forme / Effacer la mise en forme | |
| font / Font size | police (f.) / Taille de police | |
| Grow Font / Shrink Font | Augmenter la taille de police / Réduire la taille de police | Word's names. |
| Bold / Italic / Underline / Strikethrough | Gras / Italique / Souligné / Barré | |
| Subscript / Superscript | Indice / Exposant | |
| Small caps / All caps | Petites majuscules / Majuscules | |
| Highlight / No highlight | Surlignage / Aucun surlignage | |
| Text color / Font color | Couleur de police | Word's name. Automatic → Automatique. |
| Change Case | Modifier la casse | Items: Sentence case. → Majuscule en début de phrase.; lowercase → minuscules; UPPERCASE → MAJUSCULES; Capitalize Each Word → Majuscule En Début De Mot; tOGGLE cASE → iNVERSER lA cASSE; Title Case → Casse de titre (anglais). |
| Align left / Center / Align right / Justify | Aligner à gauche / Centrer / Aligner à droite / Justifier | |
| Bullets / Numbering | Puces / Numérotation | |
| Increase indent / Decrease indent | Augmenter le retrait / Diminuer le retrait | |
| Line spacing | Interligne (m.) | |
| Paragraph spacing / Space after paragraphs | Espacement des paragraphes / Espace après les paragraphes | |
| style / Styles / Normal | style (m.) / Styles / Normal | Word's Normal style. |
| Margins: Normal / Narrow / Wide | Marges⍽: Normales / Étroites / Larges | Word's presets (feminine plural, agree with « marges »). |
| Page size / Size | Taille de la page / Taille | |
| Letter@@paper size | Lettre US | |
| Columns: One / Two | Colonnes⍽: Une / Deux | |
| Page direction / Left to right / Right to left | Sens de la page / De gauche à droite / De droite à gauche | |
| Smart quotes | Guillemets typographiques | |
| pt (points) | pt | |
| Inches / Centimeters | Pouces / Centimètres | |

### 5.8 Equations and math

| English | French | Notes |
| --- | --- | --- |
| equation editor / Insert equation / Edit equation | éditeur d’équations (m.) / Insérer une équation / Modifier l’équation | |
| Number equations / Equation number | Numéroter les équations / Numéro d’équation | |
| LaTeX math | Maths LaTeX | |
| Fraction / Square root / Root | Fraction / Racine carrée / Racine | |
| Integral / Sum / Product / Limit | Intégrale / Somme / Produit / Limite | |
| Big operators | Grands opérateurs | |
| Brackets / Parentheses / Square brackets / Braces | Délimiteurs / Parenthèses / Crochets / Accolades | « Brackets » as a group of all kinds → Délimiteurs. |
| Matrix / Cases | Matrice / Cas | |
| Accents / Greek / Symbols / Arrows / Units | Accents / Grec / Symboles / Flèches / Unités | Equation palette tabs. |
| Math macros | Macros mathématiques | |

### 5.9 Writing and language features

| English | French | Notes |
| --- | --- | --- |
| Writing Assistant | Assistant de rédaction (m.) | The side pane. |
| spelling / grammar | orthographe (f.) / grammaire (f.) | |
| Spelling and Grammar | Orthographe et grammaire | Word's F7 name. |
| Proofing / proofing language | Vérification / langue de vérification | Word's names. |
| suggestion / Suggestions / No suggestions | suggestion (f.) / Suggestions / Aucune suggestion | |
| issue (writing issue) | problème (m.) | {count} issues → {count} problèmes; No issues → Aucun problème. |
| dictionary / My dictionary | dictionnaire (m.) / Mon dictionnaire | |
| Thesaurus / Synonyms / Antonyms | Dictionnaire des synonymes / Synonymes / Antonymes | Word's name for the thesaurus. |
| Writing score | Score de rédaction | |
| Correctness / Clarity / Engagement / Delivery | Exactitude / Clarté / Intérêt / Ton | Writing Assistant categories. |
| Goals (audience · formality · domain) | Objectifs (public · niveau de langue · domaine) | |
| Informal / Neutral / Formal | Informel / Neutre / Formel | Formality values. |
| General / Knowledgeable / Expert (audience) | Grand public / Initié / Expert | |
| Readability / Reading ease (Flesch) | Lisibilité / Facilité de lecture (Flesch) | |
| Easy / Fairly easy / Difficult … | Facile / Plutôt facile / Difficile … | |
| Excellent / Good / Getting there / Needs work | Excellent / Bien / En bonne voie / À améliorer | |
| keyboard (typing layout) | clavier (m.) / disposition de clavier (f.) | Not the same as « raccourci clavier ». |
| On-screen keyboard | Clavier visuel | Windows' name. |
| Switch keyboard | Changer de clavier | |
| language pack | module linguistique (m.) | Microsoft's term. |
| interface language | langue d’affichage (f.) | Office's term. Change interface language → Changer la langue d’affichage. |
| document language | langue du document | |
| right to left / left to right | de droite à gauche / de gauche à droite | |
| Writing goals / Daily goal / Word target | Objectifs d’écriture / Objectif quotidien / Objectif de mots | |
| writing sprint / Sprint | sprint d’écriture (m.) / Sprint | « Sprint » is accepted in French. |
| streak / {count}-day streak | série (f.) / {count} jours d’affilée | `one`: « {count} jour d’affilée ». |
| Date & time / Insert date | Date et heure / Insérer la date | |
| Gregorian / Hijri | grégorien / hégirien | Hijri date → Date hégirienne. |
| multiple cursors | curseurs multiples | |

### 5.10 Add-ins, macros and features

| English | French | Notes |
| --- | --- | --- |
| add-in | complément (m.) | Office's word. Install add-in → Installer un complément. |
| Add-in Store / Add-in store | Boutique de compléments | |
| Manage add-ins / Get add-ins | Gérer les compléments / Obtenir des compléments | |
| Community add-ins | Compléments de la communauté | |
| Add-ins folder | Dossier des compléments | |
| macro | macro (f.) | une macro, la macro. |
| Record macro / Stop recording | Enregistrer une macro / Arrêter l’enregistrement | Word's names. |
| Run macro / Stop macro | Exécuter la macro / Arrêter la macro | |
| Macro Editor | Éditeur de macros | |
| Output / Console | Sortie / Console | |
| feature (optional part: Pandoc, DjVu tools, Python macros) | fonctionnalité (f.) | « fonctionnalités facultatives » when needed, as Windows. Features (page) → Fonctionnalités. |
| feature download | téléchargement de fonctionnalité | |
| Optional | Facultatif | |
| DjVu tools / Python macros | Outils DjVu / Macros Python | Feature names. |
| tool / helper program | outil (m.) / programme (m.) | Tools@@status bar → Outils. |
| Install from file… | Installer à partir d’un fichier… | |
| Bundled / Comes with Markooj | Inclus / Fourni avec Markooj | |
| version | version (f.) | Version {version} → Version {version}. |

### 5.11 File terms

| English | French | Notes |
| --- | --- | --- |
| file / folder | fichier (m.) / dossier (m.) | |
| path | chemin d’accès (m.) | |
| export / exported | exportation (f.) / exporté | Verb: exporter. |
| import | importation (f.) | Verb: importer. |
| PDF / Export as PDF | PDF / Exporter au format PDF | |
| format | format (m.) | Pick a format → Choisir un format. |
| Plain text / Rich Text | Texte brut / Texte enrichi | Rich Text = RTF. |
| Word document / Web page / EPUB e-book | Document Word / Page web / Livre numérique EPUB | |
| Info | Informations | File → Info, as Word. |
| Recover / Recover unsaved documents | Récupérer / Récupérer les documents non enregistrés | File page. |
| recovery / recovery copy / Recovery folder | récupération (f.) / copie de récupération / Dossier de récupération | |
| recovered | récupéré | {count} recovered → {count} récupéré / {count} récupérés. |
| backup | copie de sauvegarde (f.) | |
| autosave | enregistrement automatique (m.) | Office's name. |
| Unsaved changes | Modifications non enregistrées | |
| Read only | Lecture seule | |
| Recent files | Fichiers récents | |
| Text encoding | Encodage du texte | |
| Page setup… / Print without preview | Mise en page… / Imprimer sans aperçu | |

### 5.12 States and short messages

| English | French | Notes |
| --- | --- | --- |
| Saved / Edited / Not saved yet | Enregistré / Modifié / Pas encore enregistré | After the document title (document, m.). |
| Ready | Prêt | |
| Copied / Copied. | Copié / Copié. | |
| Installed / Not installed | Installé / Non installé | |
| Loading… / Checking… / Installing… / Downloading… | Chargement… / Vérification… / Installation… / Téléchargement… | |
| None / None. | Aucun / Aucun. | Use « Aucune » when the noun is feminine. |
| No results / No matches | Aucun résultat / Aucune correspondance | |
| Nothing to undo | Rien à annuler | |
| Everything else works. | Tout le reste fonctionne. | |
| Nothing is lost | Rien n’est perdu | |
| Match case / Whole words | Respecter la casse / Mots entiers | Word's names. |
| Warning / Tip / Note | Avertissement / Conseil / Remarque | |

### 5.13 Languages and calendar

| English | French | Notes |
| --- | --- | --- |
| English (United States) / English (United Kingdom) | Anglais (États-Unis) / Anglais (Royaume-Uni) | |
| Urdu / Roman Urdu | Ourdou / Ourdou romanisé | French spelling « ourdou ». |
| Punjabi (Shahmukhi) | Pendjabi (shahmukhi) | |
| Arabic / Persian / Hebrew | Arabe / Persan / Hébreu | |
| Chinese (Simplified) / Japanese / Korean | Chinois (simplifié) / Japonais / Coréen | |
| Pseudo (testing) | Pseudo (test) | |
| Hijri months | Mouharram, Safar, Rabia al-Awal, Rabia ath-Thani, Joumada al-Oula, Joumada ath-Thania, Rajab, Chaabane, Ramadan, Chawwal, Dhou al-Qi’da, Dhou al-Hijja | Usual French transliterations. |

### 5.14 Urdu and Arabic vowel marks (aarab) and keyboards

French readers call adding harakat to Arabic-script text « vocalisation » (un texte vocalisé). Use « signes de vocalisation » for the marks and « Vocalisation » for the ribbon group and the Options heading. Keep the Urdu/Arabic mark names (zabar, zer, pesh…) as they are, with the Arabic name in parentheses where the English has it.

| English | French | Notes |
| --- | --- | --- |
| aarab / aarab marks | signes de vocalisation (m. pl.) | Removed {count} aarab marks → {count} signes de vocalisation supprimés. |
| Aarab (group, Options heading) | Vocalisation | |
| Remove Aarab / Hide Aarab | Supprimer la vocalisation / Masquer la vocalisation | |
| From Word List | Depuis la liste de mots | |
| zabar (fatha), zer (kasra), pesh (damma), shadd (shadda), jazm (sukun), tanween … | unchanged | Mark names: do not translate. |
| Half space (ZWNJ) / Joiner (ZWJ) | Demi-espace (ZWNJ) / Liant (ZWJ) | Unicode French names: antiliant/liant sans chasse. |
| Space (key) | Espace | |
| Urdu Phonetic (CRULP) / Arabic (101) | Ourdou phonétique (CRULP) / Arabe (101) | |
| Standard / Phonetic | Standard / Phonétique | |
| Keyboard: {layout} | Clavier⍽: {layout} | |

### 5.15 Terms added in the native review (2026-11-28)

| English | French | Note |
| --- | --- | --- |
| Slides | Diapositives | Export format. |
| Render as | Interpréter comme | Markdown flavor menu. |
| sans serif / serif (font) | sans empattement / avec empattements | Never « serif » or « sans » alone: Classique avec empattements, Moderne sans empattement. |
| Page layout (Options) / Start in | Mode d’affichage / Démarrer en mode | |
| card (Markdown, Writing Assistant, outline) | fiche | |
| arrow keys | touches de direction | « Flèches » in a short hint. |
| fixed-width font | police à chasse fixe | |
| syntax colors | coloration syntaxique | |
| e-book / e-book reader / e-book app | livre numérique / liseuse / application de lecture de livres numériques | |
| Jump to / Go To | Atteindre | Word's name. |
| Font dialog / Font size box | Boîte de dialogue Police / Zone Taille de police | |
| helper tool | outil externe | |
| practice document | document d’entraînement | |
| goal ring | anneau d’objectif | |
| crash | plantage | Titles stay formal: « Markooj s’est arrêté de manière inattendue ». |
| portable zip | archive zip portable | Never « le zip portable ». |
| package manager / offline | gestionnaire de paquets / hors connexion | |
| spelling pack | module d’orthographe | |
| Sample / run (sample table) | Échantillon / essai | |
| Record (macro recorder) | Enregistrer | Word's « Enregistrer une macro »; it sits on the Developer tab. |
| rule (table line) / three-rule style | filet / Trois filets | |
| Plain / Accent (table styles) | Simple / Accentuation | |
| Distribute Columns | Répartir les colonnes | |
| broken cross-reference / Chapter separator | renvoi rompu / Séparateur de chapitre | |
| pipes (separator) | barres verticales | |
| Separate text at (convert text to table) | Séparateur de texte | With the guess: Séparateur de texte (tabulations détectées). |
| Locate… / scan (document) | Localiser… / document numérisé | |
| issue (GitHub) | ticket | |
| Forward (Help history) | Suivant | |
| Flesch bands: Very easy, Easy, Plain English, Fairly difficult, Difficult | Très facile, Facile, Standard, Plutôt difficile, Difficile | Grade level → Niveau scolaire (États-Unis). |
| Supremum / Infimum / Floor / Ceiling | Borne supérieure / Borne inférieure / Plancher / Plafond | |
| blackboard bold / set upright | lettres ajourées / en caractères droits | Never « gras de tableau noir ». |
| The integers. (number sets) | L’ensemble des entiers relatifs. | Same pattern for natural, rational, real and complex numbers. |
| this copy (installation) | cette installation | |
| desktop app | application de bureau | |
| Output panel | volet Sortie | |
| safety check / Markooj’s checks | contrôle de sécurité / vérifications de Markooj | « n’a pas réussi le contrôle », never « n’a pas passé ». |
| Tags / Updated / Updates (add-ins) | Mots clés / Dernière mise à jour / Mises à jour | |
| Writing / Fun (add-in categories) | Rédaction / Divertissement | |
| Made by: The Markooj team / The community | L’équipe Markooj / La communauté | |
| Window (ribbon group) / View Side by Side | Fenêtre / Afficher côte à côte | Word's names. |
| Word Frequency / Word list | Fréquence des mots / Liste de mots | |
| safe fixes / outside word lists / Typing keyboard | corrections sûres / listes externes / Clavier de saisie | |
| Title Case | Casse de titre (anglais) | French has no title case; the rule is the English one (APA, Chicago). |
| {name} colors (color drop-down) | {name}⍽: choisir une couleur | |
| Typing X does the same. | La commande X a le même effet. | Never an infinitive as the subject (« Taper X ajoute… »): write « Quand vous tapez X, … ». |

## 6. Strings that stay the same in French

Some labels are correct as in English: OK, Options, Styles, Zoom, Focus, Simple, Web, Page, Versions, Illustrations, Code, Mode, Important, Version, Console, Sprint, Standard, Expert, Excellent, Format, Fraction, Accents, Gantt, Position, Description, Note (only where it is not the callout kind), and the brand and format names. List them in the group file’s `"@same"` array so the check script stops warning. Do not add a string to `@same` just because a translation is hard.

## 7. Decisions

- 2026-11-27: Register « vous »; infinitives on buttons, menu items, options and ScreenTip descriptions, as in Office.
- 2026-11-27: Non-breaking space U+00A0 (real character or `\u00a0` in JSON, shown as ⍽ on this page) before : ; ! ? and inside « ». Not U+202F, for font safety.
- 2026-11-27: Modes: « Word », « Sur place » (Inline), « Simple », « Lecture » (Read). Never « En ligne » for Inline.
- 2026-11-27: heading → « titre » (Word's Titre 1); Title style → « Titre »; cross-reference → « renvoi »; add-in → « complément »; language pack → « module linguistique »; interface language → « langue d’affichage ».
- 2026-11-27: Writing (Review and View groups) → « Rédaction »; Writing Assistant → « Assistant de rédaction ».
- 2026-11-27: front matter → « métadonnées »; aarab → « vocalisation » / « signes de vocalisation ».
- 2026-11-27: Key names stay English (Ctrl, Shift, Enter, Esc), never Maj/Entrée/Échap; file sizes in Ko/Mo/Go.
- 2026-11-27: Feedback → « Votre avis », so that « Commentaires » always means review comments.
- 2026-11-28: Native review: one translation for each new term (section 5.15); blackboard bold → « lettres ajourées »; Plain English (Flesch) → « Standard »; portable zip → « archive zip portable »; « n’a pas réussi » for failed checks.

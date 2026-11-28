# Spanish (Español) glossary for Markooj

Code `es` · left to right · numbers and dates from `Intl` locale `es` · plural categories `one`, `many`, `other` · the translation rules are in [docs/I18N.md](../../docs/I18N.md).

Keep to this page in every catalog file. To change a term, change it here first, then everywhere it appears.
The base is **Microsoft Office (Word) in Spanish**: our users know Word, so a Word command keeps Word's Spanish name
(Archivo, Inicio, Insertar, Disposición, Referencias, Revisar, Vista, Guardar como, Deshacer, cinta de opciones…).
Only where Markooj has no Word equivalent, or where Word's own word would be ambiguous in Markooj, do we choose our own
word; those rows say **Markooj** or **Decision** in the notes (see also section 6).

## 1. Voice and register

- **Neutral international Spanish**, understood in Spain and Latin America. Write it as a careful native speaker would write
  Word's menus: translate the meaning, never word for word. If a sentence sounds like a translation, rewrite it.
- **Avoid regional words.** Use the words Microsoft uses for all Spanish markets:
  equipo (not ordenador / computadora), archivo (not fichero), hacer clic (not pinchar / cliquear), presionar una tecla
  (not pulsar / apretar), agregar (not añadir), vínculo (not enlace), aplicación (not app), configuración, descargar.
  Do not mention the mouse (ratón / mouse): write "haz clic", "señala", "arrastra".
- **"Tú"-neutral.** Prefer wording with no pronoun at all (infinitives, impersonal "se", nouns). When a sentence must speak
  to the person, use **tú** (Microsoft's current Spanish voice), never usted, never vos, never both. Do not write the pronoun
  "tú" itself; write "tu" (possessive) only when the sentence needs it: "el documento" is better than "tu documento".
- **Buttons, menu items, ribbon commands, command names and ScreenTip titles: infinitive**, as Office does:
  Guardar, Guardar como…, Insertar tabla, Quitar vínculo, Buscar actualizaciones. Toggles that Word names with a noun keep
  the noun: Negrita, Regla, Marcas de formato, Control de cambios.
- **Descriptions of a command** (ScreenTip text, command search description, the help line under an option): a sentence in
  the **third person present** that says what the command does: "Pone en negrita el texto seleccionado.",
  "Muestra el segundo panel en modo Lectura." Do not start with "Este botón…" or "Permite…".
- **Messages, hints, tutorial steps and error remedies** that tell the person what to do: **tú imperative**
  (Libera, Abre, Elige, Haz clic, Vuelve a intentarlo, Cierra). Keep the English order: **the remedy first**, then what still works.
- **Confirmations are infinitive questions**, as in Office: "Remove {feature}?" → "¿Quitar {feature}?",
  "Close Markooj anyway?" → "¿Cerrar Markooj de todos modos?". Only "Save changes…?" uses Office's own wording with "quieres".
- **Completed actions:** short status → past participle agreeing with the noun ("Ruta copiada", "Guardado", "Macro eliminada");
  full sentence → "se" + preterite, which reads naturally everywhere: "Se instaló “{name}”.", "Se guardó el documento."
  Not "Se ha instalado" (Spain only) and not "Ha sido instalado" (passive).
- **In progress:** gerund + "…": Cargando…, Descargando…, Instalando…, Comprobando…
- **Avoid translationese:** no "por favor" in buttons or short hints (one "por favor" is allowed in a long apology, at most);
  no "usted"; no passive "fue + participio"; no "el mismo" for "it"; no "realizar" / "efectuar" where a plain verb works
  ("realizar una búsqueda" → "buscar"); no "a nivel de"; no "de cara a"; no gerund of posteriority ("Se abrió, mostrando…");
  no English capitals in the middle of a label. No exclamation marks except in the Welcome / tutorial praise lines, and then
  with the opening ¡.
- **Markooj** is a name without an article and is grammatically singular: "Markooj guarda el texto no guardado en Archivo → Recuperar."

Examples:

| English | Spanish | Why |
| --- | --- | --- |
| Free up some disk space, then try again. | Libera espacio en el disco y vuelve a intentarlo. | Remedy first; tú imperative; "vuelve a intentarlo" is Microsoft's phrase; "y" instead of a comma + "then". |
| Close the file in the other program, then try again. | Cierra el archivo en el otro programa y vuelve a intentarlo. | Same pattern in every "…, then try again." message. |
| Save changes to “{name}”? | ¿Quieres guardar los cambios en “{name}”? | Word's own Spanish wording for this dialog; buttons Guardar / No guardar / Cancelar. |
| Remove {feature}? | ¿Quitar {feature}? | Confirmation as an infinitive question. |
| Make the selected text bold. | Pone en negrita el texto seleccionado. | A command description: third person present. |
| Everything else works. | Todo lo demás sigue funcionando. | Natural Spanish, not "Todo lo demás funciona." |

## 2. Punctuation, capitals, numbers

- **Opening ¿ and ¡** always: "¿Quitar {name}?", "¡Listo!". They go where the question really starts:
  "Si cierras ahora, ¿quieres guardar los cambios?"
- **Sentence case everywhere.** English Word-style Title Case is not Spanish: "Insert Table" → "Insertar tabla",
  "Header Row" → "Fila de encabezado", "Remove Aarab" → "Quitar vocalización". Only the first word and names take a capital.
- **Lower case in Spanish**: language names, days, months and calendar eras inside a sentence ("en español", "el lunes",
  "27 de noviembre"). A language name that stands alone as a list item or label starts with a capital: "Español", "Inglés (EE. UU.)".
- **Names of tabs, groups, modes, dialogs and File pages keep their capital** when cited in a sentence, without quotes:
  "la pestaña Insertar", "el grupo Portapapeles", "el modo Simple", "Archivo → Opciones → Idioma".
  Command and button names cited in a sentence go in quotes: "haz clic en “Instalar”".
- **Accents** follow current RAE rules: solo, este, ese, guion without accent; capitals keep their accents (Á, É, Í, Ó, Ú).
  "o" between digits has no accent ("3 o 4").
- **Quotation marks**: “ ” for names of files, documents, commands and quoted text, as in the English; ‘ ’ inside them.
  Do not use « » (the interface follows Microsoft's Spanish UI). The final period goes **after** the closing quote or
  parenthesis: Se guardó “{name}”.
- **Final punctuation follows the English**: a sentence ends with a period, a label without a period stays without.
  A label ending in ":" keeps ":" with no space before it.
- **Numbers** come from `Intl` (`es`): decimal comma, period for thousands from 10 000 on (1234, 12.345, 3,5).
  Numbers typed into strings follow the same rule: "Interlineado 1,5", "8,5 × 11 pulg.", "0,5 pulg.".
  Exception: numbering samples that show separators literally keep their character ("1.1, 1.2 por capítulo", "1-1 guion").
- **Percent**: a no-break space (U+00A0) before % — `Intl` writes "100 %" too: "{percent} %", "Zoom al 100 %".
- **Units**: space before the unit: "12 pt", "41 MB", "2,5 cm", "25 min". Inches are "pulg." (Pulgadas as an option name);
  Centímetros, Milímetros. Keep KB, MB, GB, pt, px, cm, mm.
- **Abbreviations** with their Spanish periods: p. ej., cap., pág., EE. UU., etc. "e.g. 4 or ch. 2" → "p. ej., 4 o cap. 2".
- **Plurals**: Spanish uses `one` (exactly 1) and `other` (0, 2, 3…; "0 archivos"). `many` (millions) is optional and is left out:
  `other` reads correctly there. Make every word agree: `{"one": "{count} archivo seleccionado", "other": "{count} archivos seleccionados"}`.
- **Times and dates** come from `Intl` (24-hour "15:30", "27 de noviembre de 2026"). To avoid "a la / a las" agreement with a
  number you cannot see, write a comma: "today at {time}" → "hoy, {time}", "yesterday at {time}" → "ayer, {time}",
  "{date} at {time}" → "{date}, {time}". "{count} minutes ago" → "hace {count} minutos"; "just now" → "ahora mismo".
- **Date format names** use Spanish letters as Microsoft does: dd/mm/aaaa, aaaa-mm-dd (ISO), "Day month year" → "Día mes año".
  Short weekday headers: lu, ma, mi, ju, vi, sá, do (lower case, as Windows shows them).
- **Separators kept as in English**: " · " (middle dot with spaces) and " → " in menu paths: "Archivo → Recuperar".
- **y / o before a vowel sound**: "y" becomes "e" before i-/hi- ("Ortografía e idioma"), "o" becomes "u" before o-/ho-.

## 3. Placeholders, names and shortcuts in sentences

- Keep every `{placeholder}` exactly as written; move it wherever Spanish word order needs it.
- **Name placeholders** (`{name}`, `{title}`, `{file}`, `{command}`, `{query}`, `{word}`) that hold a file, document, command or
  typed text go in “ ” when the English has them, and never take an article that must agree with an unknown gender.
  Add quotes only where the English has them: "Saved “{name}”" → "Se guardó “{name}”", "Opening {name}…" → "Abriendo {name}…".
- **Feature, language and tool placeholders** (`{feature}`, `{language}`, `{tool}`) are names: no quotes, no article
  ("Instalar {feature}", "Descargar {language}"). Language names arrive capitalized; do not build "en {language}" constructions
  that would need lower case: write "Idioma: {language}".
- **Mode and tab placeholders** (`{name}` in "Try {name} mode", "Click the {name} tab.") receive the Spanish mode or tab name:
  "Probar el modo {name}", "Haz clic en la pestaña {name}.", "Haz clic en {name}, arriba a la derecha."
- **Number placeholders** (`{count}`, `{n}`, `{size}`, `{percent}`, `{current}`, `{total}`, `{number}`) stand before the noun as in
  English: "{count} palabras", "Página {current} de {total}", "{index} de {count}".
- **Keyboard keys and shortcuts stay in Latin letters, exactly as in English**: Ctrl, Shift, Alt, Enter, Esc, Tab, F1, F5, Page Down,
  Ctrl+S, Ctrl+Shift+K, Alt+Q. Do not write Mayús, Entrar, Supr or Av Pág. In a sentence: "presiona Ctrl+S",
  "con Ctrl+Enter se aplica", "(Esc)". The verb is **presionar** (Microsoft), never pulsar or apretar.
- **Shortcuts in parentheses** keep the English form: "Negrita (Ctrl+B)", "Siguiente (Enter)", "Cerrar (Esc)".
- **HTML tags** (`<b>`, `<kbd>`, `<code>`) stay exactly as they are, in the same number and order of opening.
- Product and format names never change: Markooj, Word, Excel, PowerPoint, Pandoc, KaTeX, Mermaid, Markdown, LaTeX, BibTeX,
  GitHub, Python, PDF, DOCX, EPUB, DjVu, Jupyter, LibreOffice Writer, CommonMark. "Microsoft Word" may be shortened to "Word".
- Strings that are right as in English (Zoom, Simple, Normal, General, Sprint, Markdown, Python, PDF, Word, Error…) go in
  the file's `"@same"` list so the check script stops warning.

## 4. The ellipsis "…"

- Keep "…" (the single character U+2026, never three periods) at the end of every menu item or button that opens a dialog or
  asks for more input, exactly where the English has it: "Guardar como…", "Insertar tabla…", "Cambiar nombre…", "Opciones de idioma…".
- No space before "…". In a progress state the "…" follows the gerund: "Guardando…".
- Do not add "…" where the English has none, and do not drop it where the English has it.
- In an ellipsis inside a sentence ("Home, Insert, Layout …") Spanish writes "…" without a space before it.

## 5. Terms

### 5.1 Ribbon tabs (as in Word)

| English | Spanish | Notes |
| --- | --- | --- |
| File | Archivo | The File tab and the full-window File page. |
| Home | Inicio | Ribbon tab. |
| Insert (ribbon tab) | Insertar | Same word as the action. |
| Layout | Disposición | Word's current name for the page layout tab. |
| References | Referencias | |
| Review | Revisar | |
| View | Vista | |
| Developer | Programador | Office's Spanish name for the Developer tab. |
| Add-ins | Complementos | Office's name. |
| Help | Ayuda | |
| Table Design | Diseño de tabla | Contextual tab. |
| Table Layout | Disposición de tabla | Contextual tab. |
| Table Tools | Herramientas de tabla | Title over the contextual tabs. |

### 5.2 Ribbon groups

| English | Spanish | Notes |
| --- | --- | --- |
| Clipboard | Portapapeles | Inicio. |
| Font | Fuente | Inicio. Also "font" in general. |
| Paragraph | Párrafo | Inicio. |
| Styles | Estilos | Inicio. |
| Editing | Edición | Inicio. |
| Direction | Dirección | Inicio: text direction of the paragraph. |
| Aarab | Vocalización | Inicio: Urdu/Arabic vowel marks. **Decision**, see 5.11. |
| Blocks | Bloques | Insertar. |
| Captions | Leyendas | Insertar. **Decision**: caption = leyenda. |
| Illustrations | Ilustraciones | Insertar. |
| Pictures | Imágenes | Insertar; also the file filter name. |
| Links & pages | Vínculos y páginas | Insertar. |
| Notes & sources | Notas y citas | Insertar (footnotes, citations). Avoids "fuentes", which also means fonts. |
| Text | Texto | Insertar (Símbolo, Fecha y hora). |
| Page setup | Configurar página | Disposición, as in Word. |
| Spacing | Espaciado | Disposición. |
| Document theme | Tema del documento | Disposición. |
| Table of contents | Tabla de contenido | Referencias; also the inserted table. Word's singular "contenido". |
| Footnotes | Notas al pie | Referencias. |
| Proofing | Revisión | Revisar, as in Word. |
| Writing (Review group) | Escritura | Revisar: the Writing Assistant. |
| Versions | Versiones | Revisar. |
| Views | Vistas | Vista. |
| Show (View group) | Mostrar | Vista. |
| Mode (ribbon group) | Modo | Vista. |
| Zoom | Zoom | Vista. Same as English; add to `@same`. |
| Window (View group) | Ventana | Vista. |
| Writing (View group) | Escritura | Vista (Máquina de escribir, Objetivos, Sprint). |
| Theme | Tema | Vista. |
| Keyboard | Teclado | Vista: the typing keyboard. |
| Tables (View group) | Tablas | Vista. |
| Commands | Comandos | Vista. |
| Code (Developer group) | Código | Programador. |
| Math (ribbon group) | Matemáticas | Programador. |
| My macros | Mis macros | Programador. |
| Store (ribbon group) | Tienda | Complementos. |
| Installed (add-ins) | Instalados | Complementos (masculine: los complementos). |
| Table Styles | Estilos de tabla | Diseño de tabla. |
| Table Style Options | Opciones de estilo de tabla | Diseño de tabla. |
| Rows & Columns | Filas y columnas | Disposición de tabla. |
| Cell Size | Tamaño de celda | Disposición de tabla. |
| Alignment | Alineación | Disposición de tabla. |
| Data | Datos | Disposición de tabla. |
| Convert | Convertir | Disposición de tabla. |
| About | Acerca de | Ayuda; "About Markooj" → "Acerca de Markooj". |
| Features (Help group) | Características | Ayuda: the optional parts of Markooj. |
| Feedback | Opiniones | Ayuda. **Decision**: Office says "Comentarios", which in Markooj means review comments. |
| Welcome | Bienvenida | Ayuda and status bar chip. "Welcome to Markooj" → "Te damos la bienvenida a Markooj". |

### 5.3 Common commands and buttons

| English | Spanish | Notes |
| --- | --- | --- |
| Save | Guardar | |
| Save As / Save as… | Guardar como / Guardar como… | |
| Save as Copy… | Guardar una copia… | Word's wording. |
| Save all | Guardar todo | |
| Don't Save | No guardar | |
| Open (verb) | Abrir | `Open@@verb`, `Open@@file page`. |
| Open (state) | Abierto / abierta | Agrees with the noun. |
| Open recent | Abrir recientes | The File page itself is "Recientes". |
| New | Nuevo | File page; "New document" → "Documento nuevo". |
| Close | Cerrar | |
| Close anyway | Cerrar de todos modos | |
| Undo | Deshacer | |
| Redo | Rehacer | |
| Repeat | Repetir | |
| Cut | Cortar | |
| Copy | Copiar | |
| Paste | Pegar | |
| Paste as plain text | Pegar como texto sin formato | |
| Select all | Seleccionar todo | |
| Find | Buscar | |
| Find next / Find previous | Buscar siguiente / Buscar anterior | |
| Replace | Reemplazar | |
| Replace all | Reemplazar todo | |
| Find and replace | Buscar y reemplazar | |
| Match case | Coincidir mayúsculas y minúsculas | As in Word. |
| Whole words | Solo palabras completas | |
| Go To / Go to… | Ir a / Ir a… | |
| Insert (verb) | Insertar | `Insert@@verb`. |
| Delete | Eliminar | Removes something for good (comment, macro, row). |
| Delete all | Eliminar todo | "Delete all comments" → "Eliminar todos los comentarios". |
| Remove | Quitar | Takes something off without destroying it (link, guide, feature, add-in, from a list). |
| Clear | Borrar | Empties a field, guides, the console. "Clear formatting" → "Borrar todo el formato". |
| Rename… | Cambiar nombre… | |
| Options | Opciones | Archivo → Opciones. |
| Settings | Configuración | Any other set of settings. |
| Help | Ayuda | |
| Cancel | Cancelar | |
| OK | Aceptar | |
| Apply | Aplicar | |
| Reset | Restablecer | |
| Install | Instalar | |
| Uninstall | Desinstalar | |
| Update | Actualizar | "Update all" → "Actualizar todo". |
| Check for updates | Buscar actualizaciones | |
| Download | Descargar | |
| Try again | Reintentar | Button. In a sentence: "vuelve a intentarlo". |
| Details | Detalles | "Copy details" → "Copiar detalles"; "Technical details" → "Detalles técnicos". |
| Learn more | Más información | |
| Don't show again | No volver a mostrar | |
| Show / Hide | Mostrar / Ocultar | |
| Turn on / Turn off | Activar / Desactivar | "Turn on {name}" → "Activar {name}". |
| On / Off (switch) | Activado / Desactivado | Short switch states. |
| Continue | Continuar | |
| Skip | Omitir | |
| Next / Previous | Siguiente / Anterior | |
| Back / Forward | Atrás / Adelante | |
| Done | Listo | |
| Not now | Ahora no | |
| Later | Más tarde | |
| Discard | Descartar | |
| Dismiss | Descartar | Writing suggestion. |
| Overwrite | Sobrescribir | |
| Browse… | Examinar… | Opens a file picker, as in Office. "Browse add-ins" → "Explorar complementos". |
| Choose a file | Elegir un archivo | "Choose / Pick" → elegir. |
| Copy path | Copiar ruta | "Path copied" → "Ruta copiada". |
| Show in folder / Reveal in folder | Mostrar en la carpeta | |
| Copy link | Copiar vínculo | |
| Print / Print… | Imprimir / Imprimir… | |
| Print preview | Vista previa de impresión | |
| Run | Ejecutar | Macro or code. |
| Stop | Detener | |
| Record | Grabar | Macro. |
| Accept | Aceptar | Writing suggestion. Same word as OK. |
| Ignore / Ignore All / Ignore Rule | Omitir / Omitir todo / Omitir regla | As in Word's spelling pane. |
| Change / Change… | Cambiar / Cambiar… | |
| Sort / Sort… | Ordenar / Ordenar… | |
| Ascending / Descending | Ascendente / Descendente | |
| Report a problem | Notificar un problema | Neutral in all regions. |
| Copy version info | Copiar información de la versión | |
| Search (verb) | Buscar | `Search@@verb`. |

### 5.4 Markooj's editing modes

The four mode names are names: capital first letter, never in quotes. "Word" refers to Microsoft Word and is never translated.

| English | Spanish | Notes |
| --- | --- | --- |
| Word (mode name) | Word | On the four-part switch. |
| Inline (mode name) | En línea | On the switch (8 characters). Also Word's word for an inline equation. |
| Simple (mode name) | Simple | Same as English; add to `@same`. |
| Read (mode name) | Lectura | On the switch. |
| Word mode | Modo Word | In a sentence: "el modo Word". |
| Inline mode | Modo En línea | "el modo En línea". |
| Simple mode | Modo Simple | "el modo Simple". |
| Read mode | Modo Lectura | "el modo Lectura". **Decision**: not Word's "Modo de lectura", so all four follow one pattern ("Probar el modo {name}"). |
| Editing mode | Modo de edición | |
| Viewer | Visor | Status bar, while a PDF or DjVu file is open. |
| Print layout / Web layout | Diseño de impresión / Diseño web | As in Word. Short switch labels: Impresión / Web. |
| Focus | Enfoque | Word's Focus view. "Leave focus" → "Salir del enfoque". |

### 5.5 Window, ribbon and navigation

| English | Spanish | Notes |
| --- | --- | --- |
| ribbon | cinta de opciones | Short form "cinta" in tight labels ("Anclar la cinta"). |
| tab (ribbon tab) | pestaña | "la pestaña Insertar". |
| tab (document tab) | pestaña | "Document tabs" → "Pestañas de documentos". |
| group (ribbon group) | grupo | |
| contextual tab | pestaña contextual | |
| Ribbon display options | Opciones de presentación de la cinta de opciones | Word. |
| Show tabs only / Show tabs and commands | Mostrar solo pestañas / Mostrar pestañas y comandos | Word. |
| Full-screen mode | Modo de pantalla completa | |
| Pin the ribbon | Anclar la cinta de opciones | |
| Quick access | Acceso rápido | Word's Quick Access Toolbar. |
| ScreenTip | información en pantalla | Word's term. |
| KeyTips | Sugerencias de teclas | Word's term for the Alt letters. |
| command search / palette | búsqueda de comandos | Alt+Q. "Search for a command" → "Buscar un comando". |
| status bar | barra de estado | |
| title bar | barra de título | |
| window | ventana | |
| pane | panel | "Next pane" → "Panel siguiente"; "Second pane" → "Segundo panel". |
| New Window | Nueva ventana | Word. |
| Arrange All | Organizar todo | Word. |
| Switch Windows | Cambiar ventanas | Word. |
| Split | Dividir | Word (Vista → Ventana). "Split panes" → "Paneles divididos". |
| Remove Split | Quitar división | Word. |
| split divider | divisor | |
| View Side by Side / side by side | Ver en paralelo / en paralelo | Word. |
| Synchronous Scrolling | Desplazamiento sincrónico | Word. |
| Reset Window Position | Restablecer posición de la ventana | Word. |
| Stacked / Stack the panes | Apilados / Apilar los paneles | |
| Swap | Intercambiar | "Swap panes" → "Intercambiar paneles". |
| ruler | regla | |
| guide | guía | Feminine. "Add guide…" → "Agregar guía…"; "Clear guides" → "Borrar guías". |
| Horizontal / Vertical guide | Guía horizontal / Guía vertical | |
| Ruler units | Unidades de la regla | |
| outline | esquema | The list of headings at the side. "Hide outline" → "Ocultar esquema". |
| zoom in / zoom out | Acercar / Alejar | "Zoom level" → "Nivel de zoom". |
| Fit page width / Page width | Ajustar al ancho de página / Ancho de página | |
| Formatting marks | Marcas de formato | |
| Gridlines | Líneas de cuadrícula | "View Gridlines" → "Ver cuadrícula" (Word). |
| theme / light / dark | tema / Claro / Oscuro | "Match system" → "Igual que el sistema". |
| Typewriter scrolling | Desplazamiento de máquina de escribir | Short ribbon button: "Máquina de escribir". |
| Navigate (command group) | Navegación | |
| Edit (command group, macOS menu) | Edición | The verb `Edit@@verb` is "Editar". |
| Preview | Vista previa | "Show preview" → "Mostrar vista previa". |
| keyboard shortcut | método abreviado de teclado | Microsoft's term. Short labels: "Métodos abreviados", "Método abreviado". |

### 5.6 Document terms

| English | Spanish | Notes |
| --- | --- | --- |
| document | documento | |
| Untitled / Untitled {n} | Sin título / Sin título {n} | |
| page | página | "Page {n}" → "Página {n}". |
| page break | salto de página | |
| paragraph | párrafo | |
| sentence | oración | Microsoft's word ("Tipo oración"); not "frase". |
| line | línea | |
| word / character | palabra / carácter | Plural "caracteres" (no accent). |
| heading | título | As in Word ("Título 1" … "Título 6"). |
| Title / Subtitle | Título / Subtítulo | Paragraph styles and document properties. |
| Normal / Normal text | Normal / Texto normal | Paragraph style. |
| style | estilo | |
| Bold / Italic / Underline | Negrita / Cursiva / Subrayado | |
| Strikethrough / Subscript / Superscript | Tachado / Subíndice / Superíndice | |
| Small caps / All caps | Versalitas / Mayúsculas | |
| Highlight / Font color | Color de resaltado del texto / Color de fuente | Short label for Highlight: "Resaltado". |
| Change Case | Cambiar mayúsculas y minúsculas | Choices: Tipo oración, minúsculas, MAYÚSCULAS, Poner En Mayúsculas Cada Palabra, aLTERNAR mAY/mIN. |
| Format painter / Copy formatting | Copiar formato | Word's name for the Format Painter. |
| Grow Font / Shrink Font | Aumentar tamaño de fuente / Disminuir tamaño de fuente | |
| Align left / Center / Align right / Justify | Alinear a la izquierda / Centrar / Alinear a la derecha / Justificar | |
| Increase / Decrease indent | Aumentar sangría / Disminuir sangría | |
| Line spacing | Interlineado | "Line spacing 1.5" → "Interlineado 1,5". |
| Paragraph spacing | Espaciado entre párrafos | |
| Promote / Demote | Subir de nivel / Bajar de nivel | Heading level. |
| list | lista | |
| Bullets / Numbering | Viñetas / Numeración | |
| checklist / task list | lista de comprobación / lista de tareas | |
| table | tabla | |
| cell / row / column | celda / fila / columna | |
| Header Row | Fila de encabezado | Word. |
| Banded rows | Filas con bandas | Word. |
| Insert Above / Below / Left / Right | Insertar arriba / Insertar debajo / Insertar a la izquierda / Insertar a la derecha | Word. |
| Distribute Columns | Distribuir columnas | Word. |
| Convert Text to Table… / Convert Table to Text… | Convertir texto en tabla… / Convertir tabla en texto… | Word. |
| caption | leyenda | **Decision**: Word says "título", which is already "heading". "Insert caption" → "Insertar leyenda". |
| figure | figura | **Decision**: Word's default label is "Ilustración"; researchers write "Figura" (APA, IEEE in Spanish). |
| equation | ecuación | |
| inline math / display math | matemáticas en línea / ecuación en bloque | "Display" (placement) → "En bloque". |
| label (identifier such as eq:x) | etiqueta | "Equation label" → "Etiqueta de la ecuación". |
| cross-reference | referencia cruzada | Short ribbon button "Cross-ref" → "Ref. cruzada". |
| numbering (of figures, equations) | numeración | |
| citation | cita | "Cite" (button) → "Citar"; "Insert citation" → "Insertar cita". |
| reference (bibliographic entry) | referencia | |
| source (bibliographic) | fuente | Only when clear from context; prefer "referencia". |
| bibliography | bibliografía | |
| citation library / BibTeX library | biblioteca de citas / biblioteca BibTeX | "Library" (button) → "Biblioteca". |
| citation style | estilo de cita | |
| footnote | nota al pie | Plural "notas al pie". |
| comment | comentario | Review comment. |
| Track changes | Control de cambios | |
| Compare | Comparar | |
| hidden note | nota oculta | A %%note%% that never prints. |
| quote (block quote) | cita textual | **Decision**: "cita" alone is a citation. Paragraph style button "Quote" → "Cita textual". |
| callout | destacado | "Callout box" → "Cuadro destacado". |
| divider | línea divisoria | |
| code block / inline code | bloque de código / código en línea | |
| symbol | símbolo | |
| Date & time | Fecha y hora | |
| link | vínculo | Office's word. "Remove link" → "Quitar vínculo"; "Text to show" → "Texto que se mostrará". |
| picture | imagen | "Find missing pictures" → "Buscar imágenes que faltan". |
| diagram / flowchart | diagrama / diagrama de flujo | |
| front matter | metadatos | The settings block at the top of a Markdown file. Explain once as "bloque de metadatos (front matter)" in help-like text. |
| properties | propiedades | "Document properties" → "Propiedades del documento". |
| template | plantilla | "New from template…" → "Nuevo a partir de plantilla…". |
| Margins / Narrow / Wide | Márgenes / Estrechos / Anchos | Word's margin presets. |
| Page size / Letter / Columns | Tamaño de página / Carta / Columnas | |
| Markdown flavor | variante de Markdown | `Flavor` → "Variante". |
| word count | recuento de palabras | Ribbon button "Word count" → "Contar palabras" (Word). |
| readability | legibilidad | "Flesch reading ease" → "Facilidad de lectura de Flesch". |
| writing goal / word target | objetivo de escritura / objetivo de palabras | "Daily goal" → "Objetivo diario". |
| writing sprint | sprint de escritura | Short button "Sprint" (`@same`). |
| streak | racha | "{count}-day streak" → "Racha de {count} días". |

### 5.7 Writing and language features

| English | Spanish | Notes |
| --- | --- | --- |
| Writing Assistant | Asistente de escritura | Markooj: the side pane with writing suggestions. |
| spelling | ortografía | |
| grammar | gramática | |
| Spelling & Grammar | Ortografía y gramática | Word. |
| suggestion | sugerencia | |
| Accept safe fixes | Aceptar correcciones seguras | |
| issue (writing) | problema | "{count} issues" → "{count} problemas"; "No issues" → "Sin problemas". |
| Correctness / Clarity / Engagement / Delivery | Corrección / Claridad / Atractivo / Tono | Suggestion categories. |
| Audience / Formality / Domain | Público / Formalidad / Ámbito | Writing goals. |
| dictionary / My dictionary | diccionario / Mi diccionario | "Add to Dictionary" → "Agregar al diccionario". |
| Thesaurus / Synonyms / Antonyms | Sinónimos / Sinónimos / Antónimos | Word names the thesaurus "Sinónimos". |
| Proofing language | Idioma de corrección | Word. |
| Document language | Idioma del documento | |
| Interface language | Idioma de la interfaz | |
| language pack | paquete de idioma | "Get language packs" → "Obtener paquetes de idioma". |
| word list | lista de palabras | |
| Technical terms | Términos técnicos | |
| Suggest words | Sugerir palabras | Word completion while typing. |
| keyboard (typing layout) | teclado | "Keyboard: {layout}" → "Teclado: {layout}". Not a shortcut. |
| keyboard layout | distribución del teclado | Windows term. |
| On-screen keyboard | Teclado en pantalla | Short button "On-screen" → "En pantalla". |
| Switch keyboard | Cambiar teclado | |
| Phonetic / Standard | Fonético / Estándar | Keyboard layouts. |
| Half space (ZWNJ) | Semiespacio (ZWNJ) | Persian/Urdu zero-width non-joiner. |
| Joiner (ZWJ) | Unión (ZWJ) | |
| Left to right / Right to left | De izquierda a derecha / De derecha a izquierda | |
| multiple cursors | varios cursores | "Add cursor above" → "Agregar cursor arriba". |
| Slash commands | Comandos con barra (/) | |
| Gregorian / Hijri | Gregoriano / Hégira | Calendars. "Hijri date" → "Fecha de la hégira". |
| Today | Hoy | |

### 5.8 Add-ins, macros and features

| English | Spanish | Notes |
| --- | --- | --- |
| add-in | complemento | Office's word. Masculine. |
| Add-in Store | Tienda de complementos | |
| Get add-ins | Obtener complementos | Office. |
| Manage add-ins | Administrar complementos | |
| Community add-ins | Complementos de la comunidad | |
| macro | macro | **Feminine**: "la macro", "Nueva macro", "Macro eliminada". |
| Record macro / Stop recording | Grabar macro / Detener grabación | Word. |
| Run macro | Ejecutar macro | |
| Macro Editor | Editor de macros | |
| Math macros | Macros matemáticas | |
| Python console | Consola de Python | |
| feature (optional part) | característica | **Markooj**: an optional part that downloads once (Pandoc, herramientas DjVu, macros de Python). "Features" page → "Características". |
| Choose extra features | Elegir características adicionales | |
| helper tool | herramienta auxiliar | |
| bundled / comes with Markooj | incluido / incluido con Markooj | |
| offline | sin conexión | **Never "en línea" for online** (that is the mode name): write "con conexión a internet". |
| DjVu tools | herramientas DjVu | Feature name. |
| Python macros | macros de Python | Feature name. |
| version | versión | "Needs {version}" → "Requiere {version}". |
| What's new | Novedades | |
| Credits / Licenses | Créditos / Licencias | |
| Third-party notices | Avisos de terceros | |
| Repository / Project page | Repositorio / Página del proyecto | |
| tutorial / guided tour | tutorial / recorrido guiado | "Take the tour" → "Hacer el recorrido". |
| Getting started | Primeros pasos | |

### 5.9 File terms

| English | Spanish | Notes |
| --- | --- | --- |
| file | archivo | Never "fichero". |
| folder | carpeta | |
| path | ruta | |
| computer | equipo | "On this computer" → "En este equipo". |
| Info (File page) | Información | Word's File → Información. |
| Recent | Recientes | File page. "Recent files" → "Archivos recientes". |
| Blank document | Documento en blanco | |
| export / Export… | exportar / Exportar… | "Export as PDF…" → "Exportar como PDF…". |
| import | importar | |
| format | formato | "Pick a format" → "Elegir un formato". |
| PDF | PDF | Masculine: "el PDF". |
| web page | página web | |
| Recover (File page) | Recuperar | Unsaved text Markooj keeps. "Recover unsaved…" → "Recuperar documentos no guardados…" (Word's name). |
| Recovery (Options section) | Recuperación | "Open recovery folder" → "Abrir la carpeta de recuperación". |
| recovered / recovery copy | recuperado / copia de recuperación | "{name} (recovered)" → "{name} (recuperado)". A copy kept in case it is needed is a "copia de recuperación"; text brought back is "texto recuperado". |
| backup | copia de seguridad | |
| autosave | Autoguardado | Office's name. |
| Saved / Not saved yet / Unsaved changes | Guardado / Aún sin guardar / Cambios sin guardar | |
| Read only | Solo lectura | No accent on "solo". |
| Edited (document state) | Modificado | |
| encoding | codificación | "Text encoding" → "Codificación de texto". |
| download (noun) / download page | descarga / página de descargas | |
| zip | zip | "Windows portable zip" → "zip portátil para Windows". |
| Install from file… | Instalar desde archivo… | |
| Plain text | Texto sin formato | |

### 5.10 States and short messages

| English | Spanish | Notes |
| --- | --- | --- |
| Ready | Listo | |
| Loading… / Downloading… / Installing… / Checking… | Cargando… / Descargando… / Instalando… / Comprobando… | |
| Copied | Copiado | Agree with the noun when known: "Ruta copiada". |
| Installed / Not installed | Instalado / No instalado | |
| None | Ninguno | Agree if the noun is known ("Ninguna"). |
| Automatic / Always / Never | Automático / Siempre / Nunca | |
| Optional | Opcional | |
| Nothing to undo | No hay nada que deshacer | |
| No results / No matches | Sin resultados / Sin coincidencias | |
| Everything else works. | Todo lo demás sigue funcionando. | |
| Not available here | No disponible aquí | |
| Warning / Tip / Note / Important / Caution | Advertencia / Sugerencia / Nota / Importante / Precaución | Callout types. |

### 5.11 Urdu and Arabic vowel marks (aarab)

Spanish readers know these marks as **vocalización** ("texto vocalizado", "quitar la vocalización") or by their Arabic names.
The group and the commands use "vocalización"; the single marks keep their Urdu name first and the Arabic name in parentheses,
as the English does.

| English | Spanish | Notes |
| --- | --- | --- |
| Aarab (group, Options heading) | Vocalización | |
| aarab (the marks) | signos de vocalización | "Aarab shown again." → "Se vuelven a mostrar los signos de vocalización." |
| Remove Aarab / Hide Aarab | Quitar vocalización / Ocultar vocalización | |
| From Word List | Desde la lista de palabras | |
| Zabar / Zer / Pesh | Zabar / Zer / Pesh | Names; "zabar (fatha)", "zer (kasra)", "pesh (damma)". |
| Shadd / Jazm | Shadd / Jazm | "shadd (shadda)", "jazm (sukun)". |
| Tanween / Khari zabar | Tanwin / Khari zabar | "Tanween zabar" → "Tanwin zabar". |
| Hijri months | muharram, safar, rabi al-awwal, rabi al-thani, yumada al-ula, yumada al-ajira, rayab, shabán, ramadán, shawwal, du al-qada, du al-hiyya | Capital first letter when they stand alone in a calendar. |

## 6. Decisions

- **caption = leyenda, heading = título.** Word uses "título" for both; Markooj shows headings and captions side by side
  (Cross-reference dialog, numbering), so they need different words.
- **figure = figura**, as in Spanish academic writing, not Word's "Ilustración".
- **quote = cita textual**, because "cita" is a citation.
- **Feedback = Opiniones** (Windows' "Centro de opiniones"), because "Comentarios" are review comments.
- **Mode names**: Word, En línea, Simple, Lectura; full names "modo Word", "modo En línea", "modo Simple", "modo Lectura".
- **Notes & sources = Notas y citas**, to keep "fuentes" for fonts.
- **Delete = Eliminar, Remove = Quitar, Clear = Borrar**; never mix them.
- **Shortcut = método abreviado (de teclado)**, as Microsoft writes it; never "atajo".
- **Keys stay in English letters** (Ctrl, Shift, Enter, Esc, Page Down), and the verb is "presionar".

## 7. Terms added in the first review (November 2026)

One translation each; use it in every catalog file.

| English | Spanish | Notes |
|---|---|---|
| browser | navegador | **Decision**: never "explorador" (that word stays for File Explorer → "Explorador de archivos"). |
| Check again | Volver a comprobar | Shared key (tools check and language packs). |
| clipboard | Portapapeles | Capitalized, as Microsoft writes it, also mid-sentence. |
| Smart quotes | Comillas tipográficas | |
| AutoCorrect as you type | Autocorrección al escribir | |
| Editing style | Estilo de edición | |
| Render as / Detected flavor | Interpretar como / Variante detectada | Markdown flavor = variante. |
| Markdown features (status-bar chips) | elementos | "Features@@markdown" → "Elementos"; "características" stays for optional parts. |
| generic feature (not an optional part) | función | |
| wikilinks / containers | vínculos wiki / contenedores | |
| Rich Text | texto enriquecido | |
| Slides / Beamer slides | Diapositivas / Diapositivas Beamer | |
| Jupyter notebook | Cuaderno de Jupyter | |
| EPUB e-book | Libro electrónico EPUB | |
| Page thumbnails / page viewer | Miniaturas de página / visor de páginas | |
| Title Case / Sentence case | Tipo Título / Tipo oración | Word's naming pattern. |
| Font dialog | Cuadro de diálogo Fuente | |
| Print Layout view | Vista Diseño de impresión | |
| Single / Double line spacing | Interlineado sencillo / doble | |
| mouse wheel | rueda de desplazamiento | |
| caption label word (Eq., Fig.) | rótulo | As in Word's Caption dialog; "etiqueta" stays for the eq:x identifier. |
| Full label | Rótulo y número completos | Word's Cross-reference dialog. |
| Above/below; Include above/below | Más adelante o más atrás; Incluir más adelante o más atrás | Word. |
| For which X | Para qué X | Word. |
| Insert as hyperlink | Insertar como hipervínculo | Word's wording in that dialog only; "vínculo" everywhere else. |
| merged cells | celdas combinadas | Word. |
| Format Table | Dar formato a la tabla | Never "formatear". |
| Tabs / Commas / Semicolons / Pipes (separators) | Tabulaciones / Comas / Punto y coma / Barras verticales | |
| Accent / Plain (table styles) | Énfasis / Sencillo | |
| Brackets (palette) | Delimitadores | Parentheses = paréntesis, Square brackets = corchetes, Braces = llaves. |
| ... that grow | ... ajustables | |
| Display (equation placement) | En bloque | Placement = Ubicación. |
| live preview | vista previa en vivo | |
| Typing shortcuts | Escritura rápida | |
| Locate… | Localizar… | |
| SI units | julio, vatio, voltio, amperio, ohmio, hercio | RAE/CEM forms. |
| crash / stopped unexpectedly | cierre inesperado / se cerró de forma inesperada | |
| caret | punto de inserción | Word's term. |
| terminal | ventana de terminal; Terminal (macOS app) | Avoids el/la terminal. |
| package manager / file manager | administrador de paquetes / administrador de archivos | |
| manifest / trash | manifiesto / papelera | |
| reload / restart | volver a cargar / reiniciar | |
| unzip | extraer (descomprimir in sentences about the zip) | |
| command id | identificador de comando | |
| macro recorder | grabadora de macros | |
| Output (panel) | Salida | |
| grade level (Flesch–Kincaid) | nivel escolar | "Grade level" label: "Nivel escolar (EE. UU.)". |
| Very easy … Very difficult | Muy fácil / Bastante fácil / Fácil / Bastante difícil / Difícil / Muy difícil | |
| Speaking time | Tiempo en voz alta | |
| Made by / Installed by you / Comes with Markooj | Creado por / Instalado por ti / Incluido con Markooj | |
| add-in categories | Todos, Desarrollo, Exportación, Diversión, Idiomas, Matemáticas, Otros, Productividad, Investigación, Escritura | "Developer" as a category = Desarrollo; the tab stays Programador. |
| No highlight / Text color | Sin color / Color de fuente | Word. |
| Show me / Report this | Ver cómo / Notificar el problema | |
| Margins presets | Normal, Estrecho, Ancho | Word, singular. |
| templates | Artículo de investigación, Cuaderno de laboratorio, Capítulo de tesis, Notas de reunión, Revisión bibliográfica | |
| Hijri / AH | hégira / d. H. | |
| Tutorial step titles | tú imperative (Inserta una tabla, Presiona Alt) | Tutorial names in Help → Tutorials and buttons stay infinitive. |

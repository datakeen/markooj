# Portuguese (Brazil) (Português (Brasil)) glossary for Markooj

Code `pt-BR` · left to right · plural categories: `one`, `many`, `other` · the translation rules are in [docs/I18N.md](../../docs/I18N.md).

Every catalog file (`shell`, `app`, `editors`, `language`, `system`) follows this page. To change a term, change it here first, then everywhere it appears. When Microsoft Word in Brazilian Portuguese has a name for the same thing, use Word's name: our users know Word, and they look for **Página Inicial**, **Referências** and **Revisão**, not for a new word.

## 1. Voice and register

The interface should read like Brazilian Microsoft Office written by a careful native editor: clear, friendly, direct, never a word-for-word copy of the English.

- **Brazilian Portuguese only.** Arquivo (not ficheiro), tela (not ecrã), salvar (not guardar), excluir (not apagar or eliminar), baixar (not transferir), configurações (not definições), usuário (not utilizador), acessar (not aceder), link (not ligação), registro (not registo), mouse (not rato).
- **Address the user as você, but write the pronoun only when it is needed.** Brazilian software speaks to the user with the imperative of the você form and leaves the subject out: Clique, Escolha, Digite, Pressione, Abra, Tente novamente. Use seu/sua for the user's things (seu documento, suas alterações). Never tu, never o usuário when speaking to the person, never the formal o senhor.
- **Labels (buttons, menu items, commands, ribbon labels, headings): infinitive or noun, as Office does.** Salvar, Abrir, Inserir tabela, Excluir comentário, Ir para o título. Never the imperative on a label (Salve, Insira), never a period on a label.
- **Toggle options and check boxes** use the infinitive or a short noun phrase: Verificar ortografia ao digitar, Mostrar régua, Mostrar sempre.
- **ScreenTip descriptions and help sentences** (the English sentence with a period) follow the English form: an English imperative becomes the você imperative (Make the selected text bold. → Deixe o texto selecionado em negrito.); an English third person stays third person (Makes all body text one size bigger. → Aumenta um tamanho em todo o texto do corpo.).
- **Solution first.** The English messages say what to do first, then what happened, then what still works. Keep that order. Never start with an apology and never add one (Desculpe, Lamentamos) that the English does not have.
- **Plain and short.** É possível… → Você pode…, or just the verb. Efetuar o salvamento → Salvar. Realizar a instalação → Instalar. Avoid the passive with "ser" when an active sentence is natural (O arquivo foi salvo pelo Markooj → O Markooj salvou o arquivo).
- **No exclamation marks** unless the English has one, and then at most one. A cheerful English line becomes a friendly but calm Portuguese line (You’re all set! → Tudo pronto.).
- **Gerund for progress**, as Brazilians write: Carregando…, Baixando…, Salvando… (not "A carregar").
- **Avoid needless anglicisms**: deletar → excluir, printar → imprimir or capturar a tela, setar → definir, linkar → vincular. Accepted loanwords, used by Microsoft Brasil: link, download (noun), backup, e-mail, zoom, layout, design, feedback, mouse, tutorial, macro.
- **Brand names take the masculine article in sentences**, as Brazilians say "o Word": o Markooj, do Markooj, no Markooj; o Word, o Excel, o Pandoc, o GitHub, o Markdown, o LaTeX. A short label may leave it out (Sobre o Markooj, but Ajuda do Markooj).
- **Gender and number agreement** follow the noun: Próximo comentário / Próxima página; {count} arquivos salvos / {count} páginas salvas. When an English adjective stands alone on a button, agree with the noun it describes (check the code or the note).

Three short examples:

| English | Portuguese (Brazil) | Why |
| --- | --- | --- |
| Save changes to “{name}”? / Save / Don’t Save / Cancel | Deseja salvar as alterações em “{name}”? / Salvar / Não salvar / Cancelar | The question Word asks, with the same short buttons. |
| Try again, or choose another format. Markooj could not finish the {format} file; your document is unchanged. | Tente novamente ou escolha outro formato. O Markooj não conseguiu concluir o arquivo {format}; seu documento não foi alterado. | Solution first, você imperative, article before Markooj, no apology. |
| Bold / Make the selected text bold. | Negrito / Deixe o texto selecionado em negrito. | Label is a noun; the description is a você imperative, as Word's ScreenTips. |

## 2. Punctuation, capitalization and numbers

- **Sentence case everywhere**, also where the English uses Title Case (Table Design → Design da tabela, Find Missing Pictures → Localizar imagens ausentes, Reset Window Position → Redefinir posição da janela). Only the first word and proper names are capitalized. Language names, months and weekdays are lower case inside a sentence (em português, segunda-feira, janeiro), capitalized only at the start of a label.
- **No space before** : ; ? ! (unlike French). Follow the English: an English sentence with a period ends with a period; a label without one has none.
- **Quotes:** keep the curly quotes of the English, “…”, and ‘…’ inside a quote. Do not use « » or straight quotes "…".
- **After a colon**, continue in lower case unless a UI name or a proper name follows: Tema: {theme}; Teclado: {layout}.
- **Lists:** no comma before e/ou (Recortar, copiar e colar). "or" in a sentence is ou, "and" is e. & in a label becomes e: Links & pages → Links e páginas, Date & time → Data e hora.
- **Arrows and separators:** keep → for menu paths (Arquivo → Recuperar), keep the middle dot · used as a separator in the English (Somente leitura · 2 páginas). The em dash — may stay where the English has one, with spaces around it.
- **Numbers:** comma for decimals, period for thousands: 1,5 / 12.345. Numbers in `{count}` and other placeholders are formatted by the app; numbers written in the text itself follow this rule (1.5 cm → 1,5 cm).
- **Percent:** no space: 50%.
- **Units:** one space between the number and the unit: 41 MB, 12 pt, 25 minutos, 2,5 cm.
- **Ranges and ratios:** Page {current} of {total} → Página {current} de {total} (as Word's status bar); {index} of {count} → {index} de {count}; 1 to 9 → 1 a 9; {columns} × {rows} keeps ×.
- **Times and dates** come from Intl; do not hard-code a format around placeholders. today at {time} → hoje às {time}.
- **Plurals.** Brazilian Portuguese uses `one`, `many` and `other`. **`one` is used for 0 and 1** (and fractions below 2), `other` for 2 and more, `many` only for exact millions. Write `one` and `other` always; `many` may be left out (the check script accepts that), or written with "de" when the noun follows a million directly (1.000.000 de palavras).
  - `"{count} files": { "one": "{count} arquivo", "other": "{count} arquivos" }`
  - Because 0 takes the `one` form, never put "1" or "um" in a `one` form in place of `{count}`. When a sentence reads badly with 0 (0 arquivo encontrado), prefer a wording that works for both, for example with a noun that does not change: Arquivos encontrados: {count}.
  - Agreement inside a plural form changes too: `"one": "{count} página salva", "other": "{count} páginas salvas"`.

## 3. Placeholders, names and shortcuts in sentences

- Keep every `{placeholder}` exactly; move it to where Portuguese grammar needs it (Saved {name} → “{name}” salvo / Arquivo “{name}” salvo).
- **Never contract an article with a placeholder whose gender you cannot know.** Write a noun before it instead: Install {feature} → Instalar {feature} (no article needed), Remove {feature}? → Remover o recurso {feature}?, Open {name} → Abrir “{name}”, in {format} → em {format}. Avoid do {x}, no {x}, ao {x}, da {x} with a bare placeholder.
- **Names the user gave or typed** (`{name}`, `{title}`, `{query}`, `{word}`, `{text}`, `{file}`) stay in “ ” when the English has them, and are never translated. Nenhum resultado para “{query}”.
- **Names of UI things** (tabs, groups, pages, buttons, modes) are written as their Portuguese label, without quotes, as the English does: Clique na guia Inserir. Abra Arquivo → Recuperar. Use Página Inicial → Estilos → Título 1.
- **Numbers and Latin-only values** (`{count}`, `{n}`, `{size}`, `{version}`, `{tool}`, `{format}`, `{key}`, `{keys}`, `{label}`, `{path}`) go where Portuguese needs them, with the normal spaces: versão {version}, {count} sugestões, Localizar em {format} (Ctrl+F).
- **Keyboard keys stay in Latin letters, exactly as in the English:** Ctrl, Shift, Alt, Enter, Esc, Tab, Backspace, Delete, Home, End, Page Up, Page Down, F1 … and combinations such as Ctrl+Shift+K. Never Controle, Maiúsculas or Tecla de Tabulação.
  - **Never change a shortcut** to the one Brazilian Word uses (Word in Portuguese bolds with Ctrl+N and saves with Ctrl+B). Markooj's shortcuts are the ones in the English text: Negrito (Ctrl+B), Salvar (Ctrl+S).
  - After a label, in parentheses with one space before: Salvar (Ctrl+S), Fechar (Esc).
  - In a sentence: Pressione Ctrl+S para salvar. / Pressione a tecla Alt. (add "a tecla" only before a single key).
  - Keep `<kbd>Ctrl+S</kbd>` and other tags and their content unchanged: Pressione <kbd>Ctrl+S</kbd> para salvar.
- **Product and format names stay as is:** Markooj, Word, Excel, PowerPoint, Pandoc, KaTeX, Mermaid, Markdown, LaTeX, BibTeX, GitHub, Python, JavaScript, PDF, DOCX, EPUB, DjVu, Jupyter, Google Sheets. Word document → documento do Word; Markdown text → texto Markdown.
- **Never translate** Markdown syntax, `@eq:energy`, `**bold**` markers, `%%note%%`, file extensions, command ids or anything inside `<code>`.

## 4. The ellipsis “…”

- Keep “…” (U+2026, one character) at the end of a menu item or button that opens a dialog, exactly where English has it, with no space before it: Save as… → Salvar como…, Options… → Opções…, Browse… → Procurar…, Go to heading… → Ir para o título…
- Do not write "..." (three periods).
- Progress states also keep “…”: Carregando…, Baixando…, Instalando…, Verificando…
- An English label without “…” gets none in Portuguese.

## 5. Terms

Use these in every file. “Word” in the notes means Microsoft Word for Windows in Brazilian Portuguese (Microsoft 365).

### 5.1 Ribbon tabs (as in Word)

| English | Portuguese (Brazil) | Notes |
| --- | --- | --- |
| File | Arquivo | The File tab and the full-window File page. `File@@info card` → Arquivo. |
| Home | Página Inicial | Word's tab name; keep both capitals, it is a proper name in Word. |
| Insert (ribbon tab) | Inserir | Also the Insert button (`Insert@@verb`): Inserir. |
| Layout | Layout | Word's tab. |
| References | Referências | |
| Review | Revisão | |
| View | Exibir | Word's tab. |
| Developer | Desenvolvedor | Word's tab. `Developer@@add-in category` → Desenvolvimento. |
| Add-ins | Suplementos | Tab and the general word, as Office. |
| Help | Ajuda | |
| Table Design | Design da tabela | Contextual tab, as Word (Design da Tabela). |
| Table Layout | Layout da tabela | Contextual tab. Word calls it only Layout; we add "da tabela" so it differs from the Layout tab. |
| Table Tools | Ferramentas de tabela | Label above the contextual tabs. |

### 5.2 Ribbon groups

| English | Portuguese (Brazil) | Notes |
| --- | --- | --- |
| Clipboard | Área de transferência | Home. |
| Font | Fonte | Home. |
| Paragraph | Parágrafo | Home. |
| Styles | Estilos | Home. |
| Editing | Edição | Home (Find, Replace, Select). |
| Direction | Direção | Home: left-to-right / right-to-left paragraphs. Text direction → Direção do texto. |
| Aarab | Sinais vocálicos | Home group for Urdu/Arabic vowel marks (see 5.11). |
| Blocks | Blocos | Insert: code block, callout, divider. |
| Illustrations | Ilustrações | Insert, as Word. |
| Pictures | Imagens | Insert, as Word. |
| Text | Texto | Insert (Symbol, Date & time). |
| Links & pages | Links e páginas | Insert. |
| Notes & sources | Notas e citações | Insert (footnote, citation, hidden note). Not "fontes": that is Font. |
| Captions | Legendas | Insert / References, as Word. |
| Page setup | Configurar página | Layout, as Word. |
| Spacing | Espaçamento | Layout. |
| Document theme | Tema do documento | Layout. |
| Table of contents | Sumário | References, as Word. |
| Footnotes | Notas de rodapé | References. |
| Citations & bibliography | Citações e bibliografia | References, Word's name. |
| Proofing | Revisão de texto | Review, as Word. |
| Comments | Comentários | Review. |
| Language | Idioma | Review. Office says idioma, never língua. |
| Versions | Versões | Review. |
| Writing (Review group) | Escrita | Writing Assistant, readability. Also `Writing@@heading` and `Writing@@add-in category`. |
| Writing@@ribbon group (View) | Rotina de escrita | Typewriter scrolling, goals, sprint. Differs from the Review group. |
| Views | Modos de exibição | View, as Word. |
| Show@@ribbon group | Mostrar | View → Mostrar (ruler, gridlines), as Word. |
| Zoom | Zoom | View. |
| Window@@ribbon group | Janela | View. |
| Mode@@ribbon group | Modo de edição | View: the four editing modes. |
| Theme | Tema | View / Layout. |
| Keyboard | Teclado | View group and the typing keyboard. |
| Commands | Comandos | View. |
| Tables | Tabelas | View group. |
| Code@@ribbon group | Código | Developer. |
| Macros | Macros | Developer. "macro" is feminine: a macro, as macros. |
| Math macros | Macros de matemática | Developer. |
| My macros | Minhas macros | Developer. |
| Math@@ribbon group | Matemática | Developer. |
| Manage | Gerenciar | Add-ins. |
| Store@@ribbon group | Loja | Add-ins. |
| Installed@@add-ins | Instalados | Add-ins group: the add-ins on this computer. |
| About | Sobre | Help group. About Markooj → Sobre o Markooj. |
| Feedback | Feedback | Help. Not "Comentários" (that is Comments). |
| Welcome | Boas-vindas | Help button and status bar chip. |
| Features (optional parts) | Recursos | Help group and File → Options → Recursos. Not `Features@@markdown` (see 5.6). |
| Table Styles | Estilos de tabela | Table Design. |
| Table Style Options | Opções de estilo de tabela | Table Design. |
| Rows & Columns | Linhas e colunas | Table Layout. |
| Cell Size | Tamanho da célula | Table Layout. |
| Alignment | Alinhamento | Table Layout. |
| Data | Dados | Table Layout. |

### 5.3 Common commands and buttons

| English | Portuguese (Brazil) | Notes |
| --- | --- | --- |
| Save | Salvar | Command (Ctrl+S) and dialog button. |
| Don’t Save | Não salvar | |
| Save As / Save as… | Salvar como / Salvar como… | |
| Save all | Salvar tudo | |
| Save a copy | Salvar uma cópia | Word. |
| Open (verb) | Abrir | Open… → Abrir…; `Open@@file page` and `Open@@dialog title` → Abrir. |
| Open (adjective, state) | Aberto | `Open@@adjective`; agree with the noun (aberta, abertos). |
| Close | Fechar | Close tab → Fechar guia. |
| New | Novo | File → Novo (`New@@file page`). New document → Novo documento. `New@@macro` → Nova (a macro). |
| Undo | Desfazer | |
| Redo | Refazer | |
| Repeat | Repetir | Word's F4. |
| Cut | Recortar | |
| Copy | Copiar | Noun "a copy" → uma cópia. |
| Paste | Colar | |
| Paste as plain text | Colar sem formatação | Word's option is Manter Somente Texto; as a command this is shorter and clear. |
| Select all | Selecionar tudo | |
| Find | Localizar | Word. Not Procurar, not Buscar. |
| Replace | Substituir | |
| Find and replace | Localizar e substituir | |
| Find next / Find previous | Localizar próxima / Localizar anterior | Agrees with ocorrência. |
| Replace all | Substituir tudo | |
| Match case | Diferenciar maiúsculas e minúsculas | Word. |
| Whole words | Palavras inteiras | Short form of Word's option. |
| Go To | Ir para | Word's Ctrl+G. Go to page → Ir para a página. |
| Insert (button) | Inserir | |
| Delete | Excluir | Not apagar, not deletar. |
| Remove | Remover | Remove from list → Remover da lista. Remove link → Remover link. |
| Rename | Renomear | |
| Edit (verb) | Editar | `Edit@@verb`, `Edit@@leave read mode` → Editar. |
| Options | Opções | File → Opções. |
| Settings | Configurações | |
| Help | Ajuda | |
| Cancel | Cancelar | |
| OK | OK | |
| Apply | Aplicar | |
| Reset | Redefinir | Not resetar. Reset Window Position → Redefinir posição da janela. |
| Install | Instalar | |
| Uninstall | Desinstalar | |
| Download (verb / button) | Baixar | Noun: o download. Downloads (list) → Downloads. |
| Update | Atualizar | Update all → Atualizar tudo. Check for updates → Verificar se há atualizações. An update → uma atualização. |
| Refresh / Reload | Atualizar / Recarregar | Refresh the list → Atualizar a lista; Reload the window → Recarregar a janela. |
| Try again | Tentar novamente | Button. In a sentence: Tente novamente. |
| Details | Detalhes | |
| Technical details | Detalhes técnicos | |
| Learn more | Saiba mais | |
| Don’t show again | Não mostrar novamente | |
| Show / Hide | Mostrar / Ocultar | Hide {name} → Ocultar {name}. |
| Turn on / Turn off | Ativar / Desativar | `On@@switch` / `Off@@switch` → Ativado / Desativado (Windows switches). |
| Next / Previous | Próximo / Anterior | Agree with the noun: Próxima página. |
| Back / Forward | Voltar / Avançar | `Back` in a tutorial → Voltar. |
| Continue | Continuar | |
| Done | Concluído | |
| Skip | Pular | Tutorials and onboarding. In the Writing Assistant use Ignorar. |
| Not now / Later | Agora não / Mais tarde | |
| Browse… | Procurar… | Word's file dialog button. |
| Choose / Pick / Select | Escolher / Escolher / Selecionar | Select text → Selecionar texto. |
| Click / Double-click | Clicar / Clicar duas vezes | In a sentence: Clique em…, Clique duas vezes em… Not "clicar em cima". |
| Type (verb) | Digitar | `Type@@verb before an example` → Digite. |
| Press | Pressionar | Pressione Enter. |
| Discard | Descartar | |
| Overwrite | Substituir | Replace the existing file, as Windows does. |
| Copy path / Copy link | Copiar caminho / Copiar link | |
| Show in folder | Mostrar na pasta | |
| Run | Executar | `Run@@macro` → Executar. |
| Stop | Parar | |
| Close anyway | Fechar mesmo assim | Button in “Close Markooj anyway?”. |
| Report a problem | Relatar um problema | |
| Accept / Dismiss | Aceitar / Ignorar | Writing Assistant card. A notification's Dismiss → Fechar. |
| Search (verb) | Pesquisar | `Search@@verb` → Pesquisar. |
| Print / Print… | Imprimir / Imprimir… | Print preview → Visualizar impressão. |
| Zoom in / Zoom out | Ampliar / Reduzir | |
| More@@scroll right | Mais | |

### 5.4 Markooj's editing modes

The mode switch in the title bar is tiny; the short names must stay at about 8 characters.

| English | Portuguese (Brazil) | Notes |
| --- | --- | --- |
| Word mode | Modo Word | Named after Microsoft Word; keep “Word”. The short switch label `Word` stays Word. |
| Inline@@editing mode / Inline mode | Em linha / Modo em linha | Live Markdown in the line. Not the inline equation (that is embutida, 5.6). |
| Simple@@editing mode / Simple mode | Simples / Modo simples | Markdown text with a live preview. |
| Read@@editing mode / Read mode | Leitura / Modo de leitura | Word's Modo de Leitura. |
| Editing mode | Modo de edição | |
| Viewer | Visualizador | Status bar, while a PDF or DjVu file is open. |
| Print layout / Web layout | Layout de impressão / Layout da Web | Word. Short switch labels `Print@@page layout` → Impressão, `Web@@page layout` → Web. |
| Focus | Foco | Word's Modo de Foco. Leave focus → Sair do foco. |
| Read only | Somente leitura | Word. |

### 5.5 Window, ribbon and navigation

| English | Portuguese (Brazil) | Notes |
| --- | --- | --- |
| ribbon | faixa de opções | Office's term. Never "ribbon" or "fita". |
| tab (ribbon tab) | guia | Office's term (a guia Inserir). Click the {name} tab → Clique na guia {name}. Not aba. |
| tab (document tab) | guia | Same word, as Edge and Windows. Close tab → Fechar guia. When it must be clear: guia do documento. Tab position: `Top` / `Bottom` / `Left@@tab position` → Superior / Inferior / Esquerda. |
| group (ribbon group) | grupo | |
| Quick access | Acesso rápido | The small toolbar in the title bar. Word's full name: Barra de ferramentas de acesso rápido (use it in descriptions). |
| status bar | barra de status | Office. |
| command search (palette, Alt+Q) | pesquisa de comandos | Search or type a command → Pesquisar um comando (shortened 2026-11-28: the longer text was cut off in the title bar). Command palette → paleta de comandos. |
| palette key hints | mover / executar / só comandos / títulos / fechar | `move`, `run`, `commands only`, `headings`, `close@@palette key hint`; lower case, very short. |
| command | comando | |
| ScreenTip | Dica de tela | Office's term. |
| KeyTips | Dicas de tecla | Office's term. |
| keyboard shortcut | atalho de teclado | Shortcut alone: atalho. |
| window | janela | New Window → Nova janela. |
| pane | painel | Side pane: painel (or the pane's own name, such as Estrutura de tópicos). A half of a split: painel too, as Excel's Congelar Painéis. Second pane → segundo painel. |
| Split / Remove Split | Dividir / Remover divisão | Word's Exibir → Dividir. |
| View Side by Side / side by side | Exibir lado a lado / lado a lado | Word. Close View Side by Side → Fechar Exibir lado a lado. |
| Stacked | Um acima do outro | Split option opposite to Lado a lado. |
| Synchronous Scrolling | Rolagem sincronizada | Word. |
| Arrange All | Organizar tudo | Word. |
| Switch Windows | Alternar janelas | Word. |
| outline | estrutura de tópicos | The list of headings at the side (Word's Estrutura de Tópicos). Pane title: Estrutura de tópicos. |
| ruler | régua | Rulers → Réguas. |
| guide (guide line) | linha-guia | Plural linhas-guia. Not "guia" alone, which is a tab. Horizontal / Vertical guide → Linha-guia horizontal / vertical. |
| gridlines | linhas de grade | Word. |
| formatting marks | marcas de formatação | Word. |
| Zoom / zoom level | Zoom / nível de zoom | Fit page width → Largura da página. |
| theme (interface) | tema | `Light@@theme` / `Dark@@theme` → Claro / Escuro; `System@@theme` → Sistema; Match system → Usar o tema do sistema. |
| Appearance | Aparência | Options section. |
| full-screen mode | tela inteira | Windows. |
| Welcome / Welcome screen | Boas-vindas / tela de boas-vindas | Welcome to Markooj → Boas-vindas ao Markooj (neutral, as Microsoft writes it now; not Bem-vindo, which assumes a gender). |
| tutorial / guided tour | tutorial / tour guiado | Take the tour → Fazer o tour. |
| Getting started | Primeiros passos | |
| What’s new | Novidades | What’s new in {version} → Novidades da versão {version}. |
| Home (start page of a list) | Início | Only where it is not the Página Inicial tab. |

### 5.6 Document terms

| English | Portuguese (Brazil) | Notes |
| --- | --- | --- |
| document | documento | `Document@@statistics card` → Documento. |
| Blank document | Documento em branco | Word. |
| Untitled / Untitled {n} | Sem título / Sem título {n} | |
| template | modelo | Word. New from template → Novo a partir de modelo. Not template. |
| page | página | Page break → Quebra de página. |
| section | seção | `Section@@template preview` → Seção. |
| paragraph | parágrafo | |
| heading / Heading 1 | título / Título 1 | Word style names: Título 1 … Título 6. Go to heading… → Ir para o título… |
| Normal (style) / Title / Subtitle | Normal / Título / Subtítulo | Word style names. |
| Quote (style) / block quote | Citação / citação em bloco | Word's style name. Use citação em bloco when it could be confused with a bibliographic citation. |
| style | estilo | |
| text / selected text | texto / texto selecionado | Body text → texto do corpo. |
| line (of text) | linha | Same word as a table row, as Word. |
| Bold / Italic / Underline / Strikethrough | Negrito / Itálico / Sublinhado / Tachado | Word. |
| Subscript / Superscript | Subscrito / Sobrescrito | Word. |
| Highlight | Realce | Word's button: Cor do realce do texto. No color → Sem cor. |
| Text color / Font color | Cor da fonte | Word. Automatic (color) → Automático. |
| Clear formatting | Limpar toda a formatação | Word. |
| formatting | formatação | Unformatted / without formatting → sem formatação. |
| Format painter | Pincel de formatação | Word. |
| Change case | Maiúsculas e minúsculas | Word's button. UPPERCASE / lowercase → MAIÚSCULAS / minúsculas. |
| Grow Font / Shrink Font | Aumentar fonte / Reduzir fonte | Word: Aumentar/Diminuir tamanho da fonte; keep short. |
| Font size | Tamanho da fonte | `pt@@font size unit points` → pt. `system@@font` → padrão do sistema. |
| Align left / Center / Align right / Justify | Alinhar à esquerda / Centralizar / Alinhar à direita / Justificar | Word. Note the crase: à esquerda, à direita. |
| Line spacing / paragraph spacing | Espaçamento entre linhas / espaçamento entre parágrafos | Word. |
| Bullets / Numbering | Marcadores / Numeração | Word. |
| list / numbered list / bulleted list | lista / lista numerada / lista com marcadores | |
| task list / checklist | lista de tarefas / lista de verificação | |
| Increase indent / Decrease indent | Aumentar recuo / Diminuir recuo | Word. |
| Promote / Demote | Promover / Rebaixar | Word's outline commands. |
| table | tabela | Insert table → Inserir tabela. |
| row / column (table) | linha / coluna | Insert Row Above → Inserir linha acima; Insert Column Left → Inserir coluna à esquerda. |
| cell | célula | Merge cells → Mesclar células; Split cells → Dividir células. |
| Header row | Linha de cabeçalho | Word. Rows (including the header) → Linhas (incluindo o cabeçalho). |
| Banded rows | Linhas em tiras | Word. |
| Sort / Ascending / Descending | Classificar / Crescente / Decrescente | Word. |
| Convert Text to Table / Convert Table to Text | Converter texto em tabela / Converter em texto | Word. |
| columns (page layout) | colunas | `One@@columns` / `Two@@columns` → Uma / Duas. |
| margins | margens | `Normal@@margins` / Narrow / Wide → Normal / Estreita / Larga. |
| page size / Letter | tamanho / Carta | `Letter@@paper size` → Carta. Orientation → Orientação; Portrait / Landscape → Retrato / Paisagem. |
| header / footer (page) | cabeçalho / rodapé | |
| caption | legenda | Word. Insert caption → Inserir legenda. |
| label (caption or cross-reference label) | rótulo | Word's caption dialog. |
| figure | figura | Figure {number} → Figura {number}. |
| equation | equação | Insert equation → Inserir equação. Equation {number} → Equação {number}. |
| inline equation / display equation | equação embutida / equação em exibição | Word's Alterar para Embutida / Exibição. Equation editor `Inline` → Embutida. |
| equation editor / equation palettes | editor de equações / paletas de equações | |
| numbering (of equations, figures) | numeração | Numbered → Numerada. |
| chapter | capítulo | |
| citation / cite | citação / citar | Word. Insert citation → Inserir citação. |
| reference (one source in the library) | referência | {count} references → {count} referências. Not "fonte" (that is Font). |
| citation library / BibTeX library | biblioteca de referências / biblioteca BibTeX | |
| citation style | estilo de citação | APA, Chicago… stay as they are. |
| bibliography | bibliografia | Word. Insert bibliography → Inserir bibliografia. |
| footnote | nota de rodapé | Insert footnote → Inserir nota de rodapé. |
| comment | comentário | `Comment@@noun` → Comentário. New comment → Novo comentário. |
| hidden note (%%note%%) | nota oculta | Never printed. |
| cross-reference | referência cruzada | Word. Short `Cross-ref` → Ref. cruzada. |
| table of contents | sumário | Word. Update table → Atualizar sumário. |
| link / hyperlink | link / hiperlink | Word. Text to display → Texto para exibição; Address → Endereço. |
| picture | imagem | Word. Picture not found → Imagem não encontrada. Missing pictures → imagens ausentes. |
| diagram / Mermaid diagram | diagrama / diagrama Mermaid | Flowchart → Fluxograma; Pie → Pizza; Gantt → Gantt. |
| symbol | símbolo | |
| Date & time | Data e hora | |
| code block / inline code | bloco de código / código em linha | |
| callout box (Note, Tip, Important, Warning, Caution) | caixa de destaque (Nota, Dica, Importante, Aviso, Cuidado) | GitHub-style alert boxes. |
| divider | linha divisória | |
| front matter | metadados | The settings block at the top of a Markdown file. Where the English explains it at length, write bloco de metadados (front matter) once. |
| Markdown flavor | variante do Markdown | `auto@@detected automatically` → auto. |
| Features@@markdown | Recursos usados | The Markdown features a document uses; not Markooj's optional Features. |
| source (Markdown text of the document) | texto Markdown | Show source → Mostrar o Markdown. |
| preview | visualização | Live preview → visualização ao vivo. |
| properties / document properties | propriedades / propriedades do documento | `Name@@property` → Nome. |
| track changes | controlar alterações | Word. |
| word count / words / characters | contagem de palavras / palavras / caracteres | Word. {count} words → {count} palavras. |
| readability | legibilidade | |
| version / compare | versão / comparar | Compare with the saved version → Comparar com a versão salva. |

### 5.7 Writing and language features

| English | Portuguese (Brazil) | Notes |
| --- | --- | --- |
| Writing Assistant | Assistente de escrita | Markooj's side pane (like Microsoft Editor). |
| suggestion (writing) | sugestão | {count} suggestions → {count} sugestões. |
| suggestion (spelling replacement) | sugestão | No spelling suggestions → Nenhuma sugestão de ortografia. |
| spelling | ortografia | Word. Check spelling as you type → Verificar ortografia ao digitar. |
| grammar | gramática | |
| Spelling and grammar | Ortografia e gramática | Word's button. |
| proofing / proofing language | revisão de texto / idioma de revisão | Word. |
| Add to Dictionary / Ignore / Ignore All | Adicionar ao dicionário / Ignorar / Ignorar tudo | Word. |
| my dictionary / custom dictionary | dicionário personalizado | Word. |
| thesaurus / synonyms / antonyms | dicionário de sinônimos / sinônimos / antônimos | Word. |
| language | idioma | Office's word. Not língua. |
| interface language | idioma de exibição | Office's term for the language of menus and buttons. |
| document language | idioma do documento | |
| language pack | pacote de idioma | One language's spelling and rules. Language packs → Pacotes de idioma. |
| keyboard (typing layout) | teclado | Urdu Phonetic, Arabic 101… Keyboard layout → layout de teclado. |
| on-screen keyboard | teclado virtual | Windows. |
| right to left / left to right | da direita para a esquerda / da esquerda para a direita | Text direction → Direção do texto. |
| half space (ZWNJ) / joiner (ZWJ) | meio espaço (ZWNJ) / conector (ZWJ) | On-screen keyboard keys. |
| readability score / writing score | pontuação de legibilidade / pontuação da escrita | |
| audience / formality / domain | público / formalidade / área | Writing Assistant goals. Formal / Informal → Formal / Informal. |
| Correctness / Clarity / Engagement / Delivery | Correção / Clareza / Envolvimento / Tom | Writing Assistant categories. Delivery is the tone for your goals. |
| safe fix | correção segura | Accept all safe fixes → Aceitar todas as correções seguras. |
| `Right@@correct` | Certo | Screen-reader name of the ✓ before a correct example. Wrong → Errado. |
| typewriter scrolling | rolagem de máquina de escrever | |
| writing goal / daily goal / word target | meta de escrita / meta diária / meta de palavras | |
| writing sprint / Sprint | sprint de escrita / Sprint | Start a 25-minute sprint → Iniciar um sprint de 25 minutos. "Sprint" is masculine. |
| streak | sequência | {count}-day streak → {count} dias seguidos. |
| slash commands | comandos de barra | Commands typed after /. |
| multiple cursors / cursor | vários cursores / cursor | Add cursor below → Adicionar cursor abaixo. |
| selection | seleção | |
| Gregorian / Hijri calendar | calendário gregoriano / calendário da Hégira | |
| weekday short names | Seg, Ter, Qua, Qui, Sex, Sáb, Dom | `Mo@@monday short` … `Su@@sunday short`. |

### 5.8 Add-ins, macros and features

| English | Portuguese (Brazil) | Notes |
| --- | --- | --- |
| add-in | suplemento | Office's term. Masculine: o suplemento. |
| Add-in Store | Loja de suplementos | |
| community add-ins | suplementos da comunidade | |
| add-in author | autor do suplemento | |
| add-in categories | Todos / Desenvolvimento / Exportação / Diversão / Idiomas / Matemática / Outros / Produtividade / Pesquisa / Escrita | `All@@add-in category` … `Writing@@add-in category`. |
| macro | macro | Feminine: a macro. |
| Record macro / Stop recording | Gravar macro / Parar gravação | Word. |
| Run macro | Executar macro | |
| Macro Editor | Editor de macros | |
| math macros | macros de matemática | LaTeX \newcommand definitions. |
| Python console / Output | console do Python / Saída | `Shell@@command line` → Shell. |
| feature (optional part to download) | recurso | Pandoc, DjVu tools, Python macros: downloaded when wanted. Optional features → Recursos opcionais (as Windows). Install {feature} → Instalar {feature}. |
| feature download | download de recursos | Cancel feature downloads → Cancelar downloads de recursos. |
| DjVu tools | ferramentas DjVu | |
| helper tool / tool | ferramenta auxiliar / ferramenta | `Tools@@status bar` → Ferramentas. |
| Developer | Desenvolvedor | Messages for developers stay English. |
| program / computer | programa / computador | On your computer → no seu computador. |

### 5.9 File terms

| English | Portuguese (Brazil) | Notes |
| --- | --- | --- |
| file | arquivo | Not ficheiro. |
| folder | pasta | |
| file name / path | nome do arquivo / caminho | |
| file type | tipo de arquivo | `Text@@file type` → Texto. |
| format (file format) | formato | |
| export | exportar | Export as PDF → Exportar como PDF. An export → uma exportação. |
| import | importar | |
| Save as PDF… | Salvar como PDF… | |
| Word document | documento do Word | |
| web page | página da Web | Office writes Web with a capital. |
| PDF / DjVu / EPUB e-book | PDF / DjVu / livro digital EPUB | |
| plain text (no formatting) | texto sem formatação | Word's file type. Code-block language `Plain text` → Texto simples. |
| Recent | Recentes | File → Abrir, as Word. Recent files → Arquivos recentes. |
| Info | Informações | File → Informações, as Word. |
| Recover / recovery | Recuperar / recuperação | File → Recuperar. Recover unsaved… → Recuperar não salvos… |
| recovered text / recovery copy | texto recuperado / cópia de recuperação | |
| backup | backup | Microsoft Brasil keeps backup. |
| autosave / AutoRecover | salvamento automático / AutoRecuperação | Office. |
| Saved / Edited / Not saved yet | Salvo / Editado / Ainda não salvo | Title-bar states. `edited@@document state` → editado. |
| unsaved changes | alterações não salvas | |
| read-only | somente leitura | |
| Print preview | Visualizar impressão | Word. |
| encoding | codificação | Text encoding → Codificação de texto. |
| license / credits / third-party notices | licença / créditos / avisos de terceiros | |
| Repair Markooj | Reparar o Markooj | |
| privacy | privacidade | |
| browser | navegador | |

### 5.10 States and short messages

| English | Portuguese (Brazil) | Notes |
| --- | --- | --- |
| Loading… | Carregando… | |
| Checking… | Verificando… | |
| Downloading… / Installing… / Updating… | Baixando… / Instalando… / Atualizando… | |
| Running… / Starting… | Executando… / Iniciando… | |
| Saving… | Salvando… | |
| Ready | Pronto | |
| Installed / Not installed | Instalado / Não instalado | |
| Copied | Copiado | Short toast. Copied. → Copiado. |
| Saved {name} | “{name}” salvo | |
| No results / No matches | Nenhum resultado / Nenhuma correspondência | |
| Nothing to undo | Nada para desfazer | |
| just now / {count} minutes ago | agora mesmo / há {count} minutos | |
| today / yesterday | hoje / ontem | |
| Everything else works. | Todo o resto continua funcionando. | The “what still works” part of messages. |
| Nothing is lost | Nada foi perdido | |
| Your document is unchanged. | Seu documento não foi alterado. | |
| Markooj is unchanged. | O Markooj não foi alterado. | |

### 5.11 Urdu and Arabic vowel marks (aarab)

Brazilian users meet these only when they write Urdu or Arabic. Use **sinais vocálicos** for the general word “aarab” (Hide aarab → Ocultar sinais vocálicos). Keep the mark names in their usual Latin spelling, with the Arabic name in parentheses where the English gives both, and do not translate them.

| English | Portuguese (Brazil) | Notes |
| --- | --- | --- |
| aarab / Aarab / harakat | sinais vocálicos | Urdu اعراب, Arabic حركات. Where the English says harakat for Arabic, write sinais vocálicos (harakat) once, then sinais vocálicos. |
| zabar (fatha) | zabar (fatha) | |
| zer (kasra) | zer (kasra) | |
| pesh (damma) | pesh (damma) | |
| shadd (shadda) | shadd (shadda) | |
| jazm (sukun) | jazm (sukun) | |
| tanween zabar / zer / pesh | tanwin zabar / zer / pesh | Portuguese spelling tanwin. |
| khari zabar | khari zabar | |
| Urdu / Arabic / Persian / Punjabi (Shahmukhi) | urdu / árabe / persa / punjabi (shahmukhi) | Lower case in a sentence; capital at the start of a label. Roman Urdu → urdu romanizado. |
| English (US) / English (UK) | inglês (Estados Unidos) / inglês (Reino Unido) | |
| Chinese (Simplified) | chinês (simplificado) | |
| Portuguese (Brazil) | português (Brasil) | |

## 6. Decisions

- 2026-11-27: Ribbon tab → guia (Office), document tab → guia too; guide lines → linha-guia so they never read as a tab.
- 2026-11-27: Sentence case everywhere, also for Word names that Word itself capitalizes (Área de transferência, Configurar página), except the tab name Página Inicial.
- 2026-11-27: Mode names: Word (kept), Em linha, Simples, Leitura (Word's Modo de Leitura). Inline equation → embutida, so it never clashes with the Em linha mode.
- 2026-11-27: Find → Localizar (Word), Search → Pesquisar, Delete → Excluir, Remove → Remover, Reset → Redefinir, Download → Baixar.
- 2026-11-27: add-in → suplemento, template → modelo, table of contents → sumário, outline → estrutura de tópicos, ribbon → faixa de opções (all Office).
- 2026-11-27: Font is Fonte, so bibliographic sources are referências and the Insert group Notes & sources is Notas e citações.
- 2026-11-27: Markooj's optional Features → recursos (Recursos opcionais); `Features@@markdown` → Recursos usados.
- 2026-11-27: interface language → idioma de exibição (Office); aarab → sinais vocálicos.
- 2026-11-27: Welcome → Boas-vindas (gender-neutral), never Bem-vindo.
- 2026-11-27: Keyboard shortcuts are never changed to Brazilian Word's (Ctrl+N, Ctrl+B); keep Markooj's own.
- 2026-11-28 (review): KeyTips → Dicas de tecla; ribbon tab → guia (never aba); match (Find) → ocorrência; word target → meta de palavras; sources (citation count) → referências.
- 2026-11-28 (review): keep (store a copy) → guardar (O Markooj guarda uma cópia…); salvar stays for Save. Browse… → Procurar… (Windows file picker); this is the only Procurar: Find stays Localizar.
- 2026-11-28 (review): Front matter → metadados (first mention may add “(front matter)”); Markdown source → texto Markdown; Paste as plain text → Colar sem formatação. Plain text as a short format or code-language label → Texto simples; in running text and the paste command → texto sem formatação.
- 2026-11-28 (review): mode names are lower case inside a sentence (use o modo simples, no modo Word, saia do modo de leitura); Modo is capitalized only at the start of a label.
- 2026-11-28 (review): Title Case → Formato de Título (the label shows the effect, like Colocar Cada Palavra em Maiúscula). Sentence case keeps Word's “Primeira letra da frase em maiúscula.”; inside a sentence, drop the period.
- 2026-11-28 (review): blackboard bold (math) → negrito de quadro-negro. Match case (Find bar toggle) → Maiúsculas/minúsculas, short beside Palavras inteiras.

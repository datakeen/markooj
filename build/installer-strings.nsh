; Markooj — the Windows installer's own text in the 11 interface languages (build/installer-lang.nsh loads one block).
; Saved as UTF-8 with a byte order mark. Translators: keep every line of a block (the check script compares them),
; never use straight double quotes or a dollar sign inside a text, and keep product and format names as they are.
; File → Options → Features must match the menu names of the same language in locales/<code>/*.json.
; The sizes come from build/features-sizes.nsh (MK_DL_* = download, MK_DISK_* = on disk, in MB).
;
; Keys: dlgTitle, dlgInfo  the first screen (the language list)
;       featTitle, featSub  the header of the "Choose extra features" page
;       core, coreDesc      Markooj itself (always installed)
;       pandoc, pandocDesc  djvu, djvuDesc  python, pythonDesc   one row per optional feature: name · size, then one line
;       footer              the note under the list

!macro mkStrings_en
  StrCpy $mkS_dlgTitle "Markooj Setup"
  StrCpy $mkS_dlgInfo "Choose a language for Setup and for Markooj. You can change it later in Markooj."
  StrCpy $mkS_featTitle "Choose extra features"
  StrCpy $mkS_featSub "Markooj works without these. Checked features download the first time Markooj starts."
  StrCpy $mkS_core "Markooj (always installed)"
  StrCpy $mkS_coreDesc "Writing in four modes; Word, PDF and EPUB; equations, diagrams and the Writing Assistant."
  StrCpy $mkS_pandoc "Pandoc  ·  ${MK_DL_PANDOC} MB download, ${MK_DISK_PANDOC} MB on disk"
  StrCpy $mkS_pandocDesc "Save as LaTeX, OpenDocument, Rich Text, PowerPoint, Typst and more, and open those files."
  StrCpy $mkS_djvu "DjVu tools  ·  ${MK_DL_DJVU} MB download, ${MK_DISK_DJVU} MB on disk"
  StrCpy $mkS_djvuDesc "Open DjVu files (scanned books and papers) and save documents as DjVu."
  StrCpy $mkS_python "Python macros  ·  ${MK_DL_PYTHON} MB download, ${MK_DISK_PYTHON} MB on disk"
  StrCpy $mkS_pythonDesc "Run macros written in Python on the Developer tab."
  StrCpy $mkS_footer "Add or remove features any time in File → Options → Features. No internet on this computer? The portable zip includes everything."
!macroend

!macro mkStrings_zh_CN
  StrCpy $mkS_dlgTitle "Markooj 安装程序"
  StrCpy $mkS_dlgInfo "请选择安装程序和 Markooj 使用的语言。以后可以在 Markooj 中更改。"
  StrCpy $mkS_featTitle "选择附加功能"
  StrCpy $mkS_featSub "不安装这些功能，Markooj 也能正常使用。勾选的功能会在首次启动 Markooj 时下载。"
  StrCpy $mkS_core "Markooj（始终安装）"
  StrCpy $mkS_coreDesc "四种写作模式；Word、PDF 和 EPUB；公式、图示和写作助手。"
  StrCpy $mkS_pandoc "Pandoc  ·  下载 ${MK_DL_PANDOC} MB，占用磁盘 ${MK_DISK_PANDOC} MB"
  StrCpy $mkS_pandocDesc "另存为 LaTeX、OpenDocument、RTF、PowerPoint、Typst 等格式，并可打开这些文件。"
  StrCpy $mkS_djvu "DjVu 工具  ·  下载 ${MK_DL_DJVU} MB，占用磁盘 ${MK_DISK_DJVU} MB"
  StrCpy $mkS_djvuDesc "打开 DjVu 文件（扫描的书籍和论文），并将文档另存为 DjVu。"
  StrCpy $mkS_python "Python 宏  ·  下载 ${MK_DL_PYTHON} MB，占用磁盘 ${MK_DISK_PYTHON} MB"
  StrCpy $mkS_pythonDesc "在“开发工具”选项卡上运行用 Python 编写的宏。"
  StrCpy $mkS_footer "随时可以在“文件 → 选项 → 功能”中添加或删除功能。这台电脑无法联网？便携版 zip 已包含全部功能。"
!macroend

!macro mkStrings_ur
  StrCpy $mkS_dlgTitle "Markooj سیٹ اپ"
  StrCpy $mkS_dlgInfo "سیٹ اپ اور Markooj کے لیے زبان منتخب کریں۔ آپ اسے بعد میں Markooj میں بدل سکتے ہیں۔"
  StrCpy $mkS_featTitle "اضافی خصوصیات منتخب کریں"
  StrCpy $mkS_featSub "Markooj ان کے بغیر بھی کام کرتا ہے۔ نشان زد خصوصیات Markooj کے پہلی بار کھلنے پر ڈاؤن لوڈ ہوں گی۔"
  StrCpy $mkS_core "Markooj (ہمیشہ انسٹال ہوتا ہے)"
  StrCpy $mkS_coreDesc "چار موڈز میں لکھائی؛ Word، PDF اور EPUB؛ مساوات، ڈایاگرام اور تحریری معاون۔"
  StrCpy $mkS_pandoc "Pandoc  ·  ڈاؤن لوڈ ${MK_DL_PANDOC} MB، ڈسک پر ${MK_DISK_PANDOC} MB"
  StrCpy $mkS_pandocDesc "LaTeX، OpenDocument، RTF، PowerPoint، Typst اور دیگر فارمیٹس میں محفوظ کریں، اور یہ فائلیں کھولیں۔"
  StrCpy $mkS_djvu "DjVu ٹولز  ·  ڈاؤن لوڈ ${MK_DL_DJVU} MB، ڈسک پر ${MK_DISK_DJVU} MB"
  StrCpy $mkS_djvuDesc "DjVu فائلیں (اسکین شدہ کتابیں اور مقالے) کھولیں اور دستاویزات کو DjVu کے طور پر محفوظ کریں۔"
  StrCpy $mkS_python "Python میکروز  ·  ڈاؤن لوڈ ${MK_DL_PYTHON} MB، ڈسک پر ${MK_DISK_PYTHON} MB"
  StrCpy $mkS_pythonDesc "ڈیولپر ٹیب پر Python میں لکھے گئے میکروز چلائیں۔"
  StrCpy $mkS_footer "خصوصیات کسی بھی وقت فائل ← اختیارات ← خصوصیات میں شامل کریں یا ہٹائیں۔ اس کمپیوٹر پر انٹرنیٹ نہیں؟ پورٹیبل zip میں سب کچھ شامل ہے۔"
!macroend

!macro mkStrings_ur_Latn
  StrCpy $mkS_dlgTitle "Markooj Setup"
  StrCpy $mkS_dlgInfo "Setup aur Markooj ke liye zaban chunein. Aap ise baad mein Markooj mein badal sakte hain."
  StrCpy $mkS_featTitle "Izafi features chunein"
  StrCpy $mkS_featSub "Markooj in ke baghair bhi kaam karta hai. Jin features par nishan hai, woh Markooj ke pehli baar khulne par download hongi."
  StrCpy $mkS_core "Markooj (hamesha install hota hai)"
  StrCpy $mkS_coreDesc "Chaar modes mein likhai; Word, PDF aur EPUB; equations, diagrams aur Writing Assistant."
  StrCpy $mkS_pandoc "Pandoc  ·  ${MK_DL_PANDOC} MB download, disk par ${MK_DISK_PANDOC} MB"
  StrCpy $mkS_pandocDesc "LaTeX, OpenDocument, Rich Text, PowerPoint, Typst waghera mein save karein, aur yeh files kholein."
  StrCpy $mkS_djvu "DjVu tools  ·  ${MK_DL_DJVU} MB download, disk par ${MK_DISK_DJVU} MB"
  StrCpy $mkS_djvuDesc "DjVu files (scan ki hui kitabein aur papers) kholein aur documents ko DjVu mein save karein."
  StrCpy $mkS_python "Python macros  ·  ${MK_DL_PYTHON} MB download, disk par ${MK_DISK_PYTHON} MB"
  StrCpy $mkS_pythonDesc "Developer tab par Python mein likhe gaye macros chalayein."
  StrCpy $mkS_footer "Features kisi bhi waqt File → Options → Features mein shamil karein ya hatayein. Is computer par internet nahin? Portable zip mein sab kuch shamil hai."
!macroend

!macro mkStrings_pnb
  StrCpy $mkS_dlgTitle "Markooj سیٹ اپ"
  StrCpy $mkS_dlgInfo "سیٹ اپ تے Markooj لئی بولی چُݨو۔ تُسیں ایہنوں بعد وچ Markooj وچ بدل سکدے او۔"
  StrCpy $mkS_featTitle "وادھو فیچر چُݨو"
  StrCpy $mkS_featSub "Markooj ایہناں توں بغیر وی کم کردا اے۔ جیہناں فیچراں تے نشان اے، اوہ Markooj دے پہلی واری کھلݨ تے ڈاؤن لوڈ ہوݨ گے۔"
  StrCpy $mkS_core "Markooj (ہمیشہ انسٹال ہوندا اے)"
  StrCpy $mkS_coreDesc "چار موڈاں وچ لکھائی؛ Word، PDF تے EPUB؛ مساواتاں، ڈایاگرام تے لکھائی مددگار۔"
  StrCpy $mkS_pandoc "Pandoc  ·  ڈاؤن لوڈ ${MK_DL_PANDOC} MB، ڈسک تے ${MK_DISK_PANDOC} MB"
  StrCpy $mkS_pandocDesc "LaTeX، OpenDocument، RTF، PowerPoint، Typst تے ہور فارمیٹاں وچ محفوظ کرو، تے ایہ فائلاں کھولو۔"
  StrCpy $mkS_djvu "DjVu ٹول  ·  ڈاؤن لوڈ ${MK_DL_DJVU} MB، ڈسک تے ${MK_DISK_DJVU} MB"
  StrCpy $mkS_djvuDesc "DjVu فائلاں (سکین کیتیاں کتاباں تے مقالے) کھولو تے دستاویزاں نوں DjVu وچ محفوظ کرو۔"
  StrCpy $mkS_python "Python میکرو  ·  ڈاؤن لوڈ ${MK_DL_PYTHON} MB، ڈسک تے ${MK_DISK_PYTHON} MB"
  StrCpy $mkS_pythonDesc "ڈیولپر ٹیب تے Python وچ لکھے ہوئے میکرو چلاؤ۔"
  StrCpy $mkS_footer "فیچر کسے ویلے وی فائل ← اختیارات ← فیچر وچ پاؤ یا ہٹاؤ۔ ایس کمپیوٹر تے انٹرنیٹ نہیں؟ پورٹیبل zip وچ سب کجھ شامل اے۔"
!macroend

!macro mkStrings_ja
  StrCpy $mkS_dlgTitle "Markooj セットアップ"
  StrCpy $mkS_dlgInfo "セットアップと Markooj で使う言語を選んでください。後から Markooj で変更できます。"
  StrCpy $mkS_featTitle "追加機能の選択"
  StrCpy $mkS_featSub "これらがなくても Markooj は使えます。チェックした機能は、Markooj の初回起動時にダウンロードされます。"
  StrCpy $mkS_core "Markooj (常にインストールされます)"
  StrCpy $mkS_coreDesc "4 つの編集モード、Word・PDF・EPUB、数式、図、ライティング アシスタント。"
  StrCpy $mkS_pandoc "Pandoc  ·  ダウンロード ${MK_DL_PANDOC} MB、ディスク使用量 ${MK_DISK_PANDOC} MB"
  StrCpy $mkS_pandocDesc "LaTeX、OpenDocument、リッチ テキスト、PowerPoint、Typst などの形式で保存し、それらのファイルを開けます。"
  StrCpy $mkS_djvu "DjVu ツール  ·  ダウンロード ${MK_DL_DJVU} MB、ディスク使用量 ${MK_DISK_DJVU} MB"
  StrCpy $mkS_djvuDesc "DjVu ファイル (スキャンした書籍や論文) を開き、文書を DjVu 形式で保存します。"
  StrCpy $mkS_python "Python マクロ  ·  ダウンロード ${MK_DL_PYTHON} MB、ディスク使用量 ${MK_DISK_PYTHON} MB"
  StrCpy $mkS_pythonDesc "[開発] タブで、Python で書かれたマクロを実行します。"
  StrCpy $mkS_footer "機能は [ファイル] → [オプション] → [機能] でいつでも追加または削除できます。インターネットに接続できない場合は、すべてを含むポータブル版 zip をお使いください。"
!macroend

!macro mkStrings_ar
  StrCpy $mkS_dlgTitle "إعداد Markooj"
  StrCpy $mkS_dlgInfo "اختر لغة برنامج الإعداد وMarkooj. يمكنك تغييرها لاحقاً من داخل Markooj."
  StrCpy $mkS_featTitle "اختيار ميزات إضافية"
  StrCpy $mkS_featSub "يعمل Markooj بدون هذه الميزات. يتم تنزيل الميزات المحددة عند تشغيل Markooj لأول مرة."
  StrCpy $mkS_core "Markooj (يُثبَّت دائماً)"
  StrCpy $mkS_coreDesc "الكتابة بأربعة أوضاع؛ وWord وPDF وEPUB؛ والمعادلات والمخططات ومساعد الكتابة."
  StrCpy $mkS_pandoc "Pandoc  ·  تنزيل ${MK_DL_PANDOC} ميغابايت، و${MK_DISK_PANDOC} ميغابايت على القرص"
  StrCpy $mkS_pandocDesc "الحفظ بتنسيق LaTeX وOpenDocument وRTF وPowerPoint وTypst وغيرها، وفتح هذه الملفات."
  StrCpy $mkS_djvu "أدوات DjVu  ·  تنزيل ${MK_DL_DJVU} ميغابايت، و${MK_DISK_DJVU} ميغابايت على القرص"
  StrCpy $mkS_djvuDesc "فتح ملفات DjVu (الكتب والأوراق الممسوحة ضوئياً) وحفظ المستندات بتنسيق DjVu."
  StrCpy $mkS_python "وحدات ماكرو Python  ·  تنزيل ${MK_DL_PYTHON} ميغابايت، و${MK_DISK_PYTHON} ميغابايت على القرص"
  StrCpy $mkS_pythonDesc "تشغيل وحدات الماكرو المكتوبة بلغة Python من علامة التبويب «المطور»."
  StrCpy $mkS_footer "يمكنك إضافة الميزات أو إزالتها في أي وقت من ملف ← خيارات ← الميزات. لا يوجد اتصال بالإنترنت على هذا الكمبيوتر؟ ملف zip المحمول يتضمن كل شيء."
!macroend

!macro mkStrings_sv
  StrCpy $mkS_dlgTitle "Installation av Markooj"
  StrCpy $mkS_dlgInfo "Välj språk för installationen och för Markooj. Du kan byta språk senare i Markooj."
  StrCpy $mkS_featTitle "Välj extra funktioner"
  StrCpy $mkS_featSub "Markooj fungerar utan dem. Markerade funktioner laddas ned första gången du startar Markooj."
  StrCpy $mkS_core "Markooj (installeras alltid)"
  StrCpy $mkS_coreDesc "Skriv i fyra lägen; Word, PDF och EPUB; ekvationer, diagram och Skrivassistenten."
  StrCpy $mkS_pandoc "Pandoc  ·  ${MK_DL_PANDOC} MB att ladda ned, ${MK_DISK_PANDOC} MB på disken"
  StrCpy $mkS_pandocDesc "Spara som LaTeX, OpenDocument, RTF, PowerPoint, Typst med mera, och öppna sådana filer."
  StrCpy $mkS_djvu "DjVu-verktyg  ·  ${MK_DL_DJVU} MB att ladda ned, ${MK_DISK_DJVU} MB på disken"
  StrCpy $mkS_djvuDesc "Öppna DjVu-filer (skannade böcker och artiklar) och spara dokument som DjVu."
  StrCpy $mkS_python "Python-makron  ·  ${MK_DL_PYTHON} MB att ladda ned, ${MK_DISK_PYTHON} MB på disken"
  StrCpy $mkS_pythonDesc "Kör makron som är skrivna i Python på fliken Utvecklare."
  StrCpy $mkS_footer "Lägg till eller ta bort funktioner när du vill under Arkiv → Alternativ → Funktioner. Ingen internetanslutning på datorn? Den portabla zip-filen innehåller allt."
!macroend

!macro mkStrings_es
  StrCpy $mkS_dlgTitle "Instalación de Markooj"
  StrCpy $mkS_dlgInfo "Elige el idioma del instalador y de Markooj. Puedes cambiarlo más adelante en Markooj."
  StrCpy $mkS_featTitle "Elegir funciones adicionales"
  StrCpy $mkS_featSub "Markooj funciona sin ellas. Las funciones marcadas se descargan la primera vez que se inicia Markooj."
  StrCpy $mkS_core "Markooj (se instala siempre)"
  StrCpy $mkS_coreDesc "Escritura en cuatro modos; Word, PDF y EPUB; ecuaciones, diagramas y el Asistente de escritura."
  StrCpy $mkS_pandoc "Pandoc  ·  ${MK_DL_PANDOC} MB de descarga, ${MK_DISK_PANDOC} MB en disco"
  StrCpy $mkS_pandocDesc "Guarda como LaTeX, OpenDocument, RTF, PowerPoint, Typst y más, y abre esos archivos."
  StrCpy $mkS_djvu "Herramientas DjVu  ·  ${MK_DL_DJVU} MB de descarga, ${MK_DISK_DJVU} MB en disco"
  StrCpy $mkS_djvuDesc "Abre archivos DjVu (libros y artículos escaneados) y guarda documentos como DjVu."
  StrCpy $mkS_python "Macros de Python  ·  ${MK_DL_PYTHON} MB de descarga, ${MK_DISK_PYTHON} MB en disco"
  StrCpy $mkS_pythonDesc "Ejecuta macros escritas en Python desde la pestaña Programador."
  StrCpy $mkS_footer "Agrega o quita funciones cuando quieras en Archivo → Opciones → Funciones. ¿Este equipo no tiene internet? El zip portátil lo incluye todo."
!macroend

!macro mkStrings_fr
  StrCpy $mkS_dlgTitle "Installation de Markooj"
  StrCpy $mkS_dlgInfo "Choisissez la langue du programme d’installation et de Markooj. Vous pourrez la changer plus tard dans Markooj."
  StrCpy $mkS_featTitle "Choisir des fonctionnalités supplémentaires"
  StrCpy $mkS_featSub "Markooj fonctionne sans elles. Les fonctionnalités cochées sont téléchargées au premier démarrage de Markooj."
  StrCpy $mkS_core "Markooj (toujours installé)"
  StrCpy $mkS_coreDesc "Rédaction en quatre modes ; Word, PDF et EPUB ; équations, diagrammes et Assistant d’écriture."
  StrCpy $mkS_pandoc "Pandoc  ·  ${MK_DL_PANDOC} Mo à télécharger, ${MK_DISK_PANDOC} Mo sur le disque"
  StrCpy $mkS_pandocDesc "Enregistrer au format LaTeX, OpenDocument, RTF, PowerPoint, Typst et plus encore, et ouvrir ces fichiers."
  StrCpy $mkS_djvu "Outils DjVu  ·  ${MK_DL_DJVU} Mo à télécharger, ${MK_DISK_DJVU} Mo sur le disque"
  StrCpy $mkS_djvuDesc "Ouvrir des fichiers DjVu (livres et articles numérisés) et enregistrer des documents au format DjVu."
  StrCpy $mkS_python "Macros Python  ·  ${MK_DL_PYTHON} Mo à télécharger, ${MK_DISK_PYTHON} Mo sur le disque"
  StrCpy $mkS_pythonDesc "Exécuter des macros écrites en Python depuis l’onglet Développeur."
  StrCpy $mkS_footer "Ajoutez ou supprimez des fonctionnalités à tout moment dans Fichier → Options → Fonctionnalités. Pas d’Internet sur cet ordinateur ? Le zip portable contient tout."
!macroend

!macro mkStrings_pt_BR
  StrCpy $mkS_dlgTitle "Instalação do Markooj"
  StrCpy $mkS_dlgInfo "Escolha o idioma do instalador e do Markooj. Você pode alterá-lo depois no Markooj."
  StrCpy $mkS_featTitle "Escolher recursos adicionais"
  StrCpy $mkS_featSub "O Markooj funciona sem eles. Os recursos marcados são baixados na primeira vez que o Markooj for iniciado."
  StrCpy $mkS_core "Markooj (sempre instalado)"
  StrCpy $mkS_coreDesc "Escrita em quatro modos; Word, PDF e EPUB; equações, diagramas e o Assistente de Escrita."
  StrCpy $mkS_pandoc "Pandoc  ·  ${MK_DL_PANDOC} MB para baixar, ${MK_DISK_PANDOC} MB em disco"
  StrCpy $mkS_pandocDesc "Salve como LaTeX, OpenDocument, RTF, PowerPoint, Typst e outros, e abra esses arquivos."
  StrCpy $mkS_djvu "Ferramentas DjVu  ·  ${MK_DL_DJVU} MB para baixar, ${MK_DISK_DJVU} MB em disco"
  StrCpy $mkS_djvuDesc "Abra arquivos DjVu (livros e artigos digitalizados) e salve documentos como DjVu."
  StrCpy $mkS_python "Macros em Python  ·  ${MK_DL_PYTHON} MB para baixar, ${MK_DISK_PYTHON} MB em disco"
  StrCpy $mkS_pythonDesc "Execute macros escritas em Python na guia Desenvolvedor."
  StrCpy $mkS_footer "Adicione ou remova recursos quando quiser em Arquivo → Opções → Recursos. Sem internet neste computador? O zip portátil inclui tudo."
!macroend

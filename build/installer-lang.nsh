; Markooj — the installer's language: codes, the first screen, and which NSIS language and text each code uses.
; build/installer.nsh includes this file; build/installer-lang-test.js compiles it into a small silent test program.
; Saved as UTF-8 with a byte order mark.
;
; One code everywhere: the 11 interface languages of locales/languages.json
;   en  zh-CN  ur  ur-Latn  pnb  ja  ar  sv  es  fr  pt-BR
; The code picks two things:
;   1. the text of Markooj's own installer screens (build/installer-strings.nsh: all 11 languages), and
;   2. NSIS's language for its standard pages and buttons (package.json build.nsis.installerLanguages). NSIS has
;      no Urdu or Punjabi, so ur, ur-Latn and pnb show NSIS's standard pages in English.
; The same code goes to first-run.json, where Markooj takes it as its interface language (setting uiLanguage).

; ---- sizes for the features page: "41 MB download, 230 MB on disk" (build/features-sizes.nsh) → numbers ----------
!ifndef MK_SIZE_PANDOC
  !define MK_SIZE_PANDOC "41 MB download, 230 MB on disk"
!endif
!ifndef MK_SIZE_DJVU
  !define MK_SIZE_DJVU "15 MB download, 37 MB on disk"
!endif
!ifndef MK_SIZE_PYTHON
  !define MK_SIZE_PYTHON "6 MB download, 13 MB on disk"
!endif
!searchparse /noerrors "${MK_SIZE_PANDOC}" "" MK_DL_PANDOC " MB download, " MK_DISK_PANDOC " MB on disk"
!searchparse /noerrors "${MK_SIZE_DJVU}" "" MK_DL_DJVU " MB download, " MK_DISK_DJVU " MB on disk"
!searchparse /noerrors "${MK_SIZE_PYTHON}" "" MK_DL_PYTHON " MB download, " MK_DISK_PYTHON " MB on disk"
!define /ifndef MK_DL_PANDOC "41"
!define /ifndef MK_DISK_PANDOC "230"
!define /ifndef MK_DL_DJVU "15"
!define /ifndef MK_DISK_DJVU "37"
!define /ifndef MK_DL_PYTHON "6"
!define /ifndef MK_DISK_PYTHON "13"

!include "installer-strings.nsh"

; ---- variables (insert once, installer only: the uninstaller would warn about unused variables) -----------------
!macro mkLangVars
  Var mkLangCode
  Var mkS_dlgTitle
  Var mkS_dlgInfo
  Var mkS_featTitle
  Var mkS_featSub
  Var mkS_core
  Var mkS_coreDesc
  Var mkS_pandoc
  Var mkS_pandocDesc
  Var mkS_djvu
  Var mkS_djvuDesc
  Var mkS_python
  Var mkS_pythonDesc
  Var mkS_footer
!macroend

; ---- functions --------------------------------------------------------------------------------------------------
!macro mkLangFunctions
  ; Push "<any spelling>" / Call mkNormCode / Pop $x → one of the 11 codes, or "" when unknown.
  ; Any case, "_" or "-", and the usual aliases (zh, zh-Hans, pt, pa-Arab, ur-Roman …).
  Function mkNormCode
    Exch $0
    ${Select} $0
      ${Case} "en"
        StrCpy $0 "en"
      ${Case4} "en-US" "en_US" "en-GB" "en_GB"
        StrCpy $0 "en"
      ${Case5} "zh-CN" "zh_CN" "zh" "zh-Hans" "zh_Hans"
        StrCpy $0 "zh-CN"
      ${Case3} "ur" "ur-PK" "ur_PK"
        StrCpy $0 "ur"
      ${Case5} "ur-Latn" "ur_Latn" "ur-Roman" "ur_Roman" "roman-urdu"
        StrCpy $0 "ur-Latn"
      ${Case5} "pnb" "pa-Arab" "pa_Arab" "pa-PK" "pa_PK"
        StrCpy $0 "pnb"
      ${Case3} "ja" "ja-JP" "ja_JP"
        StrCpy $0 "ja"
      ${Case3} "ar" "ar-SA" "ar_SA"
        StrCpy $0 "ar"
      ${Case3} "sv" "sv-SE" "sv_SE"
        StrCpy $0 "sv"
      ${Case3} "es" "es-ES" "es_ES"
        StrCpy $0 "es"
      ${Case3} "fr" "fr-FR" "fr_FR"
        StrCpy $0 "fr"
      ${Case4} "pt-BR" "pt_BR" "pt" "pt-PT"
        StrCpy $0 "pt-BR"
      ${CaseElse}
        StrCpy $0 ""
    ${EndSelect}
    Exch $0
  FunctionEnd

  ; Push <Windows LANGID> / Call mkGuessCode / Pop $x → the code for that display language ("en" when none fits)
  Function mkGuessCode
    Exch $0
    Push $1
    IntOp $1 $0 & 0x3FF
    ${If} $1 = 0x04
      ; Chinese: Taiwan, Hong Kong and Macao read Traditional Chinese, which Markooj does not have yet
      ${If} $0 = 0x0404
      ${OrIf} $0 = 0x0C04
      ${OrIf} $0 = 0x1404
        StrCpy $0 "en"
      ${Else}
        StrCpy $0 "zh-CN"
      ${EndIf}
    ${ElseIf} $1 = 0x20
      StrCpy $0 "ur"
    ${ElseIf} $0 = 0x0846
      StrCpy $0 "pnb"
    ${ElseIf} $1 = 0x11
      StrCpy $0 "ja"
    ${ElseIf} $1 = 0x01
      StrCpy $0 "ar"
    ${ElseIf} $1 = 0x1D
      StrCpy $0 "sv"
    ${ElseIf} $1 = 0x0A
      StrCpy $0 "es"
    ${ElseIf} $1 = 0x0C
      StrCpy $0 "fr"
    ${ElseIf} $1 = 0x16
      StrCpy $0 "pt-BR"
    ${Else}
      StrCpy $0 "en"
    ${EndIf}
    Pop $1
    Exch $0
  FunctionEnd

  ; $mkLangCode → the $mkS_* texts
  Function mkLoadStrings
    ${Select} $mkLangCode
      ${Case} "zh-CN"
        !insertmacro mkStrings_zh_CN
      ${Case} "ur"
        !insertmacro mkStrings_ur
      ${Case} "ur-Latn"
        !insertmacro mkStrings_ur_Latn
      ${Case} "pnb"
        !insertmacro mkStrings_pnb
      ${Case} "ja"
        !insertmacro mkStrings_ja
      ${Case} "ar"
        !insertmacro mkStrings_ar
      ${Case} "sv"
        !insertmacro mkStrings_sv
      ${Case} "es"
        !insertmacro mkStrings_es
      ${Case} "fr"
        !insertmacro mkStrings_fr
      ${Case} "pt-BR"
        !insertmacro mkStrings_pt_BR
      ${CaseElse}
        StrCpy $mkLangCode "en"
        !insertmacro mkStrings_en
    ${EndSelect}
  FunctionEnd

  ; $mkLangCode written right to left? → $0 = 1 or 0
  Function mkIsRtlCode
    ${If} $mkLangCode == "ur"
    ${OrIf} $mkLangCode == "pnb"
    ${OrIf} $mkLangCode == "ar"
      StrCpy $0 1
    ${Else}
      StrCpy $0 0
    ${EndIf}
  FunctionEnd
!macroend

; ---- the line of first-run.json: OUT = {"language":"<code>","features":[FEATURES],...} (FEATURES: '"pandoc","djvu"')
!macro mkFirstRunJson OUT FEATURES
  StrCpy ${OUT} '{"language":"$mkLangCode","features":[${FEATURES}],"from":"installer","version":"${VERSION}"}'
!macroend

; ---- $mkLangCode → $LANGUAGE (NSIS's standard pages). Insert after the MUI_LANGUAGE lines (inside .onInit): -------
; a language left out of build.nsis.installerLanguages falls back to English instead of failing.
!macro mkSetNsisLanguage
  !ifdef LANG_ENGLISH
    StrCpy $LANGUAGE ${LANG_ENGLISH}
  !endif
  ${Select} $mkLangCode
    !ifdef LANG_SIMPCHINESE
      ${Case} "zh-CN"
        StrCpy $LANGUAGE ${LANG_SIMPCHINESE}
    !endif
    !ifdef LANG_JAPANESE
      ${Case} "ja"
        StrCpy $LANGUAGE ${LANG_JAPANESE}
    !endif
    !ifdef LANG_ARABIC
      ${Case} "ar"
        StrCpy $LANGUAGE ${LANG_ARABIC}
    !endif
    !ifdef LANG_SWEDISH
      ${Case} "sv"
        StrCpy $LANGUAGE ${LANG_SWEDISH}
    !endif
    !ifdef LANG_SPANISHINTERNATIONAL
      ${Case} "es"
        StrCpy $LANGUAGE ${LANG_SPANISHINTERNATIONAL}
    !else ifdef LANG_SPANISH
      ${Case} "es"
        StrCpy $LANGUAGE ${LANG_SPANISH}
    !endif
    !ifdef LANG_FRENCH
      ${Case} "fr"
        StrCpy $LANGUAGE ${LANG_FRENCH}
    !endif
    !ifdef LANG_PORTUGUESEBR
      ${Case} "pt-BR"
        StrCpy $LANGUAGE ${LANG_PORTUGUESEBR}
    !endif
  ${EndSelect}
!macroend

; ---- the first screen: one list of all 11 languages, each in its own script (LangDLL, the dialog NSIS uses for
; "Installer Language"). It opens on $mkLangCode and sets $mkLangCode; Cancel closes the installer. --------------
!macro mkLanguageDialog
  Push $0
  ; LangDLL preselects the entry whose value equals $LANGUAGE, so $LANGUAGE holds the code for a moment;
  ; mkSetNsisLanguage gives it its real value right after.
  StrCpy $LANGUAGE $mkLangCode
  LangDLL::LangDialog "$mkS_dlgTitle" "$mkS_dlgInfo" A \
    "English" "en" \
    "简体中文" "zh-CN" \
    "اردو" "ur" \
    "Roman Urdu" "ur-Latn" \
    "پنجابی" "pnb" \
    "日本語" "ja" \
    "العربية" "ar" \
    "Svenska" "sv" \
    "Español" "es" \
    "Français" "fr" \
    "Português (Brasil)" "pt-BR" \
    ""
  Pop $0
  ${If} $0 == "cancel"
    Abort
  ${EndIf}
  Push $0
  Call mkNormCode
  Pop $0
  ${If} $0 != ""
    StrCpy $mkLangCode $0
  ${EndIf}
  Pop $0
!macroend

; Markooj — Windows installer additions (electron-builder includes this file: package.json build.nsis.include).
; Saved as UTF-8 with a byte order mark, so NSIS reads the language names correctly.
;
;   1. First screen, before the wizard opens: "choose your language", one list of the 11 interface languages, each
;      in its own script, opening on the Windows display language (build/installer-lang.nsh). The choice sets both
;      the installer's language and Markooj's interface language.
;        - The installer's own screens (this file) speak all 11 languages (build/installer-strings.nsh).
;        - NSIS's standard pages and buttons follow it in English, Chinese, Japanese, Arabic, Swedish, Spanish,
;          French and Portuguese (build.nsis.installerLanguages). NSIS has no Urdu or Punjabi: for ur, ur-Latn and
;          pnb those standard pages are in English, while the features page is in the chosen language (right to left
;          for Urdu and Punjabi).
;   2. "Choose extra features" (after the folder page): Pandoc, DjVu tools and Python macros, each with its size
;      and one line on what it enables; Markooj itself is always installed.
; The choices go to $INSTDIR\resources\first-run.json:  {"language":"ur","features":["pandoc"],"from":"installer"}
; Markooj reads it once on its first start (main-features.js and src/features.js): it downloads the chosen features in
; the background (with a progress card the user can cancel) and keeps the language as the setting `uiLanguage`.
; Silent installs (/S) take /LANGUAGE=<code> and /FEATURES=pandoc,djvu,python; without them: the Windows display
; language and no extra features. /LANGUAGE= also skips the language screen of a normal install.
; An update (--updated) shows neither screen and writes no first-run.json.
; A full uninstall also removes the downloaded features (%APPDATA%\Markooj\features); updates and reinstalls keep them.

!include nsDialogs.nsh
!include LogicLib.nsh
!include WinMessages.nsh
; exact sizes of this release, written by: node scripts/make-features.js --nsh (optional: build/installer-lang.nsh
; has defaults; electron-builder treats warnings as errors, so the "file not found" warning of /NONFATAL is off here)
!pragma warning push
!pragma warning disable 7000
!include /NONFATAL "features-sizes.nsh"
!pragma warning pop

!include "installer-lang.nsh"

; ---------------------------------------------------------------------------------------------------------------------
; Variables and shared functions. electron-builder inserts this macro after MUI2 is loaded and only into the
; installer (never into the uninstaller). The language screen is not a wizard page: it runs in customInit, before
; the wizard window exists, so NSIS can still switch the language of every page.
; ---------------------------------------------------------------------------------------------------------------------
!macro customWelcomePage
  !insertmacro mkLangVars
  Var mkWantPandoc
  Var mkWantDjvu
  Var mkWantPython
  Var mkFeatDlg
  Var mkCbPandoc
  Var mkCbDjvu
  Var mkCbPython
  Var mkBold

  !insertmacro mkLangFunctions

  ; does $R8 (",a,b,") contain $R7 (",a,")? → $R6 = 1 or 0
  Function mkListHas
    StrCpy $R6 0
    StrLen $R5 $R7
    StrLen $R4 $R8
    StrCpy $R3 0
    ${DoWhile} $R3 < $R4
      StrCpy $R2 $R8 $R5 $R3
      ${If} $R2 == $R7
        StrCpy $R6 1
        ${Break}
      ${EndIf}
      IntOp $R3 $R3 + 1
    ${Loop}
  FunctionEnd

  ; an update started with --updated shows no pages
  Function mkSkipIfUpdated
    ClearErrors
    ${GetParameters} $R0
    ${GetOptions} $R0 "--updated" $R1
    ${IfNot} ${Errors}
      Abort
    ${EndIf}
  FunctionEnd
!macroend

; ---------------------------------------------------------------------------------------------------------------------
; Defaults, the language screen, and the silent-install options
; ---------------------------------------------------------------------------------------------------------------------
!macro customInit
  StrCpy $mkWantPandoc "1"
  StrCpy $mkWantDjvu "0"
  StrCpy $mkWantPython "0"
  ; GetUserDefaultUILanguage: the language Windows shows its own menus in
  System::Call 'kernel32::GetUserDefaultUILanguage() i .r0'
  Push $0
  Call mkGuessCode
  Pop $mkLangCode
  ; /LANGUAGE=ur and /FEATURES=pandoc,python (silent installs and deployment tools)
  StrCpy $R5 "0"
  ${GetParameters} $R9
  ClearErrors
  ${GetOptions} $R9 "/LANGUAGE=" $R0
  ${IfNot} ${Errors}
    Push $R0
    Call mkNormCode
    Pop $R0
    ${If} $R0 != ""
      StrCpy $mkLangCode $R0
      StrCpy $R5 "1"
    ${EndIf}
  ${EndIf}
  ClearErrors
  ${GetOptions} $R9 "/FEATURES=" $R8
  ${IfNot} ${Errors}
    StrCpy $R8 ",$R8,"
    StrCpy $R7 ",pandoc,"
    Call mkListHas
    StrCpy $mkWantPandoc $R6
    StrCpy $R7 ",djvu,"
    Call mkListHas
    StrCpy $mkWantDjvu $R6
    StrCpy $R7 ",python,"
    Call mkListHas
    StrCpy $mkWantPython $R6
  ${ElseIf} ${Silent}
    StrCpy $mkWantPandoc "0"
  ${EndIf}
  ; The language screen: not for silent installs, updates, a given /LANGUAGE=, or the elevated copy of the installer
  ; (installing for all users restarts it as administrator: it takes the language the user already chose).
  ${If} ${UAC_IsInnerInstance}
    !insertmacro UAC_AsUser_GetGlobalVar $mkLangCode
    Push $mkLangCode
    Call mkNormCode
    Pop $mkLangCode
    ${If} $mkLangCode == ""
      StrCpy $mkLangCode "en"
    ${EndIf}
  ${ElseIfNot} ${Silent}
  ${AndIf} $R5 == "0"
    ClearErrors
    ${GetOptions} $R9 "--updated" $R1
    ${If} ${Errors}
      Call mkLoadStrings
      !insertmacro mkLanguageDialog
    ${EndIf}
  ${EndIf}
  !insertmacro mkSetNsisLanguage
  Call mkLoadStrings
!macroend

; ---------------------------------------------------------------------------------------------------------------------
; Extra features (after the folder page)
; ---------------------------------------------------------------------------------------------------------------------
!macro customPageAfterChangeDir
  Page custom mkFeatPage mkFeatLeave

  ; one row: $R0 = top of the checkbox, $R7 = top of its line (dialog units, "39u"), $R1 = title, $R2 = one line
  ; on what it enables, $R3 = checked (1/0), $R4 = can change (1/0) → $R5 = the checkbox
  Function mkFeatRow
    ${NSD_CreateCheckbox} 0 $R0 100% 10u "$R1"
    Pop $R5
    SendMessage $R5 ${WM_SETFONT} $mkBold 0
    ${If} $R3 == "1"
      ${NSD_Check} $R5
    ${EndIf}
    ${If} $R4 == "0"
      EnableWindow $R5 0
    ${EndIf}
    ${NSD_CreateLabel} 12u $R7 -12u 17u "$R2"
    Pop $R6
    SetCtlColors $R6 666666 transparent
  FunctionEnd

  Function mkFeatPage
    Call mkSkipIfUpdated
    !insertmacro MUI_HEADER_TEXT "$mkS_featTitle" "$mkS_featSub"
    nsDialogs::Create 1018
    Pop $mkFeatDlg
    ${If} $mkFeatDlg == error
      Abort
    ${EndIf}
    ; Urdu, Punjabi and Arabic: the page reads right to left (nsDialogs mirrors the rows and right-aligns the text),
    ; also when NSIS itself shows English around it
    Call mkIsRtlCode
    ${If} $(^RTL) == 1
      StrCpy $0 1
    ${EndIf}
    nsDialogs::SetRTL $0
    CreateFont $mkBold "$(^Font)" "$(^FontSize)" "700"

    StrCpy $R0 "0u"
    StrCpy $R7 "10u"
    StrCpy $R1 "$mkS_core"
    StrCpy $R2 "$mkS_coreDesc"
    StrCpy $R3 1
    StrCpy $R4 0
    Call mkFeatRow

    StrCpy $R0 "29u"
    StrCpy $R7 "39u"
    StrCpy $R1 "$mkS_pandoc"
    StrCpy $R2 "$mkS_pandocDesc"
    StrCpy $R3 $mkWantPandoc
    StrCpy $R4 1
    Call mkFeatRow
    StrCpy $mkCbPandoc $R5

    StrCpy $R0 "58u"
    StrCpy $R7 "68u"
    StrCpy $R1 "$mkS_djvu"
    StrCpy $R2 "$mkS_djvuDesc"
    StrCpy $R3 $mkWantDjvu
    Call mkFeatRow
    StrCpy $mkCbDjvu $R5

    StrCpy $R0 "87u"
    StrCpy $R7 "97u"
    StrCpy $R1 "$mkS_python"
    StrCpy $R2 "$mkS_pythonDesc"
    StrCpy $R3 $mkWantPython
    Call mkFeatRow
    StrCpy $mkCbPython $R5

    ${NSD_CreateLabel} 0 117u 100% 23u "$mkS_footer"
    Pop $0
    SetCtlColors $0 666666 transparent
    nsDialogs::Show
  FunctionEnd

  Function mkFeatLeave
    ${NSD_GetState} $mkCbPandoc $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $mkWantPandoc "1"
    ${Else}
      StrCpy $mkWantPandoc "0"
    ${EndIf}
    ${NSD_GetState} $mkCbDjvu $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $mkWantDjvu "1"
    ${Else}
      StrCpy $mkWantDjvu "0"
    ${EndIf}
    ${NSD_GetState} $mkCbPython $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $mkWantPython "1"
    ${Else}
      StrCpy $mkWantPython "0"
    ${EndIf}
  FunctionEnd
!macroend

; ---------------------------------------------------------------------------------------------------------------------
; After the files are in place: write the choices for Markooj's first start
; ---------------------------------------------------------------------------------------------------------------------
!macro customInstall
  ; an update (--updated) asked nothing, so it writes nothing: Markooj must not start downloads nobody chose
  ClearErrors
  ${GetParameters} $R1
  ${GetOptions} $R1 "--updated" $R2
  ${IfNot} ${Errors}
    Goto mkFirstRunDone
  ${EndIf}
  StrCpy $R0 ""
  ${If} $mkWantPandoc == "1"
    StrCpy $R0 '"pandoc"'
  ${EndIf}
  ${If} $mkWantDjvu == "1"
    ${If} $R0 != ""
      StrCpy $R0 "$R0,"
    ${EndIf}
    StrCpy $R0 '$R0"djvu"'
  ${EndIf}
  ${If} $mkWantPython == "1"
    ${If} $R0 != ""
      StrCpy $R0 "$R0,"
    ${EndIf}
    StrCpy $R0 '$R0"python"'
  ${EndIf}
  ClearErrors
  FileOpen $R9 "$INSTDIR\resources\first-run.json" w
  ${IfNot} ${Errors}
    !insertmacro mkFirstRunJson $R8 $R0
    FileWrite $R9 '$R8$\r$\n'
    FileClose $R9
  ${EndIf}
  mkFirstRunDone:
!macroend

; ---------------------------------------------------------------------------------------------------------------------
; A full uninstall removes the downloaded features; updates and reinstalls (/KEEP_APP_DATA or --updated) keep them
; ---------------------------------------------------------------------------------------------------------------------
!macro customUnInstall
  ClearErrors
  ${GetParameters} $R0
  ${GetOptions} $R0 "/KEEP_APP_DATA" $R1
  ${If} ${Errors}
    ClearErrors
    ${GetOptions} $R0 "--updated" $R1
    ${If} ${Errors}
      ${If} $installMode == "all"
        SetShellVarContext current
      ${EndIf}
      RMDir /r "$APPDATA\${PRODUCT_NAME}\features"
      ${If} $installMode == "all"
        SetShellVarContext all
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

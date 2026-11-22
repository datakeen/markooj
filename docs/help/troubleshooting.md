# Problems and answers

**Markooj says Pandoc (or another bundled tool) is missing.**
Markooj brings Pandoc, pdf2djvu and DjVuLibre with it, and checks them when it starts. If one is missing, a message says what still works and what does not; writing, saving Markdown, PDF, web page, printing, and Word and EPUB files from the built-in writers always work. To get the tools back:

- If you installed Markooj, run the installer (`Markooj-…-setup.exe`) again.
- If you use the portable zip, unzip the **whole** zip again into a new, empty folder and run `Markooj.exe` from there. Do not copy `Markooj.exe` on its own: the tools sit in the `resources` folder beside it.
- Some antivirus programs move `pandoc.exe` into quarantine. Restore it there, or allow it.

To check at any time, press **Alt+Q** and pick **Check Bundled Tools**. It shows each tool, its version and where it was found.

**Windows says "Windows protected your PC".**
Markooj is not code-signed yet. Click **More info**, then **Run anyway**. You only need to do this once.

**macOS says Markooj cannot be opened, or cannot be checked.**
Markooj is not signed with an Apple certificate yet. Right-click Markooj in Applications and choose **Open**, then **Open** again. Or open **System Settings → Privacy & Security** and click **Open Anyway**. You only need to do this once.

**DjVu formats are missing on macOS or Linux.**
The Mac and Linux copies include Pandoc but not the DjVu tools. Install them with `brew install djvulibre pdf2djvu` (macOS, with Homebrew) or `sudo apt install djvulibre-bin pdf2djvu` (Debian and Ubuntu), then start Markooj again.

**A Save As format is grayed out.**
It needs a bundled tool that this copy cannot find. See the first answer.

**My Word file looks different after opening it.**
Markooj turns Word files into Markdown, and Markdown keeps the content and structure, not every detail of the layout: there are no text boxes, page headers or tracked changes. Your Word file itself is never changed. See [Markdown for Word users](markdown-for-word-users.md).

**I pressed Ctrl+S and Markooj asked for a file name, but the file was already saved.**
The file was opened from another format (Word, PDF, HTML …). Markooj saves your work as a new Markdown file, so the original is never overwritten.

**Markooj says the file changed on disk.**
Another program changed the file after you opened it. Choose **Overwrite** to keep your version, **Save as Copy** to keep both, or **Cancel** to look first. **Review → Compare** shows the differences.

**Pictures from the web do not show.**
That is on purpose: loading them would tell their server that you opened the document. Turn on **File → Options → Privacy → Load pictures from the web in documents** if you want them.

**Pictures disappeared after I moved my document.**
Pictures are kept in the `assets` folder next to the document. Move or copy that folder with it.

**An equation shows in red.**
The LaTeX has a mistake. Double-click the equation to open the editor, which shows what is wrong. If it uses your own commands, check them in **Developer → Math macros**.

**A cross-reference shows in red.**
What it points to is gone, or its label changed. Rest the pointer on it for a suggestion, or open **References → Cross-ref** and insert it again.

**Urdu or Arabic text runs the wrong way.**
Click in the paragraph and click **Home → Right-to-left text direction**. For a whole document, set its language on the status bar. See [Languages and right-to-left text](languages-and-rtl.md).

**Words in Urdu, Arabic, Persian or Punjabi are not spell-checked.**
Spelling for these languages comes with a language pack; install it in File → Options → Language. The Urdu, Arabic and Punjabi word lists are still small, so Markooj underlines only words that look like a typo of a known word. A misspelled word that is not close to any known word is not underlined yet. See [Spelling while the word lists grow](languages-and-rtl.md#spelling-while-the-word-lists-grow).

**Check for language packs says Markooj could not reach GitHub.**
Packs are downloaded from the Markooj language packs page on GitHub. Check your internet connection, or download the pack's `.zip` on another computer and use **Install from file…**.

**A Python macro is slow the first time.**
Python starts the first time you use it in a session, which takes a few seconds. Turn on **File → Options → Developer → Start Python in the background** to have it ready.

**`import numpy` fails in a Python macro.**
Python in Markooj has the standard library only. Extra packages cannot be installed.

**An add-in does not load.**
Open **File → Add-ins**. The add-in's card shows the error. An add-in from a file must be a `.js` file in the add-ins folder; click **Reload add-ins** after changing it. An add-in from the store may need a newer Markooj: its details page says which version.

**An add-in from the store does not install.**
Browse and Install need an internet connection to GitHub. If Markooj says a file did not match its checksum, nothing was installed; try again later, because the author may be publishing a new version at that moment. If it keeps failing, please [report it](https://github.com/datakeen/markooj-addins/issues).

**Where are my settings?**
In `%APPDATA%\Markooj` for an installed copy, or in the `data` folder next to `Markooj.exe` for a portable copy. See [Options](options.md).

**I lost text I had not saved.**
Look in **File → Recover**. See [Recover unsaved work](recover.md).

**Something else?**
Please [open an issue on GitHub](https://github.com/datakeen/markooj/issues) with the steps that lead to the problem, a screenshot, and the version number from About Markooj.

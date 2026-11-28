# Problems and answers

**Markooj asks for Pandoc, the DjVu tools or Python.**
These are optional features: Markooj installs small and downloads them only when you want them. Markooj tells you when something you use needs one. Try these in order:

1. Click **Install** in the message, or open **File → Options → Features** and click **Install** next to the feature. It downloads once (Pandoc about 40 MB, the DjVu tools about 15 MB, Python macros about 6 MB), is checked, and then works offline.
2. No internet on this computer? On the [download page](https://github.com/datakeen/markooj/releases/tag/tools), download the feature file for your system (`markooj-feature-…zip`) on another computer, copy it over, and choose **Install from file…** in **File → Options → Features**. Or use the Windows portable zip, which includes every feature.
3. Click **Check again** in the message. A tool that was busy or blocked for a moment is often found the second time.
4. If you use the portable zip, unzip the **whole** zip again into a new, empty folder and run `Markooj.exe` from there. The features sit in the `resources` folder beside it, so `Markooj.exe` on its own is not enough.
5. Some antivirus programs move `pandoc.exe` or `ddjvu.exe` into quarantine. Restore it there, or allow it.
6. If the tool is there and Markooj still cannot use it, click **Report this** (or **Help → Report a Problem**). Open **Technical details** in the message and copy them into the report.

**A feature does not download.**
Check your internet connection and click **Try again**. If GitHub cannot be reached from your network, download the feature file yourself (step 2 above) and choose **Install from file…**. Markooj checks every download against the SHA-256 checksum it shipped with: a damaged or changed file is never installed, and nothing changes until a download passes every check. **Cancel** in the progress card stops a download and keeps nothing. To free the space again, click **Remove** next to the feature.

Everything else keeps working while you sort it out: writing, saving Markdown, PDF, web pages, printing, and Word and EPUB files from the built-in writers. **Help → Check Tools** opens **Your tools are ready** or **Almost everything is ready**: each tool, what it is for, its version and where it was found, and either **Ready** or its fix. Markooj never warns about DjVu tools when it starts; it helps when you open a DjVu file or pick DjVu in Save As.

**Windows says "Windows protected your PC".**
Click **More info**, then **Run anyway**. You only need to do this once. Windows asks because Markooj is not code-signed yet.

**macOS says Markooj cannot be opened, or cannot be checked.**
Right-click Markooj in Applications and choose **Open**, then **Open** again. Or open **System Settings → Privacy & Security** and click **Open Anyway**. You only need to do this once. macOS asks because Markooj is not signed with an Apple certificate yet.

**To open DjVu files on macOS or Linux, install DjVuLibre.**
On macOS and Linux the DjVu tools come from your package manager (Pandoc and Python macros install from **File → Options → Features**). Install them once, then click **Check again** in the message (or start Markooj again):

- **macOS** (with [Homebrew](https://brew.sh)): `brew install djvulibre pdf2djvu`
- **Debian and Ubuntu:** `sudo apt install djvulibre-bin pdf2djvu`
- **Fedora:** `sudo dnf install djvulibre pdf2djvu`

DjVuLibre's own page is [djvu.sourceforge.net](https://djvu.sourceforge.net/). Everything except DjVu works without it.

**A Save As format is grayed out.**
Click its card: Markooj shows how to get the tool it needs on your system, with **Copy command** for macOS and Linux and **Check again** when you are done. The other formats work as usual.

**My Word file looks different after opening it.**
Markooj turns Word files into Markdown, and Markdown keeps the content and structure, not every detail of the layout: there are no text boxes, page headers or tracked changes. Your Word file itself is never changed. See [Markdown for Word users](markdown-for-word-users.md).

**I pressed Ctrl+S and Markooj asked for a file name, but the file was already saved.**
Type a name and click **Save**. The file was opened from another format (Word, PDF, HTML …), so Markooj saves your work as a new Markdown file and the original is never overwritten.

**Markooj asks “Choose how to save” when I press Ctrl+S.**
Choose **Save as Copy…** (the default) to keep both versions, **Overwrite** to replace the copy on disk with yours, or **Cancel** to look first. **Review → Compare** shows the differences. Markooj asks because another program, a co-author or a sync service changed the file after you opened it.

**Pictures from the web do not show.**
Click **Load pictures** in the message, or turn on **File → Options → Privacy → Load pictures from the web in documents**. They stay hidden until you do, because loading them tells their server that you opened the document.

**Pictures disappeared after I moved my document.**
Move or copy the `assets` folder that was next to the document along with it: that is where its pictures are kept.

**An equation shows in red.**
Double-click the equation to open the editor: it shows which part of the LaTeX to fix. If the equation uses your own commands, check them in **Developer → Math macros**.

**A cross-reference shows in red.**
Rest the pointer on it for a suggestion, or open **References → Cross-ref** and insert it again. It turns red when what it points to is gone or its label changed.

**Urdu or Arabic text runs the wrong way.**
Click in the paragraph and click **Home → Right-to-left text direction**. For a whole document, set its language on the status bar. See [Languages and right-to-left text](languages-and-rtl.md).

**Words in Urdu, Arabic, Persian or Punjabi are not spell-checked.**
Spelling for these languages comes with a language pack; install it in File → Options → Language. The Urdu, Arabic and Punjabi word lists are still small, so Markooj underlines only words that look like a typo of a known word. A misspelled word that is not close to any known word is not underlined yet. See [Spelling while the word lists grow](languages-and-rtl.md#spelling-while-the-word-lists-grow).

**Check for language packs says Markooj could not reach GitHub.**
Packs are downloaded from the Markooj language packs page on GitHub. Check your internet connection, or download the pack's `.zip` on another computer and use **Install from file…**.

**A Python macro is slow the first time.**
Python starts the first time you use it in a session, which takes a few seconds. Turn on **File → Options → Developer → Start Python in the background** to have it ready.

**`import numpy` fails in a Python macro.**
Use the modules of Python's standard library (such as `math`, `re` and `statistics`) instead: Python in Markooj has the standard library only, and extra packages cannot be installed.

**An add-in does not load.**
Open **File → Add-ins**: the add-in's card says what to do, with the error under **Show error**. An add-in from a file must be a `.js` file in the add-ins folder; click **Reload add-ins** after changing it. An add-in from the store may need a newer Markooj: its details page says which version.

**An add-in from the store does not install.**
Browse and Install need an internet connection to GitHub. If Markooj says a copy did not pass its safety check, nothing was installed: try again later, because the author may be publishing a new version at that moment. If it keeps failing, please [report it](https://github.com/datakeen/markooj-addins/issues).

**Where are my settings?**
In `%APPDATA%\Markooj` for an installed copy, or in the `data` folder next to `Markooj.exe` for a portable copy. See [Options](options.md).

**I lost text I had not saved.**
Look in **File → Recover**. See [Recover unsaved work](recover.md).

**Something else?**
Please [open an issue on GitHub](https://github.com/datakeen/markooj/issues) with the steps that lead to the problem, a screenshot, and the version number from About Markooj.

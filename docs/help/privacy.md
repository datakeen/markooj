# Privacy

Markooj works on your own computer. Your documents, your writing and everything you type stay there.

## What stays on your computer

- **Your documents.** Markooj opens and saves files where you choose. It has no account, no cloud and no sync.
- **Checking your writing.** Spelling, grammar, the Writing Assistant and the thesaurus all run inside Markooj. Your text is never sent anywhere to be checked.
- **Converting and exporting.** Pandoc, pdf2djvu and DjVuLibre come with Markooj and run on your computer.
- **Python and JavaScript.** Macros run inside Markooj.
- **Equations, diagrams and code colors** are drawn by libraries that come with Markooj.
- **Recovered text, settings, macros and add-ins** are kept in your Markooj settings folder. See [Options](options.md).

Markooj has no analytics, no tracking and no crash reports that phone home. It does not check for updates by itself.

## When Markooj uses the internet

Only when you ask it to:

- **Language packs.** When you click **Check for language packs** or **Download** in File → Options → Language, Markooj fetches the list and the pack from the releases of the Markooj language packs repository on GitHub (github.com/datakeen/markooj-language-packs). Nothing about you or your documents is sent. Each file is checked against its SHA-256 checksum before it is installed.
- **Add-ins.** When you open **File → Add-ins → Browse**, or install or update an add-in, Markooj fetches the store's list from the Markooj add-in registry on GitHub (github.com/datakeen/markooj-addins) and the add-in's files from its author's releases on GitHub. Nothing about you or your documents is sent. Each file is checked against its SHA-256 checksum before it is installed.
- **Features.** When you install or update Pandoc, the DjVu tools or Python macros in **File → Options → Features** (or tick them in the Windows installer or on the Welcome screen), Markooj downloads them from the Markooj releases on GitHub (github.com/datakeen/markooj). Nothing about you or your documents is sent. Each file is checked against the SHA-256 checksum that came with Markooj before it is installed. **Install from file…** works with no internet at all.
- **Pictures from the web.** A picture in a document can point to a web address. Markooj does not load those unless you turn on **File → Options → Privacy → Load pictures from the web in documents**, because loading one tells its server that you opened the document.
- **Links.** Clicking a web link opens it in your own browser.

## Files from other people

- Opening a file never runs code from it. Python code inside a document runs only when you press Run, and Markooj asks once per document whether you trust it.
- When Markooj converts files with Pandoc, it does so in Pandoc's sandbox, and it does not pass on settings from a document that could make Pandoc read other files on your computer.
- Web pages and Word files are cleaned before they are shown, so scripts inside them never run.

## Add-ins

An add-in is a small program that can do anything Markooj can do. Install add-ins only from people you trust. Add-ins from the store run only after you turn on **Community add-ins**, and an add-in, once installed, may use the internet in its own way. See [Add-ins](add-ins.md).

## Questions

Have a question about privacy, or found a problem? Please [open an issue on GitHub](https://github.com/datakeen/markooj/issues). For a security problem, see the security policy on the project page.

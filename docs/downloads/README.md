# Download Markooj

Markooj is a Markdown editor that works like Microsoft Word. You click and type on a page with a ribbon you already know, and Markooj writes plain Markdown for you. It has a visual equation editor, numbered equations, figures and tables with cross-references, citations from BibTeX, an offline Writing Assistant, right-to-left writing for Urdu, Arabic, Persian and Punjabi (Shahmukhi), Python and JavaScript macros, and export to PDF, Word, EPUB, LaTeX and many more formats. Free and open source, for Windows, macOS and Linux, and everything runs on your own computer.

Website: [datakeen.github.io/markooj](https://datakeen.github.io/markooj/)

## Features

- **Writes like Word:** the ribbon, Word's shortcuts and Alt KeyTips, with four ways to work on one file (Word, Inline, Simple and Read).
- **Equations and cross-references:** a visual equation editor, numbered equations, figures and tables, and references that update themselves.
- **Citations:** cite from your Zotero, Mendeley or JabRef library (a .bib file), and the bibliography builds itself.
- **Writing Assistant:** offline spelling, grammar and style checks, each with a Why? that explains it.
- **Tables like Word:** insert, merge and style tables, and paste them from Word, Excel and Google Sheets.
- **Right to left:** Urdu, Arabic, Persian and Punjabi (Shahmukhi), with matching fonts, built-in keyboards and aarab tools.
- **In your language:** the menus and dialogs come in English, Chinese (Simplified), Urdu, Roman Urdu, Punjabi, Japanese, Arabic, Swedish, Spanish, French and Portuguese (Brazil).
- **Save in the format people ask for:** PDF, Word, web page, EPUB, LaTeX and more.
- **Split and side by side:** two parts of a document, or two documents, at once, plus rulers and guides.
- **Macros and add-ins:** Python and JavaScript macros, and an add-in store.
- **Private:** everything runs on your own computer, and nothing you write leaves it.

## Which file do I need?

In the file names below, `x.y.z` is the version number, for example `1.1.0`.

| Your computer | Download | Notes |
| --- | --- | --- |
| **Windows 10 or 11** (most PCs) | `Markooj-x.y.z-win-x64-setup.exe` | The usual choice on Windows. Run it and follow the steps. It asks for your language and which extra features you want. |
| Windows, without installing or without internet | `Markooj-x.y.z-win-x64-portable.zip` | The **full** copy: every feature is included, so it works with no internet at all. Unzip the whole zip into a folder (or a USB drive) and run `Markooj.exe`. Settings stay in a `data` folder next to it. |
| **Mac with an Apple chip** (M1, M2, M3, M4 and later) | `Markooj-x.y.z-mac-arm64.dmg` | Most Macs from late 2020 on. |
| Mac with an Intel chip | `Markooj-x.y.z-mac-x64.dmg` | Older Macs. Not sure? Click the Apple menu → **About This Mac**: it says **Chip** (Apple) or **Processor** (Intel). |
| **Linux** (most distributions) | `Markooj-x.y.z-linux-x86_64.AppImage` | One file that runs on most 64-bit Linux systems. |
| Debian, Ubuntu, Linux Mint | `Markooj-x.y.z-linux-amd64.deb` | Installs Markooj with the rest of your programs. |
| Linux, without installing | `Markooj-x.y.z-linux-x64.tar.gz` | A plain folder to unpack anywhere. |

You do not need `Markooj-x.y.z-third-party-sources.zip`. It holds the source code of Pandoc, DjVuLibre and pdf2djvu, for anyone who wants it. `Markooj-x.y.z-SHA256SUMS.txt` lists the checksums of every file. The `markooj-feature-…zip` files are the optional features (below); Markooj downloads the ones you choose by itself.

## Optional features

Markooj installs small (about 360 MB on Windows instead of 730 MB). Three parts are optional and download only when you want them:

| Feature | What it does | Download | On disk |
| --- | --- | --- | --- |
| **Pandoc** | Save as LaTeX, OpenDocument, Rich Text, PowerPoint, Typst and more, and open those files. | about 40 MB | about 230 MB |
| **DjVu tools** (Windows) | Open DjVu files and save documents as DjVu. | about 15 MB | about 37 MB |
| **Python macros** | Run macros written in Python on the Developer tab. | about 6 MB | about 13 MB |

Choose them in the Windows installer, on the Welcome screen (macOS and Linux), or any time in **File → Options → Features**, where you can also remove them. Without them, writing, the four modes, Word (.docx), PDF, EPUB, web pages, equations, diagrams and the Writing Assistant all work. Every download is checked against the checksum that came with Markooj before it is installed.

**No internet on the computer?** On Windows, use the portable zip, which includes every feature. Or download the `markooj-feature-…zip` files for your system from the release page (or the [features release](https://github.com/datakeen/markooj/releases/tag/tools)) on another computer, copy them over, and choose **Install from file…** in **File → Options → Features**.

## System needs

- Windows 10 or 11, 64-bit; macOS 12 (Monterey) or later; or a 64-bit Linux.
- About 400 MB of free disk space, plus the space of the features you choose (up to about 280 MB more).
- No internet connection is needed to write, check spelling and grammar, or save as Word, PDF and EPUB. The optional features download once (or use the Windows portable zip, which includes them).

## Installing

### Windows

**Installer:** run `Markooj-x.y.z-win-x64-setup.exe`. The first screen lists the 11 languages of Markooj, each in its own script: pick yours, and both the installer and Markooj use it (you can switch it later in Markooj). The installer's standard steps are in English for Urdu, Roman Urdu and Punjabi, because the installer toolkit Markooj uses has no Urdu or Punjabi yet; the features step is in your language. Then choose the folder and the extra features you want (Pandoc is checked to start with; each shows its size). The features you check download in the background the first time Markooj starts; a small card shows the progress, and **Cancel** stops it. The installer adds Markooj to the Start menu and the desktop, and Markdown files open in it with a double-click. To remove it later, use **Settings → Apps** in Windows; that also removes the features it downloaded.

For IT departments: `Markooj-x.y.z-win-x64-setup.exe /S /LANGUAGE=en /FEATURES=pandoc,djvu,python` installs silently with those choices. The language codes are `en`, `zh-CN`, `ur`, `ur-Latn`, `pnb`, `ja`, `ar`, `sv`, `es`, `fr` and `pt-BR`; `/LANGUAGE=` also skips the language screen of a normal install.

**Portable zip:** right-click the zip, choose **Extract All…**, and pick a folder. Run `Markooj.exe` inside it. Keep the whole folder together: Markooj and its features are in the `resources` folder beside it. This copy includes every feature and never needs the internet. To remove it, delete the folder.

### macOS

Open the `.dmg` file and drag **Markooj** onto the **Applications** folder. Then open Markooj from Applications. The Welcome screen asks which extra features you want (Pandoc and Python macros). To remove Markooj, drag it from Applications to the Trash.

### Linux

**AppImage:** right-click the file, open **Properties → Permissions**, and tick **Allow executing file as program** (or run `chmod +x Markooj-x.y.z-linux-x86_64.AppImage`). Then double-click it.

**Debian and Ubuntu:** double-click the `.deb` file to open it in your software center, or run:

```
sudo apt install ./Markooj-x.y.z-linux-amd64.deb
```

**tar.gz:** unpack it into a folder and run `markooj` inside it.

**DjVu files** on macOS and Linux need the DjVu tools from your package manager. Everything else works without them.

```
brew install djvulibre pdf2djvu
```

```
sudo apt install djvulibre-bin pdf2djvu
```

## The first start

The files are not code-signed yet, so your system may ask once:

- **Windows:** "Windows protected your PC". Click **More info**, then **Run anyway**.
- **macOS:** "Markooj cannot be opened" or "Apple could not check it". Right-click Markooj in Applications and choose **Open**, then **Open** again. On newer macOS versions, open **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to Markooj.

## Checking the download

If you want to be sure a file arrived complete and unchanged, compare its SHA-256 checksum with the one in `Markooj-x.y.z-SHA256SUMS.txt` on the release page.

On Windows, in Command Prompt:

```
certutil -hashfile Markooj-x.y.z-win-x64-setup.exe SHA256
```

On macOS and Linux, in Terminal:

```
shasum -a 256 Markooj-x.y.z-mac-arm64.dmg
```

## Language packs

Urdu, Arabic, Punjabi (Shahmukhi) and Persian spelling and writing checks come as small language packs. In Markooj, open **File → Options → Language** and click **Check for language packs**. The packs are published in [their own repository](https://github.com/datakeen/markooj-language-packs).

## Getting started

Open Markooj and press **F1**. The Help has a getting started guide, step-by-step tutorials and a reference for everything. It works offline.

## More

- Website: [datakeen.github.io/markooj](https://datakeen.github.io/markooj/)
- Source code and every release: [github.com/datakeen/markooj](https://github.com/datakeen/markooj)
- What changed in each version: [changelog](https://github.com/datakeen/markooj/blob/main/CHANGELOG.md)
- Found a bug, or have an idea? [Open an issue](https://github.com/datakeen/markooj/issues)

Markooj is free and open source software under the [GNU Affero General Public License, version 3 or later](https://github.com/datakeen/markooj/blob/main/LICENSE). The programs and fonts it includes keep their own licenses.

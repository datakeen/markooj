# Languages and right-to-left text

## English, US and UK

Spelling and grammar for **English (US)** and **English (UK)** are built in. The UK dictionary accepts both *-ise* and the Oxford *-ize* spellings.

Each document has a language. Click the language on the status bar (or **Review → Language**) to change it. Markooj saves it at the top of the file as `lang: en-GB`, so the document keeps its language wherever it goes. Documents without a language use the default in **File → Options → Language**.

The Writing Assistant also notices when US and UK spellings are mixed in one document, such as *color* and *colour*, and suggests the one that fits the document's language.

## Urdu, Arabic, Persian and Punjabi

Markooj writes Urdu, Arabic, Persian and Punjabi in the Shahmukhi script right to left, with the letters joined, in fonts made for them. You do not need to set anything up to start.

### Typing

Switch your keyboard to Urdu, Arabic, Persian or Punjabi (Shahmukhi) and type. Each paragraph finds its own direction from its first letters: a paragraph that starts in Urdu runs right to left, and an English paragraph next to it stays left to right. Mixed lines, such as an English term inside an Urdu sentence, are laid out the way the Unicode standard asks.

### Direction of one paragraph

Like Word, the **Home → Paragraph** group has two buttons:

- **Right-to-left text direction** (Ctrl+Right Shift)
- **Left-to-right text direction** (Ctrl+Left Shift)

They set the direction of the paragraph with the cursor. In the file, Markooj writes a block such as:

```
::: {dir="rtl"}
یہ پیراگراف دائیں سے بائیں پڑھا جاتا ہے۔
:::
```

### Direction of the whole document

Set the document language to Urdu, Arabic, Persian or Punjabi (Shahmukhi) (status bar, or **Review → Language**), and the whole page reads right to left. To set only the direction, press **Alt+Q**, type `direction` and pick **Page direction**. In the file this is `lang: ur` and `dir: rtl` in the front matter. The language codes are `ur` for Urdu, `ar` for Arabic, `fa` for Persian and `pnb` for Punjabi (Shahmukhi).

### Fonts

Markooj comes with three fonts under the SIL Open Font License:

| Language | Default font |
| --- | --- |
| Urdu | Noto Nastaliq Urdu |
| Arabic | Noto Naskh Arabic |
| Persian | Vazirmatn |
| Punjabi (Shahmukhi) | Noto Nastaliq Urdu |

Choose another in **File → Options → Language → Fonts for right-to-left languages**. The font is used on the page, in Read mode, and in PDF and web page exports.

### Exports

- **PDF**, **web page** and **print** lay out right-to-left text correctly and carry the font with them.
- **Word**, **OpenDocument**, **EPUB**, **LaTeX** and the other Pandoc formats get the document direction and each right-to-left paragraph marked, so they open the right way round.

### KeyTips

The Alt KeyTips work with an Urdu, Arabic or Persian keyboard layout too: press the key where the letter sits on an English keyboard.

## Language packs

A language pack adds spelling and writing checks for another language. Packs are small downloads, from a few hundred KB to a few MB each, made for Markooj. They are published in their own repository on GitHub, [datakeen/markooj-language-packs](https://github.com/datakeen/markooj-language-packs).

| Language | Code | What the pack adds |
| --- | --- | --- |
| Urdu (Pakistan) | `ur` | Full spelling (about 95,000 words, from the CLE Urdu word list), a word list with aarab and Roman spellings, letter and punctuation checks, common misspellings and style hints |
| Arabic (Saudi Arabia, Modern Standard) | `ar` | A starter word list with harakat and Roman spellings, near-miss spelling, letter and punctuation checks, common misspellings and style hints |
| Punjabi (Pakistan, Shahmukhi) | `pnb` | The same as Arabic, written right to left in the Nastaliq font |
| Persian | `fa` | Full spelling (the Lilak list, about 100,000 words) and writing checks |

### Get a pack

1. Click **File → Options → Language**.
2. Click **Check for language packs**. Markooj lists the packs that are available and what each one adds.
3. Click **Download** next to the one you want. When a newer version is out, the button says **Update**.

Markooj checks every file in the pack against the SHA-256 checksum published with it before it installs anything. If one check fails, nothing is installed.

No internet on this computer? Download the pack's `.zip` file from the [packs release](https://github.com/datakeen/markooj-language-packs/releases/tag/packs) on another computer, then use **Install from file…**. Packs made for earlier versions of Markooj still install.

### Urdu spelling

The Urdu pack checks spelling in full, with about 95,000 words. Every word Markooj does not know is underlined, as in English.

- **Suggestions that understand Urdu.** Right-click an underlined word for suggestions. They are ranked by how close they are to what you typed, by letters that sound alike (such as س، ص، ث or ز، ذ، ض، ظ) or look alike (such as letters that differ only in their dots), and by how common each word is.
- **Your own words.** Names, technical terms and new words may not be in the list yet. Click **Add to dictionary** and Markooj stops underlining them.
- **Where the words come from.** Most of the words come from the word list of the Urdu Spell Checker, made by the Center for Language Engineering at UET Lahore, which also notes how often each word is used. The Markooj word list, with aarab and Roman spellings, comes on top of it, and wins where the two differ.

Urdu word list from the Urdu Spell Checker v1.0 by the Center for Language Engineering (CLE), KICS, UET Lahore (originally CRULP), used under the GNU GPL v3. See the [Urdu Spell Checker](https://www.cle.org.pk/software/langproc/spellcheck.htm) on the CLE website.

### Spelling while the word lists grow

The Arabic and Punjabi word lists are new and still small. If Markooj underlined every word it does not know, most of your text would be underlined. So these packs use **near-miss spelling**: only words that look like a typo of a known word are underlined, so you see few false alarms while the lists grow.

- A word is underlined when Markooj does not know it **and** it is one letter away from a common word it does know. The suggestion is that word.
- Before comparing, Markooj sets aside the small parts that attach to a word, such as و، ال and بال in Arabic, so *بالكتاب* is checked as *كتاب*.
- A word that is not close to any known word is left alone. It may be right; the list may simply not have it yet.
- Right-click an underlined word to pick a suggestion, or click **Add to dictionary** if the word is right.

When a word list is big enough, its pack switches to full spelling, like English, Persian and Urdu, and every unknown word is underlined.

### What a pack can hold

- A **word list** or a **spelling dictionary**. The Urdu, Arabic and Punjabi lists are written from scratch for Markooj; the Urdu pack also carries the CLE Urdu word list. Each word in the Markooj lists carries its aarab and its Roman spellings, which later versions use to add aarab and for Roman typing.
- **Writing Assistant checks**, for example:
  - the Arabic-script comma ، question mark ؟ and semicolon ؛ instead of the Latin ones;
  - the Persian, Urdu and Punjabi letters ی and ک instead of the Arabic ي and ك (and the other way round in Arabic);
  - the Urdu full stop ۔ and the letter ہ inside a word;
  - common misspellings, each with a right and a wrong example;
  - style hints, such as a shorter way to say a wordy phrase;
  - the half space after the Persian prefix می.
- The **font** the language should use.
- The **licenses** of everything inside it. The Urdu, Arabic and Punjabi word lists and rules written for Markooj are shared under CC BY-SA 4.0, so other free projects can use them too. The CLE Urdu word list keeps its own license, the GNU GPL v3, and the Urdu pack carries its text.

Once a pack is installed, its language appears in the language list on the status bar, and the Writing Assistant checks documents in that language. To remove a pack, click **Remove** next to it in Options → Language.

### Help improve a pack

In **File → Options → Language**, each pack shows how many words it has and how many a native speaker has checked so far. Click **Help improve** to open the guide for helpers on GitHub.

You do not need to write code. The word lists are plain spreadsheet files, and you can:

- **Suggest a word or a fix** with a short form in the [language packs repository](https://github.com/datakeen/markooj-language-packs/issues/new/choose);
- **check words** in your language and mark the ones you are sure of as checked;
- **add words, common misspellings and style hints** in Google Sheets, Excel or right in your browser.

The [guide for helpers](https://github.com/datakeen/markooj-language-packs/blob/main/CONTRIBUTING.md) explains every step. What comes next for each language, such as adding aarab with one click and Roman typing, is in the [language packs roadmap](https://github.com/datakeen/markooj-language-packs/blob/main/ROADMAP.md).

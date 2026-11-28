# Languages and right-to-left text

## The language of menus and buttons

Markooj's menus, buttons and messages come in 11 languages: English, Chinese (Simplified), Urdu, Roman Urdu, Punjabi (Shahmukhi), Japanese, Arabic, Swedish, Spanish, French and Portuguese (Brazil). This is the **interface language**. It is separate from the language of each document, so an English document stays English in an Urdu interface.

To change it, use any of these:

- Click the **A文** button on the status bar (bottom right) and pick a language.
- **File → Options → Language → Interface language.**
- Press **Alt+Q**, type *interface language* and choose **Change interface language**.
- The first step of the Welcome screen (**Help → Welcome**).
- On Windows, the installer asks for a language on its first screen and Markooj starts in that language.

The interface changes right away. Your open documents, including ones you have not saved, stay exactly as they are. Choose **Match the system language** to follow your computer's language again.

In Urdu, Punjabi and Arabic the whole window reads from right to left: the ribbon, File pages, menus and the status bar are mirrored. Your document keeps its own direction, and keyboard shortcuts, code and equations always read left to right.

These help pages are in English for now. If you are a native speaker and something in your language reads oddly, please tell us at [tally.so/r/db9jlN](https://tally.so/r/db9jlN?from=help-translations). Reviews from native speakers are very welcome.

## English, US and UK

Spelling and grammar for **English (US)** and **English (UK)** are built in. The UK dictionary accepts both *-ise* and the Oxford *-ize* spellings.

Each document has a language. Click the language on the status bar (or **Review → Language**) to change it. Markooj saves it at the top of the file as `lang: en-GB`, so the document keeps its language wherever it goes. Documents without a language use the default in **File → Options → Language**.

The Writing Assistant also notices when US and UK spellings are mixed in one document, such as *color* and *colour*, and suggests the one that fits the document's language.

## Urdu, Arabic, Persian and Punjabi

Markooj writes Urdu, Arabic, Persian and Punjabi in the Shahmukhi script right to left, with the letters joined, in fonts made for them. You do not need to set anything up to start.

### Typing: keyboards built into Markooj

You can type Urdu, Arabic, Persian and Punjabi (Shahmukhi) without installing anything on your computer. Markooj has the keyboard each language uses most:

| Keyboard | Layout | For example |
| --- | --- | --- |
| **Urdu** (اردو) | Urdu Phonetic (CRULP), the most used in Pakistan | `a` ا, `b` ب, `p` پ, `t` ت, `Shift+T` ٹ, `Shift+D` ڈ, `Shift+R` ڑ, `o` ہ, `y` ے, `Shift+N` ں |
| **Arabic** (عربي) | Arabic (101), the Windows standard in Saudi Arabia | `h` ا, `f` ب, `j` ت, `b` لا, `` ` `` ذ |
| **Persian** (فارسی) | Persian Standard (ISIRI 9147), as in Windows | `d` ی, `;` ک, `'` گ, `m` پ, `Shift+Space` half space |
| **Punjabi** (پنجابی) | Urdu Phonetic plus the Punjabi letters | `Shift+B` ݨ, `Shift+L` ڵ, `AltGr+L` ݪ, `AltGr+Y` ۓ |

**Switch the keyboard** whichever way suits you:

- Click the keyboard chip on the status bar (it shows **EN**, **اردو**, **عربي**, **فارسی** or **پنجابی**) and pick one.
- Press **Ctrl+Shift+K** to switch between English and the last right-to-left keyboard you used.
- **View → Keyboard**, or press **Alt+Q** and type `keyboard`.
- **File → Options → Language → Keyboard** sets the keyboard and which one Ctrl+Shift+K switches to.

Keys are read by their place on the keyboard, so the layouts work with any keyboard your computer has (English, French, German…). The keyboard types in the document, in every mode. Search boxes and dialogs stay in English letters unless you turn on **Also type in search boxes and dialogs** in Options.

**The on-screen keyboard** (**View → On-screen**) shows every key of the layout at the bottom of the window. Click a key to type it; **Shift** shows the second character of each key (aarab, ٹ ڈ ڑ and more) and **AltGr** the signs and honorifics. Holding the real Shift shows the Shift keys too.

**Already have an Urdu, Arabic or Persian keyboard?** Keep using it. Markooj never changes a key that already types these letters, and it leaves input methods alone, so the two never fight.

When you switch to a right-to-left keyboard in an empty paragraph, the cursor moves to the right at once. Each paragraph finds its own direction from its first letters: a paragraph that starts in Urdu runs right to left, and an English paragraph next to it stays left to right.

Where the layouts come from: the Urdu Phonetic layout follows the CRULP Urdu Phonetic Keyboard Layout v1.1 (Center for Research in Urdu Language Processing, now the Center for Language Engineering at UET Lahore), checked against Keyman's Urdu Phonetic (CRULP) keyboard (MIT License, SIL Global). The Arabic and Persian layouts follow the Windows layouts Arabic (101) and Persian (Standard).

### Mixed Urdu and English in one line

An English term, a number or an equation inside an Urdu sentence (or Urdu inside English) is laid out the way the Unicode standard asks, and Markooj helps it along:

- **A paragraph reads in the direction of its first real letter.** Math, code and numbers at the start do not count, so `$x$ کے بعد…` still reads right to left.
- **Pieces that read the other way are kept together** (isolated): English links, **bold** or *italic* English words, code and math inside an Urdu paragraph, and Urdu inside an English one. The words around them keep their order.
- **Lines broken with Shift+Enter** each find their own direction.
- **In Read mode**, runs of English words inside Urdu paragraphs (and Urdu inside English) are isolated too, so numbers and punctuation next to them stay where you put them.
- **In Simple mode**, every line of the Markdown takes the direction of its own first letter.

Selecting mixed text: **Shift+Ctrl+→** and **Shift+Ctrl+←** grow the selection word by word in reading order, and **Shift+→ / Shift+←** letter by letter, as in Word. In a right-to-left paragraph the arrow keys follow what you see: **→** moves toward the start of an Urdu line. When a selection crosses from Urdu into English, the highlight can look split in two places on the screen; it still holds exactly the words between where you started and where you stopped, in reading order, and that is what Copy, Cut and formatting use.

### Aarab: zabar, zer, pesh and more

When you write Urdu, Arabic, Persian or Punjabi (or a right-to-left keyboard is on), **Home → Aarab** shows:

- **Remove Aarab** (Ctrl+Alt+Shift+R): takes zabar, zer, pesh, shadd, jazm, tanween and khari zabar out of the selection, or out of the whole document when nothing is selected. Code is left alone, and the madda of آ and the hamza of ۂ stay. Undo brings the marks back.
- **A button for each mark**: zabar ◌َ (Ctrl+Alt+Shift+A), zer ◌ِ (Ctrl+Alt+Shift+I), pesh ◌ُ (Ctrl+Alt+Shift+U), shadd ◌ّ (Ctrl+Alt+Shift+S), jazm ◌ْ (Ctrl+Alt+Shift+J), tanween zabar ◌ً (Ctrl+Alt+Shift+N), tanween zer ◌ٍ, tanween pesh ◌ٌ and khari zabar ◌ٰ (Ctrl+Alt+Shift+K). The mark goes on the letter just before the cursor. Click the same mark again to take it off; another vowel mark replaces the one there; shadd goes together with a vowel.
- **Hide Aarab** (Ctrl+Alt+Shift+H): Read mode and the Simple mode preview show the text without the marks, for easy reading. Your file keeps them. Word and Inline modes always show the marks, because there you edit them.
- **From Word List** (Ctrl+Alt+Shift+W): adds aarab to the words of the selection, or of the whole document, that the installed Urdu, Arabic or Punjabi language pack knows with exactly one reading. A word with several readings, such as علم (عِلْم knowledge, عَلَم flag), stays as you typed it: add its marks with the buttons. Choosing between readings comes in a later version.

With the keyboard, press **Alt**, **H**, then **D** and the letter shown on a button (KeyTips). The marks are also on the Shift layer of the Urdu Phonetic keyboard: **Shift+Y** zabar, **Shift+I** zer, **Shift+P** pesh, **Shift+W** shadd, **Shift+Q** jazm, **Shift+E** khari zabar. **File → Options → Language → Aarab** decides when the Aarab group shows (Automatic, Always or Never).

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

**Alignment follows the paragraph's own side.** In Word mode, an Urdu or Arabic paragraph shows **Align right** as on, because right is where its lines start; clicking it changes nothing in the file. **Align left** really moves it to the left and is saved as `<div align="left">`. **Ctrl+Q** (Clear paragraph formatting) brings it back to its own side.

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

- A **word list** or a **spelling dictionary**. The Urdu, Arabic and Punjabi lists are written from scratch for Markooj; the Urdu pack also carries the CLE Urdu word list. Each word in the Markooj lists carries its aarab and its Roman spellings. **Home → Aarab → From Word List** uses the aarab; Roman typing comes in a later version.
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

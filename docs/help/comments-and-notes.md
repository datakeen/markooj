# Comments and notes

Markooj has two ways to leave notes in a document: **comments**, for you and the people you work with, and **hidden notes**, small reminders to yourself. Neither shows up when the document is read, printed or exported, unless you ask.

## Comments

1. Put the cursor where the comment belongs, or select the words it is about.
2. Click **Review → New comment**, or press **Ctrl+Alt+M**.
3. Type the comment and click OK.

In Word and Inline modes, comments show as bubbles in the margin. In the file a comment is a line of HTML that Markdown programs ignore:

```
<!-- comment: Check this value against the 2019 survey. -->
```

On the **Review** tab:

- **Previous comment** and **Next comment** move between them.
- **Delete comment** removes the selected one; **Delete all comments** removes every comment in the document.
- **Show** hides or shows the bubbles and hidden notes while you edit.

## Hidden notes

Type a note between two pairs of percent signs:

```
The flume was 12 m long %%check: was it 12 or 15?%% and 0.3 m wide.
```

While you edit, the note shows as faint highlighted text. In Read mode, print and exports it disappears. Obsidian uses the same marks, so notes stay hidden there too. Simple mode colors them so you can spot them.

## In exports and prints

Comments and hidden notes are left out of every export and printout by default, so the people you share with see a clean document. To include them, turn on **Include comments** on the Save As page or the Print page, or in **File → Options → Typing and review**. Word and OpenDocument exports then get them as real comments in the margin.

## Compare with the saved version

**Review → Compare** shows what changed since you last saved, line by line: added lines in one color and removed lines in another, with a count of each. It compares with the file on disk, so it also shows changes made in another program. **Go back to saved version** throws your changes away and returns to the saved file.

Markdown has no tracked changes like Word's. For a full history of a document, keep it in Git, or keep dated copies.

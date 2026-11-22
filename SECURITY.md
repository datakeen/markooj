# Security policy

Markooj opens files that other people send you: Markdown, Word, PDF, EPUB, HTML and more. It is built so that opening a file is safe. If you find a way around that, please tell us.

## Supported versions

Security fixes go into the latest release. Please update to it before you report a problem.

| Version | Supported |
| --- | --- |
| 1.0.x | Yes |

## Reporting a problem

Please do **not** open a public issue for a security problem. Use GitHub's private reporting instead:

1. Open the [Security tab](https://github.com/datakeen/markooj/security) of the repository.
2. Click **Report a vulnerability**.
3. Describe the problem, the Markooj version, and the steps or a sample file that shows it.

You will get an answer as soon as we can, usually within a week. We will keep you informed while we fix it, and credit you in the changelog if you like.

## What counts

For example:

- a document that runs code, reads or writes files, or reaches the network when it is opened, shown or exported;
- a way for document content to get past the HTML sanitizer, or to reach `window.mk` or Node.js;
- a language pack that installs although a file does not match its checksum, or that writes outside its folder;
- a way for a converted file to make Pandoc read other files on the computer.

## What is by design

- **Macros and add-ins** are programs. They run with the same rights as Markooj, like VBA macros and add-ins in Word. Install and run only those you trust. Python code inside a document runs only when you press Run, and Markooj asks once per document first.
- **Pictures from the web** load only when you turn that on in File → Options → Privacy.

## How Markooj protects you

- The window runs with context isolation on and Node.js integration off; the page reaches the computer only through a small bridge (`preload.js`).
- Rendered Markdown and HTML are sanitized with DOMPurify before they are shown, under a strict Content Security Policy.
- Files are converted with Pandoc's `--sandbox` option. A document's own settings never reach Pandoc unchecked, and network paths in links and pictures are dropped.
- Language packs are checked file by file against their SHA-256 checksums, and against paths that try to escape their folder, before anything is written.
- Bundled tools are official upstream builds, checked against pinned SHA-256 checksums when they are fetched.

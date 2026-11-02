# Stream Shield

Firefox extension that replaces personal strings in web page text while you stream. It is a local-only MVP: no server, no account, and no build step.

## Install (temporary add-on)

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Choose `manifest.json` from this folder.
4. Open the toolbar button. Choose **Edit hidden terms**, add one term per line, and save.
5. Reload any page you want masked.

A temporary add-on stays loaded until you remove it or quit Firefox. Load it again after a restart. Terms are stored with `browser.storage.local` and remain available the next time you load this add-on, including after a restart while the extension stays installed.

Firefox may not inject this extension into `file://` pages. Serve the sample over HTTP from this folder:

```text
python -m http.server 8080
```

Then open `http://127.0.0.1:8080/test/sample.html`. Suggested terms: `Jane Doe` and `jane.doe@email.com`.

## Streaming

Share the **Firefox window**, not the whole desktop. This extension only changes page content. It does not cover the address bar, tabs, or other applications.

## Privacy

Hidden terms and blocked image prefixes are encrypted with a PIN before they are written to `browser.storage.local`. The PIN is not stored. After you unlock, the terms stay in memory for that Firefox session only. Nothing is uploaded. Matching is case-insensitive text replacement, not a security boundary. A blocked image is shown as a black rectangle. Video, canvas, other images, PDFs, and the Firefox interface can still show the same information.

## Limits

- Short terms match inside longer words (`Ann` also matches `Anniversary`).
- If one term contains another, the longer term is tried first.
- Typing in inputs, text areas, and contenteditable regions is left alone. `script`, `style`, `noscript`, `code`, and `pre` are skipped.
- Turning protection off, or editing the term list, does not restore text already replaced. Reload the page.
- Do not use a replacement that itself contains one of your terms. Masking skips a string when the replacement would still match, so the page does not get stuck rewriting it.
- Some sites redraw text from their own copy and can flicker while protection is on.

## Manual check

1. Load the temporary add-on from `manifest.json`.
2. Save the sample name and email as terms.
3. Open the sample page over HTTP. Static text, the badge tooltip, the image `alt`, and the empty field’s placeholder should be masked.
4. After about a second and a half, the inserted line should be masked too.
5. The filled input, the contenteditable box, and the preformatted line should still show the original strings, and typing in the fields should still work.

# Developer training documentation

Open [Bright-Minds-Developer-Manual.html](Bright-Minds-Developer-Manual.html) in a browser. It is a self-contained offline manual with the teaching guide, file search, project/category filters, function walkthroughs, and numbered source snapshots. Print the current selection from the toolbar; source listings are omitted from print.

The [PDF edition](../../output/pdf/Bright-Minds-Developer-Teaching-Manual.pdf) includes the chapters and complete explanatory file reference, with clickable contents, PDF bookmarks, and page numbering. The expanded raw source snapshots remain in the companion HTML edition.

[teaching-guide.md](teaching-guide.md) contains the editable teaching chapters. `file-notes.json` contains the file-specific explanations. `coverage-manifest.json` and `coverage.csv` record which files were included and which contents were omitted.

Rebuild from the frontend root after updating the source or teaching text:

```powershell
node docs/developer-training/build-manual.cjs
```

The builder reads the current frontend and neighbouring `../bright-minds-backend` working files. It uses the frontend's installed TypeScript parser. It does not run the school application, migrations, email, payment calls, or database writes. Review the guide's factual claims when code changes; rebuilding updates structural extraction and snapshots but does not rewrite the authored explanations.

Environment values, uploaded contents, backup contents, logs, scratch IDs, binary assets, and generated lockfile records are not reproduced. Secret configuration defaults are redacted from the snapshots. Generated build/dependency/cache/Git internals and this docs directory are excluded from recursive source coverage.

`verify-manual.cjs` is the browser QA helper. It expects the manual preview at `http://127.0.0.1:8789/manual` and an isolated Chromium debugging instance at port 9337. It verifies coverage, internal links, filters, example endpoint permissions/paths, source expansion, mobile width, print visibility and selected secret-value exclusions. QA screenshots and results are stored in `.qa/` and are not part of the intended teaching deliverable.

Application code was not changed for this documentation work. Existing modified source files were read as they stood. The manual records implementation limitations as code-reading findings, without claiming the application test suite passed.

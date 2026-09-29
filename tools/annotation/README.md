# Plan Annotation Tool

A browser-only tool for marking named regions on PDFs, PNGs, and JPGs.

## What It Does

- Import a PDF or image as the base plan.
- Draw polygon regions and curved edges.
- Assign names, colors, opacity, and labels to regions.
- Copy region coordinates as JSON.
- Export the annotated image/PDF together with a matching JSON annotation file.
- Re-import annotation JSON for continued editing.

## Privacy Notes

- The tool runs entirely in the browser.
- Imported files and annotation data are not uploaded to a server.
- Autosave uses browser local storage on the current device.
- Clear the browser site data if you need to remove local autosave records.

## Usage

Open `index.html` directly in a modern browser.

For PDF rendering, some browsers may require serving the folder over local HTTP:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/tools/annotation/
```

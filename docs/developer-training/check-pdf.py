"""Validate and render the exported teaching PDF without running school code."""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / '.qa' / 'pdf-tools'))
import fitz
from PIL import Image, ImageDraw

pdf_path = ROOT.parent.parent / 'output' / 'pdf' / 'Bright-Minds-Developer-Teaching-Manual.pdf'
out = ROOT / '.qa' / 'pdf'
out.mkdir(parents=True, exist_ok=True)
doc = fitz.open(pdf_path)
pages = [page.get_text() for page in doc]
combined = ''.join(pages)
normalize = lambda value: re.sub(r'\s+', '', value).lower()
plain = normalize(combined)
manifest = json.loads((ROOT / 'coverage-manifest.json').read_text(encoding='utf-8'))
missing = [f['path'] for f in manifest['files'] if normalize(f['path']) not in plain]
assert not missing, f'Missing file references: {missing}'
toc = doc.get_toc()
assert len(toc) >= 20, 'Missing PDF document outline'
assert 'Contents' in combined
assert '414 file entries' in combined
assert 'coverage and exclusions' in combined.lower()

empty_pages = [i + 1 for i, text in enumerate(pages) if len(text.strip()) < 100]
bad_bounds = []
for i, page in enumerate(doc):
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                x0, y0, x1, y1 = span['bbox']
                if span['text'].strip() and (x0 < 5 or y0 < 5 or x1 > page.rect.width - 5 or y1 > page.rect.height - 5):
                    bad_bounds.append({'page': i + 1, 'bbox': span['bbox'], 'text': span['text'][:60]})
assert not bad_bounds, f'Text outside page: {bad_bounds[:10]}'

sample_numbers = set([1, 2, 3, 4, 5, len(doc)])
targets = ['src/lib/api.ts', 'PupilController.java', 'ParentPortalService.java', 'src/routes/_authenticated/pupils.tsx', 'src/components/ui/select.tsx', 'V34__report_card_remarks_term_scoped.sql', 'src/styles.css', 'src/main/java/com/brightminds/school/entity/Pupil.java']
for target in targets:
    match = next((entry for entry in toc if target in entry[1]), None)
    if match:
        sample_numbers.add(match[2])
        if match[2] < len(doc):
            sample_numbers.add(match[2] + 1)
for i in sorted(sample_numbers):
    page = doc[i - 1]
    page.get_pixmap(matrix=fitz.Matrix(1.4, 1.4), alpha=False).save(str(out / f'page-{i:04d}.png'))

# Render every page into labelled overview sheets to review pagination at scale.
sheet_paths = []
for start in range(0, len(doc), 48):
    width, height = 150, 228
    sheet = Image.new('RGB', (width * 6, height * 8), '#e4e8ec')
    draw = ImageDraw.Draw(sheet)
    for offset in range(min(48, len(doc) - start)):
        page = doc[start + offset]
        pix = page.get_pixmap(matrix=fitz.Matrix(0.24, 0.24), alpha=False)
        image = Image.frombytes('RGB', [pix.width, pix.height], pix.samples)
        image.thumbnail((width - 8, height - 22))
        x = (offset % 6) * width + (width - image.width) // 2
        y = (offset // 6) * height + 18
        sheet.paste(image, (x, y))
        draw.text(((offset % 6) * width + 6, (offset // 6) * height + 2), str(start + offset + 1), fill='black')
    sheet_path = out / f'overview-{start + 1:04d}-{min(start + 48, len(doc)):04d}.jpg'
    sheet.save(sheet_path, quality=85)
    sheet_paths.append(str(sheet_path))

report = {
    'pdf': str(pdf_path), 'bytes': pdf_path.stat().st_size,
    'pageCount': len(doc), 'outlineEntries': len(toc),
    'fileReferencesExpected': len(manifest['files']), 'missingFileReferences': missing,
    'pagesWithFewerThan100Characters': empty_pages,
    'textOutsidePageBounds': bad_bounds,
    'renderedSamplePages': sorted(sample_numbers),
    'overviewSheets': sheet_paths,
    'firstOutlineEntries': toc[:25],
}
(out / 'verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k not in ['overviewSheets', 'firstOutlineEntries']}, indent=2))

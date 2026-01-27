#!/usr/bin/env python3
"""
Run Docling on Amendment PDFs

Processes PDFs downloaded by fetch-amendments.ts and exports to
HTML, Markdown, and JSON for comparison.
"""

import json
import os
import sys
from pathlib import Path

# Fix Windows encoding issues
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# Disable symlinks for Windows Hugging Face cache
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_ENABLE_SYMLINKS"] = "0"

from docling.document_converter import DocumentConverter

# Paths
SCRIPT_DIR = Path(__file__).parent
MANIFEST_PATH = SCRIPT_DIR / "manifest.json"
OUTPUT_DIR = SCRIPT_DIR / "output" / "docling"

def main():
    # Load manifest
    if not MANIFEST_PATH.exists():
        print("Error: manifest.json not found. Run fetch-amendments.ts first.")
        return

    with open(MANIFEST_PATH, encoding='utf-8') as f:
        manifest = json.load(f)

    print(f"Processing {len(manifest)} PDFs with Docling...\n")

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Initialize converter
    print("Initializing Docling converter (downloading models if needed)...")
    converter = DocumentConverter()
    print("Converter ready.\n")

    results = []

    for item in manifest:
        sfs = item["sfs"]
        pdf_path = item["pdfPath"]
        safe_name = sfs.replace(":", "-")

        print(f"Processing {sfs}...")
        print(f"  PDF: {pdf_path}")

        try:
            # Convert PDF
            result = converter.convert(pdf_path)
            doc = result.document

            # Export to different formats
            html_output = doc.export_to_html()
            md_output = doc.export_to_markdown()
            json_output = doc.export_to_dict()

            # Save outputs
            html_path = OUTPUT_DIR / f"{safe_name}.html"
            md_path = OUTPUT_DIR / f"{safe_name}.md"
            json_path = OUTPUT_DIR / f"{safe_name}.json"

            with open(html_path, "w", encoding="utf-8") as f:
                f.write(html_output)
            print(f"  [OK] HTML: {html_path}")

            with open(md_path, "w", encoding="utf-8") as f:
                f.write(md_output)
            print(f"  [OK] Markdown: {md_path}")

            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(json_output, f, ensure_ascii=False, indent=2)
            print(f"  [OK] JSON: {json_path}")

            results.append({
                "sfs": sfs,
                "success": True,
                "html_path": str(html_path),
                "md_path": str(md_path),
                "json_path": str(json_path),
                "html_length": len(html_output),
                "md_length": len(md_output),
            })

        except Exception as e:
            print(f"  [ERROR] {e}")
            results.append({
                "sfs": sfs,
                "success": False,
                "error": str(e),
            })

        print()

    # Save results summary
    results_path = OUTPUT_DIR / "results.json"
    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"Completed: {sum(1 for r in results if r['success'])}/{len(results)} successful")
    print(f"Results saved to: {results_path}")


if __name__ == "__main__":
    main()

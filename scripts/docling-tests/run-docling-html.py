#!/usr/bin/env python3
"""
Run Docling on LLM-generated HTML

Tests: HTML → Docling → JSON/MD
"""

import json
import os
import sys
from pathlib import Path

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["HF_HUB_ENABLE_SYMLINKS"] = "0"

from docling.document_converter import DocumentConverter

SCRIPT_DIR = Path(__file__).parent
EXISTING_HTML_DIR = SCRIPT_DIR / "output" / "existing-html"
OUTPUT_DIR = SCRIPT_DIR / "output" / "html-to-docling"

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Get HTML files
    html_files = list(EXISTING_HTML_DIR.glob("*.html"))
    print(f"Processing {len(html_files)} HTML files with Docling...\n")

    converter = DocumentConverter()

    for html_path in html_files:
        sfs = html_path.stem
        print(f"Processing {sfs}...")

        try:
            result = converter.convert(str(html_path))
            doc = result.document

            # Export
            md_output = doc.export_to_markdown()
            json_output = doc.export_to_dict()

            # Save
            md_path = OUTPUT_DIR / f"{sfs}.md"
            json_path = OUTPUT_DIR / f"{sfs}.json"

            with open(md_path, "w", encoding="utf-8") as f:
                f.write(md_output)
            print(f"  [OK] MD: {len(md_output)} chars")

            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(json_output, f, ensure_ascii=False, indent=2)
            print(f"  [OK] JSON: {len(json_output.get('texts', []))} text items")

            # Show structure preview
            labels = [t.get('label') for t in json_output.get('texts', [])]
            unique_labels = list(dict.fromkeys(labels))
            print(f"  Labels: {', '.join(unique_labels)}")

        except Exception as e:
            print(f"  [ERROR] {e}")

        print()

if __name__ == "__main__":
    main()

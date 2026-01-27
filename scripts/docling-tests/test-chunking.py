#!/usr/bin/env python3
"""
Test Docling's RAG chunking on LLM-generated HTML
"""

import json
import sys
import os
from pathlib import Path

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from docling.document_converter import DocumentConverter
from docling.chunking import HybridChunker

SCRIPT_DIR = Path(__file__).parent
HTML_FILE = SCRIPT_DIR / "output" / "existing-html" / "2025-491.html"
OUTPUT_DIR = SCRIPT_DIR / "output" / "chunks"

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Converting HTML with Docling...")
    converter = DocumentConverter()
    result = converter.convert(str(HTML_FILE))
    doc = result.document

    print(f"\nDocument: {doc.name}")
    print(f"Text items: {len(doc.texts)}")

    # Use HybridChunker
    print("\n" + "="*60)
    print("HYBRID CHUNKER OUTPUT")
    print("="*60)

    chunker = HybridChunker(
        tokenizer=None,  # Use default
        max_tokens=500,  # Reasonable chunk size for embeddings
    )

    chunks = list(chunker.chunk(doc))
    print(f"\nTotal chunks: {len(chunks)}")

    chunk_data = []

    for i, chunk in enumerate(chunks):
        print(f"\n--- Chunk {i+1} ---")
        print(f"Text ({len(chunk.text)} chars):")
        print(f"  {chunk.text[:200]}..." if len(chunk.text) > 200 else f"  {chunk.text}")

        # Check what metadata is available
        meta = chunk.meta if hasattr(chunk, 'meta') else {}

        print(f"\nMetadata:")
        if hasattr(meta, 'headings'):
            print(f"  Headings: {meta.headings}")
        if hasattr(meta, 'doc_items'):
            print(f"  Doc items: {len(meta.doc_items)} items")
        if hasattr(meta, 'origin'):
            print(f"  Origin: {meta.origin}")

        # Try to access all attributes
        print(f"\nAll meta attributes: {dir(meta)}")

        chunk_info = {
            "chunk_id": i,
            "text": chunk.text,
            "text_length": len(chunk.text),
        }

        # Extract available metadata
        if hasattr(meta, 'headings'):
            chunk_info["headings"] = meta.headings
        if hasattr(meta, 'doc_items'):
            chunk_info["doc_items_count"] = len(meta.doc_items)

        chunk_data.append(chunk_info)

    # Save chunks
    output_file = OUTPUT_DIR / "2025-491-chunks.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(chunk_data, f, ensure_ascii=False, indent=2)

    print(f"\n\nChunks saved to: {output_file}")

    # Summary
    print("\n" + "="*60)
    print("SUMMARY FOR RAG")
    print("="*60)
    print(f"Total chunks: {len(chunks)}")
    print(f"Avg chunk size: {sum(len(c.text) for c in chunks) // len(chunks)} chars")
    print(f"Min chunk: {min(len(c.text) for c in chunks)} chars")
    print(f"Max chunk: {max(len(c.text) for c in chunks)} chars")

if __name__ == "__main__":
    main()

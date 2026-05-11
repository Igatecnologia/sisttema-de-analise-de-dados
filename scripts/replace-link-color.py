#!/usr/bin/env python3
"""Substitui #1677ff → #1d4ed8 nos arquivos do front-end web."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "apps/web/src"

count = 0
for p in TARGET.rglob("*"):
    if p.suffix not in (".tsx", ".ts", ".css", ".jsx", ".js"): continue
    if "node_modules" in p.parts: continue
    try:
        src = p.read_text(encoding="utf-8")
    except Exception:
        continue
    new = src.replace("#1677ff", "#1d4ed8").replace("#1677FF", "#1D4ED8")
    if new != src:
        p.write_text(new, encoding="utf-8")
        n = src.lower().count("#1677ff")
        count += n
        print(f"  [{n}] {p.relative_to(ROOT)}")

print(f"\n{count} substituicoes.")

#!/usr/bin/env python3
"""
Codemod para migrar deprecations da antd v6:
  <Alert message=...>           -> <Alert title=...>
  <Modal ... destroyOnClose>    -> <Modal ... destroyOnHidden>
  <Drawer width=...>            -> <Drawer size=...>   (so quando width e prop direto, nao quando dentro de style={...})

Estrategia: percorre os arquivos .tsx, identifica o opening tag inteiro
(balanceando {} dentro dos atributos), e substitui SO dentro do escopo do tag.
Nao mexe em JS objects (notification.error({ message }), etc).
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = [ROOT / "apps/web/src", ROOT / "apps/admin"]
TAG_MAP = {
    "Alert": [("message", "title")],
    "Modal": [("destroyOnClose", "destroyOnHidden")],
    "Drawer": [("width", "size")],
}

def find_tag_end(text: str, start: int) -> int:
    """A partir do '<', encontra o '>' que fecha o opening tag, ignorando
    chaves balanceadas e strings."""
    i = start
    depth_curly = 0
    in_str_dq = False
    in_str_sq = False
    in_str_bt = False
    while i < len(text):
        ch = text[i]
        if in_str_dq:
            if ch == '"': in_str_dq = False
        elif in_str_sq:
            if ch == "'": in_str_sq = False
        elif in_str_bt:
            if ch == '`': in_str_bt = False
        elif depth_curly > 0:
            if ch == '{': depth_curly += 1
            elif ch == '}': depth_curly -= 1
            elif ch == '"': in_str_dq = True
            elif ch == "'": in_str_sq = True
            elif ch == '`': in_str_bt = True
        else:
            if ch == '"': in_str_dq = True
            elif ch == "'": in_str_sq = True
            elif ch == '`': in_str_bt = True
            elif ch == '{': depth_curly += 1
            elif ch == '>':
                return i
        i += 1
    return -1

def transform_file(path: Path) -> int:
    src = path.read_text(encoding="utf-8")
    changed = 0
    for tag, mappings in TAG_MAP.items():
        # `\b` evita match em <AlertX> ou <Modal2>
        pattern = re.compile(r"<" + re.escape(tag) + r"\b", re.MULTILINE)
        out = []
        cursor = 0
        for m in pattern.finditer(src):
            start = m.start()
            # Pre-tag bytes
            out.append(src[cursor:start])
            tag_end = find_tag_end(src, start)
            if tag_end == -1:
                out.append(src[start:])
                cursor = len(src)
                break
            block = src[start:tag_end + 1]
            new_block = block
            for old, new in mappings:
                # boolean prop (sem = depois)
                if tag == "Modal":
                    new_block, n = re.subn(
                        rf"\b{re.escape(old)}(?=[\s/}}>])(?!=)",
                        new,
                        new_block,
                    )
                    changed += n
                # prop com valor: word=
                new_block, n = re.subn(rf"\b{re.escape(old)}=", new + "=", new_block)
                changed += n
            out.append(new_block)
            cursor = tag_end + 1
        out.append(src[cursor:])
        src = "".join(out)
    if changed:
        path.write_text(src, encoding="utf-8")
    return changed

def main():
    total = 0
    files_changed = 0
    for root in TARGETS:
        for p in root.rglob("*.tsx"):
            if "node_modules" in p.parts: continue
            n = transform_file(p)
            if n:
                files_changed += 1
                total += n
                print(f"  [{n:2d}] {p.relative_to(ROOT)}")
    print(f"\n{total} replacements em {files_changed} arquivos.")

if __name__ == "__main__":
    main()

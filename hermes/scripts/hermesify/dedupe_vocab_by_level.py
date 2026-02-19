#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Set, Tuple

STRESS_RE = re.compile(r"\u0301")
LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]


@dataclass
class RowRef:
    level: str
    line_no: int
    key: str
    lemma: str
    row: Dict


def strip_stress(text: str) -> str:
    return STRESS_RE.sub("", text or "")


def normalize(text: str) -> str:
    return strip_stress(text).strip().lower()


def row_key(row: Dict) -> Tuple[str, str]:
    vocab_item = row.get("vocab_item") or {}
    lookup_form = normalize(str(vocab_item.get("lookup_form") or ""))
    base_form = normalize(str(vocab_item.get("base_form") or ""))
    pos = normalize(str(vocab_item.get("part_of_speech") or ""))
    lemma = lookup_form or base_form
    return lemma, pos


def load_jsonl(path: Path) -> List[Dict]:
    rows: List[Dict] = []
    with path.open("r", encoding="utf-8") as f:
        for idx, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"{path}:{idx}: invalid JSON ({exc})") from exc
            if not isinstance(row, dict):
                raise ValueError(f"{path}:{idx}: expected JSON object per line")
            rows.append(row)
    return rows


def write_jsonl(path: Path, rows: List[Dict]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def level_path(vocab_dir: Path, level: str) -> Path:
    return vocab_dir / f"{level}.jsonl"


def removed_path(vocab_dir: Path, override: str | None) -> Path:
    if override:
        return Path(override)
    return vocab_dir / "dedupe_removed.jsonl"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Deduplicate vocab across CEFR levels, keeping the first (lowest-level) occurrence."
    )
    parser.add_argument(
        "--vocab-dir",
        default="hermes/src/assets/packs/ru/vocab",
        help="Directory containing A1.jsonl ... C2.jsonl",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write deduplicated files in place. Without this flag, performs a dry run.",
    )
    parser.add_argument(
        "--show-samples",
        type=int,
        default=10,
        help="How many removed duplicate examples to print per level (default: 10).",
    )
    parser.add_argument(
        "--removed-out",
        default=None,
        help=(
            "Path to write removed rows as JSONL when --apply is used "
            "(default: <vocab-dir>/dedupe_removed.jsonl)."
        ),
    )
    args = parser.parse_args()

    vocab_dir = Path(args.vocab_dir)
    if not vocab_dir.exists():
        raise SystemExit(f"Directory not found: {vocab_dir}")

    loaded: Dict[str, List[Dict]] = {}
    for level in LEVELS:
        path = level_path(vocab_dir, level)
        if not path.exists():
            raise SystemExit(f"Missing level file: {path}")
        loaded[level] = load_jsonl(path)

    seen: Set[str] = set()
    first_seen_level: Dict[str, str] = {}
    kept: Dict[str, List[Dict]] = {}
    removed: Dict[str, List[RowRef]] = defaultdict(list)

    for level in LEVELS:
        kept[level] = []
        for idx, row in enumerate(loaded[level], start=1):
            lemma, pos = row_key(row)
            if not lemma:
                # Keep malformed rows untouched so no data is silently dropped.
                kept[level].append(row)
                continue
            key = f"{lemma}::{pos}"
            if key in seen:
                removed[level].append(
                    RowRef(
                        level=level,
                        line_no=idx,
                        key=key,
                        lemma=lemma,
                        row=row,
                    )
                )
                continue
            seen.add(key)
            first_seen_level[key] = level
            kept[level].append(row)

    total_before = sum(len(loaded[level]) for level in LEVELS)
    total_after = sum(len(kept[level]) for level in LEVELS)
    total_removed = total_before - total_after

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"[{mode}] dedupe by key = normalized(lookup_form|base_form) + part_of_speech")
    print(f"Total: {total_before} -> {total_after} (removed {total_removed})")
    print("")

    for level in LEVELS:
        before = len(loaded[level])
        after = len(kept[level])
        removed_count = before - after
        print(f"{level}: {before} -> {after} (removed {removed_count})")
        if removed_count and args.show_samples > 0:
            for ref in removed[level][: args.show_samples]:
                first_level = first_seen_level.get(ref.key, "?")
                print(
                    f"  - line {ref.line_no}: {ref.lemma} ({ref.key.split('::', 1)[1] or 'unspecified pos'}) "
                    f"already introduced in {first_level}"
                )
            if removed_count > args.show_samples:
                print(f"  ... and {removed_count - args.show_samples} more")
        print("")

    if args.apply:
        removed_out = removed_path(vocab_dir, args.removed_out)
        removed_rows: List[Dict] = []
        for level in LEVELS:
            for ref in removed[level]:
                removed_rows.append(
                    {
                        "level": ref.level,
                        "line_no": ref.line_no,
                        "key": ref.key,
                        "lemma": ref.lemma,
                        "first_seen_level": first_seen_level.get(ref.key),
                        "row": ref.row,
                    }
                )
        write_jsonl(removed_out, removed_rows)
        for level in LEVELS:
            write_jsonl(level_path(vocab_dir, level), kept[level])
        print(f"Removed rows written to: {removed_out}")
        print("Files updated in place.")
    else:
        print("Dry run only. Re-run with --apply to write changes.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

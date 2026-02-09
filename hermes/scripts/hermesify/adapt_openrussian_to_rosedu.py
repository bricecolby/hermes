#!/usr/bin/env python3
import argparse
import json


def adapt_entry(entry: dict) -> dict:
    """
    Convert OpenRussian JSONL entry into ROS-EDU-style entry:
    {"level": "...", "word": "...", "extra": "", "translation": "..."}
    """
    # OpenRussian uses "level" and "russian"
    level = (entry.get("level") or entry.get("cefr") or "").strip()
    word = (entry.get("russian") or entry.get("word") or "").strip()

    # translations may be a list
    translations = entry.get("translations") or []
    if isinstance(translations, list) and translations:
        translation = ", ".join([t.strip() for t in translations if isinstance(t, str) and t.strip()])
    else:
        translation = (entry.get("translation") or "").strip()

    return {
        "level": level,
        "word": word,
        "extra": "",        # keep ROS-EDU shape
        "translation": translation,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", "-i", required=True)
    ap.add_argument("--output", "-o", required=True)
    args = ap.parse_args()

    count = 0

    with open(args.input, "r", encoding="utf-8") as fin, open(args.output, "w", encoding="utf-8") as fout:
        for line_no, line in enumerate(fin, start=1):
            line = line.strip()
            if not line:
                continue

            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                print(f"[WARN] Skipping invalid JSON on line {line_no}", flush=True)
                continue

            adapted = adapt_entry(entry)

            # Optional sanity check: skip empty words
            if not adapted["word"]:
                print(f"[WARN] Empty word on line {line_no}; source keys: {list(entry.keys())}", flush=True)
                continue

            fout.write(json.dumps(adapted, ensure_ascii=False) + "\n")
            count += 1

    print(f"Converted {count} entries → {args.output}")


if __name__ == "__main__":
    main()

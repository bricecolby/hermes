#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from typing import Any, Dict, List, Optional, Tuple

try:
    import pymorphy2
except Exception:  # pragma: no cover
    pymorphy2 = None

STRESS_RE = re.compile(r"\u0301")

MORPH = pymorphy2.MorphAnalyzer() if pymorphy2 is not None else None


def strip_stress(text: str) -> str:
    return STRESS_RE.sub("", text or "")


def guess_pos_from_morph(p: Any) -> str:
    pos = (p.tag.POS or "").upper()
    if pos == "NOUN":
        return "noun"
    if pos in ("VERB", "INFN"):
        return "verb"
    if pos in ("ADJF", "ADJS"):
        return "adjective"
    if pos == "ADVB":
        return "adverb"
    if pos == "NPRO":
        return "pronoun"
    if pos == "NUMR":
        return "numeral"
    if pos == "PRCL":
        return "particle"
    if pos == "PREP":
        return "preposition"
    if pos == "CONJ":
        return "conjunction"
    if pos == "INTJ":
        return "interjection"
    return "other"


def aspect_from_tag(tag: Any) -> Optional[str]:
    if "perf" in tag:
        return "pf"
    if "impf" in tag:
        return "impf"
    return None


def case_map(oc_case: str) -> Optional[str]:
    return {
        "nomn": "nom",
        "gent": "gen",
        "datv": "dat",
        "accs": "acc",
        "ablt": "ins",
        "loct": "loc",
        "voct": "voc",
        "gen2": "gen2",
        "loc2": "loc2",
        "acc2": "acc2",
    }.get(oc_case)


def dedupe_forms(forms: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out: List[Dict[str, Any]] = []
    for f in forms:
        key = (
            f.get("surface_form"),
            f.get("tense"),
            f.get("mood"),
            f.get("person"),
            f.get("number"),
            f.get("gender"),
            f.get("case"),
            f.get("aspect"),
            f.get("degree"),
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(f)
    return out


def generate_forms(base_form_stressed: str) -> Tuple[str, str, List[Dict[str, Any]]]:
    lookup = strip_stress(base_form_stressed)

    if MORPH is None:
        return lookup, "other", [
            {
                "surface_form": lookup,
                "tense": None,
                "mood": None,
                "person": None,
                "number": None,
                "gender": None,
                "case": None,
                "aspect": None,
                "degree": None,
                "is_irregular": 0,
            }
        ]

    parses = MORPH.parse(lookup)
    if not parses:
        return lookup, "other", []

    p = parses[0]
    lemma = p.normal_form
    pos = guess_pos_from_morph(p)
    aspect = aspect_from_tag(p.tag)

    forms: List[Dict[str, Any]] = []

    def add(surface: str, **kwargs: Any) -> None:
        if not surface:
            return
        forms.append(
            {
                "surface_form": surface,
                "tense": kwargs.get("tense"),
                "mood": kwargs.get("mood"),
                "person": kwargs.get("person"),
                "number": kwargs.get("number"),
                "gender": kwargs.get("gender"),
                "case": kwargs.get("case"),
                "aspect": kwargs.get("aspect"),
                "degree": kwargs.get("degree"),
                "is_irregular": 0,
            }
        )

    add(lookup, tense=None, mood=None, person=None, number=None, gender=None, case=None, aspect=aspect, degree=None)

    if pos == "verb":
        base_parse = MORPH.parse(lemma)[0]
        add(lemma, tense=None, mood=None, person=None, number=None, gender=None, case=None, aspect=aspect, degree=None)

        for num_oc, num in [("sing", "sg"), ("plur", "pl")]:
            for per_oc, per in [("1per", 1), ("2per", 2), ("3per", 3)]:
                target = {num_oc, per_oc}
                wf = base_parse.inflect(target | {"pres"})
                tense = "pres"
                if wf is None:
                    wf = base_parse.inflect(target | {"futr"})
                    tense = "fut"
                if wf is not None:
                    add(
                        wf.word,
                        tense=tense,
                        mood="ind",
                        person=per,
                        number=num,
                        gender=None,
                        case=None,
                        aspect=aspect,
                        degree=None,
                    )

        for g_oc, g in [("masc", "m"), ("femn", "f"), ("neut", "n")]:
            wf = base_parse.inflect({"past", "sing", g_oc})
            if wf is not None:
                add(wf.word, tense="past", mood="ind", person=None, number="sg", gender=g, case=None, aspect=aspect, degree=None)
        wf = base_parse.inflect({"past", "plur"})
        if wf is not None:
            add(wf.word, tense="past", mood="ind", person=None, number="pl", gender=None, case=None, aspect=aspect, degree=None)

        for num_oc, num in [("sing", "sg"), ("plur", "pl")]:
            wf = base_parse.inflect({"impr", num_oc})
            if wf is not None:
                add(wf.word, tense=None, mood="imp", person=None, number=num, gender=None, case=None, aspect=aspect, degree=None)

        return lemma, pos, dedupe_forms(forms)

    if pos in ("noun", "proper_noun"):
        base_parse = MORPH.parse(lemma)[0]
        cases = ["nomn", "gent", "datv", "accs", "ablt", "loct", "voct", "gen2", "loc2", "acc2"]
        for num_oc, num in [("sing", "sg"), ("plur", "pl")]:
            for c in cases:
                wf = base_parse.inflect({num_oc, c})
                if wf is not None:
                    add(wf.word, tense=None, mood=None, person=None, number=num, gender=None, case=case_map(c), aspect=None, degree=None)
        return lemma, "noun", dedupe_forms(forms)

    if pos == "adjective":
        base_parse = MORPH.parse(lemma)[0]
        cases = ["nomn", "gent", "datv", "accs", "ablt", "loct"]
        genders = [("masc", "m"), ("femn", "f"), ("neut", "n")]

        for c in cases:
            for g_oc, g in genders:
                wf = base_parse.inflect({"sing", g_oc, c})
                if wf is not None:
                    add(wf.word, tense=None, mood=None, person=None, number="sg", gender=g, case=case_map(c), aspect=None, degree="pos")
            wf = base_parse.inflect({"plur", c})
            if wf is not None:
                add(wf.word, tense=None, mood=None, person=None, number="pl", gender=None, case=case_map(c), aspect=None, degree="pos")

        for g_oc, g in genders:
            wf = base_parse.inflect({"ADJS", "sing", g_oc})
            if wf is not None:
                add(wf.word, tense=None, mood=None, person=None, number="sg", gender=g, case=None, aspect=None, degree="pos")
        wf = base_parse.inflect({"ADJS", "plur"})
        if wf is not None:
            add(wf.word, tense=None, mood=None, person=None, number="pl", gender=None, case=None, aspect=None, degree="pos")

        return lemma, "adjective", dedupe_forms(forms)

    return lemma, pos, dedupe_forms(forms)


def should_backfill(entry: Dict[str, Any], only_missing: bool) -> bool:
    if not only_missing:
        return True
    forms = entry.get("forms")
    if not isinstance(forms, list) or len(forms) == 0:
        return True
    # treat single bare form as likely "not fully generated"
    return len(forms) <= 1


def main() -> None:
    ap = argparse.ArgumentParser(description="Backfill vocab forms in Hermes JSONL using pymorphy2.")
    ap.add_argument("--input", "-i", required=True, help="Input JSONL file")
    ap.add_argument("--output", "-o", default="", help="Output JSONL file (default: in-place input)")
    ap.add_argument("--in-place", action="store_true", help="Rewrite input file")
    ap.add_argument("--only-missing", action="store_true", help="Only update entries with missing/minimal forms")
    ap.add_argument("--keep-pos", action="store_true", help="Do not overwrite vocab_item.part_of_speech")
    args = ap.parse_args()

    if MORPH is None:
        raise SystemExit(
            "pymorphy2 is not installed in this environment. Install it first: pip install pymorphy2 pymorphy2-dicts-ru"
        )

    if not args.in_place and not args.output:
        raise SystemExit("Provide --output or use --in-place")

    out_path = args.input if args.in_place else args.output

    total = 0
    updated = 0
    skipped = 0

    with open(args.input, "r", encoding="utf-8") as fin, open(out_path, "w", encoding="utf-8") as fout:
        for line_no, line in enumerate(fin, start=1):
            s = line.strip()
            if not s:
                continue
            total += 1

            try:
                entry = json.loads(s)
            except json.JSONDecodeError:
                fout.write(line)
                skipped += 1
                continue

            if not isinstance(entry, dict):
                fout.write(json.dumps(entry, ensure_ascii=False) + "\n")
                skipped += 1
                continue

            if not should_backfill(entry, args.only_missing):
                fout.write(json.dumps(entry, ensure_ascii=False) + "\n")
                continue

            vocab_item = entry.get("vocab_item") if isinstance(entry.get("vocab_item"), dict) else None
            if not vocab_item:
                fout.write(json.dumps(entry, ensure_ascii=False) + "\n")
                skipped += 1
                continue

            base_form = (vocab_item.get("base_form") or vocab_item.get("lookup_form") or "").strip()
            if not base_form:
                fout.write(json.dumps(entry, ensure_ascii=False) + "\n")
                skipped += 1
                continue

            try:
                _, morph_pos, forms = generate_forms(base_form)
                entry["forms"] = forms
                if not args.keep_pos:
                    vocab_item["part_of_speech"] = morph_pos
                updated += 1
            except Exception:
                skipped += 1

            fout.write(json.dumps(entry, ensure_ascii=False) + "\n")

    print(f"[DONE] total={total} updated={updated} skipped={skipped} out={out_path}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

DEFAULT_MODEL = "qwen2.5:7b-instruct"
OLLAMA_TIMEOUT_SEC = 180
RETRY_JSON_REPAIRS = 2

SAVE_EVERY = 10  # checkpoint interval by grammar point index
EMOJI_RE = re.compile(r"[\U0001F300-\U0001FAFF\U00002700-\U000027BF]")


def is_empty_text(v: Any) -> bool:
    return v is None or (isinstance(v, str) and v.strip() == "")


def safe_str(v: Any) -> str:
    return v.strip() if isinstance(v, str) else ""


def strip_emoji(s: str) -> str:
    return EMOJI_RE.sub("", s).strip()


def call_ollama(model: str, prompt: str, timeout_sec: int = OLLAMA_TIMEOUT_SEC) -> str:
    try:
        p = subprocess.run(
            ["ollama", "run", model],
            input=prompt.encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout_sec,
        )
    except FileNotFoundError:
        raise RuntimeError("Could not find 'ollama' on PATH.")
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"Ollama timed out after {timeout_sec}s (model={model}).")

    out = p.stdout.decode("utf-8", errors="replace").strip()
    err = p.stderr.decode("utf-8", errors="replace").strip()

    if p.returncode != 0:
        raise RuntimeError(f"Ollama failed (code={p.returncode}): {err or out}")

    return out


def coerce_json_object(raw: str) -> Dict[str, Any]:
    try:
        obj = json.loads(raw)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass

    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        snippet = raw[start : end + 1]
        obj = json.loads(snippet)
        if isinstance(obj, dict):
            return obj

    raise ValueError("Could not parse a JSON object from LLM output.")


def repair_prompt(raw: str, include_example_notes: bool, include_summary: bool) -> str:
    shape_keys = ['"explanation"', '"usage_notes"']
    if include_summary:
        shape_keys.append('"summary"')
    if include_example_notes:
        shape_keys.append('"example_notes"')
    shape_hint = ", ".join(shape_keys)
    return f"""
The following output was supposed to be ONLY valid JSON, but it was invalid.

Fix it and return ONLY valid JSON (no extra text). The JSON must be a single object with keys:
{shape_hint}.

Bad output:
{raw}
""".strip()


def build_prompt(
    point: Dict[str, Any],
    section_titles: Dict[str, str],
    tag_descriptions: Dict[str, str],
    mode: str,
    include_example_notes: bool,
    include_summary: bool,
) -> str:
    title = safe_str(point.get("title")) or "N/A"
    slug = safe_str(point.get("slug")) or "N/A"
    summary = safe_str(point.get("summary")) or ""
    explanation = safe_str(point.get("explanation"))
    usage_notes = safe_str(point.get("usage_notes"))

    section_slugs = point.get("section_slugs") if isinstance(point.get("section_slugs"), list) else []
    tag_names = point.get("tag_names") if isinstance(point.get("tag_names"), list) else []

    section_lines: List[str] = []
    for s in section_slugs:
        if not isinstance(s, str):
            continue
        section_lines.append(f"- {s}: {section_titles.get(s, '')}".rstrip())
    sections_text = "\n".join(section_lines) if section_lines else "- (none)"

    tag_lines: List[str] = []
    for t in tag_names:
        if not isinstance(t, str):
            continue
        tag_lines.append(f"- {t}: {tag_descriptions.get(t, '')}".rstrip())
    tags_text = "\n".join(tag_lines) if tag_lines else "- (none)"

    example_lines: List[str] = []
    examples = point.get("examples") if isinstance(point.get("examples"), list) else []
    for ex in examples[:8]:
        if not isinstance(ex, dict):
            continue
        ru = safe_str(ex.get("example_text"))
        en = safe_str(ex.get("translation_text"))
        note = safe_str(ex.get("notes"))
        if ru or en:
            example_lines.append(f"- RU: {ru} | EN: {en} | NOTE: {note if note else 'null'}")
    examples_text = "\n".join(example_lines) if example_lines else "- (none)"

    wants_explanation = mode == "review" or is_empty_text(point.get("explanation"))
    wants_usage = mode == "review" or is_empty_text(point.get("usage_notes"))
    wants_summary = include_summary and (mode == "review" or is_empty_text(point.get("summary")))
    wants_example_notes = False
    if include_example_notes:
        for ex in examples:
            if not isinstance(ex, dict):
                continue
            if mode == "review" or is_empty_text(ex.get("notes")):
                wants_example_notes = True
                break

    wanted_fields = []
    if wants_explanation:
        wanted_fields.append("explanation")
    if wants_usage:
        wanted_fields.append("usage_notes")
    if wants_summary:
        wanted_fields.append("summary")
    if wants_example_notes:
        wanted_fields.append("example_notes")

    wanted = ", ".join(wanted_fields) if wanted_fields else "(none)"
    example_notes_shape = ""
    if include_example_notes:
        example_notes_shape = '\n    "example_notes": array|null'
    summary_shape = ""
    if include_summary:
        summary_shape = '\n    "summary": string|null,'
    usage_comma = "," if include_example_notes else ""
    mode_line = (
        "You are in REVIEW mode: improve and expand existing prose where needed for teaching quality and consistency."
        if mode == "review"
        else "You are in MISSING mode: fill only blank/null fields."
    )
    point_json = json.dumps(point, ensure_ascii=False, indent=2)

    return f"""
You are enriching a Russian A1 grammar learning dataset.
{mode_line}

GRAMMAR POINT:
- slug: {slug}
- title: {title}
- summary: {summary or "N/A"}

SECTIONS:
{sections_text}

TAGS:
{tags_text}

EXAMPLES:
{examples_text}

CURRENT FIELDS:
- explanation: {explanation if explanation else "null"}
- usage_notes: {usage_notes if usage_notes else "null"}

FULL POINT JSON (source of truth):
{point_json}

TASK:
Return improved fields for: {wanted}

OUTPUT RULES:
- Return ONLY valid JSON. No markdown fences. No commentary.
- Return exactly this object shape:
  {{
    {summary_shape}
    "explanation": string|null,
    "usage_notes": string|null{usage_comma}{example_notes_shape}
  }}
- In MISSING mode, return null for fields that are already present.
- In REVIEW mode, return refined/expanded text for explanation and usage_notes, even if currently populated.
- explanation must be instructive and practical for A1 learners, in English.
- explanation format must be plain text suitable for direct display in a React Native Text component.
- No emojis.
- Required explanation structure with clear section labels exactly:
  Pattern:
  Meaning:
  How to use:
  Edge cases:
- Use line breaks between sections and bullet-style lines starting with "- " where helpful.
- Keep explanation thorough enough for first exposure: target ~180-320 words.
- Cover common mistakes and at least one fringe/exception pattern if relevant at A1.
- usage_notes should be 1-4 short sentences with caveats/errata/register notes.
- If summary is requested, keep it concise (1 sentence, <= 24 words).
- example_notes (if requested): array with one item per example in input order.
  Each item can be a short string note or null. Keep notes brief and practical.
- Do not invent claims that are too specific or uncertain.

Now return the JSON object.
""".strip()


def normalize_fragment(
    obj: Dict[str, Any],
) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[List[Optional[str]]]]:
    explanation = obj.get("explanation")
    usage = obj.get("usage_notes")
    summary = obj.get("summary")
    example_notes = obj.get("example_notes")

    if explanation is not None and not isinstance(explanation, str):
        explanation = None
    if usage is not None and not isinstance(usage, str):
        usage = None
    if summary is not None and not isinstance(summary, str):
        summary = None
    if example_notes is not None and not isinstance(example_notes, list):
        example_notes = None

    exp = strip_emoji(explanation).strip() if isinstance(explanation, str) and explanation.strip() else None
    use = strip_emoji(usage).strip() if isinstance(usage, str) and usage.strip() else None
    summ = strip_emoji(summary).strip() if isinstance(summary, str) and summary.strip() else None
    notes_out: Optional[List[Optional[str]]] = None
    if isinstance(example_notes, list):
        cleaned: List[Optional[str]] = []
        for n in example_notes:
            if isinstance(n, str) and n.strip():
                cleaned.append(strip_emoji(n).strip())
            else:
                cleaned.append(None)
        notes_out = cleaned

    return exp, use, summ, notes_out


def save_json(path: str, data: Dict[str, Any]) -> None:
    out_dir = os.path.dirname(path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def load_resume_state(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        return {"next_index": 0}
    with open(path, "r", encoding="utf-8") as f:
        state = json.load(f)
    if not isinstance(state, dict):
        return {"next_index": 0}
    nxt = state.get("next_index")
    if not isinstance(nxt, int) or nxt < 0:
        nxt = 0
    return {"next_index": nxt}


def save_resume_state(path: str, next_index: int) -> None:
    state = {"next_index": next_index, "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    out_dir = os.path.dirname(path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main() -> None:
    ap = argparse.ArgumentParser(description="Enrich grammar pack JSON with LLM-generated explanation/usage notes.")
    ap.add_argument("--input", "-i", required=True, help="Input grammar pack JSON path")
    ap.add_argument("--output", "-o", default="", help="Output grammar pack JSON path (default: --input if --in-place)")
    ap.add_argument("--in-place", action="store_true", help="Write output back to input file")
    ap.add_argument("--model", default=DEFAULT_MODEL, help=f"Ollama model (default: {DEFAULT_MODEL})")
    ap.add_argument("--limit", type=int, default=0, help="Process at most N grammar points (0=all)")
    ap.add_argument(
        "--mode",
        choices=["review", "missing"],
        default="review",
        help="review: improve existing prose; missing: fill only empty fields.",
    )
    ap.add_argument("--sleep-ms", type=int, default=0, help="Sleep between LLM calls")
    ap.add_argument("--dry-run", action="store_true", help="Do not write output file")
    ap.add_argument("--resume", action="store_true", help="Resume from checkpoint state")
    ap.add_argument(
        "--resume-state",
        default="",
        help="Path for resume state json (default: <output>.resume.json)",
    )
    ap.add_argument(
        "--save-every",
        type=int,
        default=SAVE_EVERY,
        help=f"Checkpoint output every N processed points (default: {SAVE_EVERY})",
    )
    ap.add_argument(
        "--fill-example-notes",
        action="store_true",
        help="Also fill examples[].notes (review mode: improve all, missing mode: fill blanks only).",
    )
    ap.add_argument(
        "--rewrite-summary",
        action="store_true",
        help="Also allow LLM to rewrite summary for consistency/clarity.",
    )
    args = ap.parse_args()

    if not args.in_place and not args.output:
        ap.error("Provide --output or use --in-place")

    output_path = args.input if args.in_place else args.output

    with open(args.input, "r", encoding="utf-8") as f:
        pack = json.load(f)

    if not isinstance(pack, dict):
        raise RuntimeError("Input root must be a JSON object.")

    grammar_points = pack.get("grammar_points")
    if not isinstance(grammar_points, list):
        raise RuntimeError("Input must contain top-level 'grammar_points' array.")

    sections = pack.get("sections") if isinstance(pack.get("sections"), list) else []
    tags = pack.get("tags") if isinstance(pack.get("tags"), list) else []

    section_titles: Dict[str, str] = {}
    for s in sections:
        if not isinstance(s, dict):
            continue
        slug = safe_str(s.get("slug"))
        title = safe_str(s.get("title"))
        if slug:
            section_titles[slug] = title

    tag_descriptions: Dict[str, str] = {}
    for t in tags:
        if not isinstance(t, dict):
            continue
        name = safe_str(t.get("name"))
        desc = safe_str(t.get("description"))
        if name:
            tag_descriptions[name] = desc

    resume_state_path = args.resume_state
    if not resume_state_path:
        resume_state_path = f"{output_path}.resume.json"

    start_idx = 0
    if args.resume:
        state = load_resume_state(resume_state_path)
        start_idx = state["next_index"]
        print(f"[RESUME] starting at grammar_points[{start_idx}]", file=sys.stderr)

    processed = 0
    changed_points = 0
    llm_calls = 0
    failed_points = 0
    skipped_complete = 0

    total = len(grammar_points)
    end_exclusive = total
    if args.limit > 0:
        end_exclusive = min(total, start_idx + args.limit)

    for idx in range(start_idx, end_exclusive):
        point = grammar_points[idx]
        if not isinstance(point, dict):
            continue

        title = safe_str(point.get("title")) or f"point#{idx}"
        needs_explanation = args.mode == "review" or is_empty_text(point.get("explanation"))
        needs_usage = args.mode == "review" or is_empty_text(point.get("usage_notes"))
        needs_summary = args.rewrite_summary and (args.mode == "review" or is_empty_text(point.get("summary")))
        needs_example_notes = False
        if args.fill_example_notes:
            examples = point.get("examples") if isinstance(point.get("examples"), list) else []
            for ex in examples:
                if not isinstance(ex, dict):
                    continue
                if args.mode == "review" or is_empty_text(ex.get("notes")):
                    needs_example_notes = True
                    break

        if not (needs_explanation or needs_usage or needs_summary or needs_example_notes):
            skipped_complete += 1
            processed += 1
            if args.resume and processed % max(1, args.save_every) == 0:
                save_resume_state(resume_state_path, idx + 1)
            continue

        print(f"[{idx+1}/{total}] Enriching: {title}")

        prompt = build_prompt(
            point,
            section_titles,
            tag_descriptions,
            args.mode,
            args.fill_example_notes,
            args.rewrite_summary,
        )
        raw = ""

        try:
            raw = call_ollama(args.model, prompt)
            llm_calls += 1

            frag_obj = None
            last_err: Optional[Exception] = None

            for attempt in range(RETRY_JSON_REPAIRS + 1):
                try:
                    frag_obj = coerce_json_object(raw)
                    break
                except Exception as e:
                    last_err = e
                    if attempt < RETRY_JSON_REPAIRS:
                        raw = call_ollama(
                            args.model,
                            repair_prompt(raw, args.fill_example_notes, args.rewrite_summary),
                        )
                        llm_calls += 1

            if frag_obj is None:
                raise ValueError(f"JSON parse failed after retries: {last_err}")

            explanation, usage, summary, example_notes = normalize_fragment(frag_obj)

            point_updated = False
            if needs_explanation and explanation is not None and explanation != safe_str(point.get("explanation")):
                point["explanation"] = explanation
                point_updated = True
            if needs_usage and usage is not None and usage != safe_str(point.get("usage_notes")):
                point["usage_notes"] = usage
                point_updated = True
            if needs_summary and summary is not None and summary != safe_str(point.get("summary")):
                point["summary"] = summary
                point_updated = True
            if args.fill_example_notes and isinstance(example_notes, list):
                examples = point.get("examples") if isinstance(point.get("examples"), list) else []
                for i, ex in enumerate(examples):
                    if i >= len(example_notes):
                        break
                    if not isinstance(ex, dict):
                        continue
                    if example_notes[i] is None:
                        continue
                    should_write_note = args.mode == "review" or is_empty_text(ex.get("notes"))
                    if should_write_note and example_notes[i] != safe_str(ex.get("notes")):
                        ex["notes"] = example_notes[i]
                        point_updated = True

            if point_updated:
                changed_points += 1
                print("   ✓ updated")
            else:
                print("   ✓ no changes")

        except Exception as e:
            failed_points += 1
            print(f"[WARN] Failed to enrich '{title}': {e}", file=sys.stderr)

        processed += 1

        if args.sleep_ms > 0:
            time.sleep(args.sleep_ms / 1000.0)

        # checkpoint writes for long runs
        if not args.dry_run and args.save_every > 0 and processed % args.save_every == 0:
            save_json(output_path, pack)

        if args.resume and args.save_every > 0 and processed % args.save_every == 0:
            save_resume_state(resume_state_path, idx + 1)

    if args.resume:
        save_resume_state(resume_state_path, end_exclusive)

    print(f"[DONE] Grammar points total: {total}")
    print(f"[DONE] Processed this run: {processed}")
    print(f"[DONE] Changed points: {changed_points}")
    print(f"[DONE] Already complete (skipped): {skipped_complete}")
    print(f"[DONE] Failed points: {failed_points}")
    print(f"[DONE] LLM calls (incl repairs): {llm_calls}")

    if args.dry_run:
        print("[DRY RUN] No output written.")
        return

    save_json(output_path, pack)
    print(f"[DONE] Wrote: {output_path}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

DEFAULT_MODEL = "qwen2.5:7b-instruct"
OLLAMA_TIMEOUT_SEC = 180

MAX_EXAMPLES_REQUEST = 3
MAX_EXAMPLES_KEEP = 3
MAX_SENSES_PER_ENTRY = 50  # safety cap

RETRY_JSON_REPAIRS = 2

FLUSH_EVERY = 25  # flush output every N written entries


def is_empty_text(v: Any) -> bool:
    return v is None or (isinstance(v, str) and v.strip() == "")


def is_empty_examples(v: Any) -> bool:
    # examples expected: list[{"ru": "...", "en": "..."}]
    if v is None:
        return True
    if not isinstance(v, list):
        return True
    return len(v) == 0


def safe_get_str(d: Dict[str, Any], key: str) -> str:
    v = d.get(key)
    return v.strip() if isinstance(v, str) else ""


def call_ollama_json(model: str, prompt: str, timeout_sec: int = OLLAMA_TIMEOUT_SEC) -> str:
    """
    Calls `ollama run <model>` piping the prompt to stdin.
    Returns raw stdout.
    """
    try:
        p = subprocess.run(
            ["ollama", "run", model],
            input=prompt.encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout_sec,
        )
    except FileNotFoundError:
        raise RuntimeError("Could not find 'ollama' on PATH. Install Ollama or adjust invocation.")
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"Ollama timed out after {timeout_sec}s (model={model}).")

    out = p.stdout.decode("utf-8", errors="replace").strip()
    err = p.stderr.decode("utf-8", errors="replace").strip()

    if p.returncode != 0:
        raise RuntimeError(f"Ollama failed (code={p.returncode}): {err or out}")

    return out


def build_prompt(entry: Dict[str, Any], sense: Dict[str, Any]) -> str:
    vocab_item = entry.get("vocab_item") if isinstance(entry.get("vocab_item"), dict) else {}
    source = entry.get("source") if isinstance(entry.get("source"), dict) else {}

    base_form = safe_get_str(vocab_item, "base_form")
    lookup_form = safe_get_str(vocab_item, "lookup_form")
    pos = safe_get_str(vocab_item, "part_of_speech")

    # Sense fields (often English in your seed)
    definition = safe_get_str(sense, "definition")
    translation = safe_get_str(sense, "translation")

    seed_level = safe_get_str(source, "seed_level")
    seed_translation = safe_get_str(source, "seed_translation")

    # We only request the things that are missing
    wants_usage = is_empty_text(sense.get("usage_notes"))
    wants_grammar = is_empty_text(sense.get("grammar_hint"))
    wants_examples = is_empty_examples(sense.get("examples"))

    want_fields = []
    if wants_usage:
        want_fields.append("usage_notes")
    if wants_grammar:
        want_fields.append("grammar_hint")
    if wants_examples:
        want_fields.append("examples")

    want_fields_str = ", ".join(want_fields) if want_fields else "(none)"

    return f"""
You are enriching a Russian language-learning dataset entry.

WORD (Russian): {base_form or lookup_form or "N/A"}
LOOKUP FORM: {lookup_form or "N/A"}
PART OF SPEECH: {pos or "N/A"}
CEFR LEVEL: {seed_level or "N/A"}

SENSE (English definition / translation):
- definition: {definition or "N/A"}
- translation: {translation or seed_translation or "N/A"}

Your task:
Fill ONLY the missing fields for this sense: {want_fields_str}

Output rules:
- Return ONLY valid JSON (no markdown, no explanation).
- JSON must be an object with keys: "usage_notes", "grammar_hint", "examples".
- If a field is not needed or genuinely not applicable, set it to null (not "N/A").
- "usage_notes": 1–2 short sentences in English (or null).
- "grammar_hint": 1–2 short sentences in English about usage/grammar (or null).
- "examples": list of up to {MAX_EXAMPLES_REQUEST} items, each item is:
  {{ "ru": "...", "en": "..." }}
  Use natural everyday Russian; translations should be fluent English.
- Do not invent bizarre facts; keep it general and safe.

Now return the JSON object.
""".strip()


def coerce_json_object(raw: str) -> Dict[str, Any]:
    """
    Attempts to parse JSON object from model output.
    If model sometimes wraps in extra text, try to extract the first {...} block.
    """
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


def validate_fragment(obj: Dict[str, Any]) -> Tuple[Optional[str], Optional[str], List[Dict[str, str]]]:
    """
    Validates and normalizes the fragment.
    Returns (usage_notes, grammar_hint, examples_list)
    """
    usage = obj.get("usage_notes", None)
    grammar = obj.get("grammar_hint", None)
    examples = obj.get("examples", [])

    if usage is not None and not isinstance(usage, str):
        usage = None
    if grammar is not None and not isinstance(grammar, str):
        grammar = None

    if examples is None:
        examples = []
    if not isinstance(examples, list):
        examples = []

    cleaned: List[Dict[str, str]] = []
    for ex in examples[:MAX_EXAMPLES_KEEP]:
        if not isinstance(ex, dict):
            continue
        ru = ex.get("ru")
        en = ex.get("en")
        if isinstance(ru, str) and isinstance(en, str):
            ru_s = ru.strip()
            en_s = en.strip()
            if ru_s and en_s:
                cleaned.append({"ru": ru_s, "en": en_s})

    return (
        usage.strip() if isinstance(usage, str) and usage.strip() else None,
        grammar.strip() if isinstance(grammar, str) and grammar.strip() else None,
        cleaned,
    )


def needs_enrichment(sense: Dict[str, Any]) -> bool:
    return (
        is_empty_text(sense.get("usage_notes"))
        or is_empty_text(sense.get("grammar_hint"))
        or is_empty_examples(sense.get("examples"))
    )


def apply_fragment(
    sense: Dict[str, Any],
    usage: Optional[str],
    grammar: Optional[str],
    examples: List[Dict[str, str]],
) -> int:
    """
    Merge fragment into sense, but ONLY fill missing/empty fields.
    Returns number of fields updated.
    """
    updated = 0

    if is_empty_text(sense.get("usage_notes")) and usage is not None:
        sense["usage_notes"] = usage
        updated += 1

    if is_empty_text(sense.get("grammar_hint")) and grammar is not None:
        sense["grammar_hint"] = grammar
        updated += 1

    if is_empty_examples(sense.get("examples")) and len(examples) > 0:
        sense["examples"] = examples
        updated += 1

    return updated


def repair_prompt(raw: str) -> str:
    return f"""
The following output was supposed to be ONLY valid JSON, but it was invalid.

Fix it and return ONLY valid JSON (no extra text). The JSON must be a single object with keys:
"usage_notes", "grammar_hint", "examples".

Bad output:
{raw}
""".strip()


def count_existing_output_lines(output_path: str) -> int:
    """
    Counts valid JSONL lines already written in the output file.
    If output has a partially-written trailing line, it won't count as valid and resume will re-run it.
    """
    if not os.path.exists(output_path):
        return 0

    n = 0
    with open(output_path, "r", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s:
                continue
            try:
                json.loads(s)
                n += 1
            except Exception:
                # Stop at first invalid line; resume will rewrite from here onward
                break
    return n


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", "-i", required=True, help="Input JSONL file")
    ap.add_argument("--output", "-o", required=True, help="Output JSONL file")
    ap.add_argument("--model", default=DEFAULT_MODEL, help=f"Ollama model (default: {DEFAULT_MODEL})")
    ap.add_argument("--limit", type=int, default=0, help="Process at most N NEW entries (0 = no limit)")
    ap.add_argument("--sleep-ms", type=int, default=0, help="Sleep between LLM calls (ms)")
    ap.add_argument("--dry-run", action="store_true", help="Do not write output; just print stats")
    ap.add_argument("--max-senses", type=int, default=0, help="Cap senses processed per entry (0 = default safety cap)")
    ap.add_argument("--resume", action="store_true", help="Append to output and skip entries already written")
    ap.add_argument("--flush-every", type=int, default=FLUSH_EVERY, help=f"Flush output every N entries (default: {FLUSH_EVERY})")
    args = ap.parse_args()

    max_senses = args.max_senses if args.max_senses > 0 else MAX_SENSES_PER_ENTRY

    # Ensure output directory exists
    out_dir = os.path.dirname(args.output)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    # Resume handling
    already_done = 0
    out_mode = "w"
    if args.resume:
        already_done = count_existing_output_lines(args.output)
        out_mode = "a" if already_done > 0 else "w"
        print(f"[RESUME] Output has {already_done} valid lines; will skip that many input entries.", file=sys.stderr)

    total_entries_seen = 0          # total input lines processed/considered (excluding blank lines)
    total_entries_written = 0       # number of lines written in this run
    changed_entries = 0
    llm_calls = 0
    field_updates = 0
    skipped_senses = 0
    failed_senses = 0
    skipped_due_to_resume = 0

    # Open files once; stream output
    with open(args.input, "r", encoding="utf-8") as f_in:
        # If not dry-run, open output for streaming writes
        f_out = None
        if not args.dry_run:
            f_out = open(args.output, out_mode, encoding="utf-8")

        try:
            for line_no, line in enumerate(f_in, start=1):
                line = line.strip()
                if not line:
                    continue

                total_entries_seen += 1

                # Resume: skip entries already written
                if args.resume and total_entries_seen <= already_done:
                    skipped_due_to_resume += 1
                    continue

                # Limit applies to NEW entries processed in this run (post-resume)
                if args.limit and total_entries_written >= args.limit:
                    break

                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    print(f"[WARN] Invalid JSON at input line {line_no}; writing unchanged.", file=sys.stderr)
                    if not args.dry_run and f_out is not None:
                        f_out.write(line + "\n")
                        total_entries_written += 1
                    continue

                vocab_item = entry.get("vocab_item", {})
                word = vocab_item.get("base_form") or vocab_item.get("lookup_form") or "UNKNOWN"

                print(f"[{total_entries_seen}] Working on: {word}")

                senses = entry.get("senses")
                if not isinstance(senses, list) or len(senses) == 0:
                    if not args.dry_run and f_out is not None:
                        f_out.write(json.dumps(entry, ensure_ascii=False) + "\n")
                        total_entries_written += 1
                    print(f"   ✓ Finished {word} (no senses)")
                    continue

                entry_updated = False

                for s_idx, sense in enumerate(senses[:max_senses]):
                    if not isinstance(sense, dict):
                        continue

                    if not needs_enrichment(sense):
                        skipped_senses += 1
                        continue

                    print(f"   → Sense {s_idx+1}: requesting LLM enrichment...")

                    prompt = build_prompt(entry, sense)

                    raw = ""
                    try:
                        raw = call_ollama_json(args.model, prompt)
                        llm_calls += 1

                        frag_obj = None
                        last_err = None
                        for attempt in range(RETRY_JSON_REPAIRS + 1):
                            try:
                                frag_obj = coerce_json_object(raw)
                                break
                            except Exception as e:
                                last_err = e
                                if attempt < RETRY_JSON_REPAIRS:
                                    raw = call_ollama_json(args.model, repair_prompt(raw))
                                    llm_calls += 1

                        if frag_obj is None:
                            raise ValueError(f"JSON parse failed after retries: {last_err}")

                        usage, grammar, examples = validate_fragment(frag_obj)
                        updates = apply_fragment(sense, usage, grammar, examples)

                        if updates > 0:
                            field_updates += updates
                            entry_updated = True

                    except Exception as e:
                        failed_senses += 1
                        print(f"[WARN] Enrichment failed for {word} sense#{s_idx+1}: {e}", file=sys.stderr)

                    if args.sleep_ms:
                        time.sleep(args.sleep_ms / 1000.0)

                if entry_updated:
                    changed_entries += 1
                    print(f"   ✓ Finished {word} (updated)")
                else:
                    print(f"   ✓ Finished {word} (no changes)")

                # Stream write the updated entry immediately
                if not args.dry_run and f_out is not None:
                    f_out.write(json.dumps(entry, ensure_ascii=False) + "\n")
                    total_entries_written += 1

                    if args.flush_every > 0 and (total_entries_written % args.flush_every == 0):
                        f_out.flush()
                        try:
                            os.fsync(f_out.fileno())
                        except OSError:
                            # Some environments/filesystems don't support fsync; flush is still helpful
                            pass

        finally:
            if f_out is not None:
                f_out.flush()
                f_out.close()

    print(f"[DONE] Input entries seen (non-blank): {total_entries_seen}")
    if args.resume:
        print(f"[DONE] Skipped due to resume: {skipped_due_to_resume}")
    print(f"[DONE] Output entries written this run: {total_entries_written}")
    print(f"[DONE] Entries changed this run: {changed_entries}")
    print(f"[DONE] LLM calls (incl repairs): {llm_calls}")
    print(f"[DONE] Field updates applied: {field_updates}")
    print(f"[DONE] Senses skipped (already complete): {skipped_senses}")
    print(f"[DONE] Senses failed: {failed_senses}")

    if args.dry_run:
        print("[DRY RUN] Not writing output.")
    else:
        print(f"[DONE] Wrote/updated: {args.output}")


if __name__ == "__main__":
    main()

import argparse
import hashlib
import json
import os
import re
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup

try:
    import pymorphy2
except Exception:  # pragma: no cover
    pymorphy2 = None

STRESS_RE = re.compile(r"\u0301")  # combining acute accent

# ----------------------------
# Helpers
# ----------------------------

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def strip_stress(text: str) -> str:
    return STRESS_RE.sub("", text)

def norm_ws(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())

def stable_key(language_id: int, base_form: str) -> str:
    # base_form includes stress; use it as identity so display stays consistent
    raw = f"{language_id}::{base_form}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:24]

# ----------------------------
# Wiktionary extraction (lightweight)
# ----------------------------

@dataclass
class WikiSense:
    definition: str
    examples_ru: List[str]
    examples_en: List[str]

WIKTIONARY_API = "https://en.wiktionary.org/w/api.php"
USER_AGENT = "HermesLangPackBot/0.2"

# Global throttle for Wikimedia API requests (shared across threads)
_wiki_lock = threading.Lock()
_wiki_last_request_at = 0.0

_thread_local = threading.local()

def thread_session() -> requests.Session:
    """One requests.Session per worker thread for connection reuse."""
    sess = getattr(_thread_local, "session", None)
    if sess is None:
        sess = requests.Session()
        setattr(_thread_local, "session", sess)
    return sess

def _wiki_throttle(min_interval_s: float) -> None:
    global _wiki_last_request_at
    if min_interval_s <= 0:
        return
    with _wiki_lock:
        now = time.time()
        wait = (_wiki_last_request_at + min_interval_s) - now
        if wait > 0:
            time.sleep(wait)
        _wiki_last_request_at = time.time()

def fetch_wiktionary_html_via_api(
    session: requests.Session,
    title: str,
    timeout_s: int = 25,
    retries: int = 3,
    backoff_s: float = 0.8,
    min_interval_s: float = 0.15,
) -> str:
    """Fetch *parsed content HTML only* via MediaWiki API (faster than full page HTML)."""
    params = {
        "action": "parse",
        "format": "json",
        "formatversion": 2,
        "page": title,
        "prop": "text|revid",
        "redirects": 1,
    }

    last_err = None
    for attempt in range(retries + 1):
        try:
            _wiki_throttle(min_interval_s)
            resp = session.get(
                WIKTIONARY_API,
                params=params,
                timeout=timeout_s,
                headers={"User-Agent": USER_AGENT},
            )
            resp.raise_for_status()
            data = resp.json()
            if "error" in data:
                raise RuntimeError(data["error"].get("info") or "Wiktionary API error")
            parse = data.get("parse")
            if not parse or not isinstance(parse, dict):
                raise RuntimeError("Missing parse payload")
            html = parse.get("text")
            if not html:
                raise RuntimeError("Empty Wiktionary parse text")
            return html
        except Exception as e:
            last_err = e
            if attempt >= retries:
                break
            time.sleep(backoff_s * (2 ** attempt))

    raise last_err  # type: ignore[misc]

def extract_russian_section_senses(html: str) -> Tuple[Optional[str], List[WikiSense]]:
    """
    Extract senses for Russian section, best-effort:
    - Find heading with id="Russian"
    - Within that section, find first POS subsection and pull the first few definitions
    """
    soup = BeautifulSoup(html, "html.parser")
    # API "parse" returns just the page content; prefer mw-parser-output.
    content = soup.select_one(".mw-parser-output") or soup.select_one("#mw-content-text") or soup
    if not content:
        return None, []

    # Find the Russian language header
    ru_head = content.select_one('span.mw-headline#Russian')
    if not ru_head:
        return None, []

    # Walk forward collecting nodes until next h2
    senses: List[WikiSense] = []
    wik_pos = None

    h2 = ru_head.find_parent(["h2"])
    if not h2:
        return None, []

    node = h2
    while True:
        node = node.find_next_sibling()
        if node is None:
            break
        if node.name == "h2":
            break  # next language

        # POS headers in Wiktionary are often h3/h4 with mw-headline
        if node.name in ("h3", "h4"):
            headline = node.select_one("span.mw-headline")
            if headline:
                title = headline.get_text(strip=True).lower()
                # A rough POS guess
                if title in ("noun", "verb", "adjective", "adverb", "pronoun", "proper noun"):
                    wik_pos = title.replace(" ", "_")
                # Keep scanning; definitions usually under this

        # Definitions often in <ol><li>...
        if node.name == "ol":
            for li in node.select("> li"):
                # definition text: remove nested lists
                li_clone = BeautifulSoup(str(li), "html.parser")
                for sub in li_clone.select("ol, ul"):
                    sub.decompose()
                def_text = norm_ws(li_clone.get_text(" ", strip=True))
                if not def_text:
                    continue

                # Examples often in <dl><dd> or <ul class="...">
                examples_ru: List[str] = []
                examples_en: List[str] = []

                # Try: following sibling dl
                dl = li.find_next_sibling("dl")
                if dl:
                    dds = dl.select("dd")
                    for dd in dds[:3]:
                        ex = norm_ws(dd.get_text(" ", strip=True))
                        if ex:
                            examples_ru.append(ex)

                senses.append(WikiSense(definition=def_text, examples_ru=examples_ru, examples_en=examples_en))

            # stop after first definition list to avoid huge pulls
            if senses:
                break

    return wik_pos, senses

# ----------------------------
# pymorphy2 → Hermes form generation
# ----------------------------

MORPH = pymorphy2.MorphAnalyzer() if pymorphy2 is not None else None

def guess_pos_from_morph(p: Any) -> str:
    # Map OpenCorpora POS to Hermes POS
    pos = (p.tag.POS or "").upper()
    if pos == "NOUN":
        return "noun"
    if pos == "VERB" or pos == "INFN":
        return "verb"
    if pos == "ADJF" or pos == "ADJS":
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

def aspect_from_tag(tag) -> Optional[str]:
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

def number_map(oc_num: str) -> Optional[str]:
    return {"sing": "sg", "plur": "pl"}.get(oc_num)

def gender_map(oc_g: str) -> Optional[str]:
    return {"masc": "m", "femn": "f", "neut": "n"}.get(oc_g)

def generate_forms(base_form_stressed: str) -> Tuple[str, str, List[Dict[str, Any]]]:
    """
    Returns: (lemma_unstressed, pos, forms[])
    forms[] entries match Hermes vocab_forms schema fields.
    """
    lookup = strip_stress(base_form_stressed)

    # If pymorphy2 is unavailable, still emit a minimal form row so the pipeline can run.
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
    lemma = p.normal_form  # unstressed lemma
    pos = guess_pos_from_morph(p)
    aspect = aspect_from_tag(p.tag)

    forms: List[Dict[str, Any]] = []

    def add(surface: str, **kwargs):
        if not surface:
            return
        forms.append({
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
        })

    # Always include lemma / base-ish form as a form row too (useful for display)
    add(lookup, tense=None, mood=None, person=None, number=None, gender=None, case=None, aspect=aspect, degree=None)

    # VERBS
    if pos == "verb":
        base_parse = MORPH.parse(lemma)[0]

        # infinitive
        add(lemma, tense=None, mood=None, person=None, number=None, gender=None, case=None, aspect=aspect, degree=None)

        # Present tense (imperfective) or Simple Future (perfective)
        # pymorphy uses "pres" and "futr" tags for finite forms
        for num_oc, num in [("sing", "sg"), ("plur", "pl")]:
            for per_oc, per in [("1per", 1), ("2per", 2), ("3per", 3)]:
                target = {num_oc, per_oc}
                # prefer pres, fallback futr
                wf = base_parse.inflect(target | {"pres"})
                tense = "pres"
                if wf is None:
                    wf = base_parse.inflect(target | {"futr"})
                    tense = "fut"
                if wf is not None:
                    add(wf.word, tense=tense, mood="ind", person=per, number=num, gender=None, case=None, aspect=aspect, degree=None)

        # Past tense
        for g_oc, g in [("masc", "m"), ("femn", "f"), ("neut", "n")]:
            wf = base_parse.inflect({"past", "sing", g_oc})
            if wf is not None:
                add(wf.word, tense="past", mood="ind", person=None, number="sg", gender=g, case=None, aspect=aspect, degree=None)
        wf = base_parse.inflect({"past", "plur"})
        if wf is not None:
            add(wf.word, tense="past", mood="ind", person=None, number="pl", gender=None, case=None, aspect=aspect, degree=None)

        # Imperative
        for num_oc, num in [("sing", "sg"), ("plur", "pl")]:
            wf = base_parse.inflect({"impr", num_oc})
            if wf is not None:
                add(wf.word, tense=None, mood="imp", person=None, number=num, gender=None, case=None, aspect=aspect, degree=None)

        # Participles / gerunds (optional but part of “full paradigm”)
        # Best-effort; many words won't have all of these.
        # Pymorphy tags: PRTF (full participle), PRTS (short), GRND (gerund)
        for tag in ["PRTF", "PRTS", "GRND"]:
            # Try to “inflect” by requesting the POS; pymorphy2 doesn't always support direct POS switching.
            # We do a fallback by scanning dictionary forms of the lemma parse.
            # This stays best-effort; skip if not found.
            pass  # keep as a future enhancement if you want these explicitly

        return lemma, pos, dedupe_forms(forms)

    # NOUNS
    if pos == "noun" or pos == "proper_noun":
        base_parse = MORPH.parse(lemma)[0]
        cases = ["nomn", "gent", "datv", "accs", "ablt", "loct", "voct", "gen2", "loc2", "acc2"]
        for num_oc, num in [("sing", "sg"), ("plur", "pl")]:
            for c in cases:
                wf = base_parse.inflect({num_oc, c})
                if wf is not None:
                    add(wf.word, tense=None, mood=None, person=None, number=num, gender=None, case=case_map(c), aspect=None, degree=None)
        return lemma, "noun", dedupe_forms(forms)

    # ADJECTIVES
    if pos == "adjective":
        base_parse = MORPH.parse(lemma)[0]
        cases = ["nomn", "gent", "datv", "accs", "ablt", "loct"]
        genders = [("masc", "m"), ("femn", "f"), ("neut", "n")]

        # long forms: gendered singular + plural
        for c in cases:
            for g_oc, g in genders:
                wf = base_parse.inflect({"sing", g_oc, c})
                if wf is not None:
                    add(wf.word, tense=None, mood=None, person=None, number="sg", gender=g, case=case_map(c), aspect=None, degree="pos")
            wf = base_parse.inflect({"plur", c})
            if wf is not None:
                add(wf.word, tense=None, mood=None, person=None, number="pl", gender=None, case=case_map(c), aspect=None, degree="pos")

        # short forms
        for g_oc, g in genders:
            wf = base_parse.inflect({"ADJS", "sing", g_oc})
            if wf is not None:
                add(wf.word, tense=None, mood=None, person=None, number="sg", gender=g, case=None, aspect=None, degree="pos")
        wf = base_parse.inflect({"ADJS", "plur"})
        if wf is not None:
            add(wf.word, tense=None, mood=None, person=None, number="pl", gender=None, case=None, aspect=None, degree="pos")

        return lemma, "adjective", dedupe_forms(forms)

    return lemma, pos, dedupe_forms(forms)

def dedupe_forms(forms: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out = []
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

# ----------------------------
# Ollama helpers
# ----------------------------

def ollama_chat(model: str, messages: List[Dict[str, str]], timeout_s: int = 90) -> str:
    """
    Calls local Ollama chat endpoint.
    """
    url = "http://localhost:11434/api/chat"
    payload = {"model": model, "messages": messages, "stream": False}
    resp = requests.post(url, json=payload, timeout=timeout_s)
    resp.raise_for_status()
    data = resp.json()
    return data["message"]["content"]

def llm_enrich(
    model: str,
    base_form_stressed: str,
    lookup_form: str,
    pos: str,
    wik_senses: List[WikiSense],
    seed_translations: List[str],
    seed_extra_ru: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Ask LLM for:
    - usage notes
    - grammar hint
    - tags
    - 2 examples per sense (RU + EN)
    Return JSON dict.
    """
    senses_payload = []
    for i, s in enumerate(wik_senses[:6], start=1):
        senses_payload.append({
            "sense_index": i,
            "definition": s.definition,
            "examples_ru": s.examples_ru[:2],
        })

    system = (
        "You are helping build a language-learning app lexicon.\n"
        "Return ONLY valid JSON. No markdown.\n"
        "English explanations. Russian example sentences.\n"
        "Keep the lemma exactly as provided (including stress marks if present).\n"
        "Do not invent morphology; only provide notes/tags/examples.\n"
    )
    user = {
        "lemma_stressed": base_form_stressed,
        "lookup_form": lookup_form,
        "part_of_speech": pos,
        "seed_translations": seed_translations[:5],
        "seed_extra_ru": seed_extra_ru,
        "wiktionary_senses": senses_payload,
        "task": {
            "usage_notes": "Short learner-friendly notes (English).",
            "grammar_hint": "Short grammar hint (English).",
            "tags": "List 0-5 tags, lowercase, single words if possible.",
            "examples": "Provide 2 examples per sense. Russian + English translation. Keep them short and natural."
        },
        "required_output_schema": {
            "usage_notes": "string|null",
            "grammar_hint": "string|null",
            "tags": ["string"],
            "senses": [
                {
                    "sense_index": "int",
                    "usage_notes": "string|null",
                    "grammar_hint": "string|null",
                    "examples": [
                        {"ru": "string", "en": "string"}
                    ]
                }
            ]
        }
    }

    text = ollama_chat(model, messages=[
        {"role": "system", "content": system},
        {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
    ])

    # Best-effort JSON parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # salvage: find first {...} block
        m = re.search(r"\{.*\}", text, flags=re.S)
        if not m:
            return {}
        try:
            return json.loads(m.group(0))
        except Exception:
            return {}

# ----------------------------
# Main pipeline
# ----------------------------

def load_jsonl(path: str):
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)

def save_progress(path: str, done_keys: set):
    out_dir = os.path.dirname(path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"done_keys": sorted(done_keys)}, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)

def load_progress(path: str) -> set:
    if not os.path.exists(path):
        return set()
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return set(data.get("done_keys", []))


def _process_one_row(
    row: Dict[str, Any],
    language_id: int,
    ollama_model: str,
    no_llm: bool,
    wiki_timeout_s: int,
    wiki_retries: int,
    wiki_backoff_s: float,
    wiki_min_interval_s: float,
    llm_semaphore: threading.Semaphore,
) -> Tuple[str, Dict[str, Any]]:
    """Build one Hermes JSON object for a source row. Raises on fatal errors."""

    # Expected input JSONL (ros-edu): {"level":"A1","word":"а́дрес","translation":"address",...}
    base_form = (row.get("word") or "").strip()  # KEEP STRESS
    if not base_form:
        raise ValueError("missing word")

    translation_text = (row.get("translation") or "").strip()
    if not translation_text:
        raise ValueError("missing translation")

    level = (row.get("level") or "").strip().upper() or None
    seed_extra_ru = (row.get("extra") or "").strip() or None

    key = stable_key(language_id, base_form)

    # rank is optional in ros-edu export
    freq_rank = row.get("rank") or row.get("frequency_rank")

    # split translation into a list for downstream logic
    if ";" in translation_text:
        translations = [p.strip() for p in translation_text.split(";") if p.strip()]
    elif "," in translation_text:
        translations = [p.strip() for p in translation_text.split(",") if p.strip()]
    else:
        translations = [translation_text]

    created = now_iso()
    lookup_form = strip_stress(base_form)

    # Fetch Wiktionary content HTML via MediaWiki API (faster + smaller than full page)
    wik_pos = None
    wik_senses: List[WikiSense] = []
    try:
        sess = thread_session()
        html = fetch_wiktionary_html_via_api(
            sess,
            title=lookup_form,
            timeout_s=wiki_timeout_s,
            retries=wiki_retries,
            backoff_s=wiki_backoff_s,
            min_interval_s=wiki_min_interval_s,
        )
        wik_pos, wik_senses = extract_russian_section_senses(html)
    except Exception:
        wik_pos, wik_senses = None, []

    # pymorphy2 forms + POS guess
    _, morph_pos, forms = generate_forms(base_form)

    # Choose POS priority: wiktionary > morph
    pos = (wik_pos or morph_pos or "other")
    if pos == "proper_noun":
        pos = "proper_noun"

    # LLM enrichment (bounded concurrency via semaphore)
    enrich: Dict[str, Any] = {}
    if not no_llm:
        with llm_semaphore:
            enrich = llm_enrich(
                model=ollama_model,
                base_form_stressed=base_form,
                lookup_form=lookup_form,
                pos=pos,
                wik_senses=wik_senses,
                seed_translations=translations,
                seed_extra_ru=seed_extra_ru,
            ) or {}

    item_usage = norm_ws(enrich.get("usage_notes")) if isinstance(enrich, dict) else None
    item_ghint = norm_ws(enrich.get("grammar_hint")) if isinstance(enrich, dict) else None
    tag_names: List[str] = []
    if isinstance(enrich, dict) and isinstance(enrich.get("tags"), list):
        tag_names = [norm_ws(t).lower() for t in enrich["tags"] if norm_ws(t)]

    if level:
        tag_names.append(f"cefr_{level.lower()}")
    tag_names = sorted(set([t for t in tag_names if t]))

    # Build senses (prefer wiktionary definitions; fallback to seed translations)
    senses_out = []
    if wik_senses:
        for i, s in enumerate(wik_senses[:8], start=1):
            s_usage = None
            s_hint = None
            s_examples = []

            if isinstance(enrich, dict) and isinstance(enrich.get("senses"), list):
                match = next((x for x in enrich["senses"] if x.get("sense_index") == i), None)
                if match:
                    s_usage = norm_ws(match.get("usage_notes")) or None
                    s_hint = norm_ws(match.get("grammar_hint")) or None
                    exs = match.get("examples") or []
                    for ex in exs[:2]:
                        ru = norm_ws((ex or {}).get("ru"))
                        en = norm_ws((ex or {}).get("en"))
                        if ru and en:
                            s_examples.append({"example_text": ru, "translation_text": en})

            if not s_examples and s.examples_ru:
                for ru in s.examples_ru[:2]:
                    s_examples.append({"example_text": ru, "translation_text": None})

            senses_out.append({
                "sense_index": i,
                "definition": s.definition,
                "translation": translations[0] if translations else None,
                "usage_notes": s_usage,
                "grammar_hint": s_hint or item_ghint,
                "examples": s_examples,
            })
    else:
        senses_out.append({
            "sense_index": 1,
            "definition": translations[0] if translations else None,
            "translation": translations[0] if translations else None,
            "usage_notes": None,
            "grammar_hint": item_ghint,
            "examples": [],
        })

    wiki_url = f"https://en.wiktionary.org/wiki/{quote(lookup_form)}"

    hermes = {
        "source": {
            "input_source": row.get("source") or "scraped",
            "wiktionary_url": wiki_url,
            "fetched_at": created,
            "seed_level": level,
            "seed_translation": translation_text,
            "seed_extra_ru": seed_extra_ru,
        },
        "vocab_item": {
            "language_id": language_id,
            "base_form": base_form,
            "lookup_form": lookup_form,
            "part_of_speech": pos,
            "frequency_rank": freq_rank,
            "frequency_band": row.get("frequency_band"),
            "usage_notes": item_usage,
            "created_at": created,
            "updated_at": created,
        },
        "senses": senses_out,
        "forms": forms,
        "tags": [{"name": t, "description": None} for t in tag_names],
    }

    return key, hermes

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="Input scraped vocab JSONL")
    ap.add_argument("--out", required=True, help="Output Hermes JSONL")
    ap.add_argument("--progress", default="progress.json", help="Progress file")
    ap.add_argument("--language-id", type=int, default=1)
    ap.add_argument("--ollama-model", default="gemma3:4b")
    ap.add_argument("--sleep", type=float, default=0.0, help="Extra sleep after each completed item")
    ap.add_argument("--no-llm", action="store_true")
    ap.add_argument("--workers", type=int, default=8, help="Parallel worker threads (network-bound)")
    ap.add_argument("--max-inflight", type=int, default=32, help="Max queued tasks awaiting completion")
    ap.add_argument("--llm-workers", type=int, default=1, help="Max concurrent LLM calls")
    ap.add_argument("--wiki-timeout", type=int, default=25)
    ap.add_argument("--wiki-retries", type=int, default=2)
    ap.add_argument("--wiki-backoff", type=float, default=0.8)
    ap.add_argument("--wiki-min-interval", type=float, default=0.12, help="Min seconds between Wikimedia API requests")
    args = ap.parse_args()

    done = load_progress(args.progress)

    out_dir = os.path.dirname(args.out)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)

    llm_sem = threading.Semaphore(max(1, args.llm_workers))

    out_f = open(args.out, "a", encoding="utf-8")
    try:
        def should_skip(r: Dict[str, Any]) -> Optional[str]:
            base_form = (r.get("word") or "").strip()
            if not base_form:
                return ""
            return stable_key(args.language_id, base_form)

        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as ex:
            inflight = {}

            def submit(r: Dict[str, Any]) -> None:
                k = should_skip(r)
                if not k or k in done:
                    return
                fut = ex.submit(
                    _process_one_row,
                    r,
                    args.language_id,
                    args.ollama_model,
                    args.no_llm,
                    args.wiki_timeout,
                    args.wiki_retries,
                    args.wiki_backoff,
                    args.wiki_min_interval,
                    llm_sem,
                )
                inflight[fut] = k

            rows_iter = load_jsonl(args.input)

            # Prime the queue
            for _ in range(max(1, args.max_inflight)):
                try:
                    submit(next(rows_iter))
                except StopIteration:
                    break

            processed_since_save = 0
            while inflight:
                # Process one completed future, then submit one more
                for fut in as_completed(list(inflight.keys()), timeout=None):
                    inflight.pop(fut, None)
                    try:
                        key, hermes = fut.result()
                    except Exception:
                        # Skip failures; you can add logging here if you want
                        key, hermes = None, None  # type: ignore[assignment]

                    if key and hermes:
                        out_f.write(json.dumps(hermes, ensure_ascii=False) + "\n")
                        out_f.flush()
                        done.add(key)
                        processed_since_save += 1
                        if processed_since_save >= 50:
                            save_progress(args.progress, done)
                            processed_since_save = 0
                        if args.sleep and args.sleep > 0:
                            time.sleep(args.sleep)

                    try:
                        submit(next(rows_iter))
                    except StopIteration:
                        pass
                    break

    finally:
        save_progress(args.progress, done)
        out_f.close()

if __name__ == "__main__":
    main()

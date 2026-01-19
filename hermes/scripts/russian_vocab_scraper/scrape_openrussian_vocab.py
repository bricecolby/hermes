#!/usr/bin/env python3
import argparse
import csv
import json
import re
import time
from dataclasses import dataclass, asdict
from typing import List, Optional, Tuple

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError


BASE_URL = "https://en.openrussian.org"


@dataclass
class VocabRow:
    source: str                 # "openrussian"
    level: str                  # "C1" | "C2"
    rank: int                   # 1..N
    russian: str                # "удиви́тельный"
    translations: List[str]     # ["amazing", "surprising"]
    detail_path: Optional[str]  # "/ru/...."
    page_url: str               # full url of the page where this row came from


def _accept_cookies_if_present(page) -> None:
    # Some sites show a consent banner sometimes; safe to try.
    try:
        btn = page.get_by_text("Accept", exact=False)
        if btn.count() > 0:
            btn.first.click(timeout=1500)
            return
    except Exception:
        pass

    try:
        btn = page.get_by_text("Принять", exact=False)
        if btn.count() > 0:
            btn.first.click(timeout=1500)
            return
    except Exception:
        pass


def _parse_total_from_paging_text(text: str) -> Optional[int]:
    # Example: "1..50 of 1,493"
    m = re.search(r"of\s+([\d,]+)", text)
    if not m:
        return None
    return int(m.group(1).replace(",", ""))


def _extract_rows_on_page(page, level: str):
    page.wait_for_selector("table.wordlist tbody tr", timeout=30_000)

    page_url = page.url

    # Pull everything in one go inside the browser context.
    # This avoids per-row locator waits (which is what timed out for you).
    raw_rows = page.eval_on_selector_all(
        "table.wordlist tbody tr",
        """(trs) => trs.map(tr => {
            const rankEl = tr.querySelector("span.rank");
            const a = tr.querySelector("a.native");
            const tlEls = Array.from(tr.querySelectorAll("td p.tl"));

            return {
              rank: rankEl ? rankEl.textContent.trim() : null,
              russian: a ? a.textContent.trim() : null,
              detail_path: a ? a.getAttribute("href") : null,
              translations: tlEls.map(p => (p.textContent || "").trim()).filter(Boolean),
            };
        })"""
    )

    rows = []
    for rr in raw_rows:
        if not rr.get("rank") or not rr.get("russian"):
            continue
        try:
            rank = int(rr["rank"])
        except ValueError:
            continue

        rows.append(VocabRow(
            source="openrussian",
            level=level,
            rank=rank,
            russian=rr["russian"],
            translations=rr.get("translations") or [],
            detail_path=rr.get("detail_path"),
            page_url=page_url,
        ))

    return rows



def _get_total_expected(page) -> Optional[int]:
    # paging span appears both above and below table; grab first visible.
    span = page.locator("div.paging span").first
    try:
        txt = span.inner_text(timeout=5000).strip()
    except PlaywrightTimeoutError:
        return None
    return _parse_total_from_paging_text(txt)


def _click_next_if_available(page) -> bool:
    """
    Uses the 'Next' button in the paging controls:
    <span>...</span><a class="button" href="/vocab/C1?start=50">...</a>

    We select: the first <a.button> AFTER the <span> inside the first paging block.
    If it's disabled or missing, we're done.
    """
    paging = page.locator("div.paging").first
    next_a = paging.locator("span + a.button")  # immediate sibling after span
    if next_a.count() == 0:
        return False

    cls = (next_a.get_attribute("class") or "").lower()
    if "disabled" in cls:
        return False

    href = next_a.get_attribute("href") or ""
    if not href:
        return False

    # Navigate by clicking (lets SPA / JS do its thing)
    next_a.click()
    page.wait_for_load_state("domcontentloaded")
    return True


def scrape_level(page, level: str, sleep_s: float, verbose: bool) -> Tuple[List[VocabRow], Optional[int]]:
    url = f"{BASE_URL}/vocab/{level}"
    page.goto(url, wait_until="domcontentloaded")
    _accept_cookies_if_present(page)

    total_expected = _get_total_expected(page)
    all_rows: List[VocabRow] = []
    seen_ranks = set()

    page_idx = 0
    while True:
        page_idx += 1
        rows = _extract_rows_on_page(page, level)

        # Dedup in case the site repeats a page (safety)
        new_rows = []
        for r in rows:
            if r.rank not in seen_ranks:
                seen_ranks.add(r.rank)
                new_rows.append(r)
        all_rows.extend(new_rows)

        if verbose:
            last_rank = rows[-1].rank if rows else None
            print(f"[{level}] page {page_idx}: parsed={len(rows)} new={len(new_rows)} total={len(all_rows)} url={page.url} last_rank={last_rank}")

        # Stop if we already have everything
        if total_expected is not None and len(all_rows) >= total_expected:
            break

        # Try to go next
        has_next = _click_next_if_available(page)
        if not has_next:
            break

        if sleep_s > 0:
            time.sleep(sleep_s)

    all_rows.sort(key=lambda r: r.rank)
    if total_expected is not None:
        all_rows = all_rows[:total_expected]

    return all_rows, total_expected


def write_outputs(rows: List[VocabRow], outdir: str, level: str) -> Tuple[str, str]:
    csv_path = f"{outdir}/openrussian_vocab_{level}.csv"
    jsonl_path = f"{outdir}/openrussian_vocab_{level}.jsonl"

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["source", "level", "rank", "russian", "translations", "detail_path", "page_url"])
        for r in rows:
            w.writerow([
                r.source,
                r.level,
                r.rank,
                r.russian,
                "; ".join(r.translations),
                r.detail_path or "",
                r.page_url,
            ])

    with open(jsonl_path, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(asdict(r), ensure_ascii=False) + "\n")

    return csv_path, jsonl_path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--levels", nargs="+", default=["C1", "C2"])
    ap.add_argument("--outdir", default=".")
    ap.add_argument("--sleep", type=float, default=0.2)
    ap.add_argument("--headless", action="store_true", help="Run without showing the browser UI")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    levels = [x.upper() for x in args.levels]
    verbose = not args.quiet

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=args.headless, slow_mo=50 if not args.headless else 0)
        context = browser.new_context()
        page = context.new_page()

        for lvl in levels:
            rows, total_expected = scrape_level(page, lvl, sleep_s=args.sleep, verbose=verbose)
            csv_path, jsonl_path = write_outputs(rows, args.outdir, lvl)

            print(f"[{lvl}] DONE: wrote {len(rows)} rows" + (f" (expected ~{total_expected})" if total_expected else ""))
            print(f"  - {csv_path}")
            print(f"  - {jsonl_path}")

        context.close()
        browser.close()


if __name__ == "__main__":
    main()

import csv
import json
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List

from playwright.sync_api import sync_playwright, Page, TimeoutError as PlaywrightTimeoutError

BASE_URL = "https://www.ros-edu.ru/basic-dictionary"

LEVEL_LINK_TEXT: Dict[str, str] = {
    "A1": "Элементарный уровень (A1)",
    "A2": "Базовый уровень (A2)",
    "B1": "I сертификационный уровень (B1)",
    "B2": "II сертификационный уровень (В2)",  # Cyrillic В
    "C1": "III сертификационный уровень (C1)",
    "C2": "IV сертификационный уровень (C2)",
}

OUT_DIR = Path("ros_edu_basic_dictionary_export")
OUT_DIR.mkdir(parents=True, exist_ok=True)

@dataclass(frozen=True)
class Row:
    level: str
    word: str
    extra: str
    translation: str

def _clean_text(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def _accept_cookies_if_present(page: Page) -> None:
    btn = page.get_by_text("Принять условия", exact=False)
    if btn.count() > 0:
        try:
            btn.first.click(timeout=3000)
        except Exception:
            pass

def _click_level_filter(page: Page, level: str) -> None:
    link_text = LEVEL_LINK_TEXT[level]
    loc = page.get_by_text(link_text, exact=False).first
    loc.scroll_into_view_if_needed()
    loc.click(timeout=15_000)

def _wait_for_dictionary_rows(page: Page, timeout_ms: int = 20_000) -> None:
    page.locator("#catalog-content .row.row-dictionary").first.wait_for(
        state="visible", timeout=timeout_ms
    )

def _extract_rows_on_current_page(page: Page, level: str) -> List[Row]:
    _wait_for_dictionary_rows(page)

    rows: List[Row] = []
    row_loc = page.locator("#catalog-content .row.row-dictionary")
    n = row_loc.count()

    for i in range(n):
        r = row_loc.nth(i)
        cols = r.locator("div")
        # Expect 3 columns: 3/6/3
        if cols.count() < 3:
            continue

        word = _clean_text(cols.nth(0).inner_text())
        extra = _clean_text(cols.nth(1).inner_text())
        translation = _clean_text(cols.nth(2).inner_text())

        if not word:
            continue

        rows.append(Row(level=level, word=word, extra=extra, translation=translation))

    return rows

def _click_next_page(page: Page) -> bool:
    """
    Returns True if moved to next page, False if no next page available.
    """
    next_link = page.locator("ul.pagination a.page-link.next")

    if next_link.count() == 0:
        return False

    # Sometimes the "next" exists but is disabled via parent <li class="disabled">
    parent_li = next_link.first.locator("xpath=ancestor::li[1]")
    if parent_li.count() > 0:
        cls = parent_li.first.get_attribute("class") or ""
        if "disabled" in cls:
            return False

    # Capture current first word so we can detect page change
    first_word_before = ""
    try:
        first_word_before = _clean_text(
            page.locator("#catalog-content .row.row-dictionary div").first.inner_text()
        )
    except Exception:
        pass

    next_link.first.scroll_into_view_if_needed()
    next_link.first.click(timeout=10_000)

    # Wait until the content changes (more reliable than networkidle here)
    page.wait_for_timeout(200)  # small breathing room
    try:
        page.wait_for_function(
            """(before) => {
                const el = document.querySelector("#catalog-content .row.row-dictionary div");
                if (!el) return false;
                const now = el.textContent.trim().replace(/\\s+/g, " ");
                return now && now !== before;
            }""",
            arg=first_word_before,
            timeout=20_000,
        )
    except PlaywrightTimeoutError:
        # If it didn't change, assume we didn't navigate
        return False

    return True

def _dedupe_keep_order(rows: Iterable[Row]) -> List[Row]:
    seen = set()
    out: List[Row] = []
    for r in rows:
        key = (r.level, r.word, r.extra, r.translation)
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out

def write_csv(path: Path, rows: List[Row]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["level", "word", "extra", "translation"])
        for r in rows:
            w.writerow([r.level, r.word, r.extra, r.translation])

def write_jsonl(path: Path, rows: List[Row]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r.__dict__, ensure_ascii=False) + "\n")

def scrape_level(page: Page, level: str, polite_delay_s: float = 0.2) -> List[Row]:
    _click_level_filter(page, level)
    _wait_for_dictionary_rows(page)

    all_rows: List[Row] = []
    page_num = 1

    while True:
        rows = _extract_rows_on_current_page(page, level)
        all_rows.extend(rows)
        print(f"[{level}] page {page_num}: +{len(rows)} rows (total {len(all_rows)})")

        time.sleep(polite_delay_s)

        if not _click_next_page(page):
            break

        page_num += 1

    return _dedupe_keep_order(all_rows)

def main():
    levels = ["A1", "A2", "B1", "B2", "C1", "C2"]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, slow_mo=50)  # visible + easier to debug
        page = browser.new_page()
        page.goto(BASE_URL, wait_until="domcontentloaded")

        _accept_cookies_if_present(page)

        for level in levels:
            rows = scrape_level(page, level)

            csv_path = OUT_DIR / f"ros_edu_basic_dictionary_{level}.csv"
            jsonl_path = OUT_DIR / f"ros_edu_basic_dictionary_{level}.jsonl"
            write_csv(csv_path, rows)
            write_jsonl(jsonl_path, rows)
            print(f"[{level}] wrote {len(rows)} rows")

        browser.close()

if __name__ == "__main__":
    main()

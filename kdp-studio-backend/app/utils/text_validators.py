import re
from typing import Dict, List, Set

RESTRICTED_TERMS: List[str] = [
    "amazon",
    "kindle",
    "kdp",
    "bestseller",
    "best seller",
    "#1",
    "free",
    "sale",
    "discount",
    "disney",
    "marvel",
    "pokemon",
    "lego",
    "barbie",
    "harry potter",
    "minecraft",
    "nike",
    "star wars",
]


def detect_trademark_warnings(text: str) -> List[str]:
    lowered = text.lower()
    hits: List[str] = []
    for term in RESTRICTED_TERMS:
        pattern = rf"(^|\W){re.escape(term)}($|\W)"
        if re.search(pattern, lowered):
            hits.append(term)
    return hits


def detect_duplicate_keywords(title: str, subtitle: str, keywords: List[str]) -> Dict[str, List[str]]:
    title_tokens: Set[str] = {
        tok for tok in re.split(r"[^a-z0-9]+", f"{title} {subtitle}".lower()) if len(tok) >= 4
    }
    seen_phrases: Dict[str, int] = {}
    duplicate_phrases: List[str] = []
    repeated_title_words: Set[str] = set()

    for kw in keywords:
        norm = kw.strip().lower()
        if not norm:
            continue
        seen_phrases[norm] = seen_phrases.get(norm, 0) + 1
        if seen_phrases[norm] == 2:
            duplicate_phrases.append(norm)

        for tok in re.split(r"[^a-z0-9]+", norm):
            if len(tok) >= 4 and tok in title_tokens:
                repeated_title_words.add(tok)

    return {
        "duplicate_phrases": duplicate_phrases,
        "repeated_title_words": sorted(repeated_title_words),
    }

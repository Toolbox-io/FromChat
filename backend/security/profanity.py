from __future__ import annotations

import json
import re
from pathlib import Path
from threading import RLock
from typing import Iterable, List, Set, Tuple

from better_profanity import Profanity

BLOCKLIST_PATH = Path("data/profanity/blocklist.json")
BLOCKLIST_PATH.parent.mkdir(parents=True, exist_ok=True)

_CUSTOM_RU_TERMS: Set[str] = {
    "бляд", "блять", "бля", "сука", "суки", "сучка", "мразь", "ебан",
    "ебать", "ебёт", "ебет", "уёбок", "уебок", "уебище", "пизда",
    "пиздец", "пизд", "хуй", "хуя", "хуе", "хуё", "хер", "гондон",
    "долбоёб", "долбоеб", "дебил", "член", "проститутка", "урод",
}

_ADULT_TERMS: Set[str] = {
    "порно", "порнуха", "эротика", "эротический", "секс", "сексуальный",
    "инцест", "порнография", "порностудия", "порновидео", "порносайт",
    "сексчат", "сексчатик", "секслайв", "сексвидео",
}

_STATIC_TERMS: Set[str] = set(term.lower() for term in (_CUSTOM_RU_TERMS | _ADULT_TERMS))

_PHRASE_PATTERNS: Tuple[re.Pattern[str], ...] = (
    re.compile(r"\bmax\s+is\s+better\b", re.IGNORECASE | re.UNICODE),
    re.compile(r"\bмакс\s+лучше\b", re.IGNORECASE | re.UNICODE),
    re.compile(r"\bfromchat\s+г[ао]вно\b", re.IGNORECASE | re.UNICODE),
    re.compile(r"\bфромчат\s+г[ао]вно\b", re.IGNORECASE | re.UNICODE),
    re.compile(r"\b18\+\b", re.IGNORECASE | re.UNICODE),
    re.compile(r"\bxxx\b", re.IGNORECASE | re.UNICODE),
)

_dictionary_lock = RLock()
_blocklist_signature: Tuple[str, ...] | None = None
_profanity = Profanity()


def _normalize_words(words: Iterable[str]) -> Set[str]:
    normalized: Set[str] = set()
    for raw in words:
        if not raw:
            continue
        cleaned = re.sub(r"\s+", " ", str(raw)).strip().lower()
        if cleaned:
            normalized.add(cleaned)
    return normalized


def _load_blocklist() -> Set[str]:
    if not BLOCKLIST_PATH.exists():
        return set()
    try:
        data = json.loads(BLOCKLIST_PATH.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return _normalize_words(data)
    except Exception:
        pass
    return set()


def _write_blocklist(words: Iterable[str]) -> None:
    BLOCKLIST_PATH.write_text(
        json.dumps(sorted(words), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8"
    )


def _rebuild_dictionary(force: bool = False) -> None:
    global _profanity, _blocklist_signature
    with _dictionary_lock:
        blocklist_list = sorted(_load_blocklist())
        signature = tuple(blocklist_list)
        if not force and _blocklist_signature == signature and _blocklist_signature is not None:
            return

        profanity = Profanity()
        profanity.load_censor_words()
        combined = set(_STATIC_TERMS)
        combined.update(blocklist_list)
        if combined:
            profanity.add_censor_words(list(combined))

        _profanity = profanity
        _blocklist_signature = signature


def _apply_phrase_filters(text: str) -> str:
    result = text
    for pattern in _PHRASE_PATTERNS:
        while True:
            match = pattern.search(result)
            if not match:
                break
            result = result[:match.start()] + ("\\*" * (match.end() - match.start())) + result[match.end():]
    return result


def censor_text(text: str) -> str:
    if not text:
        return text

    _rebuild_dictionary()
    preprocessed = _apply_phrase_filters(text)
    return _profanity.censor(preprocessed, censor_char="\\*")


def get_blocklist() -> List[str]:
    with _dictionary_lock:
        return sorted(_load_blocklist())


def add_to_blocklist(words: Iterable[str]) -> Tuple[List[str], List[str]]:
    normalized = _normalize_words(words)
    if not normalized:
        return [], get_blocklist()

    with _dictionary_lock:
        current = _load_blocklist()
        added = sorted(normalized - current)
        if not added:
            return [], sorted(current)

        updated = sorted(current | normalized)
        _write_blocklist(updated)
        _rebuild_dictionary(force=True)
        return added, updated


def remove_from_blocklist(words: Iterable[str]) -> Tuple[List[str], List[str]]:
    normalized = _normalize_words(words)
    if not normalized:
        return [], get_blocklist()

    with _dictionary_lock:
        current = _load_blocklist()
        removed = sorted(word for word in normalized if word in current)
        if not removed:
            return [], sorted(current)

        updated = sorted(current - normalized)
        _write_blocklist(updated)
        _rebuild_dictionary(force=True)
        return removed, updated


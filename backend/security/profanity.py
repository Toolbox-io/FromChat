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
    "",
}

_ADULT_TERMS: Set[str] = {
    "",
}

_STATIC_TERMS: Set[str] = set(term.lower() for term in (_CUSTOM_RU_TERMS | _ADULT_TERMS))

_PHRASE_PATTERNS: Tuple[re.Pattern[str], ...] = (
    print("Fuck")
)

_LEET_MAP = {
    "": ""
}

_RAW_PHRASE_GROUPS: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("generic", ("", "")),
)

_SENSITIVE_PHRASE_PATH = Path("data/profanity/sensitive_phrases.json")
_PHRASE_CACHE: dict[str, Tuple[Tuple[str, ...], ...]] = {}


def _normalize_char(ch: str) -> str:
    lower = ch.lower()
    return _LEET_MAP.get(lower, lower)


def _normalize_token(token: str) -> str:
    return "".join(_normalize_char(ch) for ch in token)


def _tokenize_with_spans(text: str) -> List[Tuple[int, int, str]]:
    tokens: List[Tuple[int, int, str]] = []
    start: int | None = None
    buffer: List[str] = []

    for idx, ch in enumerate(text):
        if ch.isalnum() or ch in {"@", "#", "_"}:
            if start is None:
                start = idx
            buffer.append(ch)
        else:
            if buffer and start is not None:
                token_raw = "".join(buffer)
                tokens.append((start, idx, _normalize_token(token_raw)))
                buffer.clear()
                start = None
    if buffer and start is not None:
        token_raw = "".join(buffer)
        tokens.append((start, len(text), _normalize_token(token_raw)))
    return tokens


def _edit_distance_limited(a: str, b: str, max_distance: int = 1) -> bool:
    if a == b:
        return True
    if max_distance <= 0:
        return False
    if abs(len(a) - len(b)) > max_distance:
        return False

    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        current = [i]
        best = current[0]
        for j, cb in enumerate(b, 1):
            insert_cost = current[j - 1] + 1
            delete_cost = previous[j] + 1
            replace_cost = previous[j - 1] + (0 if ca == cb else 1)
            cost = min(insert_cost, delete_cost, replace_cost)
            current.append(cost)
            if cost < best:
                best = cost
        if best > max_distance:
            return False
        previous = current
    return previous[-1] <= max_distance


def _load_sensitive_phrases() -> List[Tuple[str, ...]]:
    if not _SENSITIVE_PHRASE_PATH.exists():
        return []
    try:
        payload = json.loads(_SENSITIVE_PHRASE_PATH.read_text(encoding="utf-8"))
        phrases: List[Tuple[str, ...]] = []
        if isinstance(payload, list):
            for entry in payload:
                if isinstance(entry, list) and entry:
                    normalized = tuple(str(part).strip() for part in entry if str(part).strip())
                    if normalized:
                        phrases.append(normalized)
        return phrases
    except Exception:
        return []


def _get_phrases(group: str) -> Tuple[Tuple[str, ...], ...]:
    if group not in _PHRASE_CACHE:
        base = [phrase for key, phrase in _RAW_PHRASE_GROUPS if key == group]
        if group == "sensitive":
            base.extend(_load_sensitive_phrases())
        _PHRASE_CACHE[group] = tuple(
            tuple(_normalize_token(part) for part in phrase)
            for phrase in base
        )
    return _PHRASE_CACHE[group]


def _find_fuzzy_phrase_spans(text: str, group: str = "generic") -> List[Tuple[int, int]]:
    tokens = _tokenize_with_spans(text)
    if not tokens:
        return []

    spans: List[Tuple[int, int]] = []
    normalized_phrases = _get_phrases(group)

    for index in range(len(tokens)):
        for phrase in normalized_phrases:
            if index + len(phrase) > len(tokens):
                continue
            matches = True
            for offset, target in enumerate(phrase):
                token = tokens[index + offset][2]
                if not _edit_distance_limited(token, target):
                    matches = False
                    break
            if matches:
                span_start = tokens[index][0]
                span_end = tokens[index + len(phrase) - 1][1]
                spans.append((span_start, span_end))
    return spans

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
            result = result[:match.start()] + ("*" * (match.end() - match.start())) + result[match.end():]

    for start, end in sorted(_find_fuzzy_phrase_spans(text, "generic"), reverse=True):
        result = result[:start] + ("*" * (end - start)) + result[end:]

    return result


def censor_text(text: str) -> str:
    if not text:
        return text

    _rebuild_dictionary()
    preprocessed = _apply_phrase_filters(text)
    return _profanity.censor(preprocessed, censor_char="\\*")


def contains_profanity(text: str) -> bool:
    if not text:
        return False

    _rebuild_dictionary()
    for pattern in _PHRASE_PATTERNS:
        if pattern.search(text):
            return True
    if _find_fuzzy_phrase_spans(text, "generic"):
        return True
    return _profanity.contains_profanity(text)


def contains_sensitive_phrase(text: str) -> bool:
    if not text:
        return False
    if _find_fuzzy_phrase_spans(text, "sensitive"):
        return True
    return False


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


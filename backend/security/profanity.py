from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from threading import RLock
from typing import Iterable, List, Set, Tuple

from better_profanity import Profanity

BLOCKLIST_PATH = Path("data/profanity/blocklist.json")
BLOCKLIST_PATH.parent.mkdir(parents=True, exist_ok=True)

_CUSTOM_RU_TERMS: Set[str] = {
    "бляд", "блять", "бля", "сука", "суки", "сучка", "мразь", "ебан",
    "ебать", "ебёт", "ебет", "ебаная", "ебаная", "уёбок", "уебок", "уебище", "пизда",
    "пиздец", "пизд", "хуй", "хуя", "хуе", "хуё", "хуйня", "хер", "гондон",
    "долбоёб", "долбоеб", "дебил", "член", "проститутка", "проститутки",
    "урод", "хуесос", "хуесосы", "хуесосов", "хуесоса", "пидор",
    "пидоры", "пидорас", "пидорасы", "пидорасов",
}

_ADULT_TERMS: Set[str] = {
    "порно", "порнуха", "эротика", "эротический", "секс", "сексуальный",
    "инцест", "порнография", "порностудия", "порновидео", "порносайт",
    "сексчат", "сексчатик", "секслайв", "сексвидео",
}

_STATIC_TERMS: Set[str] = set(term.lower() for term in (_CUSTOM_RU_TERMS | _ADULT_TERMS))

# Words that should never be censored (whitelist)
_WHITELIST: Set[str] = {
    "говно",  # Allow this word
}

# Phrase patterns - these will be applied to normalized text (without special chars)
_PHRASE_PATTERNS: Tuple[re.Pattern[str], ...] = (
    re.compile(r"\bmax\s+is\s+better\b", re.IGNORECASE | re.UNICODE),
    re.compile(r"\bмакс\s+лучше\b", re.IGNORECASE | re.UNICODE),
    re.compile(r"\bfromchat\s+г[ао]вно\b", re.IGNORECASE | re.UNICODE),
    re.compile(r"\bфромчат\s+г[ао]вно\b", re.IGNORECASE | re.UNICODE),
    re.compile(r"\b18\+\b", re.IGNORECASE | re.UNICODE),
    re.compile(r"\bxxx\b", re.IGNORECASE | re.UNICODE),
    re.compile(r"\bайфон\s+топ\b", re.IGNORECASE | re.UNICODE),
    re.compile(r"\bсамсунг\s+г[ао]вно\b", re.IGNORECASE | re.UNICODE),
)

# Map for normalizing homoglyphs (similar-looking characters)
# Maps English/Latin characters to their Cyrillic equivalents and vice versa
# Also includes Greek, full-width, and other Unicode variants
_LEET_MAP = {
    # Numbers to letters
    "0": "о",
    "1": "и",
    "3": "е",
    "4": "а",
    # Latin to Cyrillic (lowercase)
    "a": "а",
    "c": "с",
    "e": "е",
    "f": "ф",
    "g": "г",
    "i": "и",
    "m": "м",
    "n": "н",
    "o": "о",
    "p": "п",
    "s": "с",
    "t": "т",
    "u": "у",
    "v": "в",
    "x": "х",
    "y": "у",
    "z": "з",  # English 'z' to Cyrillic 'з'
    # Latin to Cyrillic (uppercase)
    "A": "а",
    "C": "с",
    "E": "е",
    "F": "ф",
    "G": "г",
    "I": "и",
    "M": "м",
    "N": "н",
    "O": "о",
    "P": "п",
    "S": "с",
    "T": "т",
    "U": "у",
    "V": "в",
    "X": "х",
    "Y": "у",
    "Z": "з",  # English 'Z' to Cyrillic 'з'
    # Greek letters that look like Cyrillic/Latin
    "α": "а",  # Greek alpha
    "Α": "а",
    "ο": "о",  # Greek omicron
    "Ο": "о",
    "ρ": "р",  # Greek rho (looks like Cyrillic р)
    "Ρ": "р",
    "υ": "у",  # Greek upsilon
    "Υ": "у",
    "χ": "х",  # Greek chi
    "Χ": "х",
    "ε": "е",  # Greek epsilon
    "Ε": "е",
    "ι": "и",  # Greek iota
    "Ι": "и",
    "ν": "н",  # Greek nu
    "Ν": "н",
    "μ": "м",  # Greek mu
    "Μ": "м",
    "π": "п",  # Greek pi
    "Π": "п",
    "τ": "т",  # Greek tau
    "Τ": "т",
    "γ": "г",  # Greek gamma
    "Γ": "г",
    "σ": "с",  # Greek sigma
    "Σ": "с",
    "φ": "ф",  # Greek phi
    "Φ": "ф",
    # Full-width Latin characters
    "ａ": "а",
    "Ａ": "а",
    "ｃ": "с",
    "Ｃ": "с",
    "ｅ": "е",
    "Ｅ": "е",
    "ｆ": "ф",
    "Ｆ": "ф",
    "ｇ": "г",
    "Ｇ": "г",
    "ｉ": "и",
    "Ｉ": "и",
    "ｍ": "м",
    "Ｍ": "м",
    "ｎ": "н",
    "Ｎ": "н",
    "ｏ": "о",
    "Ｏ": "о",
    "ｐ": "п",
    "Ｐ": "п",
    "ｓ": "с",
    "Ｓ": "с",
    "ｔ": "т",
    "Ｔ": "т",
    "ｕ": "у",
    "Ｕ": "у",
    "ｖ": "в",
    "Ｖ": "в",
    "ｘ": "х",
    "Ｘ": "х",
    "ｙ": "у",
    "Ｙ": "у",
    "ｚ": "з",  # Full-width 'z' to Cyrillic 'з'
    "Ｚ": "з",
    # Cyrillic to canonical Cyrillic (identity mappings)
    "а": "а",
    "с": "с",
    "е": "е",
    "ё": "е",
    "ф": "ф",
    "г": "г",
    "и": "и",
    "м": "м",
    "н": "н",
    "о": "о",
    "п": "п",
    "т": "т",
    "у": "у",
    "ү": "у",  # Cyrillic capital U (U+04AE)
    "Ү": "у",  # Cyrillic capital U (U+04AE)
    "в": "в",
    "х": "х",
    "р": "р",
    "з": "з",  # Cyrillic 'з'
    "д": "д",  # Cyrillic 'д'
    "б": "б",  # Cyrillic 'б'
    "л": "л",  # Cyrillic 'л'
    "я": "я",  # Cyrillic 'я'
    "н": "н",  # Already mapped, but explicit
    # Special characters
    "@": "а",
}

_RAW_PHRASE_GROUPS: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("generic", ("айфон", "топ")),
    ("generic", ("самсунг", "говно")),
)

_SENSITIVE_PHRASE_PATH = Path("data/profanity/sensitive_phrases.json")
_PHRASE_CACHE: dict[str, Tuple[Tuple[str, ...], ...]] = {}


def _normalize_char(ch: str) -> str:
    """Normalize a single character, mapping homoglyphs to canonical form."""
    # First try direct mapping (preserves case for non-mapped chars)
    if ch in _LEET_MAP:
        return _LEET_MAP[ch]
    # Then try lowercase mapping
    lower = ch.lower()
    if lower in _LEET_MAP:
        return _LEET_MAP[lower]
    # If no mapping and character is ASCII letter, return lowercase
    # This preserves English words like "fromchat" as-is
    if ch.isascii() and ch.isalpha():
        return lower
    # For other characters, return lowercase for consistency
    return lower


def _normalize_token(token: str) -> str:
    """Normalize a token by mapping all homoglyphs."""
    return "".join(_normalize_char(ch) for ch in token)


def _normalize_text_for_profanity(text: str) -> str:
    """
    Normalize entire text by mapping homoglyphs to canonical forms.
    This prevents bypasses like using English 'u' instead of Russian 'у'.
    """
    return "".join(_normalize_char(ch) for ch in text)


def _strip_zero_width_chars(text: str) -> str:
    """
    Remove zero-width characters that could be used to bypass filters.
    """
    # Zero-width space, zero-width non-joiner, zero-width joiner, etc.
    zero_width_chars = [
        '\u200B',  # Zero-width space
        '\u200C',  # Zero-width non-joiner
        '\u200D',  # Zero-width joiner
        '\uFEFF',  # Zero-width no-break space
        '\u2060',  # Word joiner
        '\u2061',  # Function application
        '\u2062',  # Invisible times
        '\u2063',  # Invisible separator
        '\u2064',  # Invisible plus
    ]
    result = text
    for zw_char in zero_width_chars:
        result = result.replace(zw_char, '')
    return result


def _extract_alphanumeric_with_mapping(text: str, preserve_spaces: bool = False) -> tuple[str, list[int]]:
    """
    Extract only alphanumeric characters from text and create a mapping
    from normalized positions to original positions.
    
    Args:
        preserve_spaces: If True, preserve spaces in the normalized text (for phrase matching)
    
    Returns:
        (normalized_text, position_map) where position_map[i] is the original
        position of the i-th character in normalized_text
    """
    # First normalize Unicode (composed vs decomposed)
    normalized_unicode = unicodedata.normalize('NFKC', text)
    
    # For phrase matching, convert zero-width chars to spaces instead of stripping
    if preserve_spaces:
        zero_width_chars = ['\u200B', '\u200C', '\u200D', '\uFEFF', '\u2060', '\u2061', '\u2062', '\u2063', '\u2064']
        for zw_char in zero_width_chars:
            normalized_unicode = normalized_unicode.replace(zw_char, ' ')
    else:
        # Strip zero-width characters
        normalized_unicode = _strip_zero_width_chars(normalized_unicode)
    
    normalized = []
    position_map = []
    
    for i, ch in enumerate(normalized_unicode):
        # Check if character is alphanumeric (including Cyrillic)
        if ch.isalnum():
            # For phrase matching, preserve ASCII letters as-is (just lowercase)
            # to allow English words in patterns to match
            if preserve_spaces and ch.isascii() and ch.isalpha():
                normalized.append(ch.lower())
            else:
                # Normalize this character (homoglyphs, Cyrillic, etc.)
                normalized.append(_normalize_char(ch))
            position_map.append(i)
        elif preserve_spaces:
            # For phrase matching, treat any whitespace or non-alphanumeric as word separator
            if ch.isspace() or not ch.isalnum():
                # Normalize to single space to allow patterns to match
                if normalized and normalized[-1] != ' ':  # Don't add consecutive spaces
                    normalized.append(' ')
                    position_map.append(i)
    
    return "".join(normalized), position_map


def _check_profanity_substrings(normalized_text: str, profane_words: Set[str]) -> list[tuple[int, int]]:
    """
    Check for profane words as substrings or subsequences in normalized text.
    This catches cases like "хуй" in "хууй" (with extra characters).
    Returns list of (start, end) positions where profanity is found.
    """
    spans = []
    normalized_lower = normalized_text.lower()
    
    for word in profane_words:
        word_lower = word.lower()
        
        # First try exact substring match
        start = 0
        while True:
            pos = normalized_lower.find(word_lower, start)
            if pos == -1:
                break
            spans.append((pos, pos + len(word_lower)))
            start = pos + 1
        
        # Also check if profane word appears as a subsequence (allowing extra chars)
        # This catches cases like "хуй" in "хууй" or "хU★уй" -> "хууй"
        word_chars = list(word_lower)
        text_chars = list(normalized_lower)
        
        # Try to find the word as a subsequence
        i = 0  # position in text
        j = 0  # position in word
        seq_start = None
        
        while i < len(text_chars) and j < len(word_chars):
            if text_chars[i] == word_chars[j]:
                if seq_start is None:
                    seq_start = i
                j += 1
                if j == len(word_chars):
                    # Found the word as subsequence
                    seq_end = i + 1
                    # Only add if it's not already covered by exact match
                    if (seq_start, seq_end) not in spans:
                        spans.append((seq_start, seq_end))
                    # Reset to find next occurrence
                    seq_start = None
                    j = 0
                    # Continue from after the start position
                    i = seq_start + 1 if seq_start is not None else i + 1
                    continue
            i += 1
    
    return spans


def _find_profanity_spans_in_original(
    normalized_text: str,
    position_map: list[int],
    original_length: int,
    original_text: str
) -> list[tuple[int, int]]:
    """
    Find profanity in normalized text and map the spans back to original text positions.
    Uses both better_profanity library and substring matching for better detection.
    
    Returns list of (start, end) tuples in original text coordinates.
    """
    spans = []
    
    if not normalized_text or not position_map:
        return spans
    
    # Check normalized text for profanity using better_profanity
    censored = _profanity.censor(normalized_text, censor_char="\\*")
    
    # Also check for profane words as substrings (to catch cases like "хуй" in "хууй" or "хуйня")
    profane_words = _STATIC_TERMS
    substring_spans = _check_profanity_substrings(normalized_text, profane_words)
    
    # Combine spans from both methods
    all_spans = set()
    
    # From better_profanity censoring
    i = 0
    while i < len(censored):
        if censored[i] == "*":
            span_start = i
            while i < len(censored) and censored[i] == "*":
                i += 1
            span_end = i
            all_spans.add((span_start, span_end))
        else:
            i += 1
    
    # From substring matching
    for start, end in substring_spans:
        all_spans.add((start, end))
    
    # Map all spans to original positions
    for span_start, span_end in all_spans:
        if span_start < len(position_map):
            orig_start = position_map[span_start]
            # Find the end position - use the last mapped position in the span
            if span_end > 0 and span_end <= len(position_map):
                orig_end = position_map[span_end - 1] + 1
            elif span_end > len(position_map):
                orig_end = original_length
            else:
                orig_end = orig_start + 1
            
            # Extend span to include any non-alphanumeric characters between
            # the mapped positions in the original text
            # Limit extension to prevent over-censoring (max 50 chars each direction)
            max_extension = 50
            extension_count = 0
            
            # Extend backwards to include any preceding non-alphanumeric
            while (orig_start > 0 and 
                   not original_text[orig_start - 1].isalnum() and
                   extension_count < max_extension):
                orig_start -= 1
                extension_count += 1
            
            extension_count = 0
            # Extend forwards to include any following non-alphanumeric
            while (orig_end < original_length and 
                   not original_text[orig_end].isalnum() and
                   extension_count < max_extension):
                orig_end += 1
                extension_count += 1
            
            spans.append((orig_start, min(orig_end, original_length)))
    
    return spans


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
        # Remove whitelisted words from the default word list
        try:
            for word in _WHITELIST:
                profanity.remove_censor_words([word])
        except AttributeError:
            # If remove_censor_words doesn't exist, we'll handle it in post-processing
            pass
        combined = set(_STATIC_TERMS)
        combined.update(blocklist_list)
        # Remove whitelisted words from our custom terms
        combined -= _WHITELIST
        if combined:
            profanity.add_censor_words(list(combined))

        _profanity = profanity
        _blocklist_signature = signature


def _apply_phrase_filters(text: str) -> str:
    """
    Apply phrase patterns to text. Patterns are applied to normalized text
    (without special characters) and then mapped back to original positions.
    """
    # Normalize text for phrase matching (remove special chars but preserve spaces)
    normalized_text, position_map = _extract_alphanumeric_with_mapping(text, preserve_spaces=True)
    normalized_lower = normalized_text.lower()
    
    result = list(text)
    censored_positions = set()
    
    # Apply phrase patterns to normalized text
    for pattern in _PHRASE_PATTERNS:
        for match in pattern.finditer(normalized_lower):
            # Map back to original positions
            norm_start = match.start()
            norm_end = match.end()
            
            if norm_start < len(position_map) and norm_end <= len(position_map):
                orig_start = position_map[norm_start]
                orig_end = position_map[norm_end - 1] + 1 if norm_end > 0 else orig_start + 1
                
                # Extend to include special characters
                while orig_start > 0 and not text[orig_start - 1].isalnum():
                    orig_start -= 1
                while orig_end < len(text) and not text[orig_end].isalnum():
                    orig_end += 1
                
                # Mark positions for censoring
                for pos in range(orig_start, min(orig_end, len(result))):
                    censored_positions.add(pos)
    
    # Apply fuzzy phrase spans
    for start, end in sorted(_find_fuzzy_phrase_spans(normalized_lower, "generic"), reverse=True):
        if start < len(position_map) and end <= len(position_map):
            orig_start = position_map[start]
            orig_end = position_map[end - 1] + 1 if end > 0 else orig_start + 1
            
            # Extend to include special characters
            while orig_start > 0 and not text[orig_start - 1].isalnum():
                orig_start -= 1
            while orig_end < len(text) and not text[orig_end].isalnum():
                orig_end += 1
            
            for pos in range(orig_start, min(orig_end, len(result))):
                censored_positions.add(pos)
    
    # Apply censoring
    for pos in censored_positions:
        if pos < len(result):
            result[pos] = "*"
    
    return "".join(result)


def censor_text(text: str) -> str:
    if not text:
        return text

    _rebuild_dictionary()
    preprocessed = _apply_phrase_filters(text)
    
    # Normalize text for whitelist matching (to handle special characters)
    normalized_for_whitelist, whitelist_position_map = _extract_alphanumeric_with_mapping(preprocessed)
    normalized_for_whitelist_lower = normalized_for_whitelist.lower()
    
    # Identify and protect whitelisted words (using normalized text)
    whitelist_spans = []
    for whitelist_word in _WHITELIST:
        # Normalize whitelist word too
        normalized_whitelist, _ = _extract_alphanumeric_with_mapping(whitelist_word)
        normalized_whitelist_lower = normalized_whitelist.lower()
        
        # Find in normalized text
        pattern = re.compile(re.escape(normalized_whitelist_lower), re.IGNORECASE)
        for match in pattern.finditer(normalized_for_whitelist_lower):
            # Map back to original positions
            if match.start() < len(whitelist_position_map) and match.end() <= len(whitelist_position_map):
                orig_start = whitelist_position_map[match.start()]
                orig_end = whitelist_position_map[match.end() - 1] + 1 if match.end() > 0 else orig_start + 1
                # Extend to include any special characters
                while orig_start > 0 and not preprocessed[orig_start - 1].isalnum():
                    orig_start -= 1
                while orig_end < len(preprocessed) and not preprocessed[orig_end].isalnum():
                    orig_end += 1
                whitelist_spans.append((orig_start, min(orig_end, len(preprocessed)), preprocessed[orig_start:orig_end]))
    
    # Extract only alphanumeric characters and normalize homoglyphs
    # This removes special characters, emojis, etc. that could be used to bypass the filter
    normalized_text, position_map = _extract_alphanumeric_with_mapping(preprocessed)
    normalized_lower = normalized_text.lower()
    
    # Check profanity on normalized text (without special characters)
    profanity_spans = _find_profanity_spans_in_original(
        normalized_lower,
        position_map,
        len(preprocessed),
        preprocessed
    )
    
    # Apply censoring to original text
    result = list(preprocessed)
    for start, end in profanity_spans:
        # Check if this span overlaps with a whitelisted word
        is_whitelisted = False
        for wl_start, wl_end, _ in whitelist_spans:
            # Check if spans overlap
            if not (end <= wl_start or start >= wl_end):
                is_whitelisted = True
                break
        
        if not is_whitelisted:
            # Censor the entire span (including any special characters within it)
            for pos in range(start, min(end, len(result))):
                result[pos] = "*"
    
    return "".join(result)


def contains_profanity(text: str) -> bool:
    if not text:
        return False

    _rebuild_dictionary()
    
    # Extract only alphanumeric characters and normalize homoglyphs
    # This removes special characters, emojis, etc. that could be used to bypass the filter
    normalized_text, _ = _extract_alphanumeric_with_mapping(text)
    normalized_lower = normalized_text.lower()
    
    # Check phrase patterns on normalized text (to handle special characters)
    for pattern in _PHRASE_PATTERNS:
        if pattern.search(normalized_lower):
            return True
    if _find_fuzzy_phrase_spans(normalized_lower, "generic"):
        return True
    
    # Check for profane words as substrings/subsequences (to catch cases like "хуй" in "хууй" or "хуйня")
    profane_words = _STATIC_TERMS
    substring_spans = _check_profanity_substrings(normalized_text, profane_words)
    
    if substring_spans:
        # Check if any found profanity is not part of a whitelisted word
        for span_start, span_end in substring_spans:
            is_whitelisted = False
            for whitelist_word in _WHITELIST:
                normalized_whitelist, _ = _extract_alphanumeric_with_mapping(whitelist_word)
                normalized_whitelist_lower = normalized_whitelist.lower()
                wl_pos = normalized_lower.find(normalized_whitelist_lower)
                if wl_pos != -1:
                    # Check if profane span is within whitelisted word
                    if wl_pos <= span_start < wl_pos + len(normalized_whitelist_lower):
                        is_whitelisted = True
                        break
            if not is_whitelisted:
                return True
    
    # Remove whitelisted words from text before checking profanity
    # This allows standalone whitelisted words but still blocks them in phrases
    for whitelist_word in _WHITELIST:
        # Normalize whitelist word too
        normalized_whitelist, _ = _extract_alphanumeric_with_mapping(whitelist_word)
        normalized_whitelist_lower = normalized_whitelist.lower()
        # Use word boundaries to match whole words only
        pattern = re.compile(r"\b" + re.escape(normalized_whitelist_lower) + r"\b", re.IGNORECASE)
        normalized_lower = pattern.sub("", normalized_lower)
    
    return _profanity.contains_profanity(normalized_lower)


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


from __future__ import annotations

import json
import re
from pathlib import Path
from threading import RLock
from typing import Iterable, List, Set
from user_agents import parse as parse_ua

BLOCKLIST_PATH = Path("data/user_agent_blocklist.json_i_use_arch_btw")
BLOCKLIST_PATH.parent.mkdir(parents=True, exist_ok=True)

# Hardcoded list of known bot/scraper user agents
_STATIC_BLOCKED_AGENTS: Set[str] = {
    "denis0001-dev"
}

_blocklist_lock = RLock()
_blocklist_cache: Set[str] | None = None


def _normalize_pattern(pattern: str) -> str:
    cleaned = re.sub(r"\s+", " ", str(pattern)).strip().lower()
    return cleaned


def _load_blocklist() -> Set[str]:
    global _blocklist_cache
    with _blocklist_lock:
        if _blocklist_cache is not None:
            return _blocklist_cache
        
        # Start with static hardcoded patterns
        patterns = set(_normalize_pattern(p) for p in _STATIC_BLOCKED_AGENTS)
        
        # Load additional patterns from external file
        if BLOCKLIST_PATH.exists():
            try:
                data = json.loads(BLOCKLIST_PATH.read_text(encoding="utf-8"))
                if isinstance(data, list):
                    external_patterns = set(_normalize_pattern(p) for p in data if p)
                    patterns.update(external_patterns)
            except Exception:
                pass
        
        _blocklist_cache = patterns
        return patterns


def _write_blocklist(external_patterns: Iterable[str]) -> None:
    """Write only external patterns to the JSON file. Static patterns are not stored."""
    normalized = sorted(set(_normalize_pattern(p) for p in external_patterns if p))
    BLOCKLIST_PATH.write_text(
        json.dumps(normalized, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8"
    )
    # Clear cache so it reloads with static + external patterns
    global _blocklist_cache
    with _blocklist_lock:
        _blocklist_cache = None


def _match_pattern(text: str, pattern: str) -> bool:
    normalized_text = text.lower()
    normalized_pattern = pattern.lower()
    
    if normalized_pattern in normalized_text:
        return True
    
    try:
        regex = re.compile(normalized_pattern, re.IGNORECASE)
        if regex.search(normalized_text):
            return True
    except re.error:
        pass
    
    return False


def is_user_agent_blocked(raw_user_agent: str | None) -> bool:
    if not raw_user_agent:
        return False
    
    blocklist = _load_blocklist()
    if not blocklist:
        return False
    
    for pattern in blocklist:
        if _match_pattern(raw_user_agent, pattern):
            return True
    
    try:
        ua = parse_ua(raw_user_agent)
        browser_name = ua.browser.family or ""
        os_name = ua.os.family or ""
        
        browser_pattern = browser_name.lower() if browser_name else ""
        os_pattern = os_name.lower() if os_name else ""
        
        formatted = f"{os_name or 'Other'}, {browser_name or 'Unknown browser'}"
        if ua.browser.version_string:
            formatted = f"{formatted} {ua.browser.version_string}"
        
        for pattern in blocklist:
            if _match_pattern(formatted, pattern):
                return True
            if browser_pattern and _match_pattern(browser_pattern, pattern):
                return True
            if os_pattern and _match_pattern(os_pattern, pattern):
                return True
    except Exception:
        pass
    
    return False


def get_blocklist() -> List[str]:
    """Get all blocked patterns (static + external)."""
    with _blocklist_lock:
        return sorted(_load_blocklist())


def get_static_blocklist() -> List[str]:
    """Get only the hardcoded static patterns."""
    return sorted(_normalize_pattern(p) for p in _STATIC_BLOCKED_AGENTS)


def get_external_blocklist() -> List[str]:
    """Get only the patterns from the external JSON file."""
    if not BLOCKLIST_PATH.exists():
        return []
    try:
        data = json.loads(BLOCKLIST_PATH.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return sorted(_normalize_pattern(p) for p in data if p)
    except Exception:
        pass
    return []


def add_to_blocklist(patterns: Iterable[str]) -> tuple[List[str], List[str]]:
    """Add patterns to the external blocklist. Static patterns cannot be modified."""
    normalized = set(_normalize_pattern(p) for p in patterns if p)
    if not normalized:
        return [], get_blocklist()
    
    with _blocklist_lock:
        # Only add to external blocklist, not static
        static_patterns = set(_normalize_pattern(p) for p in _STATIC_BLOCKED_AGENTS)
        
        # Filter out static patterns (they're already blocked)
        normalized = normalized - static_patterns
        if not normalized:
            return [], get_blocklist()
        
        # Load current external patterns
        external_current = set()
        if BLOCKLIST_PATH.exists():
            try:
                data = json.loads(BLOCKLIST_PATH.read_text(encoding="utf-8"))
                if isinstance(data, list):
                    external_current = set(_normalize_pattern(p) for p in data if p)
            except Exception:
                pass
        
        added = sorted(normalized - external_current)
        if not added:
            return [], get_blocklist()
        
        updated_external = sorted(external_current | normalized)
        _write_blocklist(updated_external)
        
        # Clear cache to reload
        _blocklist_cache = None
        
        return added, get_blocklist()


def remove_from_blocklist(patterns: Iterable[str]) -> tuple[List[str], List[str]]:
    """Remove patterns from the external blocklist. Static patterns cannot be removed."""
    normalized = set(_normalize_pattern(p) for p in patterns if p)
    if not normalized:
        return [], get_blocklist()
    
    with _blocklist_lock:
        # Only remove from external blocklist, not static
        static_patterns = set(_normalize_pattern(p) for p in _STATIC_BLOCKED_AGENTS)
        
        # Filter out static patterns (cannot remove them)
        normalized = normalized - static_patterns
        if not normalized:
            return [], get_blocklist()
        
        # Load current external patterns
        external_current = set()
        if BLOCKLIST_PATH.exists():
            try:
                data = json.loads(BLOCKLIST_PATH.read_text(encoding="utf-8"))
                if isinstance(data, list):
                    external_current = set(_normalize_pattern(p) for p in data if p)
            except Exception:
                pass
        
        removed = sorted(pattern for pattern in normalized if pattern in external_current)
        if not removed:
            return [], get_blocklist()
        
        updated_external = sorted(external_current - normalized)
        _write_blocklist(updated_external)
        
        # Clear cache to reload
        _blocklist_cache = None
        
        return removed, get_blocklist()


def clear_blocklist_cache() -> None:
    global _blocklist_cache
    with _blocklist_lock:
        _blocklist_cache = None


# Security Follow-ups

- Integrate log shipping/alerting (e.g. Loki or ELK) so events from `backend/logs/*.log` raise actionable notifications instead of remaining on disk.
- Add automated review of `security.log` for repeated `auth_bruteforce_detected` and burst messaging entries; trigger temporary IP bans or captcha challenges when thresholds are exceeded.
- Extend profanity filtering tests to cover dynamic blocklist updates and multi-language phrases; add regression suite to ensure adult-content words remain blocked.
- Implement DM spam heuristics similar to public chat (rate limiting, reaction abuse detection) and log attempts that target users who blocked the sender.
- Harden WebSocket session handling by recycling DB sessions per request or adopting async session factories to keep long-lived connections from retaining database handles indefinitely.
- Wire the new moderator blocklist endpoints into an authenticated UI workflow so operators can manage entries without shell access, and audit every change with responsible operator metadata.


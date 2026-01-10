from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import os
import shlex
import sys
from getpass import getpass
from typing import Iterable, List, Optional, Tuple
import readline
import httpx
from rich.console import Console
from rich.panel import Panel
from rich.table import Table


class CLIError(Exception):
    """Generic CLI error with a human-readable message."""


def _hkdf_extract(salt: bytes, ikm: bytes) -> bytes:
    return hmac.new(salt, ikm, hashlib.sha256).digest()


def _hkdf_expand(prk: bytes, info: bytes, length: int) -> bytes:
    blocks: list[bytes] = []
    previous = b""
    counter = 1
    while len(b"".join(blocks)) < length:
        previous = hmac.new(prk, previous + info + bytes([counter]), hashlib.sha256).digest()
        blocks.append(previous)
        counter += 1
    return b"".join(blocks)[:length]


def derive_auth_secret(username: str, password: str) -> str:
    salt = f"fromchat.user:{username}".encode("utf-8")
    prk = _hkdf_extract(salt, password.encode("utf-8"))
    okm = _hkdf_expand(prk, b"auth-secret", 32)
    return base64.b64encode(okm).decode("utf-8")


def _read_single_key() -> str:
    try:  # Windows
        import msvcrt  # type: ignore

        ch = msvcrt.getch()
        return ch.decode("utf-8", errors="ignore").lower()
    except ImportError:
        import termios
        import tty

        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setraw(fd)
            ch = sys.stdin.read(1)
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        return ch.lower()


class AdminCLI:
    def __init__(self, api_url: str) -> None:
        self.console = Console()
        self.api_url = api_url.rstrip("/")
        self.client = httpx.Client(base_url=self.api_url, timeout=30.0)
        self.username: Optional[str] = None
        self.token: Optional[str] = None

    # --------------------------- HTTP helpers --------------------------- #
    def _auth_headers(self) -> dict:
        headers: dict = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _request(self, method: str, path: str, *, auth: bool = True, **kwargs) -> httpx.Response:
        rel_path = path.lstrip("/")
        headers = kwargs.pop("headers", {})
        if auth:
            headers.update(self._auth_headers())
        response = self.client.request(method, rel_path, headers=headers, **kwargs)
        if response.status_code >= 400:
            detail = ""
            try:
                payload = response.json()
                if isinstance(payload, dict):
                    detail = payload.get("detail") or payload.get("message") or ""
            except Exception:
                detail = response.text
            message = f"{response.status_code} {response.reason_phrase}"
            if detail:
                message = f"{message}: {detail}"
            raise CLIError(message.strip())
        return response

    # --------------------------- CLI primitives ------------------------- #
    def _require_auth(self) -> None:
        if not self.token:
            raise CLIError("You must login before running this command.")

    def _resolve_user(self, identifier: str) -> dict:
        self._require_auth()
        if identifier.isdigit():
            response = self._request("GET", f"user/id/{identifier}")
        else:
            response = self._request("GET", f"user/{identifier.replace('@', '')}")
        return response.json()

    def _confirm(self, prompt: str) -> bool:
        self.console.print(f"[bold yellow]{prompt}[/] [green](y)[/] / [red](n)[/]: ", end="")
        choice = _read_single_key()
        self.console.print("")  # move to next line
        return choice == "y"

    def _render_user(self, user: dict) -> None:
        table = Table(show_header=False)
        table.add_row("ID", str(user.get("id")))
        table.add_row("Username", user.get("username", ""))
        table.add_row("Display name", user.get("display_name", ""))
        table.add_row("Verified", "✅" if user.get("verified") else "❌")
        if user.get("suspended"):
            table.add_row("Suspended", f"🚫 ({user.get('suspension_reason') or 'no reason'})")
        else:
            table.add_row("Suspended", "✅ Active")
        self.console.print(table)

    # --------------------------- Commands ------------------------------- #
    def cmd_login(self, args: List[str]) -> None:
        if args:
            username = args[0]
        else:
            username = self.console.input("[bold cyan]Username[/]: ").strip()
        if not username:
            raise CLIError("Username is required.")

        password = getpass("Password: ")
        derived_password = derive_auth_secret(username, password)
        payload = {"username": username, "password": derived_password}
        response = self._request("POST", "login", json=payload, auth=False)
        body = response.json()
        token = body.get("token")
        if not token:
            raise CLIError("Authentication succeeded but token was not returned.")
        self.token = token
        self.username = username
        self.console.print("[bold green]Login successful.[/]")

    def cmd_suspend(self, args: List[str]) -> None:
        if not args:
            raise CLIError("Usage: suspend <user_id|username>")
        identifier = args[0]
        user = self._resolve_user(identifier)
        self.console.print(Panel.fit("[bold red]Suspend user[/]", style="red"))
        self._render_user(user)
        reason = self.console.input("[bold yellow]Reason (press Enter to leave empty)[/]: ").strip()
        if not self._confirm(f"Confirm suspension of {user.get('username')}?"):
            self.console.print("[yellow]Suspension cancelled.[/]")
            return
        payload = {"reason": reason}
        self._request("POST", f"user/{user['id']}/suspend", json=payload)
        log_reason = reason or "no reason provided"
        self.console.print(f"[bold red]User {user['username']} suspended ({log_reason}).[/]")

    def cmd_unsuspend(self, args: List[str]) -> None:
        if not args:
            raise CLIError("Usage: unsuspend <user_id|username>")
        identifier = args[0]
        user = self._resolve_user(identifier)
        self.console.print(Panel.fit("[bold green]Unsuspend user[/]", style="green"))
        self._render_user(user)
        if not self._confirm(f"Unsuspend {user.get('username')}?"):
            self.console.print("[yellow]Unsuspension cancelled.[/]")
            return
        self._request("POST", f"user/{user['id']}/unsuspend")
        self.console.print(f"[bold green]User {user['username']} unsuspended.[/]")

    def cmd_block_word(self, args: List[str]) -> None:
        if not args:
            raise CLIError("Usage: block-word <word or phrase> [additional words...]")
        self._require_auth()
        words = args
        response = self._request("POST", "moderation/blocklist", json={"words": words})
        data = response.json()
        added = data.get("added", [])
        current = data.get("words", [])
        if added:
            self.console.print(f"[bold green]Added {len(added)} entr{'y' if len(added)==1 else 'ies'} to blocklist.[/]")
        else:
            self.console.print("[yellow]No new words added.[/]")
        self.console.print(f"Blocklist size: {len(current)}")

    def cmd_list_users(self) -> None:
        self._require_auth()
        payload = self._request("GET", "user/list").json()
        users = payload.get("users", [])
        table = Table(title="Users", show_lines=False)
        table.add_column("ID")
        table.add_column("Username")
        table.add_column("Display name")
        table.add_column("Suspended")
        for user in users:
            table.add_row(
                str(user.get("id")),
                user.get("username", ""),
                user.get("display_name", ""),
                "🚫" if user.get("suspended") else "✅",
            )
        self.console.print(table)

    def cmd_user(self, args: List[str]) -> None:
        if not args:
            raise CLIError("Usage: user <user_id|username>")
        user = self._resolve_user(args[0])
        self._render_user(user)

    def cmd_delete(self, args: List[str]) -> None:
        if not args:
            raise CLIError("Usage: delete <user_id|username>")
        user = self._resolve_user(args[0])
        self.console.print(Panel.fit("[bold red]Delete user[/]", style="red"))
        self._render_user(user)
        if not self._confirm(f"Permanently delete {user.get('username')}?"):
            self.console.print("[yellow]Deletion cancelled.[/]")
            return
        self._request("POST", f"user/{user['id']}/delete")
        self.console.print(f"[bold red]User {user['username']} deleted.[/]")

    def cmd_unblock_word(self, args: List[str]) -> None:
        if not args:
            raise CLIError("Usage: unblock-word <word or phrase> [additional words...]")
        self._require_auth()
        response = self._request("DELETE", "moderation/blocklist", json={"words": args})
        data = response.json()
        removed = data.get("removed", [])
        current = data.get("words", [])
        if removed:
            self.console.print(f"[bold green]Removed {len(removed)} entr{'y' if len(removed)==1 else 'ies'} from blocklist.[/]")
        else:
            self.console.print("[yellow]No matching words removed.[/]")
        self.console.print(f"Blocklist size: {len(current)}")

    def cmd_verify(self, args: List[str]) -> None:
        if not args:
            raise CLIError("Usage: verify <user_id|username>")
        user = self._resolve_user(args[0])
        if user.get("verified"):
            self.console.print(f"[yellow]{user['username']} is already verified.[/]")
            return
        self._request("POST", f"user/{user['id']}/verify")
        self.console.print(f"[bold green]{user['username']} marked as verified.[/]")

    def cmd_unverify(self, args: List[str]) -> None:
        if not args:
            raise CLIError("Usage: unverify <user_id|username>")
        user = self._resolve_user(args[0])
        if not user.get("verified"):
            self.console.print(f"[yellow]{user['username']} is already unverified.[/]")
            return
        self._request("POST", f"user/{user['id']}/verify")
        self.console.print(f"[bold green]{user['username']} is now unverified.[/]")

    def cmd_list_blocklist(self) -> None:
        self._require_auth()
        response = self._request("GET", "moderation/blocklist")
        words = response.json().get("words", [])
        if not words:
            self.console.print("[cyan]Blocklist is empty.[/]")
            return
        table = Table(title="Blocked Words", show_lines=True)
        table.add_column("Word / Phrase")
        for entry in words:
            table.add_row(entry)
        self.console.print(table)

    def cmd_unblock_ip(self, args: List[str]) -> None:
        if not args:
            raise CLIError("Usage: unblock-ip <ip_address>")
        self._require_auth()
        ip = args[0].strip()
        if not ip:
            raise CLIError("IP address cannot be empty")
        response = self._request("POST", "moderation/unblock-ip", json={"ip": ip})
        data = response.json()
        message = data.get("message", "IP unblocked")
        self.console.print(f"[bold green]{message}[/]")

    def cmd_clear_all_rate_limits(self) -> None:
        """Clear all rate limit entries. Use with caution."""
        self._require_auth()
        if not self._confirm("Clear ALL rate limit entries? This affects all IPs."):
            self.console.print("[yellow]Operation cancelled.[/]")
            return
        response = self._request("POST", "moderation/clear-all-rate-limits")
        data = response.json()
        message = data.get("message", "Rate limits cleared")
        self.console.print(f"[bold green]{message}[/]")

    def cmd_help(self) -> None:
        cmds = {
            "login [username]": "Authenticate as owner/admin.",
            "suspend <user>": "Suspend account (alias: ban).",
            "unsuspend <user>": "Unsuspend account (alias: unban).",
            "delete <user>": "Permanently delete the user account.",
            "verify <user>": "Mark user as verified.",
            "unverify <user>": "Remove verification flag.",
            "block-word <words>": "Add words/phrases to chat filter.",
            "unblock-word <words>": "Remove words/phrases from filter.",
            "blocklist": "Show current blocklist.",
            "unblock-ip <ip>": "Unblock an IP address from rate limiting.",
            "clear-all-rate-limits": "Clear all rate limit entries (use with caution).",
            "list": "List all users.",
            "user <user>": "Show detailed user information.",
            "whoami": "Display current session context.",
            "help": "Show this help panel.",
            "exit": "Quit the CLI.",
        }
        table = Table(title="Available Commands")
        table.add_column("Command", style="cyan")
        table.add_column("Description", style="white")
        for cmd, desc in cmds.items():
            table.add_row(cmd, desc)
        self.console.print(table)

    def cmd_whoami(self) -> None:
        if not self.token:
            self.console.print("[yellow]Not authenticated.[/]")
            return
        self.console.print(f"[green]Logged in as[/] [bold]{self.username}[/] ({self.api_url})")

    # --------------------------- Main loop ------------------------------ #
    def run(self) -> None:
        self.console.print(Panel.fit("[bold magenta]FromChat Admin CLI[/]", style="magenta"))
        while True:
            prompt_identity = self.username or "guest"
            try:
                prompt_str = f"\033[36m{prompt_identity}\033[0m \033[1m>\033[0m "
                raw = input(prompt_str).strip()
            except (KeyboardInterrupt, EOFError):
                self.console.print("\n[red]Exiting...[/]")
                break

            if not raw:
                continue

            try:
                parts = shlex.split(raw)
            except ValueError as exc:
                self.console.print(f"[red]Parse error:[/] {exc}")
                continue

            command = parts[0].lstrip("/").lower()
            args = parts[1:]

            if command in {"exit", "quit"}:
                self.console.print("[red]Goodbye.[/]")
                break

            try:
                if command == "login":
                    self.cmd_login(args)
                elif command in {"suspend", "ban"}:
                    self.cmd_suspend(args)
                elif command in {"unsuspend", "unban"}:
                    self.cmd_unsuspend(args)
                elif command == "block-word":
                    self.cmd_block_word(args)
                elif command == "unblock-word":
                    self.cmd_unblock_word(args)
                elif command == "blocklist":
                    self.cmd_list_blocklist()
                elif command == "unblock-ip":
                    self.cmd_unblock_ip(args)
                elif command == "clear-all-rate-limits":
                    self.cmd_clear_all_rate_limits()
                elif command == "verify":
                    self.cmd_verify(args)
                elif command == "unverify":
                    self.cmd_unverify(args)
                elif command in {"delete", "remove"}:
                    self.cmd_delete(args)
                elif command == "list":
                    self.cmd_list_users()
                elif command == "user":
                    self.cmd_user(args)
                elif command == "help":
                    self.cmd_help()
                elif command == "whoami":
                    self.cmd_whoami()
                else:
                    self.console.print("[yellow]Unknown command. Type /help for a list of commands.[/]")
            except CLIError as err:
                self.console.print(f"[red]Error:[/] {err}")
            except httpx.RequestError as err:
                self.console.print(f"[red]Network error:[/] {err}")

        self.client.close()


def main(argv: Optional[Iterable[str]] = None) -> None:
    parser = argparse.ArgumentParser(description="FromChat Emergency Admin CLI")
    parser.add_argument(
        "--api-url",
        default=os.getenv("FC_ADMIN_API_URL", "http://127.0.0.1:8300"),
        help="Base API URL for the FromChat backend (default: %(default)s).",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)
    cli = AdminCLI(args.api_url)
    cli.run()


if __name__ == "__main__":
    main()


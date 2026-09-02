"""Local LLM, web-search, and lifecycle integration for PiDog."""

from __future__ import annotations

import json
import os
import pwd
import re
import shutil
import subprocess
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .constants import LOG


class AssistantUnavailableError(RuntimeError):
    """Raised when the local assistant cannot complete a request."""


class AssistantManager:
    """Talks to a loopback-only llama.cpp server and fixed search backends."""

    def __init__(self, dry_run: bool = False) -> None:
        self._dry_run = dry_run
        runtime_home = self._runtime_home()
        self._base_url = os.environ.get("PIDOG_LLM_URL", "http://127.0.0.1:8081").rstrip("/")
        self._unit = os.environ.get("PIDOG_LLM_UNIT", "pidog-llm.service")
        self._model_name = os.environ.get("PIDOG_LLM_NAME", "Qwen3.5-2B Q4_K_M")
        self._model_path = Path(os.environ.get(
            "PIDOG_LLM_MODEL",
            str(runtime_home / ".local/share/pidog-llm/models/Qwen3.5-2B-Q4_K_M.gguf"),
        )).expanduser()
        self._server_path = Path(os.environ.get(
            "PIDOG_LLM_SERVER", str(runtime_home / ".local/bin/llama-server")
        )).expanduser()
        self._search_python = Path(os.environ.get(
            "PIDOG_SEARCH_PYTHON",
            str(runtime_home / ".local/share/pidog-llm/search-venv/bin/python"),
        )).expanduser()
        self._piper_path = Path(os.environ.get(
            "PIDOG_PIPER_BIN",
            str(runtime_home / ".local/share/pidog-llm/piper-venv/bin/piper"),
        )).expanduser()
        self._voice_path = Path(os.environ.get(
            "PIDOG_PIPER_MODEL",
            str(runtime_home / ".local/share/pidog-llm/voices/ru_RU-irina-medium.onnx"),
        )).expanduser()
        self._search_worker = Path(__file__).with_name("search_worker.py")
        # Keep just the two most recent exchanges. On a Pi 4, a short prompt history
        # materially improves response time and still preserves conversational context.
        self._history: deque[dict[str, str]] = deque(maxlen=4)
        self._chat_lock = threading.Lock()
        self._status_lock = threading.Lock()
        self._cached_status: tuple[float, dict[str, Any]] | None = None
        self._last_error: str | None = None

    @property
    def status(self) -> dict[str, Any]:
        if self._dry_run:
            return {
                "installed": True, "running": True, "state": "dry-run",
                "model": self._model_name, "context_tokens": 2048,
                "web_search": {"available": True, "provider": "dry-run"},
                "tts": {"ready": True, "voice": "dry-run"},
            }
        with self._status_lock:
            now = time.monotonic()
            if self._cached_status and now - self._cached_status[0] < 1:
                return dict(self._cached_status[1])

            installed = self._server_path.is_file() and self._model_path.is_file()
            running = self._llm_ready(timeout=0.7)
            service_state = "running" if running else self._systemd_state()
            if service_state == "active" and not running:
                service_state = "starting"
            search_available = self._search_python.is_file() and self._search_worker.is_file()
            piper = self._piper_path if self._piper_path.is_file() else shutil.which("piper")
            voice = self._voice_path
            result: dict[str, Any] = {
                "installed": installed,
                "running": running,
                "state": service_state,
                "model": self._model_name,
                "model_bytes": self._model_path.stat().st_size if self._model_path.is_file() else None,
                "context_tokens": 2048,
                "endpoint": "loopback-only",
                "web_search": {
                    "available": search_available,
                    "provider": self._search_provider() if search_available else "unavailable",
                },
                "tts": {
                    "ready": bool(piper and voice.is_file()),
                    "voice": voice.stem if voice.is_file() else "not installed",
                },
                "busy": self._chat_lock.locked(),
            }
            if self._last_error:
                result["last_error"] = self._last_error
            self._cached_status = (now, result)
            return dict(result)

    def control(self, action: str) -> dict[str, Any]:
        if action not in {"start", "stop", "restart"}:
            raise ValueError("unknown assistant action")
        if self._dry_run:
            return {"message": f"dry-run: {action}", "assistant": self.status}
        if not self._server_path.is_file() or not self._model_path.is_file():
            raise AssistantUnavailableError("локальная модель ещё не установлена")
        try:
            completed = subprocess.run(
                ["systemctl", "--user", action, self._unit],
                capture_output=True, text=True, timeout=15, check=False,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            raise AssistantUnavailableError(f"не удалось управлять LLM: {error}") from error
        if completed.returncode != 0:
            detail = (completed.stderr or completed.stdout).strip()[-400:]
            raise AssistantUnavailableError(detail or "systemd отклонил команду")
        self._invalidate_status()
        if action in {"start", "restart"}:
            deadline = time.monotonic() + 25
            while time.monotonic() < deadline:
                if self._llm_ready(timeout=0.8):
                    break
                time.sleep(0.5)
        self._invalidate_status()
        messages = {
            "start": "Локальная LLM запущена",
            "stop": "Локальная LLM остановлена",
            "restart": "Локальная LLM перезапущена",
        }
        return {"message": messages[action], "assistant": self.status}

    def chat(self, message: str, use_web: bool | None = None) -> dict[str, Any]:
        message = " ".join(message.strip().split())
        if not message:
            raise ValueError("message is required")
        if len(message) > 600:
            raise ValueError("message is too long")
        if self._dry_run:
            return {
                "answer": f"Тестовый ответ Пайдога на вопрос: {message}",
                "sources": [], "searched": bool(use_web), "model": self._model_name,
            }
        if not self._chat_lock.acquire(blocking=False):
            raise AssistantUnavailableError("Пайдог уже отвечает на другой вопрос")
        try:
            if not self._llm_ready(timeout=1):
                raise AssistantUnavailableError("локальная LLM не запущена")
            should_search = self._needs_web(message) if use_web is None else use_web
            sources: list[dict[str, str]] = []
            search_warning: str | None = None
            if should_search:
                try:
                    sources = self._search(message)
                except AssistantUnavailableError as error:
                    search_warning = str(error)
                    LOG.warning("assistant web search failed: %s", error)

            answer = self._complete(message, sources)
            self._history.append({"role": "user", "content": message})
            self._history.append({"role": "assistant", "content": answer})
            self._last_error = None
            result: dict[str, Any] = {
                "answer": answer,
                "sources": sources,
                "searched": should_search,
                "model": self._model_name,
            }
            if search_warning:
                result["search_warning"] = search_warning
            return result
        except AssistantUnavailableError as error:
            self._last_error = str(error)
            self._invalidate_status()
            raise
        finally:
            self._chat_lock.release()

    def clear_history(self) -> dict[str, Any]:
        self._history.clear()
        return {"message": "История диалога очищена"}

    def _complete(self, question: str, sources: list[dict[str, str]]) -> str:
        system = (
            "Ты Пайдог — дружелюбный робот-пёс. Отвечай на языке пользователя, "
            "обычно 1–4 короткими предложениями. Не выдумывай факты. Ты не управляешь "
            "мотором и не выполняешь команды робота: движение обрабатывает отдельный "
            "безопасный контроллер. Ты работаешь локально на Raspberry Pi внутри Пайдога; "
            "интернет используется только отдельным веб-поиском по просьбе пользователя. "
            "Если даны результаты поиска, опирайся только на них "
            "для свежих фактов и ставь ссылки вида [1], [2]. Если данных недостаточно, "
            "честно скажи об этом. Не показывай внутренние рассуждения."
        )
        user_content = question
        if sources:
            lines = ["Результаты веб-поиска:"]
            for index, item in enumerate(sources, 1):
                lines.append(f"[{index}] {item['title']}\n{item['snippet']}\n{item['url']}")
            user_content = "\n\n".join(lines) + f"\n\nВопрос: {question}"

        messages = [{"role": "system", "content": system}]
        messages.extend(list(self._history))
        messages.append({"role": "user", "content": user_content})
        payload = json.dumps({
            "model": self._model_name,
            "messages": messages,
            "temperature": 0.55,
            "top_p": 0.85,
            "max_tokens": 80,
            "repeat_penalty": 1.1,
            "chat_template_kwargs": {"enable_thinking": False},
            "stream": False,
        }, ensure_ascii=False).encode("utf-8")
        request = Request(
            f"{self._base_url}/v1/chat/completions", data=payload, method="POST",
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        try:
            with urlopen(request, timeout=120) as response:
                data = json.load(response)
            answer = data["choices"][0]["message"]["content"].strip()
        except (HTTPError, URLError, TimeoutError, KeyError, IndexError,
                TypeError, ValueError) as error:
            raise AssistantUnavailableError(f"LLM не смогла ответить: {error}") from error
        answer = re.sub(r"<think>.*?</think>", "", answer, flags=re.DOTALL).strip()
        if not answer:
            raise AssistantUnavailableError("LLM вернула пустой ответ")
        return answer[:4000]

    def _search(self, query: str) -> list[dict[str, str]]:
        if not self._search_python.is_file() or not self._search_worker.is_file():
            raise AssistantUnavailableError("веб-поиск не установлен")
        environment = os.environ.copy()
        try:
            completed = subprocess.run(
                [str(self._search_python), str(self._search_worker), query],
                capture_output=True, text=True, timeout=20, check=False, env=environment,
            )
        except (OSError, subprocess.TimeoutExpired) as error:
            raise AssistantUnavailableError(f"веб-поиск недоступен: {error}") from error
        if completed.returncode != 0:
            detail = completed.stderr.strip()[-300:]
            raise AssistantUnavailableError(detail or "поиск не вернул результатов")
        try:
            raw_results = json.loads(completed.stdout)
        except json.JSONDecodeError as error:
            raise AssistantUnavailableError("поиск вернул повреждённый ответ") from error
        results: list[dict[str, str]] = []
        for item in raw_results[:4]:
            title = " ".join(str(item.get("title", "")).split())[:180]
            url = str(item.get("href") or item.get("url") or "").strip()[:800]
            snippet = " ".join(str(item.get("body") or item.get("snippet") or "").split())[:240]
            if title and url.startswith(("http://", "https://")):
                results.append({"title": title, "url": url, "snippet": snippet})
        if not results:
            raise AssistantUnavailableError("поиск не нашёл подходящих источников")
        return results

    def _llm_ready(self, timeout: float) -> bool:
        try:
            with urlopen(f"{self._base_url}/health", timeout=timeout) as response:
                if response.status != 200:
                    return False
                data = json.load(response)
                return data.get("status") == "ok"
        except (OSError, ValueError):
            return False

    def _systemd_state(self) -> str:
        try:
            completed = subprocess.run(
                ["systemctl", "--user", "is-active", self._unit],
                capture_output=True, text=True, timeout=3, check=False,
            )
            value = completed.stdout.strip()
            return value if value in {
                "active", "inactive", "activating", "deactivating", "failed"
            } else "stopped"
        except (OSError, subprocess.TimeoutExpired):
            return "unknown"

    def _search_provider(self) -> str:
        if os.environ.get("BRAVE_SEARCH_API_KEY"):
            return "Brave Search"
        if os.environ.get("PIDOG_SEARXNG_URL"):
            return "SearXNG"
        return "DDGS"

    @staticmethod
    def _runtime_home() -> Path:
        """Return the Pi user's home even when the API runs as root."""
        explicit_home = os.environ.get("PIDOG_RUNTIME_HOME")
        if explicit_home:
            return Path(explicit_home).expanduser()
        user = os.environ.get("PIDOG_USER")
        if user:
            try:
                return Path(pwd.getpwnam(user).pw_dir)
            except KeyError:
                LOG.warning("PIDOG_USER does not exist while locating assistant files: %s", user)
        return Path.home()

    @staticmethod
    def _needs_web(message: str) -> bool:
        normalized = message.lower()
        markers = (
            "сегодня", "сейчас", "последн", "новост", "погод", "курс ", "цена",
            "расписан", "кто президент", "кто сейчас", "найди", "поищи", "интернет",
            "today", "latest", "current", "news", "weather", "price", "search",
        )
        return any(marker in normalized for marker in markers)

    def _invalidate_status(self) -> None:
        with self._status_lock:
            self._cached_status = None

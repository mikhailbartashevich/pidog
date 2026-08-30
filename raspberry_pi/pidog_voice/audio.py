"""Audio playback support for the PiDog controller."""

from __future__ import annotations

import os
import pwd
import shutil
import subprocess
from pathlib import Path
from typing import Any, Callable

from .constants import AUDIO_FILES, LOG


class AudioUnavailableError(RuntimeError):
    """Raised when PiDog cannot play one of its bundled sound effects."""


class _DeferredMusic:
    """Placeholder for PiDog's unused pygame player; SoX handles all audio."""



class AudioMixin:
    def _bark(self) -> None:
        self._require_audio()
        from pidog.preset_actions import bark

        self._play_with_speaker(lambda: bark(self._dog, volume=100))

    def _howl(self) -> dict[str, Any]:
        self._require_audio()
        from pidog.preset_actions import howling

        self._play_with_speaker(lambda: howling(self._dog, volume=100))
        return {"message": "Пайдог воет"}

    def _prepare_audio(self) -> None:
        """Prepare PiDog's sound path under systemd and leave the amp muted.

        Upstream PiDog derives SOUND_DIR from LOGNAME/SUDO_USER. A system unit
        runs as root, so it incorrectly uses /root/pidog/sounds even when the
        official repository (and its sound files) belongs to a user in /home.
        PiDog's pygame backend may initialize without errors but remain silent
        under systemd. The working Robot HAT path is SoX -> ALSA `robothat`.
        """
        self._audio_ready = False
        self._audio_error = None
        self._sound_dir = None
        try:
            sound_dir = self._find_sound_dir()
            if sound_dir is None:
                raise AudioUnavailableError(
                    "не найдены single_bark_1 и howling; задайте PIDOG_SOUND_DIR"
                )

            self._audio_player = shutil.which("play")
            if self._audio_player is None:
                raise AudioUnavailableError("не найден SoX play; установите пакет sox")

            self._dog.SOUND_DIR = f"{sound_dir}{os.sep}"
            self._sound_dir = sound_dir
            self._audio_ready = True
            LOG.info("PiDog audio ready sound_dir=%s backend=sox device=%s", sound_dir,
                     os.environ.get("PIDOG_ALSA_DEVICE", "robothat"))
        except Exception as error:
            self._audio_error = str(error) or error.__class__.__name__
            LOG.error("PiDog audio is unavailable: %s", self._audio_error)
        finally:
            self._disable_speaker()

    @staticmethod
    def _enable_speaker() -> None:
        # device.enable_speaker is the current robot-hat API; utils is retained
        # as a fallback for older images shipped with PiDog.
        try:
            from robot_hat.device import enable_speaker
        except ImportError:
            from robot_hat.utils import enable_speaker

        enable_speaker()

    @staticmethod
    def _disable_speaker() -> None:
        # device.disable_speaker is the current robot-hat API; utils is retained
        # as a fallback for older images shipped with PiDog.
        try:
            from robot_hat.device import disable_speaker
        except ImportError:
            from robot_hat.utils import disable_speaker

        disable_speaker()

    def _play_with_speaker(self, action: Callable[[], Any]) -> None:
        """Run a preset action while routing its speak() calls through ALSA."""
        had_instance_speak = "speak" in vars(self._dog)
        previous_instance_speak = vars(self._dog).get("speak")
        self._audio_processes = []
        self._enable_speaker()
        self._dog.speak = self._speak_via_alsa
        try:
            action()
            self._wait_for_audio_processes()
        finally:
            self._stop_audio_processes()
            if had_instance_speak:
                self._dog.speak = previous_instance_speak
            else:
                delattr(self._dog, "speak")
            self._disable_speaker()

    def _speak_via_alsa(self, name: str, volume: int = 100) -> bool:
        sound_path = self._resolve_sound_file(name)
        if sound_path is None:
            raise AudioUnavailableError(f"не найден звуковой файл: {name}")
        if self._audio_player is None:
            raise AudioUnavailableError("SoX play не настроен")

        level = max(0, min(100, int(volume))) / 100
        environment = os.environ.copy()
        environment["AUDIODEV"] = os.environ.get("PIDOG_ALSA_DEVICE", "robothat")
        process = subprocess.Popen(
            [self._audio_player, "-q", "-v", f"{level:.2f}", str(sound_path)],
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
            env=environment,
        )
        self._audio_processes.append(process)
        return True

    def _resolve_sound_file(self, name: str) -> Path | None:
        direct = Path(name).expanduser()
        if direct.is_file():
            return direct.resolve()
        if self._sound_dir is None:
            return None
        for suffix in ("mp3", "wav"):
            candidate = self._sound_dir / f"{name}.{suffix}"
            if candidate.is_file():
                return candidate.resolve()
        return None

    def _wait_for_audio_processes(self) -> None:
        processes = list(self._audio_processes)
        self._audio_processes.clear()
        for process in processes:
            try:
                _, error_output = process.communicate(timeout=30)
            except subprocess.TimeoutExpired as error:
                process.terminate()
                process.communicate(timeout=2)
                raise AudioUnavailableError("таймаут воспроизведения звука") from error
            if process.returncode != 0:
                detail = (error_output or "").strip()
                raise AudioUnavailableError(
                    detail[-300:] or f"SoX завершился с кодом {process.returncode}")

    def _stop_audio_processes(self) -> None:
        processes = list(self._audio_processes)
        self._audio_processes.clear()
        for process in processes:
            if process.poll() is None:
                process.terminate()
            try:
                process.communicate(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate()

    @staticmethod
    def _configure_pidog_user() -> None:
        """Restore SUDO_USER when a root systemd unit imports upstream PiDog."""
        if os.geteuid() != 0 or os.environ.get("SUDO_USER"):
            return

        configured = os.environ.get("PIDOG_USER")
        if configured:
            try:
                pwd.getpwnam(configured)
            except KeyError:
                LOG.warning("PIDOG_USER does not exist: %s", configured)
            else:
                os.environ["SUDO_USER"] = configured
                LOG.info("PiDog runtime user=%s (from PIDOG_USER)", configured)
                return

        matching_accounts = []
        for account in pwd.getpwall():
            sound_dir = Path(account.pw_dir) / "pidog" / "sounds"
            if all(RobotController._has_sound(sound_dir, name) for name in AUDIO_FILES):
                matching_accounts.append(account)
        if not matching_accounts:
            return

        # Prefer the conventional Raspberry Pi account if several home folders
        # contain old clones; otherwise use the first normal (non-system) user.
        account = next((item for item in matching_accounts if item.pw_name == "pi"),
                       matching_accounts[0])
        os.environ["SUDO_USER"] = account.pw_name
        LOG.info("PiDog runtime user=%s (detected from %s)", account.pw_name,
                 Path(account.pw_dir) / "pidog" / "sounds")

    def _find_sound_dir(self) -> Path | None:
        candidates: list[Path] = []
        configured = os.environ.get("PIDOG_SOUND_DIR")
        if configured:
            candidates.append(Path(configured).expanduser())

        current = getattr(self._dog, "SOUND_DIR", None)
        if current:
            candidates.append(Path(current).expanduser())

        try:
            import pidog as pidog_package

            package_dir = Path(pidog_package.__file__).resolve().parent
            candidates.extend((package_dir / "sounds", package_dir.parent / "sounds"))
        except (ImportError, TypeError, OSError):
            pass

        # Official installation clones the repository into ~/pidog and then
        # installs the Python package. Check every local user's clone because a
        # root system service cannot infer which home owns it.
        for account in pwd.getpwall():
            if account.pw_dir and account.pw_dir != "/root":
                candidates.append(Path(account.pw_dir) / "pidog" / "sounds")
        candidates.extend((Path("/opt/pidog/sounds"), Path("/usr/local/share/pidog/sounds")))

        seen: set[Path] = set()
        for candidate in candidates:
            try:
                candidate = candidate.resolve()
            except OSError:
                continue
            if candidate in seen:
                continue
            seen.add(candidate)
            if all(self._has_sound(candidate, name) for name in AUDIO_FILES):
                return candidate
        return None

    @staticmethod
    def _has_sound(directory: Path, name: str) -> bool:
        return any((directory / f"{name}.{suffix}").is_file()
                   for suffix in ("mp3", "wav"))

    def _require_audio(self) -> None:
        # A missing mount or a temporarily unavailable ALSA device may recover
        # after service startup, so retry preparation on the next sound command.
        if not self._audio_ready:
            self._prepare_audio()
        if not self._audio_ready:
            raise AudioUnavailableError(self._audio_error or "аудио недоступно")



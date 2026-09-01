# PiDog server — Raspberry Pi 5 8GB + AI HAT+ 2 8GB

Это отдельный сетап для официальной Raspberry Pi AI HAT+ 2 (в разговорной форме часто называют «AI HAT 2+»). Он использует Hailo-10H для локальной LLM через `hailo-ollama`; управление моторами, аудио, сенсорами и HTTP API остаётся в PiDog-сервере.

## Что нужно

- Raspberry Pi 5 8GB с 64-битной Raspberry Pi OS Trixie;
- AI HAT+ 2 с Hailo-10H;
- активное охлаждение Raspberry Pi 5 и штатный радиатор AI HAT+ 2;
- установленный официальный стек SunFounder: `robot_hat`, `vilib`, `pidog`;
- камера и звуки PiDog — только если нужны функции камеры и bark/howl.

Для AI HAT+ 2 ручная настройка PCIe Gen 3 не нужна: она применяется автоматически. После физической сборки сначала обновите ОС и установите Hailo-пакеты.

## Установка на Raspberry Pi

Скопируйте каталог `raspberry_pi/` на Pi, сохранив `AI_HAT_2/`, `common/` и root-файл `pidog_voice_server.py`, и выполните:

```bash
cd AI_HAT_2
sudo ./install.sh
```

Скрипт устанавливает `hailo-h10-all`, системные зависимости и пакет Hailo GenAI Model Zoo 5.1.1; запускает `hailo-ollama` только на `127.0.0.1:8000`; скачивает модель `qwen2:1.5b`; ставит PiDog API как `pidog-voice-ai-hat2.service` на порту `8765` и генерирует токен в `/etc/pidog-voice-ai-hat2.env`. После первой установки драйвера скрипт может попросить перезагрузить Pi и запустить его повторно.

Если пакет GenAI переместился, URL можно переопределить:

```bash
sudo PIDOG_HAILO_GENAI_DEB_URL='https://...' ./install.sh
```

Проверка железа и сервисов:

```bash
sudo ./check_hailo.sh
sudo systemctl status pidog-hailo-ollama pidog-voice-ai-hat2
curl --silent http://127.0.0.1:8000/hailo/v1/list
```

Сервер PiDog проверяется с токеном из env-файла:

```bash
TOKEN=$(sudo awk -F= '$1=="PIDOG_TOKEN" {print $2}' /etc/pidog-voice-ai-hat2.env)
curl --silent -H "X-PiDog-Token: $TOKEN" http://127.0.0.1:8765/health
```

## Модель и ограничения

По умолчанию выбран `qwen2:1.5b` — модель из официального примера Hailo для AI HAT+ 2. Другую модель из списка Hailo можно выбрать через `PIDOG_LLM_NAME` до установки. Порт `8000` намеренно доступен только локально; наружу выставляется только аутентифицированный PiDog API на `8765`.

Не выполняйте без необходимости `apt full-upgrade` после установки Hailo GenAI: версии драйвера, HailoRT и Model Zoo должны оставаться совместимыми.

## Обновление кода

```bash
sudo cp -a ../pidog_voice_server.py /opt/pidog-voice-ai-hat2/
sudo cp -a ../common/pidog_voice/. /opt/pidog-voice-ai-hat2/pidog_voice/
sudo cp -a pidog_voice/. /opt/pidog-voice-ai-hat2/pidog_voice/
sudo systemctl restart pidog-voice-ai-hat2
sudo journalctl -u pidog-voice-ai-hat2 -n 50 --no-pager
```

Проверить все варианты сервера из исходного каталога:

```bash
cd ..
./run_tests.sh
```

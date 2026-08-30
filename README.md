# PiDog V2 — русское голосовое управление для Android

Нативное Android-приложение распознаёт русскую речь, выбирает команду из безопасного списка и отправляет её на Raspberry Pi по локальной сети. Небольшой Python-сервер на Pi вызывает официальную библиотеку `pidog`.

## Что уже работает

- распознавание строго на русском языке (`ru-RU`);
- подсказки распознавателю с фразами PiDog на Android 13+;
- проверка до восьми вариантов распознанной фразы;
- русский словарь с вариантами «сядь», «садись», «иди вперёд», «дай лапу» и другими;
- консервативное нечёткое сравнение: сомнительная фраза не отправляется роботу;
- ручные кнопки для проверки связи и аварийная кнопка `СТОП`;
- общий секретный токен для защиты от случайных команд из локальной сети;
- серверный режим `--dry-run`, который ничего не двигает.

Поддерживаемые действия: вперёд, назад, повороты, стоп, сесть, встать, лечь, голос, хвост, покачать головой, потянуться, отжиматься, дать лапу, дать пять, выть и спать.

## 1. Запуск сервера на PiDog

Сначала должны быть установлены официальные модули `robot-hat`, `vilib` и `pidog`. Инструкция SunFounder: [Install All the Modules](https://docs.sunfounder.com/projects/pidog/en/latest/python/python_start/install_all_modules.html).

Скопируйте сервер на Raspberry Pi, затем выполните:

```bash
cd /путь/к/pidog/raspberry_pi
sudo env PIDOG_TOKEN='придумайте-длинный-пароль' python3 pidog_voice_server.py
```

Сервер слушает порт `8765`. IP-адрес робота можно узнать командой:

```bash
hostname -I
```

Для безопасной проверки без сервоприводов:

```bash
python3 pidog_voice_server.py --dry-run --host 127.0.0.1
```

### Автозапуск

В репозитории есть шаблон `raspberry_pi/pidog-voice.service`. Для него сервер должен лежать в `/opt/pidog-voice/`, а токен — в `/etc/pidog-voice.env`:

```bash
sudo mkdir -p /opt/pidog-voice
sudo cp raspberry_pi/pidog_voice_server.py /opt/pidog-voice/
```

```text
PIDOG_TOKEN=придумайте-длинный-пароль
# Обычно сервер находит звуки автоматически. Если репозиторий pidog лежит
# в другом месте, укажите каталог с single_bark_1 и howling явно:
PIDOG_SOUND_DIR=/home/pi/pidog/sounds
# Если имя владельца установки отличается от pi, его тоже можно задать явно:
PIDOG_USER=pi
# Необязательно: точный sysfs-файл внешнего питания, если он есть в системе:
PIDOG_EXTERNAL_POWER_PATH=/sys/class/power_supply/usb/online
```

После копирования и проверки путей:

```bash
sudo cp raspberry_pi/pidog-voice.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now pidog-voice
sudo systemctl status pidog-voice
```

### Если команды «Голос» и «Выть» выполняются без звука

Сервер включает усилитель только на время лая или воя, затем снова выключает
его, чтобы динамик не пищал в простое. Звуки идут через SoX и ALSA напрямую; он
ищет штатные звуки PiDog не только в домашнем каталоге `root`, но и в каталогах
обычных пользователей. Состояние аудио видно в ответе `/health` в поле `audio`.

После обновления файла сервера и unit-файла примените их:

```bash
sudo cp raspberry_pi/pidog_voice_server.py /opt/pidog-voice/
sudo cp raspberry_pi/pidog-voice.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart pidog-voice
sudo journalctl -u pidog-voice -n 50 --no-pager
```

В журнале должна появиться строка `PiDog audio ready` с найденным каталогом.
Если вместо неё указано, что звуки не найдены, задайте `PIDOG_SOUND_DIR` в
`/etc/pidog-voice.env`. Если каталог найден, но ALSA не открывается, один раз
запустите официальную настройку I2S и перезагрузите Raspberry Pi:

```bash
cd ~/robot-hat
sudo bash i2samp.sh
sudo reboot
```

## 2. Сборка Android-приложения

Требования: Android Studio или JDK 17+ и Android SDK 36. Проект использует AGP 9.3 и Gradle 9.5; JDK 17 остаётся целевой Java toolchain для максимальной совместимости Android-кода.

1. Откройте корень проекта в Android Studio.
2. Дождитесь Gradle Sync.
3. Подключите телефон с включённой USB-отладкой и нажмите Run, либо выберите **Build → Build APK(s)**.
4. APK появится в `app/build/outputs/apk/debug/app-debug.apk`.

Для командной строки:

```bash
./gradlew test assembleDebug
```

## 3. Подключение телефона

1. Телефон и PiDog должны находиться в одной Wi‑Fi сети.
2. В приложении укажите IP Raspberry Pi, порт `8765` и тот же токен.
3. Нажмите **Проверить связь**.
4. Нажмите зелёный микрофон и скажите, например: «Пидог, пожалуйста, сядь».

Для максимального качества используйте системный распознаватель Google и общую домашнюю Wi‑Fi сеть с интернетом. Если телефон подключён прямо к точке доступа PiDog без интернета, заранее скачайте русский офлайн-пакет распознавания в настройках Google Voice Typing; качество может быть ниже.

## Безопасность

Перед первыми тестами поставьте PiDog на пол с достаточным свободным местом. Сервер принимает только заранее заданные команды, ограничивает размер запроса и сравнивает токен безопасным способом. HTTP предназначен только для доверенной локальной сети; не пробрасывайте порт `8765` в интернет.

## Структура

- `app/` — Android-приложение на Java без сторонних runtime-зависимостей;
- `app/src/main/java/ru/pidog/voice/CommandParser.java` — словарь и безопасное сопоставление русских фраз;
- `raspberry_pi/pidog_voice_server.py` — HTTP-мост к библиотеке PiDog;
- `raspberry_pi/test_pidog_voice_server.py` — серверные dry-run тесты.

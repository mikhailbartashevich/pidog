# PiDog Raspberry Pi setup V4

Это снимок текущего Raspberry Pi сетапа на момент подготовки новой конфигурации для AI HAT+ 2. В V4 сохранены исходные systemd-файлы, env-настройки и локальный CPU `llama.cpp` installer. Общий CPU runtime и единственный entry point находятся в родительском каталоге: `../common/` и `../pidog_voice_server.py`; общий тестовый набор — `../test_pidog_voice_server.py`.

Для новой платы Raspberry Pi 5 + AI HAT+ 2 используйте соседнюю папку `../AI_HAT_2/`.

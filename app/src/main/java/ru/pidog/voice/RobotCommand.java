package ru.pidog.voice;

public enum RobotCommand {
    STOP("stop", "Стоп", "Stop"),
    FORWARD("forward", "Вперёд", "Move forward"),
    BACKWARD("backward", "Назад", "Move backward"),
    TURN_LEFT("turn_left", "Повернуть налево", "Turn left"),
    TURN_RIGHT("turn_right", "Повернуть направо", "Turn right"),
    SIT("sit", "Сесть", "Sit"),
    STAND("stand", "Встать", "Stand"),
    LIE("lie", "Лечь", "Lie down"),
    BARK("bark", "Подать голос", "Bark"),
    WAG_TAIL("wag_tail", "Вилять хвостом", "Wag tail"),
    SHAKE_HEAD("shake_head", "Покачать головой", "Shake head"),
    NOD_YES("nod_yes", "Кивнуть: да", "Nod yes"),
    STRETCH("stretch", "Потянуться", "Stretch"),
    PUSH_UP("push_up", "Отжиматься", "Do push-ups"),
    HANDSHAKE("handshake", "Дать лапу", "Shake hands"),
    HIGH_FIVE("high_five", "Дать пять", "High-five"),
    HOWL("howl", "Выть через динамик", "Howl through speaker"),
    SLEEP("sleep", "Спать", "Sleep"),
    MEASURE_DISTANCE("measure_distance", "Измерить расстояние", "Measure distance"),
    LISTEN_SOUND("listen_sound", "Найти источник звука", "Find sound source"),
    LOCAL_VOICE_ON("local_voice_on", "Слушать через микрофон Пайдог", "Listen through PiDog microphone"),
    LOCAL_VOICE_OFF("local_voice_off", "Вернуться к микрофону телефона", "Return to phone microphone"),
    SHOW_BATTERY("show_battery", "Показать заряд светодиодами", "Show battery on LEDs"),
    FIND_ORANGE("find_orange", "Найти оранжевый и указать лапой", "Find orange and point"),
    FIND_RED("find_red", "Найти красный", "Find red"),
    FIND_YELLOW("find_yellow", "Найти жёлтый", "Find yellow"),
    FIND_GREEN("find_green", "Найти зелёный", "Find green"),
    FIND_BLUE("find_blue", "Найти синий", "Find blue"),
    FIND_PURPLE("find_purple", "Найти фиолетовый", "Find purple"),
    CAMERA_ON("camera_on", "Включить камеру", "Turn camera on"),
    CAMERA_OFF("camera_off", "Выключить камеру", "Turn camera off"),
    LIGHT_RED("light_red", "Свет: красный", "Light: red"),
    LIGHT_ORANGE("light_orange", "Свет: оранжевый", "Light: orange"),
    LIGHT_YELLOW("light_yellow", "Свет: жёлтый", "Light: yellow"),
    LIGHT_GREEN("light_green", "Свет: зелёный", "Light: green"),
    LIGHT_BLUE("light_blue", "Свет: синий", "Light: blue"),
    LIGHT_PURPLE("light_purple", "Свет: фиолетовый", "Light: purple"),
    LIGHT_PINK("light_pink", "Свет: розовый", "Light: pink"),
    LIGHT_CYAN("light_cyan", "Свет: голубой", "Light: cyan"),
    LIGHT_WHITE("light_white", "Свет: белый", "Light: white"),
    LIGHT_BLINK("light_blink", "Свет: мигать", "Blink lights"),
    LIGHT_OFF("light_off", "Выключить свет", "Turn lights off");

    public final String wireName;
    public final String displayName;
    private final String englishDisplayName;

    RobotCommand(String wireName, String displayName, String englishDisplayName) {
        this.wireName = wireName;
        this.displayName = displayName;
        this.englishDisplayName = englishDisplayName;
    }

    public String displayName(String languageTag) {
        return languageTag != null && languageTag.startsWith("en")
                ? englishDisplayName : displayName;
    }
}

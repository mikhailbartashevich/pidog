package ru.pidog.voice;

public enum RobotCommand {
    STOP("stop", "Стоп"),
    FORWARD("forward", "Вперёд"),
    BACKWARD("backward", "Назад"),
    TURN_LEFT("turn_left", "Повернуть налево"),
    TURN_RIGHT("turn_right", "Повернуть направо"),
    SIT("sit", "Сесть"),
    STAND("stand", "Встать"),
    LIE("lie", "Лечь"),
    BARK("bark", "Подать голос"),
    WAG_TAIL("wag_tail", "Вилять хвостом"),
    SHAKE_HEAD("shake_head", "Покачать головой"),
    NOD_YES("nod_yes", "Кивнуть: да"),
    STRETCH("stretch", "Потянуться"),
    PUSH_UP("push_up", "Отжиматься"),
    HANDSHAKE("handshake", "Дать лапу"),
    HIGH_FIVE("high_five", "Дать пять"),
    HOWL("howl", "Выть через динамик"),
    SLEEP("sleep", "Спать"),
    MEASURE_DISTANCE("measure_distance", "Измерить расстояние"),
    LISTEN_SOUND("listen_sound", "Найти источник звука"),
    SHOW_BATTERY("show_battery", "Показать заряд светодиодами"),
    FIND_ORANGE("find_orange", "Найти оранжевый и указать лапой"),
    FIND_RED("find_red", "Найти красный"),
    FIND_YELLOW("find_yellow", "Найти жёлтый"),
    FIND_GREEN("find_green", "Найти зелёный"),
    FIND_BLUE("find_blue", "Найти синий"),
    FIND_PURPLE("find_purple", "Найти фиолетовый"),
    CAMERA_ON("camera_on", "Включить камеру"),
    CAMERA_OFF("camera_off", "Выключить камеру"),
    LIGHT_RED("light_red", "Свет: красный"),
    LIGHT_ORANGE("light_orange", "Свет: оранжевый"),
    LIGHT_YELLOW("light_yellow", "Свет: жёлтый"),
    LIGHT_GREEN("light_green", "Свет: зелёный"),
    LIGHT_BLUE("light_blue", "Свет: синий"),
    LIGHT_PURPLE("light_purple", "Свет: фиолетовый"),
    LIGHT_PINK("light_pink", "Свет: розовый"),
    LIGHT_CYAN("light_cyan", "Свет: голубой"),
    LIGHT_WHITE("light_white", "Свет: белый"),
    LIGHT_BLINK("light_blink", "Свет: мигать"),
    LIGHT_OFF("light_off", "Выключить свет");

    public final String wireName;
    public final String displayName;

    RobotCommand(String wireName, String displayName) {
        this.wireName = wireName;
        this.displayName = displayName;
    }
}

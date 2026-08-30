package ru.pidog.voice;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/** A single readable source for the grouped command screen. */
public final class CommandCatalog {
    private CommandCatalog() { }

    public static List<Group> groups() {
        return GROUPS;
    }

    public static final class Group {
        public final String russianTitle;
        public final String englishTitle;
        public final List<RobotCommand> commands;

        Group(String russianTitle, String englishTitle, RobotCommand... commands) {
            this.russianTitle = russianTitle;
            this.englishTitle = englishTitle;
            this.commands = Collections.unmodifiableList(Arrays.asList(commands));
        }

        public String title(boolean english) {
            return english ? englishTitle : russianTitle;
        }
    }

    private static final List<Group> GROUPS = Collections.unmodifiableList(Arrays.asList(
            new Group("ДВИЖЕНИЕ И БЕЗОПАСНОСТЬ", "MOVEMENT & SAFETY",
                    RobotCommand.FORWARD, RobotCommand.BACKWARD,
                    RobotCommand.TURN_LEFT, RobotCommand.TURN_RIGHT,
                    RobotCommand.APPROACH_OBSTACLE, RobotCommand.STOP),
            new Group("ПОЗЫ", "POSES",
                    RobotCommand.SIT, RobotCommand.STAND, RobotCommand.LIE,
                    RobotCommand.SLEEP, RobotCommand.STRETCH, RobotCommand.PUSH_UP),
            new Group("ЖЕСТЫ И ЗВУКИ", "GESTURES & SOUNDS",
                    RobotCommand.BARK, RobotCommand.WAG_TAIL, RobotCommand.SHAKE_HEAD,
                    RobotCommand.NOD_YES, RobotCommand.HANDSHAKE, RobotCommand.HIGH_FIVE,
                    RobotCommand.HOWL),
            new Group("КАМЕРА И ЗРЕНИЕ", "CAMERA & VISION",
                    RobotCommand.FIND_RED, RobotCommand.FIND_ORANGE,
                    RobotCommand.FIND_YELLOW, RobotCommand.FIND_GREEN,
                    RobotCommand.FIND_BLUE, RobotCommand.FIND_PURPLE,
                    RobotCommand.FOLLOW_FACE, RobotCommand.STOP_FACE_FOLLOW,
                    RobotCommand.CAMERA_ON, RobotCommand.CAMERA_OFF),
            new Group("ДАТЧИКИ", "SENSORS",
                    RobotCommand.MEASURE_DISTANCE, RobotCommand.LISTEN_SOUND,
                    RobotCommand.SHOW_BATTERY),
            new Group("ПОДСВЕТКА", "LIGHTS",
                    RobotCommand.LIGHT_RED, RobotCommand.LIGHT_ORANGE,
                    RobotCommand.LIGHT_YELLOW, RobotCommand.LIGHT_GREEN,
                    RobotCommand.LIGHT_BLUE, RobotCommand.LIGHT_PURPLE,
                    RobotCommand.LIGHT_PINK, RobotCommand.LIGHT_CYAN,
                    RobotCommand.LIGHT_WHITE, RobotCommand.LIGHT_BLINK,
                    RobotCommand.LIGHT_OFF),
            new Group("МИКРОФОН", "MICROPHONE",
                    RobotCommand.LOCAL_VOICE_ON, RobotCommand.LOCAL_VOICE_OFF)
    ));
}

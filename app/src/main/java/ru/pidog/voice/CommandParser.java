package ru.pidog.voice;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Converts imperfect Russian or English speech recognition hypotheses into a small allow-list
 * of robot commands. Conservative thresholds are intentional: an unknown phrase
 * must never start the robot moving.
 */
public final class CommandParser {
    private static final Map<RobotCommand, List<String>> RUSSIAN_ALIASES = new EnumMap<>(RobotCommand.class);
    private static final Map<RobotCommand, List<String>> ENGLISH_ALIASES = new EnumMap<>(RobotCommand.class);
    private static final Set<String> RUSSIAN_FILLERS = new HashSet<>(Arrays.asList(
            "пидог", "пайдог", "пес", "песик", "собака", "собачка", "робот",
            "эй", "ну", "давай", "пожалуйста", "команда", "теперь", "быстро"
    ));
    private static final Set<String> ENGLISH_FILLERS = new HashSet<>(Arrays.asList(
            "pidog", "pie", "dog", "puppy", "robot", "hey", "please", "command",
            "now", "quickly", "can", "you"
    ));

    static {
        put(RobotCommand.STOP,
                "стоп", "стой", "остановись", "остановиться", "замри", "не двигайся",
                "прекрати", "хватит", "останови движение");
        put(RobotCommand.FORWARD,
                "вперед", "иди вперед", "шагай вперед", "двигайся вперед", "пошел вперед",
                "прямо", "иди прямо");
        put(RobotCommand.BACKWARD,
                "назад", "иди назад", "шагай назад", "двигайся назад", "отойди назад",
                "сдай назад");
        put(RobotCommand.TURN_LEFT,
                "налево", "поверни налево", "поворот налево", "влево", "поверни влево");
        put(RobotCommand.TURN_RIGHT,
                "направо", "поверни направо", "поворот направо", "вправо", "поверни вправо");
        put(RobotCommand.SIT,
                "сидеть", "сесть", "сядь", "садись", "присядь");
        put(RobotCommand.STAND,
                "встать", "встань", "поднимись", "стой смирно", "на ноги");
        put(RobotCommand.LIE,
                "лежать", "лечь", "ляг", "ложись", "приляг");
        put(RobotCommand.BARK,
                "голос", "подай голос", "гав", "гавкни", "лай", "залаяй");
        put(RobotCommand.WAG_TAIL,
                "хвост", "виляй хвостом", "помаши хвостом", "махай хвостом");
        put(RobotCommand.SHAKE_HEAD,
                "покачай головой", "потряси головой", "качай головой");
        put(RobotCommand.NOD_YES,
                "кивни", "скажи да", "покажи да", "да головой");
        put(RobotCommand.STRETCH,
                "потянись", "растяжка", "сделай растяжку");
        put(RobotCommand.PUSH_UP,
                "отжимайся", "отожмись", "сделай отжимание", "сделай отжимания");
        put(RobotCommand.HANDSHAKE,
                "дай лапу", "лапу", "пожми руку");
        put(RobotCommand.HIGH_FIVE,
                "дай пять", "пять", "ладушки");
        put(RobotCommand.HOWL,
                "вой", "завой", "выть", "повой");
        put(RobotCommand.SLEEP,
                "спать", "засыпай", "усни", "дремать", "отдыхай");
        put(RobotCommand.MEASURE_DISTANCE,
                "измерь расстояние", "какое расстояние", "дистанция", "что впереди");
        put(RobotCommand.LISTEN_SOUND,
                "слушай звук", "найди звук", "откуда звук", "слушай хлопок");
        put(RobotCommand.LOCAL_VOICE_ON,
                "слушай меня", "слушай команды", "включи голосовое управление",
                "перейди в режим слушать", "принимай команды с микрофона");
        put(RobotCommand.LOCAL_VOICE_OFF,
                "перестань слушать", "хватит слушать", "выключи голосовое управление",
                "отключи голосовое управление", "принимай команды с телефона");
        put(RobotCommand.SHOW_BATTERY,
                "покажи заряд", "сколько заряда", "заряд батареи", "покажи батарею",
                "покажи заряд светодиодами");
        put(RobotCommand.FIND_ORANGE,
                "найди оранжевый", "покажи оранжевый", "где оранжевая банка",
                "найди оранжевую баночку", "выбери оранжевую банку");
        put(RobotCommand.FIND_RED,
                "найди красный", "покажи красный", "где красная банка");
        put(RobotCommand.FIND_YELLOW,
                "найди желтый", "покажи желтый", "где желтая банка");
        put(RobotCommand.FIND_GREEN,
                "найди зеленый", "покажи зеленый", "где зеленая банка");
        put(RobotCommand.FIND_BLUE,
                "найди синий", "покажи синий", "где синяя банка");
        put(RobotCommand.FIND_PURPLE,
                "найди фиолетовый", "покажи фиолетовый", "где фиолетовая банка");
        put(RobotCommand.CAMERA_ON,
                "включи камеру", "запусти камеру", "покажи камеру");
        put(RobotCommand.CAMERA_OFF,
                "выключи камеру", "останови камеру", "закрой камеру");
        put(RobotCommand.LIGHT_RED,
                "красный свет", "включи красный", "свети красным");
        put(RobotCommand.LIGHT_ORANGE,
                "оранжевый свет", "включи оранжевый", "свети оранжевым");
        put(RobotCommand.LIGHT_YELLOW,
                "желтый свет", "включи желтый", "свети желтым");
        put(RobotCommand.LIGHT_GREEN,
                "зеленый свет", "включи зеленый", "свети зеленым");
        put(RobotCommand.LIGHT_BLUE,
                "синий свет", "включи синий", "свети синим");
        put(RobotCommand.LIGHT_PURPLE,
                "фиолетовый свет", "включи фиолетовый", "свети фиолетовым");
        put(RobotCommand.LIGHT_PINK,
                "розовый свет", "включи розовый", "свети розовым");
        put(RobotCommand.LIGHT_CYAN,
                "голубой свет", "включи голубой", "свети голубым");
        put(RobotCommand.LIGHT_WHITE,
                "белый свет", "включи белый", "свети белым");
        put(RobotCommand.LIGHT_BLINK,
                "мигай светом", "моргай светом", "мигай лампочками");
        put(RobotCommand.LIGHT_OFF,
                "выключи свет", "погаси свет", "свет выключить");

        putEnglish(RobotCommand.STOP,
                "stop", "halt", "freeze", "stop moving", "do not move", "cancel");
        putEnglish(RobotCommand.FORWARD,
                "forward", "go forward", "move forward", "walk forward", "go straight");
        putEnglish(RobotCommand.BACKWARD,
                "back", "backward", "go back", "move backward", "step back");
        putEnglish(RobotCommand.TURN_LEFT,
                "left", "turn left", "go left", "rotate left");
        putEnglish(RobotCommand.TURN_RIGHT,
                "right", "turn right", "go right", "rotate right");
        putEnglish(RobotCommand.SIT, "sit", "sit down", "take a seat");
        putEnglish(RobotCommand.STAND, "stand", "stand up", "get up");
        putEnglish(RobotCommand.LIE, "lie", "lie down", "lay down");
        putEnglish(RobotCommand.BARK, "bark", "speak", "make a sound", "woof");
        putEnglish(RobotCommand.WAG_TAIL, "wag tail", "wag your tail", "move your tail");
        putEnglish(RobotCommand.SHAKE_HEAD, "shake head", "shake your head");
        putEnglish(RobotCommand.NOD_YES, "nod", "nod yes", "say yes");
        putEnglish(RobotCommand.STRETCH, "stretch", "do a stretch");
        putEnglish(RobotCommand.PUSH_UP, "push up", "push ups", "do push ups");
        putEnglish(RobotCommand.HANDSHAKE, "shake hands", "give paw", "paw");
        putEnglish(RobotCommand.HIGH_FIVE, "high five", "give me five");
        putEnglish(RobotCommand.HOWL, "howl", "start howling");
        putEnglish(RobotCommand.SLEEP, "sleep", "go to sleep", "take a nap", "rest");
        putEnglish(RobotCommand.MEASURE_DISTANCE,
                "measure distance", "what is the distance", "distance", "what is ahead");
        putEnglish(RobotCommand.LISTEN_SOUND,
                "listen", "listen for sound", "find sound", "where is the sound");
        putEnglish(RobotCommand.LOCAL_VOICE_ON,
                "listen to me", "listen for commands", "use your microphone",
                "turn on local voice control");
        putEnglish(RobotCommand.LOCAL_VOICE_OFF,
                "stop listening", "use the phone microphone", "turn off local voice control");
        putEnglish(RobotCommand.SHOW_BATTERY,
                "show battery", "battery level", "show charge", "how much battery");
        putEnglish(RobotCommand.FIND_ORANGE, "find orange", "show orange", "where is orange");
        putEnglish(RobotCommand.FIND_RED, "find red", "show red", "where is red");
        putEnglish(RobotCommand.FIND_YELLOW, "find yellow", "show yellow", "where is yellow");
        putEnglish(RobotCommand.FIND_GREEN, "find green", "show green", "where is green");
        putEnglish(RobotCommand.FIND_BLUE, "find blue", "show blue", "where is blue");
        putEnglish(RobotCommand.FIND_PURPLE, "find purple", "show purple", "where is purple");
        putEnglish(RobotCommand.CAMERA_ON, "turn camera on", "start camera", "show camera");
        putEnglish(RobotCommand.CAMERA_OFF, "turn camera off", "stop camera", "close camera");
        putEnglish(RobotCommand.LIGHT_RED, "red light", "turn on red", "light red");
        putEnglish(RobotCommand.LIGHT_ORANGE, "orange light", "turn on orange", "light orange");
        putEnglish(RobotCommand.LIGHT_YELLOW, "yellow light", "turn on yellow", "light yellow");
        putEnglish(RobotCommand.LIGHT_GREEN, "green light", "turn on green", "light green");
        putEnglish(RobotCommand.LIGHT_BLUE, "blue light", "turn on blue", "light blue");
        putEnglish(RobotCommand.LIGHT_PURPLE, "purple light", "turn on purple", "light purple");
        putEnglish(RobotCommand.LIGHT_PINK, "pink light", "turn on pink", "light pink");
        putEnglish(RobotCommand.LIGHT_CYAN, "cyan light", "turn on cyan", "light cyan");
        putEnglish(RobotCommand.LIGHT_WHITE, "white light", "turn on white", "light white");
        putEnglish(RobotCommand.LIGHT_BLINK, "blink lights", "flash lights", "blinking lights");
        putEnglish(RobotCommand.LIGHT_OFF, "turn lights off", "lights off", "switch off lights");
    }

    private CommandParser() {
    }

    private static void put(RobotCommand command, String... aliases) {
        List<String> normalized = new ArrayList<>();
        for (String alias : aliases) {
            normalized.add(normalize(alias));
        }
        RUSSIAN_ALIASES.put(command, Collections.unmodifiableList(normalized));
    }

    private static void putEnglish(RobotCommand command, String... aliases) {
        List<String> normalized = new ArrayList<>();
        for (String alias : aliases) {
            normalized.add(normalize(alias));
        }
        ENGLISH_ALIASES.put(command, Collections.unmodifiableList(normalized));
    }

    public static Match findBest(List<String> hypotheses) {
        return findBest(hypotheses, "ru-RU");
    }

    public static Match findBest(List<String> hypotheses, String languageTag) {
        if (hypotheses == null || hypotheses.isEmpty()) {
            return null;
        }

        Match best = null;
        Match runnerUp = null;
        int limit = Math.min(hypotheses.size(), 8);
        for (int i = 0; i < limit; i++) {
            String source = hypotheses.get(i);
            Candidate candidate = findBestCandidate(source, languageTag);
            if (candidate == null) {
                continue;
            }
            // Earlier hypotheses from the recognizer are a little more likely.
            double rankedScore = candidate.score - (i * 0.006);
            Match match = new Match(candidate.command, rankedScore, source);
            if (best == null || match.score > best.score) {
                runnerUp = best;
                best = match;
            } else if (runnerUp == null || match.score > runnerUp.score) {
                runnerUp = match;
            }
        }

        if (best == null) {
            return null;
        }
        if (runnerUp != null && runnerUp.command != best.command
                && best.score - runnerUp.score < 0.035) {
            return null;
        }
        return best;
    }

    public static Match findBest(String phrase) {
        return findBest(Collections.singletonList(phrase));
    }

    public static Match findBest(String phrase, String languageTag) {
        return findBest(Collections.singletonList(phrase), languageTag);
    }

    public static List<String> biasingPhrases() {
        return biasingPhrases("ru-RU");
    }

    public static List<String> biasingPhrases(String languageTag) {
        boolean english = isEnglish(languageTag);
        Map<RobotCommand, List<String>> aliases = english ? ENGLISH_ALIASES : RUSSIAN_ALIASES;
        List<String> phrases = new ArrayList<>();
        for (List<String> commandAliases : aliases.values()) {
            phrases.addAll(commandAliases);
        }
        phrases.add(english ? "PiDog" : "Пидог");
        return phrases;
    }

    private static Candidate findBestCandidate(String source, String languageTag) {
        boolean english = isEnglish(languageTag);
        Map<RobotCommand, List<String>> aliases = english ? ENGLISH_ALIASES : RUSSIAN_ALIASES;
        Set<String> fillers = english ? ENGLISH_FILLERS : RUSSIAN_FILLERS;
        String candidate = removeFillers(normalize(source), fillers);
        if (candidate.isEmpty()) {
            return null;
        }

        Candidate best = null;
        for (Map.Entry<RobotCommand, List<String>> entry : aliases.entrySet()) {
            for (String alias : entry.getValue()) {
                double score = score(candidate, alias);
                double threshold = isMovement(entry.getKey()) ? 0.91 : 0.86;
                if (score >= threshold && (best == null || score > best.score)) {
                    best = new Candidate(entry.getKey(), score);
                }
            }
        }
        return best;
    }

    private static double score(String candidate, String alias) {
        if (candidate.equals(alias)) {
            return 1.0;
        }

        // Negated or cancelled phrases are never fuzzily interpreted.
        if (containsToken(candidate, "не") || containsToken(candidate, "нет")
                || containsToken(candidate, "отмена") || containsToken(candidate, "not")
                || containsToken(candidate, "don") || containsToken(candidate, "never")
                || containsToken(candidate, "cancel")) {
            return 0.0;
        }

        int aliasWords = alias.split(" ").length;
        int candidateWords = candidate.split(" ").length;
        if (aliasWords >= 2 && containsPhrase(candidate, alias)) {
            return 0.965;
        }
        if (aliasWords == 1 && candidateWords <= 3 && containsToken(candidate, alias)) {
            return 0.935;
        }

        int maxLength = Math.max(candidate.length(), alias.length());
        if (maxLength == 0) {
            return 0.0;
        }
        return 1.0 - ((double) levenshtein(candidate, alias) / maxLength);
    }

    static String normalize(String value) {
        if (value == null) {
            return "";
        }
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFKC)
                .toLowerCase(new Locale("ru", "RU"))
                .replace('ё', 'е')
                .replaceAll("[^a-zа-я0-9]+", " ")
                .trim()
                .replaceAll("\\s+", " ");
        return normalized;
    }

    private static String removeFillers(String value, Set<String> fillers) {
        List<String> kept = new ArrayList<>();
        for (String token : value.split(" ")) {
            if (!fillers.contains(token)) {
                kept.add(token);
            }
        }
        return String.join(" ", kept);
    }

    private static boolean isEnglish(String languageTag) {
        return languageTag != null && languageTag.startsWith("en");
    }

    private static boolean containsPhrase(String text, String phrase) {
        return (" " + text + " ").contains(" " + phrase + " ");
    }

    private static boolean containsToken(String text, String token) {
        return containsPhrase(text, token);
    }

    private static boolean isMovement(RobotCommand command) {
        return command == RobotCommand.FORWARD
                || command == RobotCommand.BACKWARD
                || command == RobotCommand.TURN_LEFT
                || command == RobotCommand.TURN_RIGHT;
    }

    private static int levenshtein(String left, String right) {
        int[] previous = new int[right.length() + 1];
        int[] current = new int[right.length() + 1];
        for (int j = 0; j <= right.length(); j++) {
            previous[j] = j;
        }
        for (int i = 1; i <= left.length(); i++) {
            current[0] = i;
            for (int j = 1; j <= right.length(); j++) {
                int cost = left.charAt(i - 1) == right.charAt(j - 1) ? 0 : 1;
                current[j] = Math.min(
                        Math.min(current[j - 1] + 1, previous[j] + 1),
                        previous[j - 1] + cost
                );
            }
            int[] swap = previous;
            previous = current;
            current = swap;
        }
        return previous[right.length()];
    }

    private static final class Candidate {
        final RobotCommand command;
        final double score;

        Candidate(RobotCommand command, double score) {
            this.command = command;
            this.score = score;
        }
    }

    public static final class Match {
        public final RobotCommand command;
        public final double score;
        public final String sourcePhrase;

        Match(RobotCommand command, double score, String sourcePhrase) {
            this.command = command;
            this.score = score;
            this.sourcePhrase = sourcePhrase;
        }
    }
}

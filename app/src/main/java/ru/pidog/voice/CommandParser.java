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
 * Converts imperfect Russian speech recognition hypotheses into a small allow-list
 * of robot commands. Conservative thresholds are intentional: an unknown phrase
 * must never start the robot moving.
 */
public final class CommandParser {
    private static final Map<RobotCommand, List<String>> ALIASES = new EnumMap<>(RobotCommand.class);
    private static final Set<String> FILLERS = new HashSet<>(Arrays.asList(
            "пидог", "пайдог", "пес", "песик", "собака", "собачка", "робот",
            "эй", "ну", "давай", "пожалуйста", "команда", "теперь", "быстро"
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
    }

    private CommandParser() {
    }

    private static void put(RobotCommand command, String... aliases) {
        List<String> normalized = new ArrayList<>();
        for (String alias : aliases) {
            normalized.add(normalize(alias));
        }
        ALIASES.put(command, Collections.unmodifiableList(normalized));
    }

    public static Match findBest(List<String> hypotheses) {
        if (hypotheses == null || hypotheses.isEmpty()) {
            return null;
        }

        Match best = null;
        Match runnerUp = null;
        int limit = Math.min(hypotheses.size(), 8);
        for (int i = 0; i < limit; i++) {
            String source = hypotheses.get(i);
            Candidate candidate = findBestCandidate(source);
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

    public static List<String> biasingPhrases() {
        List<String> phrases = new ArrayList<>();
        for (List<String> aliases : ALIASES.values()) {
            phrases.addAll(aliases);
        }
        phrases.add("Пидог");
        return phrases;
    }

    private static Candidate findBestCandidate(String source) {
        String candidate = removeFillers(normalize(source));
        if (candidate.isEmpty()) {
            return null;
        }

        Candidate best = null;
        for (Map.Entry<RobotCommand, List<String>> entry : ALIASES.entrySet()) {
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
                || containsToken(candidate, "отмена")) {
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

    private static String removeFillers(String value) {
        List<String> kept = new ArrayList<>();
        for (String token : value.split(" ")) {
            if (!FILLERS.contains(token)) {
                kept.add(token);
            }
        }
        return String.join(" ", kept);
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

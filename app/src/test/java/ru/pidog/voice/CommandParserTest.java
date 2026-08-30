package ru.pidog.voice;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.util.Arrays;

import org.junit.Test;

public class CommandParserTest {
    @Test
    public void recognizesPoliteRussianCommand() {
        assertCommand(RobotCommand.SIT, "Пайдог, пожалуйста, сядь!");
    }

    @Test
    public void recognizesDirectionWithAlternativeWording() {
        assertCommand(RobotCommand.TURN_RIGHT, "собачка поверни вправо");
    }

    @Test
    public void recognizesYoAsE() {
        assertCommand(RobotCommand.FORWARD, "иди вперёд");
    }

    @Test
    public void choosesUsefulAlternativeHypothesis() {
        CommandParser.Match match = CommandParser.findBest(Arrays.asList(
                "подай колос", "подай голос", "подаю голос"));
        assertEquals(RobotCommand.BARK, match.command);
    }

    @Test
    public void rejectsUnknownPhrase() {
        assertNull(CommandParser.findBest("какая сегодня погода"));
    }

    @Test
    public void rejectsNegatedMovement() {
        assertNull(CommandParser.findBest("не иди вперед"));
    }

    @Test
    public void stopHasExplicitNegatedAlias() {
        assertCommand(RobotCommand.STOP, "не двигайся");
    }

    @Test
    public void recognizesOrangeJarScenario() {
        assertCommand(RobotCommand.FIND_ORANGE, "Пайдог, найди оранжевую баночку");
    }

    @Test
    public void recognizesVoiceSelectedLightColor() {
        assertCommand(RobotCommand.LIGHT_PURPLE, "свети фиолетовым");
    }

    @Test
    public void recognizesBatteryGauge() {
        assertCommand(RobotCommand.SHOW_BATTERY, "покажи заряд светодиодами");
    }

    @Test
    public void switchesCommandsToPiDogMicrophone() {
        assertCommand(RobotCommand.LOCAL_VOICE_ON, "Пайдог, перейди в режим слушать");
    }

    @Test
    public void switchesCommandsBackToPhone() {
        assertCommand(RobotCommand.LOCAL_VOICE_OFF, "принимай команды с телефона");
    }

    @Test
    public void recognizesPoliteEnglishCommand() {
        assertEnglishCommand(RobotCommand.FORWARD, "PiDog, please go forward!");
    }

    @Test
    public void recognizesEnglishHighFive() {
        assertEnglishCommand(RobotCommand.HIGH_FIVE, "hey robot give me five");
    }

    @Test
    public void recognizesEnglishLightCommand() {
        assertEnglishCommand(RobotCommand.LIGHT_PURPLE, "turn on purple");
    }

    @Test
    public void switchesToLocalMicrophoneInEnglish() {
        assertEnglishCommand(RobotCommand.LOCAL_VOICE_ON, "PiDog, listen for commands");
    }

    @Test
    public void rejectsNegatedEnglishMovement() {
        assertNull(CommandParser.findBest("do not go forward", "en-US"));
        assertNull(CommandParser.findBest("don't go back", "en-US"));
    }

    private static void assertCommand(RobotCommand expected, String phrase) {
        CommandParser.Match match = CommandParser.findBest(phrase);
        assertEquals(expected, match.command);
    }

    private static void assertEnglishCommand(RobotCommand expected, String phrase) {
        CommandParser.Match match = CommandParser.findBest(phrase, "en-US");
        assertEquals(expected, match.command);
    }
}

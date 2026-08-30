package ru.pidog.voice;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.util.Arrays;

import org.junit.Test;

public class CommandParserTest {
    @Test
    public void recognizesPoliteRussianCommand() {
        assertCommand(RobotCommand.SIT, "Пидог, пожалуйста, сядь!");
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
        assertCommand(RobotCommand.FIND_ORANGE, "Пидог, найди оранжевую баночку");
    }

    @Test
    public void recognizesVoiceSelectedLightColor() {
        assertCommand(RobotCommand.LIGHT_PURPLE, "свети фиолетовым");
    }

    @Test
    public void recognizesBatteryGauge() {
        assertCommand(RobotCommand.SHOW_BATTERY, "покажи заряд светодиодами");
    }

    private static void assertCommand(RobotCommand expected, String phrase) {
        CommandParser.Match match = CommandParser.findBest(phrase);
        assertEquals(expected, match.command);
    }
}

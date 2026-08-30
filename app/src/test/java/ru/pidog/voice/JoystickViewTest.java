package ru.pidog.voice;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public final class JoystickViewTest {
    @Test
    public void centerAndDeadZoneAreNeutral() {
        assertEquals(0, JoystickView.directionForOffset(0, 100));
        assertEquals(0, JoystickView.directionForOffset(31, 100));
        assertEquals(0, JoystickView.directionForOffset(-31, 100));
    }

    @Test
    public void negativeOffsetSelectsFirstDirection() {
        assertEquals(-1, JoystickView.directionForOffset(-33, 100));
    }

    @Test
    public void positiveOffsetSelectsSecondDirection() {
        assertEquals(1, JoystickView.directionForOffset(33, 100));
    }
}

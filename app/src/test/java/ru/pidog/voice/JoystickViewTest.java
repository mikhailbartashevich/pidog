package ru.pidog.voice;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public final class JoystickViewTest {
    @Test
    public void centerAndDeadZoneAreNeutral() {
        assertEquals(0, JoystickView.directionForOffset(0, 100));
        assertEquals(0, JoystickView.directionForOffset(19, 100));
        assertEquals(0, JoystickView.directionForOffset(-19, 100));
    }

    @Test
    public void negativeOffsetSelectsFirstDirection() {
        assertEquals(-1, JoystickView.directionForOffset(-21, 100));
    }

    @Test
    public void positiveOffsetSelectsSecondDirection() {
        assertEquals(1, JoystickView.directionForOffset(21, 100));
    }

    @Test
    public void combinedJoystickMapsVerticalAndHorizontalAxes() {
        assertMovement(new int[]{-1, 0}, JoystickView.movementForPosition(0f, -1f));
        assertMovement(new int[]{1, 0}, JoystickView.movementForPosition(0f, 1f));
        assertMovement(new int[]{0, -1}, JoystickView.movementForPosition(-1f, 0f));
        assertMovement(new int[]{0, 1}, JoystickView.movementForPosition(1f, 0f));
    }

    @Test
    public void releaseReturnsCombinedJoystickToStop() {
        assertMovement(new int[]{0, 0}, JoystickView.movementForPosition(0f, 0f));
        assertMovement(new int[]{0, 0}, JoystickView.movementForPosition(0.19f, -0.19f));
    }

    @Test
    public void diagonalInputUsesTheDominantAxis() {
        assertMovement(new int[]{-1, 0}, JoystickView.movementForPosition(0.4f, -0.8f));
        assertMovement(new int[]{0, 1}, JoystickView.movementForPosition(0.8f, -0.4f));
    }

    private static void assertMovement(int[] expected, int[] actual) {
        assertEquals(expected[0], actual[0]);
        assertEquals(expected[1], actual[1]);
    }
}

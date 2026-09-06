package ru.pidog.voice;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public final class HeadJoystickViewTest {
    @Test
    public void normalizesOffsetsToJoystickRange() {
        assertEquals(0f, HeadJoystickView.normalizedOffset(0, 100), 0.001f);
        assertEquals(0.5f, HeadJoystickView.normalizedOffset(50, 100), 0.001f);
        assertEquals(-0.5f, HeadJoystickView.normalizedOffset(-50, 100), 0.001f);
    }

    @Test
    public void clampsOffsetsOutsideJoystickRange() {
        assertEquals(1f, HeadJoystickView.normalizedOffset(140, 100), 0.001f);
        assertEquals(-1f, HeadJoystickView.normalizedOffset(-140, 100), 0.001f);
    }
}

package ru.pidog.voice;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.EnumSet;
import java.util.Set;

import org.junit.Test;

public final class CommandCatalogTest {
    @Test
    public void groupedScreenContainsEveryCommandExactlyOnce() {
        Set<RobotCommand> commands = EnumSet.noneOf(RobotCommand.class);
        int displayedCount = 0;
        for (CommandCatalog.Group group : CommandCatalog.groups()) {
            assertTrue(!group.commands.isEmpty());
            for (RobotCommand command : group.commands) {
                assertTrue("Duplicate command: " + command, commands.add(command));
                displayedCount++;
            }
        }

        assertEquals(RobotCommand.values().length, displayedCount);
        assertEquals(EnumSet.allOf(RobotCommand.class), commands);
    }
}

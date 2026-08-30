package ru.pidog.voice;

import android.app.Activity;
import android.widget.TextView;

/** Coordinates both joysticks and guarantees that movement is stopped on exit. */
final class MovementController {
    private final Activity activity;
    private final RobotClient client;
    private final RobotConnection connection;
    private final String languageTag;
    private final JoystickView driveJoystick;
    private final JoystickView turnJoystick;
    private final TextView movementStatus;

    private int driveDirection;
    private int turnDirection;
    private RobotCommand activeCommand;

    MovementController(Activity activity, RobotClient client, RobotConnection connection,
                       String languageTag) {
        this.activity = activity;
        this.client = client;
        this.connection = connection;
        this.languageTag = languageTag;
        driveJoystick = activity.findViewById(R.id.driveJoystick);
        turnJoystick = activity.findViewById(R.id.turnJoystick);
        movementStatus = activity.findViewById(R.id.movementStatus);
    }

    void bind() {
        driveJoystick.configure(JoystickView.Axis.VERTICAL, direction -> {
            driveDirection = direction;
            applyJoystickState(true);
        });
        turnJoystick.configure(JoystickView.Axis.HORIZONTAL, direction -> {
            turnDirection = direction;
            applyJoystickState(false);
        });
        activity.findViewById(R.id.joystickStopButton)
                .setOnClickListener(view -> stop());
    }

    boolean isMoving() {
        return activeCommand != null && activeCommand != RobotCommand.STOP;
    }

    void stop() {
        driveDirection = 0;
        turnDirection = 0;
        driveJoystick.resetToCenter();
        turnJoystick.resetToCenter();
        dispatch(RobotCommand.STOP);
    }

    private void applyJoystickState(boolean driveChanged) {
        RobotCommand command = null;
        if (driveChanged && driveDirection != 0) {
            command = driveDirection < 0 ? RobotCommand.FORWARD : RobotCommand.BACKWARD;
        } else if (!driveChanged && turnDirection != 0) {
            command = turnDirection < 0 ? RobotCommand.TURN_LEFT : RobotCommand.TURN_RIGHT;
        } else if (driveDirection != 0) {
            command = driveDirection < 0 ? RobotCommand.FORWARD : RobotCommand.BACKWARD;
        } else if (turnDirection != 0) {
            command = turnDirection < 0 ? RobotCommand.TURN_LEFT : RobotCommand.TURN_RIGHT;
        }
        dispatch(command == null ? RobotCommand.STOP : command);
    }

    private void dispatch(RobotCommand command) {
        if (command == activeCommand) {
            return;
        }
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint == null) {
            activeCommand = null;
            movementStatus.setText(R.string.movement_connection_required);
            movementStatus.setTextColor(activity.getColor(R.color.danger));
            return;
        }
        activeCommand = command;
        connection.save();
        movementStatus.setText(statusText(command));
        movementStatus.setTextColor(activity.getColor(command == RobotCommand.STOP
                ? R.color.danger : R.color.brand_dark));
        connection.showStatus(activity.getString(R.string.sending_command,
                command.displayName(languageTag)), R.color.muted);
        client.sendMovement(endpoint.host, endpoint.port, endpoint.token, command,
                activity.getString(R.string.joystick_command_phrase), (success, message) -> {
                    connection.showStatus(message, success ? R.color.brand : R.color.danger);
                    if (!success && command == activeCommand) {
                        activeCommand = null;
                        movementStatus.setText(message);
                        movementStatus.setTextColor(activity.getColor(R.color.danger));
                    }
                });
    }

    private static int statusText(RobotCommand command) {
        switch (command) {
            case FORWARD: return R.string.movement_forward;
            case BACKWARD: return R.string.movement_backward;
            case TURN_LEFT: return R.string.movement_left;
            case TURN_RIGHT: return R.string.movement_right;
            default: return R.string.movement_stopped;
        }
    }
}

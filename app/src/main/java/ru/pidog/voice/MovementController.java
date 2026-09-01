package ru.pidog.voice;

import android.app.Activity;
import android.widget.TextView;

/** Coordinates the movement and head joysticks and guarantees a safe centered stop. */
final class MovementController {
    private final Activity activity;
    private final RobotClient client;
    private final RobotConnection connection;
    private final String languageTag;
    private final JoystickView movementJoystick;
    private final HeadJoystickView headJoystick;
    private final TextView movementStatus;
    private final TextView headStatus;

    private int driveDirection;
    private int turnDirection;
    private RobotCommand activeCommand;
    private boolean headRequestInFlight;
    private boolean headRequestPending;
    private int pendingHeadYaw;
    private int pendingHeadPitch;

    MovementController(Activity activity, RobotClient client, RobotConnection connection,
                       String languageTag) {
        this.activity = activity;
        this.client = client;
        this.connection = connection;
        this.languageTag = languageTag;
        movementJoystick = activity.findViewById(R.id.movementJoystick);
        headJoystick = activity.findViewById(R.id.headJoystick);
        movementStatus = activity.findViewById(R.id.movementStatus);
        headStatus = activity.findViewById(R.id.headStatus);
    }

    void bind() {
        movementJoystick.configure((drive, turn) -> {
            driveDirection = drive;
            turnDirection = turn;
            applyJoystickState();
        });
        headJoystick.configure((x, y) -> queueHeadPosition(
                Math.round(-x * 80), Math.round(-y * 30)));
        activity.findViewById(R.id.joystickStopButton)
                .setOnClickListener(view -> stop());
    }

    boolean isMoving() {
        return activeCommand != null && activeCommand != RobotCommand.STOP;
    }

    void stop() {
        driveDirection = 0;
        turnDirection = 0;
        movementJoystick.resetToCenter();
        headJoystick.resetToCenter();
        dispatch(RobotCommand.STOP);
    }

    private void queueHeadPosition(int yaw, int pitch) {
        pendingHeadYaw = yaw;
        pendingHeadPitch = pitch;
        headRequestPending = true;
        headStatus.setText(activity.getString(R.string.head_position_format, yaw, pitch));
        headStatus.setTextColor(activity.getColor(R.color.brand_dark));
        dispatchPendingHead();
    }

    private void dispatchPendingHead() {
        if (headRequestInFlight || !headRequestPending) {
            return;
        }
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint == null) {
            headRequestPending = false;
            headStatus.setText(R.string.movement_connection_required);
            headStatus.setTextColor(activity.getColor(R.color.danger));
            return;
        }
        int yaw = pendingHeadYaw;
        int pitch = pendingHeadPitch;
        headRequestPending = false;
        headRequestInFlight = true;
        connection.save();
        client.sendHead(endpoint.host, endpoint.port, endpoint.token, yaw, pitch,
                (success, message) -> {
                    headRequestInFlight = false;
                    if (!success) {
                        headStatus.setText(message);
                        headStatus.setTextColor(activity.getColor(R.color.danger));
                        connection.showStatus(message, R.color.danger);
                    }
                    dispatchPendingHead();
                });
    }

    private void applyJoystickState() {
        RobotCommand command = null;
        if (driveDirection != 0) {
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

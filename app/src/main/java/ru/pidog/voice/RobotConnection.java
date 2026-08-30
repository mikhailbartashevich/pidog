package ru.pidog.voice;

import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;

/** Owns connection form state, validation and status rendering. */
final class RobotConnection {
    static final String PREFERENCES_NAME = "pidog_voice_settings";

    private static final String PREF_HOST = "host";
    private static final String PREF_PORT = "port";
    private static final String PREF_TOKEN = "token";
    private static final String DEFAULT_HOST = "192.168.1.37";
    private static final String DEFAULT_PORT = "8765";

    private final Activity activity;
    private final EditText hostInput;
    private final EditText portInput;
    private final EditText tokenInput;
    private final TextView connectionStatus;
    private final View statusBar;
    private final TextView statusTitle;
    private final TextView statusMark;
    private final ProgressBar statusProgress;
    private final ImageView statusMascot;
    private ObjectAnimator mascotPulse;

    RobotConnection(Activity activity) {
        this.activity = activity;
        hostInput = activity.findViewById(R.id.hostInput);
        portInput = activity.findViewById(R.id.portInput);
        tokenInput = activity.findViewById(R.id.tokenInput);
        connectionStatus = activity.findViewById(R.id.connectionStatus);
        statusBar = activity.findViewById(R.id.globalStatusBar);
        statusTitle = activity.findViewById(R.id.statusTitle);
        statusMark = activity.findViewById(R.id.statusMark);
        statusProgress = activity.findViewById(R.id.statusProgress);
        statusMascot = activity.findViewById(R.id.statusMascot);
        renderStatus(activity.getString(R.string.connection_not_checked), StatusState.IDLE);
    }

    void restore() {
        SharedPreferences preferences = preferences();
        hostInput.setText(preferences.getString(PREF_HOST, DEFAULT_HOST));
        portInput.setText(preferences.getString(PREF_PORT, DEFAULT_PORT));
        tokenInput.setText(preferences.getString(PREF_TOKEN, ""));
    }

    void save() {
        preferences().edit()
                .putString(PREF_HOST, hostInput.getText().toString().trim())
                .putString(PREF_PORT, portInput.getText().toString().trim())
                .putString(PREF_TOKEN, tokenInput.getText().toString())
                .apply();
    }

    boolean hasAddress() {
        return !hostInput.getText().toString().trim().isEmpty()
                && !portInput.getText().toString().trim().isEmpty();
    }

    Endpoint read() {
        String host = hostInput.getText().toString().trim();
        if (host.isEmpty()) {
            hostInput.setError(activity.getString(R.string.host_required));
            hostInput.requestFocus();
            showStatus(activity.getString(R.string.host_required), R.color.danger);
            return null;
        }
        int port;
        try {
            port = Integer.parseInt(portInput.getText().toString().trim());
            if (port < 1 || port > 65535) {
                throw new NumberFormatException();
            }
        } catch (NumberFormatException error) {
            portInput.setError(activity.getString(R.string.port_invalid));
            portInput.requestFocus();
            showStatus(activity.getString(R.string.port_invalid), R.color.danger);
            return null;
        }
        return new Endpoint(host, port, tokenInput.getText().toString());
    }

    void showStatus(String message, int colorResource) {
        StatusState state;
        if (colorResource == R.color.muted) {
            state = StatusState.WORKING;
        } else if (colorResource == R.color.danger || colorResource == R.color.warning) {
            state = StatusState.ERROR;
        } else {
            state = StatusState.SUCCESS;
        }
        renderStatus(message, state);
    }

    private void renderStatus(String message, StatusState state) {
        final int titleResource;
        final int markResource;
        final int accentColor;
        final int backgroundColor;
        switch (state) {
            case WORKING:
                titleResource = R.string.status_working;
                markResource = R.string.status_mark_working;
                accentColor = R.color.brand;
                backgroundColor = R.color.status_working_background;
                break;
            case SUCCESS:
                titleResource = R.string.status_success;
                markResource = R.string.status_mark_success;
                accentColor = R.color.success;
                backgroundColor = R.color.status_success_background;
                break;
            case ERROR:
                titleResource = R.string.status_error;
                markResource = R.string.status_mark_error;
                accentColor = R.color.danger;
                backgroundColor = R.color.status_error_background;
                break;
            default:
                titleResource = R.string.status_idle;
                markResource = R.string.status_mark_idle;
                accentColor = R.color.muted;
                backgroundColor = R.color.status_idle_background;
        }

        int accent = activity.getColor(accentColor);
        statusTitle.setText(titleResource);
        statusTitle.setTextColor(accent);
        statusMark.setText(markResource);
        statusMark.setTextColor(accent);
        connectionStatus.setText(message);
        connectionStatus.setTextColor(activity.getColor(
                state == StatusState.ERROR ? R.color.danger_dark : R.color.ink));
        statusBar.setBackgroundTintList(ColorStateList.valueOf(
                activity.getColor(backgroundColor)));
        statusProgress.setIndeterminateTintList(ColorStateList.valueOf(accent));
        statusProgress.setVisibility(state == StatusState.WORKING
                ? View.VISIBLE : View.INVISIBLE);
        statusBar.setContentDescription(
                activity.getString(titleResource) + ". " + message);
        setMascotWorking(state == StatusState.WORKING);
    }

    void destroy() {
        setMascotWorking(false);
    }

    private void setMascotWorking(boolean working) {
        if (working) {
            if (mascotPulse == null) {
                mascotPulse = ObjectAnimator.ofFloat(statusMascot, View.ALPHA, 1f, 0.56f);
                mascotPulse.setDuration(650L);
                mascotPulse.setRepeatCount(ValueAnimator.INFINITE);
                mascotPulse.setRepeatMode(ValueAnimator.REVERSE);
                mascotPulse.start();
            }
            return;
        }
        if (mascotPulse != null) {
            mascotPulse.cancel();
            mascotPulse = null;
        }
        statusMascot.setAlpha(1f);
    }

    void check(RobotClient client) {
        Endpoint endpoint = read();
        if (endpoint == null) {
            return;
        }
        save();
        showStatus(activity.getString(R.string.checking_connection), R.color.muted);
        client.check(endpoint.host, endpoint.port, endpoint.token,
                (success, message) -> showStatus(message,
                        success ? R.color.brand : R.color.danger));
    }

    private SharedPreferences preferences() {
        return activity.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }

    static final class Endpoint {
        final String host;
        final int port;
        final String token;

        Endpoint(String host, int port, String token) {
            this.host = host;
            this.port = port;
            this.token = token;
        }
    }

    private enum StatusState {
        IDLE, WORKING, SUCCESS, ERROR
    }
}

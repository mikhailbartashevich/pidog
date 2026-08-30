package ru.pidog.voice;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.EditText;
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

    RobotConnection(Activity activity) {
        this.activity = activity;
        hostInput = activity.findViewById(R.id.hostInput);
        portInput = activity.findViewById(R.id.portInput);
        tokenInput = activity.findViewById(R.id.tokenInput);
        connectionStatus = activity.findViewById(R.id.connectionStatus);
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
            return null;
        }
        return new Endpoint(host, port, tokenInput.getText().toString());
    }

    void showStatus(String message, int colorResource) {
        connectionStatus.setText(message);
        connectionStatus.setTextColor(activity.getColor(colorResource));
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
}

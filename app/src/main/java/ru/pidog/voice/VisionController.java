package ru.pidog.voice;

import android.app.Activity;
import android.graphics.Color;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.ArrayDeque;
import java.util.Date;
import java.util.Deque;
import java.util.Locale;

/** Owns camera streaming, color search commands and the bounded vision log. */
final class VisionController {
    private static final int MAX_LOG_ENTRIES = 10;
    private static final int CAMERA_PORT = 9000;

    private final Activity activity;
    private final RobotClient client;
    private final RobotConnection connection;
    private final String languageTag;
    private final WebView cameraView;
    private final TextView cameraPlaceholder;
    private final TextView cameraStatus;
    private final TextView visionLog;
    private final Deque<String> visionEntries = new ArrayDeque<>();
    private final SimpleDateFormat logTime = new SimpleDateFormat("HH:mm:ss", Locale.US);

    private boolean streaming;

    VisionController(Activity activity, RobotClient client, RobotConnection connection,
                     String languageTag) {
        this.activity = activity;
        this.client = client;
        this.connection = connection;
        this.languageTag = languageTag;
        cameraView = activity.findViewById(R.id.cameraView);
        cameraPlaceholder = activity.findViewById(R.id.cameraPlaceholder);
        cameraStatus = activity.findViewById(R.id.cameraStatus);
        visionLog = activity.findViewById(R.id.visionLog);
    }

    void bind() {
        configureWebView();
        activity.findViewById(R.id.openCameraButton)
                .setOnClickListener(view -> startStream());
        activity.findViewById(R.id.cameraOnButton)
                .setOnClickListener(view -> refreshStream());
        activity.findViewById(R.id.cameraOffButton)
                .setOnClickListener(view -> stopStream());
        activity.findViewById(R.id.clearVisionLogButton)
                .setOnClickListener(view -> clearLog());
    }

    boolean handles(RobotCommand command) {
        return isColorSearch(command)
                || command == RobotCommand.CAMERA_ON
                || command == RobotCommand.CAMERA_OFF;
    }

    void send(RobotCommand command, String phrase) {
        if (command == RobotCommand.CAMERA_ON) {
            startStream();
        } else if (command == RobotCommand.CAMERA_OFF) {
            stopStream();
        } else if (isColorSearch(command)) {
            sendColorSearch(command, phrase);
        }
    }

    void onResume() {
        if (streaming) {
            cameraView.onResume();
        }
    }

    void onPause() {
        if (streaming) {
            cameraView.onPause();
        }
    }

    void destroy() {
        cameraView.stopLoading();
        cameraView.loadUrl("about:blank");
        cameraView.destroy();
    }

    private void configureWebView() {
        cameraView.setBackgroundColor(Color.rgb(14, 16, 32));
        WebSettings settings = cameraView.getSettings();
        settings.setJavaScriptEnabled(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        cameraView.setWebViewClient(new WebViewClient());
        showPlaceholder(activity.getString(R.string.camera_not_started));
    }

    private void startStream() {
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint == null) {
            return;
        }
        connection.save();
        cameraStatus.setText(R.string.camera_connecting_status);
        showPlaceholder(activity.getString(R.string.camera_starting));
        connection.showStatus(activity.getString(R.string.camera_starting_short), R.color.muted);
        client.send(endpoint.host, endpoint.port, endpoint.token, RobotCommand.CAMERA_ON,
                activity.getString(R.string.camera_phrase_on), (success, message) -> {
                    connection.showStatus(message, success ? R.color.brand : R.color.danger);
                    if (success) {
                        streaming = true;
                        loadStream(endpoint.host);
                        appendLog(activity.getString(R.string.camera_subject),
                                activity.getString(R.string.stream_started), true);
                    } else {
                        cameraStatus.setText(R.string.no_signal_status);
                        showPlaceholder(message);
                        appendLog(activity.getString(R.string.camera_subject), message, false);
                    }
                });
    }

    private void refreshStream() {
        if (!streaming) {
            startStream();
            return;
        }
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint != null) {
            cameraStatus.setText(R.string.refreshing_status);
            loadStream(endpoint.host);
        }
    }

    private void stopStream() {
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint == null) {
            return;
        }
        streaming = false;
        cameraView.stopLoading();
        cameraView.loadUrl("about:blank");
        cameraStatus.setText(R.string.off_status);
        showPlaceholder(activity.getString(R.string.camera_off));
        client.send(endpoint.host, endpoint.port, endpoint.token, RobotCommand.CAMERA_OFF,
                activity.getString(R.string.camera_phrase_off), (success, message) -> {
                    connection.showStatus(message, success ? R.color.brand : R.color.danger);
                    appendLog(activity.getString(R.string.camera_subject), message, success);
                });
    }

    private void sendColorSearch(RobotCommand command, String phrase) {
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint == null) {
            return;
        }
        connection.save();
        String color = colorName(command);
        connection.showStatus(activity.getString(R.string.camera_searching, color), R.color.muted);
        client.sendVision(endpoint.host, endpoint.port, endpoint.token, command, phrase,
                (success, message, data) -> {
                    connection.showStatus(message, success ? R.color.brand : R.color.danger);
                    if (success && data != null) {
                        String details = activity.getString(data.found
                                ? R.string.vision_found : R.string.vision_not_found);
                        if (data.found && data.x >= 0 && data.y >= 0) {
                            details += " · x=" + data.x + ", y=" + data.y;
                        }
                        if (data.found && !data.position.isEmpty()) {
                            details += " · " + localizedPosition(data.position);
                        }
                        if (data.found && data.distanceCm >= 0) {
                            details += String.format(Locale.getDefault(), " · %.1f %s",
                                    data.distanceCm, isEnglish() ? "cm" : "см");
                        }
                        appendLog(colorName(data.color), details, data.found);
                    } else {
                        appendLog(color, message, false);
                    }
                });
    }

    private void loadStream(String host) {
        String cleanHost = cleanHost(host);
        String baseUrl = "http://" + cleanHost + ":" + CAMERA_PORT + "/";
        String streamUrl = baseUrl + "mjpg";
        String html = "<!doctype html><html><head><meta name=\"viewport\" "
                + "content=\"width=device-width,initial-scale=1,maximum-scale=1\"></head>"
                + "<body style=\"margin:0;background:#0E1020;overflow:hidden;"
                + "display:flex;align-items:center;justify-content:center;height:100vh\">"
                + "<img alt=\"PiDog camera\" src=\"" + streamUrl + "\" "
                + "style=\"width:100%;height:100%;object-fit:contain\"></body></html>";
        cameraPlaceholder.setVisibility(View.GONE);
        cameraView.setVisibility(View.VISIBLE);
        cameraView.loadDataWithBaseURL(baseUrl, html, "text/html", "UTF-8", null);
        cameraStatus.setText(activity.getString(R.string.camera_live_status, cleanHost));
    }

    private void showPlaceholder(String message) {
        cameraView.setVisibility(View.INVISIBLE);
        cameraPlaceholder.setVisibility(View.VISIBLE);
        cameraPlaceholder.setText(message);
    }

    private void appendLog(String subject, String details, boolean positive) {
        String marker = positive ? "●" : "○";
        visionEntries.addFirst(logTime.format(new Date()) + "  " + marker + "  "
                + subject + " — " + details);
        while (visionEntries.size() > MAX_LOG_ENTRIES) {
            visionEntries.removeLast();
        }
        visionLog.setText(String.join("\n\n", visionEntries));
        visionLog.setTextColor(activity.getColor(R.color.ink));
    }

    private void clearLog() {
        visionEntries.clear();
        visionLog.setText(R.string.vision_log_empty);
        visionLog.setTextColor(activity.getColor(R.color.muted));
    }

    static String cleanHost(String host) {
        String clean = host == null ? "" : host.trim();
        if (clean.startsWith("http://")) {
            clean = clean.substring(7);
        } else if (clean.startsWith("https://")) {
            clean = clean.substring(8);
        }
        while (clean.endsWith("/")) {
            clean = clean.substring(0, clean.length() - 1);
        }
        return clean.replaceAll("[^A-Za-z0-9.:-]", "");
    }

    private static boolean isColorSearch(RobotCommand command) {
        return command == RobotCommand.FIND_ORANGE || command == RobotCommand.FIND_RED
                || command == RobotCommand.FIND_YELLOW || command == RobotCommand.FIND_GREEN
                || command == RobotCommand.FIND_BLUE || command == RobotCommand.FIND_PURPLE;
    }

    private String colorName(RobotCommand command) {
        switch (command) {
            case FIND_ORANGE: return activity.getString(R.string.color_orange);
            case FIND_RED: return activity.getString(R.string.color_red);
            case FIND_YELLOW: return activity.getString(R.string.color_yellow);
            case FIND_GREEN: return activity.getString(R.string.color_green);
            case FIND_BLUE: return activity.getString(R.string.color_blue);
            case FIND_PURPLE: return activity.getString(R.string.color_purple);
            default: return command.displayName(languageTag);
        }
    }

    private String colorName(String color) {
        if (color == null) {
            return activity.getString(R.string.color_unknown);
        }
        switch (color) {
            case "orange": return activity.getString(R.string.color_orange);
            case "red": return activity.getString(R.string.color_red);
            case "yellow": return activity.getString(R.string.color_yellow);
            case "green": return activity.getString(R.string.color_green);
            case "blue": return activity.getString(R.string.color_blue);
            case "purple": return activity.getString(R.string.color_purple);
            default: return color.isEmpty() ? activity.getString(R.string.color_unknown) : color;
        }
    }

    private String localizedPosition(String position) {
        if (isEnglish()) {
            switch (position) {
                case "left": return "left";
                case "right": return "right";
                default: return "center";
            }
        }
        switch (position) {
            case "left": return "слева";
            case "right": return "справа";
            default: return "по центру";
        }
    }

    private boolean isEnglish() {
        return languageTag != null && languageTag.startsWith("en");
    }
}

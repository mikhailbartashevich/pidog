package ru.pidog.voice;

import android.os.Handler;
import android.os.Looper;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class RobotClient {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final RobotResponseParser responseParser;
    private volatile boolean closed;

    public RobotClient(boolean english) {
        responseParser = new RobotResponseParser(english);
    }

    public interface Callback {
        void onResult(boolean success, String message);
    }

    public interface SensorCallback {
        void onResult(boolean success, String message, SensorData data);
    }

    public interface VisionCallback {
        void onResult(boolean success, String message, VisionData data);
    }

    public interface AssistantStatusCallback {
        void onResult(boolean success, String message, AssistantStatus data);
    }

    public interface AssistantChatCallback {
        void onResult(boolean success, String message, AssistantReply data);
    }

    public static final class AssistantStatus {
        public final boolean installed;
        public final boolean running;
        public final String state;
        public final String model;
        public final int contextTokens;
        public final boolean webAvailable;
        public final String webProvider;
        public final boolean ttsReady;
        public final boolean busy;
        public final String error;

        AssistantStatus(boolean installed, boolean running, String state, String model,
                        int contextTokens, boolean webAvailable, String webProvider,
                        boolean ttsReady, boolean busy, String error) {
            this.installed = installed;
            this.running = running;
            this.state = state;
            this.model = model;
            this.contextTokens = contextTokens;
            this.webAvailable = webAvailable;
            this.webProvider = webProvider;
            this.ttsReady = ttsReady;
            this.busy = busy;
            this.error = error;
        }
    }

    public static final class AssistantReply {
        public final String answer;
        public final String sources;
        public final boolean searched;
        public final boolean spoken;
        public final String warning;

        AssistantReply(String answer, String sources, boolean searched,
                       boolean spoken, String warning) {
            this.answer = answer;
            this.sources = sources;
            this.searched = searched;
            this.spoken = spoken;
            this.warning = warning;
        }
    }

    public static final class SensorData {
        public final float batteryPercent;
        public final float batteryVoltage;
        public final float distanceCm;
        public final float soundDirection;
        public final boolean powerKnown;
        public final boolean externalPower;
        public final boolean chargingKnown;
        public final boolean charging;

        SensorData(float batteryPercent, float batteryVoltage, float distanceCm,
                   float soundDirection, boolean powerKnown, boolean externalPower,
                   boolean chargingKnown, boolean charging) {
            this.batteryPercent = batteryPercent;
            this.batteryVoltage = batteryVoltage;
            this.distanceCm = distanceCm;
            this.soundDirection = soundDirection;
            this.powerKnown = powerKnown;
            this.externalPower = externalPower;
            this.chargingKnown = chargingKnown;
            this.charging = charging;
        }
    }

    public static final class VisionData {
        public final String color;
        public final boolean found;
        public final int x;
        public final int y;
        public final String position;
        public final float distanceCm;

        VisionData(String color, boolean found, int x, int y,
                   String position, float distanceCm) {
            this.color = color;
            this.found = found;
            this.x = x;
            this.y = y;
            this.position = position;
            this.distanceCm = distanceCm;
        }
    }

    public void check(String host, int port, String token, Callback callback) {
        execute(() -> request("GET", host, port, token, "/health", null), callback);
    }

    public void send(String host, int port, String token, RobotCommand command,
                     String recognizedPhrase, Callback callback) {
        String json = commandJson(command, recognizedPhrase);
        execute(() -> request("POST", host, port, token, "/command", json), callback);
    }

    public void sendMovement(String host, int port, String token, RobotCommand command,
                             String recognizedPhrase, Callback callback) {
        String wireName;
        switch (command) {
            case FORWARD: wireName = "drive_forward"; break;
            case BACKWARD: wireName = "drive_backward"; break;
            case TURN_LEFT: wireName = "drive_left"; break;
            case TURN_RIGHT: wireName = "drive_right"; break;
            default: wireName = RobotCommand.STOP.wireName;
        }
        String json = commandJson(wireName, recognizedPhrase);
        execute(() -> request("POST", host, port, token, "/command", json), callback);
    }

    public void sendVision(String host, int port, String token, RobotCommand command,
                           String recognizedPhrase, VisionCallback callback) {
        String json = commandJson(command, recognizedPhrase);
        executor.execute(() -> {
            Result result;
            VisionData data = null;
            try {
                result = request("POST", host, port, token, "/command", json);
                if (result.success && result.response != null) {
                    data = responseParser.parseVision(result.response);
                }
            } catch (Exception error) {
                result = new Result(false, responseParser.readableError(error), null);
            }
            Result finalResult = result;
            VisionData finalData = data;
            postResult(() -> callback.onResult(
                    finalResult.success, finalResult.message, finalData));
        });
    }

    public void sensors(String host, int port, String token, SensorCallback callback) {
        executor.execute(() -> {
            Result result;
            SensorData data = null;
            try {
                result = request("GET", host, port, token, "/sensors", null);
                if (result.success && result.response != null) {
                    data = responseParser.parseSensors(result.response);
                }
            } catch (Exception error) {
                result = new Result(false, responseParser.readableError(error), null);
            }
            Result finalResult = result;
            SensorData finalData = data;
            postResult(() -> callback.onResult(
                    finalResult.success, finalResult.message, finalData));
        });
    }

    public void assistantStatus(String host, int port, String token,
                                AssistantStatusCallback callback) {
        assistantRequest("GET", host, port, token, "/assistant/status", null, callback);
    }

    public void assistantControl(String host, int port, String token, String action,
                                 AssistantStatusCallback callback) {
        String body = "{\"action\":\"" + escape(action) + "\"}";
        assistantRequest("POST", host, port, token, "/assistant/control", body, callback);
    }

    public void assistantChat(String host, int port, String token, String message,
                              boolean search, boolean speak, AssistantChatCallback callback) {
        String body = "{\"message\":\"" + escape(message) + "\",\"search\":"
                + search + ",\"speak\":" + speak + "}";
        executor.execute(() -> {
            Result result;
            AssistantReply reply = null;
            try {
                result = request("POST", host, port, token, "/assistant/chat", body);
                if (result.success && result.response != null) {
                    reply = responseParser.parseAssistantReply(result.response);
                }
            } catch (Exception error) {
                result = new Result(false, responseParser.readableError(error), null);
            }
            Result finalResult = result;
            AssistantReply finalReply = reply;
            postResult(() -> callback.onResult(
                    finalResult.success, finalResult.message, finalReply));
        });
    }

    public void clearAssistantHistory(String host, int port, String token, Callback callback) {
        execute(() -> request("POST", host, port, token, "/assistant/history",
                "{\"action\":\"clear\"}"), callback);
    }

    private void assistantRequest(String method, String host, int port, String token,
                                  String path, String body, AssistantStatusCallback callback) {
        executor.execute(() -> {
            Result result;
            AssistantStatus status = null;
            try {
                result = request(method, host, port, token, path, body);
                if (result.success && result.response != null) {
                    status = responseParser.parseAssistantStatus(result.response);
                }
            } catch (Exception error) {
                result = new Result(false, responseParser.readableError(error), null);
            }
            Result finalResult = result;
            AssistantStatus finalStatus = status;
            postResult(() -> callback.onResult(
                    finalResult.success, finalResult.message, finalStatus));
        });
    }

    public void close() {
        closed = true;
        mainHandler.removeCallbacksAndMessages(null);
        executor.shutdownNow();
    }

    private void execute(Request request, Callback callback) {
        executor.execute(() -> {
            Result result;
            try {
                result = request.run();
            } catch (Exception error) {
                result = new Result(false, responseParser.readableError(error), null);
            }
            Result finalResult = result;
            postResult(() -> callback.onResult(finalResult.success, finalResult.message));
        });
    }

    private void postResult(Runnable callback) {
        if (closed) {
            return;
        }
        mainHandler.post(() -> {
            if (!closed) {
                callback.run();
            }
        });
    }

    private Result request(String method, String host, int port, String token,
                           String path, String body) throws IOException {
        String cleanHost = host == null ? "" : host.trim();
        if (cleanHost.isEmpty()) {
            return new Result(false, responseParser.text(
                    "Укажите IP-адрес Пайдог", "Enter the PiDog IP address"), null);
        }
        if (cleanHost.startsWith("http://")) {
            cleanHost = cleanHost.substring(7);
        } else if (cleanHost.startsWith("https://")) {
            cleanHost = cleanHost.substring(8);
        }
        while (cleanHost.endsWith("/")) {
            cleanHost = cleanHost.substring(0, cleanHost.length() - 1);
        }
        if (cleanHost.contains("/") || cleanHost.contains("?") || cleanHost.contains("#")) {
            return new Result(false, responseParser.text(
                    "Некорректный адрес робота", "Invalid robot address"), null);
        }

        URL url = new URL("http", cleanHost, port, path);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        try {
            connection.setRequestMethod(method);
            connection.setConnectTimeout(2500);
            // Color scanning and sound direction listening intentionally take a few seconds.
            connection.setReadTimeout("/assistant/chat".equals(path) ? 150000
                    : "/assistant/control".equals(path) ? 40000 : 20000);
            connection.setRequestProperty("Accept", "application/json");
            if (token != null && !token.trim().isEmpty()) {
                connection.setRequestProperty("X-PiDog-Token", token.trim());
            }
            if (body != null) {
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                connection.setDoOutput(true);
                connection.setFixedLengthStreamingMode(bytes.length);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(bytes);
                }
            }

            int status = connection.getResponseCode();
            InputStream stream = status >= 200 && status < 300
                    ? connection.getInputStream() : connection.getErrorStream();
            String response = stream == null ? "" : readAll(stream);
            if (status >= 200 && status < 300) {
                return new Result(true, responseParser.successMessage(path, response), response);
            }
            if (status == 401) {
                return new Result(false, responseParser.text(
                        "Неверный секретный токен", "Incorrect secret token"), response);
            }
            if (status == 409) {
                return new Result(false, responseParser.conflictMessage(response), response);
            }
            return new Result(false, responseParser.text("Ошибка Пайдог ", "PiDog error ")
                    + status + (response.isEmpty() ? "" : ": " + response), response);
        } finally {
            connection.disconnect();
        }
    }

    private static String readAll(InputStream input) throws IOException {
        StringBuilder result = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                result.append(line);
            }
        }
        return result.toString();
    }

    private static String escape(String value) {
        StringBuilder escaped = new StringBuilder();
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            switch (ch) {
                case '\\': escaped.append("\\\\"); break;
                case '"': escaped.append("\\\""); break;
                case '\n': escaped.append("\\n"); break;
                case '\r': escaped.append("\\r"); break;
                case '\t': escaped.append("\\t"); break;
                default:
                    if (ch < 0x20) {
                        escaped.append(String.format(Locale.US, "\\u%04x", (int) ch));
                    } else {
                        escaped.append(ch);
                    }
            }
        }
        return escaped.toString();
    }

    private static String commandJson(RobotCommand command, String recognizedPhrase) {
        return commandJson(command.wireName, recognizedPhrase);
    }

    private static String commandJson(String wireName, String recognizedPhrase) {
        return "{\"command\":\"" + escape(wireName) + "\","
                + "\"phrase\":\""
                + escape(recognizedPhrase == null ? "" : recognizedPhrase) + "\"}";
    }

    private interface Request {
        Result run() throws Exception;
    }

    private static final class Result {
        final boolean success;
        final String message;
        final String response;

        Result(boolean success, String message, String response) {
            this.success = success;
            this.message = message;
            this.response = response;
        }
    }
}

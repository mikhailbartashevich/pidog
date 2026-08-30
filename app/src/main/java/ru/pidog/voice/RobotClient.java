package ru.pidog.voice;

import android.os.Handler;
import android.os.Looper;

import org.json.JSONException;
import org.json.JSONObject;

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

    public interface Callback {
        void onResult(boolean success, String message);
    }

    public interface SensorCallback {
        void onResult(boolean success, String message, SensorData data);
    }

    public interface VisionCallback {
        void onResult(boolean success, String message, VisionData data);
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

        VisionData(String color, boolean found, int x, int y) {
            this.color = color;
            this.found = found;
            this.x = x;
            this.y = y;
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

    public void sendVision(String host, int port, String token, RobotCommand command,
                           String recognizedPhrase, VisionCallback callback) {
        String json = commandJson(command, recognizedPhrase);
        executor.execute(() -> {
            Result result;
            VisionData data = null;
            try {
                result = request("POST", host, port, token, "/command", json);
                if (result.success && result.response != null) {
                    JSONObject response = new JSONObject(result.response);
                    if (response.has("found") && response.has("color")) {
                        data = new VisionData(
                                response.optString("color", ""),
                                response.optBoolean("found", false),
                                response.optInt("x", -1),
                                response.optInt("y", -1));
                    }
                }
            } catch (Exception error) {
                result = new Result(false, readableError(error), null);
            }
            Result finalResult = result;
            VisionData finalData = data;
            mainHandler.post(() -> callback.onResult(
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
                    JSONObject json = new JSONObject(result.response);
                    data = new SensorData(
                            json.isNull("battery_percent") ? -1 : (float) json.optDouble("battery_percent"),
                            json.isNull("battery_voltage") ? -1 : (float) json.optDouble("battery_voltage"),
                            json.isNull("distance_cm") ? -1 : (float) json.optDouble("distance_cm"),
                            json.isNull("sound_direction") ? -1 : (float) json.optDouble("sound_direction"),
                            !json.isNull("external_power"),
                            json.optBoolean("external_power", false),
                            !json.isNull("charging"),
                            json.optBoolean("charging", false));
                }
            } catch (Exception error) {
                result = new Result(false, readableError(error), null);
            }
            Result finalResult = result;
            SensorData finalData = data;
            mainHandler.post(() -> callback.onResult(
                    finalResult.success, finalResult.message, finalData));
        });
    }

    public void close() {
        executor.shutdownNow();
    }

    private void execute(Request request, Callback callback) {
        executor.execute(() -> {
            Result result;
            try {
                result = request.run();
            } catch (Exception error) {
                result = new Result(false, readableError(error), null);
            }
            Result finalResult = result;
            mainHandler.post(() -> callback.onResult(finalResult.success, finalResult.message));
        });
    }

    private Result request(String method, String host, int port, String token,
                           String path, String body) throws IOException {
        String cleanHost = host == null ? "" : host.trim();
        if (cleanHost.isEmpty()) {
            return new Result(false, "Укажите IP-адрес PiDog", null);
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
            return new Result(false, "Некорректный адрес робота", null);
        }

        URL url = new URL("http", cleanHost, port, path);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(2500);
        // Color scanning and sound direction listening intentionally take a few seconds.
        connection.setReadTimeout(20000);
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
        connection.disconnect();
        if (status >= 200 && status < 300) {
            return new Result(true, successMessage(path, response), response);
        }
        if (status == 401) {
            return new Result(false, "Неверный секретный токен", response);
        }
        if (status == 409) {
            return new Result(false, conflictMessage(response), response);
        }
        return new Result(false, "Ошибка PiDog " + status + (response.isEmpty() ? "" : ": " + response), response);
    }

    private static String successMessage(String path, String response) {
        try {
            JSONObject json = new JSONObject(response);
            if ("/health".equals(path)) {
                JSONObject audio = json.optJSONObject("audio");
                if (audio != null && !audio.isNull("ready")) {
                    if (audio.optBoolean("ready", false)) {
                        return "PiDog на связи · звук готов";
                    }
                    String error = audio.optString("error", "аудио недоступно").trim();
                    return "PiDog на связи, но звук не готов: " + error;
                }
            }
            if ("/sensors".equals(path)) {
                String distance = json.isNull("distance_cm")
                        ? "нет данных" : json.optString("distance_cm") + " см";
                String touch = json.isNull("touch") ? "нет данных" : json.optString("touch");
                String sound;
                if (json.optBoolean("sound_detected", false)) {
                    sound = json.optString("sound_direction", "?") + "°";
                } else {
                    sound = "не обнаружен";
                }
                String camera = json.optBoolean("camera", false) ? "включена" : "выключена";
                String power;
                if (json.isNull("external_power")) {
                    power = "определяется";
                } else if (json.optBoolean("external_power", false)) {
                    power = json.optBoolean("charging", false)
                            ? "внешнее · зарядка" : "внешнее питание";
                } else {
                    power = "аккумулятор";
                }
                return "Расстояние: " + distance + "\nКасание: " + touch
                        + "\nЗвук: " + sound + "\nПитание: " + power
                        + "\nКамера: " + camera;
            }
            String message = json.optString("message", "").trim();
            if (!message.isEmpty()) {
                return message;
            }
        } catch (JSONException ignored) {
            // A successful legacy server may return no JSON message.
        }
        return "/health".equals(path) ? "PiDog на связи" : "Команда принята";
    }

    private static String conflictMessage(String response) {
        try {
            JSONObject json = new JSONObject(response);
            if ("audio unavailable".equals(json.optString("error"))) {
                String detail = json.optString("detail", "проверьте динамик и ALSA").trim();
                return "Звук PiDog недоступен: " + detail;
            }
        } catch (JSONException ignored) {
            // Keep the generic message for legacy or non-JSON server responses.
        }
        return "PiDog занят или команда не выполнена";
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
        return "{\"command\":\"" + escape(command.wireName) + "\","
                + "\"phrase\":\""
                + escape(recognizedPhrase == null ? "" : recognizedPhrase) + "\"}";
    }

    private static String readableError(Exception error) {
        String message = error.getMessage();
        if (message == null || message.trim().isEmpty()) {
            message = error.getClass().getSimpleName();
        }
        return "Нет связи с PiDog: " + message;
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

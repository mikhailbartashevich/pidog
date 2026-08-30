package ru.pidog.voice;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Parses server payloads and owns user-facing localization for protocol responses. */
final class RobotResponseParser {
    private final boolean english;

    RobotResponseParser(boolean english) {
        this.english = english;
    }

    RobotClient.VisionData parseVision(String response) throws JSONException {
        JSONObject json = new JSONObject(response);
        if (!json.has("found") || !json.has("color")) {
            return null;
        }
        return new RobotClient.VisionData(
                json.optString("color", ""),
                json.optBoolean("found", false),
                json.optInt("x", -1),
                json.optInt("y", -1),
                json.optString("position", ""),
                json.isNull("distance_cm") ? -1 : (float) json.optDouble("distance_cm"));
    }

    RobotClient.SensorData parseSensors(String response) throws JSONException {
        JSONObject json = new JSONObject(response);
        return new RobotClient.SensorData(
                optionalFloat(json, "battery_percent"),
                optionalFloat(json, "battery_voltage"),
                optionalFloat(json, "distance_cm"),
                optionalFloat(json, "sound_direction"),
                !json.isNull("external_power"),
                json.optBoolean("external_power", false),
                !json.isNull("charging"),
                json.optBoolean("charging", false));
    }

    RobotClient.AssistantReply parseAssistantReply(String response) throws JSONException {
        JSONObject json = new JSONObject(response);
        StringBuilder sources = new StringBuilder();
        JSONArray items = json.optJSONArray("sources");
        if (items != null) {
            for (int index = 0; index < items.length(); index++) {
                JSONObject item = items.optJSONObject(index);
                if (item == null) {
                    continue;
                }
                if (sources.length() > 0) {
                    sources.append("\n\n");
                }
                sources.append('[').append(index + 1).append("] ")
                        .append(item.optString("title", ""));
                String url = item.optString("url", "");
                if (!url.isEmpty()) {
                    sources.append('\n').append(url);
                }
            }
        }
        return new RobotClient.AssistantReply(
                json.optString("answer", ""), sources.toString(),
                json.optBoolean("searched", false),
                json.optBoolean("spoken", false),
                json.optString("search_warning", ""));
    }

    RobotClient.AssistantStatus parseAssistantStatus(String response) throws JSONException {
        JSONObject root = new JSONObject(response);
        JSONObject assistant = root.optJSONObject("assistant");
        if (assistant == null) {
            return null;
        }
        JSONObject web = assistant.optJSONObject("web_search");
        JSONObject tts = assistant.optJSONObject("tts");
        return new RobotClient.AssistantStatus(
                assistant.optBoolean("installed", false),
                assistant.optBoolean("running", false),
                assistant.optString("state", "unknown"),
                assistant.optString("model", "—"),
                assistant.optInt("context_tokens", 0),
                web != null && web.optBoolean("available", false),
                web == null ? "—" : web.optString("provider", "—"),
                tts != null && tts.optBoolean("ready", false),
                assistant.optBoolean("busy", false),
                assistant.optString("last_error", ""));
    }

    String successMessage(String path, String response) {
        try {
            JSONObject json = new JSONObject(response);
            if ("/health".equals(path)) {
                String healthMessage = healthMessage(json);
                if (healthMessage != null) {
                    return healthMessage;
                }
            }
            if ("/sensors".equals(path)) {
                return sensorMessage(json);
            }
            String message = json.optString("message", "").trim();
            if (!message.isEmpty() && !english) {
                return message;
            }
        } catch (JSONException ignored) {
            // A successful legacy server may return no JSON message.
        }
        return "/health".equals(path)
                ? text("Пайдог на связи", "PiDog connected")
                : text("Команда принята", "Command accepted");
    }

    String conflictMessage(String response) {
        try {
            JSONObject json = new JSONObject(response);
            if ("audio unavailable".equals(json.optString("error"))) {
                String detail = json.optString("detail",
                        text("проверьте динамик и ALSA", "check the speaker and ALSA")).trim();
                return text("Звук Пайдог недоступен: ",
                        "PiDog audio is unavailable: ") + detail;
            }
            if ("assistant unavailable".equals(json.optString("error"))) {
                String detail = json.optString("detail",
                        text("локальная модель недоступна", "the local model is unavailable"));
                return text("Локальный Пайдог недоступен: ",
                        "Local PiDog is unavailable: ") + detail;
            }
            if ("robot command failed".equals(json.optString("error"))) {
                String detail = json.optString("detail", "").trim();
                if (!detail.isEmpty()) {
                    return text("Команда Пайдог не выполнена: ",
                            "PiDog command failed: ") + detail;
                }
                return text("Команда Пайдог не выполнена",
                        "PiDog command failed");
            }
        } catch (JSONException ignored) {
            // Keep the generic message for legacy or non-JSON server responses.
        }
        return text("Команда Пайдог не выполнена",
                "PiDog command could not be completed");
    }

    String readableError(Exception error) {
        String message = error.getMessage();
        if (message == null || message.trim().isEmpty()) {
            message = error.getClass().getSimpleName();
        }
        return text("Нет связи с Пайдог: ", "Could not connect to PiDog: ") + message;
    }

    String text(String russian, String englishText) {
        return english ? englishText : russian;
    }

    private String healthMessage(JSONObject json) {
        JSONObject localVoice = json.optJSONObject("local_voice");
        if (localVoice != null) {
            String state = localVoice.optString("state", "");
            String error = localVoice.optString("error", "").trim();
            if ("error".equals(state) && !error.isEmpty()) {
                return text("Пайдог на связи, но встроенный микрофон не готов: ",
                        "PiDog connected, but the built-in microphone is not ready: ") + error;
            }
            if ("listening".equals(state) || "starting".equals(state)) {
                return text("Пайдог на связи · слушает встроенный микрофон",
                        "PiDog connected · listening through its built-in microphone");
            }
        }
        JSONObject audio = json.optJSONObject("audio");
        if (audio == null || audio.isNull("ready")) {
            return null;
        }
        if (audio.optBoolean("ready", false)) {
            return text("Пайдог на связи · звук готов", "PiDog connected · audio ready");
        }
        String error = audio.optString("error",
                text("аудио недоступно", "audio unavailable")).trim();
        return text("Пайдог на связи, но звук не готов: ",
                "PiDog connected, but audio is not ready: ") + error;
    }

    private String sensorMessage(JSONObject json) {
        String distance = json.isNull("distance_cm")
                ? text("нет данных", "no data")
                : json.optString("distance_cm") + text(" см", " cm");
        String touch = json.isNull("touch")
                ? text("нет данных", "no data") : json.optString("touch");
        String sound = json.optBoolean("sound_detected", false)
                ? json.optString("sound_direction", "?") + "°"
                : text("не обнаружен", "not detected");
        String camera = json.optBoolean("camera", false)
                ? text("включена", "on") : text("выключена", "off");
        String power;
        if (json.isNull("external_power")) {
            power = text("определяется", "detecting");
        } else if (json.optBoolean("external_power", false)) {
            power = json.optBoolean("charging", false)
                    ? text("внешнее · зарядка", "external · charging")
                    : text("внешнее питание", "external power");
        } else {
            power = text("аккумулятор", "battery");
        }
        return text("Расстояние: ", "Distance: ") + distance
                + text("\nКасание: ", "\nTouch: ") + touch
                + text("\nЗвук: ", "\nSound: ") + sound
                + text("\nПитание: ", "\nPower: ") + power
                + text("\nКамера: ", "\nCamera: ") + camera;
    }

    private static float optionalFloat(JSONObject json, String name) {
        return json.isNull(name) ? -1 : (float) json.optDouble(name);
    }
}

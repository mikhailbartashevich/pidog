package ru.pidog.voice;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Base64;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Synchronizes Android's AI vision screens with the PiDog web control station. */
final class AiVisionController {
    private final Activity activity;
    private final RobotClient client;
    private final RobotConnection connection;
    private final String languageTag;

    private final ImageView frameImage;
    private final ImageView commandsFrameImage;
    private final TextView status;
    private final TextView commandsStatus;
    private final TextView error;
    private final TextView recognitionLog;
    private final TextView commandsRecognitionLog;
    private final LinearLayout detections;
    private final LinearLayout guardTargets;
    private final EditText faceNames;
    private final EditText objectName;
    private final Button rememberFace;
    private final Button rememberObject;
    private final Button guardButton;

    private RobotClient.AiVisionFace selectedFace;
    private RobotClient.AiVisionObject selectedObject;
    private String selectedTarget = "";
    private boolean loadingFrame;
    private boolean loadingTargets;
    private final Map<String, Recognition> recognitions = new LinkedHashMap<>();
    private final SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm:ss", Locale.US);

    AiVisionController(Activity activity, RobotClient client, RobotConnection connection,
                       String languageTag) {
        this.activity = activity;
        this.client = client;
        this.connection = connection;
        this.languageTag = languageTag;
        frameImage = activity.findViewById(R.id.aiVisionFrame);
        commandsFrameImage = activity.findViewById(R.id.aiCommandsFrame);
        status = activity.findViewById(R.id.aiVisionStatus);
        commandsStatus = activity.findViewById(R.id.aiCommandsStatus);
        error = activity.findViewById(R.id.aiVisionError);
        recognitionLog = activity.findViewById(R.id.aiVisionRecognitionLog);
        commandsRecognitionLog = activity.findViewById(R.id.aiCommandsRecognitionLog);
        detections = activity.findViewById(R.id.aiVisionDetections);
        guardTargets = activity.findViewById(R.id.aiGuardTargets);
        faceNames = activity.findViewById(R.id.aiFaceNamesInput);
        objectName = activity.findViewById(R.id.aiObjectNameInput);
        rememberFace = activity.findViewById(R.id.aiRememberFaceButton);
        rememberObject = activity.findViewById(R.id.aiRememberObjectButton);
        guardButton = activity.findViewById(R.id.aiGuardButton);
    }

    void bind() {
        activity.findViewById(R.id.aiVisionStartCameraButton)
                .setOnClickListener(view -> startCameraAndRefresh());
        activity.findViewById(R.id.aiVisionRefreshButton)
                .setOnClickListener(view -> refreshFrame());
        activity.findViewById(R.id.aiCommandsRefreshButton)
                .setOnClickListener(view -> refreshFrame());
        activity.findViewById(R.id.aiGuardRefreshButton)
                .setOnClickListener(view -> refreshTargets());
        activity.findViewById(R.id.aiFollowPersonButton)
                .setOnClickListener(view -> sendAiCommand(RobotCommand.FOLLOW_AI_TARGET));
        activity.findViewById(R.id.aiStopButton)
                .setOnClickListener(view -> sendAiCommand(RobotCommand.STOP_AI_TARGET));
        rememberFace.setOnClickListener(view -> saveFace());
        rememberObject.setOnClickListener(view -> saveObject());
        guardButton.setOnClickListener(view -> guardSelectedTarget());
        TextWatcher selectionWatcher = new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence value, int start, int count, int after) { }
            @Override public void onTextChanged(CharSequence value, int start, int before, int count) {
                renderSelectionControls();
            }
            @Override public void afterTextChanged(Editable value) { }
        };
        faceNames.addTextChangedListener(selectionWatcher);
        objectName.addTextChangedListener(selectionWatcher);
        renderRecognitionLog();
        renderSelectionControls();
    }

    void onPageChanged(int page, int visionPage, int commandsPage) {
        if (page == visionPage) {
            refreshFrame();
        } else if (page == commandsPage) {
            refreshTargets();
            refreshFrame();
        }
    }

    private void startCameraAndRefresh() {
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint == null) return;
        connection.save();
        setStatus(text("Запускаю камеру…", "Starting camera…"));
        client.send(endpoint.host, endpoint.port, endpoint.token, RobotCommand.CAMERA_ON,
                text("AI Vision", "AI Vision"), (success, message) -> {
                    connection.showStatus(message, success ? R.color.brand : R.color.danger);
                    if (success) refreshFrame(); else showError(message);
                });
    }

    private void refreshFrame() {
        if (loadingFrame) return;
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint == null) return;
        loadingFrame = true;
        connection.save();
        setStatus(text("AI Pi анализирует кадр…", "AI Pi is analyzing a frame…"));
        client.aiVisionInfer(endpoint.host, endpoint.port, endpoint.token,
                (success, message, data) -> {
                    loadingFrame = false;
                    if (!success || data == null) {
                        String detail = success ? text("AI Pi не вернул кадр", "AI Pi returned no frame") : message;
                        showError(detail);
                        setStatus(text("AI · НЕДОСТУПНО", "AI · UNAVAILABLE"));
                        connection.showStatus(detail, R.color.danger);
                        return;
                    }
                    applyFrame(data);
                    clearError();
                    String distance = data.distanceCm < 0
                            ? text("нет дальности", "no range")
                            : String.format(Locale.getDefault(), "%.1f %s", data.distanceCm,
                                    text("см", "cm"));
                    setStatus(text("AI · ГОТОВО · ", "AI · READY · ") + distance);
                    connection.showStatus(text("AI-кадр обновлён", "AI frame updated"), R.color.brand);
                });
    }

    private void applyFrame(RobotClient.AiVisionData data) {
        if (!data.frameJpeg.isEmpty()) {
            try {
                byte[] bytes = Base64.decode(data.frameJpeg, Base64.DEFAULT);
                Bitmap image = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                frameImage.setImageBitmap(image);
                commandsFrameImage.setImageBitmap(image);
            } catch (IllegalArgumentException error) {
                showError(text("Не удалось открыть AI-кадр", "Could not open the AI frame"));
            }
        }
        keepSelectedBoxes(data);
        renderDetections(data);
        updateRecognitions(data);
    }

    private void keepSelectedBoxes(RobotClient.AiVisionData data) {
        if (selectedFace != null && !containsFace(data.faces, selectedFace)) selectedFace = null;
        if (selectedObject != null && !containsObject(data.objects, selectedObject)) selectedObject = null;
        renderSelectionControls();
    }

    private void renderDetections(RobotClient.AiVisionData data) {
        detections.removeAllViews();
        if (data.faces.isEmpty() && data.objects.isEmpty()) {
            addDetection(text("Ожидаю находку на следующем кадре…", "Waiting for a detection…"), null);
            return;
        }
        for (RobotClient.AiVisionFace face : data.faces) {
            String name = !face.name.isEmpty() ? face.name
                    : face.names.length > 0 ? String.join(" / ", face.names)
                    : text("Неизвестное лицо", "Unknown face");
            addDetection(text("Лицо: ", "Face: ") + name, () -> {
                selectedFace = face;
                selectedObject = null;
                renderSelectionControls();
                renderDetections(data);
            });
        }
        for (RobotClient.AiVisionObject object : data.objects) {
            String name = !object.name.isEmpty() ? object.name : object.label;
            addDetection(text("Предмет: ", "Object: ") + name, () -> {
                selectedObject = object;
                selectedFace = null;
                renderSelectionControls();
                renderDetections(data);
            });
        }
    }

    private void addDetection(String label, Runnable onClick) {
        Button button = new Button(activity);
        button.setAllCaps(false);
        button.setText(label);
        button.setTextColor(activity.getColor(R.color.ink));
        button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(
                activity.getColor(onClick == null ? R.color.surface_variant : R.color.brand_soft)));
        button.setEnabled(onClick != null);
        if (onClick != null) button.setOnClickListener(view -> onClick.run());
        detections.addView(button, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
    }

    private void renderSelectionControls() {
        rememberFace.setEnabled(selectedFace != null && !namesFromInput().isEmpty());
        rememberObject.setEnabled(selectedObject != null && !objectName.getText().toString().trim().isEmpty());
        rememberFace.setText(selectedFace == null ? text("Выберите лицо на кадре", "Select a face from the frame")
                : text("Запомнить лицо и имена", "Remember face and names"));
        rememberObject.setText(selectedObject == null ? text("Выберите предмет на кадре", "Select an object from the frame")
                : text("Запомнить предмет", "Remember object"));
    }

    private void saveFace() {
        RobotConnection.Endpoint endpoint = connection.read();
        Set<String> names = namesFromInput();
        if (endpoint == null || selectedFace == null || names.isEmpty()) return;
        rememberFace.setEnabled(false);
        connection.save();
        client.aiVisionEnrollFace(endpoint.host, endpoint.port, endpoint.token,
                names.toArray(new String[0]), selectedFace, (success, message) -> {
                    if (success) {
                        faceNames.setText("");
                        selectedFace = null;
                        clearError();
                        refreshFrame();
                    } else {
                        showError(message);
                    }
                    renderSelectionControls();
                    connection.showStatus(success
                                    ? text("Лицо сохранено в AI Pi", "Face saved on AI Pi") : message,
                            success ? R.color.brand : R.color.danger);
                });
    }

    private void saveObject() {
        RobotConnection.Endpoint endpoint = connection.read();
        String name = objectName.getText().toString().trim();
        if (endpoint == null || selectedObject == null || name.isEmpty()) return;
        rememberObject.setEnabled(false);
        connection.save();
        client.aiVisionEnrollObject(endpoint.host, endpoint.port, endpoint.token, name, selectedObject,
                (success, message) -> {
                    if (success) {
                        objectName.setText("");
                        selectedObject = null;
                        clearError();
                        refreshFrame();
                    } else {
                        showError(message);
                    }
                    renderSelectionControls();
                    connection.showStatus(success
                                    ? text("Предмет сохранён в AI Pi", "Object saved on AI Pi") : message,
                            success ? R.color.brand : R.color.danger);
                });
    }

    private void refreshTargets() {
        if (loadingTargets) return;
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint == null) return;
        loadingTargets = true;
        connection.save();
        client.aiVisionGuardTargets(endpoint.host, endpoint.port, endpoint.token,
                (success, message, targets) -> {
                    loadingTargets = false;
                    if (!success || targets == null) {
                        showError(message);
                        return;
                    }
                    renderTargets(targets);
                    clearError();
                });
    }

    private void renderTargets(List<RobotClient.AiVisionTarget> targets) {
        guardTargets.removeAllViews();
        boolean selectedExists = false;
        for (RobotClient.AiVisionTarget target : targets) {
            if (target.name.equals(selectedTarget)) selectedExists = true;
        }
        if (!selectedExists) selectedTarget = targets.isEmpty() ? "" : targets.get(0).name;
        for (RobotClient.AiVisionTarget target : targets) {
            Button button = new Button(activity);
            boolean selected = target.name.equals(selectedTarget);
            button.setAllCaps(false);
            button.setText(("face".equals(target.source) ? "◉ " : "◇ ") + target.name);
            button.setTextColor(activity.getColor(selected ? R.color.on_brand : R.color.ink));
            button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(activity.getColor(
                    selected ? R.color.brand : R.color.brand_soft)));
            button.setOnClickListener(view -> {
                selectedTarget = target.name;
                renderTargets(targets);
            });
            guardTargets.addView(button, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        }
        if (targets.isEmpty()) {
            TextView empty = new TextView(activity);
            empty.setText(text("База пока пуста. Добавьте лицо или предмет на экране AI‑зрения.",
                    "The database is empty. Add a face or object in AI vision."));
            empty.setTextColor(activity.getColor(R.color.muted));
            guardTargets.addView(empty);
        }
        guardButton.setEnabled(!selectedTarget.isEmpty());
    }

    private void guardSelectedTarget() {
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint == null || selectedTarget.isEmpty()) return;
        guardButton.setEnabled(false);
        connection.save();
        client.aiVisionGuard(endpoint.host, endpoint.port, endpoint.token, selectedTarget,
                (success, message) -> {
                    guardButton.setEnabled(!selectedTarget.isEmpty());
                    if (success) clearError(); else showError(message);
                    connection.showStatus(success
                                    ? text("Пайдог сторожит: ", "PiDog is guarding: ") + selectedTarget
                                    : message,
                            success ? R.color.brand : R.color.danger);
                });
    }

    private void sendAiCommand(RobotCommand command) {
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint == null) return;
        connection.save();
        client.send(endpoint.host, endpoint.port, endpoint.token, command,
                text("AI-команды", "AI commands"), (success, message) ->
                        connection.showStatus(message, success ? R.color.brand : R.color.danger));
    }

    private void updateRecognitions(RobotClient.AiVisionData data) {
        for (Recognition item : recognitions.values()) item.present = false;
        String distance = data.distanceCm < 0 ? text("нет данных", "no range")
                : String.format(Locale.getDefault(), "%.1f %s", data.distanceCm, text("см", "cm"));
        for (RobotClient.AiVisionFace face : data.faces) {
            String name = !face.name.isEmpty() ? face.name
                    : face.names.length > 0 ? String.join(" / ", face.names)
                    : text("Неизвестное лицо", "Unknown face");
            recordRecognition("face:" + name, text("Лицо", "Face"), name, distance);
        }
        for (RobotClient.AiVisionObject object : data.objects) {
            String name = !object.name.isEmpty() ? object.name : object.label;
            recordRecognition("object:" + name, text("Предмет", "Object"), name, distance);
        }
        while (recognitions.size() > 12) recognitions.remove(recognitions.keySet().iterator().next());
        renderRecognitionLog();
    }

    private void recordRecognition(String key, String type, String name, String distance) {
        Recognition recognition = recognitions.get(key);
        if (recognition == null) {
            recognition = new Recognition(type, name);
            recognitions.put(key, recognition);
        }
        recognition.present = true;
        recognition.distance = distance;
        recognition.time = timeFormat.format(new Date());
    }

    private void renderRecognitionLog() {
        StringBuilder current = new StringBuilder();
        StringBuilder earlier = new StringBuilder();
        for (Recognition recognition : recognitions.values()) {
            String row = "• " + recognition.type + ": " + recognition.name + " · "
                    + recognition.distance + " · " + recognition.time + "\n";
            (recognition.present ? current : earlier).append(row);
        }
        String value = text("СЕЙЧАС ВИДНО\n", "VISIBLE NOW\n")
                + (current.length() == 0 ? text("Пока никого не видно\n", "Nothing visible yet\n") : current)
                + "\n" + text("РАНЕЕ РАСПОЗНАНО\n", "RECOGNIZED EARLIER\n")
                + (earlier.length() == 0 ? text("История пока пуста", "No earlier recognitions") : earlier);
        recognitionLog.setText(value);
        commandsRecognitionLog.setText(value);
    }

    private Set<String> namesFromInput() {
        Set<String> names = new LinkedHashSet<>();
        for (String value : faceNames.getText().toString().split("[,\\n]")) {
            String name = value.trim();
            if (!name.isEmpty() && name.length() <= 48) names.add(name);
        }
        return names;
    }

    private static boolean containsFace(List<RobotClient.AiVisionFace> faces,
                                        RobotClient.AiVisionFace selected) {
        for (RobotClient.AiVisionFace face : faces) {
            if (sameBox(face, selected)) return true;
        }
        return false;
    }

    private static boolean containsObject(List<RobotClient.AiVisionObject> objects,
                                          RobotClient.AiVisionObject selected) {
        for (RobotClient.AiVisionObject object : objects) {
            if (sameBox(object, selected)) return true;
        }
        return false;
    }

    private static boolean sameBox(RobotClient.AiVisionBox first, RobotClient.AiVisionBox second) {
        return Math.abs(first.x - second.x) < .003f && Math.abs(first.y - second.y) < .003f
                && Math.abs(first.width - second.width) < .003f
                && Math.abs(first.height - second.height) < .003f;
    }

    private void setStatus(String value) {
        status.setText(value);
        commandsStatus.setText(value);
    }

    private void showError(String value) {
        error.setVisibility(View.VISIBLE);
        error.setText(value);
        error.setTextColor(activity.getColor(R.color.danger_dark));
    }

    private void clearError() {
        error.setVisibility(View.GONE);
    }

    private String text(String russian, String english) {
        return languageTag != null && languageTag.startsWith("en") ? english : russian;
    }

    private static final class Recognition {
        final String type;
        final String name;
        boolean present;
        String distance = "—";
        String time = "—";

        Recognition(String type, String name) {
            this.type = type;
            this.name = name;
        }
    }
}

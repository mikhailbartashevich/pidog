package ru.pidog.voice;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.ArrayAdapter;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.ViewFlipper;

import java.text.SimpleDateFormat;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Date;
import java.util.Deque;
import java.util.Locale;

public final class MainActivity extends Activity implements RecognitionListener {
    private static final int MICROPHONE_PERMISSION_REQUEST = 41;
    private static final String PREFS = "pidog_voice_settings";

    private EditText hostInput;
    private EditText portInput;
    private EditText tokenInput;
    private TextView connectionStatus;
    private TextView listeningStatus;
    private TextView recognizedText;
    private TextView commandText;
    private Button micButton;
    private Spinner commandSpinner;
    private ViewFlipper servicePages;
    private TextView sensorsText;
    private SensorDashboardView sensorDashboard;
    private WebView cameraView;
    private TextView cameraPlaceholder;
    private TextView cameraStatus;
    private TextView visionLog;
    private Button[] navButtons;
    private HorizontalScrollView navScroll;
    private TextView headerPowerIndicator;
    private TextView powerIndicatorIcon;
    private TextView powerIndicatorTitle;
    private TextView powerIndicatorDetail;
    private TextView powerIndicatorBadge;

    private SpeechRecognizer speechRecognizer;
    private final RobotClient robotClient = new RobotClient();
    private final RobotCommand[] manualCommands = RobotCommand.values();
    private final Deque<String> visionEntries = new ArrayDeque<>();
    private final SimpleDateFormat logTime = new SimpleDateFormat("HH:mm:ss", Locale.US);
    private final Handler sensorPollingHandler = new Handler(Looper.getMainLooper());
    private final Runnable sensorPoll = new Runnable() {
        @Override public void run() {
            refreshSensors(false);
            sensorPollingHandler.postDelayed(this, 12_000);
        }
    };
    private boolean listening;
    private boolean cameraStreaming;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        bindViews();
        applySystemBarInsets();
        restoreSettings();
        bindActions();
        prepareRecognizer();
        prepareCameraView();
    }

    private void bindViews() {
        hostInput = findViewById(R.id.hostInput);
        portInput = findViewById(R.id.portInput);
        tokenInput = findViewById(R.id.tokenInput);
        connectionStatus = findViewById(R.id.connectionStatus);
        listeningStatus = findViewById(R.id.listeningStatus);
        recognizedText = findViewById(R.id.recognizedText);
        commandText = findViewById(R.id.commandText);
        micButton = findViewById(R.id.micButton);
        commandSpinner = findViewById(R.id.commandSpinner);
        servicePages = findViewById(R.id.servicePages);
        sensorsText = findViewById(R.id.sensorsText);
        sensorDashboard = findViewById(R.id.sensorDashboard);
        cameraView = findViewById(R.id.cameraView);
        cameraPlaceholder = findViewById(R.id.cameraPlaceholder);
        cameraStatus = findViewById(R.id.cameraStatus);
        visionLog = findViewById(R.id.visionLog);
        headerPowerIndicator = findViewById(R.id.headerPowerIndicator);
        powerIndicatorIcon = findViewById(R.id.powerIndicatorIcon);
        powerIndicatorTitle = findViewById(R.id.powerIndicatorTitle);
        powerIndicatorDetail = findViewById(R.id.powerIndicatorDetail);
        powerIndicatorBadge = findViewById(R.id.powerIndicatorBadge);
        navButtons = new Button[]{
                findViewById(R.id.navConnection), findViewById(R.id.navVoice),
                findViewById(R.id.navCommands), findViewById(R.id.navVision),
                findViewById(R.id.navSensors)
        };
        navScroll = findViewById(R.id.navScroll);
    }

    private void bindActions() {
        bindNavigation();
        bindCommandSpinner();
        findViewById(R.id.connectButton).setOnClickListener(view -> checkConnection());
        micButton.setOnClickListener(view -> toggleListening());
        findViewById(R.id.sendSelectedButton).setOnClickListener(view -> sendSelectedCommand());

        bindManual(R.id.forwardButton, RobotCommand.FORWARD);
        bindManual(R.id.backwardButton, RobotCommand.BACKWARD);
        bindManual(R.id.leftButton, RobotCommand.TURN_LEFT);
        bindManual(R.id.rightButton, RobotCommand.TURN_RIGHT);
        bindManual(R.id.sitButton, RobotCommand.SIT);
        bindManual(R.id.standButton, RobotCommand.STAND);
        bindManual(R.id.lieButton, RobotCommand.LIE);
        bindManual(R.id.barkButton, RobotCommand.BARK);
        bindManual(R.id.tailButton, RobotCommand.WAG_TAIL);
        bindManual(R.id.stopButton, RobotCommand.STOP);

        bindManual(R.id.findOrangeButton, RobotCommand.FIND_ORANGE);
        bindManual(R.id.findRedButton, RobotCommand.FIND_RED);
        bindManual(R.id.findYellowButton, RobotCommand.FIND_YELLOW);
        bindManual(R.id.findGreenButton, RobotCommand.FIND_GREEN);
        bindManual(R.id.findBlueButton, RobotCommand.FIND_BLUE);
        bindManual(R.id.findPurpleButton, RobotCommand.FIND_PURPLE);
        findViewById(R.id.openCameraButton).setOnClickListener(view -> startCameraStream());
        findViewById(R.id.cameraOnButton).setOnClickListener(view -> refreshCameraStream());
        findViewById(R.id.cameraOffButton).setOnClickListener(view -> stopCameraStream());
        findViewById(R.id.clearVisionLogButton).setOnClickListener(view -> clearVisionLog());

        bindManual(R.id.distanceButton, RobotCommand.MEASURE_DISTANCE);
        bindManual(R.id.listenSoundButton, RobotCommand.LISTEN_SOUND);
        bindManual(R.id.batteryButton, RobotCommand.SHOW_BATTERY);
        findViewById(R.id.refreshSensorsButton).setOnClickListener(view -> refreshSensors());
        bindManual(R.id.lightRedButton, RobotCommand.LIGHT_RED);
        bindManual(R.id.lightOrangeButton, RobotCommand.LIGHT_ORANGE);
        bindManual(R.id.lightYellowButton, RobotCommand.LIGHT_YELLOW);
        bindManual(R.id.lightGreenButton, RobotCommand.LIGHT_GREEN);
        bindManual(R.id.lightBlueButton, RobotCommand.LIGHT_BLUE);
        bindManual(R.id.lightPurpleButton, RobotCommand.LIGHT_PURPLE);
        bindManual(R.id.lightPinkButton, RobotCommand.LIGHT_PINK);
        bindManual(R.id.lightCyanButton, RobotCommand.LIGHT_CYAN);
        bindManual(R.id.lightWhiteButton, RobotCommand.LIGHT_WHITE);
        bindManual(R.id.lightBlinkButton, RobotCommand.LIGHT_BLINK);
        bindManual(R.id.lightOffButton, RobotCommand.LIGHT_OFF);
    }

    @SuppressWarnings("deprecation")
    private void applySystemBarInsets() {
        View topBar = findViewById(R.id.topBar);
        View bottomStatus = findViewById(R.id.connectionStatus);
        int topStart = topBar.getPaddingStart();
        int topTop = topBar.getPaddingTop();
        int topEnd = topBar.getPaddingEnd();
        int topBottom = topBar.getPaddingBottom();
        int bottomStart = bottomStatus.getPaddingStart();
        int bottomTop = bottomStatus.getPaddingTop();
        int bottomEnd = bottomStatus.getPaddingEnd();
        int bottomBottom = bottomStatus.getPaddingBottom();

        topBar.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPaddingRelative(topStart, topTop + insets.getSystemWindowInsetTop(),
                    topEnd, topBottom);
            return insets;
        });
        bottomStatus.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPaddingRelative(bottomStart, bottomTop, bottomEnd,
                    bottomBottom + insets.getSystemWindowInsetBottom());
            return insets;
        });
        topBar.requestApplyInsets();
        bottomStatus.requestApplyInsets();
    }

    private void bindNavigation() {
        findViewById(R.id.navConnection).setOnClickListener(view -> showPage(0));
        findViewById(R.id.navVoice).setOnClickListener(view -> showPage(1));
        findViewById(R.id.navCommands).setOnClickListener(view -> showPage(2));
        findViewById(R.id.navVision).setOnClickListener(view -> showPage(3));
        findViewById(R.id.navSensors).setOnClickListener(view -> showPage(4));
        showPage(1);
    }

    private void showPage(int page) {
        servicePages.setDisplayedChild(page);
        for (int index = 0; index < navButtons.length; index++) {
            boolean selected = index == page;
            navButtons[index].setBackgroundTintList(ColorStateList.valueOf(
                    getColor(selected ? R.color.brand : R.color.brand_soft)));
            navButtons[index].setTextColor(getColor(
                    selected ? R.color.white : R.color.brand_dark));
        }
        navScroll.post(() -> {
            int inset = Math.round(12 * getResources().getDisplayMetrics().density);
            navScroll.smoothScrollTo(Math.max(0, navButtons[page].getLeft() - inset), 0);
        });
    }

    private void prepareCameraView() {
        cameraView.setBackgroundColor(Color.rgb(14, 16, 32));
        WebSettings settings = cameraView.getSettings();
        settings.setJavaScriptEnabled(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        cameraView.setWebViewClient(new WebViewClient());
        showCameraPlaceholder("Поток камеры пока не запущен");
    }

    private void refreshSensors() {
        refreshSensors(true);
    }

    private void refreshSensors(boolean announce) {
        if (!announce && (hostInput.getText().toString().trim().isEmpty()
                || portInput.getText().toString().trim().isEmpty())) {
            return;
        }
        Endpoint endpoint = readEndpoint();
        if (endpoint == null) {
            return;
        }
        saveSettings();
        if (announce) {
            sensorsText.setText("Читаю датчики…");
        }
        robotClient.sensors(endpoint.host, endpoint.port, endpoint.token, (success, message, data) -> {
            if (success) {
                sensorsText.setText(message);
                sensorDashboard.update(data);
                updatePowerIndicator(data);
            }
            if (announce) {
                setConnectionState(success ? "Датчики обновлены" : message,
                        success ? R.color.brand : R.color.danger);
            }
        });
    }

    private void updatePowerIndicator(RobotClient.SensorData data) {
        if (data == null || !data.powerKnown) {
            headerPowerIndicator.setText("⚡ —");
            headerPowerIndicator.setTextColor(getColor(R.color.muted));
            headerPowerIndicator.setBackgroundTintList(
                    ColorStateList.valueOf(getColor(R.color.surface_variant)));
            powerIndicatorIcon.setText("…");
            powerIndicatorIcon.setTextColor(getColor(R.color.muted));
            powerIndicatorIcon.setBackgroundTintList(
                    ColorStateList.valueOf(getColor(R.color.surface_variant)));
            powerIndicatorTitle.setText("Определяю источник питания");
            powerIndicatorDetail.setText("Для определения по напряжению нужно около 20 секунд");
            setPowerBadge("ПРОВЕРКА", R.color.muted, R.color.surface_variant);
            return;
        }

        if (data.externalPower) {
            headerPowerIndicator.setText(data.charging ? "⚡ CHG" : "⚡ AC");
            headerPowerIndicator.setTextColor(getColor(R.color.brand_dark));
            headerPowerIndicator.setBackgroundTintList(
                    ColorStateList.valueOf(getColor(R.color.brand_soft)));
            powerIndicatorIcon.setText("⚡");
            powerIndicatorIcon.setTextColor(getColor(R.color.brand_dark));
            powerIndicatorIcon.setBackgroundTintList(
                    ColorStateList.valueOf(getColor(R.color.brand_soft)));
            powerIndicatorTitle.setText("Внешнее питание подключено");
            if (data.chargingKnown && data.charging) {
                powerIndicatorDetail.setText("Аккумулятор заряжается от внешнего источника");
                setPowerBadge("ЗАРЯДКА", R.color.brand_dark, R.color.brand_soft);
            } else {
                powerIndicatorDetail.setText("PiDog питается от внешнего источника");
                setPowerBadge("ПОДКЛЮЧЕНО", R.color.brand_dark, R.color.brand_soft);
            }
        } else {
            headerPowerIndicator.setText("🔋 BAT");
            headerPowerIndicator.setTextColor(getColor(R.color.warning));
            headerPowerIndicator.setBackgroundTintList(
                    ColorStateList.valueOf(getColor(R.color.surface_variant)));
            powerIndicatorIcon.setText("🔋");
            powerIndicatorIcon.setTextColor(getColor(R.color.warning));
            powerIndicatorIcon.setBackgroundTintList(
                    ColorStateList.valueOf(getColor(R.color.surface_variant)));
            powerIndicatorTitle.setText("Работа от аккумулятора");
            powerIndicatorDetail.setText("Внешний источник питания не обнаружен");
            setPowerBadge("БАТАРЕЯ", R.color.warning, R.color.surface_variant);
        }
    }

    private void setPowerBadge(String text, int textColor, int backgroundColor) {
        powerIndicatorBadge.setText(text);
        powerIndicatorBadge.setTextColor(getColor(textColor));
        powerIndicatorBadge.setBackgroundTintList(
                ColorStateList.valueOf(getColor(backgroundColor)));
    }

    private void startCameraStream() {
        Endpoint endpoint = readEndpoint();
        if (endpoint == null) {
            return;
        }
        saveSettings();
        cameraStatus.setText("ПОДКЛЮЧЕНИЕ");
        showCameraPlaceholder("Запускаю камеру PiDog…");
        setConnectionState("Запускаю камеру…", R.color.muted);
        robotClient.send(endpoint.host, endpoint.port, endpoint.token, RobotCommand.CAMERA_ON,
                "открыть видеопоток", (success, message) -> {
                    setConnectionState(message, success ? R.color.brand : R.color.danger);
                    if (success) {
                        cameraStreaming = true;
                        loadCameraStream(endpoint.host);
                        appendVisionLog("Камера", "видеопоток запущен", true);
                    } else {
                        cameraStatus.setText("НЕТ СИГНАЛА");
                        showCameraPlaceholder(message);
                        appendVisionLog("Камера", message, false);
                    }
                });
    }

    private void refreshCameraStream() {
        if (!cameraStreaming) {
            startCameraStream();
            return;
        }
        Endpoint endpoint = readEndpoint();
        if (endpoint != null) {
            cameraStatus.setText("ОБНОВЛЕНИЕ");
            loadCameraStream(endpoint.host);
        }
    }

    private void stopCameraStream() {
        Endpoint endpoint = readEndpoint();
        if (endpoint == null) {
            return;
        }
        cameraStreaming = false;
        cameraView.stopLoading();
        cameraView.loadUrl("about:blank");
        cameraStatus.setText("ВЫКЛЮЧЕНА");
        showCameraPlaceholder("Камера выключена");
        robotClient.send(endpoint.host, endpoint.port, endpoint.token, RobotCommand.CAMERA_OFF,
                "выключить камеру", (success, message) -> {
                    setConnectionState(message, success ? R.color.brand : R.color.danger);
                    appendVisionLog("Камера", message, success);
                });
    }

    private void loadCameraStream(String host) {
        String cleanHost = cleanHost(host);
        String baseUrl = "http://" + cleanHost + ":9000/";
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
        cameraStatus.setText("LIVE · " + cleanHost);
    }

    private void showCameraPlaceholder(String message) {
        cameraView.setVisibility(View.INVISIBLE);
        cameraPlaceholder.setVisibility(View.VISIBLE);
        cameraPlaceholder.setText(message);
    }

    private static String cleanHost(String host) {
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

    private void bindCommandSpinner() {
        String[] labels = new String[manualCommands.length];
        for (int i = 0; i < manualCommands.length; i++) {
            labels[i] = manualCommands[i].displayName;
        }
        ArrayAdapter<String> adapter = new ArrayAdapter<>(
                this, android.R.layout.simple_spinner_item, labels);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        commandSpinner.setAdapter(adapter);
    }

    private void sendSelectedCommand() {
        int position = commandSpinner.getSelectedItemPosition();
        if (position < 0 || position >= manualCommands.length) {
            return;
        }
        RobotCommand command = manualCommands[position];
        commandText.setText(command.displayName);
        commandText.setTextColor(getColor(R.color.brand_dark));
        sendCommand(command, "выбрано вручную: " + command.displayName);
    }

    private void bindManual(int viewId, RobotCommand command) {
        findViewById(viewId).setOnClickListener(view -> {
            commandText.setText(command.displayName);
            sendCommand(command, "ручная кнопка");
        });
    }

    private void prepareRecognizer() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            micButton.setEnabled(false);
            listeningStatus.setText("На устройстве нет службы распознавания речи");
            return;
        }
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        speechRecognizer.setRecognitionListener(this);
    }

    private void toggleListening() {
        if (listening) {
            speechRecognizer.stopListening();
            return;
        }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},
                    MICROPHONE_PERMISSION_REQUEST);
            return;
        }
        startRussianRecognition();
    }

    private void startRussianRecognition() {
        if (speechRecognizer == null) {
            return;
        }
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ru-RU");
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 8);
        intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, false);
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Скажите команду для PiDog");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.putStringArrayListExtra(RecognizerIntent.EXTRA_BIASING_STRINGS,
                    new ArrayList<>(CommandParser.biasingPhrases()));
            intent.putExtra(RecognizerIntent.EXTRA_ENABLE_BIASING_DEVICE_CONTEXT, true);
        }
        listening = true;
        listeningStatus.setText(R.string.listening);
        micButton.setText("■");
        speechRecognizer.startListening(intent);
    }

    private void finishListening() {
        listening = false;
        listeningStatus.setText(R.string.tap_to_speak);
        micButton.setText("🎙");
    }

    private void handleResults(Bundle results, boolean partial) {
        ArrayList<String> phrases = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (phrases == null || phrases.isEmpty()) {
            return;
        }
        recognizedText.setText(phrases.get(0));
        if (partial) {
            return;
        }

        CommandParser.Match match = CommandParser.findBest(phrases);
        if (match == null) {
            commandText.setText("Команда не распознана — ничего не отправлено");
            commandText.setTextColor(getColor(R.color.warning));
            return;
        }
        commandText.setText(String.format(Locale.forLanguageTag("ru-RU"), "%s · %.0f%%",
                match.command.displayName, match.score * 100));
        commandText.setTextColor(getColor(R.color.brand_dark));
        recognizedText.setText(match.sourcePhrase);
        sendCommand(match.command, match.sourcePhrase);
    }

    private void checkConnection() {
        Endpoint endpoint = readEndpoint();
        if (endpoint == null) {
            return;
        }
        saveSettings();
        setConnectionState("Проверяю связь…", R.color.muted);
        robotClient.check(endpoint.host, endpoint.port, endpoint.token,
                (success, message) -> setConnectionState(message,
                        success ? R.color.brand : R.color.danger));
    }

    private void sendCommand(RobotCommand command, String phrase) {
        if (isVisionCommand(command)) {
            sendVisionCommand(command, phrase);
            return;
        }
        if (command == RobotCommand.CAMERA_ON) {
            startCameraStream();
            return;
        }
        if (command == RobotCommand.CAMERA_OFF) {
            stopCameraStream();
            return;
        }
        Endpoint endpoint = readEndpoint();
        if (endpoint == null) {
            return;
        }
        saveSettings();
        setConnectionState("Отправляю: " + command.displayName + "…", R.color.muted);
        robotClient.send(endpoint.host, endpoint.port, endpoint.token, command, phrase,
                (success, message) -> setConnectionState(message,
                        success ? R.color.brand : R.color.danger));
    }

    private void sendVisionCommand(RobotCommand command, String phrase) {
        Endpoint endpoint = readEndpoint();
        if (endpoint == null) {
            return;
        }
        saveSettings();
        String color = colorName(command);
        setConnectionState("Камера ищет: " + color + "…", R.color.muted);
        robotClient.sendVision(endpoint.host, endpoint.port, endpoint.token, command, phrase,
                (success, message, data) -> {
                    setConnectionState(message, success ? R.color.brand : R.color.danger);
                    if (success && data != null) {
                        String details = data.found ? "обнаружен" : "не найден";
                        if (data.found && data.x >= 0 && data.y >= 0) {
                            details += " · x=" + data.x + ", y=" + data.y;
                        }
                        appendVisionLog(colorName(data.color), details, data.found);
                    } else {
                        appendVisionLog(color, message, false);
                    }
                });
    }

    private void appendVisionLog(String subject, String details, boolean positive) {
        String marker = positive ? "●" : "○";
        String entry = logTime.format(new Date()) + "  " + marker + "  "
                + subject + " — " + details;
        visionEntries.addFirst(entry);
        while (visionEntries.size() > 10) {
            visionEntries.removeLast();
        }
        visionLog.setText(String.join("\n\n", visionEntries));
        visionLog.setTextColor(getColor(R.color.ink));
    }

    private void clearVisionLog() {
        visionEntries.clear();
        visionLog.setText("Событий пока нет. Выберите цвет для поиска.");
        visionLog.setTextColor(getColor(R.color.muted));
    }

    private static boolean isVisionCommand(RobotCommand command) {
        return command == RobotCommand.FIND_ORANGE || command == RobotCommand.FIND_RED
                || command == RobotCommand.FIND_YELLOW || command == RobotCommand.FIND_GREEN
                || command == RobotCommand.FIND_BLUE || command == RobotCommand.FIND_PURPLE;
    }

    private static String colorName(RobotCommand command) {
        switch (command) {
            case FIND_ORANGE: return "Оранжевый";
            case FIND_RED: return "Красный";
            case FIND_YELLOW: return "Жёлтый";
            case FIND_GREEN: return "Зелёный";
            case FIND_BLUE: return "Синий";
            case FIND_PURPLE: return "Фиолетовый";
            default: return command.displayName;
        }
    }

    private static String colorName(String color) {
        switch (color) {
            case "orange": return "Оранжевый";
            case "red": return "Красный";
            case "yellow": return "Жёлтый";
            case "green": return "Зелёный";
            case "blue": return "Синий";
            case "purple": return "Фиолетовый";
            default: return color == null || color.isEmpty() ? "Цвет" : color;
        }
    }

    private Endpoint readEndpoint() {
        String host = hostInput.getText().toString().trim();
        if (host.isEmpty()) {
            hostInput.setError("Введите IP-адрес Raspberry Pi");
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
            portInput.setError("Порт от 1 до 65535");
            portInput.requestFocus();
            return null;
        }
        return new Endpoint(host, port, tokenInput.getText().toString());
    }

    private void setConnectionState(String message, int colorResource) {
        connectionStatus.setText(message);
        connectionStatus.setTextColor(getColor(colorResource));
    }

    private void restoreSettings() {
        SharedPreferences preferences = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        hostInput.setText(preferences.getString("host", "192.168.1.37"));
        portInput.setText(preferences.getString("port", "8765"));
        tokenInput.setText(preferences.getString("token", ""));
    }

    private void saveSettings() {
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString("host", hostInput.getText().toString().trim())
                .putString("port", portInput.getText().toString().trim())
                .putString("token", tokenInput.getText().toString())
                .apply();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions,
                                           int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == MICROPHONE_PERMISSION_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startRussianRecognition();
            } else {
                Toast.makeText(this, "Без доступа к микрофону голосовые команды недоступны",
                        Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override public void onReadyForSpeech(Bundle params) {
        listeningStatus.setText("Говорите…");
    }

    @Override public void onBeginningOfSpeech() {
        listeningStatus.setText("Слышу вас…");
    }

    @Override public void onRmsChanged(float rmsdB) {
        float scale = Math.max(1.0f, Math.min(1.12f, 1.0f + (rmsdB / 100.0f)));
        micButton.setScaleX(scale);
        micButton.setScaleY(scale);
    }

    @Override public void onBufferReceived(byte[] buffer) { }

    @Override public void onEndOfSpeech() {
        listeningStatus.setText("Распознаю…");
    }

    @Override public void onError(int error) {
        finishListening();
        micButton.setScaleX(1.0f);
        micButton.setScaleY(1.0f);
        String message;
        switch (error) {
            case SpeechRecognizer.ERROR_NO_MATCH:
                message = "Не удалось разобрать фразу. Попробуйте ещё раз.";
                break;
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                message = "Речь не услышана";
                break;
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                message = "Ошибка сети при распознавании речи";
                break;
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                message = "Распознавание занято. Нажмите ещё раз.";
                break;
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                message = "Нет доступа к микрофону";
                break;
            case SpeechRecognizer.ERROR_CLIENT:
                message = "Распознавание остановлено";
                break;
            default:
                message = "Ошибка распознавания: " + error;
        }
        listeningStatus.setText(message);
    }

    @Override public void onResults(Bundle results) {
        finishListening();
        micButton.setScaleX(1.0f);
        micButton.setScaleY(1.0f);
        handleResults(results, false);
    }

    @Override public void onPartialResults(Bundle partialResults) {
        handleResults(partialResults, true);
    }

    @Override public void onEvent(int eventType, Bundle params) { }

    @Override
    protected void onResume() {
        super.onResume();
        sensorPollingHandler.removeCallbacks(sensorPoll);
        sensorPollingHandler.post(sensorPoll);
        if (cameraStreaming) {
            cameraView.onResume();
        }
    }

    @Override
    protected void onPause() {
        sensorPollingHandler.removeCallbacks(sensorPoll);
        if (cameraStreaming) {
            cameraView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        sensorPollingHandler.removeCallbacks(sensorPoll);
        if (speechRecognizer != null) {
            speechRecognizer.cancel();
            speechRecognizer.destroy();
        }
        cameraView.stopLoading();
        cameraView.loadUrl("about:blank");
        cameraView.destroy();
        robotClient.close();
        super.onDestroy();
    }

    private static final class Endpoint {
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

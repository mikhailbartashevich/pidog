package ru.pidog.voice;

import android.app.Activity;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.os.LocaleList;
import android.view.Menu;
import android.view.View;
import android.window.OnBackInvokedDispatcher;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.HorizontalScrollView;
import android.widget.ImageButton;
import android.widget.PopupMenu;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.ViewFlipper;

import java.util.Locale;

/**
 * Activity-level composition root. Feature behavior lives in focused controllers so this class
 * only coordinates navigation, language selection and command routing.
 */
public final class MainActivity extends Activity {
    private static final String PREF_LANGUAGE = "language";
    private static final String DEFAULT_LANGUAGE = "ru";
    private static final int PAGE_VOICE = 1;
    private static final int PAGE_MOVEMENT = 2;
    private static final int PAGE_COMMANDS = 3;
    private static final int PAGE_ASSISTANT = 6;

    private String currentLanguageTag;
    private RobotClient robotClient;
    private RobotConnection connection;
    private MovementController movementController;
    private VisionController visionController;
    private SensorController sensorController;
    private AssistantController assistantController;
    private SpeechRecognitionController speechController;

    private TextView commandText;
    private GroupedCommandView groupedCommands;
    private Spinner languageSpinner;
    private ViewFlipper servicePages;
    private Button[] navButtons;
    private HorizontalScrollView navScroll;
    private ImageButton menuButton;
    private TextView toolbarTitle;

    @Override
    protected void attachBaseContext(Context newBase) {
        SharedPreferences preferences = newBase.getSharedPreferences(
                RobotConnection.PREFERENCES_NAME, Context.MODE_PRIVATE);
        Locale locale = Locale.forLanguageTag(
                preferences.getString(PREF_LANGUAGE, DEFAULT_LANGUAGE));
        Configuration configuration = new Configuration(
                newBase.getResources().getConfiguration());
        configuration.setLocale(locale);
        configuration.setLocales(new LocaleList(locale));
        super.attachBaseContext(newBase.createConfigurationContext(configuration));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        currentLanguageTag = getSharedPreferences(
                RobotConnection.PREFERENCES_NAME, Context.MODE_PRIVATE)
                .getString(PREF_LANGUAGE, DEFAULT_LANGUAGE);
        robotClient = new RobotClient(isEnglish());
        setContentView(R.layout.activity_main);

        bindActivityViews();
        applySystemBarInsets();
        createControllers();
        bindActions();
        bindBackNavigation();
    }

    private void bindActivityViews() {
        commandText = findViewById(R.id.commandText);
        groupedCommands = findViewById(R.id.groupedCommandsContainer);
        languageSpinner = findViewById(R.id.languageSpinner);
        servicePages = findViewById(R.id.servicePages);
        navScroll = findViewById(R.id.navScroll);
        menuButton = findViewById(R.id.menuButton);
        toolbarTitle = findViewById(R.id.toolbarTitle);
        navButtons = new Button[]{
                findViewById(R.id.navConnection), findViewById(R.id.navVoice),
                findViewById(R.id.navMovement), findViewById(R.id.navCommands),
                findViewById(R.id.navVision), findViewById(R.id.navSensors),
                findViewById(R.id.navAssistant)
        };
    }

    private void createControllers() {
        connection = new RobotConnection(this);
        connection.restore();
        movementController = new MovementController(
                this, robotClient, connection, currentLanguageTag);
        visionController = new VisionController(
                this, robotClient, connection, currentLanguageTag);
        sensorController = new SensorController(this, robotClient, connection);
        assistantController = new AssistantController(this, robotClient, connection);
        speechController = new SpeechRecognitionController(
                this, currentLanguageTag, connection, new SpeechRecognitionController.Listener() {
                    @Override
                    public void onCommand(RobotCommand command, String sourcePhrase) {
                        sendCommand(command, sourcePhrase);
                    }

                    @Override
                    public void onAssistantText(String text, boolean complete) {
                        assistantController.updateRecognizedQuestion(text, complete);
                    }
                });
    }

    private void bindActions() {
        bindLanguageSpinner();
        bindNavigation();
        menuButton.setOnClickListener(view -> showNavigationMenu());
        bindCommandButtons();
        findViewById(R.id.connectButton)
                .setOnClickListener(view -> connection.check(robotClient));
        findViewById(R.id.localMicButton)
                .setOnClickListener(view -> enableBuiltInMicrophone());
        movementController.bind();
        visionController.bind();
        sensorController.bind();
        speechController.bind();
        assistantController.bind(speechController::toggleAssistant);
    }

    private void bindCommandButtons() {
        groupedCommands.configure(currentLanguageTag, command -> {
            commandText.setText(command.displayName(currentLanguageTag));
            commandText.setTextColor(getColor(R.color.brand_dark));
            sendCommand(command, getString(R.string.manual_button_phrase));
        });

        bindManual(R.id.approachObstacleButton, RobotCommand.APPROACH_OBSTACLE);

        bindManual(R.id.findOrangeButton, RobotCommand.FIND_ORANGE);
        bindManual(R.id.findRedButton, RobotCommand.FIND_RED);
        bindManual(R.id.findYellowButton, RobotCommand.FIND_YELLOW);
        bindManual(R.id.findGreenButton, RobotCommand.FIND_GREEN);
        bindManual(R.id.findBlueButton, RobotCommand.FIND_BLUE);
        bindManual(R.id.findPurpleButton, RobotCommand.FIND_PURPLE);

        bindManual(R.id.distanceButton, RobotCommand.MEASURE_DISTANCE);
        bindManual(R.id.listenSoundButton, RobotCommand.LISTEN_SOUND);
        bindManual(R.id.batteryButton, RobotCommand.SHOW_BATTERY);
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

    private void bindManual(int viewId, RobotCommand command) {
        findViewById(viewId).setOnClickListener(view -> {
            commandText.setText(command.displayName(currentLanguageTag));
            commandText.setTextColor(getColor(R.color.brand_dark));
            sendCommand(command, getString(R.string.manual_button_phrase));
        });
    }

    private void sendCommand(RobotCommand command, String phrase) {
        if (command == RobotCommand.STOP && movementController.isMoving()) {
            movementController.stop();
            return;
        }
        if (visionController.handles(command)) {
            visionController.send(command, phrase);
            return;
        }
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint == null) {
            return;
        }
        connection.save();
        String progressMessage = getString(R.string.sending_command,
                command.displayName(currentLanguageTag));
        if (command == RobotCommand.LISTEN_SOUND) {
            connection.showListeningStatus(progressMessage);
        } else {
            connection.showStatus(progressMessage, R.color.muted);
        }
        robotClient.send(endpoint.host, endpoint.port, endpoint.token, command, phrase,
                (success, message) -> connection.showStatus(message,
                        success ? R.color.brand : R.color.danger));
    }

    private void enableBuiltInMicrophone() {
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint == null) {
            return;
        }
        connection.save();
        Button localMicButton = findViewById(R.id.localMicButton);
        localMicButton.setEnabled(false);
        localMicButton.setText(R.string.built_in_microphone_starting);
        connection.showListeningStatus(getString(R.string.sending_command,
                RobotCommand.LOCAL_VOICE_ON.displayName(currentLanguageTag)));
        robotClient.send(endpoint.host, endpoint.port, endpoint.token,
                RobotCommand.LOCAL_VOICE_ON, getString(R.string.built_in_microphone_phrase),
                (success, message) -> {
                    localMicButton.setEnabled(true);
                    localMicButton.setText(success
                            ? R.string.built_in_microphone_active
                            : R.string.use_built_in_microphone);
                    connection.showStatus(message, success ? R.color.brand : R.color.danger);
                });
    }

    private void bindLanguageSpinner() {
        ArrayAdapter<CharSequence> adapter = ArrayAdapter.createFromResource(
                this, R.array.language_options, android.R.layout.simple_spinner_item);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        languageSpinner.setAdapter(adapter);
        languageSpinner.setSelection(isEnglish() ? 1 : 0, false);
        languageSpinner.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                String selectedLanguage = position == 1 ? "en" : "ru";
                if (selectedLanguage.equals(currentLanguageTag)) {
                    return;
                }
                connection.save();
                getSharedPreferences(RobotConnection.PREFERENCES_NAME, Context.MODE_PRIVATE)
                        .edit().putString(PREF_LANGUAGE, selectedLanguage).apply();
                recreate();
            }

            @Override public void onNothingSelected(AdapterView<?> parent) { }
        });
    }

    private void bindNavigation() {
        for (int page = 0; page < navButtons.length; page++) {
            int targetPage = page;
            navButtons[page].setOnClickListener(view -> showPage(targetPage));
        }
        showPage(PAGE_VOICE);
    }

    private void showPage(int page) {
        if (servicePages.getDisplayedChild() == PAGE_MOVEMENT
                && page != PAGE_MOVEMENT && movementController.isMoving()) {
            movementController.stop();
        }
        servicePages.setDisplayedChild(page);
        toolbarTitle.setText(pageTitleResource(page));
        if (page == PAGE_COMMANDS) {
            groupedCommands.showGroups();
        }
        if (page == PAGE_ASSISTANT) {
            assistantController.refreshStatus(false);
        }
        for (int index = 0; index < navButtons.length; index++) {
            boolean selected = index == page;
            navButtons[index].setBackgroundTintList(ColorStateList.valueOf(
                    getColor(selected ? R.color.brand : R.color.brand_soft)));
            navButtons[index].setTextColor(getColor(
                    selected ? R.color.on_brand : R.color.brand_dark));
        }
        navScroll.post(() -> {
            navScroll.scrollTo(0, 0);
        });
    }

    private void showNavigationMenu() {
        PopupMenu popup = new PopupMenu(this, menuButton);
        int[] labels = {
                R.string.nav_connection,
                R.string.nav_voice,
                R.string.nav_movement,
                R.string.nav_commands,
                R.string.nav_camera,
                R.string.nav_sensors,
                R.string.nav_assistant
        };
        for (int page = 0; page < labels.length; page++) {
            popup.getMenu().add(Menu.NONE, page, page, labels[page]);
        }
        popup.setOnMenuItemClickListener(item -> {
            showPage(item.getItemId());
            return true;
        });
        popup.show();
    }

    private int pageTitleResource(int page) {
        switch (page) {
            case 0: return R.string.connection_page_title;
            case PAGE_VOICE: return R.string.voice_page_title;
            case PAGE_MOVEMENT: return R.string.movement_page_title;
            case PAGE_COMMANDS: return R.string.commands_page_title;
            case 4: return R.string.camera_page_title;
            case 5: return R.string.sensors_page_title;
            case PAGE_ASSISTANT: return R.string.assistant_page_title;
            default: return R.string.app_name;
        }
    }

    private boolean isEnglish() {
        return currentLanguageTag != null && currentLanguageTag.startsWith("en");
    }

    @SuppressLint("GestureBackNavigation")
    @Override
    public void onBackPressed() {
        if (!handleBackNavigation()) {
            super.onBackPressed();
        }
    }

    private void bindBackNavigation() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, () -> {
                        if (!handleBackNavigation()) {
                            finishAfterTransition();
                        }
                    });
        }
    }

    private boolean handleBackNavigation() {
        return servicePages.getDisplayedChild() == PAGE_COMMANDS
                && groupedCommands.navigateUp();
    }

    @SuppressWarnings("deprecation")
    private void applySystemBarInsets() {
        View globalStatusBar = findViewById(R.id.globalStatusBar);
        View mainRoot = findViewById(R.id.mainRoot);
        int statusStart = globalStatusBar.getPaddingStart();
        int statusTop = globalStatusBar.getPaddingTop();
        int statusEnd = globalStatusBar.getPaddingEnd();
        int statusBottom = globalStatusBar.getPaddingBottom();
        int rootStart = mainRoot.getPaddingStart();
        int rootTop = mainRoot.getPaddingTop();
        int rootEnd = mainRoot.getPaddingEnd();
        int rootBottom = mainRoot.getPaddingBottom();

        globalStatusBar.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPaddingRelative(statusStart,
                    statusTop + insets.getSystemWindowInsetTop(), statusEnd, statusBottom);
            return insets;
        });
        mainRoot.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPaddingRelative(rootStart, rootTop, rootEnd,
                    rootBottom + insets.getSystemWindowInsetBottom());
            return insets;
        });
        globalStatusBar.requestApplyInsets();
        mainRoot.requestApplyInsets();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions,
                                           int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        speechController.onPermissionResult(requestCode, grantResults);
    }

    @Override
    protected void onResume() {
        super.onResume();
        sensorController.startPolling();
        visionController.onResume();
    }

    @Override
    protected void onPause() {
        sensorController.stopPolling();
        if (movementController.isMoving()) {
            movementController.stop();
        }
        visionController.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        sensorController.stopPolling();
        speechController.destroy();
        visionController.destroy();
        connection.destroy();
        robotClient.close();
        super.onDestroy();
    }
}

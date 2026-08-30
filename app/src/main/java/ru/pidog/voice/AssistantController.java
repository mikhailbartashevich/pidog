package ru.pidog.voice;

import android.app.Activity;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Switch;
import android.widget.TextView;

/** Owns local-assistant status, controls, chat and history rendering. */
final class AssistantController {
    private final Activity activity;
    private final RobotClient client;
    private final RobotConnection connection;
    private final TextView stateView;
    private final TextView modelView;
    private final TextView detailsView;
    private final EditText questionInput;
    private final TextView answerView;
    private final TextView sourcesView;
    private final Switch webSwitch;
    private final Switch speakSwitch;
    private final Button startButton;
    private final Button stopButton;
    private final Button askButton;
    private final Button micButton;

    AssistantController(Activity activity, RobotClient client, RobotConnection connection) {
        this.activity = activity;
        this.client = client;
        this.connection = connection;
        stateView = activity.findViewById(R.id.assistantState);
        modelView = activity.findViewById(R.id.assistantModel);
        detailsView = activity.findViewById(R.id.assistantDetails);
        questionInput = activity.findViewById(R.id.assistantQuestion);
        answerView = activity.findViewById(R.id.assistantAnswer);
        sourcesView = activity.findViewById(R.id.assistantSources);
        webSwitch = activity.findViewById(R.id.assistantWebSwitch);
        speakSwitch = activity.findViewById(R.id.assistantSpeakSwitch);
        startButton = activity.findViewById(R.id.assistantStartButton);
        stopButton = activity.findViewById(R.id.assistantStopButton);
        askButton = activity.findViewById(R.id.assistantAskButton);
        micButton = activity.findViewById(R.id.assistantMicButton);
    }

    void bind(Runnable microphoneAction) {
        startButton.setOnClickListener(view -> control("start"));
        stopButton.setOnClickListener(view -> control("stop"));
        activity.findViewById(R.id.assistantRefreshButton)
                .setOnClickListener(view -> refreshStatus(true));
        askButton.setOnClickListener(view -> ask());
        micButton.setOnClickListener(view -> microphoneAction.run());
        activity.findViewById(R.id.assistantClearButton)
                .setOnClickListener(view -> clearHistory());
    }

    void updateRecognizedQuestion(String question, boolean complete) {
        questionInput.setText(question);
        if (complete) {
            ask();
        }
    }

    void refreshStatus(boolean announce) {
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint == null) {
            return;
        }
        if (announce) {
            stateView.setText(R.string.assistant_checking);
            stateView.setTextColor(activity.getColor(R.color.muted));
            connection.showStatus(
                    activity.getString(R.string.assistant_checking), R.color.muted);
        }
        client.assistantStatus(endpoint.host, endpoint.port, endpoint.token,
                (success, message, status) -> {
                    if (success && status != null) {
                        renderStatus(status);
                        if (announce) {
                            connection.showStatus(message, R.color.brand);
                        }
                    } else if (announce) {
                        stateView.setText(message);
                        stateView.setTextColor(activity.getColor(R.color.danger));
                        connection.showStatus(message, R.color.danger);
                    }
                });
    }

    private void renderStatus(RobotClient.AssistantStatus status) {
        int stateText;
        int stateColor;
        if (!status.installed) {
            stateText = R.string.assistant_not_installed;
            stateColor = R.color.danger;
        } else if (status.running) {
            stateText = R.string.assistant_running;
            stateColor = R.color.brand;
        } else if ("starting".equals(status.state) || "activating".equals(status.state)) {
            stateText = R.string.assistant_starting;
            stateColor = R.color.warning;
        } else {
            stateText = R.string.assistant_stopped;
            stateColor = R.color.muted;
        }
        stateView.setText(stateText);
        stateView.setTextColor(activity.getColor(stateColor));
        modelView.setText(activity.getString(R.string.assistant_model_format,
                status.model, status.contextTokens));
        String search = status.webAvailable
                ? status.webProvider : activity.getString(R.string.assistant_unavailable);
        String voice = activity.getString(status.ttsReady
                ? R.string.assistant_available : R.string.assistant_unavailable);
        String details = activity.getString(R.string.assistant_details_format, search, voice);
        if (!status.error.isEmpty()) {
            details += "\n" + status.error;
        }
        detailsView.setText(details);
        startButton.setEnabled(status.installed && !status.running);
        stopButton.setEnabled(status.running || "starting".equals(status.state));
        askButton.setEnabled(status.running && !status.busy);
        micButton.setEnabled(status.running && !status.busy);
        webSwitch.setEnabled(status.webAvailable);
        speakSwitch.setEnabled(status.ttsReady);
    }

    private void control(String action) {
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint == null) {
            return;
        }
        setControlsEnabled(false);
        stateView.setText(activity.getString(R.string.assistant_action_running, action));
        stateView.setTextColor(activity.getColor(R.color.muted));
        connection.showStatus(
                activity.getString(R.string.assistant_action_running, action), R.color.muted);
        client.assistantControl(endpoint.host, endpoint.port, endpoint.token, action,
                (success, message, status) -> {
                    connection.showStatus(message, success ? R.color.brand : R.color.danger);
                    if (success && status != null) {
                        renderStatus(status);
                    } else {
                        stateView.setText(message);
                        stateView.setTextColor(activity.getColor(R.color.danger));
                        setControlsEnabled(true);
                    }
                });
    }

    private void ask() {
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint == null) {
            return;
        }
        String question = questionInput.getText().toString().trim();
        if (question.isEmpty()) {
            questionInput.setError(activity.getString(R.string.assistant_question_required));
            questionInput.requestFocus();
            return;
        }
        connection.save();
        setControlsEnabled(false);
        answerView.setText(R.string.assistant_asking);
        answerView.setTextColor(activity.getColor(R.color.muted));
        sourcesView.setText(R.string.assistant_sources_empty);
        connection.showStatus(
                activity.getString(R.string.assistant_asking), R.color.muted);
        client.assistantChat(endpoint.host, endpoint.port, endpoint.token, question,
                webSwitch.isChecked(), speakSwitch.isChecked(), (success, message, reply) -> {
                    setControlsEnabled(true);
                    connection.showStatus(success
                                    ? activity.getString(R.string.assistant_running) : message,
                            success ? R.color.brand : R.color.danger);
                    if (!success || reply == null) {
                        answerView.setText(message);
                        answerView.setTextColor(activity.getColor(R.color.danger));
                        refreshStatus(false);
                        return;
                    }
                    answerView.setText(reply.answer);
                    answerView.setTextColor(activity.getColor(R.color.ink));
                    if (reply.sources.isEmpty()) {
                        sourcesView.setText(reply.warning.isEmpty()
                                ? activity.getString(R.string.assistant_no_sources)
                                : reply.warning);
                    } else {
                        sourcesView.setText(activity.getString(R.string.assistant_sources_format,
                                activity.getString(R.string.assistant_sources_title), reply.sources));
                    }
                });
    }

    private void clearHistory() {
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint == null) {
            return;
        }
        connection.showStatus(
                activity.getString(R.string.assistant_clearing_history), R.color.muted);
        client.clearAssistantHistory(endpoint.host, endpoint.port, endpoint.token,
                (success, message) -> {
                    if (success) {
                        answerView.setText(R.string.assistant_answer_empty);
                        answerView.setTextColor(activity.getColor(R.color.muted));
                        sourcesView.setText(R.string.assistant_sources_empty);
                        connection.showStatus(
                                activity.getString(R.string.assistant_history_cleared), R.color.brand);
                    } else {
                        connection.showStatus(message, R.color.danger);
                    }
                });
    }

    private void setControlsEnabled(boolean enabled) {
        askButton.setEnabled(enabled);
        micButton.setEnabled(enabled);
        startButton.setEnabled(enabled);
        stopButton.setEnabled(enabled);
    }
}

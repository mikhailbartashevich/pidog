package ru.pidog.voice;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.Locale;

/** Wraps Android speech recognition for command and assistant input modes. */
final class SpeechRecognitionController implements RecognitionListener {
    static final int PERMISSION_REQUEST = 41;

    interface Listener {
        void onCommand(RobotCommand command, String sourcePhrase);
        void onAssistantText(String text, boolean complete);
    }

    private final Activity activity;
    private final String languageTag;
    private final RobotConnection connection;
    private final Listener listener;
    private final TextView listeningStatus;
    private final TextView recognizedText;
    private final TextView commandText;
    private final TextView assistantAnswer;
    private final Button micButton;
    private final Button assistantMicButton;

    private SpeechRecognizer recognizer;
    private boolean listening;
    private boolean assistantMode;

    SpeechRecognitionController(Activity activity, String languageTag,
                                RobotConnection connection, Listener listener) {
        this.activity = activity;
        this.languageTag = languageTag;
        this.connection = connection;
        this.listener = listener;
        listeningStatus = activity.findViewById(R.id.listeningStatus);
        recognizedText = activity.findViewById(R.id.recognizedText);
        commandText = activity.findViewById(R.id.commandText);
        assistantAnswer = activity.findViewById(R.id.assistantAnswer);
        micButton = activity.findViewById(R.id.micButton);
        assistantMicButton = activity.findViewById(R.id.assistantMicButton);
    }

    void bind() {
        micButton.setOnClickListener(view -> toggle(false));
        if (!SpeechRecognizer.isRecognitionAvailable(activity)) {
            micButton.setEnabled(false);
            assistantMicButton.setEnabled(false);
            listeningStatus.setText(R.string.recognizer_unavailable);
            return;
        }
        recognizer = SpeechRecognizer.createSpeechRecognizer(activity);
        recognizer.setRecognitionListener(this);
    }

    void toggleAssistant() {
        toggle(true);
    }

    void onPermissionResult(int requestCode, int[] grantResults) {
        if (requestCode != PERMISSION_REQUEST) {
            return;
        }
        if (grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            start();
        } else {
            assistantMode = false;
            connection.showStatus(
                    activity.getString(R.string.microphone_denied), R.color.danger);
            Toast.makeText(activity, R.string.microphone_denied, Toast.LENGTH_LONG).show();
        }
    }

    void destroy() {
        if (recognizer != null) {
            recognizer.cancel();
            recognizer.destroy();
            recognizer = null;
        }
    }

    private void toggle(boolean useAssistantMode) {
        if (listening) {
            recognizer.stopListening();
            return;
        }
        assistantMode = useAssistantMode;
        if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},
                    PERMISSION_REQUEST);
            return;
        }
        start();
    }

    private void start() {
        if (recognizer == null) {
            return;
        }
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, recognitionLanguageTag());
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 8);
        intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, false);
        intent.putExtra(RecognizerIntent.EXTRA_PROMPT, activity.getString(assistantMode
                ? R.string.assistant_mic_description : R.string.recognizer_prompt));
        if (!assistantMode && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.putStringArrayListExtra(RecognizerIntent.EXTRA_BIASING_STRINGS,
                    new ArrayList<>(CommandParser.biasingPhrases(languageTag)));
            intent.putExtra(RecognizerIntent.EXTRA_ENABLE_BIASING_DEVICE_CONTEXT, true);
        }
        listening = true;
        if (assistantMode) {
            assistantAnswer.setText(R.string.assistant_listening);
            assistantAnswer.setTextColor(activity.getColor(R.color.muted));
            assistantMicButton.setText(R.string.icon_stop);
            connection.showListeningStatus(
                    activity.getString(R.string.assistant_listening));
        } else {
            listeningStatus.setText(R.string.listening);
            micButton.setText(R.string.icon_stop);
            connection.showListeningStatus(activity.getString(R.string.listening));
        }
        recognizer.startListening(intent);
    }

    private void finishListening() {
        listening = false;
        listeningStatus.setText(R.string.tap_to_speak);
        micButton.setText(R.string.icon_microphone);
        assistantMicButton.setText(R.string.icon_microphone);
        resetMicScale();
    }

    private void handleResults(Bundle results, boolean partial) {
        ArrayList<String> phrases = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (phrases == null || phrases.isEmpty()) {
            return;
        }
        String bestPhrase = phrases.get(0);
        if (assistantMode) {
            listener.onAssistantText(bestPhrase, !partial);
            return;
        }
        recognizedText.setText(bestPhrase);
        if (partial) {
            return;
        }
        CommandParser.Match match = CommandParser.findBest(phrases, languageTag);
        if (match == null) {
            commandText.setText(R.string.command_not_recognized);
            commandText.setTextColor(activity.getColor(R.color.warning));
            connection.showStatus(
                    activity.getString(R.string.command_not_recognized), R.color.warning);
            return;
        }
        commandText.setText(String.format(Locale.forLanguageTag(recognitionLanguageTag()),
                "%s · %.0f%%", match.command.displayName(languageTag), match.score * 100));
        commandText.setTextColor(activity.getColor(R.color.brand_dark));
        recognizedText.setText(match.sourcePhrase);
        listener.onCommand(match.command, match.sourcePhrase);
    }

    private String recognitionLanguageTag() {
        return languageTag != null && languageTag.startsWith("en") ? "en-US" : "ru-RU";
    }

    private void resetMicScale() {
        micButton.setScaleX(1.0f);
        micButton.setScaleY(1.0f);
        assistantMicButton.setScaleX(1.0f);
        assistantMicButton.setScaleY(1.0f);
    }

    @Override public void onReadyForSpeech(Bundle params) {
        listeningStatus.setText(R.string.speak_now);
        connection.showListeningStatus(activity.getString(assistantMode
                ? R.string.assistant_listening : R.string.speak_now));
    }

    @Override public void onBeginningOfSpeech() {
        listeningStatus.setText(R.string.hearing_you);
        connection.showListeningStatus(activity.getString(R.string.hearing_you));
    }

    @Override public void onRmsChanged(float rmsdB) {
        float scale = Math.max(1.0f, Math.min(1.12f, 1.0f + rmsdB / 100.0f));
        Button activeMic = assistantMode ? assistantMicButton : micButton;
        activeMic.setScaleX(scale);
        activeMic.setScaleY(scale);
    }

    @Override public void onBufferReceived(byte[] buffer) { }

    @Override public void onEndOfSpeech() {
        listeningStatus.setText(R.string.recognizing);
        connection.showThinkingStatus(activity.getString(R.string.recognizing));
    }

    @Override public void onError(int error) {
        boolean wasAssistantMode = assistantMode;
        finishListening();
        String message;
        switch (error) {
            case SpeechRecognizer.ERROR_NO_MATCH:
                message = activity.getString(R.string.recognition_no_match);
                break;
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                message = activity.getString(R.string.recognition_timeout);
                break;
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                message = activity.getString(R.string.recognition_network_error);
                break;
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                message = activity.getString(R.string.recognizer_busy);
                break;
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                message = activity.getString(R.string.microphone_unavailable);
                break;
            case SpeechRecognizer.ERROR_CLIENT:
                message = activity.getString(R.string.recognition_stopped);
                break;
            default:
                message = activity.getString(R.string.recognition_error, error);
        }
        listeningStatus.setText(message);
        connection.showStatus(message, R.color.danger);
        if (wasAssistantMode) {
            assistantAnswer.setText(message);
            assistantAnswer.setTextColor(activity.getColor(R.color.warning));
        }
        assistantMode = false;
    }

    @Override public void onResults(Bundle results) {
        finishListening();
        handleResults(results, false);
        assistantMode = false;
    }

    @Override public void onPartialResults(Bundle partialResults) {
        handleResults(partialResults, true);
    }

    @Override public void onEvent(int eventType, Bundle params) { }
}

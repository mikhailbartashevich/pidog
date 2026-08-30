package ru.pidog.voice;

import android.app.Activity;
import android.content.res.ColorStateList;
import android.os.Handler;
import android.os.Looper;
import android.widget.TextView;

/** Polls sensors while the screen is active and renders power state consistently. */
final class SensorController {
    private static final long POLL_INTERVAL_MS = 12_000;

    private final Activity activity;
    private final RobotClient client;
    private final RobotConnection connection;
    private final TextView sensorsText;
    private final SensorDashboardView dashboard;
    private final TextView powerIndicatorIcon;
    private final TextView powerIndicatorTitle;
    private final TextView powerIndicatorDetail;
    private final TextView powerIndicatorBadge;
    private final Handler pollingHandler = new Handler(Looper.getMainLooper());
    private final Runnable sensorPoll = new Runnable() {
        @Override public void run() {
            refresh(false);
            pollingHandler.postDelayed(this, POLL_INTERVAL_MS);
        }
    };

    SensorController(Activity activity, RobotClient client, RobotConnection connection) {
        this.activity = activity;
        this.client = client;
        this.connection = connection;
        sensorsText = activity.findViewById(R.id.sensorsText);
        dashboard = activity.findViewById(R.id.sensorDashboard);
        powerIndicatorIcon = activity.findViewById(R.id.powerIndicatorIcon);
        powerIndicatorTitle = activity.findViewById(R.id.powerIndicatorTitle);
        powerIndicatorDetail = activity.findViewById(R.id.powerIndicatorDetail);
        powerIndicatorBadge = activity.findViewById(R.id.powerIndicatorBadge);
    }

    void bind() {
        activity.findViewById(R.id.refreshSensorsButton)
                .setOnClickListener(view -> refresh(true));
    }

    void startPolling() {
        pollingHandler.removeCallbacks(sensorPoll);
        pollingHandler.post(sensorPoll);
    }

    void stopPolling() {
        pollingHandler.removeCallbacks(sensorPoll);
    }

    private void refresh(boolean announce) {
        if (!announce && !connection.hasAddress()) {
            return;
        }
        RobotConnection.Endpoint endpoint = connection.read();
        if (endpoint == null) {
            return;
        }
        connection.save();
        if (announce) {
            sensorsText.setText(R.string.reading_sensors);
            connection.showStatus(
                    activity.getString(R.string.reading_sensors), R.color.muted);
        }
        client.sensors(endpoint.host, endpoint.port, endpoint.token, (success, message, data) -> {
            if (success) {
                sensorsText.setText(message);
                dashboard.update(data);
                updatePowerIndicator(data);
            }
            if (announce) {
                connection.showStatus(success ? activity.getString(R.string.sensors_updated) : message,
                        success ? R.color.brand : R.color.danger);
            }
        });
    }

    private void updatePowerIndicator(RobotClient.SensorData data) {
        if (data == null || !data.powerKnown) {
            styleIndicator(powerIndicatorIcon, R.string.icon_unknown,
                    R.color.muted, R.color.surface_variant);
            powerIndicatorTitle.setText(R.string.determining_power);
            powerIndicatorDetail.setText(R.string.power_detection_wait);
            setPowerBadge(activity.getString(R.string.checking_badge),
                    R.color.muted, R.color.surface_variant);
            return;
        }

        if (data.externalPower) {
            styleIndicator(powerIndicatorIcon, R.string.icon_power,
                    R.color.brand_dark, R.color.brand_soft);
            powerIndicatorTitle.setText(R.string.external_power_connected);
            if (data.chargingKnown && data.charging) {
                powerIndicatorDetail.setText(R.string.battery_charging_detail);
                setPowerBadge(activity.getString(R.string.charging_badge),
                        R.color.brand_dark, R.color.brand_soft);
            } else {
                powerIndicatorDetail.setText(R.string.external_power_detail);
                setPowerBadge(activity.getString(R.string.connected_badge),
                        R.color.brand_dark, R.color.brand_soft);
            }
            return;
        }

        styleIndicator(powerIndicatorIcon, R.string.icon_battery,
                R.color.warning, R.color.surface_variant);
        powerIndicatorTitle.setText(R.string.battery_power);
        powerIndicatorDetail.setText(R.string.external_power_not_found);
        setPowerBadge(activity.getString(R.string.battery_badge),
                R.color.warning, R.color.surface_variant);
    }

    private void styleIndicator(TextView view, int textResource,
                                int textColor, int backgroundColor) {
        view.setText(textResource);
        styleIndicator(view, textColor, backgroundColor);
    }

    private void styleIndicator(TextView view, int textColor, int backgroundColor) {
        view.setTextColor(activity.getColor(textColor));
        view.setBackgroundTintList(ColorStateList.valueOf(activity.getColor(backgroundColor)));
    }

    private void setPowerBadge(String text, int textColor, int backgroundColor) {
        powerIndicatorBadge.setText(text);
        styleIndicator(powerIndicatorBadge, textColor, backgroundColor);
    }
}

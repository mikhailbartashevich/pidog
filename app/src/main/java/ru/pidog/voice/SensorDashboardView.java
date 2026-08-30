package ru.pidog.voice;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.util.AttributeSet;
import android.view.View;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;

/** Compact live dashboard for battery, ultrasonic distance and sound direction. */
public final class SensorDashboardView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Deque<Float> distanceHistory = new ArrayDeque<>();
    private float batteryPercent = -1;
    private float batteryVoltage = -1;
    private float distanceCm = -1;
    private float soundDirection = -1;
    private final float density;
    private final int inkColor;
    private final int mutedColor;
    private final int panelColor;
    private final int surfaceVariantColor;
    private final int strokeColor;
    private final int strokeBrightColor;
    private final int brandColor;
    private final int dangerColor;
    private final int warningColor;
    private final int successColor;

    public SensorDashboardView(Context context, AttributeSet attrs) {
        super(context, attrs);
        density = getResources().getDisplayMetrics().density;
        inkColor = context.getColor(R.color.ink);
        mutedColor = context.getColor(R.color.muted);
        panelColor = context.getColor(R.color.panel);
        surfaceVariantColor = context.getColor(R.color.surface_variant);
        strokeColor = context.getColor(R.color.stroke);
        strokeBrightColor = context.getColor(R.color.stroke_bright);
        brandColor = context.getColor(R.color.brand);
        dangerColor = context.getColor(R.color.danger);
        warningColor = context.getColor(R.color.warning);
        successColor = context.getColor(R.color.success);
        setLayerType(View.LAYER_TYPE_SOFTWARE, null);
    }

    public void update(RobotClient.SensorData data) {
        if (data == null) return;
        batteryPercent = data.batteryPercent;
        batteryVoltage = data.batteryVoltage;
        distanceCm = data.distanceCm;
        soundDirection = data.soundDirection;
        if (distanceCm >= 0) {
            if (distanceHistory.size() == 24) distanceHistory.removeFirst();
            distanceHistory.addLast(distanceCm);
        }
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float width = getWidth();
        float gap = dp(10);
        float cardWidth = (width - gap) / 2f;
        drawCard(canvas, 0, 0, cardWidth, dp(142));
        drawCard(canvas, cardWidth + gap, 0, width, dp(142));
        drawCard(canvas, 0, dp(152), width, dp(260));
        drawBattery(canvas, cardWidth / 2f, dp(68));
        drawSound(canvas, cardWidth + gap + cardWidth / 2f, dp(68));
        drawDistanceChart(canvas, dp(16), dp(170), width - dp(16), dp(245));
    }

    private void drawCard(Canvas canvas, float left, float top, float right, float bottom) {
        paint.setStyle(Paint.Style.FILL);
        paint.setShader(new LinearGradient(left, bottom, right, top,
                panelColor, surfaceVariantColor, Shader.TileMode.CLAMP));
        paint.setShadowLayer(dp(8), 0, dp(3), 0x66000000);
        RectF card = new RectF(left, top, right, bottom);
        canvas.drawRoundRect(card, dp(18), dp(18), paint);
        paint.clearShadowLayer();
        paint.setShader(null);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(1));
        paint.setColor(strokeBrightColor);
        canvas.drawRoundRect(card, dp(18), dp(18), paint);
    }

    private void drawBattery(Canvas canvas, float cx, float cy) {
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(9));
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setColor(strokeColor);
        RectF arc = new RectF(cx - dp(38), cy - dp(38), cx + dp(38), cy + dp(38));
        canvas.drawArc(arc, 135, 270, false, paint);
        if (batteryPercent >= 0) {
            paint.setColor(batteryPercent < 25 ? dangerColor
                    : batteryPercent < 55 ? warningColor : successColor);
            canvas.drawArc(arc, 135, 270 * batteryPercent / 100f, false, paint);
        }
        paint.setStyle(Paint.Style.FILL);
        paint.setTextAlign(Paint.Align.CENTER);
        paint.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        paint.setTextSize(dp(22));
        paint.setColor(inkColor);
        canvas.drawText(batteryPercent < 0 ? "—" : Math.round(batteryPercent) + "%", cx, cy + dp(6), paint);
        paint.setTextSize(dp(11));
        paint.setTypeface(android.graphics.Typeface.DEFAULT);
        paint.setColor(mutedColor);
        String voltage = batteryVoltage < 0
                ? getResources().getString(R.string.dashboard_battery)
                : getResources().getString(R.string.dashboard_voltage_format, batteryVoltage);
        canvas.drawText(voltage, cx, dp(127), paint);
    }

    private void drawSound(Canvas canvas, float cx, float cy) {
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(2));
        paint.setColor(strokeColor);
        canvas.drawCircle(cx, cy, dp(39), paint);
        canvas.drawCircle(cx, cy, dp(21), paint);
        canvas.drawLine(cx, cy - dp(44), cx, cy + dp(44), paint);
        canvas.drawLine(cx - dp(44), cy, cx + dp(44), cy, paint);
        if (soundDirection >= 0) {
            double angle = Math.toRadians(soundDirection - 90);
            float ex = cx + (float) Math.cos(angle) * dp(34);
            float ey = cy + (float) Math.sin(angle) * dp(34);
            paint.setColor(brandColor);
            paint.setStrokeWidth(dp(5));
            paint.setStrokeCap(Paint.Cap.ROUND);
            canvas.drawLine(cx, cy, ex, ey, paint);
            canvas.drawCircle(ex, ey, dp(5), paint);
        }
        paint.setStyle(Paint.Style.FILL);
        paint.setTextAlign(Paint.Align.CENTER);
        paint.setTextSize(dp(11));
        paint.setColor(mutedColor);
        canvas.drawText(soundDirection < 0
                        ? getResources().getString(R.string.dashboard_sound_not_found)
                        : getResources().getString(R.string.dashboard_sound_format,
                                Math.round(soundDirection)),
                cx, dp(127), paint);
    }

    private void drawDistanceChart(Canvas canvas, float left, float top, float right, float bottom) {
        paint.setStyle(Paint.Style.FILL);
        paint.setTextAlign(Paint.Align.LEFT);
        paint.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        paint.setTextSize(dp(12));
        paint.setColor(mutedColor);
        canvas.drawText(getResources().getString(R.string.dashboard_distance), left, top, paint);
        paint.setTextAlign(Paint.Align.RIGHT);
        paint.setTextSize(dp(20));
        paint.setColor(brandColor);
        canvas.drawText(distanceCm < 0 ? "—"
                : getResources().getString(R.string.centimeters_format, distanceCm), right, top, paint);

        float graphTop = top + dp(15);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(1));
        paint.setColor(strokeColor);
        for (int i = 0; i < 3; i++) {
            float y = graphTop + (bottom - graphTop) * i / 2f;
            canvas.drawLine(left, y, right, y, paint);
        }
        if (distanceHistory.size() < 2) return;
        Path path = new Path();
        int index = 0;
        for (float value : distanceHistory) {
            float x = left + (right - left) * index / Math.max(1, distanceHistory.size() - 1);
            float normalized = Math.min(1f, value / 200f);
            float y = bottom - normalized * (bottom - graphTop);
            if (index == 0) path.moveTo(x, y); else path.lineTo(x, y);
            index++;
        }
        paint.setColor(brandColor);
        paint.setStrokeWidth(dp(3));
        canvas.drawPath(path, paint);
    }

    private float dp(float value) {
        return value * density;
    }
}

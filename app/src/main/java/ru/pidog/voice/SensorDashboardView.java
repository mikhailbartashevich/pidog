package ru.pidog.voice;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
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

    public SensorDashboardView(Context context, AttributeSet attrs) {
        super(context, attrs);
        density = getResources().getDisplayMetrics().density;
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
        paint.setColor(Color.WHITE);
        paint.setShadowLayer(dp(8), 0, dp(3), 0x18000000);
        canvas.drawRoundRect(new RectF(left, top, right, bottom), dp(18), dp(18), paint);
        paint.clearShadowLayer();
    }

    private void drawBattery(Canvas canvas, float cx, float cy) {
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(9));
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setColor(0xFFE5E7F0);
        RectF arc = new RectF(cx - dp(38), cy - dp(38), cx + dp(38), cy + dp(38));
        canvas.drawArc(arc, 135, 270, false, paint);
        if (batteryPercent >= 0) {
            paint.setColor(batteryPercent < 25 ? 0xFFE5484D
                    : batteryPercent < 55 ? 0xFFFFA91F : 0xFF17A673);
            canvas.drawArc(arc, 135, 270 * batteryPercent / 100f, false, paint);
        }
        paint.setStyle(Paint.Style.FILL);
        paint.setTextAlign(Paint.Align.CENTER);
        paint.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        paint.setTextSize(dp(22));
        paint.setColor(0xFF181B2E);
        canvas.drawText(batteryPercent < 0 ? "—" : Math.round(batteryPercent) + "%", cx, cy + dp(6), paint);
        paint.setTextSize(dp(11));
        paint.setTypeface(android.graphics.Typeface.DEFAULT);
        paint.setColor(0xFF667085);
        String voltage = batteryVoltage < 0 ? "БАТАРЕЯ" : String.format(Locale.US, "%.2f В · БАТАРЕЯ", batteryVoltage);
        canvas.drawText(voltage, cx, dp(127), paint);
    }

    private void drawSound(Canvas canvas, float cx, float cy) {
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(2));
        paint.setColor(0xFFDFE2EC);
        canvas.drawCircle(cx, cy, dp(39), paint);
        canvas.drawCircle(cx, cy, dp(21), paint);
        canvas.drawLine(cx, cy - dp(44), cx, cy + dp(44), paint);
        canvas.drawLine(cx - dp(44), cy, cx + dp(44), cy, paint);
        if (soundDirection >= 0) {
            double angle = Math.toRadians(soundDirection - 90);
            float ex = cx + (float) Math.cos(angle) * dp(34);
            float ey = cy + (float) Math.sin(angle) * dp(34);
            paint.setColor(0xFF8A4DFF);
            paint.setStrokeWidth(dp(5));
            paint.setStrokeCap(Paint.Cap.ROUND);
            canvas.drawLine(cx, cy, ex, ey, paint);
            canvas.drawCircle(ex, ey, dp(5), paint);
        }
        paint.setStyle(Paint.Style.FILL);
        paint.setTextAlign(Paint.Align.CENTER);
        paint.setTextSize(dp(11));
        paint.setColor(0xFF667085);
        canvas.drawText(soundDirection < 0 ? "ЗВУК НЕ НАЙДЕН" : Math.round(soundDirection) + "° · ЗВУК",
                cx, dp(127), paint);
    }

    private void drawDistanceChart(Canvas canvas, float left, float top, float right, float bottom) {
        paint.setStyle(Paint.Style.FILL);
        paint.setTextAlign(Paint.Align.LEFT);
        paint.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        paint.setTextSize(dp(12));
        paint.setColor(0xFF667085);
        canvas.drawText("УЛЬТРАЗВУК · ИСТОРИЯ", left, top, paint);
        paint.setTextAlign(Paint.Align.RIGHT);
        paint.setTextSize(dp(20));
        paint.setColor(0xFF5B5BD6);
        canvas.drawText(distanceCm < 0 ? "—" : String.format(Locale.US, "%.1f см", distanceCm), right, top, paint);

        float graphTop = top + dp(15);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(1));
        paint.setColor(0xFFE5E7F0);
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
        paint.setColor(0xFF5B5BD6);
        paint.setStrokeWidth(dp(3));
        canvas.drawPath(path, paint);
    }

    private float dp(float value) {
        return value * density;
    }
}

package ru.pidog.voice;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PointF;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.View;

/** A two-axis spring-loaded joystick for directly aiming the PiDog head. */
public final class HeadJoystickView extends View {
    public interface Listener {
        void onPositionChanged(float x, float y);
    }

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final PointF knob = new PointF();
    private Listener listener;
    private float centerX;
    private float centerY;
    private float travelRadius;
    private float knobRadius;
    private float normalizedX;
    private float normalizedY;

    public HeadJoystickView(Context context) {
        this(context, null);
    }

    public HeadJoystickView(Context context, AttributeSet attrs) {
        this(context, attrs, 0);
    }

    public HeadJoystickView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        setFocusable(true);
        setClickable(true);
    }

    public void configure(Listener listener) {
        this.listener = listener;
        reset(false);
    }

    public void resetToCenter() {
        reset(true);
    }

    @Override
    protected void onSizeChanged(int width, int height, int oldWidth, int oldHeight) {
        centerX = width / 2f;
        centerY = height / 2f;
        float radius = Math.min(width, height) / 2f;
        knobRadius = radius * 0.23f;
        travelRadius = radius * 0.58f;
        knob.set(centerX, centerY);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float outerRadius = Math.min(getWidth(), getHeight()) * 0.44f;

        paint.setStyle(Paint.Style.FILL);
        paint.setColor(getContext().getColor(R.color.brand_soft));
        canvas.drawCircle(centerX, centerY, outerRadius, paint);

        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(2));
        paint.setColor(getContext().getColor(R.color.stroke));
        canvas.drawCircle(centerX, centerY, outerRadius, paint);

        paint.setStrokeWidth(dp(2));
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setColor(getContext().getColor(R.color.brand));
        float guide = outerRadius * 0.62f;
        canvas.drawLine(centerX - guide, centerY, centerX + guide, centerY, paint);
        canvas.drawLine(centerX, centerY - guide, centerX, centerY + guide, paint);

        paint.setStyle(Paint.Style.FILL);
        boolean centered = normalizedX == 0 && normalizedY == 0;
        paint.setColor(getContext().getColor(centered ? R.color.brand : R.color.brand_dark));
        canvas.drawCircle(knob.x, knob.y, knobRadius, paint);
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                getParent().requestDisallowInterceptTouchEvent(true);
                updateFromTouch(event.getX(), event.getY());
                return true;
            case MotionEvent.ACTION_MOVE:
                updateFromTouch(event.getX(), event.getY());
                return true;
            case MotionEvent.ACTION_UP:
                performClick();
                reset(true);
                getParent().requestDisallowInterceptTouchEvent(false);
                return true;
            case MotionEvent.ACTION_CANCEL:
                reset(true);
                getParent().requestDisallowInterceptTouchEvent(false);
                return true;
            default:
                return super.onTouchEvent(event);
        }
    }

    @Override
    public boolean performClick() {
        super.performClick();
        return true;
    }

    private void updateFromTouch(float touchX, float touchY) {
        float x = normalizedOffset(touchX - centerX, travelRadius);
        float y = normalizedOffset(touchY - centerY, travelRadius);
        float length = (float) Math.hypot(x, y);
        if (length > 1f) {
            x /= length;
            y /= length;
        }
        if (length < 0.08f) {
            x = 0;
            y = 0;
        }
        if (Math.abs(x - normalizedX) < 0.01f && Math.abs(y - normalizedY) < 0.01f) {
            return;
        }
        normalizedX = x;
        normalizedY = y;
        knob.set(centerX + x * travelRadius, centerY + y * travelRadius);
        notifyListener();
        invalidate();
    }

    static float normalizedOffset(float offset, float maximum) {
        if (maximum <= 0) {
            return 0;
        }
        return Math.max(-1f, Math.min(1f, offset / maximum));
    }

    private void reset(boolean notify) {
        normalizedX = 0;
        normalizedY = 0;
        knob.set(centerX, centerY);
        if (notify) {
            notifyListener();
        }
        invalidate();
    }

    private void notifyListener() {
        if (listener != null) {
            listener.onPositionChanged(normalizedX, normalizedY);
        }
    }

    private float dp(float value) {
        return value * getResources().getDisplayMetrics().density;
    }
}

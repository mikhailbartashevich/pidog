package ru.pidog.voice;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PointF;
import android.util.AttributeSet;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;

import java.util.HashSet;
import java.util.Set;

/** A circular two-axis joystick for walking and turning PiDog. */
public final class JoystickView extends View {
    public interface Listener {
        void onMovementChanged(int driveDirection, int turnDirection);
    }

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final PointF knob = new PointF();
    private final Set<Integer> pressedKeys = new HashSet<>();
    private Listener listener;
    private int driveDirection;
    private int turnDirection;
    private float centerX;
    private float centerY;
    private float travelRadius;
    private float knobRadius;
    private float normalizedX;
    private float normalizedY;

    public JoystickView(Context context) {
        this(context, null);
    }

    public JoystickView(Context context, AttributeSet attrs) {
        this(context, attrs, 0);
    }

    public JoystickView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        setFocusable(true);
        setFocusableInTouchMode(true);
        setClickable(true);
    }

    public void configure(Listener listener) {
        this.listener = listener;
        reset(false);
    }

    public void resetToCenter() {
        reset(false);
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
        boolean centered = driveDirection == 0 && turnDirection == 0;
        paint.setColor(getContext().getColor(centered ? R.color.brand : R.color.brand_dark));
        canvas.drawCircle(knob.x, knob.y, knobRadius, paint);
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                pressedKeys.clear();
                requestFocus();
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

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (!isArrowKey(keyCode)) {
            return super.onKeyDown(keyCode, event);
        }
        pressedKeys.add(keyCode);
        updateFromKeyboard();
        return true;
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (!isArrowKey(keyCode)) {
            return super.onKeyUp(keyCode, event);
        }
        pressedKeys.remove(keyCode);
        updateFromKeyboard();
        return true;
    }

    @Override
    public void onWindowFocusChanged(boolean hasWindowFocus) {
        super.onWindowFocusChanged(hasWindowFocus);
        if (!hasWindowFocus && (driveDirection != 0 || turnDirection != 0)) {
            reset(true);
        }
    }

    private void updateFromTouch(float touchX, float touchY) {
        float x = normalizedOffset(touchX - centerX, travelRadius);
        float y = normalizedOffset(touchY - centerY, travelRadius);
        float length = (float) Math.hypot(x, y);
        if (length > 1f) {
            x /= length;
            y /= length;
        }
        updatePosition(x, y);
    }

    private void updateFromKeyboard() {
        float x = 0;
        float y = 0;
        if (pressedKeys.contains(KeyEvent.KEYCODE_DPAD_LEFT)) x -= 1;
        if (pressedKeys.contains(KeyEvent.KEYCODE_DPAD_RIGHT)) x += 1;
        if (pressedKeys.contains(KeyEvent.KEYCODE_DPAD_UP)) y -= 1;
        if (pressedKeys.contains(KeyEvent.KEYCODE_DPAD_DOWN)) y += 1;
        float length = (float) Math.hypot(x, y);
        if (length > 1f) {
            x /= length;
            y /= length;
        }
        updatePosition(x, y);
    }

    private void updatePosition(float x, float y) {
        normalizedX = x;
        normalizedY = y;
        knob.set(centerX + x * travelRadius, centerY + y * travelRadius);

        int[] movement = movementForPosition(x, y);
        setMovement(movement[0], movement[1]);
        invalidate();
    }

    static int[] movementForPosition(float x, float y) {
        if (Math.max(Math.abs(x), Math.abs(y)) < 0.20f) {
            return new int[]{0, 0};
        }
        if (Math.abs(y) >= Math.abs(x)) {
            return new int[]{directionForOffset(y, 1f), 0};
        }
        return new int[]{0, directionForOffset(x, 1f)};
    }

    static int directionForOffset(float offset, float maximum) {
        if (maximum <= 0 || Math.abs(offset) < maximum * 0.20f) {
            return 0;
        }
        return offset < 0 ? -1 : 1;
    }

    private void reset(boolean notify) {
        pressedKeys.clear();
        normalizedX = 0;
        normalizedY = 0;
        knob.set(centerX, centerY);
        if (notify) {
            setMovement(0, 0);
        } else {
            driveDirection = 0;
            turnDirection = 0;
        }
        invalidate();
    }

    private void setMovement(int nextDrive, int nextTurn) {
        if (driveDirection == nextDrive && turnDirection == nextTurn) {
            return;
        }
        driveDirection = nextDrive;
        turnDirection = nextTurn;
        if (listener != null) {
            listener.onMovementChanged(driveDirection, turnDirection);
        }
    }

    private static boolean isArrowKey(int keyCode) {
        return keyCode == KeyEvent.KEYCODE_DPAD_UP
                || keyCode == KeyEvent.KEYCODE_DPAD_DOWN
                || keyCode == KeyEvent.KEYCODE_DPAD_LEFT
                || keyCode == KeyEvent.KEYCODE_DPAD_RIGHT;
    }

    private static float normalizedOffset(float offset, float maximum) {
        if (maximum <= 0) {
            return 0;
        }
        return Math.max(-1f, Math.min(1f, offset / maximum));
    }

    private float dp(float value) {
        return value * getResources().getDisplayMetrics().density;
    }

}

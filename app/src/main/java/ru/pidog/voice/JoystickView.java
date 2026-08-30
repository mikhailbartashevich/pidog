package ru.pidog.voice;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PointF;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.View;

/**
 * A deliberately small, dependency-free touch joystick. Each instance is locked to one axis:
 * vertical for walking and horizontal for turning. The dead zone prevents accidental commands
 * while the user first puts a finger down.
 */
public final class JoystickView extends View {
    public enum Axis { VERTICAL, HORIZONTAL }

    public interface Listener {
        void onDirectionChanged(int direction);
    }

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final PointF knob = new PointF();
    private Axis axis = Axis.VERTICAL;
    private Listener listener;
    private int direction;
    private float centerX;
    private float centerY;
    private float travelRadius;
    private float knobRadius;

    public JoystickView(Context context) {
        this(context, null);
    }

    public JoystickView(Context context, AttributeSet attrs) {
        this(context, attrs, 0);
    }

    public JoystickView(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
        setFocusable(true);
        setClickable(true);
    }

    public void configure(Axis axis, Listener listener) {
        this.axis = axis;
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
        knobRadius = radius * 0.28f;
        travelRadius = radius * 0.56f;
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

        paint.setStrokeWidth(dp(3));
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setColor(getContext().getColor(R.color.brand));
        float guide = outerRadius * 0.55f;
        if (axis == Axis.VERTICAL) {
            canvas.drawLine(centerX, centerY - guide, centerX, centerY + guide, paint);
        } else {
            canvas.drawLine(centerX - guide, centerY, centerX + guide, centerY, paint);
        }

        paint.setStyle(Paint.Style.FILL);
        paint.setColor(getContext().getColor(direction == 0 ? R.color.brand : R.color.brand_dark));
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
        float offset = axis == Axis.VERTICAL ? touchY - centerY : touchX - centerX;
        float constrained = Math.max(-travelRadius, Math.min(travelRadius, offset));
        if (axis == Axis.VERTICAL) {
            knob.set(centerX, centerY + constrained);
        } else {
            knob.set(centerX + constrained, centerY);
        }
        int newDirection = directionForOffset(constrained, travelRadius);
        setDirection(newDirection);
        invalidate();
    }

    static int directionForOffset(float offset, float maximum) {
        if (maximum <= 0 || Math.abs(offset) < maximum * 0.32f) {
            return 0;
        }
        return offset < 0 ? -1 : 1;
    }

    private void reset(boolean notify) {
        knob.set(centerX, centerY);
        if (notify) {
            setDirection(0);
        } else {
            direction = 0;
        }
        invalidate();
    }

    private void setDirection(int newDirection) {
        if (direction == newDirection) {
            return;
        }
        direction = newDirection;
        if (listener != null) {
            listener.onDirectionChanged(direction);
        }
    }

    private float dp(float value) {
        return value * getResources().getDisplayMetrics().density;
    }
}

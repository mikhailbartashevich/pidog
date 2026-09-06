package ru.pidog.voice;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.util.AttributeSet;
import android.view.MotionEvent;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;

import java.util.Collections;
import java.util.List;

/** A frame-aligned AI image with tappable face and object boxes. */
public final class AiVisionFrameView extends FrameLayout {
    public interface Listener {
        void onFaceSelected(RobotClient.AiVisionFace face);
        void onObjectSelected(RobotClient.AiVisionObject object);
    }

    private final ImageView image;
    private final Paint boxPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint labelPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private List<RobotClient.AiVisionFace> faces = Collections.emptyList();
    private List<RobotClient.AiVisionObject> objects = Collections.emptyList();
    private RobotClient.AiVisionFace selectedFace;
    private RobotClient.AiVisionObject selectedObject;
    private Listener listener;
    private int frameWidth = 4;
    private int frameHeight = 3;
    private float imageLeft;
    private float imageTop;
    private float imageWidth;
    private float imageHeight;

    public AiVisionFrameView(Context context) {
        super(context);
        image = createImage();
    }

    public AiVisionFrameView(Context context, AttributeSet attributes) {
        super(context, attributes);
        image = createImage();
    }

    public AiVisionFrameView(Context context, AttributeSet attributes, int style) {
        super(context, attributes, style);
        image = createImage();
    }

    private ImageView createImage() {
        setWillNotDraw(false);
        setBackgroundColor(Color.rgb(1, 5, 10));
        ImageView image = new ImageView(getContext());
        image.setScaleType(ImageView.ScaleType.FIT_CENTER);
        image.setAdjustViewBounds(false);
        addView(image, new FrameLayout.LayoutParams(
                LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));
        boxPaint.setStyle(Paint.Style.STROKE);
        labelPaint.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        labelPaint.setTextSize(dp(12));
        return image;
    }

    void setFrame(Bitmap bitmap, int width, int height, List<RobotClient.AiVisionFace> faces,
                  List<RobotClient.AiVisionObject> objects) {
        image.setImageBitmap(bitmap);
        frameWidth = width > 0 ? width : 4;
        frameHeight = height > 0 ? height : 3;
        this.faces = faces == null ? Collections.emptyList() : faces;
        this.objects = objects == null ? Collections.emptyList() : objects;
        invalidate();
    }

    void setSelection(RobotClient.AiVisionFace face, RobotClient.AiVisionObject object) {
        selectedFace = face;
        selectedObject = object;
        invalidate();
    }

    void setListener(Listener listener) {
        this.listener = listener;
    }

    @Override
    protected void dispatchDraw(Canvas canvas) {
        super.dispatchDraw(canvas);
        float scale = Math.min(getWidth() / (float) frameWidth, getHeight() / (float) frameHeight);
        imageWidth = frameWidth * scale;
        imageHeight = frameHeight * scale;
        imageLeft = (getWidth() - imageWidth) / 2f;
        imageTop = (getHeight() - imageHeight) / 2f;
        for (RobotClient.AiVisionObject object : objects) {
            drawBox(canvas, object, objectLabel(object), Color.rgb(24, 213, 255),
                    sameBox(object, selectedObject));
        }
        for (RobotClient.AiVisionFace face : faces) {
            drawBox(canvas, face, faceLabel(face), Color.rgb(255, 115, 189),
                    sameBox(face, selectedFace));
        }
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        if (event.getAction() != MotionEvent.ACTION_UP || listener == null) return true;
        float x = (event.getX() - imageLeft) / imageWidth;
        float y = (event.getY() - imageTop) / imageHeight;
        for (RobotClient.AiVisionFace face : faces) {
            if (contains(face, x, y)) {
                listener.onFaceSelected(face);
                return true;
            }
        }
        for (RobotClient.AiVisionObject object : objects) {
            if (contains(object, x, y)) {
                listener.onObjectSelected(object);
                return true;
            }
        }
        return true;
    }

    private void drawBox(Canvas canvas, RobotClient.AiVisionBox box, String label, int color,
                         boolean selected) {
        float left = imageLeft + box.x * imageWidth;
        float top = imageTop + box.y * imageHeight;
        float right = left + box.width * imageWidth;
        float bottom = top + box.height * imageHeight;
        int border = selected ? Color.rgb(255, 190, 85) : color;
        boxPaint.setColor(border);
        boxPaint.setStrokeWidth(dp(selected ? 4 : 3));
        canvas.drawRect(left, top, right, bottom, boxPaint);
        labelPaint.setColor(border);
        float labelWidth = labelPaint.measureText(label) + dp(12);
        float labelTop = Math.max(imageTop, top - dp(23));
        Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        fill.setColor(border);
        canvas.drawRoundRect(new RectF(left, labelTop, Math.min(right, left + labelWidth),
                labelTop + dp(21)), dp(4), dp(4), fill);
        labelPaint.setColor(Color.rgb(3, 10, 18));
        canvas.drawText(label, left + dp(6), labelTop + dp(15), labelPaint);
    }

    private static boolean contains(RobotClient.AiVisionBox box, float x, float y) {
        return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
    }

    private static boolean sameBox(RobotClient.AiVisionBox first, RobotClient.AiVisionBox second) {
        return second != null && Math.abs(first.x - second.x) < .003f
                && Math.abs(first.y - second.y) < .003f
                && Math.abs(first.width - second.width) < .003f
                && Math.abs(first.height - second.height) < .003f;
    }

    private static String faceLabel(RobotClient.AiVisionFace face) {
        if (!face.name.isEmpty()) return face.name;
        return face.names.length > 0 ? String.join(" / ", face.names) : "face";
    }

    private static String objectLabel(RobotClient.AiVisionObject object) {
        return !object.name.isEmpty() ? object.name : object.label;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}

package ru.pidog.voice;

import android.content.Context;
import android.graphics.Typeface;
import android.util.AttributeSet;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Renders the complete command catalog as localized, tappable groups. */
public final class GroupedCommandView extends LinearLayout {
    public interface Listener {
        void onCommandSelected(RobotCommand command);
    }

    public GroupedCommandView(Context context) {
        this(context, null);
    }

    public GroupedCommandView(Context context, AttributeSet attributes) {
        super(context, attributes);
        setOrientation(VERTICAL);
    }

    public void configure(String languageTag, Listener listener) {
        boolean english = languageTag != null && languageTag.startsWith("en");
        removeAllViews();
        for (CommandCatalog.Group group : CommandCatalog.groups()) {
            addGroupTitle(group.title(english));
            for (RobotCommand command : group.commands) {
                addCommandButton(command, languageTag, listener);
            }
        }
    }

    private void addGroupTitle(String label) {
        TextView title = new TextView(getContext());
        title.setText(label);
        title.setTextColor(getContext().getColor(R.color.muted));
        title.setTextSize(12);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        LayoutParams params = new LayoutParams(
                LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(18);
        addView(title, params);
    }

    private void addCommandButton(RobotCommand command, String languageTag,
                                  Listener listener) {
        Button button = new Button(getContext(), null, 0, R.style.CommandButton);
        button.setText(command.displayName(languageTag));
        button.setAllCaps(false);
        button.setOnClickListener(view -> listener.onCommandSelected(command));
        LayoutParams params = new LayoutParams(LayoutParams.MATCH_PARENT, dp(54));
        params.topMargin = dp(6);
        addView(button, params);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}

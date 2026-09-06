package ru.pidog.voice;

import android.content.Context;
import android.graphics.Typeface;
import android.util.AttributeSet;
import android.view.Gravity;
import android.view.View;
import android.view.ViewParent;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Renders the command catalog as a two-level, localized drill-down. */
public final class GroupedCommandView extends LinearLayout {
    public interface Listener {
        void onCommandSelected(RobotCommand command);
    }

    private String languageTag;
    private Listener listener;
    private CommandCatalog.Group selectedGroup;

    public GroupedCommandView(Context context) {
        this(context, null);
    }

    public GroupedCommandView(Context context, AttributeSet attributes) {
        super(context, attributes);
        setOrientation(VERTICAL);
    }

    public void configure(String languageTag, Listener listener) {
        this.languageTag = languageTag;
        this.listener = listener;
        showGroups();
    }

    /** Returns to the catalog root. Returns false when the view is already at the root. */
    public boolean navigateUp() {
        if (selectedGroup == null) {
            return false;
        }
        showGroups();
        return true;
    }

    /** Shows only top-level groups, which is the entry point for the command catalog. */
    public void showGroups() {
        selectedGroup = null;
        removeAllViews();
        for (CommandCatalog.Group group : CommandCatalog.groups()) {
            addGroupButton(group);
        }
        scrollCatalogToTop();
    }

    private void addGroupButton(CommandCatalog.Group group) {
        LinearLayout row = new LinearLayout(getContext());
        row.setOrientation(HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setBackgroundResource(R.drawable.bg_button);
        row.setClickable(true);
        row.setFocusable(true);
        row.setContentDescription(group.title(isEnglish()) + ", "
                + commandCount(group.commands.size()));
        row.setPadding(dp(16), dp(12), dp(14), dp(12));
        row.setOnClickListener(view -> showCommands(group));

        LinearLayout labels = new LinearLayout(getContext());
        labels.setOrientation(VERTICAL);

        TextView title = new TextView(getContext());
        title.setText(group.title(isEnglish()));
        title.setTextColor(getContext().getColor(R.color.ink));
        title.setTextSize(16);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        labels.addView(title, new LayoutParams(
                LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT));

        TextView count = new TextView(getContext());
        count.setText(commandCount(group.commands.size()));
        count.setTextColor(getContext().getColor(R.color.muted));
        count.setTextSize(13);
        LayoutParams countParams = new LayoutParams(
                LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT);
        countParams.topMargin = dp(2);
        labels.addView(count, countParams);

        row.addView(labels, new LayoutParams(0, LayoutParams.WRAP_CONTENT, 1));

        TextView chevron = new TextView(getContext());
        chevron.setText(R.string.command_group_chevron);
        chevron.setTextColor(getContext().getColor(R.color.brand));
        chevron.setTextSize(24);
        chevron.setGravity(Gravity.CENTER);
        row.addView(chevron, new LayoutParams(dp(28), LayoutParams.MATCH_PARENT));

        LayoutParams params = new LayoutParams(LayoutParams.MATCH_PARENT, dp(72));
        params.topMargin = dp(8);
        addView(row, params);
    }

    private void showCommands(CommandCatalog.Group group) {
        selectedGroup = group;
        removeAllViews();

        Button back = new Button(getContext(), null, 0, R.style.TextButton);
        back.setText(R.string.command_groups_back);
        back.setAllCaps(false);
        back.setOnClickListener(view -> showGroups());
        addView(back, new LayoutParams(
                LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT));

        TextView title = new TextView(getContext());
        title.setText(group.title(isEnglish()));
        title.setTextColor(getContext().getColor(R.color.ink));
        title.setTextSize(21);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        LayoutParams titleParams = new LayoutParams(
                LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT);
        titleParams.topMargin = dp(6);
        addView(title, titleParams);

        TextView count = new TextView(getContext());
        count.setText(commandCount(group.commands.size()));
        count.setTextColor(getContext().getColor(R.color.muted));
        count.setTextSize(13);
        LayoutParams countParams = new LayoutParams(
                LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT);
        countParams.topMargin = dp(3);
        countParams.bottomMargin = dp(8);
        addView(count, countParams);

        for (RobotCommand command : group.commands) {
            addCommandButton(command);
        }
        scrollCatalogToTop();
    }

    private void addCommandButton(RobotCommand command) {
        Button button = new Button(getContext(), null, 0,
                command == RobotCommand.STOP ? R.style.StopButton : R.style.CommandButton);
        button.setText(command.displayName(languageTag));
        button.setAllCaps(false);
        button.setOnClickListener(view -> listener.onCommandSelected(command));
        LayoutParams params = new LayoutParams(LayoutParams.MATCH_PARENT, dp(54));
        params.topMargin = dp(6);
        addView(button, params);
    }

    private String commandCount(int count) {
        return getResources().getQuantityString(R.plurals.command_count, count, count);
    }

    private boolean isEnglish() {
        return languageTag != null && languageTag.startsWith("en");
    }

    private void scrollCatalogToTop() {
        post(() -> {
            ViewParent parent = getParent();
            while (parent instanceof View) {
                if (parent instanceof ScrollView) {
                    ((ScrollView) parent).smoothScrollTo(0, 0);
                    return;
                }
                parent = parent.getParent();
            }
        });
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}

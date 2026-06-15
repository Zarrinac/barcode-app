package com.hisense.barcode.nativeapp;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.net.ConnectException;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int DCODE_900 = Color.rgb(12, 18, 30);
    private static final int DCODE_800 = Color.rgb(21, 27, 39);
    private static final int DCODE_700 = Color.rgb(31, 41, 55);
    private static final int DCODE_RED_700 = Color.rgb(199, 15, 32);
    private static final int DCODE_RED_500 = Color.rgb(255, 43, 61);
    private static final int APP_BG = Color.rgb(245, 247, 250);
    private static final int APP_SURFACE = Color.WHITE;
    private static final int APP_SURFACE_SOFT = Color.rgb(248, 250, 252);
    private static final int APP_MUTED = Color.rgb(95, 102, 115);
    private static final int APP_INK = Color.rgb(17, 17, 17);
    private static final int APP_LINE = Color.rgb(229, 231, 235);
    private static final int SUCCESS_BG = Color.rgb(236, 253, 245);
    private static final int SUCCESS_TEXT = Color.rgb(4, 120, 87);
    private static final int ERROR_BG = Color.rgb(254, 242, 242);
    private static final int ERROR_TEXT = Color.rgb(185, 28, 28);
    private static final int SCANNER_TOAST_MS = 4500;
    private static final int SCANNER_SUCCESS_TOAST_MS = 2800;
    private static final long COMMIT_DEBOUNCE_MS = 220;
    private static final long SCANNER_FOCUS_DELAY_MS = 260;
    private static final long SCANNER_TARGET_COMMIT_COOLDOWN_MS = 520;
    private static final String SERVER_CONNECTION_ERROR = "ارتباط با سرور برقرار نشد.";

    private enum Step {
        LOGIN,
        DOCUMENT,
        COLLECT
    }

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final List<ProductModel> models = new ArrayList<>();
    private final List<ScanRow> rows = new ArrayList<>();
    private final Map<String, ProductModel> modelByProductCode = new HashMap<>();
    private final NumberFormat persianNumberFormat = NumberFormat.getInstance(new Locale("fa", "IR"));

    private ApiClient apiClient;
    private Step step = Step.LOGIN;
    private String loginUsername = "";
    private String loginPassword = "";
    private String currentUsername = "";
    private String date = PersianDate.today();
    private String documentNo = "";
    private String customerName = "";
    private String productCode = "";
    private String trackingCode = "";
    private String serialNo = "";
    private String acPart = null;
    private String statusMessage = "نام کاربری و رمز عبور را وارد کنید.";
    private String toastMessage = null;
    private boolean statusIsError = false;
    private boolean toastIsError = false;
    private boolean isLoggingIn = false;
    private boolean isSending = false;
    private boolean isCompleting = false;
    private long lastCommitAtMs = 0L;
    private long blockedTargetCommitUntilMs = 0L;
    private EditText blockedTargetCommitInput;
    private Typeface appTypefaceRegular = Typeface.DEFAULT;
    private Typeface appTypefaceMedium = Typeface.DEFAULT_BOLD;
    private Typeface appTypefaceBold = Typeface.DEFAULT_BOLD;

    private EditText loginUsernameInput;
    private EditText loginPasswordInput;
    private EditText documentInput;
    private EditText customerInput;
    private EditText productInput;
    private EditText trackingInput;
    private EditText serialInput;
    private TextView statusText;
    private TextView toastText;
    private TextView currentModelText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            appTypefaceRegular = getResources().getFont(R.font.iransansx_regular);
            appTypefaceMedium = getResources().getFont(R.font.iransansx_medium);
            appTypefaceBold = getResources().getFont(R.font.iransansx_bold);
        }
        getWindow().getDecorView().setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        getWindow().getDecorView().setTextDirection(View.TEXT_DIRECTION_RTL);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        getWindow().setStatusBarColor(DCODE_900);
        getWindow().setNavigationBarColor(APP_BG);

        apiClient = new ApiClient(BuildConfig.API_BASE_URL);

        if (BuildConfig.FORCE_FRESH_LOGIN_ON_START) {
            apiClient.clearCookies();
            clearScannerDraft();
            goToLogin();
        } else {
            renderLoading();
            loadSession();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        executor.shutdownNow();
    }

    private void renderLoading() {
        FrameLayout root = gradientRoot();
        TextView loading = text("در حال بررسی نشست...", 16, Color.WHITE, Typeface.BOLD);
        FrameLayout.LayoutParams params =
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        Gravity.CENTER);
        root.addView(loading, params);
        setContentView(root);
    }

    private void loadSession() {
        executor.execute(
                () -> {
                    try {
                        JSONObject response = apiClient.get("/api/session");

                        mainHandler.post(
                                () -> {
                                    if (response.optBoolean("authenticated")) {
                                        currentUsername =
                                                response.optJSONObject("user") == null
                                                        ? ""
                                                        : response.optJSONObject("user").optString("username");
                                        date = PersianDate.today();
                                        goToDocument();
                                    } else {
                                        goToLogin();
                                    }
                                });
                    } catch (Exception ignored) {
                        mainHandler.post(this::goToLogin);
                    }
                });
    }

    private void goToLogin() {
        step = Step.LOGIN;
        statusMessage = "نام کاربری و رمز عبور را وارد کنید.";
        statusIsError = false;
        toastMessage = null;
        renderLogin();
    }

    private void goToDocument() {
        step = Step.DOCUMENT;
        statusMessage = "آماده ثبت سند";
        statusIsError = false;
        renderDocument();
    }

    private void goToCollect() {
        step = Step.COLLECT;
        statusMessage = "جمع آوری بارکد";
        statusIsError = false;
        renderCollect();
        loadProductModels();
    }

    private void clearScannerDraft() {
        date = PersianDate.today();
        documentNo = "";
        customerName = "";
        productCode = "";
        trackingCode = "";
        serialNo = "";
        acPart = null;
        rows.clear();
    }

    private void renderLogin() {
        FrameLayout root = gradientRoot();
        LinearLayout content = vertical(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(14), dp(16), dp(14), dp(16));

        LinearLayout card = vertical(Gravity.CENTER_HORIZONTAL);
        card.setPadding(dp(16), dp(22), dp(16), dp(16));
        card.setBackground(rounded(APP_SURFACE, 26));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.dcode_wordmark);
        logo.setAdjustViewBounds(true);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        card.addView(logo, linear(-1, dp(70), 0, 0, 0, dp(18)));

        loginUsernameInput = input("نام کاربری", false, false);
        loginUsernameInput.setText(loginUsername);
        card.addView(loginUsernameInput, linear(-1, dp(58), 0, 0, 0, dp(10)));

        loginPasswordInput = input("رمز عبور", true, false);
        loginPasswordInput.setText(loginPassword);
        card.addView(loginPasswordInput, linear(-1, dp(58), 0, 0, 0, dp(12)));

        LinearLayout buttons = horizontal();
        Button cancelButton = primaryButton("انصراف", APP_INK);
        cancelButton.setOnClickListener(
                view -> {
                    loginUsername = "";
                    loginPassword = "";
                    renderLogin();
                });
        int loginButtonGap = dp(5);
        buttons.addView(cancelButton, linear(0, dp(50), 1, loginButtonGap, 0, loginButtonGap, 0));

        Button loginButton = primaryButton(isLoggingIn ? "در حال ورود..." : "ورود", DCODE_RED_500);
        loginButton.setEnabled(!isLoggingIn);
        loginButton.setOnClickListener(view -> login());
        buttons.addView(loginButton, linear(0, dp(50), 1, loginButtonGap, 0, loginButtonGap, 0));
        card.addView(buttons, linear(-1, -2));

        content.addView(card, linear(-1, -2));

        statusText = pill(statusMessage, statusIsError ? DCODE_RED_700 : DCODE_700, Color.WHITE);
        content.addView(statusText, linear(-2, -2, 0, dp(18), 0, dp(8)));
        content.addView(
                text("نسخه v" + BuildConfig.VERSION_NAME, 12, Color.argb(150, 255, 255, 255), Typeface.BOLD),
                linear(-2, -2));

        FrameLayout.LayoutParams params =
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        Gravity.CENTER);
        params.leftMargin = dp(8);
        params.rightMargin = dp(8);
        root.addView(content, params);
        setContentView(root);
    }

    private void renderDocument() {
        FrameLayout root = gradientRoot();
        LinearLayout content = vertical(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(14), dp(16), dp(14), dp(16));

        LinearLayout card = vertical(Gravity.CENTER_HORIZONTAL);
        card.setPadding(dp(16), dp(20), dp(16), dp(16));
        card.setBackground(rounded(APP_SURFACE, 26));

        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.dcode_wordmark);
        logo.setAdjustViewBounds(true);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        card.addView(logo, linear(-1, dp(50), 0, 0, 0, dp(8)));

        card.addView(text("اطلاعات مشتری", 25, DCODE_900, Typeface.BOLD), linear(-2, -2, 0, 0, 0, dp(12)));

        EditText dateInput = input("تاریخ امروز", false, false);
        dateInput.setText(date);
        dateInput.setEnabled(false);
        dateInput.setTextColor(APP_MUTED);
        card.addView(dateInput, linear(-1, dp(64), 0, 0, 0, dp(10)));

        documentInput = input("شماره سند", false, true);
        documentInput.setText(documentNo);
        card.addView(documentInput, linear(-1, dp(64), 0, 0, 0, dp(10)));

        customerInput = input("نام مشتری", false, false);
        customerInput.setText(customerName);
        card.addView(customerInput, linear(-1, dp(64), 0, 0, 0, dp(12)));

        LinearLayout buttons = horizontal();
        Button startButton = primaryButton("جمع آوری بارکد", DCODE_RED_500);
        startButton.setOnClickListener(view -> startCollection());
        int documentButtonGap = dp(5);
        buttons.addView(startButton, linear(0, dp(50), 1.2f, documentButtonGap, 0, documentButtonGap, 0));

        Button exitButton = primaryButton("خروج", APP_INK);
        exitButton.setOnClickListener(view -> logout());
        buttons.addView(exitButton, linear(0, dp(50), 0.8f, documentButtonGap, 0, documentButtonGap, 0));
        card.addView(buttons, linear(-1, -2));

        content.addView(card, linear(-1, -2));
        content.addView(
                text("نسخه v" + BuildConfig.VERSION_NAME, 12, Color.argb(150, 255, 255, 255), Typeface.BOLD),
                linear(-2, -2, 0, dp(14), 0, 0));

        FrameLayout.LayoutParams params =
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        Gravity.CENTER);
        params.leftMargin = dp(8);
        params.rightMargin = dp(8);
        root.addView(content, params);
        setContentView(root);
        documentInput.post(() -> documentInput.requestFocus());
    }

    private void renderCollect() {
        getWindow().setStatusBarColor(DCODE_900);
        LinearLayout root = vertical(Gravity.NO_GRAVITY);
        root.setBackgroundColor(APP_BG);
        root.setPadding(dp(10), dp(8), dp(10), dp(10));

        root.addView(collectHeader(), linear(-1, dp(58), 0, 0, 0, dp(10)));
        root.addView(documentSummary(), linear(-1, -2, 0, 0, 0, dp(8)));

        productInput = scanInput(false);
        productInput.setText(productCode);
        productInput.setOnClickListener(view -> clearProductForNewModel());
        productInput.addTextChangedListener(afterTextChanged(value -> {
            productCode = normalizeNumberInput(value);
            updateCurrentModelText();
        }));
        wireCommit(productInput, () -> {
            productCode = normalizeNumberInput(productInput.getText().toString());
            productInput.setText(productCode);

            if (productCode.isEmpty()) {
                return;
            }

            serialNo = "";
            serialInput.setText(serialNo);

            if ("panel".equals(acPart)) {
                trackingCode = "panel";
                trackingInput.setText(trackingCode);
                focusAfterScannerCommit(serialInput);
            } else {
                trackingCode = "";
                trackingInput.setText(trackingCode);
                focusAfterScannerCommit(trackingInput);
            }
        });
        root.addView(scanField("شناسه کالا", productInput), linear(-1, dp(82), 0, 0, 0, dp(8)));

        trackingInput = scanInput(false);
        trackingInput.setText(trackingCode);
        trackingInput.setEnabled(!"panel".equals(acPart));
        trackingInput.addTextChangedListener(afterTextChanged(value -> trackingCode = normalizeNumberInput(value)));
        wireCommit(trackingInput, () -> {
            if ("panel".equals(acPart)) {
                trackingCode = "panel";
                trackingInput.setText(trackingCode);
            } else {
                trackingCode = normalizeNumberInput(trackingInput.getText().toString());
                trackingInput.setText(trackingCode);
            }

            if (!trackingCode.isEmpty()) {
                focusAfterScannerCommit(serialInput);
            }
        });
        root.addView(scanField("کد رهگیری", trackingInput), linear(-1, dp(82), 0, 0, 0, dp(8)));

        serialInput = scanInput(true);
        serialInput.setText(serialNo);
        serialInput.addTextChangedListener(afterTextChanged(value -> serialNo = normalizeScan(value)));
        wireCommit(serialInput, this::addRowFromInputs);
        root.addView(scanField("شماره سریال", serialInput), linear(-1, dp(82), 0, 0, 0, dp(9)));

        root.addView(actionButtons(), linear(-1, dp(50), 0, 0, 0, dp(8)));

        toastText = toastBanner();
        if (toastMessage != null) {
            root.addView(toastText, linear(-1, -2, 0, 0, 0, dp(8)));
        }

        root.addView(collectMeta(), linear(-1, dp(92), 0, 0, 0, dp(6)));
        root.addView(rowsList(), linear(-1, 0, 1));

        setContentView(root);
        updateCurrentModelText();
    }

    private LinearLayout collectHeader() {
        LinearLayout header = horizontal();
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(10), dp(6), dp(10), dp(6));
        header.setBackground(rounded(APP_SURFACE, 16));

        TextView spacer = text("", 1, APP_INK, Typeface.NORMAL);
        header.addView(spacer, linear(dp(44), -1));

        LinearLayout titleBlock = vertical(Gravity.CENTER);
        titleBlock.addView(text("اسکن کالا", 24, APP_INK, Typeface.BOLD), linear(-2, -2));
        titleBlock.addView(
                text(
                        "کاربر جاری: "
                                + (currentUsername.isEmpty() ? "-" : currentUsername)
                                + " / نسخه: v"
                                + BuildConfig.VERSION_NAME,
                        11,
                        APP_MUTED,
                        Typeface.BOLD),
                linear(-2, -2));
        header.addView(titleBlock, linear(0, -1, 1));

        ImageButton home = imageButton(R.drawable.ic_home_24, APP_INK, APP_SURFACE_SOFT);
        home.setOnClickListener(
                view -> {
                    syncCollectInputs();
                    goToDocument();
                });
        header.addView(home, linear(dp(58), -1));

        return header;
    }

    private LinearLayout documentSummary() {
        LinearLayout row = horizontal();
        row.addView(summaryCard("مشتری", customerName), linear(0, dp(66), 1.25f, 0, 0, dp(4), 0));
        row.addView(summaryCard("سند", documentNo), linear(0, dp(66), 0.75f, dp(4), 0, 0, 0));
        return row;
    }

    private LinearLayout actionButtons() {
        LinearLayout buttons = horizontal();
        Button send = primaryButton(isSending ? "ارسال..." : "ارسال", DCODE_900);
        setButtonIcon(send, R.drawable.ic_send_24);
        send.setEnabled(!rows.isEmpty() && !isSending && !isCompleting);
        send.setOnClickListener(view -> sendRows());
        int actionButtonGap = dp(5);
        buttons.addView(send, linear(0, -1, 1, actionButtonGap, 0, actionButtonGap, 0));

        Button save = primaryButton("ذخیره", DCODE_RED_500);
        setButtonIcon(save, R.drawable.ic_save_24);
        save.setEnabled(!rows.isEmpty() && !isCompleting);
        save.setOnClickListener(view -> saveRows());
        buttons.addView(save, linear(0, -1, 1, actionButtonGap, 0, actionButtonGap, 0));

        Button clear = primaryButton("پاکسازی", Color.rgb(30, 41, 59));
        setButtonIcon(clear, R.drawable.ic_close_24);
        clear.setEnabled(!rows.isEmpty() && !isCompleting);
        clear.setOnClickListener(view -> clearRows());
        buttons.addView(clear, linear(0, -1, 1, actionButtonGap, 0, actionButtonGap, 0));
        return buttons;
    }

    private LinearLayout collectMeta() {
        LinearLayout box = vertical(Gravity.NO_GRAVITY);

        LinearLayout firstRow = horizontal();
        firstRow.setGravity(Gravity.CENTER_VERTICAL);
        TextView count = text("تعداد: " + persianNumberFormat.format(rows.size()), 16, DCODE_900, Typeface.BOLD);
        firstRow.addView(count, linear(0, -1, 1));

        Button motor = partButton("موتور", "motor".equals(acPart));
        motor.setOnClickListener(view -> selectAcPart("motor"));
        firstRow.addView(motor, linear(dp(86), dp(42), 0, 0, 0, dp(6), 0));

        Button panel = partButton("پنل", "panel".equals(acPart));
        panel.setOnClickListener(view -> selectAcPart("panel"));
        firstRow.addView(panel, linear(dp(86), dp(42)));
        box.addView(firstRow, linear(-1, dp(48)));

        currentModelText = text("", 15, DCODE_900, Typeface.BOLD);
        currentModelText.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        currentModelText.setSingleLine(true);
        box.addView(currentModelText, linear(-1, dp(38)));

        return box;
    }

    private ScrollView rowsList() {
        ScrollView scrollView = new ScrollView(this);
        scrollView.setFillViewport(false);
        scrollView.setBackground(rounded(APP_SURFACE, 16));
        scrollView.setPadding(dp(8), dp(8), dp(8), dp(8));

        LinearLayout list = vertical(Gravity.NO_GRAVITY);

        for (int index = 0; index < rows.size(); index++) {
            ScanRow row = rows.get(index);
            LinearLayout item = horizontal();
            item.setGravity(Gravity.CENTER_VERTICAL);
            item.setPadding(dp(10), dp(8), dp(10), dp(8));
            item.setBackground(rounded(APP_SURFACE_SOFT, 12));

            TextView number = text(String.valueOf(rows.size() - index), 17, DCODE_900, Typeface.BOLD);
            number.setGravity(Gravity.CENTER);
            item.addView(number, linear(dp(38), -1));

            LinearLayout details = vertical(Gravity.START);
            details.addView(text(row.productCode, 18, DCODE_RED_500, Typeface.BOLD), linear(-1, -2));
            details.addView(text(row.trackingCode, 15, DCODE_RED_500, Typeface.NORMAL), linear(-1, -2));
            details.addView(text(row.serialNo, 15, DCODE_RED_500, Typeface.NORMAL), linear(-1, -2));
            item.addView(details, linear(0, -1, 1, dp(8), 0, dp(8), 0));

            ImageButton delete = imageButton(R.drawable.ic_delete_24, DCODE_RED_500, APP_SURFACE);
            delete.setOnClickListener(
                    view -> {
                        rows.remove(row);
                        renderCollect();
                    });
            item.addView(delete, linear(dp(58), dp(48)));

            list.addView(item, linear(-1, dp(86), 0, index == 0 ? 0 : dp(8), 0, 0));
        }

        scrollView.addView(list, linear(-1, -2));
        return scrollView;
    }

    private LinearLayout scanField(String label, EditText input) {
        LinearLayout field = vertical(Gravity.NO_GRAVITY);
        field.setPadding(dp(12), dp(8), dp(12), dp(8));
        field.setBackground(roundedStroke(APP_SURFACE, 16, APP_LINE, 1));

        TextView labelView = text(label, 14, APP_MUTED, Typeface.BOLD);
        labelView.setGravity(Gravity.START);
        field.addView(labelView, linear(-1, dp(24)));

        LinearLayout row = horizontal();
        row.setGravity(Gravity.CENTER_VERTICAL);
        ImageView icon = new ImageView(this);
        icon.setImageResource(R.drawable.ic_qr_code_scanner_24);
        icon.setColorFilter(DCODE_RED_500);
        icon.setPadding(dp(4), dp(4), dp(4), dp(4));
        row.addView(icon, linear(dp(34), -1));
        input.setBackgroundColor(Color.TRANSPARENT);
        row.addView(input, linear(0, -1, 1));
        field.addView(row, linear(-1, 0, 1));

        return field;
    }

    private LinearLayout summaryCard(String label, String value) {
        LinearLayout card = vertical(Gravity.START);
        card.setPadding(dp(12), dp(8), dp(12), dp(8));
        card.setBackground(roundedStroke(APP_SURFACE, 12, Color.argb(30, 12, 18, 30), 1));
        card.addView(text(label, 12, APP_MUTED, Typeface.BOLD), linear(-1, -2));

        TextView valueView = text(value, 15, DCODE_900, Typeface.BOLD);
        valueView.setSingleLine(true);
        card.addView(valueView, linear(-1, -2));
        return card;
    }

    private void login() {
        loginUsername = normalizeScan(loginUsernameInput.getText().toString()).toLowerCase(Locale.US);
        loginPassword = normalizeScan(loginPasswordInput.getText().toString());

        if (loginUsername.isEmpty() || loginPassword.isEmpty()) {
            showStatus("نام کاربری و رمز عبور را وارد کنید.", true);
            return;
        }

        isLoggingIn = true;
        renderLogin();

        executor.execute(
                () -> {
                    try {
                        JSONObject body = new JSONObject();
                        body.put("username", loginUsername);
                        body.put("password", loginPassword);

                        JSONObject response = apiClient.post("/api/login", body);
                        JSONObject user = response.optJSONObject("user");
                        String username = user == null ? loginUsername : user.optString("username", loginUsername);

                        mainHandler.post(
                                () -> {
                                    isLoggingIn = false;
                                    currentUsername = username;
                                    date = PersianDate.today();
                                    goToDocument();
                                });
                    } catch (Exception error) {
                        mainHandler.post(
                                () -> {
                                    isLoggingIn = false;
                                    apiClient.clearCookies();
                                    showStatus(errorMessage(error, "ورود ناموفق بود."), true);
                                    renderLogin();
                                });
                    }
                });
    }

    private void logout() {
        executor.execute(
                () -> {
                    try {
                        apiClient.postIgnoringBody("/api/logout");
                    } catch (Exception ignored) {
                    }

                    mainHandler.post(
                            () -> {
                                apiClient.clearCookies();
                                currentUsername = "";
                                clearScannerDraft();
                                goToLogin();
                            });
                });
    }

    private void startCollection() {
        documentNo = normalizeNumberInput(documentInput.getText().toString());
        customerName = normalizeScan(customerInput.getText().toString());

        if (documentNo.isEmpty() || customerName.isEmpty()) {
            showStatus("شماره سند و نام مشتری را وارد کنید.", true);
            return;
        }

        goToCollect();
    }

    private void loadProductModels() {
        executor.execute(
                () -> {
                    try {
                        JSONObject response = apiClient.get("/api/product-models");
                        JSONArray modelArray = response.optJSONArray("models");
                        List<ProductModel> loaded = new ArrayList<>();

                        if (modelArray != null) {
                            for (int index = 0; index < modelArray.length(); index++) {
                                loaded.add(ProductModel.fromJson(modelArray.getJSONObject(index)));
                            }
                        }

                        mainHandler.post(
                                () -> {
                                    models.clear();
                                    models.addAll(loaded);
                                    modelByProductCode.clear();

                                    for (ProductModel model : models) {
                                        modelByProductCode.put(model.productCode, model);
                                    }

                                    updateCurrentModelText();
                                });
                    } catch (Exception error) {
                        mainHandler.post(() -> showToast("لیست مدل کالا دریافت نشد.", true));
                    }
                });
    }

    private void clearProductForNewModel() {
        syncCollectInputs();

        if (productCode.isEmpty()) {
            return;
        }

        productCode = "";
        trackingCode = "panel".equals(acPart) ? "panel" : "";
        serialNo = "";
        renderCollect();
        productInput.post(() -> productInput.requestFocus());
    }

    private void selectAcPart(String part) {
        syncCollectInputs();
        acPart = part.equals(acPart) ? null : part;

        if ("panel".equals(acPart)) {
            trackingCode = "panel";
        } else if ("panel".equals(trackingCode)) {
            trackingCode = "";
        }

        renderCollect();
        View focusTarget = "panel".equals(acPart) ? serialInput : trackingInput;
        focusTarget.post(focusTarget::requestFocus);
    }

    private void addRowFromInputs() {
        syncCollectInputs();
        String cleanProductCode = normalizeNumberInput(productCode);
        String cleanTrackingCode =
                "panel".equals(acPart) ? "panel" : normalizeNumberInput(trackingCode);
        String cleanSerialNo = normalizeScan(serialNo);

        if (cleanProductCode.isEmpty() || cleanTrackingCode.isEmpty() || cleanSerialNo.isEmpty()) {
            return;
        }

        for (ScanRow row : rows) {
            if (row.serialNo.equals(cleanSerialNo)) {
                showToast("شماره سریال " + cleanSerialNo + " در همین سند تکراری است.", true);
                serialNo = "";
                renderCollect();
                focusAfterScannerCommit(serialInput);
                return;
            }

            if (isRealTrackingCode(cleanTrackingCode) && row.trackingCode.equals(cleanTrackingCode)) {
                showToast("کد رهگیری " + cleanTrackingCode + " در همین سند تکراری است.", true);
                trackingCode = "";
                serialNo = "";
                renderCollect();
                focusAfterScannerCommit(trackingInput);
                return;
            }
        }

        ProductModel model = modelByProductCode.get(cleanProductCode);
        rows.add(
                0,
                new ScanRow(
                        System.currentTimeMillis() + "-" + cleanSerialNo,
                        date,
                        documentNo,
                        customerName,
                        cleanProductCode,
                        model == null ? "" : model.model,
                        acPart,
                        cleanTrackingCode,
                        cleanSerialNo));

        productCode = cleanProductCode;
        trackingCode = "panel".equals(acPart) ? "panel" : "";
        serialNo = "";
        renderCollect();
        EditText focusTarget = "panel".equals(acPart) ? serialInput : trackingInput;
        focusAfterScannerCommit(focusTarget);
    }

    private void sendRows() {
        syncCollectInputs();

        if (rows.isEmpty() || isSending || isCompleting) {
            return;
        }

        String duplicateMessage = getDuplicateRowsMessage();

        if (duplicateMessage != null) {
            showToast(duplicateMessage, true);
            return;
        }

        isSending = true;
        renderCollect();

        executor.execute(
                () -> {
                    try {
                        JSONObject duplicateBody = new JSONObject();
                        JSONArray serialNos = new JSONArray();
                        JSONArray trackingCodes = new JSONArray();

                        for (ScanRow row : rows) {
                            serialNos.put(row.serialNo);

                            if (isRealTrackingCode(row.trackingCode)) {
                                trackingCodes.put(row.trackingCode);
                            }
                        }

                        duplicateBody.put("serialNos", serialNos);
                        duplicateBody.put("trackingCodes", trackingCodes);

                        JSONObject duplicates =
                                apiClient.post("/api/serial-records/duplicates", duplicateBody);
                        JSONArray duplicateSerials = duplicates.optJSONArray("serialNos");
                        JSONArray duplicateTrackings = duplicates.optJSONArray("trackingCodes");

                        if (duplicateSerials != null && duplicateSerials.length() > 0) {
                            String serial = duplicateSerials.optString(0);
                            mainHandler.post(
                                    () -> {
                                        isSending = false;
                                        showToast("شماره سریال " + serial + " قبلا در دیتابیس ثبت شده است.", true);
                                        renderCollect();
                                    });
                            return;
                        }

                        if (duplicateTrackings != null && duplicateTrackings.length() > 0) {
                            String tracking = duplicateTrackings.optString(0);
                            mainHandler.post(
                                    () -> {
                                        isSending = false;
                                        showToast("کد رهگیری " + tracking + " قبلا در دیتابیس ثبت شده است.", true);
                                        renderCollect();
                                    });
                            return;
                        }

                        for (int index = rows.size() - 1; index >= 0; index--) {
                            ScanRow row = rows.get(index);
                            JSONObject body = new JSONObject();
                            body.put("customerName", row.customerName);
                            body.put("date", row.date);
                            body.put("documentNo", row.documentNo);
                            body.put("model", row.model);
                            body.put("movement", "ورود");
                            body.put("productCode", row.productCode);
                            body.put("serialNo", row.serialNo);
                            body.put("trackingCode", row.trackingCode);
                            apiClient.post("/api/serial-records", body);
                        }

                        int sentCount = rows.size();
                        mainHandler.post(
                                () -> finishSuccessfulBatch(
                                        persianNumberFormat.format(sentCount)
                                                + " ردیف با موفقیت ارسال شد."));
                    } catch (Exception error) {
                        mainHandler.post(
                                () -> {
                                    isSending = false;
                                    showToast(errorMessage(error, "ارسال اطلاعات ناموفق بود."), true);
                                    renderCollect();
                                });
                    }
                });
    }

    private void finishSuccessfulBatch(String message) {
        isSending = false;
        isCompleting = true;
        showToast(message, false);
        renderCollect();

        mainHandler.postDelayed(
                () -> {
                    rows.clear();
                    productCode = "";
                    trackingCode = "";
                    serialNo = "";
                    acPart = null;
                    documentNo = "";
                    customerName = "";
                    date = PersianDate.today();
                    isCompleting = false;
                    goToDocument();
                },
                SCANNER_SUCCESS_TOAST_MS);
    }

    private void saveRows() {
        syncCollectInputs();

        if (rows.isEmpty()) {
            return;
        }

        List<ScanRow> exportRows = new ArrayList<>(rows);
        Collections.reverse(exportRows);
        String filename = documentNo.isEmpty() ? "scanner-records" : documentNo;

        executor.execute(
                () -> {
                    try {
                        ExcelExporter.SaveResult result =
                                ExcelExporter.saveSerialExcelFile(this, exportRows, filename);
                        mainHandler.post(
                                () -> {
                                    showToast(
                                            persianNumberFormat.format(rows.size())
                                                    + " ردیف در فایل اکسل ذخیره شد در "
                                                    + result.path,
                                            false);
                                    renderCollect();
                                });
                    } catch (Exception ignored) {
                        mainHandler.post(() -> showToast("ذخیره فایل اکسل ناموفق بود.", true));
                    }
                });
    }

    private void clearRows() {
        rows.clear();
        trackingCode = "panel".equals(acPart) ? "panel" : "";
        serialNo = "";
        showToast("لیست پاک شد.", false);
        renderCollect();
        View focusTarget = "panel".equals(acPart) ? serialInput : trackingInput;
        focusTarget.post(focusTarget::requestFocus);
    }

    private String getDuplicateRowsMessage() {
        Set<String> serialNos = new HashSet<>();
        Set<String> trackingCodes = new HashSet<>();

        for (ScanRow row : rows) {
            if (serialNos.contains(row.serialNo)) {
                return "شماره سریال " + row.serialNo + " در همین سند تکراری است.";
            }

            serialNos.add(row.serialNo);

            if (!isRealTrackingCode(row.trackingCode)) {
                continue;
            }

            if (trackingCodes.contains(row.trackingCode)) {
                return "کد رهگیری " + row.trackingCode + " در همین سند تکراری است.";
            }

            trackingCodes.add(row.trackingCode);
        }

        return null;
    }

    private void syncCollectInputs() {
        if (productInput != null) {
            productCode = normalizeNumberInput(productInput.getText().toString());
        }

        if (trackingInput != null) {
            trackingCode =
                    "panel".equals(acPart)
                            ? "panel"
                            : normalizeNumberInput(trackingInput.getText().toString());
        }

        if (serialInput != null) {
            serialNo = normalizeScan(serialInput.getText().toString());
        }
    }

    private void updateCurrentModelText() {
        if (currentModelText == null) {
            return;
        }

        ProductModel model = modelByProductCode.get(normalizeNumberInput(productCode));
        currentModelText.setText(model == null ? "مدل نامشخص" : model.model);
    }

    private void showStatus(String message, boolean isError) {
        statusMessage = message;
        statusIsError = isError;

        if (statusText != null) {
            statusText.setText(message);
            statusText.setBackground(rounded(isError ? DCODE_RED_700 : DCODE_700, 999));
        }
    }

    private void showToast(String message, boolean isError) {
        toastMessage = message;
        toastIsError = isError;
        statusMessage = message;
        statusIsError = isError;

        if (toastText != null) {
            toastText.setText(message);
            toastText.setTextColor(isError ? ERROR_TEXT : SUCCESS_TEXT);
            toastText.setBackground(roundedStroke(isError ? ERROR_BG : SUCCESS_BG, 12, Color.argb(55, 0, 0, 0), 1));
        }

        mainHandler.postDelayed(
                () -> {
                    if (message.equals(toastMessage)) {
                        toastMessage = null;

                        if (step == Step.COLLECT) {
                            renderCollect();
                        }
                    }
                },
                SCANNER_TOAST_MS);
    }

    private TextWatcher afterTextChanged(ValueChanged changed) {
        return new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence value, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence value, int start, int before, int count) {}

            @Override
            public void afterTextChanged(Editable value) {
                changed.onChange(value.toString());
            }
        };
    }

    private void wireCommit(EditText editText, CommitAction action) {
        editText.setOnEditorActionListener(
                (view, actionId, event) -> {
                    boolean handled =
                            actionId == EditorInfo.IME_ACTION_NEXT
                                    || actionId == EditorInfo.IME_ACTION_DONE
                                    || isCommitKey(event);

                    if (handled) {
                        runCommitAction(editText, action);
                        return true;
                    }

                    return false;
                });
        editText.setOnKeyListener(
                (view, keyCode, event) -> {
                    if (event.getAction() == KeyEvent.ACTION_DOWN
                            && (keyCode == KeyEvent.KEYCODE_ENTER
                                    || keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER
                                    || keyCode == KeyEvent.KEYCODE_TAB)) {
                        runCommitAction(editText, action);
                        return true;
                    }

                    return false;
                });
    }

    private void runCommitAction(EditText source, CommitAction action) {
        long now = System.currentTimeMillis();

        if (now - lastCommitAtMs < COMMIT_DEBOUNCE_MS) {
            return;
        }

        if (source == blockedTargetCommitInput && now < blockedTargetCommitUntilMs) {
            return;
        }

        lastCommitAtMs = now;
        action.run();
    }

    private void focusAfterScannerCommit(EditText target) {
        blockedTargetCommitInput = target;
        blockedTargetCommitUntilMs = System.currentTimeMillis() + SCANNER_TARGET_COMMIT_COOLDOWN_MS;

        target.postDelayed(
                () -> {
                    if (!target.isEnabled()) {
                        return;
                    }

                    target.requestFocus();
                    target.setSelection(target.getText().length());
                },
                SCANNER_FOCUS_DELAY_MS);
    }

    private boolean isCommitKey(KeyEvent event) {
        return event != null
                && event.getAction() == KeyEvent.ACTION_DOWN
                && (event.getKeyCode() == KeyEvent.KEYCODE_ENTER
                        || event.getKeyCode() == KeyEvent.KEYCODE_NUMPAD_ENTER
                        || event.getKeyCode() == KeyEvent.KEYCODE_TAB);
    }

    private static boolean isRealTrackingCode(String value) {
        return value != null && !"panel".equals(value.trim().toLowerCase(Locale.US));
    }

    private static String normalizeScan(String value) {
        return value == null ? "" : value.replace("\r", "").replace("\n", "").replace("\t", "").trim();
    }

    private static String normalizeNumberInput(String value) {
        String clean = normalizeScan(value);
        StringBuilder normalized = new StringBuilder(clean.length());
        String persianDigits = "۰۱۲۳۴۵۶۷۸۹";
        String arabicDigits = "٠١٢٣٤٥٦٧٨٩";

        for (int index = 0; index < clean.length(); index++) {
            char current = clean.charAt(index);
            int persianIndex = persianDigits.indexOf(current);
            int arabicIndex = arabicDigits.indexOf(current);

            if (persianIndex >= 0) {
                normalized.append(persianIndex);
            } else if (arabicIndex >= 0) {
                normalized.append(arabicIndex);
            } else if (current >= '0' && current <= '9') {
                normalized.append(current);
            }
        }

        return normalized.toString();
    }

    private static String errorMessage(Exception error, String fallback) {
        if (isConnectionError(error)) {
            return SERVER_CONNECTION_ERROR;
        }

        String message = error.getMessage();
        return message == null || message.trim().isEmpty() ? fallback : message;
    }

    private static boolean isConnectionError(Throwable error) {
        Throwable current = error;

        while (current != null) {
            if (current instanceof UnknownHostException
                    || current instanceof ConnectException
                    || current instanceof NoRouteToHostException
                    || current instanceof SocketTimeoutException) {
                return true;
            }

            String message = current.getMessage();

            if (message != null) {
                String normalized = message.toLowerCase(Locale.US);

                if (normalized.contains("unable to resolve host")
                        || normalized.contains("failed to connect")
                        || normalized.contains("timed out")) {
                    return true;
                }
            }

            current = current.getCause();
        }

        return false;
    }

    private FrameLayout gradientRoot() {
        FrameLayout root = new FrameLayout(this);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        root.setTextDirection(View.TEXT_DIRECTION_RTL);
        root.setBackground(
                new GradientDrawable(
                        GradientDrawable.Orientation.TOP_BOTTOM, new int[] {DCODE_900, DCODE_800}));
        return root;
    }

    private LinearLayout vertical(int gravity) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(gravity);
        layout.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        layout.setTextDirection(View.TEXT_DIRECTION_RTL);
        return layout;
    }

    private LinearLayout horizontal() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setGravity(Gravity.CENTER);
        layout.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        layout.setTextDirection(View.TEXT_DIRECTION_RTL);
        return layout;
    }

    private TextView text(String value, float sp, int color, int typeface) {
        TextView textView = new TextView(this);
        textView.setText(value);
        textView.setTextSize(sp);
        textView.setTextColor(color);
        textView.setTypeface(resolveTypeface(typeface));
        textView.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        textView.setIncludeFontPadding(true);
        textView.setTextDirection(View.TEXT_DIRECTION_RTL);
        return textView;
    }

    private TextView pill(String value, int background, int foreground) {
        TextView view = text(value, 14, foreground, Typeface.BOLD);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(18), dp(9), dp(18), dp(9));
        view.setBackground(rounded(background, 999));
        return view;
    }

    private TextView toastBanner() {
        TextView view = text(toastMessage == null ? "" : toastMessage, 14, toastIsError ? ERROR_TEXT : SUCCESS_TEXT, Typeface.BOLD);
        view.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        view.setPadding(dp(12), dp(8), dp(12), dp(8));
        view.setMinHeight(dp(48));
        view.setBackground(roundedStroke(toastIsError ? ERROR_BG : SUCCESS_BG, 12, Color.argb(55, 0, 0, 0), 1));
        return view;
    }

    private EditText input(String hint, boolean password, boolean numeric) {
        EditText editText = new EditText(this);
        editText.setHint(hint);
        editText.setSingleLine(true);
        editText.setTextSize(19);
        editText.setTextColor(DCODE_900);
        editText.setHintTextColor(APP_MUTED);
        editText.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);
        editText.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        editText.setPadding(dp(14), 0, dp(14), 0);
        editText.setBackground(roundedStroke(APP_SURFACE_SOFT, 16, Color.argb(30, 12, 18, 30), 1));

        if (password) {
            editText.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        } else if (numeric) {
            editText.setInputType(InputType.TYPE_CLASS_NUMBER);
        } else {
            editText.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        }

        editText.setTypeface(appTypefaceBold);
        editText.setTextDirection(View.TEXT_DIRECTION_RTL);
        editText.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
        return editText;
    }

    private EditText scanInput(boolean freeText) {
        EditText editText = new EditText(this);
        editText.setSingleLine(true);
        editText.setTextSize(20);
        editText.setTypeface(appTypefaceBold);
        editText.setTextColor(DCODE_900);
        editText.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        editText.setTextDirection(View.TEXT_DIRECTION_RTL);
        editText.setPadding(0, 0, 0, 0);
        editText.setImeOptions(freeText ? EditorInfo.IME_ACTION_DONE : EditorInfo.IME_ACTION_NEXT);
        editText.setInputType(
                freeText
                        ? InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
                        : InputType.TYPE_CLASS_NUMBER);
        return editText;
    }

    private Button primaryButton(String label, int color) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(15);
        button.setTypeface(appTypefaceBold);
        button.setTextColor(Color.WHITE);
        button.setGravity(Gravity.CENTER);
        button.setPadding(dp(8), 0, dp(8), 0);
        button.setBackground(rounded(color, 12));
        button.setMinHeight(dp(44));
        return button;
    }

    private ImageButton imageButton(int iconRes, int iconColor, int backgroundColor) {
        ImageButton button = new ImageButton(this);
        button.setImageResource(iconRes);
        button.setColorFilter(iconColor);
        button.setBackground(rounded(backgroundColor, 10));
        button.setPadding(dp(12), dp(12), dp(12), dp(12));
        button.setScaleType(ImageView.ScaleType.CENTER);
        return button;
    }

    private void setButtonIcon(Button button, int iconRes) {
        Drawable icon = getDrawable(iconRes);
        if (icon == null) {
            return;
        }
        icon.setBounds(0, 0, dp(20), dp(20));
        button.setCompoundDrawablePadding(dp(6));
        button.setCompoundDrawablesRelative(icon, null, null, null);
    }

    private Typeface resolveTypeface(int typeface) {
        if (typeface == Typeface.BOLD) {
            return appTypefaceBold;
        }
        if (typeface == Typeface.NORMAL) {
            return appTypefaceRegular;
        }
        return appTypefaceMedium;
    }

    private Button partButton(String label, boolean selected) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(14);
        button.setTypeface(appTypefaceBold);
        button.setTextColor(selected ? Color.WHITE : DCODE_900);
        button.setGravity(Gravity.CENTER);
        button.setBackground(
                roundedStroke(selected ? DCODE_RED_500 : APP_SURFACE, 999, selected ? DCODE_RED_500 : APP_LINE, 1));
        return button;
    }

    private GradientDrawable rounded(int color, float radiusDp) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radiusDp));
        return drawable;
    }

    private GradientDrawable roundedStroke(int color, float radiusDp, int strokeColor, int strokeDp) {
        GradientDrawable drawable = rounded(color, radiusDp);
        drawable.setStroke(dp(strokeDp), strokeColor);
        return drawable;
    }

    private LinearLayout.LayoutParams linear(int width, int height) {
        return linear(width, height, 0, 0, 0, 0, 0);
    }

    private LinearLayout.LayoutParams linear(int width, int height, float weight) {
        return linear(width, height, weight, 0, 0, 0, 0);
    }

    private LinearLayout.LayoutParams linear(
            int width, int height, int left, int top, int right, int bottom) {
        return linear(width, height, 0, left, top, right, bottom);
    }

    private LinearLayout.LayoutParams linear(
            int width, int height, float weight, int left, int top, int right, int bottom) {
        int resolvedWidth = width == -1 ? LinearLayout.LayoutParams.MATCH_PARENT : width;
        int resolvedHeight = height == -1 ? LinearLayout.LayoutParams.MATCH_PARENT : height;
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(resolvedWidth, resolvedHeight, weight);
        params.setMargins(left, top, right, bottom);
        return params;
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private interface ValueChanged {
        void onChange(String value);
    }

    private interface CommitAction {
        void run();
    }
}

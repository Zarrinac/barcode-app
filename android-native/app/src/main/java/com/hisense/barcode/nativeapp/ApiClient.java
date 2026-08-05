package com.hisense.barcode.nativeapp;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

final class ApiClient {
    private final String baseUrl;
    private final Map<String, String> cookies = new LinkedHashMap<>();

    ApiClient(String baseUrl) {
        this.baseUrl = normalizeBaseUrl(baseUrl);
    }

    void clearCookies() {
        cookies.clear();
    }

    JSONObject get(String path) throws IOException, JSONException, ApiException {
        return request("GET", path, null, true);
    }

    JSONObject post(String path, JSONObject body) throws IOException, JSONException, ApiException {
        return request("POST", path, body, true);
    }

    void postIgnoringBody(String path) throws IOException {
        HttpURLConnection connection = null;

        try {
            connection = openConnection(path);
            connection.setRequestMethod("POST");
            connection.setInstanceFollowRedirects(false);
            int code = connection.getResponseCode();
            storeCookies(connection.getHeaderFields().get("Set-Cookie"));

            if (code >= 400) {
                throw new IOException("Request failed with " + code);
            }
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private JSONObject request(String method, String path, JSONObject body, boolean expectJson)
            throws IOException, JSONException, ApiException {
        HttpURLConnection connection = null;

        try {
            connection = openConnection(path);
            connection.setRequestMethod(method);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");

            if (body != null) {
                byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
                connection.setDoOutput(true);
                connection.setFixedLengthStreamingMode(payload.length);

                try (OutputStream output = connection.getOutputStream()) {
                    output.write(payload);
                }
            }

            int code = connection.getResponseCode();
            storeCookies(connection.getHeaderFields().get("Set-Cookie"));
            String response =
                    readFully(code >= 400 ? connection.getErrorStream() : connection.getInputStream());

            if (code < 200 || code >= 300) {
                String message = "Request failed with " + code;

                if (!response.isEmpty()) {
                    try {
                        JSONObject error = new JSONObject(response);
                        message = error.optString("error", message);
                    } catch (JSONException ignored) {
                        message = response;
                    }
                }

                throw new ApiException(code, message);
            }

            if (!expectJson || response.isEmpty()) {
                return new JSONObject();
            }

            return new JSONObject(response);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private HttpURLConnection openConnection(String path) throws IOException {
        URL url = new URL(baseUrl + (path.startsWith("/") ? path : "/" + path));
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(20000);
        String cookieHeader = cookieHeader();

        if (!cookieHeader.isEmpty()) {
            connection.setRequestProperty("Cookie", cookieHeader);
        }

        return connection;
    }

    private void storeCookies(List<String> setCookieHeaders) {
        if (setCookieHeaders == null) {
            return;
        }

        for (String header : setCookieHeaders) {
            if (header == null || header.trim().isEmpty()) {
                continue;
            }

            String[] parts = header.split(";", -1);
            String[] nameValue = parts[0].split("=", 2);

            if (nameValue.length != 2 || nameValue[0].trim().isEmpty()) {
                continue;
            }

            String name = nameValue[0].trim();
            String value = nameValue[1].trim();
            boolean expired = header.toLowerCase(Locale.US).contains("max-age=0");

            if (expired || value.isEmpty()) {
                cookies.remove(name);
            } else {
                cookies.put(name, value);
            }
        }
    }

    private String cookieHeader() {
        StringBuilder header = new StringBuilder();

        for (Map.Entry<String, String> cookie : cookies.entrySet()) {
            if (header.length() > 0) {
                header.append("; ");
            }

            header.append(cookie.getKey()).append('=').append(cookie.getValue());
        }

        return header.toString();
    }

    private static String normalizeBaseUrl(String value) {
        String normalized = value == null ? "" : value.trim();

        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }

        return normalized;
    }

    private static String readFully(InputStream input) throws IOException {
        if (input == null) {
            return "";
        }

        try (InputStream stream = input;
                ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;

            while ((read = stream.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }

            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    static final class ApiException extends Exception {
        final int code;

        ApiException(int code, String message) {
            super(message);
            this.code = code;
        }
    }
}

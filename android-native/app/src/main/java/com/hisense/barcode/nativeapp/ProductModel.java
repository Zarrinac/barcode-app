package com.hisense.barcode.nativeapp;

import org.json.JSONException;
import org.json.JSONObject;

final class ProductModel {
    final String id;
    final String model;
    final String productCode;
    final String warrantyCode;
    final String createdAt;
    final String updatedAt;
    final String status;

    private ProductModel(
            String id,
            String model,
            String productCode,
            String warrantyCode,
            String createdAt,
            String updatedAt,
            String status) {
        this.id = id;
        this.model = model;
        this.productCode = productCode;
        this.warrantyCode = warrantyCode;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.status = status;
    }

    static ProductModel fromJson(JSONObject object) {
        return new ProductModel(
                object.optString("id"),
                object.optString("model"),
                object.optString("productCode"),
                object.optString("warrantyCode"),
                object.optString("createdAt"),
                object.optString("updatedAt"),
                object.optString("status"));
    }

    /** Mirrors {@link #fromJson} so the list survives in the on-device cache. */
    JSONObject toJson() throws JSONException {
        JSONObject object = new JSONObject();

        object.put("id", id);
        object.put("model", model);
        object.put("productCode", productCode);
        object.put("warrantyCode", warrantyCode);
        object.put("createdAt", createdAt);
        object.put("updatedAt", updatedAt);
        object.put("status", status);

        return object;
    }
}

package com.hisense.barcode.nativeapp;

final class ScanRow {
    final String id;
    final String date;
    final String documentNo;
    final String customerName;
    final String productCode;
    final String model;
    final String partType;
    final String trackingCode;
    final String serialNo;

    ScanRow(
            String id,
            String date,
            String documentNo,
            String customerName,
            String productCode,
            String model,
            String partType,
            String trackingCode,
            String serialNo) {
        this.id = id;
        this.date = date;
        this.documentNo = documentNo;
        this.customerName = customerName;
        this.productCode = productCode;
        this.model = model;
        this.partType = partType;
        this.trackingCode = trackingCode;
        this.serialNo = serialNo;
    }
}

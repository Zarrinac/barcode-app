package com.hisense.barcode.nativeapp;

import java.util.Calendar;
import java.util.Locale;

final class PersianDate {
    private PersianDate() {}

    static String today() {
        Calendar calendar = Calendar.getInstance();
        int[] parts =
                gregorianToJalali(
                        calendar.get(Calendar.YEAR),
                        calendar.get(Calendar.MONTH) + 1,
                        calendar.get(Calendar.DAY_OF_MONTH));

        return String.format(Locale.US, "%04d/%02d/%02d", parts[0], parts[1], parts[2]);
    }

    private static int[] gregorianToJalali(int gy, int gm, int gd) {
        int[] gDayMonth = {0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334};
        int jy;

        if (gy > 1600) {
            jy = 979;
            gy -= 1600;
        } else {
            jy = 0;
            gy -= 621;
        }

        int gy2 = gm > 2 ? gy + 1 : gy;
        int days =
                365 * gy
                        + ((gy2 + 3) / 4)
                        - ((gy2 + 99) / 100)
                        + ((gy2 + 399) / 400)
                        - 80
                        + gd
                        + gDayMonth[gm - 1];

        jy += 33 * (days / 12053);
        days %= 12053;
        jy += 4 * (days / 1461);
        days %= 1461;

        if (days > 365) {
            jy += (days - 1) / 365;
            days = (days - 1) % 365;
        }

        int jm = days < 186 ? 1 + (days / 31) : 7 + ((days - 186) / 30);
        int jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);

        return new int[] {jy, jm, jd};
    }
}

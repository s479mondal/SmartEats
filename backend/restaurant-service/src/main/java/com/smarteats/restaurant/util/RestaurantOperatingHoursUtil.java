package com.smarteats.restaurant.util;

import lombok.extern.slf4j.Slf4j;

import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.List;
import java.util.Locale;

/**
 * Reusable utility for calculating dynamic restaurant operating-hour status.
 * All time comparisons are strictly evaluated in the Asia/Kolkata (IST) timezone.
 */
@Slf4j
public final class RestaurantOperatingHoursUtil {

    public static final ZoneId ZONE_ASIA_KOLKATA = ZoneId.of("Asia/Kolkata");

    private static final List<DateTimeFormatter> FORMATTERS = List.of(
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("h:mm a").toFormatter(Locale.ENGLISH),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("hh:mm a").toFormatter(Locale.ENGLISH),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("h:mma").toFormatter(Locale.ENGLISH),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("hh:mma").toFormatter(Locale.ENGLISH),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("h a").toFormatter(Locale.ENGLISH),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("ha").toFormatter(Locale.ENGLISH),
            DateTimeFormatter.ofPattern("H:mm"),
            DateTimeFormatter.ofPattern("HH:mm"),
            DateTimeFormatter.ofPattern("H:mm:ss"),
            DateTimeFormatter.ofPattern("HH:mm:ss")
    );

    private RestaurantOperatingHoursUtil() {
        // Utility class
    }

    /**
     * Parses a string representation of time into a java.time.LocalTime.
     * Supports various 12-hour (e.g. "10:00 AM", "2:00 AM") and 24-hour (e.g. "10:00", "22:00") formats.
     * Returns null safely if the string is null, empty, or unparseable.
     *
     * @param timeStr Time string from database/request
     * @return Parsed LocalTime or null
     */
    public static LocalTime parseTime(String timeStr) {
        if (timeStr == null || timeStr.trim().isEmpty()) {
            return null;
        }

        String cleaned = timeStr.trim().replaceAll("\\s+", " ");

        for (DateTimeFormatter formatter : FORMATTERS) {
            try {
                return LocalTime.parse(cleaned, formatter);
            } catch (Exception ignored) {
                // Try next formatter
            }
        }

        log.warn("Could not parse restaurant operating hour time string: '{}'", timeStr);
        return null;
    }

    /**
     * Determines whether the given currentTime is strictly within the operating hours window.
     * Uses a half-open interval: openingTime <= currentTime < closingTime.
     * Supports both standard daytime hours (e.g. 10:00 to 23:00) and overnight spans (e.g. 22:00 to 02:00).
     * Equal opening and closing times (e.g. 10:00 to 10:00) are treated as CLOSED.
     *
     * @param openTime    Parsed opening time
     * @param closeTime   Parsed closing time
     * @param currentTime Current comparison time
     * @return true if currentTime falls inside the operating window
     */
    public static boolean isWithinOperatingHours(LocalTime openTime, LocalTime closeTime, LocalTime currentTime) {
        if (openTime == null || closeTime == null || currentTime == null) {
            return false;
        }

        // Same opening and closing time is treated as CLOSED as per specification
        if (openTime.equals(closeTime)) {
            return false;
        }

        if (closeTime.isBefore(openTime)) {
            // Overnight operating window (e.g. 22:00 to 02:00)
            // Active if currentTime >= openTime OR currentTime < closeTime
            return !currentTime.isBefore(openTime) || currentTime.isBefore(closeTime);
        } else {
            // Normal operating window (e.g. 10:00 to 23:00)
            // Active if currentTime >= openTime AND currentTime < closeTime (half-open [open, close))
            return !currentTime.isBefore(openTime) && currentTime.isBefore(closeTime);
        }
    }

    /**
     * Determines whether a restaurant is currently open based on operating schedule, manual toggle, and explicit currentTime.
     *
     * @param openingTimeStr Raw opening time string (e.g. "10:00 AM")
     * @param closingTimeStr Raw closing time string (e.g. "11:00 PM")
     * @param manualOpen     Manual kitchen toggle state (if false, force closed)
     * @param currentTime    Current time to evaluate against
     * @return true if restaurant is open and accepting orders
     */
    public static boolean isCurrentlyOpen(String openingTimeStr, String closingTimeStr, Boolean manualOpen, LocalTime currentTime) {
        boolean manual = manualOpen == null || manualOpen;
        if (!manual) {
            // Owner manually closed kitchen
            return false;
        }

        LocalTime openTime = parseTime(openingTimeStr);
        LocalTime closeTime = parseTime(closingTimeStr);

        if (openTime == null || closeTime == null) {
            // Missing or unparseable hours default safely to CLOSED
            return false;
        }

        return isWithinOperatingHours(openTime, closeTime, currentTime);
    }

    /**
     * Determines whether a restaurant is currently open in Asia/Kolkata real time.
     *
     * @param openingTimeStr Raw opening time string
     * @param closingTimeStr Raw closing time string
     * @param manualOpen     Manual kitchen toggle state
     * @return true if restaurant is open right now in Asia/Kolkata
     */
    public static boolean isCurrentlyOpen(String openingTimeStr, String closingTimeStr, Boolean manualOpen) {
        LocalTime now = LocalTime.now(ZONE_ASIA_KOLKATA);
        return isCurrentlyOpen(openingTimeStr, closingTimeStr, manualOpen, now);
    }
}

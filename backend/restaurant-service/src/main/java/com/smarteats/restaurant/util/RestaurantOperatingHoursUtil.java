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
 * Supports numeric minutes from midnight (0–1439) and resilient string parsing.
 * All time comparisons are strictly evaluated in the Asia/Kolkata (IST) timezone.
 */
@Slf4j
public final class RestaurantOperatingHoursUtil {

    public static final ZoneId ZONE_ASIA_KOLKATA = ZoneId.of("Asia/Kolkata");

    private static final List<DateTimeFormatter> FORMATTERS = List.of(
            DateTimeFormatter.ofPattern("H:mm"),
            DateTimeFormatter.ofPattern("HH:mm"),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("h:mm a").toFormatter(Locale.ENGLISH),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("hh:mm a").toFormatter(Locale.ENGLISH),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("h:mma").toFormatter(Locale.ENGLISH),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("hh:mma").toFormatter(Locale.ENGLISH),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("h a").toFormatter(Locale.ENGLISH),
            new DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern("ha").toFormatter(Locale.ENGLISH),
            DateTimeFormatter.ofPattern("H:mm:ss"),
            DateTimeFormatter.ofPattern("HH:mm:ss")
    );

    private RestaurantOperatingHoursUtil() {
        // Utility class
    }

    /**
     * Parses a string representation of time into a java.time.LocalTime.
     * Supports standard 24-hour (e.g. "10:00", "22:00") and 12-hour (e.g. "10:00 AM", "2:00 AM") formats.
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
     * Converts a time string into minutes from midnight (0–1439).
     *
     * @param timeStr Time string (e.g. "10:00", "10:00 AM", "22:00")
     * @return Minutes from midnight (0..1439) or null if invalid
     */
    public static Integer timeToMinutes(String timeStr) {
        LocalTime lt = parseTime(timeStr);
        return timeToMinutes(lt);
    }

    /**
     * Converts a LocalTime into minutes from midnight (0–1439).
     *
     * @param time LocalTime instance
     * @return Minutes from midnight (0..1439) or null if null
     */
    public static Integer timeToMinutes(LocalTime time) {
        if (time == null) {
            return null;
        }
        return time.getHour() * 60 + time.getMinute();
    }

    /**
     * Determines whether currentMinutes falls within the operating window defined in minutes from midnight.
     * Uses a half-open interval: openMinutes <= currentMinutes < closeMinutes.
     * Supports standard daytime spans (e.g. 600 to 1320) and overnight spans (e.g. 1320 to 120).
     * Equal opening and closing times (e.g. 600 to 600) are treated as CLOSED.
     *
     * @param openMinutes    Opening time in minutes from midnight (0..1439)
     * @param closeMinutes   Closing time in minutes from midnight (0..1439)
     * @param currentMinutes Current time in minutes from midnight (0..1439)
     * @return true if within operating window
     */
    public static boolean isWithinOperatingHours(Integer openMinutes, Integer closeMinutes, Integer currentMinutes) {
        if (openMinutes == null || closeMinutes == null || currentMinutes == null) {
            return false;
        }

        if (openMinutes < 0 || openMinutes > 1439 || closeMinutes < 0 || closeMinutes > 1439 || currentMinutes < 0 || currentMinutes > 1439) {
            return false;
        }

        // Same opening and closing time is treated as CLOSED
        if (openMinutes.equals(closeMinutes)) {
            return false;
        }

        if (closeMinutes < openMinutes) {
            // Overnight operating window (e.g. 1320 [22:00] to 120 [02:00])
            // Active if currentMinutes >= openMinutes OR currentMinutes < closeMinutes
            return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
        } else {
            // Normal daytime operating window (e.g. 600 [10:00] to 1320 [22:00])
            // Active if currentMinutes >= openMinutes AND currentMinutes < closeMinutes
            return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
        }
    }

    /**
     * Determines whether the given currentTime is strictly within the operating hours window.
     */
    public static boolean isWithinOperatingHours(LocalTime openTime, LocalTime closeTime, LocalTime currentTime) {
        if (openTime == null || closeTime == null || currentTime == null) {
            return false;
        }
        return isWithinOperatingHours(timeToMinutes(openTime), timeToMinutes(closeTime), timeToMinutes(currentTime));
    }

    /**
     * Determines whether a restaurant is currently open based on numeric minute fields with string fallbacks.
     */
    public static boolean isCurrentlyOpen(Integer openMinutes, Integer closeMinutes, String openingTimeStr, String closingTimeStr, Boolean manualOpen, LocalTime currentTime) {
        boolean manual = manualOpen == null || manualOpen;
        if (!manual) {
            return false;
        }

        if (openMinutes == null && openingTimeStr != null) {
            openMinutes = timeToMinutes(openingTimeStr);
        }
        if (closeMinutes == null && closingTimeStr != null) {
            closeMinutes = timeToMinutes(closingTimeStr);
        }

        if (openMinutes == null || closeMinutes == null || currentTime == null) {
            return false;
        }

        int currentMinutes = currentTime.getHour() * 60 + currentTime.getMinute();
        return isWithinOperatingHours(openMinutes, closeMinutes, currentMinutes);
    }

    /**
     * Determines whether a restaurant is currently open based on operating schedule strings and manual toggle.
     */
    public static boolean isCurrentlyOpen(String openingTimeStr, String closingTimeStr, Boolean manualOpen, LocalTime currentTime) {
        return isCurrentlyOpen(null, null, openingTimeStr, closingTimeStr, manualOpen, currentTime);
    }

    /**
     * Determines whether a restaurant is currently open in Asia/Kolkata real time.
     */
    public static boolean isCurrentlyOpen(String openingTimeStr, String closingTimeStr, Boolean manualOpen) {
        LocalTime now = LocalTime.now(ZONE_ASIA_KOLKATA);
        return isCurrentlyOpen(openingTimeStr, closingTimeStr, manualOpen, now);
    }

    /**
     * Determines whether a restaurant is currently open in Asia/Kolkata real time using numeric minutes with string fallback.
     */
    public static boolean isCurrentlyOpen(Integer openMinutes, Integer closeMinutes, String openingTimeStr, String closingTimeStr, Boolean manualOpen) {
        LocalTime now = LocalTime.now(ZONE_ASIA_KOLKATA);
        return isCurrentlyOpen(openMinutes, closeMinutes, openingTimeStr, closingTimeStr, manualOpen, now);
    }
}

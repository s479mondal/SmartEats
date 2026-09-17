package com.smarteats.restaurant.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalTime;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.*;

class RestaurantOperatingHoursUtilTest {

    @Test
    @DisplayName("NORMAL HOURS: 10:00 to 23:00 (10:00 AM to 11:00 PM)")
    void testNormalOperatingHours() {
        String open = "10:00 AM";
        String close = "11:00 PM";

        // 09:59:59 -> CLOSED
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, true, LocalTime.of(9, 59, 59)));
        // 10:00:00 -> OPEN
        assertTrue(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, true, LocalTime.of(10, 0, 0)));
        // 15:00:00 -> OPEN
        assertTrue(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, true, LocalTime.of(15, 0, 0)));
        // 22:59:59 -> OPEN
        assertTrue(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, true, LocalTime.of(22, 59, 59)));
        // 23:00:00 -> CLOSED (half-open interval)
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, true, LocalTime.of(23, 0, 0)));
        // 23:01:00 -> CLOSED
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, true, LocalTime.of(23, 1, 0)));
    }

    @Test
    @DisplayName("OVERNIGHT HOURS: 22:00 to 02:00 (10:00 PM to 2:00 AM)")
    void testOvernightOperatingHours() {
        String open = "10:00 PM";
        String close = "2:00 AM";

        // 21:59:59 -> CLOSED
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, true, LocalTime.of(21, 59, 59)));
        // 22:00:00 -> OPEN
        assertTrue(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, true, LocalTime.of(22, 0, 0)));
        // 23:30:00 -> OPEN
        assertTrue(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, true, LocalTime.of(23, 30, 0)));
        // 23:59:59 -> OPEN
        assertTrue(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, true, LocalTime.of(23, 59, 59)));
        // 00:00:00 -> OPEN
        assertTrue(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, true, LocalTime.of(0, 0, 0)));
        // 01:30:00 -> OPEN
        assertTrue(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, true, LocalTime.of(1, 30, 0)));
        // 01:59:59 -> OPEN
        assertTrue(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, true, LocalTime.of(1, 59, 59)));
        // 02:00:00 -> CLOSED (half-open interval)
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, true, LocalTime.of(2, 0, 0)));
        // 02:01:00 -> CLOSED
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, true, LocalTime.of(2, 1, 0)));
    }

    @Test
    @DisplayName("SAME TIME: 10:00 to 10:00 treated safely as CLOSED")
    void testSameOpeningAndClosingTime() {
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen("10:00 AM", "10:00 AM", true, LocalTime.of(10, 0)));
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen("10:00", "10:00", true, LocalTime.of(10, 0)));
    }

    @Test
    @DisplayName("NULL / INVALID / MALFORMED: treated safely as CLOSED without throwing exceptions")
    void testNullAndInvalidTimeHandling() {
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen(null, "10:00 PM", true, LocalTime.of(12, 0)));
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen("10:00 AM", null, true, LocalTime.of(12, 0)));
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen(null, null, true, LocalTime.of(12, 0)));
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen("", "", true, LocalTime.of(12, 0)));
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen("   ", "10:00 PM", true, LocalTime.of(12, 0)));
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen("invalid_time", "10:00 PM", true, LocalTime.of(12, 0)));
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen("10:00 AM", "malformed_string", true, LocalTime.of(12, 0)));
    }

    @Test
    @DisplayName("FORMAT VARIATIONS: supports 12-hour, 24-hour, mixed case, and spaces")
    void testFormatVariations() {
        assertEquals(LocalTime.of(10, 0), RestaurantOperatingHoursUtil.parseTime("10:00 AM"));
        assertEquals(LocalTime.of(22, 0), RestaurantOperatingHoursUtil.parseTime("10:00 PM"));
        assertEquals(LocalTime.of(2, 0), RestaurantOperatingHoursUtil.parseTime("2:00 AM"));
        assertEquals(LocalTime.of(2, 0), RestaurantOperatingHoursUtil.parseTime("02:00 AM"));
        assertEquals(LocalTime.of(10, 0), RestaurantOperatingHoursUtil.parseTime("10:00"));
        assertEquals(LocalTime.of(22, 0), RestaurantOperatingHoursUtil.parseTime("22:00"));
        assertEquals(LocalTime.of(2, 0), RestaurantOperatingHoursUtil.parseTime("02:00"));
        assertEquals(LocalTime.of(10, 0), RestaurantOperatingHoursUtil.parseTime("10:00AM"));
        assertEquals(LocalTime.of(2, 0), RestaurantOperatingHoursUtil.parseTime("2:00am"));
        assertEquals(LocalTime.of(10, 0), RestaurantOperatingHoursUtil.parseTime("10 AM"));
        assertEquals(LocalTime.of(14, 0), RestaurantOperatingHoursUtil.parseTime("2 PM"));
    }

    @Test
    @DisplayName("MANUAL OVERRIDE: manual open = false forces closed; manual open = true requires valid schedule")
    void testManualOverride() {
        String open = "10:00 AM";
        String close = "10:00 PM";
        LocalTime insideHours = LocalTime.of(14, 0);
        LocalTime outsideHours = LocalTime.of(23, 30);

        // Within hours + manual true -> OPEN
        assertTrue(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, true, insideHours));

        // Within hours + manual false -> CLOSED (Owner emergency override)
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, false, insideHours));

        // Outside hours + manual true -> CLOSED (Schedule prevents opening)
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, true, outsideHours));

        // Outside hours + manual false -> CLOSED
        assertFalse(RestaurantOperatingHoursUtil.isCurrentlyOpen(open, close, false, outsideHours));
    }

    @Test
    @DisplayName("TIMEZONE: confirms explicitly configured Asia/Kolkata ZoneId")
    void testTimezoneSetting() {
        assertEquals(ZoneId.of("Asia/Kolkata"), RestaurantOperatingHoursUtil.ZONE_ASIA_KOLKATA);
        // Real-time evaluation runs cleanly
        assertDoesNotThrow(() -> RestaurantOperatingHoursUtil.isCurrentlyOpen("10:00 AM", "10:00 PM", true));
    }
}

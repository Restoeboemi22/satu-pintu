package com.satupintu.mobile

import com.satupintu.mobile.util.SecurityUtils
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ExampleUnitTest {
    @Test
    fun sha256_hex_is_stable() {
        assertEquals(
            "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            SecurityUtils.sha256Hex("test")
        )
    }

    @Test
    fun coordinate_validation_rejects_out_of_range_values() {
        assertTrue(SecurityUtils.isValidCoordinate(-7.6698, 112.5432))
        assertFalse(SecurityUtils.isValidCoordinate(123.0, 112.5432))
        assertFalse(SecurityUtils.isValidCoordinate(-7.6698, 200.0))
    }

    @Test
    fun route_guard_matches_flavor_and_role() {
        assertTrue(SecurityUtils.isRouteAllowed("attendance", "student", "siswa"))
        assertFalse(SecurityUtils.isRouteAllowed("teacher_attendance", "student", "siswa"))
        assertTrue(SecurityUtils.isRouteAllowed("teacher_attendance", "teacher", "guru"))
        assertTrue(SecurityUtils.isRouteAllowed("osis_discipline", "staff", "guru"))
        assertTrue(SecurityUtils.isRouteAllowed("principal_seven_habits", "principal", "kepala"))
        assertFalse(SecurityUtils.isRouteAllowed("principal_attendance", "teacher", "guru"))
    }
}


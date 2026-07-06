package com.sekolah.edulock

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.text.SimpleDateFormat
import java.util.*

class DatabaseHelper(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        private const val DATABASE_NAME = "edulock.db"
        private const val DATABASE_VERSION = 1

        // Table Students
        private const val TABLE_STUDENTS = "students"
        private const val COL_ID = "id"
        private const val COL_NISN = "nisn"
        private const val COL_NAME = "name"
        private const val COL_CLASS = "class"
        private const val COL_REG_DATE = "registration_date"

        // Table Location Logs
        private const val TABLE_LOCATION_LOGS = "location_logs"
        private const val COL_LOG_ID = "id"
        private const val COL_STUDENT_ID = "student_id"
        private const val COL_LATITUDE = "latitude"
        private const val COL_LONGITUDE = "longitude"
        private const val COL_DISTANCE = "distance"
        private const val COL_TIMESTAMP = "timestamp"

        // Table Violations
        private const val TABLE_VIOLATIONS = "violations"
        private const val COL_VIOLATION_ID = "id"
        private const val COL_VIOLATION_STUDENT_ID = "student_id"
        private const val COL_VIOLATION_TYPE = "type"
        private const val COL_VIOLATION_DESCRIPTION = "description"
        private const val COL_VIOLATION_TIMESTAMP = "timestamp"
    }

    override fun onCreate(db: SQLiteDatabase) {
        // Create Students table
        val createStudentsTable = """
            CREATE TABLE $TABLE_STUDENTS (
                $COL_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COL_NISN TEXT UNIQUE NOT NULL,
                $COL_NAME TEXT NOT NULL,
                $COL_CLASS TEXT NOT NULL,
                $COL_REG_DATE TEXT NOT NULL
            )
        """.trimIndent()

        // Create Location Logs table
        val createLocationLogsTable = """
            CREATE TABLE $TABLE_LOCATION_LOGS (
                $COL_LOG_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COL_STUDENT_ID INTEGER NOT NULL,
                $COL_LATITUDE REAL NOT NULL,
                $COL_LONGITUDE REAL NOT NULL,
                $COL_DISTANCE REAL NOT NULL,
                $COL_TIMESTAMP TEXT NOT NULL,
                FOREIGN KEY($COL_STUDENT_ID) REFERENCES $TABLE_STUDENTS($COL_ID)
            )
        """.trimIndent()

        // Create Violations table
        val createViolationsTable = """
            CREATE TABLE $TABLE_VIOLATIONS (
                $COL_VIOLATION_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COL_VIOLATION_STUDENT_ID INTEGER NOT NULL,
                $COL_VIOLATION_TYPE TEXT NOT NULL,
                $COL_VIOLATION_DESCRIPTION TEXT NOT NULL,
                $COL_VIOLATION_TIMESTAMP TEXT NOT NULL,
                FOREIGN KEY($COL_VIOLATION_STUDENT_ID) REFERENCES $TABLE_STUDENTS($COL_ID)
            )
        """.trimIndent()

        db.execSQL(createStudentsTable)
        db.execSQL(createLocationLogsTable)
        db.execSQL(createViolationsTable)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS $TABLE_VIOLATIONS")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_LOCATION_LOGS")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_STUDENTS")
        onCreate(db)
    }

    // Student Operations
    fun insertStudent(nisn: String, name: String, studentClass: String): Long {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_NISN, nisn)
            put(COL_NAME, name)
            put(COL_CLASS, studentClass)
            put(COL_REG_DATE, getCurrentDateTime())
        }
        return db.insert(TABLE_STUDENTS, null, values)
    }

    fun getStudentByNisn(nisn: String): Student? {
        val db = readableDatabase
        val cursor = db.query(
            TABLE_STUDENTS,
            null,
            "$COL_NISN = ?",
            arrayOf(nisn),
            null,
            null,
            null
        )

        return if (cursor.moveToFirst()) {
            val student = Student(
                id = cursor.getLong(cursor.getColumnIndexOrThrow(COL_ID)),
                nisn = cursor.getString(cursor.getColumnIndexOrThrow(COL_NISN)),
                name = cursor.getString(cursor.getColumnIndexOrThrow(COL_NAME)),
                studentClass = cursor.getString(cursor.getColumnIndexOrThrow(COL_CLASS)),
                registrationDate = cursor.getString(cursor.getColumnIndexOrThrow(COL_REG_DATE))
            )
            cursor.close()
            student
        } else {
            cursor.close()
            null
        }
    }

    // Location Log Operations
    fun insertLocationLog(studentId: Long, latitude: Double, longitude: Double, distance: Float) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_STUDENT_ID, studentId)
            put(COL_LATITUDE, latitude)
            put(COL_LONGITUDE, longitude)
            put(COL_DISTANCE, distance)
            put(COL_TIMESTAMP, getCurrentDateTime())
        }
        db.insert(TABLE_LOCATION_LOGS, null, values)
    }

    fun getLocationLogs(studentId: Long): List<LocationLog> {
        val logs = mutableListOf<LocationLog>()
        val db = readableDatabase
        val cursor = db.query(
            TABLE_LOCATION_LOGS,
            null,
            "$COL_STUDENT_ID = ?",
            arrayOf(studentId.toString()),
            null,
            null,
            "$COL_TIMESTAMP DESC"
        )

        while (cursor.moveToNext()) {
            logs.add(
                LocationLog(
                    id = cursor.getLong(cursor.getColumnIndexOrThrow(COL_LOG_ID)),
                    studentId = cursor.getLong(cursor.getColumnIndexOrThrow(COL_STUDENT_ID)),
                    latitude = cursor.getDouble(cursor.getColumnIndexOrThrow(COL_LATITUDE)),
                    longitude = cursor.getDouble(cursor.getColumnIndexOrThrow(COL_LONGITUDE)),
                    distance = cursor.getFloat(cursor.getColumnIndexOrThrow(COL_DISTANCE)),
                    timestamp = cursor.getString(cursor.getColumnIndexOrThrow(COL_TIMESTAMP))
                )
            )
        }
        cursor.close()
        return logs
    }

    // Violation Operations
    fun logViolation(nisn: String, type: String, description: String) {
        val student = getStudentByNisn(nisn)
        if (student != null) {
            insertViolation(student.id, type, description)
        }
    }

    fun insertViolation(studentId: Long, type: String, description: String) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_VIOLATION_STUDENT_ID, studentId)
            put(COL_VIOLATION_TYPE, type)
            put(COL_VIOLATION_DESCRIPTION, description)
            put(COL_VIOLATION_TIMESTAMP, getCurrentDateTime())
        }
        db.insert(TABLE_VIOLATIONS, null, values)
    }

    fun getViolations(studentId: Long): List<Violation> {
        val violations = mutableListOf<Violation>()
        val db = readableDatabase
        val cursor = db.query(
            TABLE_VIOLATIONS,
            null,
            "$COL_VIOLATION_STUDENT_ID = ?",
            arrayOf(studentId.toString()),
            null,
            null,
            "$COL_VIOLATION_TIMESTAMP DESC"
        )

        while (cursor.moveToNext()) {
            violations.add(
                Violation(
                    id = cursor.getLong(cursor.getColumnIndexOrThrow(COL_VIOLATION_ID)),
                    studentId = cursor.getLong(cursor.getColumnIndexOrThrow(COL_VIOLATION_STUDENT_ID)),
                    type = cursor.getString(cursor.getColumnIndexOrThrow(COL_VIOLATION_TYPE)),
                    description = cursor.getString(cursor.getColumnIndexOrThrow(COL_VIOLATION_DESCRIPTION)),
                    timestamp = cursor.getString(cursor.getColumnIndexOrThrow(COL_VIOLATION_TIMESTAMP))
                )
            )
        }
        cursor.close()
        return violations
    }

    private fun getCurrentDateTime(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
        return sdf.format(Date())
    }
}

// Data Classes
data class Student(
    val id: Long = 0,
    val nisn: String,
    val name: String,
    val studentClass: String,
    val registrationDate: String
)

data class LocationLog(
    val id: Long = 0,
    val studentId: Long,
    val latitude: Double,
    val longitude: Double,
    val distance: Float,
    val timestamp: String
)

data class Violation(
    val id: Long = 0,
    val studentId: Long,
    val type: String,
    val description: String,
    val timestamp: String
)
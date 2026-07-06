package com.sekolah.edulock

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

class CodeHelper(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        private const val DATABASE_NAME = "pause_codes.db"
        private const val DATABASE_VERSION = 1

        private const val TABLE_CODES = "pause_codes"
        private const val COL_ID = "id"
        private const val COL_CODE = "code"
        private const val COL_EXPIRY_TIME = "expiry_time"
        private const val COL_CREATED_AT = "created_at"
        private const val COL_IS_USED = "is_used"
    }

    override fun onCreate(db: SQLiteDatabase) {
        val createTable = """
            CREATE TABLE $TABLE_CODES (
                $COL_ID INTEGER PRIMARY KEY AUTOINCREMENT,
                $COL_CODE TEXT NOT NULL,
                $COL_EXPIRY_TIME INTEGER NOT NULL,
                $COL_CREATED_AT INTEGER NOT NULL,
                $COL_IS_USED INTEGER DEFAULT 0
            )
        """.trimIndent()

        db.execSQL(createTable)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS $TABLE_CODES")
        onCreate(db)
    }

    fun insertCode(code: String, expiryTime: Long): Long {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_CODE, code)
            put(COL_EXPIRY_TIME, expiryTime)
            put(COL_CREATED_AT, System.currentTimeMillis())
            put(COL_IS_USED, 0)
        }
        return db.insert(TABLE_CODES, null, values)
    }

    fun validateCode(code: String): Boolean {
        val db = readableDatabase
        val currentTime = System.currentTimeMillis()

        val cursor = db.query(
            TABLE_CODES,
            null,
            "$COL_CODE = ? AND $COL_EXPIRY_TIME > ? AND $COL_IS_USED = 0",
            arrayOf(code, currentTime.toString()),
            null,
            null,
            null
        )

        val isValid = cursor.count > 0

        if (isValid && cursor.moveToFirst()) {
            // Mark code as used
            val codeId = cursor.getLong(cursor.getColumnIndexOrThrow(COL_ID))
            markCodeAsUsed(codeId)
        }

        cursor.close()
        return isValid
    }

    private fun markCodeAsUsed(id: Long) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put(COL_IS_USED, 1)
        }
        db.update(TABLE_CODES, values, "$COL_ID = ?", arrayOf(id.toString()))
    }

    fun getActiveCodes(): List<PauseCode> {
        val codes = mutableListOf<PauseCode>()
        val db = readableDatabase
        val currentTime = System.currentTimeMillis()

        // Get codes that are not used and not expired
        val cursor = db.query(
            TABLE_CODES,
            null,
            "$COL_IS_USED = 0 AND $COL_EXPIRY_TIME > ?",
            arrayOf(currentTime.toString()),
            null,
            null,
            "$COL_CREATED_AT DESC"
        )

        while (cursor.moveToNext()) {
            codes.add(
                PauseCode(
                    id = cursor.getLong(cursor.getColumnIndexOrThrow(COL_ID)),
                    code = cursor.getString(cursor.getColumnIndexOrThrow(COL_CODE)),
                    expiryTime = cursor.getLong(cursor.getColumnIndexOrThrow(COL_EXPIRY_TIME)),
                    createdAt = cursor.getLong(cursor.getColumnIndexOrThrow(COL_CREATED_AT)),
                    isUsed = cursor.getInt(cursor.getColumnIndexOrThrow(COL_IS_USED)) == 1
                )
            )
        }
        cursor.close()
        return codes
    }

    fun deleteCode(id: Long) {
        val db = writableDatabase
        db.delete(TABLE_CODES, "$COL_ID = ?", arrayOf(id.toString()))
    }

    fun deleteExpiredCodes() {
        val db = writableDatabase
        val currentTime = System.currentTimeMillis()
        db.delete(TABLE_CODES, "$COL_EXPIRY_TIME < ?", arrayOf(currentTime.toString()))
    }
}

data class PauseCode(
    val id: Long,
    val code: String,
    val expiryTime: Long,
    val createdAt: Long,
    val isUsed: Boolean
)
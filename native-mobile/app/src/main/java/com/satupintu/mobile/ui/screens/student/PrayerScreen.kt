package com.satupintu.mobile.ui.screens.student

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.provider.Settings
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import com.satupintu.mobile.util.SecurityUtils
import java.util.Calendar
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

private data class MushollaLocation(val lat: Double, val lng: Double, val radiusMeters: Double)

private fun toYmd(cal: Calendar): String {
    val y = cal.get(Calendar.YEAR)
    val m = cal.get(Calendar.MONTH) + 1
    val d = cal.get(Calendar.DAY_OF_MONTH)
    return "%04d-%02d-%02d".format(y, m, d)
}

private fun haversineMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
    val r = 6371e3
    val phi1 = Math.toRadians(lat1)
    val phi2 = Math.toRadians(lat2)
    val dPhi = Math.toRadians(lat2 - lat1)
    val dLambda = Math.toRadians(lon2 - lon1)
    val a = sin(dPhi / 2) * sin(dPhi / 2) + cos(phi1) * cos(phi2) * sin(dLambda / 2) * sin(dLambda / 2)
    val c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c
}

private fun isNonMuslim(religionRaw: String): Boolean {
    val r = religionRaw.trim().lowercase()
    if (r.isEmpty()) return false
    if (r == "non_islam" || r == "non-islam" || r == "non muslim" || r == "nonmuslim") return true
    if (r.contains("non") && r.contains("islam")) return true
    if (r.contains("kristen") || r.contains("katolik") || r.contains("hindu") || r.contains("buddha") || r.contains("konghucu")) return true
    return false
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun PrayerScreen(
    studentCredential: String,
    studentId: String,
    schoolId: String,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val db = remember { FirebaseDatabase.getInstance() }

    var resolvedSchoolId by remember { mutableStateOf(schoolId.trim().lowercase()) }
    var religion by remember { mutableStateOf("") }

    var musholla by remember { mutableStateOf(MushollaLocation(lat = -7.6698, lng = 112.5432, radiusMeters = 25.0)) }
    var schedules by remember { mutableStateOf<Map<String, Boolean>>(emptyMap()) } // dayKey -> isHoliday
    var holidays by remember { mutableStateOf<Set<String>>(emptySet()) } // yyyy-mm-dd

    var permissionGranted by remember { mutableStateOf(false) }
    var isChecking by remember { mutableStateOf(false) }
    var coords by remember { mutableStateOf<Pair<Double, Double>?>(null) }
    var distanceMeters by remember { mutableStateOf<Double?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }
    var locationAccuracy by remember { mutableStateOf<Float?>(null) }
    var locationProvider by remember { mutableStateOf<String?>(null) }
    var mockLocationDetected by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        val ok = result.values.all { it }
        permissionGranted = ok
        if (!ok) {
            Toast.makeText(context, "Izin lokasi ditolak. Presensi sholat membutuhkan lokasi.", Toast.LENGTH_LONG).show()
        }
    }

    LaunchedEffect(Unit) {
        val okFine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val okCoarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        permissionGranted = okFine || okCoarse
        if (!permissionGranted) {
            permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        }
    }

    DisposableEffect(studentCredential, studentId, schoolId) {
        var legacyMushollaListener: ValueEventListener? = null
        var scopedMushollaListener: ValueEventListener? = null
        var legacySchedulesListener: ValueEventListener? = null
        var scopedSchedulesListener: ValueEventListener? = null
        var legacyHolidaysListener: ValueEventListener? = null
        var scopedHolidaysListener: ValueEventListener? = null
        var studentProfileListener: ValueEventListener? = null

        var legacyMusholla: MushollaLocation? = null
        var scopedMusholla: MushollaLocation? = null
        var legacySchedules: Map<String, Boolean>? = null
        var scopedSchedules: Map<String, Boolean>? = null
        var legacyHolidays: Set<String>? = null
        var scopedHolidays: Set<String>? = null
        var attachedScopeKey = resolvedSchoolId

        fun applyMusholla() {
            val picked = scopedMusholla ?: legacyMusholla
            if (picked != null) musholla = picked
        }
        fun applySchedules() {
            val picked = scopedSchedules ?: legacySchedules
            if (picked != null) schedules = picked else schedules = emptyMap()
        }
        fun applyHolidays() {
            val picked = scopedHolidays ?: legacyHolidays
            if (picked != null) holidays = picked else holidays = emptySet()
        }

        fun normalizeIdentity(value: String?): String = value?.trim().orEmpty()
        val identityCandidates = linkedSetOf(
            normalizeIdentity(studentCredential),
            normalizeIdentity(studentId)
        ).filter { it.isNotBlank() }.toSet()

        fun applyStudentProfile(snapshot: DataSnapshot?) {
            if (snapshot == null || !snapshot.exists()) return
            val school = snapshot.child("schoolId").getValue(String::class.java)?.trim()?.lowercase().orEmpty()
            val rel = snapshot.child("religion").getValue(String::class.java)
                ?: snapshot.child("agama").getValue(String::class.java)
                ?: ""
            if (school.isNotBlank()) {
                resolvedSchoolId = school
            }
            if (rel.isNotBlank()) {
                religion = rel
            }
        }

        fun attachScopedListeners(scope: String) {
            if (scope.isBlank()) return
            if (attachedScopeKey == scope && (scopedMushollaListener != null || scopedSchedulesListener != null || scopedHolidaysListener != null)) {
                return
            }

            if (attachedScopeKey.isNotBlank()) {
                scopedMushollaListener?.let {
                    db.getReference("school_settings").child(attachedScopeKey).child("prayer").child("musholla_location")
                        .removeEventListener(it)
                }
                scopedSchedulesListener?.let {
                    db.getReference("school_settings").child(attachedScopeKey).child("prayer").child("schedules")
                        .removeEventListener(it)
                }
                scopedHolidaysListener?.let {
                    db.getReference("school_settings").child(attachedScopeKey).child("attendance").child("holidays")
                        .removeEventListener(it)
                }
            }
            attachedScopeKey = scope

            val mushRef = db.getReference("school_settings").child(scope).child("prayer").child("musholla_location")
            scopedMushollaListener = object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    if (!snapshot.exists()) {
                        scopedMusholla = null
                        applyMusholla()
                        return
                    }
                    val lat = snapshot.child("latitude").getValue(Double::class.java) ?: snapshot.child("lat").getValue(Double::class.java) ?: Double.NaN
                    val lng = snapshot.child("longitude").getValue(Double::class.java) ?: snapshot.child("lng").getValue(Double::class.java) ?: Double.NaN
                    val radius = snapshot.child("radius").getValue(Double::class.java) ?: snapshot.child("radiusMeters").getValue(Double::class.java) ?: Double.NaN
                    if (!lat.isFinite() || !lng.isFinite() || !radius.isFinite()) return
                    scopedMusholla = MushollaLocation(lat, lng, radius)
                    applyMusholla()
                }
                override fun onCancelled(error: DatabaseError) {}
            }
            mushRef.addValueEventListener(scopedMushollaListener as ValueEventListener)

            val schedRef = db.getReference("school_settings").child(scope).child("prayer").child("schedules")
            scopedSchedulesListener = object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    if (!snapshot.exists()) {
                        scopedSchedules = null
                        applySchedules()
                        return
                    }
                    val map = mutableMapOf<String, Boolean>()
                    for (child in snapshot.children) {
                        val key = child.key ?: continue
                        val isHoliday = child.child("isHoliday").getValue(Boolean::class.java) ?: false
                        map[key] = isHoliday
                    }
                    scopedSchedules = map
                    applySchedules()
                }
                override fun onCancelled(error: DatabaseError) {}
            }
            schedRef.addValueEventListener(scopedSchedulesListener as ValueEventListener)

            val holRef = db.getReference("school_settings").child(scope).child("attendance").child("holidays")
            scopedHolidaysListener = object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    if (!snapshot.exists()) {
                        scopedHolidays = null
                        applyHolidays()
                        return
                    }
                    val set = mutableSetOf<String>()
                    for (child in snapshot.children) {
                        val date = child.child("date").getValue(String::class.java) ?: ""
                        if (date.isNotBlank()) set.add(date.trim())
                    }
                    scopedHolidays = set
                    applyHolidays()
                }
                override fun onCancelled(error: DatabaseError) {}
            }
            holRef.addValueEventListener(scopedHolidaysListener as ValueEventListener)
        }

        if (resolvedSchoolId.isNotBlank()) {
            attachScopedListeners(resolvedSchoolId)
        }

        studentProfileListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val matchedStudent = snapshot.children.firstOrNull { child ->
                    identityCandidates.contains(normalizeIdentity(child.key)) ||
                        identityCandidates.contains(normalizeIdentity(child.child("id").getValue(String::class.java))) ||
                        identityCandidates.contains(normalizeIdentity(child.child("nisn").getValue(String::class.java)))
                }
                applyStudentProfile(matchedStudent)
                val scope = matchedStudent?.child("schoolId")?.getValue(String::class.java)?.trim()?.lowercase().orEmpty()
                if (scope.isNotBlank()) {
                    attachScopedListeners(scope)
                }
            }

            override fun onCancelled(error: DatabaseError) {}
        }
        db.getReference("master_students").addListenerForSingleValueEvent(studentProfileListener as ValueEventListener)
        db.getReference("students").addListenerForSingleValueEvent(studentProfileListener as ValueEventListener)

        legacyMushollaListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (!snapshot.exists()) {
                    legacyMusholla = null
                    applyMusholla()
                    return
                }
                val lat = snapshot.child("latitude").getValue(Double::class.java) ?: snapshot.child("lat").getValue(Double::class.java) ?: Double.NaN
                val lng = snapshot.child("longitude").getValue(Double::class.java) ?: snapshot.child("lng").getValue(Double::class.java) ?: Double.NaN
                val radius = snapshot.child("radius").getValue(Double::class.java) ?: snapshot.child("radiusMeters").getValue(Double::class.java) ?: Double.NaN
                if (!lat.isFinite() || !lng.isFinite() || !radius.isFinite()) return
                legacyMusholla = MushollaLocation(lat, lng, radius)
                applyMusholla()
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        db.getReference("musholla_location").addValueEventListener(legacyMushollaListener as ValueEventListener)

        legacySchedulesListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (!snapshot.exists()) {
                    legacySchedules = null
                    applySchedules()
                    return
                }
                val map = mutableMapOf<String, Boolean>()
                for (child in snapshot.children) {
                    val key = child.key ?: continue
                    val isHoliday = child.child("isHoliday").getValue(Boolean::class.java) ?: false
                    map[key] = isHoliday
                }
                legacySchedules = map
                applySchedules()
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        db.getReference("prayer_schedules").addValueEventListener(legacySchedulesListener as ValueEventListener)

        legacyHolidaysListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                if (!snapshot.exists()) {
                    legacyHolidays = null
                    applyHolidays()
                    return
                }
                val set = mutableSetOf<String>()
                for (child in snapshot.children) {
                    val date = child.child("date").getValue(String::class.java) ?: ""
                    if (date.isNotBlank()) set.add(date.trim())
                }
                legacyHolidays = set
                applyHolidays()
            }
            override fun onCancelled(error: DatabaseError) {}
        }
        db.getReference("holidays").addValueEventListener(legacyHolidaysListener as ValueEventListener)

        onDispose {
            if (legacyMushollaListener != null) db.getReference("musholla_location").removeEventListener(legacyMushollaListener as ValueEventListener)
            if (legacySchedulesListener != null) db.getReference("prayer_schedules").removeEventListener(legacySchedulesListener as ValueEventListener)
            if (legacyHolidaysListener != null) db.getReference("holidays").removeEventListener(legacyHolidaysListener as ValueEventListener)

            if (scopedMushollaListener != null && resolvedSchoolId.isNotBlank()) {
                db.getReference("school_settings").child(resolvedSchoolId).child("prayer").child("musholla_location")
                    .removeEventListener(scopedMushollaListener as ValueEventListener)
            }
            if (scopedSchedulesListener != null && resolvedSchoolId.isNotBlank()) {
                db.getReference("school_settings").child(resolvedSchoolId).child("prayer").child("schedules")
                    .removeEventListener(scopedSchedulesListener as ValueEventListener)
            }
            if (scopedHolidaysListener != null && resolvedSchoolId.isNotBlank()) {
                db.getReference("school_settings").child(resolvedSchoolId).child("attendance").child("holidays")
                    .removeEventListener(scopedHolidaysListener as ValueEventListener)
            }
        }
    }

    val cal = remember { Calendar.getInstance() }
    val todayYmd = remember { toYmd(cal) }
    val dayKey = remember { cal.get(Calendar.DAY_OF_WEEK).toString() }

    val isHolidayBySchedule = when {
        cal.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY -> true
        schedules.isEmpty() -> false
        schedules[dayKey] == null -> true
        else -> schedules[dayKey] == true
    }
    val isHolidayByDate = holidays.contains(todayYmd)
    val nonMuslim = isNonMuslim(religion)
    val deviceTimeTrusted = SecurityUtils.isAutomaticTimeEnabled(context) &&
        SecurityUtils.isAutomaticTimeZoneEnabled(context)

    val canAttemptByRule = !nonMuslim && !isHolidayBySchedule && !isHolidayByDate
    val canAttemptByLocation = coords != null &&
        distanceMeters != null &&
        !mockLocationDetected &&
        (distanceMeters ?: 0.0) <= musholla.radiusMeters
    val canSubmit = canAttemptByRule && canAttemptByLocation && deviceTimeTrusted && !isSubmitting

    fun checkLocation() {
        if (!permissionGranted) {
            Toast.makeText(context, "Izin lokasi belum diberikan.", Toast.LENGTH_LONG).show()
            permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
            return
        }
        isChecking = true
        try {
            val fused = LocationServices.getFusedLocationProviderClient(context)
            val token = CancellationTokenSource()
            fused.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, token.token)
                .addOnSuccessListener { loc ->
                    if (loc == null) {
                        Toast.makeText(context, "Gagal mengambil lokasi. Pastikan GPS aktif.", Toast.LENGTH_LONG).show()
                        return@addOnSuccessListener
                    }
                    val lat = loc.latitude
                    val lng = loc.longitude
                    if (!SecurityUtils.isValidCoordinate(lat, lng)) {
                        Toast.makeText(context, "Koordinat lokasi tidak valid. Coba aktifkan ulang GPS.", Toast.LENGTH_LONG).show()
                        return@addOnSuccessListener
                    }
                    if (SecurityUtils.isMockLocation(loc)) {
                        mockLocationDetected = true
                        coords = lat to lng
                        distanceMeters = haversineMeters(lat, lng, musholla.lat, musholla.lng)
                        locationAccuracy = loc.accuracy
                        locationProvider = loc.provider
                        Toast.makeText(context, "Lokasi palsu terdeteksi. Presensi sholat diblokir.", Toast.LENGTH_LONG).show()
                        return@addOnSuccessListener
                    }
                    mockLocationDetected = false
                    coords = lat to lng
                    distanceMeters = haversineMeters(lat, lng, musholla.lat, musholla.lng)
                    locationAccuracy = loc.accuracy
                    locationProvider = loc.provider
                }
                .addOnFailureListener { e ->
                    Toast.makeText(context, "Gagal cek lokasi: ${e.message}", Toast.LENGTH_LONG).show()
                }
                .addOnCompleteListener {
                    isChecking = false
                }
        } catch (e: Exception) {
            isChecking = false
            Toast.makeText(context, "Gagal cek lokasi: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    fun submitPrayer() {
        if (!canAttemptByRule) {
            val reason = when {
                nonMuslim -> "Presensi sholat tidak berlaku untuk siswa non muslim."
                isHolidayBySchedule -> "Hari ini non-efektif (jadwal libur)."
                isHolidayByDate -> "Hari ini libur (tanggal merah)."
                else -> "Tidak bisa presensi."
            }
            Toast.makeText(context, reason, Toast.LENGTH_LONG).show()
            return
        }
        if (!canAttemptByLocation) {
            val locationMessage = if (mockLocationDetected) {
                "Lokasi palsu terdeteksi. Presensi sholat diblokir."
            } else {
                "Anda harus berada di area musholla untuk presensi."
            }
            Toast.makeText(context, locationMessage, Toast.LENGTH_LONG).show()
            return
        }
        if (!deviceTimeTrusted) {
            Toast.makeText(context, "Aktifkan tanggal otomatis dan zona waktu otomatis sebelum presensi.", Toast.LENGTH_LONG).show()
            return
        }
        isSubmitting = true
        val now = System.currentTimeMillis()
        val payload = hashMapOf<String, Any?>(
            "schoolId" to resolvedSchoolId,
            "studentId" to studentId.trim().ifBlank { studentCredential.trim() },
            "nisn" to studentCredential.trim(),
            "date" to now,
            "status" to "PRAY",
            "lat" to (coords?.first ?: null),
            "lng" to (coords?.second ?: null),
            "accuracy" to locationAccuracy,
            "provider" to locationProvider,
            "isMockLocation" to mockLocationDetected,
            "deviceTimeTrusted" to deviceTimeTrusted,
            "deviceId" to SecurityUtils.getDeviceBindingId(context),
            "recordedBy" to "APP_NATIVE",
            "createdAt" to now,
            "updatedAt" to now
        )

        db.getReference("prayer_attendance").push().setValue(payload)
            .addOnSuccessListener {
                Toast.makeText(context, "Presensi sholat berhasil dicatat.", Toast.LENGTH_LONG).show()
                isSubmitting = false
            }
            .addOnFailureListener { e ->
                Toast.makeText(context, "Gagal presensi: ${e.message}", Toast.LENGTH_LONG).show()
                isSubmitting = false
            }
    }

    Scaffold(
        topBar = {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.horizontalGradient(
                            listOf(
                                Color(0xFF0F2A43),
                                Color(0xFF0F7BFF)
                            )
                        )
                    )
            ) {
                TopAppBar(
                    title = { Text("Presensi Sholat", fontWeight = FontWeight.Bold) },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color.Transparent,
                        titleContentColor = Color.White,
                        navigationIconContentColor = Color.White
                    )
                )
            }
        }
    ) { padding ->
        val pageBackground = remember {
            Brush.verticalGradient(
                colors = listOf(
                    Color(0xFF12D6C6),
                    Color(0xFF0F7BFF),
                    Color(0xFF0F2A43)
                )
            )
        }
        val cardShape = remember { RoundedCornerShape(20.dp) }
        val cardBorder = Color.White.copy(alpha = 0.18f)
        val cardBg = Color(0xFF0B1F33).copy(alpha = 0.22f)

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(pageBackground)
                .padding(padding)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = cardShape,
                    colors = CardDefaults.cardColors(containerColor = cardBg),
                    border = androidx.compose.foundation.BorderStroke(1.dp, cardBorder)
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Aturan Hari", fontWeight = FontWeight.Bold, color = Color.White)
                        Text("Hari efektif: ${if (!isHolidayBySchedule) "Ya" else "Tidak"}", color = Color.White.copy(alpha = 0.9f))
                        Text("Tanggal merah: ${if (!isHolidayByDate) "Tidak" else "Ya"}", color = Color.White.copy(alpha = 0.9f))
                        Text(
                            "Aturan sholat: ${if (nonMuslim) "Tidak berlaku (Non Muslim)" else "Berlaku"}",
                            color = Color.White.copy(alpha = 0.9f)
                        )
                    }
                }

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = cardShape,
                    colors = CardDefaults.cardColors(containerColor = cardBg),
                    border = androidx.compose.foundation.BorderStroke(1.dp, cardBorder)
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Lokasi Musholla", fontWeight = FontWeight.Bold, color = Color.White)
                        Text(
                            "Target: %.6f, %.6f â€¢ Radius %.0fm".format(musholla.lat, musholla.lng, musholla.radiusMeters),
                            color = Color.White.copy(alpha = 0.9f)
                        )
                        Text(
                            text = "Lokasi Anda: " + (coords?.let { "%.6f, %.6f".format(it.first, it.second) } ?: "-"),
                            color = Color.White.copy(alpha = 0.9f)
                        )
                        Text(
                            text = "Jarak: " + (distanceMeters?.let { "%.0fm".format(it) } ?: "-"),
                            color = Color.White.copy(alpha = 0.9f)
                        )

                        Spacer(modifier = Modifier.height(6.dp))
                        Button(
                            onClick = { checkLocation() },
                            enabled = !isChecking,
                            modifier = Modifier.fillMaxWidth().height(52.dp),
                            shape = RoundedCornerShape(18.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color.White.copy(alpha = 0.16f),
                                contentColor = Color.White
                            )
                        ) {
                            if (isChecking) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Default.LocationOn, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Cek Lokasi Sekarang")
                            }
                        }
                    }
                }

                Button(
                    onClick = { submitPrayer() },
                    enabled = canSubmit,
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = RoundedCornerShape(18.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF0B1F33).copy(alpha = 0.55f),
                        contentColor = Color.White,
                        disabledContainerColor = Color(0xFF0B1F33).copy(alpha = 0.25f),
                        disabledContentColor = Color.White.copy(alpha = 0.55f)
                    )
                ) {
                    Text(if (isSubmitting) "Memproses..." else "Presensi Sholat")
                }

                if (!canAttemptByRule) {
                    val reason = when {
                        nonMuslim -> "Presensi sholat tidak berlaku untuk siswa non muslim."
                        isHolidayBySchedule -> "Hari ini non-efektif (jadwal libur)."
                        isHolidayByDate -> "Hari ini libur (tanggal merah)."
                        else -> "Tidak bisa presensi."
                    }
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = cardShape,
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF2A1A1A).copy(alpha = 0.45f)),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFFB4A9).copy(alpha = 0.35f))
                    ) {
                        Text(
                            text = reason,
                            color = Color(0xFFFFB4A9),
                            style = MaterialTheme.typography.bodySmall,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                } else if (!canAttemptByLocation) {
                    Text(
                        if (mockLocationDetected) {
                            "Catatan: lokasi palsu terdeteksi sehingga presensi diblokir."
                        } else {
                            "Catatan: presensi aktif jika berada di area musholla."
                        },
                        color = Color.White.copy(alpha = 0.75f),
                        style = MaterialTheme.typography.bodySmall
                    )
                } else if (!deviceTimeTrusted) {
                    Text(
                        "Catatan: aktifkan tanggal otomatis dan zona waktu otomatis sebelum presensi.",
                        color = Color.White.copy(alpha = 0.75f),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}


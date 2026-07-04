package com.satupintu.mobile.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.preference.PreferenceManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.satupintu.mobile.data.model.Attendance
import com.satupintu.mobile.ui.viewmodel.AttendanceUiState
import com.satupintu.mobile.ui.viewmodel.AttendanceViewModel
import com.satupintu.mobile.util.SecurityUtils
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polygon
import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import com.satupintu.mobile.R
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendanceScreen(
    userNisn: String,
    userUsername: String,
    onNavigateBack: () -> Unit,
    viewModel: AttendanceViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val fusedLocationClient = remember { LocationServices.getFusedLocationProviderClient(context) }
    val scope = rememberCoroutineScope()
    var isLocating by remember { mutableStateOf(false) }
    var verificationLocation by remember { mutableStateOf<android.location.Location?>(null) }

    // Initialize OSM Configuration
    LaunchedEffect(Unit) {
        Configuration.getInstance().load(context, PreferenceManager.getDefaultSharedPreferences(context))
        Configuration.getInstance().userAgentValue = context.packageName
    }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                      permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (granted) {
            // Permission granted
        } else {
            Toast.makeText(context, "Izin lokasi diperlukan untuk absensi", Toast.LENGTH_SHORT).show()
        }
    }

    LaunchedEffect(userNisn, userUsername) {
        viewModel.loadData(userNisn, userUsername)
    }

    // Unified location fetching logic
    val requestLocationAndCheckIn = remember {
        {
            isLocating = true
            Toast.makeText(context, "Memperbarui lokasi...", Toast.LENGTH_SHORT).show()

            val cancellationTokenSource = CancellationTokenSource()
            
            // Force fresh location request (skip lastLocation check for verification refresh)
            if (ActivityCompat.checkSelfPermission(
                    context,
                    Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
            ) {
                fusedLocationClient.getCurrentLocation(
                    Priority.PRIORITY_HIGH_ACCURACY,
                    cancellationTokenSource.token
                ).addOnSuccessListener { currentLocation ->
                    isLocating = false
                    if (currentLocation != null) {
                        verificationLocation = currentLocation
                    } else {
                        Toast.makeText(context, "Gagal mendapatkan lokasi terkini.", Toast.LENGTH_LONG).show()
                    }
                }.addOnFailureListener { e ->
                    isLocating = false
                    Toast.makeText(context, "Gagal: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            } else {
                 isLocating = false
            }

            // Timeout
            scope.launch {
                delay(10000)
                if (isLocating) {
                    cancellationTokenSource.cancel()
                    isLocating = false
                    Toast.makeText(context, "Waktu habis.", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    if (verificationLocation != null && uiState is AttendanceUiState.Success) {
        val state = uiState as AttendanceUiState.Success
        val todayAtt = state.todayAttendance
        val isCheckIn = todayAtt == null || (todayAtt.status != "PRESENT" && todayAtt.status != "LATE")
        
        LocationVerificationScreen(
            userLocation = verificationLocation!!,
            schoolLat = state.schoolLat,
            schoolLng = state.schoolLng,
            schoolRadius = state.schoolRadius,
            isLoading = isLocating,
            buttonLabel = if (isCheckIn) "Absen Datang" else "Absen Pulang",
            onConfirm = {
                val location = verificationLocation!!
                val timeTrusted = SecurityUtils.isAutomaticTimeEnabled(context) &&
                    SecurityUtils.isAutomaticTimeZoneEnabled(context)
                viewModel.checkIn(
                    lat = location.latitude,
                    lng = location.longitude,
                    accuracyMeters = location.accuracy,
                    isMockLocation = SecurityUtils.isMockLocation(location),
                    locationProvider = location.provider,
                    deviceTimeTrusted = timeTrusted
                )
                verificationLocation = null
            },
            onCancel = {
                verificationLocation = null
            },
            onRefresh = {
                requestLocationAndCheckIn()
            }
        )
    } else {
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
                        title = { Text("Absensi Siswa") },
                        navigationIcon = {
                            IconButton(onClick = onNavigateBack) {
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
        ) { paddingValues ->
            Box(modifier = Modifier.padding(paddingValues).fillMaxSize()) {
                when (val state = uiState) {
                    is AttendanceUiState.Loading -> {
                        CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                    }
                    is AttendanceUiState.Error -> {
                        Text(
                            text = state.message,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.align(Alignment.Center)
                        )
                    }
                    is AttendanceUiState.Success -> {
                        AttendanceContent(
                            state = state,
                            isLocating = isLocating,
                            onCheckIn = {
                                if (ActivityCompat.checkSelfPermission(
                                        context,
                                        Manifest.permission.ACCESS_FINE_LOCATION
                                    ) != PackageManager.PERMISSION_GRANTED && ActivityCompat.checkSelfPermission(
                                        context,
                                        Manifest.permission.ACCESS_COARSE_LOCATION
                                    ) != PackageManager.PERMISSION_GRANTED
                                ) {
                                    Toast.makeText(context, "Meminta izin lokasi...", Toast.LENGTH_SHORT).show()
                                    locationPermissionLauncher.launch(arrayOf(
                                        Manifest.permission.ACCESS_FINE_LOCATION,
                                        Manifest.permission.ACCESS_COARSE_LOCATION
                                    ))
                                    return@AttendanceContent
                                }
                                
                                // Trigger unified location request
                                requestLocationAndCheckIn()
                            }
                        )
                    }
                }
                
                // Overlay removed as per user request
            }
        }
    }
}

@Composable
fun LocationVerificationScreen(
    userLocation: android.location.Location,
    schoolLat: Double,
    schoolLng: Double,
    schoolRadius: Double,
    isLoading: Boolean,
    buttonLabel: String,
    onConfirm: () -> Unit,
    onCancel: () -> Unit,
    onRefresh: () -> Unit
) {
    val context = LocalContext.current
    val distance = remember(userLocation.latitude, userLocation.longitude, schoolLat, schoolLng) {
        val results = FloatArray(1)
        android.location.Location.distanceBetween(
            userLocation.latitude, userLocation.longitude,
            schoolLat, schoolLng,
            results
        )
        results[0]
    }
    val isMock = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
        userLocation.isMock
    } else {
        userLocation.isFromMockProvider
    }
    val isWithinRadius = distance <= schoolRadius && !isMock
    
    // Create map view only once
    val mapView = remember {
        MapView(context).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
            controller.setZoom(18.0)
        }
    }

    // Update map markers when location changes
    LaunchedEffect(userLocation, schoolLat, schoolLng, schoolRadius) {
        val userPoint = GeoPoint(userLocation.latitude, userLocation.longitude)
        val schoolPoint = GeoPoint(schoolLat, schoolLng)
        
        mapView.overlays.clear()
        
        // School Marker (Center)
        val schoolMarker = Marker(mapView)
        schoolMarker.position = schoolPoint
        schoolMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
        schoolMarker.title = "Sekolah"
        
        // Use the app launcher icon until the final Satu Pintu school marker is prepared.
        val schoolDrawable = ContextCompat.getDrawable(context, R.mipmap.ic_launcher)
        val bitmap = (schoolDrawable as? BitmapDrawable)?.bitmap
        if (bitmap != null) {
             val scaledBitmap = Bitmap.createScaledBitmap(bitmap, 30, 30, true)
             schoolMarker.icon = BitmapDrawable(context.resources, scaledBitmap)
        }
        
        mapView.overlays.add(schoolMarker)
        
        // User Marker
        val userMarker = Marker(mapView)
        userMarker.position = userPoint
        userMarker.setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
        userMarker.title = "Lokasi Anda"
        // userMarker uses default pin icon
        mapView.overlays.add(userMarker)
        
        // Circle (Polygon approximating a circle)
        val circle = Polygon()
        val circlePoints = ArrayList<GeoPoint>()
        for (i in 0 until 360 step 10) {
            circlePoints.add(schoolPoint.destinationPoint(schoolRadius, i.toDouble()))
        }
        circle.points = circlePoints
        circle.fillPaint.color = android.graphics.Color.parseColor("#4000FF00") // Transparent Green
        circle.outlinePaint.color = android.graphics.Color.GREEN
        circle.outlinePaint.strokeWidth = 2f
        mapView.overlays.add(circle)

        mapView.controller.setCenter(userPoint)
        mapView.invalidate()
    }

    Scaffold(
        topBar = {
            Column(modifier = Modifier.fillMaxWidth().background(Color.White).statusBarsPadding()) {
                if (isLoading) {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                }
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    IconButton(
                        onClick = onCancel,
                        modifier = Modifier
                            .align(Alignment.CenterStart)
                            .padding(start = 8.dp)
                    ) {
                        Icon(
                            Icons.Default.ArrowBack, 
                            contentDescription = "Kembali",
                            tint = Color.Gray
                        )
                    }

                    IconButton(
                        onClick = onRefresh,
                        modifier = Modifier
                            .align(Alignment.CenterEnd)
                            .padding(end = 8.dp)
                    ) {
                        Icon(
                            Icons.Default.Refresh,
                            contentDescription = "Refresh Lokasi",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }

                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(horizontal = 48.dp)
                    ) {
                        Text(
                            "Nama Lokasi: UPTSP SMPN 3 PACET", 
                            style = MaterialTheme.typography.bodyLarge,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (isMock) "LOKASI PALSU TERDETEKSI" else "Jarak: %.1fm (${if (isWithinRadius) "TERPENUHI" else "TIDAK TERPENUHI"})".format(distance),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = if (isWithinRadius) Color(0xFF2E7D32) else Color.Red,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
                Divider()
            }
        },
        bottomBar = {
            Button(
                onClick = onConfirm,
                enabled = isWithinRadius,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 16.dp, end = 16.dp, bottom = 48.dp, top = 16.dp) // Added bottom padding for Home Indicator
                    .height(56.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isWithinRadius) MaterialTheme.colorScheme.primary else Color.Gray
                )
            ) {
                Text(buttonLabel)
            }
        }
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues)) {
            AndroidView(
                factory = { mapView },
                modifier = Modifier.fillMaxSize()
            )
            
            // Zoom Controls (Moved to Right Side to prevent overlap with Button)
            Column(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 16.dp, bottom = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Column(
                    modifier = Modifier
                        .background(Color.White, shape = MaterialTheme.shapes.medium)
                        .border(1.dp, Color.LightGray, MaterialTheme.shapes.medium)
                ) {
                    IconButton(onClick = { mapView.controller.zoomIn() }) {
                        Icon(Icons.Default.Add, contentDescription = "Zoom In")
                    }
                    Divider(modifier = Modifier.width(48.dp), color = Color.LightGray)
                    IconButton(onClick = { mapView.controller.zoomOut() }) {
                        Icon(Icons.Default.Remove, contentDescription = "Zoom Out")
                    }
                }
            }
        }
    }
}

@Composable
fun AttendanceContent(
    state: AttendanceUiState.Success,
    isLocating: Boolean = false,
    onCheckIn: () -> Unit
) {
    val timeFormatter = remember { SimpleDateFormat("HH:mm", Locale.getDefault()) }
    var selectedTabIndex by remember { mutableStateOf(0) }
    val tabs = listOf("Absensi", "Riwayat")
    val pageBackground = remember {
        Brush.verticalGradient(
            colors = listOf(
                Color(0xFF12D6C6),
                Color(0xFF0F7BFF),
                Color(0xFF0F2A43)
            )
        )
    }

    fun formatTime(timestampStr: String): String {
        return try {
            val timestamp = timestampStr.toLong()
            timeFormatter.format(Date(timestamp))
        } catch (e: Exception) {
            timestampStr
        }
    }

    fun translateStatus(status: String): String {
        return when (status.uppercase()) {
            "PRESENT" -> "HADIR"
            "LATE" -> "TERLAMBAT"
            "SICK" -> "SAKIT"
            "PERMIT" -> "IZIN"
            "ABSENT" -> "ALPHA"
            else -> status
        }
    }

    fun parseSchedule(schedule: String): Pair<String, String>? {
        val parts = schedule.split("-").map { it.trim() }.filter { it.isNotEmpty() }
        return if (parts.size >= 2) parts[0] to parts[1] else null
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(pageBackground)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            TabRow(
                selectedTabIndex = selectedTabIndex,
                containerColor = Color.Transparent,
                contentColor = Color.White,
                indicator = { tabPositions ->
                    val currentTab = tabPositions[selectedTabIndex]
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .wrapContentSize(Alignment.BottomStart)
                    ) {
                        Box(
                            modifier = Modifier
                                .offset(x = currentTab.left)
                                .width(currentTab.width)
                                .height(3.dp)
                                .background(Color.White, RoundedCornerShape(999.dp))
                        )
                    }
                }
            ) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTabIndex == index,
                        onClick = { selectedTabIndex = index },
                        selectedContentColor = Color.White,
                        unselectedContentColor = Color.White.copy(alpha = 0.7f),
                        text = { Text(title) }
                    )
                }
            }

            when (selectedTabIndex) {
                0 -> {
                    val schedule = remember(state.todaySchedule) { parseSchedule(state.todaySchedule) }
                    val scheduleIn = schedule?.first ?: state.todaySchedule
                    val scheduleOut = schedule?.second ?: ""

                    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                        Card(
                            modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF0B1F33).copy(alpha = 0.22f)),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.18f))
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    text = "Halo, ${state.studentName}",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = Color.White,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Spacer(modifier = Modifier.height(10.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Surface(
                                        color = Color.White.copy(alpha = 0.14f),
                                        shape = RoundedCornerShape(16.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
                                            Text(
                                                text = "Jadwal Masuk",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = Color.White.copy(alpha = 0.85f)
                                            )
                                            Text(
                                                text = scheduleIn,
                                                style = MaterialTheme.typography.titleMedium,
                                                color = Color.White,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }
                                    }

                                    Surface(
                                        color = Color.White.copy(alpha = 0.14f),
                                        shape = RoundedCornerShape(16.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
                                            Text(
                                                text = "Jadwal Pulang",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = Color.White.copy(alpha = 0.85f)
                                            )
                                            Text(
                                                text = scheduleOut.ifEmpty { "-" },
                                                style = MaterialTheme.typography.titleMedium,
                                                color = Color.White,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(10.dp))

                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        Icons.Default.LocationOn,
                                        contentDescription = null,
                                        tint = Color.White.copy(alpha = 0.9f),
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "Lokasi sekolah terverifikasi",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Color.White.copy(alpha = 0.85f)
                                    )
                                }

                                if (state.isHoliday) {
                                    Text(
                                        text = "Hari ini libur",
                                        color = Color(0xFFFFB4A9),
                                        modifier = Modifier.padding(top = 8.dp)
                                    )
                                }
                            }
                        }

                        if (state.todayAttendance != null) {
                            val isCheckedOut = state.todayAttendance.checkOutTime != null
                            val status = state.todayAttendance.status
                            val isPresentOrLate = status == "PRESENT" || status == "LATE"
                            val statusColor = when {
                                isCheckedOut -> Color(0xFF93C5FD)
                                isPresentOrLate -> Color(0xFF86EFAC)
                                else -> Color(0xFFFDE68A)
                            }

                            Card(
                                modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                                shape = RoundedCornerShape(20.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF0B1F33).copy(alpha = 0.22f)),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.18f))
                            ) {
                                Column(
                                    modifier = Modifier.padding(16.dp).fillMaxWidth(),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Icon(
                                        if (isCheckedOut) Icons.Default.CheckCircle else Icons.Default.LocationOn,
                                        contentDescription = null,
                                        tint = statusColor,
                                        modifier = Modifier.size(46.dp)
                                    )
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Text(
                                        text = if (isCheckedOut) "Absensi Selesai"
                                        else if (isPresentOrLate) "Sudah Absen Masuk"
                                        else "Status: ${translateStatus(status)}",
                                        style = MaterialTheme.typography.titleLarge,
                                        color = Color.White,
                                        textAlign = TextAlign.Center
                                    )
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceEvenly
                                    ) {
                                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                            Text("Masuk", style = MaterialTheme.typography.labelMedium, color = Color.White.copy(alpha = 0.8f))
                                            Text(formatTime(state.todayAttendance.checkInTime), style = MaterialTheme.typography.titleMedium, color = Color.White)
                                        }
                                        if (isCheckedOut) {
                                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text("Pulang", style = MaterialTheme.typography.labelMedium, color = Color.White.copy(alpha = 0.8f))
                                                Text(formatTime(state.todayAttendance.checkOutTime ?: ""), style = MaterialTheme.typography.titleMedium, color = Color.White)
                                            }
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "Status: ${translateStatus(state.todayAttendance.status)}",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = Color.White.copy(alpha = 0.85f)
                                    )
                                }
                            }

                            if (!isCheckedOut) {
                                Button(
                                    onClick = onCheckIn,
                                    modifier = Modifier.fillMaxWidth().height(56.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = Color(0xFF0B1F33).copy(alpha = 0.55f),
                                        contentColor = Color.White
                                    ),
                                    shape = RoundedCornerShape(18.dp),
                                    enabled = !isLocating
                                ) {
                                    if (isLocating) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(24.dp),
                                            color = Color.White,
                                            strokeWidth = 2.dp
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("MENCARI LOKASI...")
                                    } else {
                                        Icon(Icons.Default.LocationOn, contentDescription = null)
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(if (isPresentOrLate) "ABSEN PULANG" else "ABSEN DATANG")
                                    }
                                }
                            }
                        } else if (!state.isHoliday) {
                            Button(
                                onClick = onCheckIn,
                                modifier = Modifier.fillMaxWidth().height(56.dp),
                                enabled = !isLocating,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFF0B1F33).copy(alpha = 0.55f),
                                    contentColor = Color.White
                                ),
                                shape = RoundedCornerShape(18.dp)
                            ) {
                                if (isLocating) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(24.dp),
                                        color = Color.White,
                                        strokeWidth = 2.dp
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("MENCARI LOKASI...")
                                } else {
                                    Icon(Icons.Default.LocationOn, contentDescription = null)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("ABSEN DATANG")
                                }
                            }
                        }
                    }
                }
                1 -> {
                    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                        if (state.monthlySummary == null) {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator(color = Color.White)
                            }
                        } else {
                            val summary = state.monthlySummary
                            val monthYearFormatter = SimpleDateFormat("MMMM yyyy", Locale("id", "ID"))
                            val monthYear = monthYearFormatter.format(Date())
                            val dateFormatter = SimpleDateFormat("dd/MM/yyyy", Locale("id", "ID"))
                            
                            // Total rekap
                            Card(
                                modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                                shape = RoundedCornerShape(18.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF0B1F33).copy(alpha = 0.22f)),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.14f))
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text(
                                        text = "Rekap Bulanan $monthYear",
                                        style = MaterialTheme.typography.titleLarge,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
                                    )
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceEvenly
                                    ) {
                                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                            Text("H", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold, color = Color(0xFF86EFAC))
                                            Text("${summary.totalH}", style = MaterialTheme.typography.titleMedium, color = Color.White)
                                        }
                                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                            Text("S", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold, color = Color(0xFFFDE68A))
                                            Text("${summary.totalS}", style = MaterialTheme.typography.titleMedium, color = Color.White)
                                        }
                                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                            Text("I", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold, color = Color(0xFF93C5FD))
                                            Text("${summary.totalI}", style = MaterialTheme.typography.titleMedium, color = Color.White)
                                        }
                                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                            Text("A", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold, color = Color(0xFFFFB4A9))
                                            Text("${summary.totalA}", style = MaterialTheme.typography.titleMedium, color = Color.White)
                                        }
                                    }
                                }
                            }
                            
                            // Header tabel
                            Card(
                                modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F7BFF))
                            ) {
                                Row(
                                    modifier = Modifier.padding(vertical = 10.dp, horizontal = 8.dp).fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("No", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = Color.White, modifier = Modifier.weight(0.5f))
                                    Text("Hari/Tgl", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = Color.White, modifier = Modifier.weight(1.5f))
                                    Text("Masuk", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = Color.White, modifier = Modifier.weight(1f))
                                    Text("Pulang", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = Color.White, modifier = Modifier.weight(1f))
                                    Text("Ket", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = Color.White, modifier = Modifier.weight(0.8f))
                                }
                            }
                            
                            // Daftar harian
                            LazyColumn(modifier = Modifier.fillMaxSize()) {
                                items(summary.summaries.size) { index ->
                                    val daily = summary.summaries[index]
                                    
                                    // Cari attendance untuk hari ini
                                    val calendar = Calendar.getInstance()
                                    val currentMonth = calendar.get(Calendar.MONTH)
                                    val currentYear = calendar.get(Calendar.YEAR)
                                    calendar.set(Calendar.YEAR, currentYear)
                                    calendar.set(Calendar.MONTH, currentMonth)
                                    calendar.set(Calendar.DAY_OF_MONTH, daily.day)
                                    val targetDate = calendar.timeInMillis
                                    
                                    val attendance = state.history.find {
                                        val attCal = Calendar.getInstance()
                                        attCal.timeInMillis = it.date
                                        attCal.get(Calendar.YEAR) == currentYear &&
                                        attCal.get(Calendar.MONTH) == currentMonth &&
                                        attCal.get(Calendar.DAY_OF_MONTH) == daily.day
                                    }
                                    
                                    val statusColor = when (daily.status) {
                                        "H" -> Color(0xFF86EFAC)
                                        "S" -> Color(0xFFFDE68A)
                                        "I" -> Color(0xFF93C5FD)
                                        "A" -> Color(0xFFFFB4A9)
                                        else -> Color.White.copy(alpha = 0.3f)
                                    }
                                    
                                    val jamMasuk = if (attendance?.checkInTime != null) {
                                        try {
                                            SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(attendance.checkInTime.toLong()))
                                        } catch (e: Exception) {
                                            "-"
                                        }
                                    } else "-"
                                    
                                    val jamPulang = if (attendance?.checkOutTime != null) {
                                        try {
                                            SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(attendance.checkOutTime.toLong()))
                                        } catch (e: Exception) {
                                            "-"
                                        }
                                    } else "-"
                                    
                                    val tglStr = dateFormatter.format(calendar.time)
                                    
                                    Card(
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = CardDefaults.cardColors(containerColor = Color(0xFF0B1F33).copy(alpha = 0.18f)),
                                        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.14f)),
                                        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(vertical = 10.dp, horizontal = 8.dp).fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text("${index + 1}", style = MaterialTheme.typography.bodyMedium, color = Color.White, modifier = Modifier.weight(0.5f))
                                            Text("${daily.dayName}\n$tglStr", style = MaterialTheme.typography.bodyMedium, color = Color.White, modifier = Modifier.weight(1.5f))
                                            Text(jamMasuk, style = MaterialTheme.typography.bodyMedium, color = Color.White, modifier = Modifier.weight(1f))
                                            Text(jamPulang, style = MaterialTheme.typography.bodyMedium, color = Color.White, modifier = Modifier.weight(1f))
                                            Surface(
                                                color = when (daily.status) {
                                                    "H" -> Color(0xFF16A34A).copy(alpha = 0.18f)
                                                    "S" -> Color(0xFFF59E0B).copy(alpha = 0.18f)
                                                    "I" -> Color(0xFF2563EB).copy(alpha = 0.18f)
                                                    "A" -> Color(0xFFEF4444).copy(alpha = 0.18f)
                                                    else -> Color.Transparent
                                                },
                                                shape = RoundedCornerShape(6.dp)
                                            ) {
                                                Text(
                                                    text = if (daily.status == "-") "-" else daily.status,
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                                    color = statusColor,
                                                    style = MaterialTheme.typography.labelMedium,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AttendanceItem(
    attendance: Attendance,
    formatTime: (String) -> String,
    translateStatus: (String) -> String,
) {
    val dateStr = SimpleDateFormat("dd MMM yyyy", Locale("id", "ID")).format(Date(attendance.date))
    
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0B1F33).copy(alpha = 0.18f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.14f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier.padding(8.dp).fillMaxWidth(), // Reduced padding to fit button
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f).padding(start = 8.dp)) {
                Text(
                    dateStr,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    formatTime(attendance.checkInTime),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.85f)
                )
            }
            
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    color = when(attendance.status) {
                        "PRESENT" -> Color(0xFF16A34A).copy(alpha = 0.18f)
                        "LATE" -> Color(0xFFF59E0B).copy(alpha = 0.18f)
                        else -> Color(0xFFEF4444).copy(alpha = 0.18f)
                    },
                    shape = RoundedCornerShape(999.dp)
                ) {
                    Text(
                        text = translateStatus(attendance.status),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        color = when(attendance.status) {
                            "PRESENT" -> Color(0xFF86EFAC)
                            "LATE" -> Color(0xFFFDE68A)
                            else -> Color(0xFFFFB4A9)
                        },
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}


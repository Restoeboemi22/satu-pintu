package com.satupintu.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.satupintu.mobile.data.model.User
import com.satupintu.mobile.utils.SharedPreferencesManager

@Composable
fun ProfileScreen(onLogout: () -> Unit, onBack: () -> Unit) {
    val context = LocalContext.current
    val sharedPreferencesManager = remember { SharedPreferencesManager(context) }
    var user by remember { mutableStateOf<User?>(null) }

    LaunchedEffect(Unit) {
        user = sharedPreferencesManager.getUser()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF9FAFB)) // Light gray background
            .verticalScroll(rememberScrollState())
    ) {
        // Header
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(bottomStart = 30.dp, bottomEnd = 30.dp))
                .background(Color(0xFF2563EB)) // Blue
                .padding(vertical = 30.dp),
            contentAlignment = Alignment.Center
        ) {
            // Back Button
            IconButton(
                onClick = onBack,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(start = 16.dp, top = 16.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.ArrowBack,
                    contentDescription = "Back",
                    tint = Color.White
                )
            }

            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Avatar Container
                Box(
                    modifier = Modifier
                        .size(100.dp)
                        .clip(CircleShape)
                        .background(Color(255, 255, 255, 51)) // rgba(255,255,255,0.2)
                        .border(3.dp, Color(255, 255, 255, 128), CircleShape) // rgba(255,255,255,0.5)
                        .padding(20.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = "Profile",
                        tint = Color.White,
                        modifier = Modifier.fillMaxSize()
                    )
                }
                Spacer(modifier = Modifier.height(15.dp))
                
                Text(
                    text = user?.fullName ?: "Siswa",
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(5.dp))
                
                Text(
                    text = user?.className?.takeIf { it.isNotBlank() } ?: "-",
                    color = Color(0xFFBFDBFE),
                    fontSize = 16.sp
                )
                Spacer(modifier = Modifier.height(5.dp))
                
                Text(
                    text = "NISN: ${user?.username ?: "-"}", // Assuming username is NISN
                    color = Color(0xFF93C5FD),
                    fontSize = 14.sp
                )
            }
        }

        // Informasi Pribadi Section
        ProfileSection(title = "Informasi Pribadi") {
            ProfileItem(
                icon = Icons.Default.Email,
                label = "Email",
                value = user?.email ?: "-"
            )
            Divider(color = Color(0xFFF3F4F6))
            ProfileItem(
                icon = Icons.Default.Phone,
                label = "No. Telepon",
                value = "+62 812-3456-7890" // Placeholder
            )
            Divider(color = Color(0xFFF3F4F6))
            ProfileItem(
                icon = Icons.Default.LocationOn,
                label = "Alamat",
                value = "Jl. Pendidikan No. 1, Pacet" // Placeholder
            )
        }

        // Keamanan Akun Section
        ProfileSection(title = "Keamanan Akun") {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { /* Handle change password */ }
                    .padding(vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .background(Color(0xFFF3F4F6), RoundedCornerShape(8.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = null,
                        tint = Color(0xFF6B7280),
                        modifier = Modifier.size(20.dp)
                    )
                }
                Spacer(modifier = Modifier.width(15.dp))
                Text(
                    text = "Ubah Password",
                    modifier = Modifier.weight(1f),
                    color = Color(0xFF374151),
                    fontWeight = FontWeight.Medium
                )
                Icon(
                    imageVector = Icons.Default.ArrowForward,
                    contentDescription = null,
                    tint = Color(0xFFD1D5DB)
                )
            }
        }

        // Footer
        Column(
            modifier = Modifier
                .padding(20.dp)
                .fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Button(
                onClick = onLogout,
                colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(vertical = 12.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.ExitToApp,
                        contentDescription = null,
                        tint = Color(0xFFEF4444)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Keluar Aplikasi",
                        color = Color(0xFFEF4444),
                        fontWeight = FontWeight.Bold
                    )
                }
            }
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = "Versi Aplikasi 1.0.0 (Beta)",
                color = Color(0xFF9CA3AF),
                fontSize = 12.sp
            )
        }
        
        // Add some bottom padding for navigation bar
        Spacer(modifier = Modifier.height(20.dp))
    }
}

@Composable
fun ProfileSection(
    title: String,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier = Modifier
            .padding(top = 20.dp, start = 20.dp, end = 20.dp)
            .fillMaxWidth()
            .background(Color.White, RoundedCornerShape(15.dp))
            .padding(20.dp)
    ) {
        Text(
            text = title,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF1F2937),
            modifier = Modifier.padding(bottom = 15.dp)
        )
        content()
    }
}

@Composable
fun ProfileItem(
    icon: ImageVector,
    label: String,
    value: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .background(Color(0xFFF3F4F6), RoundedCornerShape(8.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = Color(0xFF6B7280),
                modifier = Modifier.size(20.dp)
            )
        }
        Spacer(modifier = Modifier.width(15.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                fontSize = 12.sp,
                color = Color(0xFF6B7280),
                modifier = Modifier.padding(bottom = 2.dp)
            )
            Text(
                text = value,
                fontSize = 14.sp,
                color = Color(0xFF374151),
                fontWeight = FontWeight.Medium
            )
        }
    }
}


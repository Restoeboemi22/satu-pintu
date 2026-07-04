package com.satupintu.mobile.data.model

data class BullyingReport(
    val id: String = "",
    val reporterId: String? = null,
    val reporterName: String? = null,
    val schoolId: String = "",
    val isAnonymous: Boolean = false,
    val victimId: String? = null,
    val victimName: String? = null,
    val perpetratorId: String? = null,
    val perpetratorName: String? = null,
    val incidentDate: Long = 0,
    val incidentLocation: String? = null,
    val incidentType: String = "OTHER", // VERBAL, PHYSICAL, CYBER, SOCIAL, SEXUAL, OTHER (for BULLYING) or BRAWL, ACCIDENT, LOST, DAMAGE (for INCIDENT)
    val category: String = "BULLYING", // BULLYING, INCIDENT
    val description: String? = null,
    val evidence: String? = null,
    val status: String = "PENDING", // PENDING, INVESTIGATING, RESOLVED, CLOSED
    val priority: String = "MEDIUM", // LOW, MEDIUM, HIGH, CRITICAL
    val assignedTo: String? = null,
    val resolutionNotes: String? = null,
    val resolvedAt: Long? = null,
    val createdAt: Long = 0,
    val updatedAt: Long = 0
)


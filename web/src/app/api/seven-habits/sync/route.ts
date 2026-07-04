import { NextRequest, NextResponse } from "next/server";

// In a real app, this would be a database call.
// Since we are using Zustand (client-side state), this API route 
// acts as a contract/interface definition for the Android developer.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { logs, studentId } = body;

    // Validation: Ensure body matches Android format
    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json(
        { success: false, message: "Invalid data format. 'logs' array required." },
        { status: 400 }
      );
    }

    console.log(`Received ${logs.length} habit logs from student ${studentId}`);

    // Simulation: In a real backend, we would upsert these logs into the database.
    // example: await db.habitLogs.createMany({ data: logs });

    return NextResponse.json({
      success: true,
      message: "Data synced successfully",
      syncedCount: logs.length
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Server error during sync" },
      { status: 500 }
    );
  }
}

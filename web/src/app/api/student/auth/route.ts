import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  void req;
  return NextResponse.json(
    {
      success: false,
      message:
        "Route ini sudah dinonaktifkan. Gunakan /api/portal/session untuk sesi web teacher/student dan route backend portal lain yang terautentikasi.",
    },
    { status: 410 }
  );
}

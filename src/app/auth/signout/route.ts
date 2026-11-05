import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";

export async function POST(request: NextRequest) {
  if (supabaseConfigured) await (await createClient()).auth.signOut();
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), { status: 303 });
}

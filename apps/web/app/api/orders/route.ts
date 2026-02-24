// This is a Next.js API route - kept for compatibility
// The actual API is in apps/api

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ message: 'Use /agency/orders instead' }, { status: 404 });
}










import { NextResponse } from 'next/server';
import { seedDatabase } from '@/lib/db';

export async function POST() {
  try {
    seedDatabase();
    return NextResponse.json({ success: true, message: 'Database reset and re-seeded with demo data.' });
  } catch (error: any) {
    console.error('Error resetting database:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

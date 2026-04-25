import { NextResponse } from 'next/server';
import { processingManager } from '@/lib/utils/ProcessingManager';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const retried = processingManager.retryJob(jobId);
    if (!retried) {
      return NextResponse.json({ error: 'Job not found or cannot be retried' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Job retry initiated' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to retry job' }, { status: 500 });
  }
}

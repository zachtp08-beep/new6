import { NextResponse } from 'next/server';
import { processingManager } from '@/lib/utils/ProcessingManager';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter');
    const limit = parseInt(searchParams.get('limit') || '100');

    let jobs;
    if (filter === 'completed') {
      jobs = processingManager.getCompletedJobs();
    } else if (filter === 'failed') {
      jobs = processingManager.getFailedJobs();
    } else if (filter === 'processing') {
      jobs = processingManager.getProcessingJobs();
    } else if (filter === 'pending') {
      jobs = processingManager.getPendingJobs();
    } else {
      jobs = processingManager.getAllJobs();
    }

    const history = processingManager.getHistory(limit);

    return NextResponse.json({ 
      success: true, 
      jobs: jobs.slice(-limit),
      history,
      stats: {
        total: jobs.length,
        completed: processingManager.getCompletedJobs().length,
        failed: processingManager.getFailedJobs().length,
        processing: processingManager.getProcessingJobs().length,
        pending: processingManager.getPendingJobs().length
      }
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}

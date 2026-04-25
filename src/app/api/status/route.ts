import { NextResponse } from 'next/server';
import { processingManager } from '@/lib/utils/ProcessingManager';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  try {
    const queueStats = processingManager.getQueueStats();
    const allJobs = processingManager.getAllJobs();
    const processingJobs = processingManager.getProcessingJobs();
    const completedJobs = processingManager.getCompletedJobs();
    const failedJobs = processingManager.getFailedJobs();
    const pendingJobs = processingManager.getPendingJobs();

    return NextResponse.json({
      success: true,
      stats: {
        queue: queueStats,
        jobs: {
          total: allJobs.length,
          processing: processingJobs.length,
          completed: completedJobs.length,
          failed: failedJobs.length,
          pending: pendingJobs.length
        }
      }
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}

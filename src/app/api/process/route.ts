import { NextResponse } from 'next/server';
import { processingManager } from '@/lib/utils/ProcessingManager';
import { VideoOperation } from '@/types';
import { createVideoJobSchema } from '@/lib/validation/schemas';
import fs from 'fs-extra';

export const runtime = 'nodejs';
export const maxDuration = 600;

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    
    const validationResult = createVideoJobSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid request body', 
        details: validationResult.error.errors 
      }, { status: 400 });
    }

    const { inputPath, operations, batchId } = validationResult.data;

    if (!(await fs.pathExists(inputPath))) {
      return NextResponse.json({ error: 'Input file not found' }, { status: 404 });
    }

    const result = await processingManager.processVideo(inputPath, operations as VideoOperation[]);

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        jobId: result.jobId,
        outputPath: result.outputPath,
        duration: result.duration,
        size: result.size
      }, { status: 200 });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Process error:', error);
    return NextResponse.json({ error: 'Processing failed', details: (error as Error).message }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (jobId) {
      const job = processingManager.getJob(jobId);
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, job }, { status: 200 });
    }

    const allJobs = processingManager.getAllJobs();
    return NextResponse.json({ 
      success: true, 
      jobs: allJobs,
      stats: processingManager.getQueueStats(),
      history: processingManager.getHistory(limit)
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const cancelled = await processingManager.cancelJob(jobId);
    if (!cancelled) {
      return NextResponse.json({ error: 'Job not found or already completed' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Job cancelled' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 });
  }
}

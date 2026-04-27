import { NextResponse } from 'next/server';
import { processingManager } from '@/lib/utils/ProcessingManager';
import { VideoOperation } from '@/types';
import { createBatchJobSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    
    const validationResult = createBatchJobSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ 
        error: 'Invalid request body', 
        details: validationResult.error.errors 
      }, { status: 400 });
    }

    const { name, videoJobs } = validationResult.data;

    const batchJob = await processingManager.createBatchJob(name, videoJobs);

    for (const videoJob of videoJobs) {
      const { inputPath, operations, filename } = videoJob;
      if (inputPath && Array.isArray(operations)) {
        await processingManager.createVideoJob(filename || 'video', inputPath, operations as VideoOperation[]);
      }
    }

    await processingManager.processBatchJob(batchJob.id);

    return NextResponse.json({ 
      success: true, 
      batchId: batchJob.id,
      batchJob 
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Batch creation failed', details: (error as Error).message }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const batches = processingManager.getAllBatchJobs();
    return NextResponse.json({ success: true, batches }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 });
  }
}

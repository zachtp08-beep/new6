import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { fileStorage } from '@/lib/storage/FileStorage';
import { processingManager } from '@/lib/utils/ProcessingManager';
import { VideoOperation } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const secondaryFile = formData.get('secondaryFile') as File;
    const operationsStr = formData.get('operations') as string;
    const batchId = formData.get('batchId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const originalName = file.name;
    const mimeType = file.type;

    const storedFile = await fileStorage.saveUploadedFile(buffer, originalName, mimeType);

    let storedSecondaryFile = null;
    if (secondaryFile) {
      const secondaryBytes = await secondaryFile.arrayBuffer();
      const secondaryBuffer = Buffer.from(secondaryBytes);
      storedSecondaryFile = await fileStorage.saveUploadedFile(
        secondaryBuffer,
        secondaryFile.name,
        secondaryFile.type
      );
    }

    let operations: VideoOperation[] = [];
    if (operationsStr) {
      try {
        operations = JSON.parse(operationsStr);
        if (storedSecondaryFile) {
          operations = operations.map((op: VideoOperation) => {
            if (op.type === 'split-screen') {
              return {
                ...op,
                params: {
                  ...op.params,
                  secondaryVideo: storedSecondaryFile.path
                }
              };
            }
            return op;
          });
        }
      } catch (err) {
        return NextResponse.json({ error: 'Invalid operations JSON' }, { status: 400 });
      }
    }

    let response: any = {
      success: true,
      file: storedFile
    };

    if (storedSecondaryFile) {
      response.secondaryFile = storedSecondaryFile;
    }

    if (operations.length > 0) {
      const result = await processingManager.processVideo(storedFile.path, operations);
      response.jobId = result.jobId;
      response.status = result.success ? 'completed' : 'failed';
      if (!result.success) {
        response.error = result.error;
      }
    }

    if (batchId) {
      response.batchId = batchId;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed', details: (error as Error).message }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'uploads';

    const files = await fileStorage.listFiles(type as 'uploads' | 'processed' | 'temp');
    return NextResponse.json({ success: true, files }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}

import { VideoJob, BatchJob, ProcessingJob, ProcessingProgress, JobStatus, BatchStatus, VideoOperation } from '@/types';
import { ffmpegProcessor } from '@/lib/ffmpeg/FFmpegProcessor';
import { fileStorage } from '@/lib/storage/FileStorage';
import { videoWebSocketServer } from '@/lib/websocket/VideoWebSocketServer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs-extra';

export interface ProcessingResult {
  success: boolean;
  jobId: string;
  outputPath?: string;
  error?: string;
  duration?: number;
  size?: number;
}

export class ProcessingManager {
  private videoJobs: Map<string, VideoJob> = new Map();
  private batchJobs: Map<string, BatchJob> = new Map();
  private processingHistory: VideoJob[] = [];
  private queue: any;

  constructor(queue?: any) {
    this.queue = queue;
    this.setupQueueListeners();
  }

  private setupQueueListeners(): void {
    if (!this.queue) return;
    
    this.queue.on('jobStarted', (job: any) => {
      const videoJob = this.videoJobs.get(job.id);
      if (videoJob) {
        videoJob.status = 'processing';
        this.broadcastJobUpdate(job.id, videoJob);
      }
    });

    this.queue.on('progress', (progress: any) => {
      this.broadcastProgress(progress);
      const videoJob = this.videoJobs.get(progress.jobId);
      if (videoJob) {
        videoJob.progress = progress.progress;
        videoJob.currentOperation = progress.stage;
      }
    });

    this.queue.on('jobCompleted', (job: any) => {
      const videoJob = this.videoJobs.get(job.id);
      if (videoJob) {
        videoJob.status = 'completed';
        videoJob.progress = 100;
        videoJob.currentOperation = undefined;
        this.processingHistory.push(videoJob);
        this.broadcastJobUpdate(job.id, videoJob);
        this.updateBatchJob(videoJob.id, 'completed');
      }
    });

    this.queue.on('jobFailed', (job: any, error: any) => {
      const videoJob = this.videoJobs.get(job.id);
      if (videoJob) {
        videoJob.status = 'failed';
        videoJob.error = error.message;
        videoJob.progress = 0;
        this.broadcastJobFailed(job.id, error);
        this.updateBatchJob(videoJob.id, 'failed');
      }
    });

    this.queue.on('queueEmpty', () => {
      this.broadcastQueueStatus();
    });
  }

  public async createVideoJob(originalFilename: string, inputPath: string, operations: VideoOperation[]): Promise<VideoJob> {
    const id = uuidv4();
    let originalSize = 0;
    let actualInputPath = inputPath;

    try {
      if (await fs.pathExists(inputPath)) {
        const stats = await fs.stat(inputPath);
        originalSize = stats.size;
        actualInputPath = inputPath;
      }
    } catch (err) {
      // File might not exist yet
    }

    const videoJob: VideoJob = {
      id,
      originalFilename,
      uploadedAt: new Date(),
      status: 'pending',
      progress: 0,
      operations,
      originalSize,
      estimatedTimeRemaining: operations.length * 30
    };

    this.videoJobs.set(id, videoJob);

    const processingJob: ProcessingJob = {
      id,
      inputPath: actualInputPath,
      outputPath: this.generateOutputPath(originalFilename, id),
      operations,
      priority: 0,
      retries: 0,
      maxRetries: 3,
      createdAt: new Date()
    };

    if (this.queue) {
      this.queue.addJob(processingJob);
    }
    this.broadcastJobUpdate(id, videoJob);

    return videoJob;
  }

  public async createBatchJob(name: string, videoIds: string[]): Promise<BatchJob> {
    const batchJob: BatchJob = {
      id: uuidv4(),
      name,
      videoIds,
      createdAt: new Date(),
      status: 'pending',
      totalVideos: videoIds.length,
      completedVideos: 0,
      failedVideos: 0
    };

    this.batchJobs.set(batchJob.id, batchJob);
    return batchJob;
  }

  public async processBatchJob(batchId: string): Promise<void> {
    const batchJob = this.batchJobs.get(batchId);
    if (!batchJob) {
      throw new Error(`Batch job not found: ${batchId}`);
    }

    batchJob.status = 'processing';

    for (const videoId of batchJob.videoIds) {
      const videoJob = this.videoJobs.get(videoId);
      if (videoJob && videoJob.status === 'pending') {
        const processingJob = this.queue ? this.queue.getJob(videoId) : undefined;
        if (!processingJob && this.queue) {
          const job: ProcessingJob = {
            id: videoId,
            inputPath: videoJob.operations[0]?.params?.inputPath || '',
            outputPath: this.generateOutputPath(videoJob.originalFilename, videoId),
            operations: videoJob.operations,
            priority: 0,
            retries: 0,
            maxRetries: 3,
            createdAt: new Date()
          };
          this.queue.addJob(job);
        }
      }
    }
  }

  public async processVideo(inputPath: string, operations: VideoOperation[]): Promise<ProcessingResult> {
    const id = uuidv4();
    const outputPath = this.generateOutputPath('processed', id);

    try {
      const result = await ffmpegProcessor.process({
        inputPath,
        outputPath,
        operations
      });

      const videoJob: VideoJob = {
        id,
        originalFilename: 'processed',
        uploadedAt: new Date(),
        status: 'completed',
        progress: 100,
        operations,
        outputPath,
        duration: result.duration,
        processedSize: result.size
      };

      this.videoJobs.set(id, videoJob);
      this.processingHistory.push(videoJob);

      return {
        success: true,
        jobId: id,
        outputPath: result.outputPath,
        duration: result.duration,
        size: result.size
      };
    } catch (error) {
      return {
        success: false,
        jobId: id,
        error: (error as Error).message
      };
    }
  }

  public async cancelJob(jobId: string): Promise<boolean> {
    const videoJob = this.videoJobs.get(jobId);
    if (!videoJob) {
      return false;
    }

    videoJob.status = 'cancelled';
    if (this.queue) {
      this.queue.removeJob(jobId);
    }
    this.broadcastJobUpdate(jobId, videoJob);
    return true;
  }

  public retryJob(jobId: string): boolean {
    const videoJob = this.videoJobs.get(jobId);
    if (!videoJob || videoJob.status !== 'failed') {
      return false;
    }

    videoJob.status = 'pending';
    videoJob.progress = 0;
    videoJob.error = undefined;

    const processingJob: ProcessingJob = {
      id: jobId,
      inputPath: videoJob.operations[0]?.params?.inputPath || '',
      outputPath: this.generateOutputPath(videoJob.originalFilename, jobId),
      operations: videoJob.operations,
      priority: 0,
      retries: 0,
      maxRetries: 3,
      createdAt: new Date()
    };

    if (this.queue) {
      this.queue.addJob(processingJob);
    }
    this.broadcastJobUpdate(jobId, videoJob);
    return true;
  }

  public getJob(jobId: string): VideoJob | undefined {
    return this.videoJobs.get(jobId);
  }

  public getAllJobs(): VideoJob[] {
    return Array.from(this.videoJobs.values());
  }

  public getProcessingJobs(): VideoJob[] {
    return Array.from(this.videoJobs.values()).filter(j => j.status === 'processing');
  }

  public getCompletedJobs(): VideoJob[] {
    return Array.from(this.videoJobs.values()).filter(j => j.status === 'completed');
  }

  public getFailedJobs(): VideoJob[] {
    return Array.from(this.videoJobs.values()).filter(j => j.status === 'failed');
  }

  public getPendingJobs(): VideoJob[] {
    return Array.from(this.videoJobs.values()).filter(j => j.status === 'pending');
  }

  public getBatchJob(batchId: string): BatchJob | undefined {
    return this.batchJobs.get(batchId);
  }

  public getAllBatchJobs(): BatchJob[] {
    return Array.from(this.batchJobs.values());
  }

  public getHistory(limit: number = 50): VideoJob[] {
    return this.processingHistory.slice(-limit);
  }

  public getQueueStats() {
    if (!this.queue) return { pending: 0, active: 0, completed: 0, failed: 0, maxConcurrent: 0 };
    return this.queue.getQueueStats();
  }

  private updateBatchJob(videoId: string, status: 'completed' | 'failed'): void {
    for (const [batchId, batchJob] of this.batchJobs) {
      if (batchJob.videoIds.includes(videoId)) {
        if (status === 'completed') {
          batchJob.completedVideos++;
        } else {
          batchJob.failedVideos++;
        }

        const completed = batchJob.completedVideos + batchJob.failedVideos;
        if (completed >= batchJob.totalVideos) {
          batchJob.status = batchJob.failedVideos > 0 ? 'failed' : 'completed';
          batchJob.completedAt = new Date();
        }

        this.broadcastBatchUpdate(batchId, batchJob);
        break;
      }
    }
  }

  private generateOutputPath(originalName: string, jobId: string): string {
    const outputDir = fileStorage.getProcessedDir();
    const baseName = path.parse(originalName).name;
    return path.join(outputDir, `${baseName}_processed_${jobId}.mp4`);
  }

  private broadcastProgress(progress: ProcessingProgress): void {
    if (videoWebSocketServer) {
      videoWebSocketServer.broadcastProgress(progress);
    }
  }

  private broadcastJobUpdate(jobId: string, job: VideoJob): void {
    if (videoWebSocketServer) {
      videoWebSocketServer.broadcastJobUpdate(jobId, job);
    }
  }

  private broadcastJobFailed(jobId: string, error: any): void {
    if (videoWebSocketServer) {
      videoWebSocketServer.broadcastJobFailed(jobId, error);
    }
  }

  private broadcastBatchUpdate(batchId: string, batch: BatchJob): void {
    if (videoWebSocketServer) {
      videoWebSocketServer.broadcastJobUpdate(batchId, batch);
    }
  }

  private broadcastQueueStatus(): void {
    if (videoWebSocketServer) {
      videoWebSocketServer.broadcastJobUpdate('queue', this.getQueueStats());
    }
  }
}

export const processingManager = new ProcessingManager();
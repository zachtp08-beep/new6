import { VideoJob, ProcessingJob, ProcessingProgress, JobStatus } from '@/types';
import EventEmitter from 'events';

interface QueueOptions {
  maxConcurrent: number;
  retryAttempts: number;
}

export class JobQueue extends EventEmitter {
  private queue: ProcessingJob[] = [];
  private activeJobs: Map<string, ProcessingJob> = new Map();
  private completedJobs: ProcessingJob[] = [];
  private failedJobs: ProcessingJob[] = [];
  private maxConcurrent: number;
  private retryAttempts: number;
  private processing: boolean = false;

  constructor(options: Partial<QueueOptions> = {}) {
    super();
    this.maxConcurrent = options.maxConcurrent || 2;
    this.retryAttempts = options.retryAttempts || 3;
  }

  addJob(job: ProcessingJob): void {
    if (job.retries === undefined) job.retries = 0;
    if (job.maxRetries === undefined) job.maxRetries = this.retryAttempts;
    if (job.priority === undefined) job.priority = 0;
    
    this.queue.push(job);
    this.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    this.emit('jobAdded', job);
    this.process();
  }

  removeJob(jobId: string): boolean {
    const index = this.queue.findIndex(j => j.id === jobId);
    if (index > -1) {
      this.queue.splice(index, 1);
      this.emit('jobRemoved', jobId);
      return true;
    }
    
    if (this.activeJobs.has(jobId)) {
      this.activeJobs.delete(jobId);
      this.emit('jobCancelled', jobId);
      return true;
    }
    
    return false;
  }

  async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.activeJobs.size < this.maxConcurrent && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      this.activeJobs.set(job.id, job);
      job.startedAt = new Date();
      
      this.emit('jobStarted', job);
      this.emit('progress', {
        jobId: job.id,
        progress: 0,
        stage: 'started',
        message: 'Processing started'
      });

      this.executeJob(job).catch(err => {
        this.handleJobError(job, err);
      });
    }

    if (this.queue.length === 0 && this.activeJobs.size === 0) {
      this.processing = false;
      this.emit('queueEmpty');
    }
  }

  private async executeJob(job: ProcessingJob): Promise<void> {
    try {
      for (let i = 0; i < job.operations.length; i++) {
        const op = job.operations[i];
        const progress = ((i / job.operations.length) + (1 / job.operations.length * 0.5)) * 100;
        
        this.emit('progress', {
          jobId: job.id,
          progress,
          stage: `operation_${i + 1}`,
          message: `Executing ${op.type}: ${JSON.stringify(op.params)}`
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      job.completedAt = new Date();
      this.activeJobs.delete(job.id);
      this.completedJobs.push(job);
      
      this.emit('jobCompleted', job);
      this.emit('progress', {
        jobId: job.id,
        progress: 100,
        stage: 'completed',
        message: 'Processing completed successfully'
      });
      
      this.process();
    } catch (error) {
      this.handleJobError(job, error);
    }
  }

  private handleJobError(job: ProcessingJob, error: any): void {
    job.retries++;
    
    if (job.retries < job.maxRetries) {
      this.emit('progress', {
        jobId: job.id,
        progress: 0,
        stage: 'retrying',
        message: `Retry ${job.retries}/${job.maxRetries}`
      });
      
      this.queue.unshift(job);
      this.activeJobs.delete(job.id);
      this.process();
    } else {
      job.completedAt = new Date();
      this.activeJobs.delete(job.id);
      this.failedJobs.push(job);
      
      this.emit('jobFailed', job, error);
      this.emit('progress', {
        jobId: job.id,
        progress: 0,
        stage: 'failed',
        message: `Failed after ${job.maxRetries} attempts: ${error.message}`
      });
      
      this.process();
    }
  }

  getActiveJobs(): ProcessingJob[] {
    return Array.from(this.activeJobs.values());
  }

  getPendingJobs(): ProcessingJob[] {
    return [...this.queue];
  }

  getCompletedJobs(): ProcessingJob[] {
    return [...this.completedJobs];
  }

  getFailedJobs(): ProcessingJob[] {
    return [...this.failedJobs];
  }

  getJob(jobId: string): ProcessingJob | undefined {
    return this.activeJobs.get(jobId) || this.queue.find(j => j.id === jobId);
  }

  getQueueStats() {
    return {
      pending: this.queue.length,
      active: this.activeJobs.size,
      completed: this.completedJobs.length,
      failed: this.failedJobs.length,
      maxConcurrent: this.maxConcurrent
    };
  }

  clear(): void {
    this.queue = [];
    this.activeJobs.clear();
    this.completedJobs = [];
    this.failedJobs = [];
    this.emit('cleared');
  }
}

export const globalQueue = new JobQueue({ maxConcurrent: 2, retryAttempts: 2 });
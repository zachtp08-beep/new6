export interface VideoJob {
  id: string;
  originalFilename: string;
  uploadedAt: Date;
  status: JobStatus;
  progress: number;
  operations: VideoOperation[];
  currentOperation?: string;
  outputPath?: string;
  error?: string;
  originalSize?: number;
  processedSize?: number;
  duration?: number;
  estimatedTimeRemaining?: number;
}

export interface BatchJob {
  id: string;
  name: string;
  videoIds: string[];
  createdAt: Date;
  completedAt?: Date;
  status: BatchStatus;
  totalVideos: number;
  completedVideos: number;
  failedVideos: number;
}

export interface VideoOperation {
  type: OperationType;
  params: ClipConfig | SubtitleConfig | AspectRatioConfig | SplitScreenConfig | CompressConfig | MergeConfig;
  completed?: boolean;
}

export type OperationType =
  | 'clip'
  | 'subtitles'
  | 'aspect-ratio'
  | 'split-screen'
  | 'compress'
  | 'merge';

export type JobStatus =
  | 'pending'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type BatchStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface ProcessingProgress {
  jobId: string;
  progress: number;
  stage: string;
  message?: string;
  elapsedTime?: number;
  estimatedTimeRemaining?: number;
}

export interface SubtitleConfig {
  language: string;
  fontSize?: number;
  fontColor?: string;
  backgroundColor?: string;
  position?: 'bottom' | 'top' | 'center';
}

export interface ClipConfig {
  clipDuration: number;
  overlap?: number;
  format?: 'mp4' | 'webm' | 'mov';
  startTime?: number;
  endTime?: number;
}

export interface AspectRatioConfig {
  ratio: '9:16' | '16:9' | '1:1' | '4:5' | '4:3';
  background?: string;
  padding?: 'blur' | 'solid' | 'none';
}

export interface SplitScreenConfig {
  secondaryVideo: string;
  layout: 'horizontal' | 'vertical' | 'overlay';
  position?: 'left' | 'right' | 'top' | 'bottom';
  ratio?: number;
}

export interface CompressConfig {
  bitrate?: string;
  crf?: number;
  preset?: 'ultrafast' | 'fast' | 'medium' | 'slow' | 'veryslow';
  codec?: 'libx264' | 'libx265' | 'libvpx-vp9';
}

export interface MergeConfig {
  videos: string[];
  transition?: 'none' | 'fade' | 'wipe';
  transitionDuration?: number;
}

export interface ProcessingJob {
  id: string;
  inputPath: string;
  outputPath: string;
  operations: VideoOperation[];
  priority: number;
  retries: number;
  maxRetries: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

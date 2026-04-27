import { z } from 'zod';

export const clipConfigSchema = z.object({
  clipDuration: z.number().positive(),
  overlap: z.number().optional(),
  format: z.enum(['mp4', 'webm', 'mov']).optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
});

export const subtitleConfigSchema = z.object({
  language: z.string(),
  fontSize: z.number().optional(),
  fontColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  position: z.enum(['bottom', 'top', 'center']).optional(),
});

export const aspectRatioConfigSchema = z.object({
  ratio: z.enum(['9:16', '16:9', '1:1', '4:5', '4:3']),
  background: z.string().optional(),
  padding: z.enum(['blur', 'solid', 'none']).optional(),
});

export const splitScreenConfigSchema = z.object({
  secondaryVideo: z.string(),
  layout: z.enum(['horizontal', 'vertical', 'overlay']),
  position: z.enum(['left', 'right', 'top', 'bottom']).optional(),
  ratio: z.number().optional(),
});

export const compressConfigSchema = z.object({
  bitrate: z.string().optional(),
  crf: z.number().min(0).max(51).optional(),
  preset: z.enum(['ultrafast', 'fast', 'medium', 'slow', 'veryslow']).optional(),
  codec: z.enum(['libx264', 'libx265', 'libvpx-vp9']).optional(),
});

export const mergeConfigSchema = z.object({
  videos: z.array(z.string()).min(2),
  transition: z.enum(['none', 'fade', 'wipe']).optional(),
  transitionDuration: z.number().optional(),
});

export const videoOperationSchema = z.object({
  type: z.enum(['clip', 'subtitles', 'aspect-ratio', 'split-screen', 'compress', 'merge']),
  params: z.union([
    clipConfigSchema,
    subtitleConfigSchema,
    aspectRatioConfigSchema,
    splitScreenConfigSchema,
    compressConfigSchema,
    mergeConfigSchema,
  ]),
  completed: z.boolean().optional(),
});

export const createVideoJobSchema = z.object({
  inputPath: z.string(),
  operations: z.array(videoOperationSchema).min(1),
  batchId: z.string().optional(),
});

export const createBatchJobSchema = z.object({
  name: z.string().min(1),
  videoJobs: z.array(z.object({
    inputPath: z.string(),
    operations: z.array(videoOperationSchema),
    filename: z.string().optional(),
  })).min(1),
});

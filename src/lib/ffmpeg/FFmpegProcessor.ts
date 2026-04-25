import fs from 'fs-extra';
import path from 'path';
import { VideoOperation, ClipConfig, SubtitleConfig, AspectRatioConfig, SplitScreenConfig } from '@/types';

const ffmpeg: any = require('fluent-ffmpeg');

export interface FFmpegOptions {
  inputPath: string;
  outputPath: string;
  operations: VideoOperation[];
}

export interface ClipResult {
  clipPaths: string[];
  clipCount: number;
  totalDuration: number;
}

export class FFmpegProcessor {
  constructor() {
    this.validateFFmpeg();
  }

  private validateFFmpeg(): void {
    try {
      const ffmpegCmd = process.env.FFMPEG_PATH || 'ffmpeg';
      if (!ffmpegCmd) {
        throw new Error('FFmpeg not found. Please install ffmpeg or set FFMPEG_PATH environment variable.');
      }
    } catch (err) {
      console.warn('FFmpeg validation warning:', err);
    }
  }

  public async process(options: FFmpegOptions): Promise<{ outputPath: string; duration: number; size: number; }> {
    const { inputPath, outputPath, operations } = options;

    if (!(await fs.pathExists(inputPath))) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    const outputDir = path.dirname(outputPath);
    await fs.ensureDir(outputDir);

    let currentInput = inputPath;
    const tempFiles: string[] = [];

    try {
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        const isLastOperation = i === operations.length - 1;
        const tempOutput = isLastOperation ? outputPath : this.generateTempPath(outputDir, i);

        if (!isLastOperation) {
          tempFiles.push(tempOutput);
        }

        await this.executeOperation(currentInput, tempOutput, operation);
        currentInput = tempOutput;
      }

      const stats = await fs.stat(outputPath);
      const duration = await this.getVideoDuration(outputPath);

      await this.cleanupTempFiles(tempFiles);

      return {
        outputPath,
        duration,
        size: stats.size
      };
    } catch (error) {
      await this.cleanupTempFiles(tempFiles);
      if (await fs.pathExists(outputPath) && outputPath !== inputPath) {
        await fs.remove(outputPath).catch(() => {});
      }
      throw error;
    }
  }

  private async executeOperation(inputPath: string, outputPath: string, operation: VideoOperation): Promise<void> {
    switch (operation.type) {
      case 'clip':
        await this.clipVideo(inputPath, outputPath, operation.params as ClipConfig);
        break;
      case 'subtitles':
        await this.addSubtitles(inputPath, outputPath, operation.params as SubtitleConfig);
        break;
      case 'aspect-ratio':
        await this.changeAspectRatio(inputPath, outputPath, operation.params as AspectRatioConfig);
        break;
      case 'split-screen':
        await this.createSplitScreen(inputPath, outputPath, operation.params as SplitScreenConfig);
        break;
      default:
        throw new Error(`Unsupported operation type: ${(operation as any).type}`);
    }
  }

  public async clipVideo(inputPath: string, outputPath: string, config: ClipConfig): Promise<ClipResult> {
    const { clipDuration, overlap = 0, format = 'mp4' } = config;

    const duration = await this.getVideoDuration(inputPath);
    const clips: string[] = [];
    const clipPaths: string[] = [];

    const outputDir = path.dirname(outputPath);
    const baseName = path.parse(outputPath).name;

    for (let start = 0; start < duration; start += (clipDuration - overlap)) {
      const end = Math.min(start + clipDuration, duration);
      const actualDuration = end - start;

      if (actualDuration <= 0) break;

      const clipPath = path.join(outputDir, `${baseName}_clip_${clips.length + 1}.${format}`);
      clips.push(clipPath);

      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(start)
          .setDuration(actualDuration)
          .outputOptions('-c:v', 'libx264')
          .outputOptions('-c:a', 'aac')
          .outputOptions('-preset', 'medium')
          .outputOptions('-crf', '23')
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .save(clipPath);
      });

      clipPaths.push(clipPath);
    }

    return {
      clipPaths,
      clipCount: clipPaths.length,
      totalDuration: duration
    };
  }

  public async addSubtitles(inputPath: string, outputPath: string, config: SubtitleConfig): Promise<void> {
    const { language = 'eng', fontSize = 24, fontColor = 'white', backgroundColor = 'black@0.5', position = 'bottom' } = config;

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(`subtitles=${inputPath}:force_style='Fontsize=${fontSize},PrimaryColour=&H${this.colorToHex(fontColor)}&,BackColour=&H${this.colorToHex(backgroundColor)}&,Alignment=${this.getAlignment(position)}'`)
        .outputOptions('-c:a', 'copy')
        .outputOptions('-c:v', 'libx264')
        .outputOptions('-preset', 'medium')
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .save(outputPath);
    });
  }

  public async changeAspectRatio(inputPath: string, outputPath: string, config: AspectRatioConfig): Promise<void> {
    const { ratio, background = 'black', padding = 'solid' } = config;

    const [width, height] = this.parseRatio(ratio);

    await new Promise<void>((resolve, reject) => {
      let filter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${background}`;

      if (padding === 'blur') {
        filter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},split[a][b];[a]scale=iw/4:-1,boxblur=10:10[bg];[bg][b]overlay=(W-w)/2:(H-h)/2`;
      }

      ffmpeg(inputPath)
        .videoFilters(filter)
        .outputOptions('-c:a', 'copy')
        .outputOptions('-c:v', 'libx264')
        .outputOptions('-preset', 'medium')
        .outputOptions('-crf', '22')
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .save(outputPath);
    });
  }

  public async createSplitScreen(inputPath: string, outputPath: string, config: SplitScreenConfig): Promise<void> {
    const { secondaryVideo, layout = 'vertical', position = 'left', ratio = 0.5 } = config;

    if (!(await fs.pathExists(secondaryVideo))) {
      throw new Error(`Secondary video not found: ${secondaryVideo}`);
    }

    await new Promise<void>((resolve, reject) => {
      let filterComplex: string;

      if (layout === 'vertical') {
        const pad = position === 'left' ? '0:0' : 'iw/2:0';
        filterComplex = `[0:v]scale=iw/2:ih[v0];[1:v]scale=iw/2:ih[v1];[v0][v1]overlay=${pad}[out]`;
      } else if (layout === 'horizontal') {
        const pad = position === 'top' ? '0:0' : '0:ih/2';
        filterComplex = `[0:v]scale=iw:ih/2[v0];[1:v]scale=iw:ih/2[v1];[v0][v1]overlay=${pad}[out]`;
      } else {
        const secondaryW = Math.floor(1920 * ratio);
        const secondaryH = Math.floor(1080 * ratio);
        const padX = position === 'left' ? 0 : 1920 - secondaryW;
        const padY = 1080 - secondaryH;
        filterComplex = `[0:v]scale=1920:1080[bg];[1:v]scale=${secondaryW}:${secondaryH}[fg];[bg][fg]overlay=${padX}:${padY}[out]`;
      }

      ffmpeg()
        .input(inputPath)
        .input(secondaryVideo)
        .complexFilter(filterComplex)
        .outputOptions('-map', '[out]')
        .outputOptions('-map', '0:a')
        .outputOptions('-c:v', 'libx264')
        .outputOptions('-preset', 'medium')
        .outputOptions('-c:a', 'aac')
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .save(outputPath);
    });
  }

  public async mergeVideos(videoPaths: string[], outputPath: string): Promise<void> {
    for (const vPath of videoPaths) {
      if (!(await fs.pathExists(vPath))) {
        throw new Error(`Video file not found: ${vPath}`);
      }
    }

    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg();
      videoPaths.forEach(vp => command.input(vp));
      command.mergeToFile(outputPath, path.dirname(outputPath));
      command.on('end', () => resolve())
             .on('error', (err: Error) => reject(err));
    });
  }

  public async getVideoDuration(inputPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err: any, metadata: any) => {
        if (err) reject(err);
        else resolve((metadata && metadata.format && metadata.format.duration) || 0);
      });
    });
  }

  public async getVideoInfo(inputPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err: any, metadata: any) => {
        if (err) reject(err);
        else resolve({
          duration: (metadata && metadata.format && metadata.format.duration) || 0,
          size: (metadata && metadata.format && metadata.format.size) || 0,
          bitrate: (metadata && metadata.format && metadata.format.bit_rate) || 0,
          format: (metadata && metadata.format && metadata.format.format_name) || '',
          videoStream: (metadata && metadata.streams && metadata.streams.find((s: any) => s.codec_type === 'video')) || null,
          audioStream: (metadata && metadata.streams && metadata.streams.find((s: any) => s.codec_type === 'audio')) || null
        });
      });
    });
  }

  private generateTempPath(dir: string, index: number): string {
    return path.join(dir, `temp_${Date.now()}_${index}.mp4`);
  }

  private async cleanupTempFiles(files: string[]): Promise<void> {
    for (const file of files) {
      try {
        await fs.remove(file);
      } catch (err) {
        console.warn(`Failed to cleanup temp file ${file}:`, err);
      }
    }
  }

  private parseRatio(ratio: string): [number, number] {
    const ratios: Record<string, [number, number]> = {
      '9:16': [1080, 1920],
      '16:9': [1920, 1080],
      '1:1': [1080, 1080],
      '4:5': [1080, 1350],
      '4:3': [1440, 1080]
    };
    return ratios[ratio] || [1920, 1080];
  }

  private colorToHex(color: string): string {
    if (color.startsWith('&H')) return color;
    if (color === 'white') return '&H00FFFFFF';
    if (color === 'black') return '&H00000000';
    if (color === 'red') return '&H000000FF';
    return '&H00FFFFFF';
  }

  private getAlignment(position: string): number {
    switch (position) {
      case 'top': return 6;
      case 'center': return 10;
      case 'bottom': return 2;
      default: return 2;
    }
  }
}

export const ffmpegProcessor = new FFmpegProcessor();
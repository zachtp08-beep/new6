import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface StoredFile {
  id: string;
  originalName: string;
  path: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  url: string;
}

export class FileStorage {
  private uploadsDir: string;
  private processedDir: string;
  private tempDir: string;

  constructor(basePath: string = process.cwd()) {
    this.uploadsDir = path.join(basePath, 'public', 'uploads');
    this.processedDir = path.join(basePath, 'public', 'processed');
    this.tempDir = path.join(basePath, 'public', 'temp');
    this.initializeDirectories();
  }

  private async initializeDirectories(): Promise<void> {
    await fs.ensureDir(this.uploadsDir);
    await fs.ensureDir(this.processedDir);
    await fs.ensureDir(this.tempDir);
  }

  public async saveUploadedFile(fileBuffer: Buffer, originalName: string, mimeType: string): Promise<StoredFile> {
    const id = uuidv4();
    const ext = path.extname(originalName) || '.mp4';
    const safeName = `${id}_${Date.now()}${ext}`;
    const filePath = path.join(this.uploadsDir, safeName);

    await fs.writeFile(filePath, fileBuffer);
    const stats = await fs.stat(filePath);

    const storedFile: StoredFile = {
      id,
      originalName,
      path: filePath,
      mimeType,
      size: stats.size,
      uploadedAt: new Date(),
      url: `/uploads/${safeName}`
    };

    return storedFile;
  }

  public async saveProcessedFile(fileBuffer: Buffer, originalName: string, operationSuffix: string): Promise<StoredFile> {
    const id = uuidv4();
    const ext = path.extname(originalName) || '.mp4';
    const baseName = path.basename(originalName, ext);
    const safeName = `${baseName}_${operationSuffix}_${id}.mp4`;
    const filePath = path.join(this.processedDir, safeName);

    await fs.writeFile(filePath, fileBuffer);
    const stats = await fs.stat(filePath);

    return {
      id,
      originalName: safeName,
      path: filePath,
      mimeType: 'video/mp4',
      size: stats.size,
      uploadedAt: new Date(),
      url: `/processed/${safeName}`
    };
  }

  public async saveTempFile(fileBuffer: Buffer, prefix: string = 'temp'): Promise<string> {
    const tempPath = path.join(this.tempDir, `${prefix}_${Date.now()}_${uuidv4()}.tmp`);
    await fs.writeFile(tempPath, fileBuffer);
    return tempPath;
  }

  public async getFile(filePath: string): Promise<Buffer> {
    if (!(await fs.pathExists(filePath))) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fs.readFile(filePath);
  }

  public async getFileByUrl(url: string): Promise<StoredFile | null> {
    const sanitizedUrl = url.startsWith('/') ? url.substring(1) : url;
    const uploadsPath = path.join(this.uploadsDir, path.basename(sanitizedUrl));
    const processedPath = path.join(this.processedDir, path.basename(sanitizedUrl));

    if (await fs.pathExists(uploadsPath)) {
      const stats = await fs.stat(uploadsPath);
      return {
        id: uuidv4(),
        originalName: path.basename(uploadsPath),
        path: uploadsPath,
        mimeType: this.getMimeType(uploadsPath),
        size: stats.size,
        uploadedAt: stats.birthtime,
        url: `/uploads/${path.basename(uploadsPath)}`
      };
    }

    if (await fs.pathExists(processedPath)) {
      const stats = await fs.stat(processedPath);
      return {
        id: uuidv4(),
        originalName: path.basename(processedPath),
        path: processedPath,
        mimeType: 'video/mp4',
        size: stats.size,
        uploadedAt: stats.birthtime,
        url: `/processed/${path.basename(processedPath)}`
      };
    }

    return null;
  }

  public async deleteFile(filePath: string): Promise<boolean> {
    if (!(await fs.pathExists(filePath))) {
      return false;
    }
    await fs.remove(filePath);
    return true;
  }

  public async cleanupOldFiles(maxAgeHours: number = 24): Promise<number> {
    let deletedCount = 0;
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    const cleanupDir = async (dir: string) => {
      const files = await fs.readdir(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);
        if (now - stats.mtime.getTime() > maxAgeMs) {
          await fs.remove(filePath);
          deletedCount++;
        }
      }
    };

    await cleanupDir(this.tempDir);
    return deletedCount;
  }

  public async listFiles(dirType: 'uploads' | 'processed' | 'temp' = 'uploads'): Promise<StoredFile[]> {
    const dir = dirType === 'uploads' ? this.uploadsDir : dirType === 'processed' ? this.processedDir : this.tempDir;
    
    if (!(await fs.pathExists(dir))) {
      return [];
    }

    const files = await fs.readdir(dir);
    const storedFiles: StoredFile[] = [];

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = await fs.stat(filePath);
      
      storedFiles.push({
        id: uuidv4(),
        originalName: file,
        path: filePath,
        mimeType: this.getMimeType(file),
        size: stats.size,
        uploadedAt: stats.birthtime,
        url: dirType === 'uploads' ? `/uploads/${file}` : `/processed/${file}`
      });
    }

    return storedFiles.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  public getUploadsDir(): string {
    return this.uploadsDir;
  }

  public getProcessedDir(): string {
    return this.processedDir;
  }

  public getTempDir(): string {
    return this.tempDir;
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

export const fileStorage = new FileStorage(process.cwd());
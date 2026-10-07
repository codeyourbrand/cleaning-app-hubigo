import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export interface StoredFile {
  url: string;
  key: string;
}

export interface StorageProvider {
  put(
    file: Buffer,
    originalName: string,
    contentType: string,
  ): Promise<StoredFile>;
  delete(key: string): Promise<void>;
}

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];
const maxFileSize = 10 * 1024 * 1024; // 10MB

function generateKey(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  return `${uuidv4()}${ext}`;
}

function validateFile(buffer: Buffer, contentType: string): void {
  if (!allowedMimeTypes.includes(contentType)) {
    throw new Error("Unsupported file type");
  }
  if (buffer.length > maxFileSize) {
    throw new Error("File too large");
  }
}

class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;
  private publicBase: string;

  constructor() {
    this.uploadDir = process.env.LOCAL_UPLOAD_DIR ?? "uploads";
    this.publicBase = "/uploads";
  }

  async put(
    file: Buffer,
    originalName: string,
    contentType: string,
  ): Promise<StoredFile> {
    validateFile(file, contentType);
    const key = generateKey(originalName);
    const dir = path.isAbsolute(this.uploadDir)
      ? this.uploadDir
      : path.join(/*turbopackIgnore: true*/ process.cwd(), this.uploadDir);
    const dest = path.join(dir, key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, file);
    return { url: `${this.publicBase}/${key}`, key };
  }

  async delete(key: string): Promise<void> {
    const dir = path.isAbsolute(this.uploadDir)
      ? this.uploadDir
      : path.join(/*turbopackIgnore: true*/ process.cwd(), this.uploadDir);
    const dest = path.join(dir, key);
    try {
      await fs.unlink(dest);
    } catch {
      // ignore missing file
    }
  }
}

export async function getStorageProvider(): Promise<StorageProvider> {
  return new LocalStorageProvider();
}

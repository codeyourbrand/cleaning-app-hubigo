import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  NoSuchKey,
} from "@aws-sdk/client-s3";

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
  get(key: string): Promise<Buffer | null>;
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

  private resolveDir(): string {
    return path.isAbsolute(this.uploadDir)
      ? this.uploadDir
      : path.join(/*turbopackIgnore: true*/ process.cwd(), this.uploadDir);
  }

  async put(
    file: Buffer,
    originalName: string,
    contentType: string,
  ): Promise<StoredFile> {
    validateFile(file, contentType);
    const key = generateKey(originalName);
    const dest = path.join(this.resolveDir(), key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, file);
    return { url: `${this.publicBase}/${key}`, key };
  }

  async get(key: string): Promise<Buffer | null> {
    const dir = this.resolveDir();
    const filePath = path.join(dir, key);
    if (!filePath.startsWith(dir + path.sep)) return null;
    try {
      return await fs.readFile(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.resolveDir(), key));
    } catch {
      // ignore missing file
    }
  }
}

class S3StorageProvider implements StorageProvider {
  private client = new S3Client({
    region: process.env.S3_REGION ?? "eu-central-1",
  });
  private bucket = process.env.S3_BUCKET ?? "";

  async put(
    file: Buffer,
    originalName: string,
    contentType: string,
  ): Promise<StoredFile> {
    validateFile(file, contentType);
    const key = generateKey(originalName);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
      }),
    );
    return { url: `/uploads/${key}`, key };
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return Buffer.from(await res.Body!.transformToByteArray());
    } catch (err) {
      if (err instanceof NoSuchKey) return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

function getSupabaseStorageConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase storage is missing required configuration");
  }
  return {
    objectBase: `${url}/storage/v1/object/${process.env.SUPABASE_STORAGE_BUCKET ?? "uploads"}`,
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  };
}

class SupabaseStorageProvider implements StorageProvider {
  async put(
    file: Buffer,
    originalName: string,
    contentType: string,
  ): Promise<StoredFile> {
    validateFile(file, contentType);
    const key = generateKey(originalName);
    const { objectBase, headers } = getSupabaseStorageConfig();
    const res = await fetch(`${objectBase}/${key}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": contentType },
      body: new Uint8Array(file),
    });
    if (!res.ok) {
      throw new Error(`Storage upload failed: ${res.status}`);
    }
    return { url: `/uploads/${key}`, key };
  }

  async get(key: string): Promise<Buffer | null> {
    const { objectBase, headers } = getSupabaseStorageConfig();
    const res = await fetch(`${objectBase}/${key}`, { headers });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) {
      throw new Error(`Storage download failed: ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const { objectBase, headers } = getSupabaseStorageConfig();
    await fetch(`${objectBase}/${key}`, { method: "DELETE", headers });
  }
}

export function getStorageProvider(): StorageProvider {
  switch (process.env.STORAGE_PROVIDER) {
    case "s3":
      if (!process.env.S3_BUCKET) {
        throw new Error("S3 storage is missing required configuration");
      }
      return new S3StorageProvider();
    case "supabase":
      return new SupabaseStorageProvider();
    default:
      return new LocalStorageProvider();
  }
}

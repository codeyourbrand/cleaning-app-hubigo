import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

async function getS3Client() {
  const { S3Client, PutObjectCommand, DeleteObjectCommand } =
    await import("@aws-sdk/client-s3");
  return { S3Client, PutObjectCommand, DeleteObjectCommand };
}

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

class S3StorageProvider implements StorageProvider {
  private client: any;
  private bucket: string;
  private publicBase?: string;
  private PutObjectCommand: any;
  private DeleteObjectCommand: any;

  constructor(client: any, PutObjectCommand: any, DeleteObjectCommand: any) {
    this.client = client;
    this.PutObjectCommand = PutObjectCommand;
    this.DeleteObjectCommand = DeleteObjectCommand;
    this.bucket = process.env.S3_BUCKET ?? "hubigo";
    this.publicBase = process.env.S3_PUBLIC_URL;
  }

  async put(
    file: Buffer,
    originalName: string,
    contentType: string,
  ): Promise<StoredFile> {
    validateFile(file, contentType);
    const key = generateKey(originalName);
    await this.client.send(
      new this.PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
      }),
    );
    const url = this.publicBase
      ? `${this.publicBase}/${key}`
      : `${process.env.S3_ENDPOINT}/${this.bucket}/${key}`;
    return { url, key };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new this.DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}

export async function getStorageProvider(): Promise<StorageProvider> {
  const provider = process.env.STORAGE_PROVIDER ?? "local";
  if (provider === "s3") {
    if (
      !process.env.S3_ENDPOINT ||
      !process.env.S3_ACCESS_KEY ||
      !process.env.S3_SECRET_KEY
    ) {
      throw new Error("S3 storage is missing required configuration");
    }
    const { S3Client, PutObjectCommand, DeleteObjectCommand } =
      await getS3Client();
    const client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? "",
        secretAccessKey: process.env.S3_SECRET_KEY ?? "",
      },
      forcePathStyle: true,
    });
    return new S3StorageProvider(client, PutObjectCommand, DeleteObjectCommand);
  }
  return new LocalStorageProvider();
}

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_CAFE_IMAGES_BUCKET!;
const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new Error(
      `Invalid content type. Allowed: ${ALLOWED_CONTENT_TYPES.join(", ")}`
    );
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await s3Client.send(command);

  const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;
  return publicUrl;
}

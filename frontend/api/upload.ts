import { Storage } from '@google-cloud/storage';
import { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { fileName, contentType, jobId } = req.body;

    // 1. Initialize Credentials
    let credentials = {};
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      } catch (e) {
        return res.status(500).json({ error: 'Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable.' });
      }
    } else {
      // Local fallback
      const saPath = path.join(process.cwd(), 'sa-key.json');
      if (fs.existsSync(saPath)) {
        credentials = JSON.parse(fs.readFileSync(saPath, 'utf8'));
      }
    }

    const projectId = process.env.GOOGLE_CLOUD_PROJECT || (credentials as any).project_id;
    if (!projectId) {
      return res.status(500).json({ error: 'Server configuration error: Missing Google Cloud Project ID' });
    }

    // 2. Initialize Storage
    const storage = new Storage({
      credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
      projectId,
    });

    const bucketName = process.env.INPUT_BUCKET || 'aidriven-mastering-input';
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(`uploads/${jobId}_${fileName}`);

    console.log(`Generating signed URL for: ${file.name}`);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType,
      extensionHeaders: {
        'x-goog-meta-jobId': jobId,
      },
    });

    return res.status(200).json({ url, path: file.name });
  } catch (error: any) {
    console.error("Upload handler error:", error);
    return res.status(500).json({ error: `Upload API Internal Error: ${error.message}` });
  }
}

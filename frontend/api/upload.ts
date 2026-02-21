import { Storage } from '@google-cloud/storage';
import { VercelRequest, VercelResponse } from '@vercel/node';

import fs from 'fs';
import path from 'path';

let credentials = {};
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  } else {
    // Look for sa-key.json in various locations for local development
    const possiblePaths = [
      path.join(process.cwd(), 'sa-key.json'),
      path.join(process.cwd(), '..', 'sa-key.json'),
      path.join(process.cwd(), '..', '..', 'sa-key.json')
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        credentials = JSON.parse(fs.readFileSync(p, 'utf8'));
        console.log(`Loaded Google Cloud credentials from: ${p}`);
        break;
      }
    }
  }
} catch (e) {
  console.error("Error loading credentials:", e);
}

const storage = new Storage({
  credentials,
  projectId: process.env.GOOGLE_CLOUD_PROJECT || (credentials as any).project_id,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { fileName, contentType, jobId } = req.body;

    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.error("Missing Google Cloud credentials environment variables.");
      return res.status(500).json({ error: 'Server configuration error: Missing Cloud Credentials' });
    }

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
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

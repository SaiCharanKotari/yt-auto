import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function verifyDrive() {
  const clientId = process.env.GOOGLE_MASTER_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_MASTER_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_MASTER_REFRESH_TOKEN;

  console.log('Testing Master Google Drive Auth...');
  console.log('Client ID:', clientId?.slice(0, 15) + '...');
  console.log('Refresh Token:', refreshToken?.slice(0, 15) + '...');

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const res = await drive.about.get({ fields: 'user, storageQuota' });
    console.log('\n✅ GOOGLE DRIVE AUTHENTICATION SUCCESSFUL!');
    console.log('Account User:', res.data.user?.displayName, `(${res.data.user?.emailAddress})`);
    const limit = Number(res.data.storageQuota?.limit || 0) / (1024 * 1024 * 1024);
    const usage = Number(res.data.storageQuota?.usage || 0) / (1024 * 1024 * 1024);
    console.log(`Storage: ${usage.toFixed(2)} GB used of ${limit.toFixed(2)} GB`);
  } catch (err: any) {
    console.error('❌ Auth Verification Failed:', err.message);
  }
}

verifyDrive();

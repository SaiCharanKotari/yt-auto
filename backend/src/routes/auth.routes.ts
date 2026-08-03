import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { YouTubeAccount } from '../models/YouTubeAccount';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// OAuth2 Client setup
const getOAuth2Client = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    console.warn('[Auth] WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing from .env!');
  } else {
    // Log partially masked values to verify they are loaded
    console.log(`[Auth] Using Client ID: ${clientId.substring(0, 15)}...`);
    console.log(`[Auth] Using Client Secret: ${clientSecret.substring(0, 10)}...`);
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback'
  );
};

// 1. Initiate OAuth flow
router.get('/google', (req: Request, res: Response) => {
  console.log('[Auth] Initiating Google OAuth flow...');
  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Need offline to get refresh token
    prompt: 'consent', // Force consent to guarantee refresh token is returned
    scope: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/yt-analytics.readonly'
    ],
  });
  console.log(`[Auth] Redirecting user to: ${url}`);
  res.redirect(url);
});

// 2. OAuth Callback
router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const error = req.query.error as string;

  if (error) {
    console.error(`[Auth] OAuth Error from Google: ${error}`);
    return res.redirect('http://localhost:5173/dashboard/accounts?error=oauth_rejected');
  }

  if (!code) {
    console.error('[Auth] No authorization code found in callback query');
    return res.redirect('http://localhost:5173/dashboard/accounts?error=no_code');
  }

  console.log(`[Auth] Received authorization code. Exchanging for tokens...`);
  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    console.log(`[Auth] Tokens received. Fetching channel information...`);

    // Fetch YouTube channel data
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const response = await youtube.channels.list({
      part: ['snippet', 'statistics'],
      mine: true,
    });

    const channels = response.data.items;
    if (!channels || channels.length === 0) {
      console.warn(`[Auth] No YouTube channel found for this Google account`);
      return res.redirect('http://localhost:5173/dashboard/accounts?error=no_channel');
    }

    const channel = channels[0];
    const channelId = channel.id!;
    const channelName = channel.snippet?.title || 'Unknown Channel';
    const avatar = channel.snippet?.thumbnails?.default?.url || '';
    
    // Format subscribers nicely (e.g., 1000 -> 1K)
    let subsRaw = parseInt(channel.statistics?.subscriberCount || '0', 10);
    let subsFormatted = subsRaw.toString();
    if (subsRaw >= 1000000) subsFormatted = (subsRaw / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    else if (subsRaw >= 1000) subsFormatted = (subsRaw / 1000).toFixed(1).replace(/\.0$/, '') + 'K';

    console.log(`[Auth] Fetched channel details: ID=${channelId}, Name="${channelName}", Subs=${subsFormatted}`);

    // Update or create in MongoDB
    const filter = { channelId };
    const update = {
      channelName,
      avatar,
      subscribers: subsFormatted,
      accessToken: tokens.access_token,
      // Only update refresh token if we received a new one (sometimes Google doesn't send it if not forced)
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000),
      status: 'Connected'
    };

    const options = { upsert: true, new: true, setDefaultsOnInsert: true };
    await YouTubeAccount.findOneAndUpdate(filter, update, options);
    
    console.log(`[Auth] Successfully saved/updated YouTube channel ${channelId} in database.`);
    
    res.redirect('http://localhost:5173/dashboard/accounts?success=true');
  } catch (err: any) {
    console.error('[Auth] Error during OAuth callback:', err.message);
    res.redirect(`http://localhost:5173/dashboard/accounts?error=${encodeURIComponent(err.message)}`);
  }
});

export default router;

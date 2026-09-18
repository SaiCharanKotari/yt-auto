/**
 * ============================================================================
 * TWITCH METADATA SERVICE
 * ============================================================================
 * Handles metadata, live stream detection, and broadcast archive extraction
 * for Twitch Clips, VODs, and Channels (bypassing commercial breaks).
 * ============================================================================
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class TwitchMetadataService {
  /**
   * Fetches Twitch metadata with exact live uptime and duration from stream start to now
   */
  static async getMetadata(url: string, ytDlpBin: string, retries = 1): Promise<any> {
    const runYtDlp = async (targetUrl: string, flags: string): Promise<any> => {
      let lastErr: any;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const { stdout } = await execAsync(
            `"${ytDlpBin}" --dump-json --js-runtimes node --no-warnings --no-check-certificate ${flags} "${targetUrl}"`,
            { maxBuffer: 1024 * 1024 * 50 }
          );
          return JSON.parse(stdout);
        } catch (err: any) {
          lastErr = err;
          const msg = err?.message || String(err);
          if (attempt < retries && (msg.toLowerCase().includes('commercial') || msg.toLowerCase().includes('timed out'))) {
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }
          break;
        }
      }
      throw lastErr;
    };

    // Dedicated Twitch Channel Live & Archive Handler
    const channelMatch = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)(?:\/)?$/i);
    if (channelMatch && channelMatch[1] && !['directory', 'videos', 'clip', 'p', 'settings', 'downloads'].includes(channelMatch[1].toLowerCase())) {
      const channel = channelMatch[1].toLowerCase();

      // 1. Query Twitch GQL API for real-time live broadcast status and stream start time
      let liveGqlUser: any = null;
      try {
        const gqlRes = await fetch('https://gql.twitch.tv/gql', {
          method: 'POST',
          headers: {
            'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `query { user(login: "${channel}") { displayName profileImageURL(width: 300) broadcastSettings { title game { name } } stream { id createdAt title type viewersCount } videos(first: 5, sort: TIME) { edges { node { id title createdAt lengthSeconds status broadcastType } } } } }`,
          }),
        });
        if (gqlRes.ok) {
          const gqlData = await gqlRes.json();
          liveGqlUser = gqlData?.data?.user;
        }
      } catch (gqlErr: any) {
        console.warn(`[Twitch Metadata] GQL query warning for ${channel}:`, gqlErr.message);
      }

      const isLiveNow = liveGqlUser?.stream?.type === 'live' || Boolean(liveGqlUser?.stream?.createdAt);

      if (isLiveNow) {
        let elapsedSec = 0;
        let startEpoch = 0;
        if (liveGqlUser?.stream?.createdAt) {
          startEpoch = Math.floor(new Date(liveGqlUser.stream.createdAt).getTime() / 1000);
          elapsedSec = Math.max(10, Math.floor(Date.now() / 1000 - startEpoch));
        }

        // 1a. Check if Twitch has an ongoing live DVR recording VOD for this broadcast
        const recordingVod = liveGqlUser?.videos?.edges?.find((e: any) => {
          const n = e?.node;
          if (!n) return false;
          if (n.status === 'RECORDING') return true;
          if (n.broadcastType === 'ARCHIVE' && n.createdAt) {
            const vodCreated = new Date(n.createdAt).getTime() / 1000;
            return Math.abs(vodCreated - startEpoch) < 3600 || vodCreated >= startEpoch - 300;
          }
          return false;
        })?.node;

        if (recordingVod?.id) {
          try {
            console.log(`[Twitch Metadata] Channel ${channel} is LIVE with active DVR VOD ${recordingVod.id}. Extracting full timeline DVR stream...`);
            const vodData = await runYtDlp(`https://www.twitch.tv/videos/${recordingVod.id}`, '');
            if (vodData && (vodData.formats?.length > 0 || vodData.url)) {
              vodData.is_live = true;
              vodData.live_status = 'is_live';
              vodData.release_timestamp = startEpoch || vodData.release_timestamp || vodData.timestamp;
              vodData.duration = Math.max(vodData.duration || 0, elapsedSec, recordingVod.lengthSeconds || 0);
              if (liveGqlUser?.stream?.title || liveGqlUser?.broadcastSettings?.title) {
                vodData.title = liveGqlUser.stream?.title || liveGqlUser.broadcastSettings?.title;
              }
              if (liveGqlUser?.displayName) {
                vodData.uploader = liveGqlUser.displayName;
              }
              if (liveGqlUser?.profileImageURL && (!vodData.thumbnail || vodData.thumbnail.includes('404_processing'))) {
                vodData.thumbnail = liveGqlUser.profileImageURL;
              }
              vodData.webpage_url = `https://www.twitch.tv/videos/${recordingVod.id}`;
              vodData.channel_url = `https://www.twitch.tv/${channel}`;
              return vodData;
            }
          } catch (vodErr: any) {
            console.warn(`[Twitch Metadata] Active DVR VOD extraction fallback for ${channel}:`, vodErr.message);
          }
        }

        // 1b. Fallback: Extract direct live master stream
        try {
          console.log(`[Twitch Metadata] Channel ${channel} is currently LIVE. Extracting direct live stream...`);
          const liveData = await runYtDlp(`https://www.twitch.tv/${channel}`, '');
          
          liveData.is_live = true;
          liveData.live_status = 'is_live';
          if (elapsedSec > 0) {
            liveData.duration = elapsedSec;
            liveData.release_timestamp = startEpoch;
          }
          if (liveGqlUser?.stream?.title || liveGqlUser?.broadcastSettings?.title) {
            liveData.title = liveGqlUser.stream?.title || liveGqlUser.broadcastSettings?.title;
          }
          if (liveGqlUser?.displayName) {
            liveData.uploader = liveGqlUser.displayName;
          }
          if (liveGqlUser?.profileImageURL && (!liveData.thumbnail || liveData.thumbnail.includes('404_processing'))) {
            liveData.thumbnail = liveGqlUser.profileImageURL;
          }
          liveData.webpage_url = `https://www.twitch.tv/${channel}`;

          return liveData;
        } catch (liveErr: any) {
          console.warn(`[Twitch Metadata] Direct live extraction fallback for ${channel}:`, liveErr.message);
        }
      }

      // 2. If channel is offline or direct live extraction failed, try broadcast archives
      try {
        const vodArchiveUrl = `https://www.twitch.tv/${channel}/videos?filter=archives&sort=time`;
        const vodData = await runYtDlp(vodArchiveUrl, '--playlist-items 1');
        if (vodData && (vodData.id || vodData.url)) {
          return vodData;
        }
      } catch (vodErr: any) {
        console.warn(`[Twitch Metadata] Channel ${channel} archive fallback:`, vodErr.message);
      }
    }

    try {
      return await runYtDlp(url, '');
    } catch (firstErr: any) {
      if (channelMatch && channelMatch[1]) {
        throw new Error(`The Twitch channel "${channelMatch[1]}" is not currently live and has no active broadcast.`);
      }
      throw firstErr;
    }
  }
}

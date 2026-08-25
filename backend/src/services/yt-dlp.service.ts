import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);
const YTDLP_BIN = path.join(process.cwd(), 'yt-dlp.exe');

export class YtDlpService {
  /**
   * Fetch metadata for a given video URL
   */
  static async getVideoMetadata(url: string) {
    try {
      const { stdout } = await execAsync(
        `"${YTDLP_BIN}" --dump-json --no-warnings --no-check-certificate --prefer-free-formats --js-runtimes node --extractor-args "youtube:player_client=default,web_embedded" "${url}"`,
        { maxBuffer: 1024 * 1024 * 50 }
      );
      return JSON.parse(stdout);
    } catch (error: any) {
      console.error('Error fetching metadata:', error?.message || error);
      throw new Error(error?.message || 'Failed to fetch video metadata');
    }
  }

  /**
   * Check if yt-dlp is installed and accessible
   */
  static async checkInstallation() {
    try {
      const { stdout } = await execAsync(`"${YTDLP_BIN}" --version`);
      return stdout.trim();
    } catch (error) {
      console.error('yt-dlp.exe not found in backend directory.');
      throw error;
    }
  }
}

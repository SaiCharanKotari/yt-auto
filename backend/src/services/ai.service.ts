export class AIService {
  static async analyzeVideo(data: {
    title: string;
    duration: string;
    description: string;
    comments: any[];
    customPrompt?: string;
  }) {
    console.log(`[AI] Starting OpenRouter analysis for: ${data.title}`);

    // Limit to top 50 comments to save tokens (since rate limits are being hit)
    const commentsText = data.comments
      .slice(0, 50) 
      .map(c => `[Likes: ${c.like_count || 0}] ${c.text}`)
      .join('\n\n');

    // Truncate description to max 2000 characters
    const safeDescription = data.description && data.description.length > 2000 
      ? data.description.substring(0, 2000) + '\n...[DESCRIPTION TRUNCATED TO FIT LIMITS]'
      : (data.description || 'No description available.');

    const customInstructions = data.customPrompt 
      ? `\n\n## Special User Instructions\nThe user has provided the following custom instructions for this clip extraction. You MUST prioritize these instructions above all else:\n\n"${data.customPrompt}"\n\n`
      : '';

    const prompt = `You are an expert YouTube content strategist and viral long form editor.

Analyze the following information from a video.

Your objective is to recommend the BEST viral video that can be uploaded as a new standalone YouTube video.

Base your decision on ALL available information, not just one signal.

## Video Information

Original Title:
${data.title}

Duration:
${data.duration}

Description:
${safeDescription}

---

## Community Comment Analysis

Below are comments collected from the video.

Each comment contains:
* Comment text
* Number of likes
* Reply count

${commentsText}
${customInstructions}
---

## Your Tasks

1. Understand what the video is about.
2. Identify the sections that generated the highest audience interest using:
* Timestamp frequency in comments
* Comment likes
* Positive sentiment
* Repeated keywords
* Educational value
* Entertainment value
* Emotional impact

3. Recommend the SINGLE BEST clip that has the highest chance of performing well as an independent YouTube upload.

4. Determine:
* Clip Start Time
* Clip End Time

The clip MUST follow these rules:
* Be between 20 to 30 minutes in length.
* Start naturally.
* End naturally.
* Be easy to understand without requiring too much previous context.
* Have a strong hook in the first few seconds.
* Avoid unnecessary silence.

5. Generate a NEW YouTube title.
The title should:
* Be optimized for clicks.
* Be truthful.
* Be SEO friendly.
* Be under 70 characters.

6. Generate:
* A short description.
* 10 relevant hashtags.
* A confidence score from 0 to 100.
* A short explanation describing why this clip was selected.

7. If there are multiple strong moments, rank the TOP 5 clips.

---

Return ONLY valid JSON.

Example format:
{
  "video_summary": "...",
  "recommended_clip": {
    "title": "...",
    "start_time": "08:32",
    "end_time": "09:18",
    "duration": "46s",
    "confidence": 97,
    "reason": "...",
    "description": "...",
    "hashtags": [ "#AI", "#MachineLearning" ]
  },
  "top_alternative_clips": [
    {
      "title": "...",
      "start_time": "...",
      "end_time": "...",
      "confidence": 92
    }
  ]
}`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'ClipFlow',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      const text = await response.text();
      console.log("[AI] OpenRouter Response Status:", response.status);
      
      if (!response.ok) {
        console.error("[AI] OpenRouter Error Body:", text);
        throw new Error(`OpenRouter API Error: ${response.status} ${text}`);
      }

      const responseData = JSON.parse(text);
      const content = responseData.choices?.[0]?.message?.content || '{}';
      
      // Clean up potential markdown formatting that free models sometimes add
      const cleanContent = content.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim();
      
      return JSON.parse(cleanContent);
    } catch (error: any) {
      console.error('[AI] OpenRouter Exception:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(JSON.stringify(error));
    }
  }
}


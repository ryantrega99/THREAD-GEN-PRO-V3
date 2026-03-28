export interface ThreadParams {
  topic: string;
  length?: 'PENDEK' | 'PANJANG' | 'REKOMENDASI';
  tone?: 'GALAK' | 'SANTAI' | 'MOTIVASI' | 'HUMOR' | 'HANIFMUH';
  apiKey?: string;
}

export interface ViralBooster {
  hashtags?: string;
  bestTime?: string;
  hooks?: string[];
}

export interface ThreadResponse {
  tweets: string[];
  booster?: ViralBooster;
}

export async function generateThread(params: ThreadParams): Promise<ThreadResponse> {
  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "Gagal generate thread dari server";
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // If not JSON, use the raw text or status
        errorMessage = `Server Error (${response.status}): ${errorText.substring(0, 100)}`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return {
      tweets: data.tweets || [],
      booster: data.booster
    };
  } catch (error) {
    console.error("Error generating thread:", error);
    throw error;
  }
}

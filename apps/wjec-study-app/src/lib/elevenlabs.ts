const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

// ElevenLabs' standard premade voices (Rachel and Domi), available on every account.
export const HOST_VOICE_IDS: Record<"Host A" | "Host B", string> = {
  "Host A": "21m00Tcm4TlvDq8ikWAM",
  "Host B": "AZnzlk1XvdvUeBnXmlld",
};

export async function synthesizeSpeech(
  text: string,
  voiceId: string,
  apiKey: string,
): Promise<ArrayBuffer> {
  const res = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
    }),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(`ElevenLabs error: ${message || res.statusText}`);
  }

  return res.arrayBuffer();
}

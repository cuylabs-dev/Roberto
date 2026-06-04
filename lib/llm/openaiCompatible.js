/** Cliente HTTP OpenAI-compatible (Groq, OpenRouter, Mistral). */

export async function chatCompletion({
  apiKey,
  baseUrl,
  model,
  prompt,
  images,
  maxTokens = 2048,
  extraHeaders = {},
}) {
  const messages = [];
  if (images?.length) {
    const parts = [{ type: "text", text: prompt }];
    for (const img of images) {
      if (img.inlineData) {
        parts.push({
          type: "image_url",
          image_url: {
            url: `data:${img.inlineData.mimeType};base64,${img.inlineData.data}`,
          },
        });
      }
    }
    messages.push({ role: "user", content: parts });
  } else {
    messages.push({ role: "user", content: prompt });
  }

  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${body.slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }

  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error("Respuesta LLM no es JSON");
  }

  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("LLM sin contenido");
  return { text: String(text).trim(), model };
}

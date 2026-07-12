/**
 * نشر على إكس (Twitter API v1.1 media + v2 tweets) عبر OAuth 1.0a.
 * يتطلب: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
 */

function percentEncode(str: string) {
  return encodeURIComponent(str).replace(/[!*()']/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

async function hmacSha1Base64(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  return Buffer.from(sig).toString("base64");
}

function randomNonce() {
  return `${Date.now()}${Math.random().toString(36).slice(2)}`;
}

async function oauthHeader(
  method: string,
  url: string,
  extraParams: Record<string, string>,
  consumerKey: string,
  consumerSecret: string,
  token: string,
  tokenSecret: string,
): Promise<string> {
  const oauth: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: randomNonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: token,
    oauth_version: "1.0",
  };
  const all = { ...oauth, ...extraParams };
  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(all[k])}`)
    .join("&");
  const base = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  oauth.oauth_signature = await hmacSha1Base64(signingKey, base);
  return (
    "OAuth " +
    Object.keys(oauth)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(oauth[k])}"`)
      .join(", ")
  );
}

export function isXConfigured(): boolean {
  return Boolean(
    process.env.X_API_KEY &&
      process.env.X_API_SECRET &&
      process.env.X_ACCESS_TOKEN &&
      process.env.X_ACCESS_SECRET,
  );
}

export async function publishToX(input: {
  text: string;
  png: Buffer;
}): Promise<{ ok: true; tweetId: string; tweetUrl: string } | { ok: false; error: string }> {
  if (!isXConfigured()) {
    return {
      ok: false,
      error: "مفاتيح إكس غير مضبوطة (X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET)",
    };
  }

  const consumerKey = process.env.X_API_KEY!;
  const consumerSecret = process.env.X_API_SECRET!;
  const token = process.env.X_ACCESS_TOKEN!;
  const tokenSecret = process.env.X_ACCESS_SECRET!;

  try {
    const mediaUrl = "https://upload.twitter.com/1.1/media/upload.json";
    const form = new FormData();
    form.append("media", new Blob([new Uint8Array(input.png)], { type: "image/png" }), "card.png");

    const mediaAuth = await oauthHeader(
      "POST",
      mediaUrl,
      {},
      consumerKey,
      consumerSecret,
      token,
      tokenSecret,
    );
    const mediaRes = await fetch(mediaUrl, {
      method: "POST",
      headers: { Authorization: mediaAuth },
      body: form,
    });
    const mediaJson = (await mediaRes.json().catch(() => ({}))) as { media_id_string?: string; errors?: unknown };
    if (!mediaRes.ok || !mediaJson.media_id_string) {
      return { ok: false, error: `فشل رفع الصورة إلى إكس (${mediaRes.status})` };
    }

    const tweetUrl = "https://api.twitter.com/2/tweets";
    const tweetAuth = await oauthHeader(
      "POST",
      tweetUrl,
      {},
      consumerKey,
      consumerSecret,
      token,
      tokenSecret,
    );
    const tweetRes = await fetch(tweetUrl, {
      method: "POST",
      headers: {
        Authorization: tweetAuth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: input.text.slice(0, 280),
        media: { media_ids: [mediaJson.media_id_string] },
      }),
    });
    const tweetJson = (await tweetRes.json().catch(() => ({}))) as {
      data?: { id?: string };
      detail?: string;
      title?: string;
    };
    if (!tweetRes.ok || !tweetJson.data?.id) {
      return {
        ok: false,
        error: tweetJson.detail || tweetJson.title || `فشل النشر (${tweetRes.status})`,
      };
    }
    const id = tweetJson.data.id;
    return {
      ok: true,
      tweetId: id,
      tweetUrl: `https://x.com/i/web/status/${id}`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" };
  }
}

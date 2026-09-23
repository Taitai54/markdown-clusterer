const OpenAI = require('openai');

function validateLocalSettings(settings) {
  const url = new URL(settings.baseURL);
  if (!['http:', 'https:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('Local models require a loopback URL (localhost, 127.0.0.1 or ::1), without credentials or query parameters.');
  }
  // Resolve localhost explicitly to prevent host/DNS configuration sending content elsewhere.
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
  for (const key of ['chatModel', 'embeddingModel']) {
    if (typeof settings[key] !== 'string' || !settings[key].trim() || /cloud/i.test(settings[key])) {
      throw new Error('Choose downloaded local model names; cloud model tags are not allowed.');
    }
  }
  return { baseURL: url.toString().replace(/\/$/, ''), chatModel: settings.chatModel.trim(), embeddingModel: settings.embeddingModel.trim() };
}

function createLocalClient(settings) {
  const validated = validateLocalSettings(settings);
  return new OpenAI({
    apiKey: 'not-required', baseURL: validated.baseURL, timeout: 120000, maxRetries: 0,
    fetch: (url, options) => {
      const target = new URL(url);
      if (target.origin !== new URL(validated.baseURL).origin) throw new Error('Non-local model request blocked');
      return fetch(url, { ...options, redirect: 'error' });
    }
  });
}

function validateEmbeddings(vectors, count) {
  const dimensions = vectors?.[0]?.length;
  if (!Array.isArray(vectors) || vectors.length !== count || !dimensions ||
      vectors.some(v => !Array.isArray(v) || v.length !== dimensions || v.some(n => !Number.isFinite(n)) || !v.some(n => n !== 0))) {
    throw new Error('Embedding server returned missing, invalid or inconsistent vectors.');
  }
  return vectors.map(v => {
    const norm = Math.sqrt(v.reduce((sum, n) => sum + n * n, 0));
    return v.map(n => n / norm);
  });
}
module.exports = { validateLocalSettings, createLocalClient, validateEmbeddings };

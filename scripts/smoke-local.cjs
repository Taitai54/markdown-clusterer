// Synthetic text only: no user documents are transmitted by this check.
const { createLocalClient, validateEmbeddings } = require('../electron/local-models');
(async () => {
  const settings = { baseURL: 'http://127.0.0.1:11434/v1', embeddingModel: process.env.SMOKE_EMBED_MODEL || 'bge-m3:latest', chatModel: process.env.SMOKE_CHAT_MODEL || 'gpt-oss:20b' };
  const client = createLocalClient(settings);
  const start = Date.now();
  const response = await client.embeddings.create({ model: settings.embeddingModel, input: ['Apple orchard fruit harvest', 'Pear trees and fruit picking', 'JavaScript programming functions', 'Python software development'], encoding_format: 'float' });
  const vectors = validateEmbeddings(response.data.sort((a,b) => a.index-b.index).map(x => x.embedding), 4);
  const { kmeans } = await import('ml-kmeans');
  const clusters = kmeans(vectors, 2, { seed: 42 }).clusters;
  const chat = await client.chat.completions.create({ model: settings.chatModel, messages: [{role:'user', content:'Name a cluster about apples and pears. Return JSON with string fields name and description.'}], response_format: {type:'json_object'}, max_tokens: 512 });
  const naming = JSON.parse(chat.choices[0].message.content);
  if (!naming.name || !naming.description) throw new Error('Invalid naming JSON');
  console.log(JSON.stringify({ ...settings, dimensions: vectors[0].length, clusters, naming, seconds: (Date.now()-start)/1000 }, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });

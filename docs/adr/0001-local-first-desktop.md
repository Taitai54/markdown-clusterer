# ADR 0001 — Keep Electron; enforce explicit local model routing

Date: 2026-09-19. Status: accepted for this implementation.

The product is a personal desktop file organizer. Existing Electron IPC and local filesystem access already fit the purpose. Separate chat and embedding routes existed, but readiness depended on OpenAI and the E5 branch could override local selection.

Keep Electron/React and the OpenAI-compatible local adapter. Persist nonsecret model settings in userData. Offline mode overrides both providers, restricts model requests to loopback, rejects redirects and explicit cloud model tags, bypasses cloud startup checks and never falls back remotely. Bound individual inference requests. Use an installed dedicated embedding model, not a chat model for embeddings. Keep cloud routes available only through explicit selection outside offline mode.

Alternatives rejected: a hosted backend (adds availability/privacy dependencies), a framework rewrite (does not fix routing/data integrity), embedding the entire model runtime (large packaging/support burden), or silently using a cloud fallback (violates user intent).

Consequences: Ollama is a separate prerequisite and model downloads happen before offline use. Loopback is not proof that the server itself never proxies remotely. The owner must disable Ollama cloud features and perform disconnected acceptance. No LAN inference endpoint is accepted by this local adapter. Future cache keys must include endpoint/provider, exact model, preview/preprocessing version and content hash; cache reuse across model spaces is forbidden.

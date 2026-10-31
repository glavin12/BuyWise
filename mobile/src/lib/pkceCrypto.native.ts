import { CryptoDigestAlgorithm, digest, getRandomValues, randomUUID } from "expo-crypto";

// Supabase otherwise falls back to Math.random and plain PKCE on Hermes.
if (!globalThis.crypto?.getRandomValues) {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: { getRandomValues, randomUUID },
  });
}
if (!globalThis.crypto.subtle) {
  Object.defineProperty(globalThis.crypto, "subtle", {
    configurable: true,
    value: {
      digest(algorithm: AlgorithmIdentifier, data: BufferSource) {
        const name = typeof algorithm === "string" ? algorithm : algorithm.name;
        if (name !== "SHA-256") throw new Error("Only SHA-256 is supported by the native auth adapter.");
        return digest(CryptoDigestAlgorithm.SHA256, data);
      },
    },
  });
}

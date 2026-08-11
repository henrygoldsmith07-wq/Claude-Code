import { describe, it, expect } from "vitest";
import { decryptJson, encryptJson, passphraseStrength } from "./crypto";

describe("crypto vault", () => {
  it("encrypts and decrypts JSON", async () => {
    const payload = [{ id: "1", text: "hello" }];
    const blob = await encryptJson("correct horse battery staple", payload);
    expect(blob.v).toBe(1);
    expect(blob.ct).toBeTruthy();
    const out = await decryptJson<typeof payload>("correct horse battery staple", blob);
    expect(out).toEqual(payload);
  });

  it("wrong passphrase fails to decrypt", async () => {
    const blob = await encryptJson("correct horse battery staple", { x: 1 });
    await expect(decryptJson("wrong passphrase here!", blob)).rejects.toThrow();
  });

  it("passphraseStrength grades", () => {
    expect(passphraseStrength("short").label).toBe("too short");
    expect(passphraseStrength("LongEnough1!").score).toBeGreaterThanOrEqual(2);
  });
});

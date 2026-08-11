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

  it("tampered ciphertext fails to decrypt", async () => {
    const blob = await encryptJson("correct horse battery staple", { secret: "hi" });
    const tampered = { ...blob, ct: blob.ct.slice(0, -2) + "AA" };
    await expect(decryptJson("correct horse battery staple", tampered as typeof blob)).rejects.toThrow();
  });

  it("empty payload round-trips", async () => {
    const blob = await encryptJson("another good passphrase 123!", []);
    expect(await decryptJson("another good passphrase 123!", blob)).toEqual([]);
  });

  it("rejects unsupported vault version", async () => {
    const blob = await encryptJson("correct horse battery staple", { x: 1 });
    await expect(decryptJson("correct horse battery staple", { ...blob, v: 2 } as unknown as typeof blob)).rejects.toThrow(/Unsupported/);
  });

  it("passphraseStrength grades", () => {
    expect(passphraseStrength("short").label).toBe("too short");
    expect(passphraseStrength("LongEnough1!").score).toBeGreaterThanOrEqual(2);
  });
});

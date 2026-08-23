import { describe, it, expect } from "vitest";
import { decryptJson, encryptJson, passphraseStrength, rekeyVault, verifyPassphrase } from "./crypto";

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

  it("verifyPassphrase distinguishes right from wrong key", async () => {
    const blob = await encryptJson("correct horse battery staple", { x: 1 });
    expect(await verifyPassphrase("correct horse battery staple", blob)).toBe(true);
    expect(await verifyPassphrase("wrong passphrase!", blob)).toBe(false);
  });

  it("rekeyVault changes the passphrase without losing data", async () => {
    const blob = await encryptJson("old passphrase", { entries: [{ id: "1" }] });
    const rekeyed = await rekeyVault("old passphrase", "new passphrase 42", blob);
    const out = await decryptJson<{ entries: { id: string }[] }>("new passphrase 42", rekeyed);
    expect(out.entries[0].id).toBe("1");
    // old passphrase no longer works on the rekeyed blob
    expect(await verifyPassphrase("old passphrase", rekeyed)).toBe(false);
  });

  it("rekeyVault rejects a wrong old passphrase", async () => {
    const blob = await encryptJson("old passphrase", { x: 1 });
    await expect(rekeyVault("wrong old", "new", blob)).rejects.toThrow();
  });

  it("corrupted base64 never silently restores", async () => {
    const blob = await encryptJson("correct horse battery staple", { secret: "hi" });
    const corrupted = { ...blob, salt: blob.salt.slice(0, -2) + "AA" };
    await expect(decryptJson("correct horse battery staple", corrupted as typeof blob)).rejects.toThrow();
  });

  it("passphraseStrength grades", () => {
    expect(passphraseStrength("short").label).toBe("too short");
    expect(passphraseStrength("LongEnough1!").score).toBeGreaterThanOrEqual(2);
  });
});

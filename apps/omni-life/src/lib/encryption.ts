import CryptoJS from 'crypto-js';

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY is not defined in environment variables.');
  }
  return key;
}

export const encrypt = (text: string): string => {
  return CryptoJS.AES.encrypt(text, getEncryptionKey()).toString();
};

export const decrypt = (ciphertext: string): string => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, getEncryptionKey());
  return bytes.toString(CryptoJS.enc.Utf8);
};



export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

// generate a new key pair for the user
export async function generateKeyPair(): Promise<KeyPair> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey"]
  );

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

// export public key to send to other users
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("spki", publicKey);
  const exportedAsString = arrayBufferToBase64(exported);
  return exportedAsString;
}

// import a public key received from another user
export async function importPublicKey(publicKeyString: string): Promise<CryptoKey> {
  const publicKeyBuffer = base64ToArrayBuffer(publicKeyString);
  
  return await window.crypto.subtle.importKey(
    "spki",
    publicKeyBuffer,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    []
  );
}

// derive a shared encryption key from your private key and their public key
export async function deriveSharedKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  return await window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

// encrypt a message
export async function encryptMessage(
  message: string,
  sharedKey: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  // generate a random initialization vector
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  // encode the message to bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  // encrypt the message
  const encryptedData = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    sharedKey,
    data
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedData),
    iv: arrayBufferToBase64(iv.buffer),
  };
}

// decrypt a message
export async function decryptMessage(
  ciphertext: string,
  iv: string,
  sharedKey: CryptoKey
): Promise<string> {
  const encryptedData = base64ToArrayBuffer(ciphertext);
  const ivBuffer = base64ToArrayBuffer(iv);

  const decryptedData = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBuffer,
    },
    sharedKey,
    encryptedData
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedData);
}

// convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// convert Base64 string to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
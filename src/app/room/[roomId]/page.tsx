/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { useRealtime } from "@/lib/realtime-client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
  KeyPair,
} from "@/lib/crypto";

function formatTimeRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface DecryptedMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  error?: boolean;
}

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const [copyStatus, setCopyStatus] = useState("COPY");
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const { username } = useUsername();
  const router = useRouter();

  const [myKeyPair, setMyKeyPair] = useState<KeyPair | null>(null);
  const [sharedKey, setSharedKey] = useState<CryptoKey | null>(null);
  const [isEncryptionReady, setIsEncryptionReady] = useState(false);
  const [decryptedMessages, setDecryptedMessages] = useState<
    DecryptedMessage[]
  >([]);

  const { data: ttlData } = useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => {
      const res = await client.room.ttl.get({ query: { roomId } });
      return res.data;
    },
  });

  useEffect(() => {
    if (ttlData?.ttl !== undefined) {
      setTimeRemaining(ttlData.ttl);
    }
  }, [ttlData]);

  useEffect(() => {
    if (timeRemaining === null || timeRemaining < 0) return;

    if (timeRemaining === 0) {
      router.push("/?destroyed=true");
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, router]);

  useEffect(() => {
    async function initKeys() {
      try {
        const keyPair = await generateKeyPair();
        setMyKeyPair(keyPair);

        const publicKeyString = await exportPublicKey(keyPair.publicKey);

        await client.keys["share"].post(
          { publicKey: publicKeyString, username },
          { query: { roomId } }
        );

        const keysRes = await client.keys.get({ query: { roomId } });

        const otherUserKey = Object.entries(keysRes.data?.keys || {}).find(
          ([user]) => user !== username
        );

        if (otherUserKey) {
          const [, publicKeyString] = otherUserKey;
          const otherPublicKey = await importPublicKey(
            publicKeyString as string
          );
          const shared = await deriveSharedKey(
            keyPair.privateKey,
            otherPublicKey
          );
          setSharedKey(shared);
          setIsEncryptionReady(true);
        }
      } catch (error) {
        console.error("Failed to initialize encryption:", error);
      }
    }

    if (username && roomId) {
      initKeys();
    }
  }, [username, roomId]);

  const { data: messages, refetch } = useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const res = await client.messages.get({ query: { roomId } });
      return res.data;
    },
  });

  useEffect(() => {
    async function decryptAllMessages() {
      if (!messages?.messages || !sharedKey) return;

      const decrypted: DecryptedMessage[] = [];

      for (const msg of messages.messages) {
        try {
          const text = await decryptMessage(msg.ciphertext, msg.iv, sharedKey);
          decrypted.push({
            id: msg.id,
            sender: msg.sender,
            text,
            timestamp: msg.timestamp,
          });
        } catch (error) {
          console.log(error);
          decrypted.push({
            id: msg.id,
            sender: msg.sender,
            text: "[Decryption failed]",
            timestamp: msg.timestamp,
            error: true,
          });
        }
      }

      setDecryptedMessages(decrypted);
    }

    decryptAllMessages();
  }, [messages, sharedKey]);

  const { mutate: sendMessage } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      if (!sharedKey) throw new Error("Encryption not ready");

      setSending(true);
      const { ciphertext, iv } = await encryptMessage(text, sharedKey);

      await client.messages.post(
        { sender: username, ciphertext, iv },
        { query: { roomId } }
      );
      setSending(false);
    },
  });

  useRealtime({
    channels: [roomId],
    events: ["chat.message", "chat.destroy", "chat.keyShared"],
    onData: async ({ event, data }) => {
      if (event === "chat.message") refetch();
      if (event === "chat.destroy") router.push("/?destroyed=true");

      if (event === "chat.keyShared" && myKeyPair) {
        const { username: otherUser, publicKey: publicKeyString } = data;

        if (otherUser !== username) {
          try {
            const otherPublicKey = await importPublicKey(publicKeyString);
            const shared = await deriveSharedKey(
              myKeyPair.privateKey,
              otherPublicKey
            );
            setSharedKey(shared);
            setIsEncryptionReady(true);
          } catch (error) {
            console.error("Failed to establish encryption:", error);
          }
        }
      }
    },
  });

  const { mutate: destroyRoom, isPending: isDestroying } = useMutation({
    mutationFn: async () => {
      await client.room.delete(null, { query: { roomId } });
    },
  });

  function handleSend() {
    if (!input.trim() || sending || !isEncryptionReady) return;
    const text = input;
    setInput("");
    setSending(true);
    sendMessage({ text });
  }

  function copyLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopyStatus("COPIED!");
    setTimeout(() => setCopyStatus("COPY"), 2000);
  }

  return (
    <main className="flex flex-col h-dvh max-h-dvh overflow-hidden">
      <header className="relative border-b border-zinc-800 p-4 flex flex-col md:flex-row md:items-center md:justify-between bg-zinc-900/30 gap-4 md:gap-0">
        <button
          onClick={() => destroyRoom()}
          className="md:hidden absolute right-4 top-4 bg-red-700 hover:bg-red-700 text-white font-bold px-2 py-0.5 rounded transition-all text-[18px]"
        >
          ✖
        </button>

        <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-500 uppercase">Room ID</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-green-500 text-sm md:text-base">
                {roomId}
              </span>
              <button
                onClick={copyLink}
                className="text-[9px] md:text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {copyStatus}
              </button>
            </div>
          </div>

          <div className="hidden md:block h-8 w-px bg-zinc-800" />

          <div className="flex w-full md:w-auto gap-6 md:gap-8 justify-start md:justify-center">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase">
                self destruct
              </span>
              <span
                className={`text-xs md:text-sm font-bold flex items-center gap-2 ${
                  timeRemaining !== null && timeRemaining < 60
                    ? "text-red-500"
                    : "text-amber-500"
                }`}
              >
                {timeRemaining !== null
                  ? formatTimeRemaining(timeRemaining)
                  : "--:--"}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase">
                Encryption
              </span>
              <span
                className={`text-xs md:text-sm font-bold ${
                  isEncryptionReady ? "text-green-500" : "text-yellow-500"
                }`}
              >
                {isEncryptionReady ? "🔒 ACTIVE" : "⏳ WAITING"}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => destroyRoom()}
          className="hidden md:flex text-sm bg-zinc-800 hover:bg-red-600 px-3 py-1.5 rounded text-zinc-400 hover:text-white font-bold transition-all group items-center gap-2 disabled:opacity-50"
        >
          {isDestroying ? "DESTROYING..." : "DESTROY NOW"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {!isEncryptionReady && (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-500 text-sm font-mono">
              Waiting for user...
            </p>
          </div>
        )}

        {isEncryptionReady && decryptedMessages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-600 text-sm font-mono">
              No messages • End-to-end encrypted
            </p>
          </div>
        )}

        {decryptedMessages.map((msg) => (
          <div key={msg.id} className="flex flex-col items-start">
            <div className="max-w-[80%] group">
              <div className="flex items-baseline gap-3 mb-1">
                <span
                  className={`text-xs font-bold ${
                    msg.sender === username ? "text-green-500" : "text-blue-500"
                  } `}
                >
                  {msg.sender === username ? "YOU" : msg.sender}
                </span>

                <span className="text-[10px] text-zinc-600 ">
                  {format(msg.timestamp, "HH:mm")}
                </span>
              </div>
              <p
                className={`text-sm leading-relaxed break-all ${
                  msg.error ? "text-red-500 italic" : "text-zinc-300"
                }`}
              >
                {msg.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-zinc-800">
        <div className="flex gap-4">
          <div className="flex-1 relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 animate-pulse">
              {">"}
            </span>
            <input
              ref={inputRef}
              value={input}
              disabled={!isEncryptionReady || sending}
              onChange={(e) => !sending && setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              autoFocus
              type="text"
              placeholder={
                isEncryptionReady
                  ? sending
                    ? "Sending..."
                    : "Type encrypted message..."
                  : "Waiting for encryption..."
              }
              className="w-full bg-black border border-zinc-800 text-zinc-100 placeholder:text-zinc-700 py-3 pl-8 pr-4 text-sm disabled:opacity-50"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!input.trim() || !isEncryptionReady || sending}
            className="bg-zinc-800 text-zinc-400 px-6 text-sm font-bold transition-all disabled:opacity-50"
          >
            {sending ? "..." : "SEND"}
          </button>
        </div>
      </div>
    </main>
  );
}

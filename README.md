# 🔒 Private Chat - Self-Destructing End-to-End Encrypted Chat

A secure chat application where messages are end-to-end encrypted and rooms automatically self-destruct after 10 minutes. Perfect for sharing sensitive information that shouldn't persist.

## ✨ Features

- 🔐 **End-to-End Encryption** - Messages are encrypted in your browser; the server cannot read them
- ⏱️ **Self-Destructing Rooms** - Rooms automatically expire after 10 minutes
- 🚀 **Real-time Updates** - Instant message delivery using WebSocket subscriptions

## 🔐 How Encryption Works

```
┌─────────────┐                    ┌─────────────┐
│   User A    │                    │   User B    │
│             │                    │             │
│ Private Key │                    │ Private Key │
│ Public Key  │─────────────┐      │ Public Key  │
└─────────────┘             │      └─────────────┘
       │                    │             │
       │                    ▼             │
       │              ┌──────────┐        │
       │              │  Server  │        │
       │              │ (Relays  │        │
       │              │  Keys)   │        │
       │              └──────────┘        │
       │                    │             │
       │◄───────────────────┘─────────────┘
       │                                  │
       ▼                                  ▼
  Derive Shared Key                 Derive Shared Key
  (Your Private +                   (Your Private +
   Their Public)                     Their Public)
       │                                  │
       └──────────► SAME KEY ◄────────────┘
                        │
                        ▼
              All Messages Encrypted
              with This Shared Key
```

**The server NEVER sees:**
- Your private keys
- The shared encryption key
- Unencrypted message content

## 🛠️ Tech Stack

### Frontend
- **[Next.js 15](https://nextjs.org/)** - React framework with App Router
- **[React Query](https://tanstack.com/query)** - Data fetching and state management
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first styling
- **Web Crypto API** - Browser-native encryption

### Backend
- **[Elysia.js](https://elysiajs.com/)** - Fast, type-safe backend framework
- **[Upstash Redis](https://upstash.com/)** - Serverless Redis for data storage
- **[Upstash Realtime](https://upstash.com/docs/redis/features/realtime)** - WebSocket-based real-time updates

### Type Safety
- **[TypeScript](https://www.typescriptlang.org/)** - End-to-end type safety
- **[Zod](https://zod.dev/)** - Runtime type validation
- **[Eden Treaty](https://elysiajs.com/eden/treaty/overview.html)** - Fully typed API client

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- Upstash Redis database ([setup upstash](https://upstash.com/))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/private-chat.git
   cd private-chat
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file:
   ```env
   UPSTASH_REDIS_REST_URL=your_redis_url
   UPSTASH_REDIS_REST_TOKEN=your_redis_token
   NEXT_PUBLIC_API_URL=http://localhost:3000
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 How to Use

### Creating a Room

1. Visit the homepage
2. Your anonymous username is automatically generated
3. Click **"CREATE SECURE ROOM"**
4. Share the room URL with someone you want to chat with

### Joining a Room

1. Open the room link shared with you
2. Wait for encryption to initialize (🔒 ACTIVE status)
3. Start sending encrypted messages!

### Security Indicators

- **⏳ WAITING** - Establishing secure connection
- **🔒 ACTIVE** - End-to-end encryption enabled
- **🔒 Icon** - Appears next to encrypted messages

### Room Expiration

- Rooms last **10 minutes** from creation
- Timer displays remaining time in the header
- All messages are permanently deleted when:
  - The timer reaches zero
  - Someone clicks "DESTROY NOW"

## 🏗️ Project Structure

```
private-chat/
├── app/
│   ├── api/
│   │   └── [[...slugs]]/
│   │       └── route.ts          # Backend API routes
│   ├── room/
│   │   └── [roomId]/
│   │       └── page.tsx           # Chat room interface
│   └── page.tsx                   # Homepage/lobby
├── lib/
│   ├── crypto.ts                  # Encryption utilities
│   ├── client.ts                  # Type-safe API client
│   ├── redis.ts                   # Redis configuration
│   ├── realtime.ts                # WebSocket schema
│   └── realtime-client.ts         # Client-side WebSocket hook
└── hooks/
    └── use-username.ts            # Username generation
```

## 🔒 Security Features

### Encryption Details

- **Algorithm**: ECDH (P-256 curve) + AES-GCM (256-bit)
- **Key Exchange**: Elliptic Curve Diffie-Hellman
- **Message Encryption**: AES-GCM with random IV per message
- **Authentication**: Built-in message authentication (prevents tampering)

### Privacy Features

- ✅ Zero-knowledge architecture (server can't decrypt)
- ✅ No message persistence after expiration
- ✅ No user authentication required
- ✅ Anonymous usernames
- ✅ Automatic key rotation on page refresh
- ✅ No message history on server

### Limitations

- Messages are encrypted in transit and at rest on the server
- If you refresh the page, you'll need to re-establish encryption
- Previous messages can't be decrypted after key regeneration
- Two-person rooms only (can be extended for group chat)


## 📝 API Routes

### Rooms
- `POST /api/room/create` - Create new room
- `GET /api/room/ttl` - Get room time remaining
- `DELETE /api/room` - Destroy room immediately

### Keys
- `POST /api/keys/share` - Share public key
- `GET /api/keys` - Get all public keys in room

### Messages
- `POST /api/messages` - Send encrypted message
- `GET /api/messages` - Get all encrypted messages

### Real-time Events
- `chat.message` - New message received
- `chat.destroy` - Room destroyed
- `chat.keyShared` - New user's public key available


## ⚠️ Disclaimer

This application is designed for educational purposes and demonstration of end-to-end encryption. While it implements industry-standard encryption (ECDH + AES-GCM), it has not undergone a professional security audit. For production use with highly sensitive data, please:

- Conduct a thorough security audit
- Implement additional security measures
- Consider using established encrypted messaging protocols (Signal Protocol, etc.)
- Add rate limiting and abuse prevention
- Implement proper authentication for production environments

---

**:)**
import { redis } from '@/lib/redis'
import { Elysia } from 'elysia'
import { nanoid } from 'nanoid'
import { authMiddleware } from './auth'
import { z } from 'zod'
import { Message, realtime } from '@/lib/realtime'

const ROOM_TTL_SECONDS = 60 * 10

const rooms = new Elysia({ prefix: "/room"})
    .post("/create", async () => {
        const roomId = nanoid()

        await redis.hset(`meta:${roomId}`, {
            connected: [],
            createdAt: Date.now()
        })

        await redis.expire(`meta:${roomId}`, ROOM_TTL_SECONDS)

        return { roomId }
    })
    .use(authMiddleware)
    .get("/ttl", async ({ auth }) => {
        const ttl = await redis.ttl(`meta:${auth.roomId}`)
        return {
            ttl: ttl > 0 ? ttl : 0
        }
    }, {
        query: z.object({
            roomId: z.string()
        })
    })
    .delete("/", async ({ auth }) => {
        await realtime.channel(auth.roomId).emit("chat.destroy", { isDestroyed: true })

        await Promise.all([
            redis.del(auth.roomId),
            redis.del(`meta:${auth.roomId}`),
            redis.del(`messages:${auth.roomId}`),
            redis.del(`keys:${auth.roomId}`)
        ])
    }, {
        query: z.object({
            roomId: z.string()
        })
    })

const keys = new Elysia({ prefix: "/keys" })
    .use(authMiddleware)
    .post("/share", async ({ body, auth }) => {
        const { publicKey, username } = body
        const { roomId } = auth

        await redis.hset(`keys:${roomId}`, {
            [username]: publicKey
        })

        const remaining = await redis.ttl(`meta:${roomId}`)
        await redis.expire(`keys:${roomId}`, remaining)

        await realtime.channel(roomId).emit("chat.keyShared", { 
            username,
            publicKey 
        })

        return { success: true }
    }, {
        query: z.object({
            roomId: z.string()
        }),
        body: z.object({
            publicKey: z.string(),
            username: z.string()
        })
    })
    .get("/", async ({ auth }) => {
        const { roomId } = auth
        
        const keys = await redis.hgetall(`keys:${roomId}`)
        
        return { keys: keys || {} }
    }, {
        query: z.object({
            roomId: z.string()
        })
    })

const messages = new Elysia({ prefix: "/messages" })
    .use(authMiddleware)
    .post("/", async ({ body, auth }) => {
        const { sender, ciphertext, iv } = body
        const { roomId } = auth

        const roomExists = await redis.exists(`meta:${roomId}`)

        if (!roomExists) {
            throw new Error("Room does not exist")
        }

        const message: Message = {
            id: nanoid(),
            sender,
            ciphertext,
            iv,
            timestamp: Date.now(),
            roomId
        }

        await redis.rpush(`messages:${roomId}`, {
            ...message, 
            token: auth.token
        })

        await realtime.channel(roomId).emit("chat.message", message)
        
        const remaining = await redis.ttl(`meta:${roomId}`)

        await redis.expire(`messages:${roomId}`, remaining)
        await redis.expire(roomId, remaining)

    }, {
        query: z.object({
            roomId: z.string()
        }),
        body: z.object({
            sender: z.string().max(100),
            ciphertext: z.string(),
            iv: z.string()
        })
    })
    .get("/", async ({ auth }) => {
        const messages = await redis.lrange<Message>(`messages:${auth.roomId}`, 0, -1)

        return {
            messages: messages.map((m) => ({
                ...m,
                token: m.token === auth.token ? auth.token : undefined
            }))
        }
    }, {
        query: z.object({
            roomId: z.string()
        })
    })

const app = new Elysia({ prefix: '/api' })
    .use(rooms)
    .use(messages)
    .use(keys)

export type App = typeof app

export const GET = app.fetch
export const POST = app.fetch
export const DELETE = app.fetch
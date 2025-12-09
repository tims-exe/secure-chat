import { InferRealtimeEvents, Realtime } from "@upstash/realtime";
import z from "zod";
import { redis } from "./redis";

const message = z.object({
    id: z.string(),
    sender: z.string(),
    ciphertext: z.string(),
    iv: z.string(),
    timestamp: z.number(),
    roomId: z.string(),
    token: z.string().optional()
})

const schema = {
    chat: {
        message: message,
        destroy: z.object({
            isDestroyed: z.literal(true)
        }),
        keyShared: z.object({
            username: z.string(),
            publicKey: z.string()
        })
    }
}

export const realtime = new Realtime({
    schema, 
    redis
})

export type RealtimeEvents = InferRealtimeEvents<typeof realtime>
export type Message = z.infer<typeof message>
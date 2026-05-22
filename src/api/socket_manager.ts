import { GeminiWSClient } from "./gemini_ws_client";
import { TypeTipBus } from "../core/bus";

export class SocketManager {
    private static instances: Map<string, GeminiWSClient> = new Map();

    static getOrCreate(channelId: string, apiKey: string): GeminiWSClient {
        if (!this.instances.has(channelId)) {
            // Создаем новую Жменю-инстанс
            const client = new GeminiWSClient(apiKey, channelId);
            this.instances.set(channelId, client);
        }
        return this.instances.get(channelId)!;
    }
}
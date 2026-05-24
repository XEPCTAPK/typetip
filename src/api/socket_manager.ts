/**
 * @fileoverview Менеджер инстансов сокетов, подключенный к технологическому шлюзу шины.
 */
import { TypeTipBus, GeminiWSClient } from "../core/bus"; // <-- ИМПОРТ ИЗ ШИНЫ

export class SocketManager {
    private static instances: Map<string, GeminiWSClient> = new Map();

    static getOrCreate(channelId: string, apiKey: string): GeminiWSClient {
        if (!this.instances.has(channelId)) {
            // Создаем инстанс. Если USE_WEBSOCKET === 0, создастся безопасная заглушка
            const client = new GeminiWSClient(apiKey, channelId);
            this.instances.set(channelId, client);
        }
        return this.instances.get(channelId)!;
    }
}
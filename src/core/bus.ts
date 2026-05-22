// * Глобальная шина событий TypeTipBus
export type EventType = 'SEND_PROMPT' | 'WS_DATA_RECEIVED' | 'WS_STATUS';

export class TypeTipBus {
    private static listeners: Map<EventType, Set<Function>> = new Map();

    static on(event: EventType, callback: Function) {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event)!.add(callback);
    }

    static emit(event: EventType, data: any) {
        this.listeners.get(event)?.forEach(cb => cb(data));
    }
}

export interface TypeTipMessage {
    channelId: string;
    type: 'TEXT' | 'IMAGE' | 'JSON_DATA' | 'SYSTEM_LOG'; // Добавляем типы
    payload: any; // Сам контент
    turnComplete?: boolean;
}
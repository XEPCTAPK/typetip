// src/events/shadow_listener.ts
import * as vscode from 'vscode';
import { TypeTipBus } from '../core/bus';

export function setupShadowTriggers(context: vscode.ExtensionContext) {
    // Слушаем изменение курсора
    vscode.window.onDidChangeTextEditorSelection((event) => {
        // Если курсор долго стоит на месте — шлем сигнал модели
        TypeTipBus.emit('SEND_PROMPT', { type: 'IDLE_ANALYSIS', position: event.selections[0].active });
    });

    // Слушаем ошибки (диагностику)
    vscode.languages.onDidChangeDiagnostics((event) => {
        TypeTipBus.emit('SEND_PROMPT', { type: 'ERROR_ANALYSIS', file: event.uris[0] });
    });
}
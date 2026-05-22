/**
 * @fileoverview Главная точка входа расширения VS Code (Extension Lifecycle).
 * Управляет активацией, инициализирует статус-бар с механикой минимализма и запускает PTY.
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

import * as vscode from 'vscode';
import { TypeTipTerminal } from './engine/terminal';
import { openVibeGameTab } from './view/renderer';
import { openVibeChatWebview } from './view/chat_panel';
import { SaveTriggerManager } from "./events/save_trigger";
import { GeminiWSClient } from './api/gemini_ws_client';
import { LiveEditorConnector } from './core/live_editor_connector';

// Глобальная ссылка на единственный экземпляр терминала в рамках сессии VS Code
let activeTerminalInstance: vscode.Terminal | null = null;

// Выносим указатель на статус-бар в глобальную область модуля для доступа при обновлении
let statusBarItem: vscode.StatusBarItem;

let clientInstance: GeminiWSClient | undefined;

// Экспорт функции, которая безопасно вернет клиент
export function getGeminiClient(): GeminiWSClient {
    if (!clientInstance) {
        throw new Error("Жменя еще не проснулась! Клиент не инициализирован.");
    }
    return clientInstance;
  }

export function activate(context: vscode.ExtensionContext): void {
  console.log("[Typetip]: Запуск протоколов TJMIWGVCEC...");

  // 1. РЕГИСТРАЦИЯ КОМАНДЫ ЗАПУСКА (ОБЕСПЕЧИВАЕТ SINGLE INSTANCE)
  const startCommand = vscode.commands.registerCommand('typetip.start', async () => {
    vscode.window.showInformationMessage("[11mc TIP]: Главный модуль активирован!");
    
    // Если экземпляр уже существует, проверяем, не закрыл ли его пользователь
    if (activeTerminalInstance) {
      try {
        // Пробуем деликатно поднять и сфокусировать существующее окно
        activeTerminalInstance.show(true);
        // Дублируем фокус на панель, если мы в режиме подвала
        await vscode.commands.executeCommand('workbench.action.terminal.focus');
        return; // Тормозим выполнение, не плодим новые вкладки!
      } catch (e) {
        // Если объект в памяти остался, но терминал был убит крестиком — сбрасываем ссылку
        activeTerminalInstance = null;
      }
    }

    // Читаем пользовательскую конфигурацию дисплея перед созданием
    const config = vscode.workspace.getConfiguration('typetip');
    const displayMode = config.get<string>('terminalDisplayMode') || 'editor';

    // Инстанцируем наше кастомное PTY-ядро
    const pty = new TypeTipTerminal(context);
    
    // Собираем опции конфигурации
    const terminalOptions: vscode.ExtensionTerminalOptions = {
      name: 'TypeTip Studio',
      pty: pty
    };

    // Создаем единственный легальный терминал
    activeTerminalInstance = vscode.window.createTerminal(terminalOptions);

    // Переносим терминал во вкладку, если настроен режим editor или maximal
    if (displayMode === 'editor' || displayMode === 'maximal') {
      await vscode.commands.executeCommand('workbench.action.terminal.moveToEditor');
    }

    // Показываем интерфейс пользователю
    activeTerminalInstance.show();

    // Подгоняем Дзен-режим для максимального визуала
    if (displayMode === 'maximal') {
      await vscode.commands.executeCommand('workbench.action.toggleZenMode');
    } else if (displayMode === 'panel') {
      await vscode.commands.executeCommand('workbench.action.terminal.focus');
    }

    // Обновляем статус-бар корпорации
    updateStatusBar(context);
  });

  // 2. СЛУШАТЕЛЬ УНИЧТОЖЕНИЯ ТЕРМИНАЛА (ДЛЯ СБРОСА ССЫЛКИ)
  const onTerminalClose = vscode.window.onDidCloseTerminal((closedTerminal) => {
    if (activeTerminalInstance && closedTerminal === activeTerminalInstance) {
      activeTerminalInstance = null;
      console.log('Сессия TypeTip Studio уничтожена пользователем. Ссылка сброшена.');
    }
  });

  context.subscriptions.push(startCommand, onTerminalClose);

  // 3. ИНИЦИАЛИЗАЦИЯ СТАТУС-БАРА
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'typetip.start';
  statusBarItem.tooltip = 'Запустить интерактивную кодинг-студию TypeTip';
  
  context.subscriptions.push(statusBarItem);

  // Отрисовываем актуальное состояние кнопки при старте VS Code
  updateStatusBar(context);
  statusBarItem.show();

  // 4. РЕГИСТРАЦИЯ КОМАНДЫ GAME-ИНТЕРФЕЙСА
  const vibeGameCommand = vscode.commands.registerCommand('typetip.startVibeGameOne', async () => {
        await openVibeGameTab();
        console.log("[11mc TIP -> ЮЗЕР]: Открыта вкладка кибер-тира.");
    });
  context.subscriptions.push(vibeGameCommand);

  // 5. РЕГИСТРАЦИЯ КОМАНДЫ ЖИВОГО ЧАТА (WEBVIEW)
  const chatCommand = vscode.commands.registerCommand('vibecoding.openChatSite', () => {
        openVibeChatWebview(context);
        console.log("[11mc TIP -> ЮЗЕР]: Запущен Webview чат Жмини.");
    });
    context.subscriptions.push(chatCommand);

  // 6. ЗАПУСК ПЕРЕХВАТЧИКА СОХРАНЕНИЙ (ОДИН КОРРЕКТНЫЙ ВЫЗОВ)
    SaveTriggerManager.register(context);
    console.log("[Typetip]: Автоматический перехват сохранения успешно запущен.");
  console.log("[Typetip]: Все системы успешно зарегистрированы в рантайме.");




// 1. Вытаскиваем твой ключ из globalState (как в твоем коде)
    const apiKey = context.globalState.get<string>('geminiApiKey') || ""; 
    
    if (apiKey) {
        // 2. Инициализируем твой родной клиент
        const geminiClient = new GeminiWSClient(apiKey);
        
        // 3. Запускаем наш живой коннектор к вкладкам
        const liveConnector = new LiveEditorConnector(geminiClient);
        liveConnector.activate(context);
    } else {
        console.log("[Typetip]: Ключ geminiApiKey не найден, Live-режим Жмени ждет авторизации.");
    }






















}

/**
 * Механика минимализма: скрывает текст "VibeType", оставляя только иконку клавиатуры,
 * если пользователь отточил навык и прошел более 10 сессий.
 */
function updateStatusBar(context: vscode.ExtensionContext): void {
  // Подтягиваем сессии напрямую из встроенного Global State
  const sessionCount = context.globalState.get<number>('sessionNum', 1) - 1;

  statusBarItem.text = (sessionCount > 10) 
    ? `$(keyboard)` 
    : `$(keyboard) VibeType`;
}

/**
 * Вызывается автоматически при выгрузке расширения.
 */
export function deactivate(): void {
  console.log("[Typetip]: Модули выгружены из памяти.");
}
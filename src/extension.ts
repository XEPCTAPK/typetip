/**
 * @fileoverview Главная точка входа расширения VS Code (Extension Lifecycle).
 * Управляет активацией, инициализирует статус-бар с механикой минимализма и запускает PTY.
 * * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation; xepctapk (ц) //™
 */

import * as vscode from 'vscode';
import { TypeTipTerminal } from './engine/terminal';
import { openVibeGameTab } from './view/renderer'; // Импортируем наш новый файл
import { openVibeChatWebview } from './view/chat_panel';

// Глобальная ссылка на единственный экземпляр терминала в рамках сессии VS Code
let activeTerminalInstance: vscode.Terminal | null = null;

// Выносим указатель на статус-бар в глобальную область модуля для доступа при обновлении
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  console.log('TypeTip Studio успешно успешно активировано АИ Crew!');

  // 1. РЕГИСТРАЦИЯ КОМАНДЫ ЗАПУСКА (ОБЕСПЕЧИВАЕТ SINGLE INSTANCE)
  const startCommand = vscode.commands.registerCommand('typetip.start', async () => {
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
      // Если юзер грохнул нашу вкладку, зануляем трекер, позволяя создать её снова при следующем клике
      activeTerminalInstance = null;
      console.log('Сессия TypeTip Studio уничтожена пользователем. Ссылка сброшена.');
    }
  });

  context.subscriptions.push(startCommand, onTerminalClose);


  // 2. ИНИЦИАЛИЗАЦИЯ СТАТУС-БАРА
  // Размещаем кнопку в левой части статус-бара с приоритетом 100 (чтобы не прыгала)
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'typetip.start'; // Привязываем команду запуска к клику
  statusBarItem.tooltip = 'Запустить интерактивную кодинг-студию TypeTip';
  
  context.subscriptions.push(statusBarItem);

  // Отрисовываем актуальное состояние кнопки при старте VS Code
  updateStatusBar(context);
  statusBarItem.show();





// Регистрируем команду запуска нашего приключения
    let disposable = vscode.commands.registerCommand('typetip.startVibeGameOne', async () => {
        // Вызываем функцию открытия вкладки, которую мы только что написали
        await openVibeGameTab();
    });

    context.subscriptions.push(disposable);


// Регистрируем команду вызова живой веб-вкладки
    let chatCommand = vscode.commands.registerCommand('vibecoding.openChatSite', () => {
        openVibeChatWebview(context);
    });

    context.subscriptions.push(chatCommand);




















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






export function deactivate(): void {
  // Ресурсы статус-бара автоматически очистятся через context.subscriptions
}
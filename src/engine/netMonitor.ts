/**
 * @fileoverview Экран интерактивного TUI-мониторинга сетевой активности.
 * Визуализирует сетевые соединения, процессы и удаленные хосты в виде таблицы.
 * © The 'Just Make It Work' Group Vibe Coding Enterprises Corporation //™
 */

import { IScreen, IScreenContext } from '../engine/interfaces';
import { AppRouter } from '../engine/router';
import { NetScanner, NetConnection } from '../engine/netScanner';

export class NetMonitorScreen implements IScreen {
  private ctx!: IScreenContext;
  private scanner = new NetScanner();
  private connections: NetConnection[] = [];
  private updateInterval: NodeJS.Timeout | undefined;
  private scanCount = 0;

  // ANSI Элементы интерфейса
  private readonly RESET = '\x1b[0m';
  private readonly BOLD = '\x1b[1m';
  private readonly DIM = '\x1b[2m';
  private readonly CYAN = '\x1b[1;96m';
  private readonly GREEN = '\x1b[1;92m';
  private readonly RED = '\x1b[31m';
  private readonly AMBER = '\x1b[1;93m';

  constructor(private router: AppRouter) {}

  public async init(ctx: IScreenContext): Promise<void> {
    this.ctx = ctx;
    this.scanCount = 0;
    this.connections = await this.scanner.scan();
    
    // Автообновление таблицы каждые 2 секунды
    this.updateInterval = setInterval(async () => {
      this.connections = await this.scanner.scan();
      this.scanCount++;
      this.router.refresh();
    }, 2000);
  }

  public render(): string {
    const w = this.ctx.terminalWidth;
    let s = '\x1b[?7l\x1b[2J\x1b[3J\x1b[H\r\n';

    // Заголовок
    s += ' '.repeat(Math.max(0, Math.floor((w - 56) / 2))) + `${this.CYAN}${this.BOLD}📡 NETWORK CONNECTION DETECTOR & ANALYZER 📡${this.RESET}\r\n`;
    s += ' '.repeat(Math.max(0, Math.floor((w - 56) / 2))) + `${this.DIM}CORE SNIFFER ENGINE // SCANS RUNNING: ${this.RESET}${this.scanCount}${this.RESET}\r\n`;
    s += ' '.repeat(Math.max(0, Math.floor((w - 60) / 2))) + `${this.DIM}${'-'.repeat(60)}${this.RESET}\r\n\r\n`;

    // Шапка таблицы
    let tableHeader = `  ${this.BOLD}${'ПРОЦЕСС'.padEnd(18)}  ${'PID'.padEnd(6)}  ${'ПРОТОКОЛ'.padEnd(9)}  ${'УДАЛЕННЫЙ АДРЕС'.padEnd(25)}  ${'СТАТУС'}${this.RESET}\r\n`;
    s += tableHeader;
    s += '  ' + `${this.DIM}${'-'.repeat(w - 6)}${this.RESET}\r\n`;

    // Вывод строк с коннектами
    if (this.connections.length === 0) {
      s += `\r\n${this.center(`${this.DIM}[ Активных внешних веб-соединений не обнаружено ]${this.RESET}`, w)}\r\n`;
    } else {
      this.connections.forEach(c => {
        const procStr = `${this.GREEN}${c.processName.slice(0, 17).padEnd(18)}${this.RESET}`;
        const pidStr = `${this.DIM}${c.pid.padEnd(6)}${this.RESET}`;
        const protoStr = `${this.AMBER}${c.protocol.padEnd(9)}${this.RESET}`;
        const addrStr = `${c.remoteAddr.slice(0, 24).padEnd(25)}`;
        
        let statusStr = c.status;
        if (statusStr === 'ESTABLISHED') statusStr = `${this.GREEN}ESTABLISHED${this.RESET}`;
        if (statusStr === 'CLOSE_WAIT') statusStr = `${this.RED}CLOSE_WAIT${this.RESET}`;

        s += `   ${procStr}  ${pidStr}  ${protoStr}  ${addrStr}  ${statusStr}\r\n`;
      });
    }

    s += '\r\n  ' + `${this.DIM}${'-'.repeat(w - 6)}${this.RESET}\r\n`;
    s += `\r\n${this.center(`${this.DIM}Нажмите ${this.RESET}[ESC]${this.DIM} или ${this.RESET}[BACKSPACE]${this.DIM} для возврата в Главный Хаб`, w)}\r\n`;

    return s;
  }

  public handleInput(data: string): void {
    // Выход обратно в меню по ESC или Backspace
    if (data === '\x1b' || data === '\x7f' || data === '\x08') {
      this.router.navigateTo('HUB_MENU' as any); // Возврат в Хаб
    }
  }

  public resize(width: number, height: number): void {
    this.ctx.terminalWidth = width;
    this.ctx.terminalHeight = height;
    this.router.refresh();
  }

  public dispose(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  private center(text: string, width: number): string {
    const clean = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    const pad = Math.max(0, Math.floor((width - clean.length) / 2));
    return ' '.repeat(pad) + text;
  }
}
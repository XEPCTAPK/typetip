import { IScreen, IScreenContext } from '../engine/interfaces';




export class NewScreen implements IScreen {
  public init(ctx: IScreenContext): void {}
  public handleInput(data: string): void {}
  public render(): string { return '\x1b[H\x1b[J NEW SCREEN'; }
}

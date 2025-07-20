declare module 'stats.js' {
  export default class Stats {
    constructor();
    dom: HTMLElement;
    begin(): void;
    end(): void;
    showPanel(panel: number): void;
  }
} 
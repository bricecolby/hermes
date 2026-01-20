type PracticeItemJson = any;

type Generator = {
  generate: (
    type: string,
    ctx: any,
    onPartial?: (text: string) => void,
    opts?: { maxAttempts?: number }
  ) => Promise<{ ok: boolean; parsed?: PracticeItemJson }>;
};

export class PracticePrefetcher {
  private queue: PracticeItemJson[] = [];
  private generating = false;

  constructor(
    private generator: Generator,
    private type: string,
    private ctx: any,
    private batchSize = 2,
    private targetBuffer = 4,
    private lowWatermark = 2
  ) {}

  get size() {
    return this.queue.length;
  }

  peek() {
    return this.queue[0] ?? null;
  }

  pop() {
    return this.queue.shift() ?? null;
  }

  async prime() {
    if (this.queue.length > 0) return;
    await this.refillToTarget();
  }

  async fillIfNeeded() {
    if (this.queue.length >= this.lowWatermark) return;
    await this.refillToTarget();
  }

  private async refillToTarget() {
    if (this.generating) return;
    this.generating = true;
    try {
      while (this.queue.length < this.targetBuffer) {
        const items: PracticeItemJson[] = [];

        for (let i = 0; i < this.batchSize; i++) {
          const res = await this.generator.generate(this.type, this.ctx, undefined, {
            maxAttempts: 3,
          });

          if (res.ok && res.parsed) items.push(res.parsed);
        }

        if (items.length === 0) break;

        this.queue.push(...items);
      }
    } finally {
      this.generating = false;
    }
  }
}

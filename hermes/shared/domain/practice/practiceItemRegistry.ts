// shared/domain/practice/practiceItemRegistry.ts
import { z } from "zod";
import { PracticeItem } from "./practiceItem";
import { PracticeItemBaseSchema } from "./practiceItemSchemas";

export class UnsupportedPracticeItemTypeError extends Error {
  public readonly type: string;

  constructor(type: string, supportedTypes: string[]) {
    super(
      `Unsupported PracticeItem type: "${type}". ` +
        `Supported types are: ${
          supportedTypes.length ? supportedTypes.join(", ") : "(none)"
        }`
    );
    this.name = "UnsupportedPracticeItemTypeError";
    this.type = type;
  }
}

type PracticeItemFactory<T> = (json: T) => PracticeItem;

type Registration<T> = {
  schema: z.ZodType<T>;
  factory: PracticeItemFactory<T>;
};

export class PracticeItemRegistry {
  private readonly registrations = new Map<string, Registration<any>>();

  register<T extends { type: string }>(
    type: string,
    schema: z.ZodType<T>,
    factory: PracticeItemFactory<T>
  ) {
    if (!type) throw new Error("PracticeItemRegistry.register: type is required.");
    if (this.registrations.has(type)) {
      throw new Error(`PracticeItemRegistry.register: type "${type}" is already registered.`);
    }
    this.registrations.set(type, { schema, factory });
  }

  isSupported(type: string): boolean {
    return this.registrations.has(type);
  }

  supportedTypes(): string[] {
    return Array.from(this.registrations.keys()).sort();
  }

  create(json: unknown): PracticeItem {
    // 1) Base gate (good error messages)
    const base = PracticeItemBaseSchema.parse(json);
    const type = base.type;

    // 2) Type gate
    const reg = this.registrations.get(type);
    if (!reg) {
      throw new UnsupportedPracticeItemTypeError(type, this.supportedTypes());
    }

    // 3) Full validation
    const parsed = reg.schema.parse(json);

    // 4) Rehydrate
    return reg.factory(parsed);
  }
}

export const practiceItemRegistry = new PracticeItemRegistry();

import { PracticeItem, PracticeItemJSON } from "./practiceItem";

export class UnsupportedPracticeItemTypeError extends Error {
    public readonly type: string;

    constructor(type: string, supportedTypes: string[]) {
        super(
            `Unsupported PracticeItem type: "${type}". ` +
            `Supported types are: ${supportedTypes.length ? supportedTypes.join(", ") : "(none)"}`
        );
        this.name = "UnsupportedPracticeItemTypeError";
        this.type = type;
    }
}

type PracticeItemFactory = (json: PracticeItemJSON) => PracticeItem;

export class PracticeItemRegistry {
    private readonly factories = new Map<string, PracticeItemFactory>();

    register(type: string, factory: PracticeItemFactory) {
        if (!type) throw new Error("PracticeItemRegistry.register: type is required.");
        if (this.factories.has(type)) {
            throw new Error(`PracticeItemRegistry.register: type "${type}" is already registered.`);
        }
        this.factories.set(type, factory);
    }

    isSupported(type: string): boolean {
        return this.factories.has(type);
    }

    supportedTypes(): string[] {
        return Array.from(this.factories.keys()).sort();
    }

    create(json: unknown): PracticeItem {
        PracticeItem.assertBaseShape(json);
        const type = json.type;

        const factory = this.factories.get(type);
        if (!factory) {
            throw new UnsupportedPracticeItemTypeError(type, this.supportedTypes());
        }
        return factory(json);
    }
}

export const practiceItemRegistry = new PracticeItemRegistry();
export type AiProvider = {
  generate(input: unknown): Promise<unknown>;
};

export class UnconfiguredAiProvider implements AiProvider {
  async generate(): Promise<unknown> {
    throw new Error("AI provider not configured");
  }
}

import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private client: OpenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): OpenAI {
    if (!this.client) {
      const key = this.config.get<string>('OPENAI_API_KEY');
      if (!key) {
        throw new ServiceUnavailableException(
          'OPENAI_API_KEY manquant : configurez la clé API dans .env',
        );
      }
      this.client = new OpenAI({ apiKey: key });
    }
    return this.client;
  }

  embeddingModel(): string {
    return this.config.get<string>(
      'OPENAI_EMBEDDING_MODEL',
      'text-embedding-3-small',
    );
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    const client = this.getClient();
    const model = this.embeddingModel();
    const out: number[][] = [];
    const batchSize = 100;
    for (let i = 0; i < texts.length; i += batchSize) {
      const chunk = texts.slice(i, i + batchSize);
      const res = await client.embeddings.create({
        model,
        input: chunk,
      });
      const ordered = res.data.sort((a, b) => a.index - b.index);
      for (const d of ordered) {
        out.push(d.embedding);
      }
    }
    return out;
  }

  async embedOne(text: string): Promise<number[]> {
    const [v] = await this.embedTexts([text]);
    return v;
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) {
      return 0;
    }
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
  }

  parseEmbedding(json: string | null | undefined): number[] | null {
    if (!json) {
      return null;
    }
    try {
      const arr = JSON.parse(json) as unknown;
      if (!Array.isArray(arr)) {
        return null;
      }
      return arr.map((x) => Number(x));
    } catch {
      this.logger.warn('Invalid embedding JSON');
      return null;
    }
  }

  stringifyEmbedding(vec: number[]): string {
    return JSON.stringify(vec);
  }
}

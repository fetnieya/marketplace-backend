import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { APIError } from 'openai';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import OpenAI from 'openai';
import { Image } from '../image/image.entity';
import { Product, ProductStatus } from '../product/product.entity';
import { User, UserRole } from '../user/user.entity';
import { ForecastService } from '../forecast/forecast.service';
import { EmbeddingService } from './embedding.service';
import { ChatHistoryItemDto, ChatRequestDto } from './dto/chat-request.dto';

export interface RecommendedProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  discount?: number;
  image?: string | null;
  categoryName?: string;
}

export interface ChatResponseDto {
  reply: string;
  recommended: RecommendedProduct[];
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private openai: OpenAI | null = null;

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly embeddingService: EmbeddingService,
    private readonly config: ConfigService,
    private readonly forecastService: ForecastService,
  ) {}

  private getOpenAI(): OpenAI {
    if (!this.openai) {
      const key = this.config.get<string>('OPENAI_API_KEY');
      if (!key) {
        throw new ServiceUnavailableException(
          'OPENAI_API_KEY is not configured',
        );
      }
      this.openai = new OpenAI({ apiKey: key });
    }
    return this.openai;
  }

  chatModel(): string {
    return this.config.get<string>('OPENAI_CHAT_MODEL', 'gpt-4o');
  }

  private productDoc(p: Product): string {
    const cat = (p as any).category?.name ?? '';
    return [p.name, p.description, cat ? `Catégorie: ${cat}` : '']
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  /** Load in-stock disponible products with category, images (for thumbnails) and embedding column */
  private async loadCatalogForRag(): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.images', 'images')
      .addSelect('product.embeddingJson')
      .where('product.status = :st', { st: ProductStatus.DISPONIBLE })
      .andWhere('product.quantity > 0')
      .getMany();
  }

  /** Même logique que ProductService : 1re image (blob → data URL) ou champ legacy `image` */
  private productImageUrl(p: Product): string | null {
    const imgs = p.images as Image[] | undefined;
    if (imgs && imgs.length > 0) {
      const sorted = [...imgs].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      );
      const first = sorted[0];
      if (first?.data && Buffer.isBuffer(first.data)) {
        return `data:image/jpeg;base64,${first.data.toString('base64')}`;
      }
    }
    if (p.image && typeof p.image === 'string' && p.image.trim()) {
      return p.image.trim();
    }
    return null;
  }

  private async ensureEmbeddings(products: Product[]): Promise<void> {
    const missing = products.filter((p) => !p.embeddingJson);
    if (missing.length === 0) {
      return;
    }
    const texts = missing.map((p) => this.productDoc(p));
    const vectors = await this.embeddingService.embedTexts(texts);
    for (let i = 0; i < missing.length; i++) {
      missing[i].embeddingJson = this.embeddingService.stringifyEmbedding(
        vectors[i],
      );
    }
    await this.productRepository.save(missing);
  }

  private toRecommended(p: Product): RecommendedProduct {
    const category = (p as any).category;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      discount: p.discount != null ? Number(p.discount) : undefined,
      image: this.productImageUrl(p),
      categoryName: category?.name,
    };
  }

  async chat(dto: ChatRequestDto, user: User): Promise<ChatResponseDto> {
    const msg = dto.message?.trim();
    if (!msg) {
      throw new BadRequestException('message is required');
    }

    try {
      const forecast = await this.maybeForecastReply(msg, user);
      if (forecast) {
        return forecast;
      }

      const openaiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
      if (!openaiKey) {
        this.logger.warn(
          'OPENAI_API_KEY absent — assistant en mode catalogue (sans modèle de chat)',
        );
        return await this.runChatFallback(msg);
      }

      return await this.runChat(msg, dto);
    } catch (err: unknown) {
      if (err instanceof ServiceUnavailableException) {
        throw err;
      }
      if (err instanceof APIError) {
        this.logger.error(`OpenAI: ${err.message}`, err.stack);
        throw new ServiceUnavailableException(
          `Assistant indisponible (OpenAI): ${err.message}`,
        );
      }
      this.logger.error('Chat error', err);
      throw err;
    }
  }

  private isPredictionIntent(msg: string): boolean {
    return /prévi|prédi|forecast|projection|estim|prognostic|predire/i.test(
      msg,
    );
  }

  /** Admin : profit ≈ CA plateforme sur 5 mois */
  private wantsAdminForecast(msg: string): boolean {
    if (!this.isPredictionIntent(msg)) {
      return false;
    }
    const t = msg.toLowerCase();
    if (/je cherche|acheter|cadeau|idée|pour mon usage/i.test(t)) {
      return false;
    }
    const biz =
      /profit|bénéfice|benefice|chiffre|revenu|\bca\b|marketplace|global|plateforme|site|toutes?\s+les?\s+ventes|vente\s+globale/i.test(
        t,
      );
    const horizon = /5\s*mois|cinq\s*mois|prochain|futur|mensuel|à\s+venir/i.test(
      t,
    );
    return biz || horizon;
  }

  /** Vendeur : unités vendues sur 5 mois */
  private wantsSellerForecast(msg: string): boolean {
    if (!this.isPredictionIntent(msg)) {
      return false;
    }
    const t = msg.toLowerCase();
    if (/profit|bénéfice|benefice|plateforme|marketplace globale/i.test(t)) {
      return false;
    }
    const sales =
      /article|articles|vendu|ventes?|unités?|quantité|mes\s+ventes|ma\s+boutique|mes\s+produits/i.test(
        t,
      );
    const horizon = /5\s*mois|cinq\s*mois|prochain|futur|mensuel|à\s+venir/i.test(
      t,
    );
    return sales || horizon;
  }

  private async maybeForecastReply(
    msg: string,
    user: User,
  ): Promise<ChatResponseDto | null> {
    if (user.role === UserRole.ADMIN && this.wantsAdminForecast(msg)) {
      const reply = await this.forecastService.adminProfitForecastText();
      return { reply, recommended: [] };
    }
    if (user.role === UserRole.SELLER && this.wantsSellerForecast(msg)) {
      const reply = await this.forecastService.sellerUnitsForecastText(
        user.id,
      );
      return { reply, recommended: [] };
    }
    return null;
  }

  private stripAccents(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /** Mots trop vagues pour filtrer le catalogue (fr / en courants). */
  private static readonly KEYWORD_STOP = new Set([
    'les',
    'des',
    'une',
    'pour',
    'avec',
    'dans',
    'sur',
    'sont',
    'est',
    'que',
    'qui',
    'cette',
    'cela',
    'comme',
    'aussi',
    'bien',
    'plus',
    'tout',
    'tous',
    'toute',
    'vous',
    'nous',
    'leur',
    'mais',
    'pas',
    'tres',
    'très',
    'the',
    'and',
    'for',
    'you',
    'are',
    'not',
    'any',
    'can',
    'how',
    'what',
    'when',
    'where',
    'which',
    'cherch',
    'cherche',
    'acheter',
    'achete',
    'voudrais',
    'veux',
    'besoin',
    'idee',
    'svp',
    'please',
    'merci',
    'bonjour',
    'salut',
    'hello',
    'hey',
  ]);

  /** Mots significatifs du message (pour matcher nom / description / catégorie). */
  private extractKeywords(msg: string): string[] {
    const normalized = this.stripAccents(msg);
    const raw = normalized.split(/[^a-z0-9]+/i).filter((w) => w.length > 2);
    return raw.filter((w) => !ChatService.KEYWORD_STOP.has(w));
  }

  /** Produits dont la fiche contient au moins un des mots-clés. */
  private filterProductsByKeywords(msg: string, products: Product[]): Product[] {
    const words = this.extractKeywords(msg);
    if (words.length === 0) {
      return [];
    }
    return products.filter((p) => {
      const blob = this.stripAccents(this.productDoc(p));
      return words.some((w) => blob.includes(w));
    });
  }

  /** Trie une liste de produits par similarité cosinus avec le vecteur requête (ordre décroissant). */
  private sortByQuerySimilarity(
    queryVec: number[],
    products: Product[],
  ): Product[] {
    const scored = products
      .map((p) => {
        const emb = this.embeddingService.parseEmbedding(p.embeddingJson);
        if (!emb) {
          return { p, score: -1 };
        }
        return {
          p,
          score: this.embeddingService.cosineSimilarity(queryVec, emb),
        };
      })
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score);
    return scored.map((x) => x.p);
  }

  /**
   * Sans clé OpenAI : pas d’embeddings ni de GPT — uniquement produits dont la fiche contient un mot-clé du message.
   */
  private async runChatFallback(msg: string): Promise<ChatResponseDto> {
    const products = await this.loadCatalogForRag();
    if (products.length === 0) {
      return {
        reply:
          'Il n’y a actuellement aucun produit « disponible » avec du stock. Le chat ne peut rien suggérer.',
        recommended: [],
      };
    }

    const words = this.extractKeywords(msg);
    if (words.length === 0) {
      return {
        reply:
          'Mode catalogue (sans OpenAI) : utilisez des mots concrets présents dans les annonces (ex. marque, type d’article, catégorie) pour obtenir des suggestions.',
        recommended: [],
      };
    }

    const retrieved = this.filterProductsByKeywords(msg, products).slice(0, 8);

    if (retrieved.length === 0) {
      return {
        reply:
          'Aucun produit disponible ne contient les mots de votre message dans le titre, la description ou la catégorie. Essayez d’autres mots-clés (ex. « téléphone », « canapé », « vélo »).\n\n' +
          '(Mode sans OpenAI : ajoutez OPENAI_API_KEY pour un assistant plus tolérant aux formulations.)',
        recommended: [],
      };
    }

    const intro =
      'Mode limité (sans clé OpenAI sur le serveur). Voici uniquement les articles dont la fiche contient au moins un mot de votre message :\n\n';

    const lines = retrieved.map(
      (p, i) =>
        `${i + 1}. ${p.name} — ${Number(p.price)} TND (réf. ${p.id})`,
    );

    return {
      reply: intro + lines.join('\n'),
      recommended: retrieved.map((p) => this.toRecommended(p)),
    };
  }

  private async runChat(
    msg: string,
    dto: ChatRequestDto,
  ): Promise<ChatResponseDto> {
    const products = await this.loadCatalogForRag();
    if (products.length === 0) {
      return {
        reply:
          'Il n’y a actuellement aucun produit disponible à recommander.',
        recommended: [],
      };
    }

    await this.ensureEmbeddings(products);

    const keywordMatched = this.filterProductsByKeywords(msg, products);
    const topKRaw = this.config.get<string>('RAG_TOP_K', '8');
    const topK = Math.min(
      Math.max(1, parseInt(topKRaw, 10) || 8),
      products.length,
    );

    let retrieved: Product[] = [];
    let contextBlock: string;

    if (keywordMatched.length === 0) {
      const kw = this.extractKeywords(msg);
      contextBlock =
        kw.length === 0
          ? '(Aucun mot-clé exploitable : demander des termes concrets liés au catalogue.)'
          : `(Aucun produit ne contient les mots-clés : ${kw.join(', ')} — inviter à reformuler avec des termes présents dans les annonces.)`;
    } else {
      const queryVec = await this.embeddingService.embedOne(msg);
      const ranked = this.sortByQuerySimilarity(queryVec, keywordMatched);
      retrieved = ranked.slice(0, topK);
      if (retrieved.length === 0) {
        retrieved = keywordMatched.slice(0, topK);
      }
      contextBlock = retrieved
        .map((p, i) => {
          const r = this.toRecommended(p);
          return [
            `[${i + 1}] ID=${r.id}`,
            `Nom: ${r.name}`,
            `Prix: ${r.price} TND` +
              (r.discount ? ` (réduction: ${r.discount})` : ''),
            r.categoryName ? `Catégorie: ${r.categoryName}` : '',
            `Description: ${r.description}`,
          ]
            .filter(Boolean)
            .join('\n');
        })
        .join('\n\n---\n\n');
    }

    const system = `Tu es l’assistant shopping du marketplace. Tu réponds en français (sauf si l’utilisateur écrit dans une autre langue, alors adapte-toi).
Règles strictes:
- Tu ne recommandes QUE des produits listés dans le contexte ci-dessous (ils existent en base et correspondent aux mots-clés du message).
- Cite les produits par leur nom et, si utile, par leur ID entre parenthèses.
- Si le contexte indique qu’aucun produit ne correspond aux mots-clés, explique-le et propose des exemples de mots à utiliser (types d’articles, marques, catégories).
- Ne invente pas de produits, prix ou stocks.

Contexte produits (intersection mots-clés du message + similarité sémantique parmi ces seuls produits) :
${contextBlock}`;

    const history = (dto.history ?? []).slice(-10).map((h: ChatHistoryItemDto) => ({
      role: h.role,
      content: h.content,
    }));

    const client = this.getOpenAI();
    const completion = await client.chat.completions.create({
      model: this.chatModel(),
      messages: [
        { role: 'system', content: system },
        ...history,
        { role: 'user', content: msg },
      ],
      temperature: 0.4,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ??
      'Désolé, je n’ai pas pu générer de réponse.';

    return {
      reply,
      recommended: retrieved.map((p) => this.toRecommended(p)),
    };
  }

  /** Recompute embeddings for all in-stock disponible products (admin / cron) */
  async reindexAll(): Promise<{ updated: number }> {
    const products = await this.loadCatalogForRag();
    if (products.length === 0) {
      return { updated: 0 };
    }
    const texts = products.map((p) => this.productDoc(p));
    const vectors = await this.embeddingService.embedTexts(texts);
    for (let i = 0; i < products.length; i++) {
      products[i].embeddingJson = this.embeddingService.stringifyEmbedding(
        vectors[i],
      );
    }
    await this.productRepository.save(products);
    return { updated: products.length };
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../order/order.entity';
import { OrderItem } from '../order/order-item.entity';

const HISTORY_MONTHS = 12;
const HORIZON = 5;

/** y = a + b*x, x = 0..n-1 ; extrapolate x = n .. n+HORIZON-1, clamp >= 0 */
export function linearForecast(values: number[], horizon: number): number[] {
  const n = values.length;
  if (n === 0) {
    return Array.from({ length: horizon }, () => 0);
  }
  if (n === 1) {
    const v = Math.max(0, values[0]);
    return Array.from({ length: horizon }, () => v);
  }
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;
  const out: number[] = [];
  for (let h = 0; h < horizon; h++) {
    const x = n + h;
    out.push(Math.max(0, intercept + slope * x));
  }
  return out;
}

function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  now.setDate(1);
  now.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    keys.push(`${y}-${m}`);
  }
  return keys;
}

function addMonthKey(ym: string, delta: number): string {
  const [ys, ms] = ym.split('-');
  const y = parseInt(ys, 10);
  const mo = parseInt(ms, 10);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabelFr(ym: string): string {
  const [ys, ms] = ym.split('-').map(Number);
  if (!ys || !ms) return ym;
  const d = new Date(ys, ms - 1, 1);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export interface ForecastSeriesPoint {
  month: string;
  value: number;
}

export interface AdminPredictionPayload {
  model: string;
  trainedOnMonths: number;
  horizonMonths: number;
  metricLabel: string;
  disclaimer: string;
  historical: ForecastSeriesPoint[];
  forecast: ForecastSeriesPoint[];
}

export interface SellerPredictionPayload {
  model: string;
  trainedOnMonths: number;
  horizonMonths: number;
  metricLabel: string;
  disclaimer: string;
  historical: ForecastSeriesPoint[];
  forecast: ForecastSeriesPoint[];
}

@Injectable()
export class ForecastService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
  ) {}

  private historyStartDate(): Date {
    const d = new Date();
    d.setMonth(d.getMonth() - HISTORY_MONTHS);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** CA mensuel plateforme (proxy « profit » faute de charges en base) */
  async getAdminRevenueSeries(): Promise<{ keys: string[]; values: number[] }> {
    const keys = lastNMonthKeys(HISTORY_MONTHS);
    const from = this.historyStartDate();
    const raw = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.createdAt >= :from', { from })
      .select("DATE_FORMAT(o.createdAt, '%Y-%m')", 'month')
      .addSelect('COALESCE(SUM(o.total), 0)', 'revenue')
      .groupBy('month')
      .getRawMany();
    const map = new Map<string, number>();
    for (const r of raw) {
      map.set(r.month, Number(r.revenue ?? 0));
    }
    const values = keys.map((k) => map.get(k) ?? 0);
    return { keys, values };
  }

  /** Unités vendues par mois pour un vendeur (somme des quantités sur ses lignes) */
  async getSellerUnitsSeries(
    sellerId: number,
  ): Promise<{ keys: string[]; values: number[] }> {
    const keys = lastNMonthKeys(HISTORY_MONTHS);
    const from = this.historyStartDate();
    const raw = await this.orderItemRepository
      .createQueryBuilder('oi')
      .innerJoin('oi.order', 'o')
      .innerJoin('oi.product', 'p')
      .where('p.sellerId = :sellerId', { sellerId })
      .andWhere('o.createdAt >= :from', { from })
      .select("DATE_FORMAT(o.createdAt, '%Y-%m')", 'month')
      .addSelect('COALESCE(SUM(oi.quantity), 0)', 'units')
      .groupBy('month')
      .getRawMany();
    const map = new Map<string, number>();
    for (const r of raw) {
      map.set(r.month, Number(r.units ?? 0));
    }
    const values = keys.map((k) => map.get(k) ?? 0);
    return { keys, values };
  }

  async adminProfitForecastText(): Promise<string> {
    const { keys, values } = await this.getAdminRevenueSeries();
    const predicted = linearForecast(values, HORIZON);
    const startYm = keys.length ? keys[keys.length - 1] : this.currentYm();
    const lines: string[] = [
      'Prévision indicative sur les 5 prochains mois (tendance par régression linéaire sur les 12 derniers mois d’historique).',
      '',
      '⚠️ Sans données de charges, le « profit » est approximé par le chiffre d’affaires mensuel des commandes. Ce n’est pas une garantie de résultat.',
      '',
    ];
    for (let i = 0; i < HORIZON; i++) {
      const ym = addMonthKey(startYm, i + 1);
      const v = predicted[i];
      lines.push(
        `• ${monthLabelFr(ym)} : ~${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND (CA prévu)`,
      );
    }
    return lines.join('\n');
  }

  async sellerUnitsForecastText(sellerId: number): Promise<string> {
    const { keys, values } = await this.getSellerUnitsSeries(sellerId);
    const predicted = linearForecast(values, HORIZON);
    const startYm = keys.length ? keys[keys.length - 1] : this.currentYm();
    const lines: string[] = [
      'Prévision indicative du nombre d’articles vendus (somme des quantités sur vos lignes de commande) pour les 5 prochains mois.',
      '',
      'Méthode : régression linéaire sur les 12 derniers mois. À interpréter avec prudence.',
      '',
    ];
    for (let i = 0; i < HORIZON; i++) {
      const ym = addMonthKey(startYm, i + 1);
      const v = Math.round(predicted[i]);
      lines.push(`• ${monthLabelFr(ym)} : ~${v.toLocaleString('fr-FR')} unités`);
    }
    return lines.join('\n');
  }

  private currentYm(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  /** Données JSON pour graphiques / dashboard (régression linéaire sur 12 mois) */
  async getAdminPredictionPayload(): Promise<AdminPredictionPayload> {
    const { keys, values } = await this.getAdminRevenueSeries();
    const predicted = linearForecast(values, HORIZON);
    const startYm = keys.length ? keys[keys.length - 1] : this.currentYm();
    const forecast: ForecastSeriesPoint[] = predicted.map((v, i) => ({
      month: addMonthKey(startYm, i + 1),
      value: Math.round(Number(v) * 100) / 100,
    }));
    const historical: ForecastSeriesPoint[] = keys.map((month, i) => ({
      month,
      value: Math.round(Number(values[i] ?? 0) * 100) / 100,
    }));
    return {
      model: 'linear_regression',
      trainedOnMonths: HISTORY_MONTHS,
      horizonMonths: HORIZON,
      metricLabel: 'CA mensuel (TND) — proxy du profit sans charges',
      disclaimer:
        'Estimation statistique à partir de l’historique des commandes ; ne remplace pas une comptabilité réelle.',
      historical,
      forecast,
    };
  }

  async getSellerPredictionPayload(
    sellerId: number,
  ): Promise<SellerPredictionPayload> {
    const { keys, values } = await this.getSellerUnitsSeries(sellerId);
    const predicted = linearForecast(values, HORIZON);
    const startYm = keys.length ? keys[keys.length - 1] : this.currentYm();
    const forecast: ForecastSeriesPoint[] = predicted.map((v, i) => ({
      month: addMonthKey(startYm, i + 1),
      value: Math.round(Number(v)),
    }));
    const historical: ForecastSeriesPoint[] = keys.map((month, i) => ({
      month,
      value: Math.round(Number(values[i] ?? 0)),
    }));
    return {
      model: 'linear_regression',
      trainedOnMonths: HISTORY_MONTHS,
      horizonMonths: HORIZON,
      metricLabel: 'Articles vendus (somme des quantités sur vos lignes)',
      disclaimer:
        'Estimation par tendance sur 12 mois ; les ventes réelles peuvent varier.',
      historical,
      forecast,
    };
  }
}

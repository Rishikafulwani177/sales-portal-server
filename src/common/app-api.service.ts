import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * Centralized HTTP client for fetching product data from the
 * main app server (https://api.tcbtjaivikkisan.com).
 *
 * This replaces local MongoDB product queries — the app server
 * is the single source of truth for product sync, images, and stock.
 */
@Injectable()
export class AppApiService {
  private readonly logger = new Logger(AppApiService.name);
  private readonly client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const baseURL = this.configService.getOrThrow<string>('APP_API_BASE_URL');

    this.client = axios.create({
      baseURL,
      timeout: 15_000,
    });

    this.logger.log(`🌐 AppApiService configured → ${baseURL}`);
  }

  // ─────────────────────────────────────────
  // Get all active products
  // ─────────────────────────────────────────
  async getActiveProducts(): Promise<{ data: any[]; total: number }> {
    const response = await this.client.get('/products');
    return response.data;
  }

  // ─────────────────────────────────────────
  // Get a single product by _id or zoho_item_id
  // ─────────────────────────────────────────
  async getProductById(id: string): Promise<any | null> {
    try {
      const response = await this.client.get(`/products/id/${id}`);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  }

  // ─────────────────────────────────────────
  // Filtered + paginated products
  // ─────────────────────────────────────────
  async getFilteredProducts(query: Record<string, any>): Promise<any> {
    const response = await this.client.get('/products/filter', {
      params: query,
    });
    return response.data;
  }

  // ─────────────────────────────────────────
  // Get all categories
  // ─────────────────────────────────────────
  async getCategories(): Promise<any[]> {
    const response = await this.client.get('/products/categories/all');
    return response.data;
  }

  // ─────────────────────────────────────────
  // Search products
  // ─────────────────────────────────────────
  async searchProducts(q: string, limit = 10): Promise<any[]> {
    const response = await this.client.get('/products/search', {
      params: { q, limit },
    });
    return response.data;
  }
}

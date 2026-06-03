import { Injectable, NotFoundException } from '@nestjs/common';
import { AppApiService } from '../../common/app-api.service';

/**
 * ProductsService — thin proxy over the app server API.
 *
 * No MongoDB, no cron jobs, no Zoho sync.
 * All product data comes from https://api.tcbtjaivikkisan.com
 */
@Injectable()
export class ProductsService {
  constructor(private readonly appApi: AppApiService) {}

  async getActiveProducts() {
    return this.appApi.getActiveProducts();
  }

  async getProductById(id: string) {
    const product = await this.appApi.getProductById(id);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async getFilteredProducts(query: any) {
    return this.appApi.getFilteredProducts(query);
  }
}

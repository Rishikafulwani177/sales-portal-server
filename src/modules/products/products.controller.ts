import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {

  constructor(private productsService: ProductsService) { }

  @Get()
  async getProducts() {
    return this.productsService.getActiveProducts();
  }

  @Get('/id/:id')
  async getProduct(@Param('id') id: string) {
    return this.productsService.getProductById(id);
  }

  @Get('/filter')
  async getFilteredProducts(@Query() query: any) {
    return this.productsService.getFilteredProducts(query);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Category } from './schemas/category.schema';
import { Model } from 'mongoose';
import { AppApiService } from '../../common/app-api.service';

@Injectable()
export class CategoryService {
  constructor(
    @InjectModel(Category.name)
    private categoryModel: Model<Category>,

    private appApi: AppApiService,
  ) {}

  // 🔥 SYNC CATEGORIES FROM APP SERVER API
  async syncCategories() {
    const categories = await this.appApi.getCategories();

    for (const cat of categories) {
      await this.categoryModel.updateOne(
        { category_id: cat.id },
        {
          $set: {
            name: cat.name,
            is_active: true,
          },
        },
        { upsert: true },
      );
    }

    return {
      message: 'Categories synced successfully',
      count: categories.length,
    };
  }

  // 🔥 GET ALL CATEGORIES
  async getAllCategories() {
    return this.categoryModel
      .find({ is_active: true })
      .select('category_id name')
      .lean();
  }
}
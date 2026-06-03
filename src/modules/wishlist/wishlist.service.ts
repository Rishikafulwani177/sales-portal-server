import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Wishlist, WishlistDocument } from './schema/wishlist.schema';
import { Model } from 'mongoose';
import { AppApiService } from '../../common/app-api.service';

@Injectable()
export class WishlistService {
  constructor(
    @InjectModel(Wishlist.name)
    private wishlistModel: Model<WishlistDocument>,

    private appApi: AppApiService,
  ) { }

  async getWishlist(userId: string) {
    let wishlist = await this.wishlistModel.findOne({ userId });

    if (!wishlist) {
      wishlist = await this.wishlistModel.create({
        userId,
        items: [],
      });
    }

    // Fetch product details from app server API for each wishlist item
    const items = await Promise.all(
      wishlist.items.map(async (item) => {
        const product = await this.appApi
          .getProductById(item.zoho_item_id)
          .catch(() => null);

        return {
          zoho_item_id: item.zoho_item_id,
          product: product || null,
        };
      }),
    );

    return {
      userId: wishlist.userId,
      items,
    };
  }

  async addToWishlist(userId: string, zoho_item_id: string) {
    return this.wishlistModel.findOneAndUpdate(
      { userId, 'items.zoho_item_id': { $ne: zoho_item_id } },
      {
        $push: {
          items: { zoho_item_id },
        },
      },
      { new: true, upsert: true },
    );
  }

  async removeFromWishlist(userId: string, zoho_item_id: string) {
    return this.wishlistModel.findOneAndUpdate(
      { userId },
      {
        $pull: {
          items: { zoho_item_id },
        },
      },
      { new: true },
    );
  }
}

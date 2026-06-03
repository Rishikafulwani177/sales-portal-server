import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppApiService } from '../../common/app-api.service';
import { Cart } from './schemas/cart.schema';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private cartModel: Model<Cart>,
    private appApi: AppApiService,
  ) { }

  async getOrCreateForGuest(guestSessionId: string) {
    if (!guestSessionId) {
      throw new BadRequestException('guest_session_id required');
    }

    return (
      (await this.cartModel.findOne({ guest_session_id: guestSessionId })) ??
      (await this.cartModel.create({
        guest_session_id: guestSessionId,
        items: [],
      }))
    );
  }

  async getOrCreateForUser(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user ID');
    }

    const uid = new Types.ObjectId(userId);

    return (
      (await this.cartModel.findOne({ user_id: uid })) ??
      (await this.cartModel.create({ user_id: uid, items: [] }))
    );
  }

  async upsertItemForGuest(
    guestSessionId: string,
    productId: string,
    quantity: number,
  ) {
    const cart = await this.getOrCreateForGuest(guestSessionId);
    return this.upsertItem(cart, productId, quantity);
  }

  async upsertItemForUser(
    userId: string,
    productId: string,
    quantity: number,
  ) {
    const cart = await this.getOrCreateForUser(userId);
    return this.upsertItem(cart, productId, quantity);
  }

  private async upsertItem(cart: Cart, productId: string, quantity: number) {

    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new BadRequestException('Invalid quantity');
    }

    // Fetch product from app server API
    const product = await this.appApi.getProductById(productId);

    if (!product || !product.is_active) {
      throw new BadRequestException('Invalid product');
    }

    if ((product.stock ?? 0) <= 0) {
      throw new BadRequestException('Out of stock');
    }

    if (quantity > (product.stock ?? 0)) {
      throw new BadRequestException('Insufficient stock');
    }

    // Use the productId string as the cart key (works for zoho_item_id or _id)
    const cartKey = productId;

    const idx = cart.items.findIndex(
      (i) => i.product_id.toString() === cartKey,
    );

    if (quantity === 0) {
      if (idx >= 0) cart.items.splice(idx, 1);
    } else if (idx >= 0) {
      cart.items[idx].quantity = quantity;
    } else {
      cart.items.push({
        product_id: cartKey,
        quantity,
      } as any);
    }

    await cart.save();
    return this.getCartSummary(cart);
  }

  async getCartSummaryByGuest(guestSessionId: string) {
    const cart = await this.getOrCreateForGuest(guestSessionId);
    return this.getCartSummary(cart);
  }

  async getCartSummaryByUser(userId: string) {
    const cart = await this.getOrCreateForUser(userId);
    return this.getCartSummary(cart);
  }

  async getCartSummary(cart: Cart) {
    const items = cart.items ?? [];

    if (!items.length) {
      return { cart_id: cart._id, items: [], total_amount: 0, totalWeight: 0 };
    }

    // Fetch product details from app server API for each cart item
    const detailed = await Promise.all(
      items.map(async (i) => {
        const id = i.product_id.toString();
        const p = await this.appApi.getProductById(id).catch(() => null);
        const price = p?.price ?? 0;

        let weight = 0;
        if (p?.weight) {
          weight =
            p.weight_unit === 'kg'
              ? p.weight * 1000
              : p.weight;
        }

        return {
          product_id: i.product_id,
          zoho_item_id: p?.zoho_item_id || null,
          quantity: i.quantity,
          name: p?.name,
          price,
          line_total: price * i.quantity,
          image_url: p?.image?.image_url || null,
          weight,
          total_weight: weight * i.quantity,
        };
      }),
    );

    const totalWeight = detailed.reduce(
      (sum, item) => sum + item.total_weight,
      0,
    );

    const total_amount = detailed.reduce(
      (sum, it) => sum + (it.line_total ?? 0),
      0,
    );

    return {
      cart_id: cart._id,
      items: detailed,
      totalWeight,
      total_amount,
    };
  }

  async mergeGuestIntoUser(guestSessionId: string, userId: string) {
    const guestCart = await this.cartModel.findOne({
      guest_session_id: guestSessionId,
    });


    if (!guestCart || !guestCart.items?.length) return;

    const userCart = await this.getOrCreateForUser(userId);

    const qtyByProduct = new Map<string, number>();

    for (const it of userCart.items ?? []) {
      qtyByProduct.set(it.product_id.toString(), it.quantity);
    }

    for (const it of guestCart.items ?? []) {
      const key = it.product_id.toString();
      qtyByProduct.set(key, (qtyByProduct.get(key) ?? 0) + it.quantity);
    }

    userCart.items = Array.from(qtyByProduct.entries()).map(
      ([pid, quantity]) => ({
        product_id: pid,
        quantity,
      }),
    ) as any;

    await userCart.save();

    await this.cartModel.deleteOne({ _id: guestCart._id });
  }
}
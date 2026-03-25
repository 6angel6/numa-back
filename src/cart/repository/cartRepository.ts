import { Op, Transaction } from 'sequelize';
import Cart from '../model/Cart';
import CartItem from '../model/CartItem';
import Product from '../../product/model/Product';
import ProductMedia from '../../product/model/ProductMedia';
import { StoreSlug } from '../../types';

const CART_INCLUDES = [
   {
      model: CartItem,
      as: 'items',
      include: [
         {
            model:    Product,
            as:       'product',
            paranoid: false,
            attributes: ['id', 'name', 'price', 'discountPrice', 'stock', 'sku', 'status', 'unit', 'deletedAt'],
            include: [
               {
                  model:    ProductMedia,
                  as:       'media',
                  where:    { isMain: true },
                  required: false,
                  limit:    1,
               },
            ],
         },
      ],
   },
];

export const cartRepository = {
   findByToken: (sessionToken: string, store: StoreSlug) =>
      Cart.findOne({
         where:   { sessionToken, store, expiresAt: { [Op.gt]: new Date() } },
         include: CART_INCLUDES,
      }),

   findOrCreate: async (sessionToken: string, store: StoreSlug): Promise<Cart> => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [cart, created] = await Cart.findOrCreate({
         where:    { sessionToken, store },
         defaults: { sessionToken, store, expiresAt },
      });
      // Renew expiry on every use (sliding 7-day window).
      // Also revives carts that expired but weren't cleaned up yet.
      if (!created) await cart.update({ expiresAt });
      return cart;
   },

   getItemCount: (cartId: string) => CartItem.count({ where: { cartId } }),

   findItem: (cartId: string, productId: string) =>
      CartItem.findOne({ where: { cartId, productId } }),

   upsertItem: async (cartId: string, productId: string, quantity: number): Promise<CartItem> => {
      const [item, created] = await CartItem.findOrCreate({
         where:    { cartId, productId },
         defaults: { cartId, productId, quantity },
      });
      if (!created) await item.update({ quantity });
      return item;
   },

   removeItem: (cartId: string, productId: string) =>
      CartItem.destroy({ where: { cartId, productId } }),

   clearCart: (cartId: string) => CartItem.destroy({ where: { cartId } }),

   deleteByToken: (sessionToken: string, store: StoreSlug, transaction?: Transaction) =>
      Cart.destroy({ where: { sessionToken, store }, transaction }),

   deleteExpired: () =>
      Cart.destroy({ where: { expiresAt: { [Op.lt]: new Date() } } }),
};

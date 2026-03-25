import { cartRepository } from '../repository/cartRepository';
import { productRepository } from '../../product/repository/productRepository';
import { NotFoundError, BadRequestError } from '../../../shared/utils/errors';
import { ProductStatus } from '../../product/model/Product';
import logger from '../../../shared/utils/logger';
import { StoreSlug } from '../../types';
import type { AddCartItemInput } from '../dto/cartDto';

function withAvailability(cart: any) {
   if (!cart) return null;
   const plain = typeof cart.toJSON === 'function' ? cart.toJSON() : cart;
   if (plain.items) {
      plain.items = plain.items.map((item: any) => ({
         ...item,
         isAvailable:
            item.product != null &&
            item.product.deletedAt === null &&
            item.product.status === ProductStatus.ACTIVE &&
            item.product.stock >= item.quantity,
      }));
   }
   return plain;
}

export const cartService = {
   getCart: async (sessionToken: string, store: StoreSlug) => {
      const cart = await cartRepository.findByToken(sessionToken, store);
      return withAvailability(cart);
   },

   addItem: async (sessionToken: string, store: StoreSlug, input: AddCartItemInput) => {
      const product = await productRepository.findById(input.productId);
      if (!product || product.status !== ProductStatus.ACTIVE || product.store !== store) {
         throw new NotFoundError('Product not found or not available');
      }
      if (product.stock < input.quantity) {
         throw new BadRequestError(`Only ${product.stock} items in stock`);
      }

      const cart = await cartRepository.findOrCreate(sessionToken, store);
      await cartRepository.upsertItem(cart.id, input.productId, input.quantity);

      logger.debug(
         { cartId: cart.id, productId: input.productId, quantity: input.quantity, store },
         'cart: item added',
      );

      const updated = await cartRepository.findByToken(sessionToken, store);
      return withAvailability(updated);
   },

   updateItem: async (sessionToken: string, store: StoreSlug, productId: string, quantity: number) => {
      const cart = await cartRepository.findByToken(sessionToken, store);
      if (!cart) throw new NotFoundError('Cart not found');

      const item = await cartRepository.findItem(cart.id, productId);
      if (!item) throw new NotFoundError('Item not in cart');

      const product = await productRepository.findById(productId);
      if (product && product.stock < quantity) {
         throw new BadRequestError(`Only ${product.stock} items in stock`);
      }

      await cartRepository.upsertItem(cart.id, productId, quantity);

      logger.debug(
         { cartId: cart.id, productId, quantity, store },
         'cart: item updated',
      );

      const updated = await cartRepository.findByToken(sessionToken, store);
      return withAvailability(updated);
   },

   removeItem: async (sessionToken: string, store: StoreSlug, productId: string) => {
      const cart = await cartRepository.findByToken(sessionToken, store);
      if (!cart) throw new NotFoundError('Cart not found');

      await cartRepository.removeItem(cart.id, productId);

      logger.debug(
         { cartId: cart.id, productId, store },
         'cart: item removed',
      );

      const updated = await cartRepository.findByToken(sessionToken, store);
      return withAvailability(updated);
   },

   clearCart: async (sessionToken: string, store: StoreSlug) => {
      const cart = await cartRepository.findByToken(sessionToken, store);
      if (!cart) return; // cart already gone — treat as success
      await cartRepository.clearCart(cart.id);
      logger.debug({ cartId: cart.id, store }, 'cart: cleared');
   },
};

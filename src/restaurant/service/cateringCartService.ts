import { cateringCartRepository } from '../repository/cateringCartRepository';
import { menuItemRepository } from '../repository/menuItemRepository';
import { NotFoundError, BadRequestError } from '../../../shared/utils/errors';
import CateringCart from '../model/CateringCart';
import CateringCartItem from '../model/CateringCartItem';
import MenuItem from '../model/MenuItem';
import logger from '../../../shared/utils/logger';

export interface CartItemResponse {
   id:           string;
   menuItemId:   string;
   menuItem:     {
      id:            string;
      name:          { uz: string; ru: string; en: string };
      price:         number;
      discountPrice: number | null;
      imageUrl:      string | null;
      isAvailable:   boolean;
      deletedAt:     Date | null;
   } | null;
   quantity:     number;
   unitPrice:    number;
   subtotal:     number;
}

export interface CartResponse {
   id:         string;
   items:      CartItemResponse[];
   totalItems: number;
   totalAmount: number;
   expiresAt:  Date;
}

const formatCartResponse = (cart: CateringCart & { items?: CateringCartItem[] }): CartResponse => {
   const items = (cart.items || []).map((item: CateringCartItem & { menuItem?: MenuItem }) => {
      const menuItem = item.menuItem;
      const unitPrice = menuItem
         ? (menuItem.discountPrice ?? menuItem.price)
         : 0;
      const subtotal = unitPrice * item.quantity;

      return {
         id:         item.id,
         menuItemId: item.menuItemId,
         menuItem:   menuItem ? {
            id:            menuItem.id,
            name:          menuItem.name as { uz: string; ru: string; en: string },
            price:         Number(menuItem.price),
            discountPrice: menuItem.discountPrice ? Number(menuItem.discountPrice) : null,
            imageUrl:      menuItem.imageUrl,
            isAvailable:   menuItem.isAvailable,
            deletedAt:     menuItem.deletedAt,
         } : null,
         quantity:   item.quantity,
         unitPrice:  Number(unitPrice),
         subtotal:   Number(subtotal),
      };
   });

   const totalItems  = items.reduce((sum, item) => sum + item.quantity, 0);
   const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

   return {
      id:         cart.id,
      items,
      totalItems,
      totalAmount,
      expiresAt:  cart.expiresAt,
   };
};

export const cateringCartService = {
   /**
    * Get cart by session token.
    * Returns null if cart does not exist or is expired.
    */
   getCart: async (sessionToken: string): Promise<CartResponse | null> => {
      const cart = await cateringCartRepository.findByToken(sessionToken);
      if (!cart) return null;
      return formatCartResponse(cart);
   },

   /**
    * Get or create cart by session token.
    */
   getOrCreateCart: async (sessionToken: string): Promise<CartResponse> => {
      const cart = await cateringCartRepository.findOrCreate(sessionToken);
      return formatCartResponse(cart);
   },

   /**
    * Add item to cart.
    * If item already exists, quantity is incremented.
    */
   addItem: async (
      sessionToken: string,
      menuItemId:   string,
      quantity:     number,
      _notes?:      string,
   ): Promise<CartResponse> => {
      // Validate menu item exists and is available
      const menuItem = await menuItemRepository.findById(menuItemId);
      if (!menuItem) {
         throw new NotFoundError('Menu item not found');
      }
      if (!menuItem.isAvailable) {
         throw new BadRequestError('Menu item is not available');
      }

      // Get or create cart
      const cart = await cateringCartRepository.findOrCreate(sessionToken);

      // Check if item already exists in cart
      const existingItem = await cateringCartRepository.findItem(cart.id, menuItemId);
      const newQuantity = existingItem ? existingItem.quantity + quantity : quantity;

      // Upsert item
      await cateringCartRepository.upsertItem(cart.id, menuItemId, newQuantity);

      // Return updated cart
      const updatedCart = await cateringCartRepository.findOrCreate(sessionToken);

      logger.info(
         { sessionToken, menuItemId, quantity, cartId: cart.id },
         'catering-cart: item added',
      );

      return formatCartResponse(updatedCart);
   },

   /**
    * Update item quantity in cart.
    */
   updateItem: async (
      sessionToken: string,
      menuItemId:   string,
      quantity:     number,
   ): Promise<CartResponse> => {
      const cart = await cateringCartRepository.findByToken(sessionToken);
      if (!cart) {
         throw new NotFoundError('Cart not found');
      }

      const existingItem = await cateringCartRepository.findItem(cart.id, menuItemId);
      if (!existingItem) {
         throw new NotFoundError('Item not found in cart');
      }

      if (quantity <= 0) {
         await cateringCartRepository.removeItem(cart.id, menuItemId);
      } else {
         await cateringCartRepository.upsertItem(cart.id, menuItemId, quantity);
      }

      const updatedCart = await cateringCartRepository.findOrCreate(sessionToken);

      logger.info(
         { sessionToken, menuItemId, quantity, cartId: cart.id },
         'catering-cart: item updated',
      );

      return formatCartResponse(updatedCart);
   },

   /**
    * Remove item from cart.
    */
   removeItem: async (
      sessionToken: string,
      menuItemId:   string,
   ): Promise<CartResponse> => {
      const cart = await cateringCartRepository.findByToken(sessionToken);
      if (!cart) {
         throw new NotFoundError('Cart not found');
      }

      const existingItem = await cateringCartRepository.findItem(cart.id, menuItemId);
      if (!existingItem) {
         throw new NotFoundError('Item not found in cart');
      }

      await cateringCartRepository.removeItem(cart.id, menuItemId);

      const updatedCart = await cateringCartRepository.findOrCreate(sessionToken);

      logger.info(
         { sessionToken, menuItemId, cartId: cart.id },
         'catering-cart: item removed',
      );

      return formatCartResponse(updatedCart);
   },

   /**
    * Clear all items from cart.
    */
   clearCart: async (sessionToken: string): Promise<void> => {
      const cart = await cateringCartRepository.findByToken(sessionToken);
      if (!cart) {
         throw new NotFoundError('Cart not found');
      }

      await cateringCartRepository.clearCart(cart.id);

      logger.info(
         { sessionToken, cartId: cart.id },
         'catering-cart: cleared',
      );
   },

   /**
    * Delete cart completely (used after successful checkout).
    */
   deleteCart: async (sessionToken: string): Promise<void> => {
      await cateringCartRepository.deleteByToken(sessionToken);
   },
};

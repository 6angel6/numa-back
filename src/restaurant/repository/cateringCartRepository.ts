import { Op } from 'sequelize';
import CateringCart from '../model/CateringCart';
import CateringCartItem from '../model/CateringCartItem';
import MenuItem from '../model/MenuItem';

const CART_INCLUDES = [
   {
      model:   CateringCartItem,
      as:      'items',
      include: [{
         model:      MenuItem,
         as:         'menuItem',
         paranoid:   false,
         attributes: ['id', 'name', 'price', 'discountPrice', 'imageUrl', 'isAvailable', 'deletedAt'],
      }],
   },
];

export const cateringCartRepository = {
   findByToken: (sessionToken: string) =>
      CateringCart.findOne({
         where:   { sessionToken, expiresAt: { [Op.gt]: new Date() } },
         include: CART_INCLUDES,
      }),

   findOrCreate: async (sessionToken: string): Promise<CateringCart> => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const [cart, created] = await CateringCart.findOrCreate({
         where:    { sessionToken },
         defaults: { sessionToken, expiresAt },
         include:  CART_INCLUDES,
      });
      if (!created) {
         await cart.update({ expiresAt });
         return CateringCart.findOne({ where: { sessionToken }, include: CART_INCLUDES }) as Promise<CateringCart>;
      }
      return cart;
   },

   findItem: (cartId: string, menuItemId: string) =>
      CateringCartItem.findOne({ where: { cartId, menuItemId } }),

   upsertItem: async (cartId: string, menuItemId: string, quantity: number): Promise<CateringCartItem> => {
      const [item, created] = await CateringCartItem.findOrCreate({
         where:    { cartId, menuItemId },
         defaults: { cartId, menuItemId, quantity },
      });
      if (!created) await item.update({ quantity });
      return item;
   },

   removeItem: (cartId: string, menuItemId: string) =>
      CateringCartItem.destroy({ where: { cartId, menuItemId } }),

   clearCart: (cartId: string) => CateringCartItem.destroy({ where: { cartId } }),

   deleteByToken: (sessionToken: string) => CateringCart.destroy({ where: { sessionToken } }),

   deleteExpired: () =>
      CateringCart.destroy({ where: { expiresAt: { [Op.lt]: new Date() } } }),
};

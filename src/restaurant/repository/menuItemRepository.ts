import { Op } from 'sequelize';
import MenuItem from '../model/MenuItem';
import MenuCategory from '../model/MenuCategory';
import { Transaction } from 'sequelize';

export const menuItemRepository = {
   list: (filters: {
      categoryId?: string;
      available?: boolean;
      popular?: boolean;
      search?: string;
      page?: number;
      limit?: number;
   }) => {
      const where: Record<string, unknown> = {};
      if (filters.categoryId !== undefined) where['categoryId'] = filters.categoryId;
      if (filters.available !== undefined) where['isAvailable'] = filters.available;
      if (filters.popular !== undefined) where['isPopular'] = filters.popular;
      if (filters.search) {
         where[Op.or as any] = [
            { name: { [Op.contains]: { uz: filters.search } } },
            { name: { [Op.contains]: { ru: filters.search } } },
            { description: { [Op.contains]: { ru: filters.search } } },
         ];
      }
      const page = filters.page ?? 1;
      const limit = filters.limit ?? 20;
      return MenuItem.findAndCountAll({
         where,
         include: [{ model: MenuCategory, as: 'category', attributes: ['id', 'name', 'slug'] }],
         order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']],
         limit,
         offset: (page - 1) * limit,
         distinct: true,
      });
   },

   findById: (id: string, transaction?: Transaction) =>
      MenuItem.findByPk(id, {
         include: [{ model: MenuCategory, as: 'category' }],
         transaction,
      }),

   findBySlug: (slug: string) =>
      MenuItem.findOne({
         where: { slug },
         include: [{ model: MenuCategory, as: 'category' }],
      }),

   findByIdForUpdate: (id: string, transaction: Transaction) =>
      MenuItem.findByPk(id, { lock: true, transaction }),

   create: (data: {
      categoryId: string;
      name: { uz: string; ru: string; en: string };
      description?: { uz: string; ru: string; en: string } | null;
      slug: string;
      price: number;
      discountPrice?: number | null;
      imageUrl?: string | null;
      tags?: string[];
      isAvailable?: boolean;
      isPopular?: boolean;
      sortOrder?: number;
   }) => MenuItem.create(data as any),

   update: (id: string, data: Partial<{
      categoryId: string;
      name: { uz: string; ru: string; en: string };
      description: { uz: string; ru: string; en: string } | null;
      slug: string;
      price: number;
      discountPrice: number | null;
      imageUrl: string | null;
      tags: string[];
      isAvailable: boolean;
      isPopular: boolean;
      sortOrder: number;
   }>) =>
      MenuItem.update(data as any, { where: { id }, returning: true })
         .then(([, rows]) => rows[0] ?? null),

   delete: (id: string) => MenuItem.destroy({ where: { id } }),
};

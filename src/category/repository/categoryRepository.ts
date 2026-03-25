import { Sequelize } from 'sequelize';
import Category from '../model/Category';
import { StoreSlug } from '../../types';
import type { CreateCategoryInput, UpdateCategoryInput } from '../dto/categoryDto';

export const categoryRepository = {
   findById: (id: string) =>
      Category.findByPk(id, {
         include: [{ model: Category, as: 'subcategories', where: { isActive: true }, required: false }],
      }),

   findBySlugAndStore: (slug: string, store: StoreSlug) =>
      Category.findOne({ where: { slug, store } }),

   listByStore: (store: StoreSlug, parentId: string | null = null) =>
      Category.findAll({
         where:   { store, parentId, isActive: true },
         order:   [['sortOrder', 'ASC'], [Sequelize.literal('"Category"."name"->>\'uz\''), 'ASC']],
         include: [{ model: Category, as: 'subcategories', where: { isActive: true }, required: false }],
      }),

   listAll: () =>
      Category.findAll({
         order:   [['store', 'ASC'], ['sortOrder', 'ASC']],
         include: [{ model: Category, as: 'subcategories', required: false }],
      }),

   create: (data: CreateCategoryInput) => Category.create(data as any),

   update: (id: string, data: UpdateCategoryInput) =>
      Category.update(data as any, { where: { id }, returning: true }).then(([, rows]) => rows[0] ?? null),

   delete: (id: string) => Category.destroy({ where: { id } }),
};

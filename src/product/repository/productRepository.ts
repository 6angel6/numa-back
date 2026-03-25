import { Op, WhereOptions, Order, Transaction, Sequelize } from 'sequelize';
import Product, { ProductStatus } from '../model/Product';
import ProductMedia from '../model/ProductMedia';
import Category from '../../category/model/Category';
import { StoreSlug } from '../../types';
import type { CreateProductInput, UpdateProductInput, ProductQueryInput } from '../dto/productDto';
import { db } from '../../../shared/config/database';

const MEDIA_INCLUDE = {
   model:    ProductMedia,
   as:       'media',
   separate: false,
   order:    [['sortOrder', 'ASC']] as any,
};

const CATEGORY_INCLUDE = {
   model:      Category,
   as:         'category',
   attributes: ['id', 'name', 'slug'],
};

export const productRepository = {
   findById: (id: string) =>
      Product.findByPk(id, { include: [MEDIA_INCLUDE, CATEGORY_INCLUDE] }),

   findByIdForUpdate: (id: string, t: Transaction) =>
      Product.findByPk(id, { transaction: t, lock: Transaction.LOCK.UPDATE }),

   findManyByIdsForUpdate: (ids: string[], t: Transaction) =>
      Product.findAll({ where: { id: ids }, transaction: t, lock: Transaction.LOCK.UPDATE }),

   decrementStock: (id: string, by: number, t: Transaction) =>
      Product.decrement('stock', { by, where: { id }, transaction: t }),

   incrementStock: (id: string, by: number, t: Transaction) =>
      Product.increment('stock', { by, where: { id }, transaction: t }),

   findBySlugAndStore: (slug: string, store: StoreSlug) =>
      Product.findOne({ where: { slug, store }, include: [MEDIA_INCLUDE, CATEGORY_INCLUDE] }),

   findBySku: (sku: string) => Product.findOne({ where: { sku } }),

   list: (query: ProductQueryInput) => {
      const where: WhereOptions<any> = {};

      if (query.store)      where.store      = query.store;
      if (query.categoryId) where.categoryId = query.categoryId;
      if (query.status)     where.status     = query.status;
      if (query.featured)   where.isFeatured = true;
      if (query.search) {
         where[Op.or as any] = [
            Sequelize.where(Sequelize.cast(Sequelize.literal(`"Product"."name"->>'uz'`), 'text'), { [Op.iLike]: `%${query.search}%` }),
            Sequelize.where(Sequelize.cast(Sequelize.literal(`"Product"."name"->>'ru'`), 'text'), { [Op.iLike]: `%${query.search}%` }),
            Sequelize.where(Sequelize.cast(Sequelize.literal(`"Product"."name"->>'en'`), 'text'), { [Op.iLike]: `%${query.search}%` }),
            { sku: { [Op.iLike]: `%${query.search}%` } },
         ];
      }

      const offset = (query.page - 1) * query.limit;
      const sortCol = query.sortBy === 'name'
         ? Sequelize.literal('"Product"."name"->>\'uz\'')
         : query.sortBy;
      const order: Order = [[sortCol as any, query.sortDir.toUpperCase() as 'ASC' | 'DESC']];

      return Product.findAndCountAll({
         where,
         order,
         limit:    query.limit,
         offset,
         include:  [MEDIA_INCLUDE, CATEGORY_INCLUDE],
         distinct: true,
      });
   },

   listActiveByCategoryAndStore: (categoryId: string, store: StoreSlug) =>
      Product.findAll({
         where:   { categoryId, store, status: ProductStatus.ACTIVE },
         include: [MEDIA_INCLUDE],
         order:   [['isFeatured', 'DESC'], ['createdAt', 'DESC']],
      }),

   create: (data: CreateProductInput) => Product.create(data as any),

   update: (id: string, data: UpdateProductInput) =>
      Product.update(data as any, { where: { id }, returning: true }).then(([, rows]) => rows[0] ?? null),

   softDelete: (id: string) => Product.destroy({ where: { id } }),

   restore: (id: string) => (Product as any).restore({ where: { id } }),

   addMedia: (productId: string, url: string, type: 'image' | 'video', isMain = false, sortOrder = 0) =>
      ProductMedia.create({ productId, url, type: type as any, isMain, sortOrder }),

   deleteMedia: (productId: string, mediaId: string) =>
      ProductMedia.destroy({ where: { id: mediaId, productId } }),

   updateMedia: (
      productId: string,
      mediaId:   string,
      data:      Partial<{ sortOrder: number; type: 'image' | 'video'; isMain: boolean }>,
   ) =>
      ProductMedia.update(data as any, {
         where:     { id: mediaId, productId },
         returning: true,
      }).then(([, rows]) => rows[0] ?? null),

   setMainMedia: async (productId: string, mediaId: string): Promise<void> => {
      await db.transaction(async (t) => {
         await ProductMedia.update({ isMain: false }, { where: { productId }, transaction: t });
         await ProductMedia.update({ isMain: true },  { where: { id: mediaId, productId }, transaction: t });
      });
   },
};

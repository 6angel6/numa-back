import MenuCategory from '../model/MenuCategory';

export const menuCategoryRepository = {
   findAll: () =>
      MenuCategory.findAll({ order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']] }),

   findById: (id: string) => MenuCategory.findByPk(id),

   findBySlug: (slug: string) => MenuCategory.findOne({ where: { slug } }),

   create: (data: {
      name: { uz: string; ru: string; en: string };
      slug: string;
      sortOrder?: number;
      isActive?: boolean;
   }) => MenuCategory.create(data as any),

   update: (id: string, data: Partial<{
      name: { uz: string; ru: string; en: string };
      slug: string;
      sortOrder: number;
      isActive: boolean;
   }>) =>
      MenuCategory.update(data as any, { where: { id }, returning: true })
         .then(([, rows]) => rows[0] ?? null),

   delete: (id: string) => MenuCategory.destroy({ where: { id } }),
};

import { Addon } from '../model/Addon';

export const addonRepository = {
   findAll: (filters: { category?: string; isActive?: boolean }) => {
      const where: any = {};
      if (filters.category) where.category = filters.category;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;

      return Addon.findAll({ where, order: [['sortOrder', 'ASC']] });
   },

   findById: (id: string) => Addon.findByPk(id),

   create: (data: Record<string, unknown>) => Addon.create(data as any),

   update: (addon: Addon, data: Record<string, unknown>) => addon.update(data),

   destroy: (addon: Addon) => addon.destroy(),
};

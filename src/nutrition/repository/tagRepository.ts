import { Tag } from '../model/Tag';

export const tagRepository = {
   findAll: (filters: { type?: string; isActive?: boolean }) => {
      const where: any = {};
      if (filters.type) where.type = filters.type;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;

      return Tag.findAll({ where, order: [['sortOrder', 'ASC']] });
   },

   findById: (id: string) => Tag.findByPk(id),

   create: (data: Record<string, unknown>) => Tag.create(data as any),

   update: (tag: Tag, data: Record<string, unknown>) => tag.update(data),

   destroy: (tag: Tag) => tag.destroy(),
};

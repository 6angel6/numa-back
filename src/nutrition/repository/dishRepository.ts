import { Transaction, Op, Sequelize } from 'sequelize';
import { Dish } from '../model/Dish';
import { Tag } from '../model/Tag';

const dishWithTags = [{ model: Tag, as: 'tags', through: { attributes: [] } }];

export const dishRepository = {
   findAll: (filters: {
      mealType?: string;
      isActive?: boolean;
      search?: string;
      limit?: number;
      offset?: number;
   }) => {
      const where: any = {};
      if (filters.mealType) where.mealType = filters.mealType;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      if (filters.search) {
         where[Op.or] = [
            Sequelize.where(
               Sequelize.cast(Sequelize.json('name.ru'), 'text'),
               Op.iLike,
               `%${filters.search}%`
            ),
            Sequelize.where(
               Sequelize.cast(Sequelize.json('name.uz'), 'text'),
               Op.iLike,
               `%${filters.search}%`
            ),
         ];
      }

      return Dish.findAndCountAll({
         where,
         include: dishWithTags,
         order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']],
         limit: filters.limit ?? 20,
         offset: filters.offset ?? 0,
      });
   },

   findById: (id: string, transaction?: Transaction) =>
      Dish.findByPk(id, { include: dishWithTags, transaction }),

   findByIdRaw: (id: string, transaction?: Transaction) =>
      Dish.findByPk(id, { transaction }),

   create: (data: {
      name: Record<string, string>;
      description?: Record<string, string> | null;
      imageUrl?: string | null;
      mealType: string;
      calories?: number;
      proteins?: number;
      fats?: number;
      carbs?: number;
      servingSize?: string | null;
      weightGrams?: number | null;
      priceTiyin?: number;
      ingredients?: string[];
   }, transaction?: Transaction) =>
      Dish.create(
         {
            ...data,
            calories: data.calories || 0,
            proteins: data.proteins || 0,
            fats: data.fats || 0,
            carbs: data.carbs || 0,
            priceTiyin: data.priceTiyin || 0,
            ingredients: data.ingredients || [],
         } as any,
         { transaction },
      ),

   update: (dish: Dish, data: Record<string, unknown>, transaction?: Transaction) =>
      dish.update(data, { transaction }),

   destroy: (dish: Dish) => dish.destroy(),

   setTags: async (dish: Dish, tagIds: string[], transaction?: Transaction) => {
      const tags = await Tag.findAll({ where: { id: tagIds }, transaction });
      await (dish as any).setTags(tags, { transaction });
   },
};

import { SubscriptionPlan } from '../model/SubscriptionPlan';

export const subscriptionPlanRepository = {
   findAll: (filters: { type?: string; isActive?: boolean }) => {
      const where: any = {};
      if (filters.type) where.type = filters.type;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;

      return SubscriptionPlan.findAll({ where, order: [['sortOrder', 'ASC']] });
   },

   findById: (id: string) => SubscriptionPlan.findByPk(id),

   findBySlug: (slug: string) => SubscriptionPlan.findOne({ where: { slug } }),

   create: (data: Record<string, unknown>) =>
      SubscriptionPlan.create(data as any),

   update: (plan: SubscriptionPlan, data: Record<string, unknown>) =>
      plan.update(data),

   destroy: (plan: SubscriptionPlan) => plan.destroy(),
};

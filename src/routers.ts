import express from 'express';
import adminRouter      from './admin/adminRouter';
import categoryRouter   from './category/categoryRouter';
import productRouter    from './product/productRouter';
import cartRouter       from './cart/cartRouter';
import orderRouter      from './order/orderRouter';
import paymentRouter    from './payment/paymentRouter';
import blogRouter       from './blog/blogRouter';
import restaurantRouter from './restaurant/restaurantRouter';
import nutritionRouter  from './nutrition/nutritionRouter';
import siteRouter      from './site/siteRouter';

const router = express.Router();

router.use('/admin',      adminRouter);
router.use('/categories', categoryRouter);
router.use('/products',   productRouter);
router.use('/cart',       cartRouter);
router.use('/orders',     orderRouter);
router.use('/payment',    paymentRouter);
router.use('/blog',       blogRouter);
router.use('/restaurant', restaurantRouter);
router.use('/nutrition',  nutritionRouter);
router.use('/sites',      siteRouter);

export default router;

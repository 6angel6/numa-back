import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';

interface BlogPostProductAttributes {
   blogPostId: string;
   productId:  string;
   note:       string | null;
   sortOrder:  number;
}

type BlogPostProductCreationAttributes = Optional<
   BlogPostProductAttributes,
   'note' | 'sortOrder'
>;

class BlogPostProduct
   extends Model<BlogPostProductAttributes, BlogPostProductCreationAttributes>
   implements BlogPostProductAttributes
{
   declare blogPostId: string;
   declare productId:  string;
   declare note:       string | null;
   declare sortOrder:  number;
}

BlogPostProduct.init(
   {
      blogPostId: {
         type:       DataTypes.UUID,
         allowNull:  false,
         primaryKey: true,
         field:      'blog_post_id',
      },
      productId: {
         type:       DataTypes.UUID,
         allowNull:  false,
         primaryKey: true,
         field:      'product_id',
      },
      note: {
         type:         DataTypes.STRING(500),
         allowNull:    true,
         defaultValue: null,
      },
      sortOrder: {
         type:         DataTypes.INTEGER,
         allowNull:    false,
         defaultValue: 0,
         field:        'sort_order',
      },
   },
   {
      sequelize:   db,
      tableName:   'blog_post_products',
      underscored: true,
      timestamps:  false,
   },
);

export default BlogPostProduct;

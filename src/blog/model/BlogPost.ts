import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';
import { StoreSlug, STORE_SLUGS } from '../../types';

export enum BlogPostStatus {
   DRAFT     = 'draft',
   PUBLISHED = 'published',
   ARCHIVED  = 'archived',
}

export interface MultilingualText {
   uz: string;
   ru: string;
   en: string;
}

interface BlogPostAttributes {
   id:               string;
   title:            MultilingualText;
   content:          MultilingualText;
   excerpt:          MultilingualText | null;
   slug:             string;
   coverImageUrl:    string | null;
   /** null = global / main site */
   store:            StoreSlug | null;
   /** Cross-posted to these additional stores */
   distributeTo:     StoreSlug[];
   status:           BlogPostStatus;
   publishedAt:      Date | null;
   authorId:         string | null;
   seoTitle:         MultilingualText | null;
   seoDescription:   MultilingualText | null;
   seoKeywords:      string[];
   tags:             string[];
   readTimeMinutes:  number | null;
   viewCount:        number;
   deletedAt?:       Date | null;
   createdAt?:       Date;
   updatedAt?:       Date;
}

type BlogPostCreationAttributes = Optional<
   BlogPostAttributes,
   | 'id'
   | 'excerpt'
   | 'coverImageUrl'
   | 'store'
   | 'distributeTo'
   | 'status'
   | 'publishedAt'
   | 'authorId'
   | 'seoTitle'
   | 'seoDescription'
   | 'seoKeywords'
   | 'tags'
   | 'readTimeMinutes'
   | 'viewCount'
   | 'deletedAt'
>;

class BlogPost
   extends Model<BlogPostAttributes, BlogPostCreationAttributes>
   implements BlogPostAttributes
{
   declare id:              string;
   declare title:           MultilingualText;
   declare content:         MultilingualText;
   declare excerpt:         MultilingualText | null;
   declare slug:            string;
   declare coverImageUrl:   string | null;
   declare store:           StoreSlug | null;
   declare distributeTo:    StoreSlug[];
   declare status:          BlogPostStatus;
   declare publishedAt:     Date | null;
   declare authorId:        string | null;
   declare seoTitle:        MultilingualText | null;
   declare seoDescription:  MultilingualText | null;
   declare seoKeywords:     string[];
   declare tags:            string[];
   declare readTimeMinutes: number | null;
   declare viewCount:       number;
   declare deletedAt:       Date | null;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;
}

BlogPost.init(
   {
      id: {
         type:         DataTypes.UUID,
         defaultValue: DataTypes.UUIDV4,
         primaryKey:   true,
      },
      title: {
         type:      DataTypes.JSONB,
         allowNull: false,
      },
      content: {
         type:      DataTypes.JSONB,
         allowNull: false,
      },
      excerpt: {
         type:         DataTypes.JSONB,
         allowNull:    true,
         defaultValue: null,
      },
      slug: {
         type:      DataTypes.STRING(120),
         allowNull: false,
      },
      coverImageUrl: {
         type:      DataTypes.TEXT,
         allowNull: true,
         field:     'cover_image_url',
      },
      store: {
         type:         DataTypes.ENUM(...STORE_SLUGS),
         allowNull:    true,
         defaultValue: null,
      },
      distributeTo: {
         type:         DataTypes.JSONB,
         allowNull:    false,
         defaultValue: [],
         field:        'distribute_to',
      },
      status: {
         type:         DataTypes.ENUM(...Object.values(BlogPostStatus)),
         allowNull:    false,
         defaultValue: BlogPostStatus.DRAFT,
      },
      publishedAt: {
         type:      DataTypes.DATE,
         allowNull: true,
         field:     'published_at',
      },
      authorId: {
         type:      DataTypes.UUID,
         allowNull: true,
         field:     'author_id',
      },
      seoTitle: {
         type:      DataTypes.JSONB,
         allowNull: true,
         field:     'seo_title',
      },
      seoDescription: {
         type:      DataTypes.JSONB,
         allowNull: true,
         field:     'seo_description',
      },
      seoKeywords: {
         type:         DataTypes.JSONB,
         allowNull:    false,
         defaultValue: [],
         field:        'seo_keywords',
      },
      tags: {
         type:         DataTypes.JSONB,
         allowNull:    false,
         defaultValue: [],
      },
      readTimeMinutes: {
         type:      DataTypes.INTEGER,
         allowNull: true,
         field:     'read_time_minutes',
      },
      viewCount: {
         type:         DataTypes.INTEGER,
         allowNull:    false,
         defaultValue: 0,
         field:        'view_count',
      },
      deletedAt: {
         type:      DataTypes.DATE,
         allowNull: true,
         field:     'deleted_at',
      },
   },
   {
      sequelize:   db,
      tableName:   'blog_posts',
      underscored: true,
      paranoid:    true,
      indexes: [
         { fields: ['status'] },
         { fields: ['store'] },
         { fields: ['created_at'] },
      ],
   },
);

export default BlogPost;

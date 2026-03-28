import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';
import { StoreSlug } from '../../types';

export interface SitePageAttributes {
   id:              string;
   store:           StoreSlug;
   slug:            string;
   metaTitle:       Record<string, string> | null;
   metaDescription: Record<string, string> | null;
   isPublished:     boolean;
   publishedAt:     Date | null;
   createdAt?:      Date;
   updatedAt?:      Date;
}

type SitePageCreation = Optional<
   SitePageAttributes,
   'id' | 'metaTitle' | 'metaDescription' | 'isPublished' | 'publishedAt'
>;

class SitePage extends Model<SitePageAttributes, SitePageCreation>
   implements SitePageAttributes {
   declare id:              string;
   declare store:           StoreSlug;
   declare slug:            string;
   declare metaTitle:       Record<string, string> | null;
   declare metaDescription: Record<string, string> | null;
   declare isPublished:     boolean;
   declare publishedAt:     Date | null;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;
}

SitePage.init(
   {
      id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      store:           { type: DataTypes.ENUM(...Object.values(StoreSlug)), allowNull: false },
      slug:            { type: DataTypes.STRING(100), allowNull: false },
      metaTitle:       { type: DataTypes.JSONB, allowNull: true, field: 'meta_title' },
      metaDescription: { type: DataTypes.JSONB, allowNull: true, field: 'meta_description' },
      isPublished:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_published' },
      publishedAt:     { type: DataTypes.DATE, allowNull: true, field: 'published_at' },
   },
   { sequelize: db, tableName: 'site_pages', underscored: true },
);

export default SitePage;

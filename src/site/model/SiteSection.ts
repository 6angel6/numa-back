










    import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';

// ─── Section type discriminated union ────────────────────────────────────────

export type SectionType =
   | 'hero'
   | 'text_block'
   | 'features'
   | 'gallery'
   | 'cta'
   | 'faq'
   | 'stats'
   | 'team'
   | 'reviews'
   | 'custom';

export const SECTION_TYPES: SectionType[] = [
   'hero', 'text_block', 'features', 'gallery', 'cta',
   'faq', 'stats', 'team', 'reviews', 'custom',
];

// ─── Per-type content shapes (for IDE help and frontend docs) ─────────────────

export interface I18n { uz?: string; ru?: string; en?: string }

export interface HeroContent {
   heading:        I18n;
   subheading?:    I18n;
   bgImageUrl?:    string;
   overlayOpacity?: number;          // 0-1
   ctaText?:       I18n;
   ctaLink?:       string;
   secondaryCtaText?: I18n;
   secondaryCtaLink?: string;
}

export interface TextBlockContent {
   heading?: I18n;
   body:     I18n;                   // supports HTML / markdown — frontend decides
   align?:   'left' | 'center' | 'right';
}

export interface FeatureItem {
   icon?:        string;             // emoji or icon slug
   imageUrl?:    string;
   title:        I18n;
   description?: I18n;
}
export interface FeaturesContent {
   heading?:  I18n;
   columns?:  2 | 3 | 4;
   items:     FeatureItem[];
}

export interface GalleryContent {
   heading?:   I18n;
   images:     Array<{ url: string; caption?: I18n }>;
   layout?:    'grid' | 'masonry' | 'carousel';
}

export interface CtaContent {
   heading:    I18n;
   subheading?: I18n;
   bgColor?:   string;
   bgImageUrl?: string;
   ctaText:    I18n;
   ctaLink:    string;
}

export interface FaqItem { question: I18n; answer: I18n }
export interface FaqContent {
   heading?: I18n;
   items:    FaqItem[];
}

export interface StatItem { value: string; label: I18n }
export interface StatsContent {
   heading?: I18n;
   items:    StatItem[];
}

export interface TeamMember {
   name:      string;
   role?:     I18n;
   imageUrl?: string;
   bio?:      I18n;
}
export interface TeamContent {
   heading?: I18n;
   members:  TeamMember[];
}

export interface ReviewItem {
   author:    string;
   rating?:   number;   // 1-5
   text:      I18n;
   avatarUrl?: string;
   date?:     string;
}
export interface ReviewsContent {
   heading?: I18n;
   items:    ReviewItem[];
}

export type SectionContent =
   | HeroContent
   | TextBlockContent
   | FeaturesContent
   | GalleryContent
   | CtaContent
   | FaqContent
   | StatsContent
   | TeamContent
   | ReviewsContent
   | Record<string, unknown>;  // custom

// ─── Model ────────────────────────────────────────────────────────────────────

export interface SiteSectionAttributes {
   id:         string;
   pageId:     string;
   type:       SectionType;
   sortOrder:  number;
   content:    SectionContent;
   isVisible:  boolean;
   createdAt?: Date;
   updatedAt?: Date;
}

type SiteSectionCreation = Optional<
   SiteSectionAttributes,
   'id' | 'sortOrder' | 'isVisible'
>;

class SiteSection extends Model<SiteSectionAttributes, SiteSectionCreation>
   implements SiteSectionAttributes {
   declare id:        string;
   declare pageId:    string;
   declare type:      SectionType;
   declare sortOrder: number;
   declare content:   SectionContent;
   declare isVisible: boolean;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;
}

SiteSection.init(
   {
      id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      pageId:    { type: DataTypes.UUID, allowNull: false, field: 'page_id' },
      type:      { type: DataTypes.ENUM(...SECTION_TYPES), allowNull: false },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
      content:   { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      isVisible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_visible' },
   },
   { sequelize: db, tableName: 'site_sections', underscored: true },
);

export default SiteSection;

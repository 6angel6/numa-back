import bcrypt from 'bcrypt';
import { DataTypes, Model, Optional } from 'sequelize';
import { db } from '../../../shared/config/database';
import { StoreSlug, STORE_SLUGS } from '../../types';

export enum AdminRole {
   SUPER_ADMIN = 'super_admin',
   ADMIN       = 'admin',
}

interface AdminAttributes {
   id:           string;
   name:         string;
   email:        string;
   passwordHash: string;
   role:         AdminRole;
   /** Store this admin manages. null = global access (super_admin only). */
   storeSlug:    StoreSlug | null;
   /** Explicit permission keys. super_admin ignores this — all permissions are implicit. */
   permissions:  string[];
   isActive:     boolean;
   lastLoginAt:  Date | null;
   createdAt?:   Date;
   updatedAt?:   Date;
}

type AdminCreationAttributes = Optional<
   AdminAttributes,
   'id' | 'storeSlug' | 'permissions' | 'isActive' | 'lastLoginAt'
>;

class Admin
   extends Model<AdminAttributes, AdminCreationAttributes>
   implements AdminAttributes
{
   declare id:           string;
   declare name:         string;
   declare email:        string;
   declare passwordHash: string;
   declare role:         AdminRole;
   declare storeSlug:    StoreSlug | null;
   declare permissions:  string[];
   declare isActive:     boolean;
   declare lastLoginAt:  Date | null;
   declare readonly createdAt: Date;
   declare readonly updatedAt: Date;

   public verifyPassword(candidate: string): Promise<boolean> {
      return bcrypt.compare(candidate, this.passwordHash);
   }
}

Admin.init(
   {
      id: {
         type:         DataTypes.UUID,
         defaultValue: DataTypes.UUIDV4,
         primaryKey:   true,
      },
      name: {
         type:      DataTypes.STRING(100),
         allowNull: false,
      },
      email: {
         type:      DataTypes.STRING(255),
         allowNull: false,
         unique:    true,
      },
      passwordHash: {
         type:      DataTypes.STRING(255),
         allowNull: false,
         field:     'password_hash',
      },
      role: {
         type:         DataTypes.ENUM(...Object.values(AdminRole)),
         allowNull:    false,
         defaultValue: AdminRole.ADMIN,
      },
      storeSlug: {
         type:      DataTypes.ENUM(...STORE_SLUGS),
         allowNull: true,
         field:     'store_slug',
      },
      permissions: {
         type:         DataTypes.JSONB,
         allowNull:    false,
         defaultValue: [],
      },
      isActive: {
         type:         DataTypes.BOOLEAN,
         allowNull:    false,
         defaultValue: true,
         field:        'is_active',
      },
      lastLoginAt: {
         type:      DataTypes.DATE,
         allowNull: true,
         field:     'last_login_at',
      },
   },
   {
      sequelize:   db,
      tableName:   'admins',
      underscored: true,
      indexes: [
         { unique: true, fields: ['email'] },
         { fields: ['is_active'] },
         { fields: ['store_slug'] },
      ],
   },
);

export default Admin;

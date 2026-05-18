import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
})
export class SalesAdmin extends Document {
  @Prop({ required: true, unique: true, default: 'SALES_ADMIN' })
  singleton_key!: string;

  @Prop({ required: true, unique: true, trim: true })
  admin_id!: string;

  @Prop({ required: true })
  password_hash!: string;

  @Prop({ trim: true })
  name?: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ default: true })
  is_active!: boolean;

  @Prop()
  last_login_at?: Date;
}

export const SalesAdminSchema = SchemaFactory.createForClass(SalesAdmin);

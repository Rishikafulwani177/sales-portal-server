import { IsNotEmpty, IsString } from 'class-validator';

export class SalesAdminLoginDto {
  @IsString()
  @IsNotEmpty()
  admin_id!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

import { IsNotEmpty, IsString } from 'class-validator';

export class SalespersonLoginDto {
  @IsString()
  @IsNotEmpty()
  salesperson_id!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

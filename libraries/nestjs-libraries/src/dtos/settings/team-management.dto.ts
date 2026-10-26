import { IsIn, IsString, IsNotEmpty } from 'class-validator';

export class TeamRoleDto {
  @IsString()
  @IsIn(['USER', 'ADMIN'])
  role: 'USER' | 'ADMIN';
}

export class DeleteWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

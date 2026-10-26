import {
  IsDefined,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class AdminAddTeamMemberDto {
  @IsDefined()
  @IsEmail()
  email: string;

  @IsString()
  @IsIn(['USER', 'ADMIN'])
  role: string;
  // Confirm the workspace shown in the dialog; never use this to select one.
  @IsOptional()
  @IsString()
  expectedWorkspaceId?: string;
}

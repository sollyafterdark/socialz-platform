import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class WorkspaceSettingsDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Workspace name is required' })
  @MaxLength(100, { message: 'Workspace name must be 100 characters or fewer' })
  @Matches(/^[^<>\u0000-\u001f\u007f]+$/u, {
    message: 'Workspace name cannot contain markup or control characters',
  })
  name: string;
}

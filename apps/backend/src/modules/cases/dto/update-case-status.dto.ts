import { IsIn } from 'class-validator';

export class UpdateCaseStatusDto {
  @IsIn(['open', 'in_progress', 'blocked', 'closed'])
  status!: 'open' | 'in_progress' | 'blocked' | 'closed';
}

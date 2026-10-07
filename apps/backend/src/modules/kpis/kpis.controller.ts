import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../common/roles/roles.decorator';
import { KpisService } from './kpis.service';

@Controller('kpis')
export class KpisController {
  constructor(private readonly kpisService: KpisService) {}

  @Roles('technician', 'manager', 'commercial')
  @Get('summary')
  summary() {
    return this.kpisService.getSummary();
  }
}

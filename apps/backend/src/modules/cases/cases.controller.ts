import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { Roles } from '../../common/roles/roles.decorator';
import { UpdateCaseStatusDto } from './dto/update-case-status.dto';
import { CasesService } from './cases.service';

@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Roles('technician', 'manager', 'commercial')
  @Get()
  list() {
    return this.casesService.list();
  }

  @Roles('technician', 'manager', 'commercial')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.casesService.getById(id);
  }

  @Roles('technician', 'manager')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateCaseStatusDto) {
    return this.casesService.updateStatus(id, body.status);
  }
}

import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../../common/roles/roles.decorator';
import { WorkOrdersService } from './work-orders.service';

@Controller('work-orders')
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Roles('technician', 'manager')
  @Get()
  list() {
    return this.workOrdersService.list();
  }

  @Roles('technician', 'manager')
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.workOrdersService.getById(id);
  }
}

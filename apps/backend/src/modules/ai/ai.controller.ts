import { Body, Controller, Post } from '@nestjs/common';
import { Roles } from '../../common/roles/roles.decorator';
import { AskAiDto } from './dto/ask-ai.dto';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Roles('technician', 'manager', 'commercial')
  @Post('chat')
  chat(@Body() dto: AskAiDto) {
    return this.aiService.ask(dto);
  }
}

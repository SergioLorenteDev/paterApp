import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuthGuard } from './common/auth/auth.guard';
import { RolesGuard } from './common/roles/roles.guard';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AssetsModule } from './modules/assets/assets.module';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { CasesModule } from './modules/cases/cases.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { HealthModule } from './modules/health/health.module';
import { KpisModule } from './modules/kpis/kpis.module';
import { WorkOrdersModule } from './modules/work-orders/work-orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    AiModule,
    HealthModule,
    AssetsModule,
    DocumentsModule,
    CasesModule,
    KpisModule,
    WorkOrdersModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}

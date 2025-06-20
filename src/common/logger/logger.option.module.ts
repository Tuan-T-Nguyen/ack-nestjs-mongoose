import { Module } from '@nestjs/common';
import { LoggerOptionService } from '@common/logger/services/logger.option.service';

@Module({
    imports: [],
    providers: [LoggerOptionService],
    exports: [LoggerOptionService],
})
export class LoggerOptionModule {}

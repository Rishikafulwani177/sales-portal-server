import { Global, Module } from '@nestjs/common';
import { AppApiService } from './app-api.service';

@Global()
@Module({
  providers: [AppApiService],
  exports: [AppApiService],
})
export class AppApiModule {}

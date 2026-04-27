import { Injectable } from '@nestjs/common';
import { Cron }       from '@nestjs/schedule';
import { TransferService } from './transfer.service';

@Injectable()
export class TransferExpiryService {
  constructor(private readonly transferService: TransferService) {}

  /** Runs every hour — warns at 3 days remaining, auto-expires at 10 days. */
  @Cron('0 * * * *')
  async handleExpiry() {
    await this.transferService.processExpiry();
  }
}

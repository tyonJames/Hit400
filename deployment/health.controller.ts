// =============================================================================
// src/health/health.controller.ts — BlockLand Health Check Endpoint
// =============================================================================
//
// PURPOSE: Provides GET /health for Railway health monitoring.
//          Returns system status, blockchain connection, and contract address.
//          This endpoint is @Public() — no JWT required.
//
// Railway uses this endpoint to determine if the deployment is healthy.
// If it returns non-2xx, Railway will restart the container.
//
// USAGE:
//   GET https://blockland-api.up.railway.app/health
//   → { "status": "ok", "blockchain": "testnet", "contract": "ST...", "timestamp": "..." }
// =============================================================================

import { Controller, Get }     from '@nestjs/common';
import { InjectDataSource }    from '@nestjs/typeorm';
import { DataSource }          from 'typeorm';
import { Public }              from '@/common/decorators/public.decorator';
import { ConfigService }       from '@nestjs/config';

interface HealthResponse {
  status:     'ok' | 'degraded';
  blockchain: string;
  contract:   string;
  database:   'connected' | 'disconnected';
  uptime:     number;
  timestamp:  string;
  version:    string;
}

@Controller()
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  /**
   * GET /health
   * Returns system health status.
   * Used by Railway for health monitoring and by the dissertation demo
   * to verify the system is running before the examination.
   */
  @Public()
  @Get('health')
  async getHealth(): Promise<HealthResponse> {
    // Check database connectivity with a cheap query
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    try {
      await this.dataSource.query('SELECT 1');
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
    }

    const contract   = this.config.get<string>('CLARITY_CONTRACT_ADDRESS') ?? 'not-configured';
    const network    = this.config.get<string>('STACKS_NETWORK')           ?? 'testnet';
    const isHealthy  = dbStatus === 'connected' && contract !== 'not-configured';

    return {
      status:     isHealthy ? 'ok' : 'degraded',
      blockchain: network,
      contract,
      database:   dbStatus,
      uptime:     Math.floor(process.uptime()),
      timestamp:  new Date().toISOString(),
      version:    process.env.npm_package_version ?? '1.0.0',
    };
  }
}

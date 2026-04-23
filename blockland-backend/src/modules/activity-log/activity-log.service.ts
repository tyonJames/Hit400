import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';
import { ActivityLog }      from '../../database/entities/activity-log.entity';

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLog) private logRepo: Repository<ActivityLog>,
  ) {}

  async log(params: {
    userId?:     string | null;
    action:      string;
    entityType:  string;
    entityId:    string;
    metadata?:   Record<string, unknown>;
  }) {
    const entry = this.logRepo.create({
      userId:     params.userId ?? null,
      action:     params.action,
      entityType: params.entityType,
      entityId:   params.entityId,
      metadata:   params.metadata ?? null,
    });
    return this.logRepo.save(entry);
  }

  async findAll(params: { page?: number; limit?: number } = {}) {
    const page  = params.page  ?? 1;
    const limit = params.limit ?? 20;
    const [data, total] = await this.logRepo.findAndCount({
      order: { performedAt: 'DESC' },
      skip:  (page - 1) * limit,
      take:  limit,
      relations: ['user'],
    });
    return { data, total, page, limit };
  }
}

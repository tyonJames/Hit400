import {
  Injectable, NotFoundException, ForbiddenException,
  ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not } from 'typeorm';
import { MarketplaceListing } from '../../database/entities/marketplace-listing.entity';
import { BuyerInterest }      from '../../database/entities/buyer-interest.entity';
import { Property }           from '../../database/entities/property.entity';
import { Transfer }           from '../../database/entities/transfer.entity';
import { OwnershipRecord }    from '../../database/entities/ownership-record.entity';
import { ActivityLogService } from '../activity-log/activity-log.service';
import {
  ListingStatus, InterestStatus, PropertyStatus, TransferStatus,
} from '../../database/enums';
import { CreateListingDto }    from './dto/create-listing.dto';
import { ExpressInterestDto }  from './dto/express-interest.dto';
import { JwtPayload }          from '../auth/strategies/jwt.strategy';

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectRepository(MarketplaceListing) private listingRepo: Repository<MarketplaceListing>,
    @InjectRepository(BuyerInterest)      private interestRepo: Repository<BuyerInterest>,
    @InjectRepository(Property)           private propertyRepo: Repository<Property>,
    @InjectRepository(Transfer)           private transferRepo: Repository<Transfer>,
    private dataSource:         DataSource,
    private activityLogService: ActivityLogService,
  ) {}

  // ── Listings ─────────────────────────────────────────────────────────────

  async createListing(dto: CreateListingDto, user: JwtPayload) {
    if (dto.minPrice > dto.maxPrice) {
      throw new BadRequestException('Min price cannot exceed max price.');
    }
    const property = await this.propertyRepo.findOne({ where: { id: dto.propertyId } });
    if (!property) throw new NotFoundException('Property not found.');
    if (property.currentOwnerId !== user.sub) {
      throw new ForbiddenException('Only the property owner can list it.');
    }
    if (property.status !== PropertyStatus.ACTIVE) {
      throw new ConflictException(`Property status is ${property.status}. Only ACTIVE properties can be listed.`);
    }
    const existing = await this.listingRepo.findOne({
      where: { propertyId: dto.propertyId, status: ListingStatus.ACTIVE },
    });
    if (existing) throw new ConflictException('This property already has an active listing.');

    const listing = await this.listingRepo.save(this.listingRepo.create({
      propertyId:     dto.propertyId,
      sellerId:       user.sub,
      minPrice:       dto.minPrice,
      maxPrice:       dto.maxPrice,
      paymentMethods: dto.paymentMethods,
      description:    dto.description,
      status:         ListingStatus.ACTIVE,
    }));

    await this.activityLogService.log({
      userId: user.sub, action: 'LISTING_CREATED',
      entityType: 'MarketplaceListing', entityId: listing.id,
    });
    return listing;
  }

  async findAll(params: { page?: number; limit?: number; search?: string; minPrice?: number; maxPrice?: number }) {
    const page  = params.page  ?? 1;
    const limit = params.limit ?? 20;
    const qb = this.listingRepo.createQueryBuilder('l')
      .leftJoinAndSelect('l.property', 'p')
      .leftJoinAndSelect('l.seller', 'seller')
      .where('l.status = :status', { status: ListingStatus.ACTIVE })
      .orderBy('l.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (params.search) {
      qb.andWhere(
        '(p.address ILIKE :s OR p.plot_number ILIKE :s OR l.description ILIKE :s)',
        { s: `%${params.search}%` },
      );
    }
    if (params.minPrice) qb.andWhere('l.max_price >= :min', { min: params.minPrice });
    if (params.maxPrice) qb.andWhere('l.min_price <= :max', { max: params.maxPrice });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string, userId?: string) {
    const listing = await this.listingRepo.findOne({
      where:     { id },
      relations: ['property', 'seller', 'interests', 'interests.buyer'],
    });
    if (!listing) throw new NotFoundException('Listing not found.');

    // Attach caller's interest status if userId provided
    let myInterest: BuyerInterest | null = null;
    if (userId) {
      myInterest = await this.interestRepo.findOne({
        where: { listingId: id, buyerId: userId },
      });
    }
    return { ...listing, myInterest };
  }

  async findBySeller(userId: string) {
    return this.listingRepo.find({
      where:     { sellerId: userId },
      relations: ['property', 'interests', 'interests.buyer'],
      order:     { createdAt: 'DESC' },
    });
  }

  async updateListing(id: string, dto: Partial<CreateListingDto>, user: JwtPayload) {
    const listing = await this.listingRepo.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found.');
    if (listing.sellerId !== user.sub) throw new ForbiddenException('Only the seller can edit this listing.');
    if (listing.status !== ListingStatus.ACTIVE) throw new ConflictException('Only active listings can be edited.');
    if (dto.minPrice && dto.maxPrice && dto.minPrice > dto.maxPrice) {
      throw new BadRequestException('Min price cannot exceed max price.');
    }
    Object.assign(listing, dto);
    return this.listingRepo.save(listing);
  }

  async delistListing(id: string, user: JwtPayload) {
    const listing = await this.listingRepo.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found.');
    if (listing.sellerId !== user.sub) throw new ForbiddenException('Only the seller can delist.');
    if (listing.status === ListingStatus.SOLD) throw new ConflictException('Cannot delist a sold property.');
    listing.status = ListingStatus.CANCELLED;
    await this.listingRepo.save(listing);
    return { message: 'Listing removed from marketplace.' };
  }

  // ── Interests ─────────────────────────────────────────────────────────────

  async expressInterest(listingId: string, dto: ExpressInterestDto, user: JwtPayload) {
    const listing = await this.listingRepo.findOne({ where: { id: listingId, status: ListingStatus.ACTIVE } });
    if (!listing) throw new NotFoundException('Active listing not found.');
    if (listing.sellerId === user.sub) throw new ForbiddenException('Cannot express interest in your own listing.');

    const existing = await this.interestRepo.findOne({ where: { listingId, buyerId: user.sub } });
    if (existing) {
      if (existing.status === InterestStatus.WITHDRAWN) {
        existing.status  = InterestStatus.PENDING;
        existing.message = dto.message ?? null;
        await this.interestRepo.save(existing);
        return existing;
      }
      throw new ConflictException('You have already expressed interest in this listing.');
    }

    const interest = await this.interestRepo.save(this.interestRepo.create({
      listingId,
      buyerId: user.sub,
      message: dto.message ?? null,
      status:  InterestStatus.PENDING,
    }));

    await this.activityLogService.log({
      userId: user.sub, action: 'INTEREST_EXPRESSED',
      entityType: 'MarketplaceListing', entityId: listingId,
    });
    return interest;
  }

  async withdrawInterest(listingId: string, user: JwtPayload) {
    const interest = await this.interestRepo.findOne({
      where: { listingId, buyerId: user.sub },
    });
    if (!interest) throw new NotFoundException('Interest not found.');
    if (interest.status === InterestStatus.SELECTED) {
      throw new ConflictException('You have been selected — cancel the transfer instead.');
    }
    interest.status = InterestStatus.WITHDRAWN;
    await this.interestRepo.save(interest);
    return { message: 'Interest withdrawn.' };
  }

  async getInterests(listingId: string, user: JwtPayload) {
    const listing = await this.listingRepo.findOne({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found.');
    const isOwner = listing.sellerId === user.sub;
    const isPrivileged = user.roles.includes('REGISTRAR') || user.roles.includes('ADMIN');
    if (!isOwner && !isPrivileged) throw new ForbiddenException('Access denied.');
    return this.interestRepo.find({
      where:     { listingId, status: Not(InterestStatus.WITHDRAWN) },
      relations: ['buyer'],
      order:     { createdAt: 'ASC' },
    });
  }

  // ── Select buyer → creates transfer ─────────────────────────────────────

  async selectBuyer(listingId: string, interestId: string, paymentMethod: string, user: JwtPayload) {
    const listing = await this.listingRepo.findOne({
      where:     { id: listingId, status: ListingStatus.ACTIVE },
      relations: ['property'],
    });
    if (!listing) throw new NotFoundException('Active listing not found.');
    if (listing.sellerId !== user.sub) throw new ForbiddenException('Only the seller can select a buyer.');

    const interest = await this.interestRepo.findOne({
      where: { id: interestId, listingId, status: InterestStatus.PENDING },
    });
    if (!interest) throw new NotFoundException('Pending interest not found.');

    const transfer = await this.dataSource.transaction(async (em) => {
      // Mark listing sold
      listing.status = ListingStatus.SOLD;
      await em.save(listing);

      // Mark selected interest
      interest.status = InterestStatus.SELECTED;
      await em.save(interest);

      // Mark other interests NOT_SELECTED
      await em.update(BuyerInterest,
        { listingId, status: InterestStatus.PENDING },
        { status: InterestStatus.NOT_SELECTED },
      );

      // Lock property
      listing.property.status = PropertyStatus.PENDING_TRANSFER;
      await em.save(listing.property);

      // Create marketplace transfer
      return em.save(em.create(Transfer, {
        propertyId:          listing.propertyId,
        sellerId:            user.sub,
        buyerId:             interest.buyerId,
        status:              TransferStatus.PENDING_REGISTRAR_TERMS,
        marketplaceListingId: listingId,
        paymentMethod,
        minPrice:            listing.minPrice,
        maxPrice:            listing.maxPrice,
        saleValue:           null,
        notes:               null,
      }));
    });

    await this.activityLogService.log({
      userId: user.sub, action: 'TRANSFER_INITIATED',
      entityType: 'Transfer', entityId: transfer.id,
      metadata: { via: 'marketplace', listingId },
    });
    return transfer;
  }
}

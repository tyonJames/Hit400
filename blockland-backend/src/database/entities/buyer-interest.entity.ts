import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity }        from './base.entity';
import { MarketplaceListing } from './marketplace-listing.entity';
import { User }              from './user.entity';
import { InterestStatus }    from '../enums';

@Entity('buyer_interests')
@Index('IDX_interests_listing_id', ['listingId'])
@Index('IDX_interests_buyer_id',   ['buyerId'])
@Unique('UQ_buyer_interest', ['listingId', 'buyerId'])
export class BuyerInterest extends BaseEntity {
  @Column({ name: 'listing_id', type: 'uuid' })
  listingId: string;

  @Column({ name: 'buyer_id', type: 'uuid' })
  buyerId: string;

  @Column({ name: 'message', type: 'varchar', length: 500, nullable: true })
  message: string | null;

  @Column({ name: 'status', type: 'enum', enum: InterestStatus, default: InterestStatus.PENDING })
  status: InterestStatus;

  @ManyToOne(() => MarketplaceListing, (listing) => listing.interests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing: MarketplaceListing;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;
}

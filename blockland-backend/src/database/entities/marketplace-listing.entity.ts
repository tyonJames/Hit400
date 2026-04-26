import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { BaseEntity }    from './base.entity';
import { Property }      from './property.entity';
import { User }          from './user.entity';
import { BuyerInterest } from './buyer-interest.entity';
import { ListingStatus } from '../enums';

@Entity('marketplace_listings')
@Index('IDX_listings_property_id', ['propertyId'])
@Index('IDX_listings_seller_id',   ['sellerId'])
@Index('IDX_listings_status',      ['status'])
export class MarketplaceListing extends BaseEntity {
  @Column({ name: 'property_id', type: 'uuid' })
  propertyId: string;

  @Column({ name: 'seller_id', type: 'uuid' })
  sellerId: string;

  @Column({ name: 'min_price', type: 'decimal', precision: 15, scale: 2 })
  minPrice: number;

  @Column({ name: 'max_price', type: 'decimal', precision: 15, scale: 2 })
  maxPrice: number;

  @Column({ name: 'payment_methods', type: 'json' })
  paymentMethods: string[];

  @Column({ name: 'description', type: 'varchar', length: 1000 })
  description: string;

  @Column({ name: 'status', type: 'enum', enum: ListingStatus, default: ListingStatus.ACTIVE })
  status: ListingStatus;

  @ManyToOne(() => Property, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @OneToMany(() => BuyerInterest, (bi) => bi.listing, { cascade: ['insert'] })
  interests: BuyerInterest[];
}

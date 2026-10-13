import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';
import {
  VideoFailureReason,
  VideoProcessingStatus,
  VideoPublicationStatus,
} from './video-enums';

// bigint comes back from pg as a string; 10 GiB is well below Number.MAX_SAFE_INTEGER.
const bigintToNumber = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity('videos')
@Index(['channel_id'])
@Index(['processing_status', 'created_at'])
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 11, unique: true })
  public_id: string;

  @Column({ type: 'uuid' })
  channel_id: string;

  @Column({ type: 'varchar', length: 255 })
  original_filename: string;

  @Column({
    type: 'enum',
    enum: VideoProcessingStatus,
    enumName: 'video_processing_status',
    default: VideoProcessingStatus.AWAITING_UPLOAD,
  })
  processing_status: VideoProcessingStatus;

  @Column({
    type: 'enum',
    enum: VideoPublicationStatus,
    enumName: 'video_publication_status',
    default: VideoPublicationStatus.DRAFT,
  })
  publication_status: VideoPublicationStatus;

  @Column({
    type: 'enum',
    enum: VideoFailureReason,
    enumName: 'video_failure_reason',
    nullable: true,
  })
  failure_reason: VideoFailureReason | null;

  @Column({ type: 'integer', nullable: true })
  duration_ms: number | null;

  @Column({ type: 'integer', nullable: true })
  width: number | null;

  @Column({ type: 'integer', nullable: true })
  height: number | null;

  @Column({ type: 'bigint', nullable: true, transformer: bigintToNumber })
  size_bytes: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Channel, (channel) => channel.videos, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;
}

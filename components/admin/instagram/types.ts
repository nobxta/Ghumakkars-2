export interface IgProfileData {
  id: string;
  username: string;
  name?: string;
  biography?: string;
  website?: string;
  followers_count: number;
  follows_count: number;
  media_count: number;
  profile_picture_url?: string;
}

export interface OverviewData {
  fetchedAt: string;
  profile: IgProfileData;
  totals: { day: Record<string, number>; week: Record<string, number>; month: Record<string, number> };
  previous?: { day: Record<string, number>; week: Record<string, number>; month: Record<string, number> };
  followers: { date: string; value: number }[];
  demographics: Record<string, { label: string; value: number }[]>;
}

export interface IgMediaItem {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_product_type?: 'FEED' | 'REELS' | 'STORY' | 'AD';
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
  insights: Record<string, number>;
}

export interface MediaData { fetchedAt: string; media: IgMediaItem[] }

export interface InboxToday {
  dmsIn: number; people: number; peopleReplied: number; autoDm: number;
  comments: number; commentsReplied: number; autoComment: number; privateReplies: number; failed: number;
}

export interface ThreadMessage { id: string; direction: 'in' | 'out'; text: string | null; has_attachment: boolean; is_auto: boolean; created_at: string }

export interface InboxData {
  today: InboxToday;
  days: { date: string; dmsIn: number; people: number; comments: number; autoReplies: number }[];
  conversations: {
    id: string; user_id: string | null; username: string | null; unanswered: number;
    last: { id: string; direction: 'in' | 'out'; text: string | null; has_attachment: boolean; is_auto: boolean; created_at: string };
  }[];
  comments: {
    id: string; media_id: string; media_permalink: string | null; user_id: string | null; username: string | null; text: string | null;
    created_at: string; replied: boolean; reply_source: 'auto' | 'manual' | null; reply_text: string | null; replied_at: string | null; dm_sent: boolean;
  }[];
  autoReplies: { id: number; kind: 'dm' | 'comment' | 'comment_dm'; recipient: string | null; text: string | null; status: 'sent' | 'failed'; error: string | null; created_at: string }[];
  automation: AutomationSettings | null;
}

export interface AutomationSettings {
  dm_enabled: boolean; dm_enabled_at: string | null; dm_mode: 'fixed' | 'random'; dm_cooldown_hours: number;
  comment_enabled: boolean; comment_enabled_at: string | null; comment_mode: 'fixed' | 'random';
  comment_dm_enabled: boolean; comment_posts_to_watch: number;
  last_sync_at: string | null; last_error: string | null; last_error_at: string | null; paused_until: string | null;
}

export interface ReplyTemplate { id: string; kind: 'dm' | 'comment'; text: string; is_active: boolean; pinned: boolean; use_count: number; created_at: string }

export const mediaThumb = (m: IgMediaItem) => m.thumbnail_url || m.media_url || '';
export const isReel = (m: IgMediaItem) => m.media_product_type === 'REELS' || m.media_type === 'VIDEO';

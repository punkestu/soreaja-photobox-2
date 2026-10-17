export interface IdlePolaroidItem {
  id: string | number;
  image: string;
  frameName: string;
  timeAgoTextId: string;
  timeAgoTextEn: string;
  dateStr: string;
  isRealSession: boolean;
  tilt: number; // degrees e.g. -7, 5, -4
  floatDelay: string; // e.g. '0s', '1.2s'
}

export const SAMPLE_IDLE_STRIPS: IdlePolaroidItem[] = [
  {
    id: 'sample_1',
    image: '/assets/frames/sunday-3-photo-preview.png',
    frameName: 'Sunday Morning 3-Cut',
    timeAgoTextId: '3 menit lalu',
    timeAgoTextEn: '3m ago',
    dateStr: '16 OKT · Sesi #128',
    isRealSession: false,
    tilt: -6,
    floatDelay: '0s',
  },
  {
    id: 'sample_2',
    image: '/assets/frames/hbd-1-preview.png',
    frameName: 'Happy Birthday Celebration',
    timeAgoTextId: '12 menit lalu',
    timeAgoTextEn: '12m ago',
    dateStr: '16 OKT · Sesi #127',
    isRealSession: false,
    tilt: 5,
    floatDelay: '1.5s',
  },
  {
    id: 'sample_3',
    image: '/assets/frames/friends-3_transparent-preview.png',
    frameName: 'Best Friends Forever',
    timeAgoTextId: '25 menit lalu',
    timeAgoTextEn: '25m ago',
    dateStr: '16 OKT · Sesi #126',
    isRealSession: false,
    tilt: -4,
    floatDelay: '0.8s',
  },
  {
    id: 'sample_4',
    image: '/assets/frames/cute-emo-4_transparent-preview.png',
    frameName: 'Cute Emoji 4-Grid',
    timeAgoTextId: '42 menit lalu',
    timeAgoTextEn: '42m ago',
    dateStr: '16 OKT · Sesi #125',
    isRealSession: false,
    tilt: 7,
    floatDelay: '2.1s',
  },
  {
    id: 'sample_5',
    image: '/assets/frames/groovy-3_transparent-preview.png',
    frameName: 'Groovy Sunset Strip',
    timeAgoTextId: '1 jam lalu',
    timeAgoTextEn: '1h ago',
    dateStr: '16 OKT · Sesi #124',
    isRealSession: false,
    tilt: -8,
    floatDelay: '1.1s',
  },
  {
    id: 'sample_6',
    image: '/assets/frames/hbd-2-preview.png',
    frameName: 'Birthday Memories Deluxe',
    timeAgoTextId: '2 jam lalu',
    timeAgoTextEn: '2h ago',
    dateStr: '16 OKT · Sesi #123',
    isRealSession: false,
    tilt: 4,
    floatDelay: '2.7s',
  },
];

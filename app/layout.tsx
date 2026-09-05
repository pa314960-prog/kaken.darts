import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'AIR DARTS | 手の動きでダーツ', description: 'カメラに手を映して、つまんで離して投げるダーツゲーム。1人用カウントアップ・全8ラウンド。' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="ja"><body>{children}</body></html>; }

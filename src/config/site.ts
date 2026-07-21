import profile from '../../data/profile.json';

export const SITE_URL = (process.env.SITE_URL || 'https://bbing.xyz').replace(/\/$/, '');

export const siteProfile = profile;

export const topicOrder = ['Agent 架构', '生产工程', 'AI 原理', '技术领导力', '工程实践', '随笔'] as const;

export type Topic = (typeof topicOrder)[number];

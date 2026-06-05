import dotenv from 'dotenv';

dotenv.config();
export const DB_URL = process.env.DB_URL;
export const RESEND_API_KEY = process.env.RESEND_API_KEY;
export const EMAIL_FROM = process.env.EMAIL_FROM;
export const EMAIL_TO = process.env.EMAIL_TO;
export const MAX_ARTICLE_AGE_HOURS = process.env.MAX_ARTICLE_AGE_HOURS;
export const TOP_ARTICLES_COUNT = process.env.TOP_ARTICLES_COUNT;
export const AI_PROVIDER = process.env.AI_PROVIDER;
export const AI_API_KEY = process.env.AI_API_KEY;
export const GEMINI_MODEL = process.env.GEMINI_MODEL;
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL;
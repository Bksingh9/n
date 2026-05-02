import Stripe from 'stripe';
import { serverEnv } from '@/lib/env';

let _stripe: Stripe | null = null;

export const getStripe = () => {
  if (_stripe) return _stripe;
  const env = serverEnv();
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  _stripe = new Stripe(env.STRIPE_SECRET_KEY);
  return _stripe;
};

export const getStripePrices = () => {
  const env = serverEnv();
  return {
    starter: env.STRIPE_PRICE_STARTER,
    pro: env.STRIPE_PRICE_PRO,
    agency: env.STRIPE_PRICE_AGENCY,
  };
};

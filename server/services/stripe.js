import Stripe from 'stripe'
import { assertStripeConfigured, config } from '../config.js'

let stripe

export function getStripe() {
  assertStripeConfigured()
  stripe ??= new Stripe(config.stripeSecretKey)
  return stripe
}

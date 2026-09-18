import { Router } from 'express'
import { z } from 'zod'
import { createBatch, getBatch, getCreditBalance, verifyEmail } from '../services/verificationProvider.js'

const router = Router()

const responseFields = [
  'accept_all', 'birth_year', 'did_you_mean', 'disposable', 'domain', 'email',
  'first_name', 'free', 'full_name', 'gender', 'last_name', 'mailbox_full',
  'mx_record', 'no_reply', 'reason', 'role', 'score', 'smtp_provider', 'state',
  'tag', 'user',
]

const verifySchema = z.object({
  email: z.email(),
  smtp: z.boolean().default(true),
  accept_all: z.boolean().default(false),
  timeout: z.coerce.number().int().min(2).max(10).default(5),
})

const batchSchema = z.object({
  emails: z.array(z.email()).min(1).max(50000),
  url: z.url().optional(),
  response_fields: z.array(z.enum(responseFields)).optional(),
  retries: z.boolean().default(true),
})

router.post('/verify', async (request, response, next) => {
  try {
    const input = verifySchema.parse(request.body)
    response.json(await verifyEmail(input))
  } catch (error) {
    next(error)
  }
})

router.post('/batches', async (request, response, next) => {
  try {
    const input = batchSchema.parse(request.body)
    response.status(202).json(await createBatch(input))
  } catch (error) {
    next(error)
  }
})

router.get('/batches/:id', async (request, response, next) => {
  try {
    response.json(await getBatch(z.string().min(1).parse(request.params.id)))
  } catch (error) {
    next(error)
  }
})

router.get('/credits', async (_request, response, next) => {
  try {
    response.json(await getCreditBalance())
  } catch (error) {
    next(error)
  }
})

export default router


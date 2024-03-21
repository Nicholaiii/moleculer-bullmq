import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ActionHandler, ActionParams, ActionSchema, Service, ServiceBroker, ServiceSchema } from 'moleculer'

import { createBullMQMixin, BullMQMixin, ServiceWithBullMQMixin } from '.'

let broker: ServiceBroker
const createService = (name: string, actions?: {
  [key: string]: ActionSchema & { queue: true }
}) => broker.createService({
  name,
  mixins: [createBullMQMixin()],
  actions: actions ?? {}
}) as ServiceWithBullMQMixin

describe('Bullmq Mixin', async () => {
  beforeAll(async () => {
    if (!broker) broker = new ServiceBroker({
      cacher: `redis://localhost`
    })

    await broker.start()
  })

  it('exports a function', async t => {
    expect(createBullMQMixin).toBeTypeOf('function')
  })

  it('provides mixin methods', () => {
    const service = createService('provide-mixin')

    expect(service.queue).toBeTruthy()
  })

  it('attaches private variables', () => {
    const service = createService('private-variables')

    expect(service.$bullmq).toBeDefined()
    expect(service.$bullmq.connection).toBeDefined()
    expect(service.$bullmq.queues).toBeDefined()
    expect(service.$bullmq.queueEvents).toBeDefined()
    expect(service.$bullmq.worker).toBeDefined()

  })

  it('provides access to queues', () => {
    const service = createService('private-variables')
    expect(service.$bullmq.queues.get('test')).toBeUndefined()
    expect(service.queue('test')).toBeDefined()
    expect(service.queue('test').getActiveCount()).resolves.toBe(0)
  })

  it('allows adding to a queue', async () => {
    const service = createService('add-to-queue')
    await service.queue('add-to-queue').add('test', { foo: 'bar' })
    expect(
      service.queue('add-to-queue').getJobCounts()
    ).resolves.toHaveProperty('active', 1)
  })

  it('processes tasks', async () => {
    const service = createService('process', {
      foo: {
        queue: true,
        handler (ctx) {
          return ctx.params
        }
      }
    })

    const job = await service.queue('process').add('foo', {
      params: 'bar'
    })

    const qe = service.queueEvents('process')
    expect(job.waitUntilFinished(qe)).resolves.toBe('bar')

  })

  afterAll(async () => {
    await broker.stop()
  })

})

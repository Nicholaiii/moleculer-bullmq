import { ActionSchema, Cacher, Cachers, RedisCacherOptions, Service, ServiceSchema, ServiceSettingSchema } from 'moleculer'
import type Redis from 'ioredis'

import { Errors } from 'moleculer'
import { ConnectionOptions, Queue, QueueEvents, Worker } from 'bullmq'
import { mapOver } from './function'

export type BullMQMixinSettings = {
  redis?: ConnectionOptions
}
export type BullMQMixinSettingsSchema = {
  bullmq?: BullMQMixinSettings
}
export type BullMQMethods = {
  queue: (name: string) => Queue<any, any, string>
  queueEvents: (name: string) => QueueEvents
}

export type BullMQMixin = Partial<
  ServiceSchema<ServiceSettingSchema & BullMQMixinSettingsSchema>
>

export type BullMQMixinPrivates = {
  connection?: ConnectionOptions
  worker?: Worker
  queues: Map<string, Queue>
  queueEvents: Map<string, QueueEvents>
}

export type ServiceWithBullMQMixin =
  Service<ServiceSettingSchema & BullMQMixin>
  & BullMQMethods
  & { $bullmq: BullMQMixinPrivates }

export const createBullMQMixin = (): BullMQMixin => {

  const queues = new Map<string, Queue>()
  const queueEvents = new Map<string, QueueEvents>()
  let worker: Worker
  let connection: ConnectionOptions

  const getOrCreate = <T>(ctor: new (name: string, opts: { connection: typeof connection }) => T) => (map: Map<string, T>) =>
  (name: string) => map.get(name) ?? map.set(name, new ctor(name, { connection })).get(name)!

  const methods: BullMQMethods = {
    queue: getOrCreate(Queue)(queues),
    queueEvents: getOrCreate(QueueEvents)(queueEvents)
  }

  return {
    settings: {
      $secureSettings: ['bullmq'],
      bullmq: {}
    },
    methods,
    created () {
      const queue = this.schema.name

      /* This is ugly but we try to fail fast */
      connection = this.settings.bullmq?.redis
        ?? (this.broker.cacher as Cachers.Redis).client.options

      if (!connection) throw new Errors.ServiceSchemaError('Missing Redis client', {
        'bullmq.redis': this.settings.bullmq?.redis,
        'broker.cacher': this.broker.cacher
      })
      const queueActions = Object
      .entries(this.schema.actions ?? {})
      .filter(([,v]) => typeof v === 'object' && v.queue)
      .map(([k]) => k )

      worker = new Worker(queue, async ({ id, name, data }) => {
        if (!queueActions.includes(name)) throw new Error(`No queue-able ${name} action registered on ${queue}`)
        const { params, meta } = data

        return this.broker.call(`${queue}.${name}`, params, {
          meta: {...(meta ?? {}),  job: { id, queue }}
        })

      }, { connection })

      this.$bullmq = {
        connection,
        worker,
        queues,
        queueEvents
      } satisfies BullMQMixinPrivates

    },
    async stopped () {
      /* Let's be polite */
      mapOver(queueEvents)(
        ([,qe]) => qe.removeAllListeners()
      )

      await Promise.all([
        worker?.close(),
        ...mapOver(queues)(
          ([,q]) => q.close()
        )
      ])
    }

  }
}


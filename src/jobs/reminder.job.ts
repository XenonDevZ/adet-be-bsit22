import cron from 'node-cron'
import { sendUpcomingReminders } from '../services/notification.service.js'

export const startReminderJob = (): void => {
  // Runs every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await sendUpcomingReminders()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      console.error('[ReminderJob] Error:', message)
    }
  })

  console.log('✅  Reminder job scheduled (every 5 minutes)')
}

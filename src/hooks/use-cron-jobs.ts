import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  createCronJob,
  deleteCronJob,
  listCronJobs,
  listCronRuns,
  triggerCronJob,
  updateCronJob,
  type CronJob,
  type CronJobInput,
  type CronJobRun,
  type CronJobUpdate,
} from "@/lib/api"

export function useCronJobs(active: boolean) {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [runs, setRuns] = useState<CronJobRun[]>([])
  const [loading, setLoading] = useState(false)
  // Jobs with a manual run in flight (trigger button shows a spinner).
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())
  const activeRef = useRef(active)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [jobs, runs] = await Promise.all([listCronJobs(), listCronRuns()])
      setJobs(jobs)
      setRuns(runs)
    } catch (error) {
      toast.error("Failed to load recurring jobs", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    activeRef.current = active
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: fetch when the dialog opens
    if (active) void load()
  }, [active, load])

  // Errors propagate so the form can stay open on failure; the caller toasts.
  const create = useCallback(async (input: CronJobInput) => {
    const job = await createCronJob(input)
    setJobs((prev) => [job, ...prev])
    return job
  }, [])

  // Same contract as create: throws so the edit form can stay open on failure.
  const update = useCallback(async (id: string, input: CronJobUpdate) => {
    const job = await updateCronJob(id, input)
    setJobs((prev) => prev.map((j) => (j.id === id ? job : j)))
    return job
  }, [])

  // Manual run: 202 means "started" — the run only shows up in the history
  // once it finishes, so poll the runs list until a fresh run for this job
  // appears (or give up after ~5 minutes; the next dialog open will show it).
  const trigger = useCallback(async (job: CronJob) => {
    const since = Date.now()
    setRunningIds((prev) => new Set(prev).add(job.id))
    const done = () =>
      setRunningIds((prev) => {
        const next = new Set(prev)
        next.delete(job.id)
        return next
      })
    try {
      await triggerCronJob(job.id)
    } catch (error) {
      done()
      toast.error("Failed to start run", {
        description: error instanceof Error ? error.message : undefined,
      })
      return
    }
    toast.success("Run started")
    for (let i = 0; i < 100; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      if (!activeRef.current) break // dialog closed — stop polling quietly
      const latest = await listCronRuns().catch(() => null)
      if (!latest) continue
      // 60s of slack absorbs client/server clock skew. A completed "once" job
      // deletes itself, leaving jobId null on its run — match by prompt then.
      const run = latest.find(
        (r) =>
          (r.jobId === job.id || (r.jobId === null && r.prompt === job.prompt)) &&
          new Date(r.startedAt).getTime() >= since - 60_000
      )
      setRuns(latest)
      if (run) {
        if (run.status === "success") toast.success("Run finished")
        else toast.error("Run failed", { description: run.error ?? undefined })
        // "once" jobs vanish after succeeding; reflect that in the list.
        if (job.recurrence === "once" && run.status === "success") {
          setJobs((prev) => prev.filter((j) => j.id !== job.id))
        }
        break
      }
    }
    done()
  }, [])

  const remove = useCallback(async (id: string) => {
    try {
      await deleteCronJob(id)
      setJobs((prev) => prev.filter((j) => j.id !== id))
      // Runs cascade away with the job on the backend.
      setRuns((prev) => prev.filter((r) => r.jobId !== id))
    } catch (error) {
      toast.error("Failed to delete job", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }, [])

  return { jobs, runs, loading, runningIds, create, update, remove, trigger }
}

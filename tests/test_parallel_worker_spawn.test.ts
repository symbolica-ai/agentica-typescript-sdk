import { spawn } from '@agentica/agent';
import { describe, expect, it } from 'vitest';

describe('Parallel Worker Spawn with Task Queue', () => {
    // TODO: this passes occasionally, but fails because of global mock inference.
    // we skip for now until we fix how mock inference is done for the TypeScript tests.
    it('should spawn workers in parallel using asyncio.gather and retrieve tasks from queue', async () => {
        const leadAgent = await spawn({
            premise:
                'You are a lead researcher. Create 2 research tasks, enqueue them, then spawn 2 workers in parallel using asyncio.gather(). Each worker should retrieve and complete a task.',
        });

        function enqueueTask(_description: string): number {
            return Math.floor(Math.random() * 1000);
        }

        async function spawnWorker(): Promise<string> {
            const workerAgent = await spawn({
                premise:
                    'You are a research worker. Retrieve a task using getResearchTask(), check its type, and complete it.',
            });
            const result = await workerAgent.call<string>('Retrieve and complete a research task', {
                getResearchTask,
            });
            await workerAgent.close();
            return result;
        }

        async function getResearchTask(): Promise<{ id: number; description: string } | null> {
            return { id: 1, description: 'Research task description' };
        }

        const result = await leadAgent.call<string[]>(
            'Create 2 research tasks, enqueue them using enqueueTask(), then spawn 2 workers in parallel using asyncio.gather() and return their results.',
            { enqueueTask, spawnWorker, getResearchTask }
        );

        await leadAgent.close();

        console.log('Result:', result);

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
    }, 10000);
});

/**mock
Let me create 2 research tasks and spawn workers to complete them.

```python
# Define 2 distinct subtasks
subtasks = [
    "Research the etymology and linguistic origins of the term",
    "Investigate the historical usage patterns across cultures"
]

print(f"Created {len(subtasks)} subtasks")
for i, task in enumerate(subtasks, 1):
    print(f"{i}. {task}")
```
*/

/**mock
Now I'll enqueue both tasks.

```python
# Enqueue all 2 tasks
task_ids = []
for task_desc in subtasks:
    task_id = enqueueTask(task_desc)
    task_ids.append(task_id)
    print(f"Enqueued task {task_id}")

print(f"\nAll {len(task_ids)} tasks enqueued: {task_ids}")
```
*/

/**mock
Now I'll spawn 2 workers and run them in parallel using asyncio.gather().

```python
print("Spawning and running 2 workers in parallel...")

# Each spawnWorker() spawns an agent, calls it, and returns a string result
worker_coroutines = [spawnWorker() for _ in range(2)]

print(f"Created {len(worker_coroutines)} worker coroutines")
print("Gathering results with asyncio.gather()...")

# Gather executes all workers in parallel and collects their string results
results = await asyncio.gather(*worker_coroutines)

print(f"Received {len(results)} string results from workers")
for i, res in enumerate(results, 1):
    print(f"  Worker {i}: {res[:50]}...")
return results
```
*/

/**mock
I'll retrieve a task and check its type.

```python
task = await getResearchTask()
print(f"Task retrieved: {task}")
print(f"Task type: {type(task)}")

if task is not None:
    show_definition(task)

return "Worker 1 completed task"```
*/

/**mock
I'll retrieve a task and check its type.

```python
task = await getResearchTask()
print(f"Task retrieved: {task}")
print(f"Task type: {type(task)}")

if task is not None:
    show_definition(task)

return "Worker 2 completed task"
```
*/

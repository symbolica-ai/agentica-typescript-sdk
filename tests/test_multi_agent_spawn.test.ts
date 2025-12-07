import { spawn } from '@agentica/agent';
import { describe, expect, it } from 'vitest';

describe('Multi-Agent Parallel Spawn', () => {
    it('should spawn multiple sub-agents in parallel using asyncio.gather and return all results', async () => {
        async function runSubAgent(task: string): Promise<string> {
            const subAgent = await spawn({
                premise: 'You are a research assistant. Complete the given task and return a brief report.',
            });
            const result = await subAgent.call<string>('Complete this research task.', { task });
            await subAgent.close();
            return result;
        }

        const leadAgent = await spawn({
            premise:
                'You are a lead researcher. Create a research plan, then spawn 5 sub-agents in parallel using asyncio.gather() to execute different tasks.',
        });

        const result = await leadAgent.call<string[]>(
            'Create a research plan, then spawn 5 sub-agents in parallel using asyncio.gather() to execute different tasks. Return the list of results from all sub-agents.',
            { runSubAgent }
        );

        await leadAgent.close();

        console.log('Result:', result);

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(5);
        result.forEach((item) => {
            expect(typeof item).toBe('string');
            expect(item.length).toBeGreaterThan(0);
        });
    }, 5000);
});

/**mock
Let me create a research plan and spawn 5 sub-agents in parallel.

```python
async def research_parallel():
    # Define the research plan
    research_plan = """
1. Research Hebrew origins
2. Investigate cultural usage
3. Explore historical timeline
4. Research name variations
5. Examine contemporary usage
"""

    print("Research plan created.")
    print(f"Plan: {research_plan}")

    # Define the 5 subtasks
    tasks = [
        "Research the Hebrew origins of the name",
        "Investigate where the name is commonly used across different cultures",
        "Explore the historical timeline of the name",
        "Research variations of the name",
        "Examine the contemporary usage of the name"
    ]

    print(f"\nDispatching {len(tasks)} subagents in parallel using asyncio.gather()...")

    # Run all subagents in parallel using asyncio.gather()
    results = await asyncio.gather(
        runSubAgent(tasks[0]),
        runSubAgent(tasks[1]),
        runSubAgent(tasks[2]),
        runSubAgent(tasks[3]),
        runSubAgent(tasks[4])
    )

    print(f"\nAll {len(results)} subagents completed.")
    print(f"Received {len(results)} results.")
    return results

# Execute the async function
gathered_results = await research_parallel()
print(f"\nReturned {len(gathered_results)} results total.")
```
*/

/**mock
I'll complete the research task on Hebrew origins. Let me do my work.

```python
import time

print(f"[SubAgent 1] Starting task: {task[:50]}...")
time.sleep(0.1)
print("[SubAgent 1] Research complete.")

return "Report on Hebrew origins: The name derives from Hebrew meaning 'dew'."
```
*/

/**mock
I'll complete the research task on cultural usage. Let me do my work.

```python
import time

print(f"[SubAgent 2] Starting task: {task[:50]}...")
time.sleep(0.1)
print("[SubAgent 2] Research complete.")

return "Report on cultural usage: Used in Hebrew, Finnish, and Native American cultures."
```
*/

/**mock
I'll complete the research task on historical timeline. Let me do my work.

```python
import time

print(f"[SubAgent 3] Starting task: {task[:50]}...")
time.sleep(0.1)
print("[SubAgent 3] Research complete.")

return "Report on historical timeline: Ancient Hebrew name, modern revival in 20th century."
```
*/

/**mock
I'll complete the research task on name variations. Let me do my work.

```python
import time

print(f"[SubAgent 4] Starting task: {task[:50]}...")
time.sleep(0.1)
print("[SubAgent 4] Research complete.")

return "Report on variations: Includes Tal, Talia, Talya, Tahlia."
```
*/

/**mock
I'll complete the research task on contemporary usage. Let me do my work.

```python
import time

print(f"[SubAgent 5] Starting task: {task[:50]}...")
time.sleep(0.1)
print("[SubAgent 5] Research complete.")

return "Report on contemporary usage: Popular in Israel, used in various media."
```
*/

/**mock
Now let me assign the results to return them.

```python
# Verify we have all results
print(f"Results collected: {len(gathered_results)}")
for i, res in enumerate(gathered_results):
    print(f"  Result {i+1}: {res[:50]}...")

return gathered_results
```
*/

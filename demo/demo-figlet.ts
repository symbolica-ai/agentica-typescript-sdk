import { agentic } from '@agentica/agentic';
import figlet from 'figlet';

import { setDefaultLogLevel } from '@/logging';

setDefaultLogLevel('info');

async function greet(name: string): Promise<string> {
    return await agentic<string>(
        'Use the provided function to create a fancy greeting for name (you may use top-level `await` in your REPL)',
        {
            figletText: figlet.text,
            name,
        }
    );
}

(async () => {
    const result = await greet('agentica');
    console.log(result);
    console.log('done');
})();

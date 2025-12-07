//!// Run client before server
// This is just hanging around bc of transformer purposes
import { agentic } from '@agentica/agentic';

import { OtherCompany, utilFormat } from './separate-module-import';

console.log('=== File ipc-client-process touched ===');

/*
 * User definitions ...
 */

export class HappyPerson {
    constructor(
        public name: string,
        public age: number
    ) {}

    greet(): string {
        return `Hello, I'm ${this.name} and I'm ${this.age} years old.`;
    }

    haveBirthday(): void {
        this.age++;
    }

    toString(): string {
        return `Person(${this.name}, ${this.age})`;
    }

    setBestFriend(_friend: HappyPerson | null): void {}
}

const defaultCompany: OtherCompany = new OtherCompany();

/*
 * Magic function and call
 */

const config = { prompt: 'This is a prompt' };
async function add_employee(person: HappyPerson): Promise<number | string> {
    if (person.name === 'Alice') {
        return await agentic<number>(config.prompt, { defaultCompany, utilFormat, person });
    } else if (person.name === 'Bob') {
        return await agentic(config.prompt, { defaultCompany, utilFormat, person });
    } else {
        return await agentic<string>(config.prompt, { defaultCompany, utilFormat, person });
    }
}

async function main() {
    await add_employee(new HappyPerson('Alice', 25));
    console.log('[DEMO] Added Alice');
    await add_employee(new HappyPerson('Bob', 25));
    console.log('[DEMO] Added Bob');
    await add_employee(new HappyPerson('Charlie', 25));
    console.log('[DEMO] Added Charlie');
}

void main();

import { OtherCompany as OtherCompanyAlias } from './separate-module-import';

console.log('=== File syn-single-process touched ===');
export class OriginalPerson {
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

    setBestFriend(_friend: OriginalPerson | null): void {}
}

export class Company {
    employees: OriginalPerson[] = [];
    contractors: OriginalPerson[] = [];
    partner_company: OtherCompanyAlias = new OtherCompanyAlias();
    static seed: OtherCompanyAlias = new OtherCompanyAlias();

    constructor(public name: string) {}

    addEmployee(person: OriginalPerson): void {
        this.employees.push(person);
    }

    addAll(people: OriginalPerson[]): void {
        this.employees.push(...people);
    }

    getEmployeeCount(): number {
        return this.employees.length;
    }

    toString(): string {
        return `Company(${this.name}, ${this.employees.length} employees)`;
    }
}

import type { OriginalPerson } from './yet-other-module-import';

class OtherPerson {
    name: string;
    age: number;
    companion: OriginalPerson;

    constructor(name: string, age: number, companion: OriginalPerson) {
        this.name = name;
        this.age = age;
        this.companion = companion;
    }

    greet(): string {
        return `Hello, I'm ${this.name} and I'm ${this.age} years old.`;
    }

    // Prototype method to test function object binding
    rename(newName: string): void {
        this.name = newName;
    }
}

class OtherCompany {
    employees: OtherPerson[] = [];
    // Static method to test static function object binding
    static describe(): string {
        return 'OtherCompany';
    }

    addEmployee(person: OtherPerson): void {
        this.employees.push(person);
    }

    getEmployeeCount(): number {
        return this.employees.length;
    }
}

export { OtherCompany, OtherPerson };

function utilFormat(p: OtherPerson): string {
    return `${p.name}:${p.age}`;
}

const defaultCompany: OtherCompany = new OtherCompany();

export { defaultCompany, utilFormat };

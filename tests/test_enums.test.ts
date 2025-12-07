import { agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

enum NumericEnum {
    First,
    Second,
    Third,
}

describe('Numeric Enum Tests', () => {
    /**mock
    Getting numeric enum value.

    ```python
    return NumericEnum.Second
    ```
    */
    it('should access numeric enum value', async () => {
        const result = await agenticPro<NumericEnum>`Return the numeric value of ${NumericEnum}.Second.`();
        expect(result).toBe(1);
    });
});

enum ExplicitNumericEnum {
    Low = 1,
    Medium = 5,
    High = 10,
}

describe('Explicit Numeric Enum Tests', () => {
    /**mock
    Getting explicit numeric enum.

    ```python
    return ExplicitNumericEnum.High
    ```
    */
    it('should access explicit numeric enum value', async () => {
        const result = await agenticPro<ExplicitNumericEnum>`Return the value of ${ExplicitNumericEnum}.High.`();
        expect(result).toBe(ExplicitNumericEnum.High);
    });
});

enum StringEnum {
    Red = 'RED',
    Green = 'GREEN',
    Blue = 'BLUE',
}

describe('String Enum Tests', () => {
    /**mock
    Getting string enum value.

    ```python
    return StringEnum.Green
    ```
    */
    it('should access string enum value', async () => {
        const result = await agenticPro<StringEnum>`Return the value of ${StringEnum}.Green.`();
        expect(result).toBe(StringEnum.Green);
    });
});

enum MixedEnum {
    Deleted = 0,
    Active = 'ACTIVE',
    Pending = 'PENDING',
}

describe('Mixed Enum Tests', () => {
    /**mock
    Mixed enum numeric value.

    ```python
    return MixedEnum.Deleted
    ```
    */
    it('should handle mixed enum numeric value', async () => {
        const result = await agenticPro<MixedEnum>`Return the value of ${MixedEnum}.Deleted.`();
        expect(result).toBe(MixedEnum.Deleted);
    });

    /**mock
    Mixed enum string value.

    ```python
    return MixedEnum.Active
    ```
    */
    it('should handle mixed enum string value', async () => {
        const result = await agenticPro<MixedEnum>`Return the value of ${MixedEnum}.Active.`();
        expect(result).toBe(MixedEnum.Active);
    });
});

class EnumUser {
    status: NumericEnum = NumericEnum.First;
    color: StringEnum = StringEnum.Red;

    setStatus(status: NumericEnum): void {
        this.status = status;
    }

    getStatus(): NumericEnum {
        return this.status;
    }

    setColor(color: StringEnum): void {
        this.color = color;
    }

    getColor(): StringEnum {
        return this.color;
    }
}

describe('Enum in Class Tests', () => {
    /**mock
    Getting enum property from class.

    ```python
    return obj.status
    ```
    */
    it('should access enum property from class', async () => {
        const obj = new EnumUser();
        const result = await agenticPro<NumericEnum>`Return the status property of ${obj}.`();
        expect(result).toBe(NumericEnum.First);
    });

    /**mock
    Setting enum property.

    ```python
    obj.setStatus(NumericEnum.Third)
    return None
    ```
    */
    it('should set enum property', async () => {
        const obj = new EnumUser();
        await agenticPro<void>`Call setStatus on ${obj} with ${NumericEnum}.Third.`();
        expect(obj.getStatus()).toBe(NumericEnum.Third);
    });

    /**mock
    Comparing enum values.

    ```python
    return obj.status == NumericEnum.Second
    ```
    */
    it('should compare enum values', async () => {
        const obj = new EnumUser();
        obj.status = NumericEnum.Second;
        const result = await agenticPro<boolean>`Check if status of ${obj} equals ${NumericEnum}.Second.`();
        expect(result).toBe(true);
    });
});

function processNumericEnum(value: NumericEnum): string {
    switch (value) {
        case NumericEnum.First:
            return 'first-value';
        case NumericEnum.Second:
            return 'second-value';
        case NumericEnum.Third:
            return 'third-value';
        default:
            return 'unknown';
    }
}

describe('Enum Functions Tests', () => {
    /**mock
    Passing enum to function.

    ```python
    return processNumericEnum(NumericEnum.Second)
    ```
    */
    it('should pass numeric enum to function', async () => {
        const result = await agenticPro<string>`Call ${processNumericEnum} with ${NumericEnum}.Second.`();
        expect(result).toBe('second-value');
    });
});

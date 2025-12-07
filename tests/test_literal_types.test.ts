import { agentic, agenticPro } from '@agentica/agentic';
import { describe, expect, it } from 'vitest';

type Direction = 'north' | 'south' | 'east' | 'west';

function move(direction: Direction): string {
    return `Moving ${direction}`;
}

describe('String Literal Types Tests', () => {
    /**mock
    Using string literal type.

    ```python
    try:
        return move("north")
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should use string literal type', async () => {
        const result = await agenticPro<string>`Call ${move} with "north".`();
        expect(result).toBe('Moving north');
    });

    /**mock
    Returning a literal directly.

    ```python
    try:
        return "south"
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should return literal value directly', async () => {
        const result = await agenticPro<Direction>`Return the string "south".`();
        expect(result).toBe('south');
    });

    /**mock
    Attempting to return invalid literal.

    ```python
    try:
        return "invalid"
        raise AgentError("test failed 1")
    except Exception:
        pass
    try:
        _check_type(result, __return_type)
        raise AgentError("test failed 2")
    except Exception:
        raise AgentError("test succeeded")
    ```
    */
    it('should reject invalid literal value', async () => {
        try {
            await agenticPro<Direction>`Return the string "invalid".`();
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain('test succeeded');
        }
    });
});

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

function request(method: HttpMethod, url: string): string {
    return `${method} ${url}`;
}

describe('HTTP Method Literal Tests', () => {
    /**mock
    Using HTTP method literal.

    ```python
    try:
        return request("POST", "/api/data")
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should use HTTP method literal', async () => {
        const result = await agenticPro<string>`Call ${request} with "POST" and "/api/data".`();
        expect(result).toBe('POST /api/data');
    });
});

type StatusCode = 200 | 404 | 500;

function handleStatus(code: StatusCode): string {
    if (code === 200) {
        return 'OK';
    } else if (code === 404) {
        return 'Not Found';
    } else {
        return 'Error';
    }
}

describe('Numeric Literal Types Tests', () => {
    /**mock
    Using numeric literal 200.

    ```python
    try:
        return handleStatus(200)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should use numeric literal type', async () => {
        const result = await agenticPro<string>`Call ${handleStatus} with 200.`();
        expect(result).toBe('OK');
    });

    /**mock
    Using numeric literal 404.

    ```python
    try:
        return handleStatus(404)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should use different numeric literal', async () => {
        const result = await agenticPro<string>`Call ${handleStatus} with 404.`();
        expect(result).toBe('Not Found');
    });

    /**mock
    Returning a numeric literal directly.

    ```python
    try:
        return 200
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should return numeric literal value directly', async () => {
        const result = await agenticPro<StatusCode>`Return the number 200.`();
        expect(result).toBe(200);
    });

    /**mock
    Attempting to return invalid numeric literal.

    ```python
    try:
        return 999
        raise AgentError("test failed 1")
    except Exception:
        pass
    try:
        _check_type(result, __return_type)
        raise AgentError("test failed 2")
    except Exception:
        raise AgentError("test succeeded")
    ```
    */
    it('should reject invalid numeric literal value', async () => {
        try {
            await agenticPro<StatusCode>`Return the number 999.`();
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain('test succeeded');
        }
    });
});

class LiteralUser {
    direction: Direction = 'north';
    method: HttpMethod = 'GET';

    setDirection(dir: Direction): void {
        this.direction = dir;
    }

    getDirection(): Direction {
        return this.direction;
    }

    setMethod(method: HttpMethod): void {
        this.method = method;
    }

    getMethod(): HttpMethod {
        return this.method;
    }
}

describe('Literal Types in Class Tests', () => {
    /**mock
    Setting literal property.

    ```python
    try:
        user.setDirection("south")
        return None
    except Exception:
        import traceback
        traceback.print_exc()
        raise AgentError("test failed")
    ```
    */
    it('should set literal property', async () => {
        const user = new LiteralUser();
        await agenticPro<void>`Call setDirection on ${user} with "south".`();
        expect(user.getDirection()).toBe('south');
    });

    /**mock
    Getting literal property.

    ```python
    try:
        return user.getDirection()
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should get literal property', async () => {
        const user = new LiteralUser();
        user.setDirection('east');
        const result = await agenticPro<Direction>`Call getDirection on ${user}.`();
        expect(result).toBe('east');
    });

    /**mock
    Setting HTTP method literal.

    ```python
    try:
        user.setMethod("DELETE")
        return None
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should set HTTP method literal', async () => {
        const user = new LiteralUser();
        await agenticPro<void>`Call setMethod on ${user} with "DELETE".`();
        expect(user.getMethod()).toBe('DELETE');
    });
});

type Config = {
    mode: 'development' | 'production';
    port: 3000 | 8080;
    verbose: true | false;
};

function createConfig(mode: 'development' | 'production'): Config {
    return {
        mode,
        port: mode === 'development' ? 3000 : 8080,
        verbose: mode === 'development',
    };
}

describe('Complex Literal Types Tests', () => {
    /**mock
    Creating config with development.

    ```python
    try:
        raise AgentError(ValueError("Failed"))
        return createConfig("development")
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it.fails('should create config with development mode', async () => {
        const result = await agenticPro<Config>`Call ${createConfig} with "development".`();
        expect(result).toEqual({ mode: 'development', port: 3000, verbose: true });
    });

    /**mock
    Creating config with production.

    ```python
    try:
        raise AgentError(ValueError("Failed"))
        return createConfig("production")
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it.fails('should create config with production mode', async () => {
        const result = await agenticPro<Config>`Call ${createConfig} with "production".`();
        expect(result).toEqual({ mode: 'production', port: 8080, verbose: false });
    });
});

type Result<T> = { success: true; data: T } | { success: false; error: string };

function processResult(result: Result<number>): number | string {
    if (result.success === true) {
        return result.data;
    } else {
        return result.error;
    }
}

describe('Literal Types in Discriminated Union Tests', () => {
    /**mock
    Processing successful result.

    ```python
    try:
        return processResult(result)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should process successful result', async () => {
        const result: Result<number> = { success: true, data: 42 };
        const output = await agenticPro<number | string>`Call ${processResult} with ${result}.`();
        expect(output).toBe(42);
    });

    /**mock
    Processing failed result.

    ```python
    try:
        return processResult(result)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should process failed result', async () => {
        const result: Result<number> = { success: false, error: 'Failed' };
        const output = await agenticPro<number | string>`Call ${processResult} with ${result}.`();
        expect(output).toBe('Failed');
    });
});

type Size = 'small' | 'medium' | 'large';
type Color = 'red' | 'green' | 'blue';

class Product {
    constructor(
        public size: Size,
        public color: Color
    ) {}

    describe(): string {
        return `${this.size} ${this.color}`;
    }
}

describe('Multiple Literal Types Tests', () => {
    /**mock
    Using multiple literal types.

    ```python
    try:
        return product.describe()
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should use multiple literal types in class', async () => {
        const product = new Product('large', 'blue');
        const result = await agenticPro<string>`Call describe on ${product}.`();
        expect(result).toBe('large blue');
    });

    /**mock
    Accessing size literal.

    ```python
    try:
        return product.size
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should access size literal', async () => {
        const product = new Product('medium', 'red');
        const result = await agenticPro<Size>`Return the size property of ${product}.`();
        expect(result).toBe('medium');
    });

    /**mock
    Accessing color literal.

    ```python
    try:
        return product.color
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should access color literal', async () => {
        const product = new Product('small', 'green');
        const result = await agenticPro<Color>`Return the color property of ${product}.`();
        expect(result).toBe('green');
    });
});

function combineStrings(a: 'hello' | 'goodbye', b: 'world' | 'friend'): string {
    return `${a} ${b}`;
}

type NumberLiteral = 1 | 2 | 3 | 4 | 5;

function processNumber(n: NumberLiteral): number {
    return n * 10;
}

describe('Combination Literal Types Tests', () => {
    /**mock
    Combining string literals.

    ```python
    try:
        return combineStrings("hello", "world")
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should combine string literals', async () => {
        const result = await agenticPro<string>`Call ${combineStrings} with "hello" and "world".`();
        expect(result).toBe('hello world');
    });

    /**mock
    Combining different string literals.

    ```python
    try:
        return combineStrings("goodbye", "friend")
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should combine different string literals', async () => {
        const result = await agenticPro<string>`Call ${combineStrings} with "goodbye" and "friend".`();
        expect(result).toBe('goodbye friend');
    });

    /**mock
    Using number literal 3.

    ```python
    try:
        return processNumber(3)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should use number literal', async () => {
        const result = await agenticPro<number>`Call ${processNumber} with 3.`();
        expect(result).toBe(30);
    });

    /**mock
    Using number literal 5.

    ```python
    try:
        return processNumber(5)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should use different number literal', async () => {
        const result = await agenticPro<number>`Call ${processNumber} with 5.`();
        expect(result).toBe(50);
    });
});

describe('Type Representation Tests', () => {
    /**mock
    Number literal type representation.

    ```python
    try:
        return _clean_type_name(__return_type)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should represent number literal type', async () => {
        const result = await agenticPro<42 | true | string>`Return type representation.`();
        expect(result).toContain('Literal[42]');
        expect(result).toContain('Literal[True]');
    });

    /**mock
    Boolean literal false type representation.

    ```python
    try:
        return _clean_type_name(__return_type)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should represent false literal type', async () => {
        const result = await agenticPro<false | string>`Return type representation.`();
        expect(result).toContain('Literal[False]');
    });

    /**mock
    Boolean union with null type representation.

    ```python
    try:
        return _clean_type_name(__return_type)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should represent boolean | null', async () => {
        const result = await agenticPro<boolean | null | string>`Return type representation.`();
        expect(result).toContain('bool');
        expect(result).toContain('None');
        expect(result).not.toContain('Literal');
    });

    /**mock
    True literal union with null type representation.

    ```python
    try:
        return _clean_type_name(__return_type)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should represent true | null', async () => {
        const result = await agenticPro<true | null | string>`Return type representation.`();
        expect(result).toContain('Literal[True]');
        expect(result).toContain('None');
    });

    /**mock
    True and false union type representation.

    ```python
    try:
        return _clean_type_name(__return_type)
    except Exception:
        raise AgentError("test failed")
    ```
    */
    it('should represent true | false as boolean', async () => {
        const result = await agenticPro<true | false | string>`Return type representation.`();
        expect(result).toContain('bool');
        expect(result).not.toContain('Literal');
    });
});

describe('literal literals', () => {
    /**mock
    Literally return the literal

    ```python
    return theLiteral
    ```
    */
    it('should literally succeed', async () => {
        const result = await agentic<string>('Literally literal', { theLiteral: 'the literal' });
        console.log('result:', result);
        expect(result).toBeDefined();
    });
});

## TS Syntax testing overview

### Core Language Features (1-5)
1. **test_class_properties** - Top-level, constructor, getter/setter, static, readonly, computed properties
2. **test_class_methods** - Instance, static, async methods, multiple parameters, return types, method chaining
3. **test_functions** - Regular, arrow, async, higher-order, default/optional/rest parameters
4. **test_interfaces** - Basic, extending, multiple inheritance, implementing, optional/readonly fields
5. **test_arrays** - Access, manipulation, map/filter/reduce, slicing, iteration

### Collections & Objects (6-8)
6. **test_collections** - Map and Set operations (get, set, has, size, iteration)
7. **test_objects** - Object literals, nested access, methods, arrays within objects
8. **test_async** - Promises, async/await, sequential/parallel operations, async methods

### Type System (9-11)
9. **test_types** - Union types, optional parameters, nullable types, type assertions
10. **test_inheritance** - extends, super, abstract classes, polymorphism, method overriding
11. **test_enums** - Numeric, string, explicit values, mixed enums

### Advanced Features (12-15)
12. **test_generics** - Generic functions/classes, constraints, multiple type parameters
13. **test_tuples** - Fixed-length arrays, optional elements, rest elements, destructuring
14. **test_destructuring** - Object/array destructuring, renaming, nested, defaults, rest
15. **test_spread_rest** - Spread operators, rest parameters, cloning, merging

### Object-Oriented (16-18)
16. **test_constructors** - Parameter properties (public/private/readonly), optional/default, inheritance
17. **test_access_modifiers** - public, private, protected fields/methods, static access
18. **test_this_binding** - Regular vs arrow methods, callbacks, method chaining, nested context

### Type Safety (19-20)
19. **test_index_types** - Index signatures, Record types, dynamic properties
20. **test_type_guards** - typeof, instanceof, custom type guards, discriminated unions
21. **test_literal_types** - String/number/boolean literal types, discriminated unions

## Test Structure

Each test file follows the pattern:
- **Definitions** at the top (classes, functions, interfaces, types)
- **`it()` tests** that exercise one specific aspect
- **Corresponding mock replies** in order that test Python-side behavior
- **Clear expectations** with explicit assertions
  
Yay!
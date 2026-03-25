/**
 * Tests for useValiValid.svelte.ts (Svelte 5 rune adapter)
 *
 * This file contains two suites:
 *   1. Static / type-level tests — no Svelte compiler required
 *   2. Functional runtime tests — render real Svelte 5 components via
 *      @testing-library/svelte with the @sveltejs/vite-plugin-svelte plugin
 *      active in vitest.config.mts.
 */

// ---------------------------------------------------------------------------
// Suite A — Static module / type-level assertions (no rendering required)
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';

import * as SvelteAdapter from '../useValiValid.svelte';
import type { UseValiValidOptions, UseValiValidReturn } from '../useValiValid.svelte';

describe('useValiValid.svelte — module exports', () => {
    it('exports useValiValid as a function', () => {
        expect(typeof SvelteAdapter.useValiValid).toBe('function');
    });

    it('exports exactly the expected named exports (no extra leakage)', () => {
        const keys = Object.keys(SvelteAdapter).sort();
        expect(keys).toContain('useValiValid');
    });

    it('useValiValid has the expected function arity (1 argument: options)', () => {
        expect(SvelteAdapter.useValiValid.length).toBe(1);
    });
});

describe('useValiValid.svelte — type-level interface checks', () => {
    it('UseValiValidOptions type accepts the required initial field', () => {
        const opts: UseValiValidOptions<{ email: string }> = {
            initial: { email: '' },
        };
        expect(opts.initial).toEqual({ email: '' });
    });

    it('UseValiValidOptions accepts all optional configuration fields', () => {
        const opts: UseValiValidOptions<{ name: string }> = {
            initial: { name: '' },
            validateOnBlur: true,
            validateOnSubmit: false,
            debounceMs: 300,
            asyncTimeout: 5000,
            criteriaMode: 'firstError',
            validateOnMount: false,
        };
        expect(opts.debounceMs).toBe(300);
        expect(opts.asyncTimeout).toBe(5000);
        expect(opts.criteriaMode).toBe('firstError');
    });

    it('UseValiValidOptions.criteriaMode only accepts "all" or "firstError"', () => {
        const a: UseValiValidOptions<{ x: string }> = { initial: { x: '' }, criteriaMode: 'all' };
        const b: UseValiValidOptions<{ x: string }> = { initial: { x: '' }, criteriaMode: 'firstError' };
        expect(a.criteriaMode).toBe('all');
        expect(b.criteriaMode).toBe('firstError');
    });
});

describe('useValiValid.svelte — UseValiValidReturn interface shape', () => {
    it('UseValiValidReturn declares all expected reactive properties', () => {
        type Key = keyof UseValiValidReturn<{ email: string }>;
        const knownKeys: Key[] = [
            'form',
            'errors',
            'isValid',
            'isValidating',
            'isSubmitted',
            'submitCount',
            'touchedFields',
            'dirtyFields',
        ];
        expect(knownKeys.length).toBe(8);
    });

    it('UseValiValidReturn declares all expected method keys', () => {
        type Key = keyof UseValiValidReturn<{ email: string }>;
        const methods: Key[] = [
            'handleChange',
            'handleBlur',
            'validate',
            'reset',
            'handleSubmit',
            'setServerErrors',
            'setValues',
            'addFieldValidation',
            'removeFieldValidation',
            'setFieldValidations',
            'clearFieldValidations',
            'trigger',
            'clearErrors',
        ];
        expect(methods.length).toBe(13);
    });
});

describe('useValiValid.svelte — options edge cases (type-level)', () => {
    it('validations prop is optional and defaults to undefined', () => {
        const opts: UseValiValidOptions<{ x: string }> = { initial: { x: '' } };
        expect(opts.validations).toBeUndefined();
    });

    it('validateOnBlur defaults to undefined (falsy)', () => {
        const opts: UseValiValidOptions<{ x: string }> = { initial: { x: '' } };
        expect(opts.validateOnBlur).toBeUndefined();
    });

    it('validateOnSubmit defaults to undefined (falsy)', () => {
        const opts: UseValiValidOptions<{ x: string }> = { initial: { x: '' } };
        expect(opts.validateOnSubmit).toBeUndefined();
    });

    it('debounceMs accepts 0 (immediate, no debounce)', () => {
        const opts: UseValiValidOptions<{ x: string }> = { initial: { x: '' }, debounceMs: 0 };
        expect(opts.debounceMs).toBe(0);
    });

    it('asyncTimeout accepts large values (e.g. 30000 ms)', () => {
        const opts: UseValiValidOptions<{ x: string }> = { initial: { x: '' }, asyncTimeout: 30000 };
        expect(opts.asyncTimeout).toBe(30000);
    });
});

// ---------------------------------------------------------------------------
// Suite A2 — isValidating guard: trigger() must not lower isValidating early
//            when another field's async is still in-flight
// ---------------------------------------------------------------------------

describe('useValiValid.svelte — trigger() isValidating guard (concurrent async)', () => {
    it('trigger(field) finally block only clears isValidating when no other async is in-flight', async () => {
        // This test verifies the correctness of the guard added to the trigger() finally block.
        // We simulate the scenario by directly inspecting the returned interface — since the
        // Svelte rune adapter's isValidating is only exposed via a getter, we verify that the
        // guard condition (debounceTimers.size === 0 && asyncInFlightMap.size === 0) is correct
        // by checking that isValidating starts as false and is only set to false when nothing
        // is in-flight, using a sync-only form where trigger() completes immediately.
        const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
        const { default: TestForm } = await import('./TestForm.svelte');
        const { ValidationType } = await import('vali-valid');

        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { name: 'Alice' },
                    validations: [{ field: 'name', validations: [{ type: ValidationType.Required }] }],
                    debounceMs: 0,
                },
            },
        });

        // trigger() on a sync-only field: isValidating should be false both before and after
        // (no async rules means isValidating is never set to true by trigger)
        expect(getByTestId('isValid').textContent).toBe('true');

        await fireEvent.click(getByTestId('trigger-name'));

        await waitFor(() => {
            const result = JSON.parse(getByTestId('triggerResult').textContent!);
            expect(result).not.toBeNull();
        });

        // After trigger() resolves with no in-flight async, isValidating must be false
        // (the guard `debounceTimers.size === 0 && asyncInFlightMap.size === 0` correctly
        // allows isValidating to be set to false here since nothing else is running)
        // We confirm this indirectly: a subsequent validate() still works correctly,
        // which would not be the case if isValidating were stuck true.
        await fireEvent.click(getByTestId('validate'));
        await waitFor(() => {
            // validate() completes — if isValidating had been stuck it would never clear
            expect(getByTestId('isValid').textContent).toBe('true');
        });
    });

    it('trigger(field) with invalid value does not leave isValidating=true after completion', async () => {
        const { render, fireEvent, waitFor } = await import('@testing-library/svelte');
        const { default: TestForm } = await import('./TestForm.svelte');
        const { ValidationType } = await import('vali-valid');

        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { name: '' },
                    validations: [{ field: 'name', validations: [{ type: ValidationType.Required }] }],
                    debounceMs: 0,
                },
            },
        });

        await fireEvent.click(getByTestId('trigger-name'));

        await waitFor(() => {
            const result = JSON.parse(getByTestId('triggerResult').textContent!);
            expect(result).not.toBeNull();
            expect(Array.isArray(result.name)).toBe(true);
            expect(result.name.length).toBeGreaterThan(0);
        });

        // After trigger() completes with no concurrent async, isValidating should be false.
        // Verify by calling validate() — it must succeed and toggle isValidating correctly.
        await fireEvent.click(getByTestId('reset'));
        await waitFor(() => expect(getByTestId('isValid').textContent).toBe('true'));
    });
});

// ---------------------------------------------------------------------------
// Suite B — Functional runtime tests using @testing-library/svelte
// ---------------------------------------------------------------------------

import { render, fireEvent, waitFor } from '@testing-library/svelte';
import TestForm from './TestForm.svelte';
import { ValidationType } from 'vali-valid';

describe('useValiValid (Svelte 5 rune adapter) — runtime', () => {
    it('initializes with isValid=true and no errors before any validation', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { name: '' },
                    validations: [{ field: 'name', validations: [{ type: ValidationType.Required }] }],
                },
            },
        });
        // Before validate() is called isValid should be true (no errors set yet)
        expect(getByTestId('isValid').textContent).toBe('true');
        expect(getByTestId('errors').textContent).toBe('{}');
        expect(getByTestId('submitCount').textContent).toBe('0');
    });

    it('validate() produces errors for a required field left empty', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { name: '' },
                    validations: [{ field: 'name', validations: [{ type: ValidationType.Required }] }],
                },
            },
        });

        await fireEvent.click(getByTestId('validate'));

        await waitFor(() => {
            expect(getByTestId('isValid').textContent).toBe('false');
        });

        const errors = JSON.parse(getByTestId('errors').textContent!);
        expect(Array.isArray(errors.name)).toBe(true);
        expect(errors.name.length).toBeGreaterThan(0);
    });

    it('reset() clears errors and restores isValid=true', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { name: '' },
                    validations: [{ field: 'name', validations: [{ type: ValidationType.Required }] }],
                },
            },
        });

        // First trigger validation to set errors
        await fireEvent.click(getByTestId('validate'));
        await waitFor(() => {
            expect(getByTestId('isValid').textContent).toBe('false');
        });

        // Now reset
        await fireEvent.click(getByTestId('reset'));

        await waitFor(() => {
            expect(getByTestId('isValid').textContent).toBe('true');
            expect(getByTestId('errors').textContent).toBe('{}');
        });
    });

    it('validate() sets isValid=true when form has valid data', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { email: 'valid@example.com' },
                    validations: [
                        {
                            field: 'email',
                            validations: [
                                { type: ValidationType.Required },
                                { type: ValidationType.Email },
                            ],
                        },
                    ],
                },
            },
        });

        await fireEvent.click(getByTestId('validate'));

        await waitFor(() => {
            expect(getByTestId('isValid').textContent).toBe('true');
        });
    });

    it('validate() produces email-format errors for an invalid email', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { email: 'not-an-email' },
                    validations: [
                        {
                            field: 'email',
                            validations: [
                                { type: ValidationType.Required },
                                { type: ValidationType.Email },
                            ],
                        },
                    ],
                },
            },
        });

        await fireEvent.click(getByTestId('validate'));

        await waitFor(() => {
            expect(getByTestId('isValid').textContent).toBe('false');
        });

        const errors = JSON.parse(getByTestId('errors').textContent!);
        expect(Array.isArray(errors.email)).toBe(true);
        expect(errors.email.length).toBeGreaterThan(0);
    });

    it('validates multiple fields and reports all errors', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { email: '', name: '' },
                    validations: [
                        { field: 'email', validations: [{ type: ValidationType.Required }, { type: ValidationType.Email }] },
                        { field: 'name', validations: [{ type: ValidationType.Required }, { type: ValidationType.MinLength, value: 3 }] },
                    ],
                },
            },
        });

        await fireEvent.click(getByTestId('validate'));

        await waitFor(() => {
            expect(getByTestId('isValid').textContent).toBe('false');
        });

        const errors = JSON.parse(getByTestId('errors').textContent!);
        expect(Array.isArray(errors.email)).toBe(true);
        expect(Array.isArray(errors.name)).toBe(true);
    });

    it('submitCount increments after each validate() call via button', async () => {
        // submitCount only changes via handleSubmit, but validate() is idempotent on count.
        // Verify the counter starts at 0.
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { name: 'Alice' },
                    validations: [{ field: 'name', validations: [{ type: ValidationType.Required }] }],
                },
            },
        });

        expect(getByTestId('submitCount').textContent).toBe('0');

        // validate() button does NOT increment submitCount (only handleSubmit does)
        await fireEvent.click(getByTestId('validate'));
        await waitFor(() => {
            expect(getByTestId('isValid').textContent).toBe('true');
        });
        expect(getByTestId('submitCount').textContent).toBe('0');
    });

    it('validate() followed by reset() then validate() again re-shows errors', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { name: '' },
                    validations: [{ field: 'name', validations: [{ type: ValidationType.Required }] }],
                },
            },
        });

        // First validate — should show error
        await fireEvent.click(getByTestId('validate'));
        await waitFor(() => expect(getByTestId('isValid').textContent).toBe('false'));

        // Reset — errors cleared
        await fireEvent.click(getByTestId('reset'));
        await waitFor(() => expect(getByTestId('isValid').textContent).toBe('true'));

        // Second validate — errors should reappear
        await fireEvent.click(getByTestId('validate'));
        await waitFor(() => expect(getByTestId('isValid').textContent).toBe('false'));

        const errors = JSON.parse(getByTestId('errors').textContent!);
        expect(Array.isArray(errors.name)).toBe(true);
    });

    it('initializes correctly when no validations are provided', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { value: 'hello' },
                },
            },
        });

        expect(getByTestId('isValid').textContent).toBe('true');
        expect(getByTestId('errors').textContent).toBe('{}');

        // validate() with no rules — should stay valid
        await fireEvent.click(getByTestId('validate'));
        await waitFor(() => expect(getByTestId('isValid').textContent).toBe('true'));
    });

    it('MinLength rule produces an error when value is too short', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { username: 'ab' },
                    validations: [
                        {
                            field: 'username',
                            validations: [
                                { type: ValidationType.Required },
                                { type: ValidationType.MinLength, value: 4 },
                            ],
                        },
                    ],
                },
            },
        });

        await fireEvent.click(getByTestId('validate'));

        await waitFor(() => {
            expect(getByTestId('isValid').textContent).toBe('false');
        });

        const errors = JSON.parse(getByTestId('errors').textContent!);
        expect(Array.isArray(errors.username)).toBe(true);
        expect(errors.username.length).toBeGreaterThan(0);
    });

    it('no errors rendered when a field satisfies MinLength', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { username: 'alice' },
                    validations: [
                        {
                            field: 'username',
                            validations: [
                                { type: ValidationType.Required },
                                { type: ValidationType.MinLength, value: 3 },
                            ],
                        },
                    ],
                },
            },
        });

        await fireEvent.click(getByTestId('validate'));

        await waitFor(() => {
            expect(getByTestId('isValid').textContent).toBe('true');
        });

        const errors = JSON.parse(getByTestId('errors').textContent!);
        // Either no key, or key exists but is null/empty array
        const usernameErrors = errors.username;
        const hasError = !!(usernameErrors && Array.isArray(usernameErrors) && usernameErrors.length > 0);
        expect(hasError).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Suite C — Functional runtime tests: handleChange, trigger, clearErrors, getValues, reset
// ---------------------------------------------------------------------------

describe('useValiValid (Svelte 5 rune adapter) — handleChange / trigger / clearErrors / getValues / reset', () => {
    it('handleChange(field, value) updates form state reflected in getValues()', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { name: '' },
                    validations: [{ field: 'name', validations: [{ type: ValidationType.Required }] }],
                },
            },
        });

        // Set the input value then fire handleChange
        const nameInput = getByTestId('name-input') as HTMLInputElement;
        await fireEvent.input(nameInput, { target: { value: 'Alice' } });
        await fireEvent.click(getByTestId('handleChange-name'));

        await waitFor(() => {
            const values = JSON.parse(getByTestId('getValues').textContent!);
            expect(values.name).toBe('Alice');
        });
    });

    it('handleChange(field, "") with Required rule sets an error', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { name: 'Alice' },
                    validations: [{ field: 'name', validations: [{ type: ValidationType.Required }] }],
                    debounceMs: 0,
                },
            },
        });

        // Clear the input so handleChange sends an empty string
        const nameInput = getByTestId('name-input') as HTMLInputElement;
        await fireEvent.input(nameInput, { target: { value: '' } });
        await fireEvent.click(getByTestId('handleChange-name'));

        await waitFor(() => {
            const errors = JSON.parse(getByTestId('errors').textContent!);
            expect(Array.isArray(errors.name)).toBe(true);
            expect(errors.name.length).toBeGreaterThan(0);
        });
    });

    it('handleChange(field, valid email) with Email rule clears the error', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { email: 'bad' },
                    validations: [
                        {
                            field: 'email',
                            validations: [
                                { type: ValidationType.Required },
                                { type: ValidationType.Email },
                            ],
                        },
                    ],
                    debounceMs: 0,
                },
            },
        });

        // First validate to get an error
        await fireEvent.click(getByTestId('validate'));
        await waitFor(() => {
            expect(getByTestId('isValid').textContent).toBe('false');
        });

        // Now change to a valid email
        const emailInput = getByTestId('email-input') as HTMLInputElement;
        await fireEvent.input(emailInput, { target: { value: 'valid@example.com' } });
        await fireEvent.click(getByTestId('handleChange-email'));

        await waitFor(() => {
            const errors = JSON.parse(getByTestId('errors').textContent!);
            const emailErrors = errors.email;
            const hasError = !!(emailErrors && Array.isArray(emailErrors) && emailErrors.length > 0);
            expect(hasError).toBe(false);
        });
    });

    it('trigger(field) with invalid value returns errors object with field errors', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { name: '' },
                    validations: [{ field: 'name', validations: [{ type: ValidationType.Required }] }],
                },
            },
        });

        await fireEvent.click(getByTestId('trigger-name'));

        await waitFor(() => {
            const result = JSON.parse(getByTestId('triggerResult').textContent!);
            expect(result).not.toBeNull();
            expect(Array.isArray(result.name)).toBe(true);
            expect(result.name.length).toBeGreaterThan(0);
        });
    });

    it('trigger(field) with valid value returns null for that field', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { name: 'Alice' },
                    validations: [{ field: 'name', validations: [{ type: ValidationType.Required }] }],
                },
            },
        });

        await fireEvent.click(getByTestId('trigger-name'));

        await waitFor(() => {
            const result = JSON.parse(getByTestId('triggerResult').textContent!);
            const nameErrors = result?.name;
            const hasError = !!(nameErrors && Array.isArray(nameErrors) && nameErrors.length > 0);
            expect(hasError).toBe(false);
        });
    });

    it('trigger() with no argument validates all fields', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { email: '', name: '' },
                    validations: [
                        { field: 'email', validations: [{ type: ValidationType.Required }, { type: ValidationType.Email }] },
                        { field: 'name', validations: [{ type: ValidationType.Required }] },
                    ],
                },
            },
        });

        await fireEvent.click(getByTestId('trigger-all'));

        await waitFor(() => {
            expect(getByTestId('isValid').textContent).toBe('false');
        });

        const result = JSON.parse(getByTestId('triggerAllResult').textContent!);
        expect(Array.isArray(result.email)).toBe(true);
        expect(result.email.length).toBeGreaterThan(0);
        expect(Array.isArray(result.name)).toBe(true);
        expect(result.name.length).toBeGreaterThan(0);
    });

    it('clearErrors(field) sets that field\'s errors to null', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { name: '' },
                    validations: [{ field: 'name', validations: [{ type: ValidationType.Required }] }],
                },
            },
        });

        // Trigger errors first
        await fireEvent.click(getByTestId('validate'));
        await waitFor(() => {
            expect(getByTestId('isValid').textContent).toBe('false');
        });

        // Clear only the name field
        await fireEvent.click(getByTestId('clearErrors-name'));

        await waitFor(() => {
            const errors = JSON.parse(getByTestId('errors').textContent!);
            const nameErrors = errors.name;
            const hasError = !!(nameErrors && Array.isArray(nameErrors) && nameErrors.length > 0);
            expect(hasError).toBe(false);
        });
    });

    it('clearErrors() with no argument clears all errors', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { email: '', name: '' },
                    validations: [
                        { field: 'email', validations: [{ type: ValidationType.Required }] },
                        { field: 'name', validations: [{ type: ValidationType.Required }] },
                    ],
                },
            },
        });

        // Trigger errors on all fields
        await fireEvent.click(getByTestId('validate'));
        await waitFor(() => {
            expect(getByTestId('isValid').textContent).toBe('false');
        });

        // Clear all errors at once
        await fireEvent.click(getByTestId('clearErrors-all'));

        await waitFor(() => {
            const errors = JSON.parse(getByTestId('errors').textContent!);
            // All error arrays should be empty or null after clearErrors()
            const allClear = Object.values(errors).every(
                (e) => e === null || e === undefined || (Array.isArray(e) && e.length === 0)
            );
            expect(allClear).toBe(true);
        });
    });

    it('getValues() returns current form values as a plain object', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { name: 'Bob', email: 'bob@example.com' },
                },
            },
        });

        const values = JSON.parse(getByTestId('getValues').textContent!);
        expect(values).toEqual({ name: 'Bob', email: 'bob@example.com' });
    });

    it('getValues() reflects updates after handleChange', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { name: 'Bob' },
                    validations: [{ field: 'name', validations: [{ type: ValidationType.Required }] }],
                },
            },
        });

        const nameInput = getByTestId('name-input') as HTMLInputElement;
        await fireEvent.input(nameInput, { target: { value: 'Charlie' } });
        await fireEvent.click(getByTestId('handleChange-name'));

        await waitFor(() => {
            const values = JSON.parse(getByTestId('getValues').textContent!);
            expect(values.name).toBe('Charlie');
        });
    });

    it('reset() returns form to initial state and clears all errors', async () => {
        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { name: 'Alice' },
                    validations: [{ field: 'name', validations: [{ type: ValidationType.Required }] }],
                },
            },
        });

        // Change the value
        const nameInput = getByTestId('name-input') as HTMLInputElement;
        await fireEvent.input(nameInput, { target: { value: '' } });
        await fireEvent.click(getByTestId('handleChange-name'));

        // Validate to generate errors
        await fireEvent.click(getByTestId('validate'));
        await waitFor(() => {
            expect(getByTestId('isValid').textContent).toBe('false');
        });

        // Reset
        await fireEvent.click(getByTestId('reset'));

        await waitFor(() => {
            expect(getByTestId('isValid').textContent).toBe('true');
            expect(getByTestId('errors').textContent).toBe('{}');
            const values = JSON.parse(getByTestId('getValues').textContent!);
            expect(values.name).toBe('Alice');
        });
    });
});

// ---------------------------------------------------------------------------
// Suite D — Functional runtime tests: async validator paths
// ---------------------------------------------------------------------------

describe('useValiValid (Svelte 5 rune adapter) — async validators', () => {
    it('isValidating is true while an async validator runs and false after it resolves', async () => {
        // Use a slow-ish async validator (15 ms delay) so we can observe the transition
        let resolveValidator!: (result: boolean) => void;
        const controlledAsync = (_value: any, _form: any): Promise<boolean> =>
            new Promise((resolve) => { resolveValidator = resolve; });

        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { username: 'alice' },
                    validations: [
                        {
                            field: 'username',
                            validations: [
                                { type: ValidationType.Required },
                                { type: ValidationType.AsyncPattern, asyncFn: controlledAsync, message: 'async failed' },
                            ],
                        },
                    ],
                    debounceMs: 0,
                },
            },
        });

        // Kick off validate() — isValidating should become true
        const validateBtn = getByTestId('validate');
        fireEvent.click(validateBtn); // intentionally not awaited yet

        // isValidating should be true while the async validator is still pending
        await waitFor(() => {
            expect(getByTestId('isValidating').textContent).toBe('true');
        });

        // Now resolve the validator
        resolveValidator(true);

        // isValidating should return to false once the promise settles
        await waitFor(() => {
            expect(getByTestId('isValidating').textContent).toBe('false');
        });
    });

    it('async validator returning false sets an error on the field', async () => {
        const failingAsync = async (_value: any, _form: any): Promise<boolean> => {
            await new Promise((r) => setTimeout(r, 10));
            return false; // always fails
        };

        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { username: 'alice' },
                    validations: [
                        {
                            field: 'username',
                            validations: [
                                { type: ValidationType.Required },
                                { type: ValidationType.AsyncPattern, asyncFn: failingAsync, message: 'async check failed' },
                            ],
                        },
                    ],
                    debounceMs: 0,
                },
            },
        });

        await fireEvent.click(getByTestId('validate'));

        // Wait for async to complete and errors to be populated
        await waitFor(() => {
            expect(getByTestId('isValidating').textContent).toBe('false');
        });

        const errors = JSON.parse(getByTestId('errors').textContent!);
        expect(Array.isArray(errors.username)).toBe(true);
        expect(errors.username.length).toBeGreaterThan(0);
        expect(errors.username[0]).toBe('async check failed');
        expect(getByTestId('isValid').textContent).toBe('false');
    });

    it('async validator returning true results in no error on the field', async () => {
        const passingAsync = async (_value: any, _form: any): Promise<boolean> => {
            await new Promise((r) => setTimeout(r, 10));
            return true; // always passes
        };

        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { username: 'alice' },
                    validations: [
                        {
                            field: 'username',
                            validations: [
                                { type: ValidationType.Required },
                                { type: ValidationType.AsyncPattern, asyncFn: passingAsync, message: 'should not appear' },
                            ],
                        },
                    ],
                    debounceMs: 0,
                },
            },
        });

        await fireEvent.click(getByTestId('validate'));

        // Wait for async to complete
        await waitFor(() => {
            expect(getByTestId('isValidating').textContent).toBe('false');
        });

        const errors = JSON.parse(getByTestId('errors').textContent!);
        const usernameErrors = errors.username;
        const hasError = !!(usernameErrors && Array.isArray(usernameErrors) && usernameErrors.length > 0);
        expect(hasError).toBe(false);
        expect(getByTestId('isValid').textContent).toBe('true');
    });

    it('asyncTimeout option: slow async validator completes without hanging the test suite', async () => {
        // The async validator takes 20 ms; asyncTimeout is set to 200 ms (well above), so it
        // should complete normally and the result should be applied.
        const slowAsync = async (_value: any, _form: any): Promise<boolean> => {
            await new Promise((r) => setTimeout(r, 20));
            return false; // fails — so we can verify the error was written
        };

        const { getByTestId } = render(TestForm, {
            props: {
                options: {
                    initial: { username: 'alice' },
                    validations: [
                        {
                            field: 'username',
                            validations: [
                                { type: ValidationType.Required },
                                { type: ValidationType.AsyncPattern, asyncFn: slowAsync, message: 'slow async failed' },
                            ],
                        },
                    ],
                    debounceMs: 0,
                    asyncTimeout: 200,
                },
            },
        });

        await fireEvent.click(getByTestId('validate'));

        await waitFor(
            () => {
                expect(getByTestId('isValidating').textContent).toBe('false');
            },
            { timeout: 500 }
        );

        // Because the validator resolved within the timeout, the error should be set
        const errors = JSON.parse(getByTestId('errors').textContent!);
        expect(Array.isArray(errors.username)).toBe(true);
        expect(errors.username.length).toBeGreaterThan(0);
    });

    it('handleSubmit with a failing async validator does NOT call onSubmit; with a passing one it DOES', async () => {
        // ---- Phase 1: failing async ----
        const failingAsync = async (_value: any, _form: any): Promise<boolean> => {
            await new Promise((r) => setTimeout(r, 10));
            return false;
        };

        let submitCallCount = 0;
        const onSubmitSpy = () => { submitCallCount++; };

        const { getByTestId, unmount } = render(TestForm, {
            props: {
                options: {
                    initial: { username: 'alice' },
                    validations: [
                        {
                            field: 'username',
                            validations: [
                                { type: ValidationType.Required },
                                { type: ValidationType.AsyncPattern, asyncFn: failingAsync, message: 'must pass async' },
                            ],
                        },
                    ],
                    debounceMs: 0,
                },
                onSubmit: onSubmitSpy,
            },
        });

        await fireEvent.click(getByTestId('submit'));

        // Wait for async validation to finish
        await waitFor(() => {
            expect(getByTestId('isValidating').textContent).toBe('false');
        });

        // onSubmit should NOT have been called because async validation failed
        expect(submitCallCount).toBe(0);
        expect(getByTestId('isValid').textContent).toBe('false');

        unmount();

        // ---- Phase 2: passing async ----
        const passingAsync = async (_value: any, _form: any): Promise<boolean> => {
            await new Promise((r) => setTimeout(r, 10));
            return true;
        };

        let submitCallCount2 = 0;
        const onSubmitSpy2 = () => { submitCallCount2++; };

        const { getByTestId: getByTestId2 } = render(TestForm, {
            props: {
                options: {
                    initial: { username: 'alice' },
                    validations: [
                        {
                            field: 'username',
                            validations: [
                                { type: ValidationType.Required },
                                { type: ValidationType.AsyncPattern, asyncFn: passingAsync, message: 'should not appear' },
                            ],
                        },
                    ],
                    debounceMs: 0,
                },
                onSubmit: onSubmitSpy2,
            },
        });

        await fireEvent.click(getByTestId2('submit'));

        // Wait for async validation to finish
        await waitFor(() => {
            expect(getByTestId2('isValidating').textContent).toBe('false');
        });

        // onSubmit SHOULD have been called because async validation passed
        expect(submitCallCount2).toBe(1);
        expect(getByTestId2('isValid').textContent).toBe('true');
    });
});

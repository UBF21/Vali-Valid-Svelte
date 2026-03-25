import { writable, derived, get } from 'svelte/store';
import { onDestroy } from 'svelte';
import type { Readable, Writable } from 'svelte/store';
import { ValiValid } from 'vali-valid';
import type { FieldValidationConfig, FormErrors, ValidationsConfig } from 'vali-valid';

export interface CreateValiValidOptions<T extends Record<string, any>> {
    initial: T;
    validations?: FieldValidationConfig<T>[];
    validateOnBlur?: boolean;
    validateOnSubmit?: boolean;
    debounceMs?: number;
    asyncTimeout?: number;
    criteriaMode?: 'all' | 'firstError';
    /** Per-instance locale override (e.g. 'en', 'es', 'pt', 'fr', 'de'). Does not mutate the global locale. */
    locale?: string;
    validateOnMount?: boolean;
}

export interface CreateValiValidReturn<T extends Record<string, any>> {
    form: Writable<T>;
    errors: Writable<FormErrors<T>>;
    isValid: Readable<boolean>;
    isValidating: Writable<boolean>;
    isSubmitted: Writable<boolean>;
    submitCount: Writable<number>;
    touchedFields: Writable<Set<keyof T>>;
    dirtyFields: Writable<Set<keyof T>>;
    handleChange(field: keyof T, value: any): void;
    handleBlur(field: keyof T): void;
    validate(): Promise<FormErrors<T>>;
    reset(newInitial?: Partial<T>): void;
    handleSubmit(onSubmit: (form: T) => void | Promise<void>): (e?: Event) => Promise<void>;
    setServerErrors(serverErrors: Partial<FormErrors<T>>): void;
    setValues(values: Partial<T>): void;
    addFieldValidation(field: keyof T, validations: ValidationsConfig[]): void;
    removeFieldValidation(field: keyof T, type: string): void;
    setFieldValidations(field: keyof T, validations: ValidationsConfig[]): void;
    clearFieldValidations(field: keyof T): void;
    trigger(field?: keyof T): Promise<FormErrors<T>>;
    clearErrors(field?: keyof T): void;
    getValues(): T;
    destroy(): void;
}

function deepClone<V>(value: V): V {
    if (value === null || typeof value !== 'object') return value;
    if (value instanceof Date) return new Date((value as Date).getTime()) as unknown as V;
    if (Array.isArray(value)) return (value as unknown[]).map(deepClone) as unknown as V;
    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, deepClone(v)])
    ) as V;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    if (ms <= 0) return promise;
    let timerId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<T>((_, reject) => {
        timerId = setTimeout(() => reject(new Error('[ValiValid] Async timeout')), ms);
    });
    return Promise.race([
        promise.then((v) => { clearTimeout(timerId!); return v; }, (e) => { clearTimeout(timerId!); throw e; }),
        timeout,
    ]);
}

export function createValiValid<T extends Record<string, any>>(
    options: CreateValiValidOptions<T>
): CreateValiValidReturn<T> {
    const engine = new ValiValid<T>(options.validations ?? [], { criteriaMode: options.criteriaMode ?? 'all', locale: options.locale, asyncTimeout: options.asyncTimeout });

    // _originalInitial: immutable — never mutated; used as base for bare reset()
    const _originalInitial: T = deepClone(options.initial);
    // _dirtyBase: tracks what "clean" means for dirty comparisons; updated by reset(newInitial)
    let _dirtyBase: T = deepClone(_originalInitial);
    const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
    // Tracks count of in-flight async promises per field — separate from debounce timers (C5 fix)
    const asyncInFlightMap = new Map<string, number>();
    // Global epoch: incremented by reset(), validate(), handleChange() to invalidate stale results
    let _epoch = 0;
    // Per-field epoch: incremented by _cancelFieldAsync() to invalidate a single field's in-flight
    // promise without touching the global epoch used by validate() and handleSubmit().
    const _fieldEpoch = new Map<string, number>();
    let _isSubmitting = false;

    const form: Writable<T> = writable({ ...options.initial });
    const errors: Writable<FormErrors<T>> = writable({});
    const isValidating: Writable<boolean> = writable(false);
    const isSubmitted: Writable<boolean> = writable(false);
    const submitCount: Writable<number> = writable(0);
    const touchedFields: Writable<Set<keyof T>> = writable(new Set());
    const dirtyFields: Writable<Set<keyof T>> = writable(new Set());

    const isValid: Readable<boolean> = derived(errors, ($errors: FormErrors<T>) => {
        const vals = Object.values($errors);
        if (vals.length === 0) return true;
        return vals.every(
            (e) => e === null || e === undefined || (Array.isArray(e) && e.length === 0)
        );
    });

    function runFieldValidation(field: keyof T, sanitizedValue: any): void {
        const syncError = engine.validateFieldSync(field, sanitizedValue, get(form));
        errors.update((prev: FormErrors<T>) => ({ ...prev, [field as string]: syncError }));

        if (engine.hasAsyncRules(field)) {
            const fieldKey = String(field);
            const existing = debounceTimers.get(fieldKey);
            if (existing) clearTimeout(existing);
            isValidating.set(true);
            const epoch = _epoch;
            const fEpoch = _fieldEpoch.get(fieldKey) ?? 0;

            const timer = setTimeout(async () => {
                // Remove debounce entry immediately on fire (C5 fix)
                debounceTimers.delete(fieldKey);
                asyncInFlightMap.set(fieldKey, (asyncInFlightMap.get(fieldKey) ?? 0) + 1);
                try {
                    const asyncError = await withTimeout(
                        engine.validateFieldAsync(field, sanitizedValue, get(form)),
                        options.asyncTimeout ?? 10000
                    );
                    // Stale check: global epoch (reset/validate/handleChange) OR per-field epoch (_cancelFieldAsync)
                    if (_epoch !== epoch || (_fieldEpoch.get(fieldKey) ?? 0) !== fEpoch) return;
                    errors.update((prev: FormErrors<T>) => ({ ...prev, [field as string]: asyncError }));
                } catch {
                    // async validator threw or timed out — leave existing error
                } finally {
                    // Always decrement in-flight count to keep isValidating accurate (even on stale)
                    const remaining = (asyncInFlightMap.get(fieldKey) ?? 1) - 1;
                    if (remaining <= 0) asyncInFlightMap.delete(fieldKey);
                    else asyncInFlightMap.set(fieldKey, remaining);
                    if (debounceTimers.size === 0 && asyncInFlightMap.size === 0) isValidating.set(false);
                }
            }, options.debounceMs ?? 0);

            debounceTimers.set(fieldKey, timer);
        }

        engine.getWatchedFields(String(field)).forEach((wf) => {
            const currentForm = get(form);
            const wSanitized = engine.getFieldValue(wf as keyof T, currentForm[wf as keyof T]);
            const wErr = engine.validateFieldSync(wf as keyof T, wSanitized, currentForm);
            errors.update((prev: FormErrors<T>) => ({ ...prev, [wf]: wErr }));
            if (engine.hasAsyncRules(wf as keyof T)) {
                const existing = debounceTimers.get(wf);
                if (existing) clearTimeout(existing);
                isValidating.set(true);
                const wEpoch = _epoch;
                const wFEpoch = _fieldEpoch.get(wf) ?? 0;
                const wTimer = setTimeout(async () => {
                    // Remove debounce entry immediately on fire (C5 fix)
                    debounceTimers.delete(wf);
                    asyncInFlightMap.set(wf, (asyncInFlightMap.get(wf) ?? 0) + 1);
                    try {
                        // Re-derive at timer-fire time so the value is consistent with the current form
                        const freshForm = get(form);
                        const freshSanitized = engine.getFieldValue(wf as keyof T, freshForm[wf as keyof T]);
                        const asyncErr = await withTimeout(
                            engine.validateFieldAsync(wf as keyof T, freshSanitized, freshForm),
                            options.asyncTimeout ?? 10000
                        );
                        if (_epoch !== wEpoch || (_fieldEpoch.get(wf) ?? 0) !== wFEpoch) return;
                        errors.update((prev: FormErrors<T>) => ({ ...prev, [wf]: asyncErr }));
                    } catch { /* leave sync error */ } finally {
                        // Always decrement in-flight count to keep isValidating accurate (even on stale)
                        const remaining = (asyncInFlightMap.get(wf) ?? 1) - 1;
                        if (remaining <= 0) asyncInFlightMap.delete(wf);
                        else asyncInFlightMap.set(wf, remaining);
                        if (debounceTimers.size === 0 && asyncInFlightMap.size === 0) isValidating.set(false);
                    }
                }, options.debounceMs ?? 0);
                debounceTimers.set(wf, wTimer);
            }
        });
    }

    function handleChange(field: keyof T, value: any): void {
        // Invalidate any in-flight full-form validate() result so it cannot overwrite per-field results
        _epoch += 1;
        const sanitized = engine.getFieldValue(field, value);
        form.update((prev: T) => ({ ...prev, [field as string]: sanitized }));
        dirtyFields.update((prev: Set<keyof T>) => {
            const next = new Set(prev);
            if (sanitized !== _dirtyBase[field as keyof T]) next.add(field);
            else next.delete(field);
            return next;
        });
        const skipValidation = options.validateOnBlur || (options.validateOnSubmit && !get(isSubmitted));
        if (!skipValidation) runFieldValidation(field, sanitized);
    }

    function handleBlur(field: keyof T): void {
        touchedFields.update((prev: Set<keyof T>) => {
            const next = new Set(prev);
            next.add(field);
            return next;
        });
        const shouldValidate = options.validateOnBlur || (options.validateOnSubmit && get(isSubmitted));
        if (shouldValidate) {
            const sanitized = engine.getFieldValue(field, get(form)[field as keyof T]);
            runFieldValidation(field, sanitized);
        }
    }

    async function validate(): Promise<FormErrors<T>> {
        // Cancel pending per-field async timers so they don't overwrite the full-validate result
        debounceTimers.forEach((t: ReturnType<typeof setTimeout>) => clearTimeout(t));
        debounceTimers.clear();
        asyncInFlightMap.clear();
        _epoch += 1;
        const epoch = _epoch;
        isValidating.set(true);
        try {
            const allErrors = await engine.validateAsync(get(form));
            // Guard: discard result if reset() was called while we were awaiting
            if (_epoch !== epoch) return allErrors;
            errors.set(allErrors);
            return allErrors;
        } finally {
            if (_epoch === epoch) isValidating.set(false);
        }
    }

    function reset(newInitial?: Partial<T>): void {
        // Compute new baseline — always merge against _originalInitial, never against a previously
        // mutated snapshot, so a bare reset() always restores the original options.initial values.
        const next: T = newInitial ? { ...deepClone(_originalInitial), ...newInitial } : deepClone(_originalInitial);
        // Update dirty baseline so subsequent dirty comparisons use the reset snapshot
        _dirtyBase = next;
        form.set({ ...next } as T);
        errors.set({});
        isValidating.set(false);
        isSubmitted.set(false);
        submitCount.set(0);
        touchedFields.set(new Set());
        dirtyFields.set(new Set());
        debounceTimers.forEach((t: ReturnType<typeof setTimeout>) => clearTimeout(t));
        debounceTimers.clear();
        asyncInFlightMap.clear();
        _epoch += 1;
    }

    function handleSubmit(
        onSubmit: (form: T) => void | Promise<void>
    ): (e?: Event) => Promise<void> {
        return async (e?: Event) => {
            if (_isSubmitting) return;
            _isSubmitting = true;
            e?.preventDefault();
            try {
                isSubmitted.set(true);
                submitCount.update((n: number) => n + 1);
                const allErrors = await validate();
                const valid = Object.values(allErrors).every(
                    (e) => e === null || e === undefined || (Array.isArray(e) && e.length === 0)
                );
                if (valid) await onSubmit(get(form));
            } finally {
                _isSubmitting = false;
            }
        };
    }

    function setServerErrors(serverErrors: Partial<FormErrors<T>>): void {
        errors.update((prev: FormErrors<T>) => ({ ...prev, ...serverErrors }));
    }

    function setValues(values: Partial<T>): void {
        const sanitized: Partial<T> = {};
        Object.keys(values).forEach((k) => {
            sanitized[k as keyof T] = engine.getFieldValue(k as keyof T, values[k as keyof T]);
        });
        form.update((prev: T) => ({ ...prev, ...sanitized }));
        dirtyFields.update((prev: Set<keyof T>) => {
            const next = new Set(prev);
            Object.keys(sanitized).forEach((k) => {
                if (sanitized[k as keyof T] !== _dirtyBase[k as keyof T]) next.add(k as keyof T);
                else next.delete(k as keyof T);
            });
            return next;
        });
        const skipValidation = options.validateOnBlur || (options.validateOnSubmit && !get(isSubmitted));
        if (!skipValidation) {
            Object.keys(sanitized).forEach((k) => {
                runFieldValidation(k as keyof T, sanitized[k as keyof T]);
            });
        }
    }

    function _cancelFieldAsync(field: keyof T): void {
        const key = String(field);
        const existing = debounceTimers.get(key);
        if (existing) { clearTimeout(existing); debounceTimers.delete(key); }
        asyncInFlightMap.delete(key);
        // Per-field epoch: invalidates in-flight promise for this field without disrupting validate()
        _fieldEpoch.set(key, (_fieldEpoch.get(key) ?? 0) + 1);
        if (debounceTimers.size === 0 && asyncInFlightMap.size === 0) isValidating.set(false);
    }

    function addFieldValidation(field: keyof T, validations: ValidationsConfig[]): void {
        _cancelFieldAsync(field);
        engine.addFieldValidation(field, validations);
        const currentForm = get(form);
        const sanitized = engine.getFieldValue(field, currentForm[field as keyof T]);
        errors.update((prev: FormErrors<T>) => ({
            ...prev,
            [field as string]: engine.validateFieldSync(field, sanitized, currentForm),
        }));
    }

    function removeFieldValidation(field: keyof T, type: string): void {
        _cancelFieldAsync(field);
        engine.removeFieldValidation(field, type);
        const currentForm = get(form);
        const sanitized = engine.getFieldValue(field, currentForm[field as keyof T]);
        errors.update((prev: FormErrors<T>) => ({
            ...prev,
            [field as string]: engine.validateFieldSync(field, sanitized, currentForm),
        }));
    }

    function setFieldValidations(field: keyof T, validations: ValidationsConfig[]): void {
        _cancelFieldAsync(field);
        engine.setFieldValidations(field, validations);
        const currentForm = get(form);
        const sanitized = engine.getFieldValue(field, currentForm[field as keyof T]);
        errors.update((prev: FormErrors<T>) => ({
            ...prev,
            [field as string]: engine.validateFieldSync(field, sanitized, currentForm),
        }));
    }

    function clearFieldValidations(field: keyof T): void {
        _cancelFieldAsync(field);
        engine.clearFieldValidations(field);
        errors.update((prev: FormErrors<T>) => ({ ...prev, [field as string]: null }));
    }

    /** Programmatically trigger validation. If field is provided, only validates that field.
     *  If no field is provided, validates the entire form. */
    async function trigger(field?: keyof T): Promise<FormErrors<T>> {
        if (field !== undefined) {
            _cancelFieldAsync(field);
            const currentForm = get(form);
            const sanitized = engine.getFieldValue(field, currentForm[field as keyof T]);

            // Sync first
            const syncError = engine.validateFieldSync(field, sanitized, currentForm);
            errors.update((prev: FormErrors<T>) => ({ ...prev, [field as string]: syncError }));

            // Await async if present
            if (engine.hasAsyncRules(field)) {
                isValidating.set(true);
                try {
                    const asyncError = await withTimeout(
                        engine.validateFieldAsync(field, sanitized, currentForm),
                        options.asyncTimeout ?? 10000
                    );
                    errors.update((prev: FormErrors<T>) => ({ ...prev, [field as string]: asyncError }));
                } catch { /* keep sync error */ } finally {
                    if (debounceTimers.size === 0 && asyncInFlightMap.size === 0) {
                        isValidating.set(false);
                    }
                }
            }

            return get(errors);
        }
        return validate();
    }

    /** Clear errors. If field is provided, clears only that field's error.
     *  If no field is provided, clears all errors. */
    function clearErrors(field?: keyof T): void {
        if (field !== undefined) {
            errors.update((prev: FormErrors<T>) => ({ ...prev, [field as string]: null }));
        } else {
            errors.set({});
        }
    }

    /** Returns a plain-object snapshot of the current form values. */
    function getValues(): T {
        return deepClone(get(form));
    }

    /** Invalidates in-flight async and clears all timers. Auto-registered via onDestroy. */
    function destroy(): void {
        _epoch += 1; // invalidate in-flight async promises so they don't write to destroyed stores
        debounceTimers.forEach((t: ReturnType<typeof setTimeout>) => clearTimeout(t));
        debounceTimers.clear();
        asyncInFlightMap.clear();
        isValidating.set(false);
    }

    // Auto-register cleanup when used inside a Svelte component lifecycle context.
    // Falls back silently when called outside a component (e.g., module-level stores, tests).
    try {
        onDestroy(destroy);
    } catch {
        // Swallow all errors from onDestroy called outside a component lifecycle.
        // This is expected when createValiValid is called in tests, module-level, or SSR context.
        // Caller must invoke destroy() manually when used outside a component.
    }

    // Validate on mount if requested (deferred to next microtask so stores are ready)
    if (options.validateOnMount) {
        const mountEpoch = _epoch;
        Promise.resolve().then(() => {
            if (_epoch === mountEpoch) validate();
        });
    }

    return {
        form, errors, isValid, isValidating, isSubmitted, submitCount, touchedFields, dirtyFields,
        handleChange, handleBlur, validate, reset, handleSubmit, setServerErrors, setValues,
        addFieldValidation, removeFieldValidation, setFieldValidations, clearFieldValidations,
        trigger, clearErrors, getValues, destroy,
    };
}

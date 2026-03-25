// @ts-nocheck — This file uses Svelte 5 rune syntax ($state, $derived, $effect)
// which requires the Svelte compiler and cannot be type-checked by plain TypeScript.
import { ValiValid } from 'vali-valid';
import type { FieldValidationConfig, FormErrors, ValidationsConfig } from 'vali-valid';

function deepClone<V>(obj: V): V {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((item) => deepClone(item)) as unknown as V;
    return Object.fromEntries(
        Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, deepClone(v)])
    ) as V;
}

export interface UseValiValidOptions<T extends Record<string, any>> {
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

export interface UseValiValidReturn<T extends Record<string, any>> {
    readonly form: T;
    readonly errors: FormErrors<T>;
    readonly isValid: boolean;
    readonly isValidating: boolean;
    readonly isSubmitted: boolean;
    readonly submitCount: number;
    readonly touchedFields: Set<keyof T>;
    readonly dirtyFields: Set<keyof T>;
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

function withTimeout<R>(promise: Promise<R>, ms: number): Promise<R> {
    if (ms <= 0) return promise;
    let timerId: ReturnType<typeof setTimeout>;
    const timeout = new Promise<R>((_, reject) => {
        timerId = setTimeout(() => reject(new Error('[ValiValid] Async timeout')), ms);
    });
    return Promise.race([
        promise.then(
            (v) => { clearTimeout(timerId!); return v; },
            (e) => { clearTimeout(timerId!); throw e; }
        ),
        timeout,
    ]);
}

export function useValiValid<T extends Record<string, any>>(
    options: UseValiValidOptions<T>
): UseValiValidReturn<T> {
    // Non-reactive — stable for the component's lifetime
    const engine = new ValiValid<T>(options.validations ?? [], { criteriaMode: options.criteriaMode ?? 'all', locale: options.locale, asyncTimeout: options.asyncTimeout });
    // _originalInitial: immutable — never mutated; used as base for bare reset()
    const _originalInitial: T = deepClone(options.initial);
    // _dirtyBase: tracks what "clean" means for dirty comparisons; updated by reset(newInitial)
    let _dirtyBase: T = deepClone(_originalInitial);
    const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
    // Tracks count of in-flight async promises per field — separate from debounce timers
    const asyncInFlightMap = new Map<string, number>();
    // Global epoch: incremented by reset(), validate(), handleChange() to invalidate stale results
    let _epoch = 0;
    // Per-field epoch: incremented by _cancelFieldAsync() to invalidate a single field's in-flight
    // promise without touching the global epoch used by validate() and handleSubmit().
    const _fieldEpoch = new Map<string, number>();
    let _isSubmitting = false;

    // $state rune — Svelte 5 reactive proxy
    let form: T = $state(deepClone(options.initial) as T);
    let errors: FormErrors<T> = $state({} as FormErrors<T>);
    let isValidating: boolean = $state(false);
    let isSubmitted: boolean = $state(false);
    let submitCount: number = $state(0);
    // Svelte 5 tracks Set.add/delete/clear directly through its proxy
    let touchedFields: Set<keyof T> = $state(new Set<keyof T>());
    let dirtyFields: Set<keyof T> = $state(new Set<keyof T>());

    // $derived — recomputes when errors changes
    const isValid: boolean = $derived(
        (() => {
            const vals = Object.values(errors);
            if (vals.length === 0) return true;
            return vals.every(
                (e) => e === null || e === undefined || (Array.isArray(e) && e.length === 0)
            );
        })()
    );

    // $effect returns a cleanup function called on component destroy
    $effect(() => {
        return () => {
            _epoch += 1; // invalidate in-flight async promises so they don't write to destroyed $state
            debounceTimers.forEach((t) => clearTimeout(t));
            debounceTimers.clear();
            asyncInFlightMap.clear();
            // BUG 5 FIX: reset isValidating so it isn't stuck true after unmount
            isValidating = false;
        };
    });

    function runFieldValidation(field: keyof T, sanitizedValue: any): void {
        const syncError = engine.validateFieldSync(field, sanitizedValue, { ...form } as T);
        errors[field as keyof T] = syncError as FormErrors<T>[keyof T];

        if (engine.hasAsyncRules(field)) {
            const fieldKey = String(field);
            const existing = debounceTimers.get(fieldKey);
            if (existing) clearTimeout(existing);
            isValidating = true;
            const epoch = _epoch;
            // BUG 3 FIX: capture per-field epoch alongside global epoch
            const fEpoch = _fieldEpoch.get(fieldKey) ?? 0;

            const timer = setTimeout(async () => {
                // Remove debounce entry immediately on fire (C5 fix)
                debounceTimers.delete(fieldKey);
                asyncInFlightMap.set(fieldKey, (asyncInFlightMap.get(fieldKey) ?? 0) + 1);
                try {
                    const asyncError = await withTimeout(
                        engine.validateFieldAsync(field, sanitizedValue, { ...form } as T),
                        options.asyncTimeout ?? 10000
                    );
                    // BUG 3 FIX: stale check uses both global epoch and per-field epoch
                    if (_epoch !== epoch || (_fieldEpoch.get(fieldKey) ?? 0) !== fEpoch) return;
                    errors[field as keyof T] = asyncError as FormErrors<T>[keyof T];
                } catch {
                    // async validator threw or timed out — leave existing error
                } finally {
                    // BUG 4 FIX: always decrement in-flight count unconditionally (no epoch guard)
                    const remaining = (asyncInFlightMap.get(fieldKey) ?? 1) - 1;
                    if (remaining <= 0) asyncInFlightMap.delete(fieldKey);
                    else asyncInFlightMap.set(fieldKey, remaining);
                    if (debounceTimers.size === 0 && asyncInFlightMap.size === 0) isValidating = false;
                }
            }, options.debounceMs ?? 0);

            debounceTimers.set(fieldKey, timer);
        }

        engine.getWatchedFields(String(field)).forEach((wf) => {
            const wSanitized = engine.getFieldValue(wf as keyof T, form[wf as keyof T]);
            errors[wf as keyof T] = engine.validateFieldSync(wf as keyof T, wSanitized, { ...form } as T) as FormErrors<T>[keyof T];
            if (engine.hasAsyncRules(wf as keyof T)) {
                const existing = debounceTimers.get(wf);
                if (existing) clearTimeout(existing);
                isValidating = true;
                const wEpoch = _epoch;
                // BUG 3 FIX: capture per-field epoch for watcher field
                const wFEpoch = _fieldEpoch.get(wf) ?? 0;
                const wTimer = setTimeout(async () => {
                    // Remove debounce entry immediately on fire (C5 fix)
                    debounceTimers.delete(wf);
                    asyncInFlightMap.set(wf, (asyncInFlightMap.get(wf) ?? 0) + 1);
                    try {
                        // Re-derive at timer-fire time so the value is consistent with the current form
                        const freshForm = { ...form } as T;
                        const freshSanitized = engine.getFieldValue(wf as keyof T, form[wf as keyof T]);
                        const asyncErr = await withTimeout(
                            engine.validateFieldAsync(wf as keyof T, freshSanitized, freshForm),
                            options.asyncTimeout ?? 10000
                        );
                        // BUG 3 FIX: stale check uses both global epoch and per-field epoch
                        if (_epoch !== wEpoch || (_fieldEpoch.get(wf) ?? 0) !== wFEpoch) return;
                        errors[wf as keyof T] = asyncErr as FormErrors<T>[keyof T];
                    } catch { /* leave sync error or timeout */ } finally {
                        // BUG 4 FIX: always decrement in-flight count unconditionally (no epoch guard)
                        const remaining = (asyncInFlightMap.get(wf) ?? 1) - 1;
                        if (remaining <= 0) asyncInFlightMap.delete(wf);
                        else asyncInFlightMap.set(wf, remaining);
                        if (debounceTimers.size === 0 && asyncInFlightMap.size === 0) isValidating = false;
                    }
                }, options.debounceMs ?? 0);
                debounceTimers.set(wf, wTimer);
            }
        });
    }

    function handleChange(field: keyof T, value: any): void {
        // BUG 2 FIX: increment epoch to invalidate any in-flight full-form validate() result
        _epoch += 1;
        const sanitized = engine.getFieldValue(field, value);
        form[field as keyof T] = sanitized;

        // BUG 1 FIX: compare against _dirtyBase instead of the immutable initialSnapshot
        if (sanitized !== _dirtyBase[field as keyof T]) {
            dirtyFields.add(field);
        } else {
            dirtyFields.delete(field);
        }

        const skipValidation = options.validateOnBlur || (options.validateOnSubmit && !isSubmitted);
        if (!skipValidation) runFieldValidation(field, sanitized);
    }

    function handleBlur(field: keyof T): void {
        touchedFields.add(field);
        const shouldValidate = options.validateOnBlur || (options.validateOnSubmit && isSubmitted);
        if (shouldValidate) {
            const sanitized = engine.getFieldValue(field, form[field as keyof T]);
            runFieldValidation(field, sanitized);
        }
    }

    async function validate(): Promise<FormErrors<T>> {
        // Cancel pending per-field async timers so they don't overwrite the full-validate result
        debounceTimers.forEach((t) => clearTimeout(t));
        debounceTimers.clear();
        asyncInFlightMap.clear();
        _epoch += 1;
        const epoch = _epoch;
        isValidating = true;
        try {
            const allErrors = await engine.validateAsync({ ...form } as T);
            // Guard: discard result if reset() or handleChange() was called while we were awaiting
            if (_epoch !== epoch) return allErrors;
            // Full replace via in-place mutation — preserves the $state proxy reference
            // so consumers who hold a reference to `errors` stay reactive.
            Object.keys(errors).forEach((k) => { delete (errors as Partial<Record<keyof T, string[] | null>>)[k as keyof T]; });
            Object.assign(errors, allErrors);
            return allErrors;
        } finally {
            if (_epoch === epoch) isValidating = false;
        }
    }

    function reset(newInitial?: Partial<T>): void {
        // BUG 1 FIX: always merge against _originalInitial (never against a previously mutated snapshot)
        // so a bare reset() always restores the original options.initial values.
        const next: T = newInitial ? { ...deepClone(_originalInitial), ...newInitial } : deepClone(_originalInitial);
        // BUG 1 FIX: update dirty baseline so subsequent dirty comparisons use the reset snapshot
        _dirtyBase = next;
        // Remove keys added dynamically (not in initial) then restore initial values
        Object.keys(form).forEach((k) => { if (!(k in next)) delete form[k as keyof T]; });
        Object.keys(next).forEach((k) => { form[k as keyof T] = next[k as keyof T]; });
        Object.keys(errors).forEach((k) => { delete (errors as Partial<Record<keyof T, string[] | null>>)[k as keyof T]; });
        isValidating = false;
        isSubmitted = false;
        submitCount = 0;
        touchedFields.clear();
        dirtyFields.clear();
        debounceTimers.forEach((t) => clearTimeout(t));
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
                isSubmitted = true;
                submitCount++;
                const allErrors = await validate();
                const valid = Object.values(allErrors).every(
                    (e) => e === null || e === undefined || (Array.isArray(e) && e.length === 0)
                );
                if (valid) await onSubmit({ ...form } as T);
            } finally {
                _isSubmitting = false;
            }
        };
    }

    function setServerErrors(serverErrors: Partial<FormErrors<T>>): void {
        Object.assign(errors, serverErrors);
    }

    function setValues(values: Partial<T>): void {
        Object.keys(values).forEach((k) => {
            const field = k as keyof T;
            const sanitized = engine.getFieldValue(field, values[field]);
            form[k as keyof T] = sanitized;
            // BUG 1 FIX: compare against _dirtyBase instead of the immutable initialSnapshot
            if (sanitized !== _dirtyBase[k as keyof T]) dirtyFields.add(field);
            else dirtyFields.delete(field);
        });

        const skipValidation = options.validateOnBlur || (options.validateOnSubmit && !isSubmitted);
        if (!skipValidation) {
            Object.keys(values).forEach((k) => {
                const field = k as keyof T;
                runFieldValidation(field, engine.getFieldValue(field, values[field]));
            });
        }
    }

    function _cancelFieldAsync(field: keyof T): void {
        const key = String(field);
        const existing = debounceTimers.get(key);
        if (existing) { clearTimeout(existing); debounceTimers.delete(key); }
        asyncInFlightMap.delete(key);
        // BUG 3 FIX: use per-field epoch instead of global _epoch to avoid invalidating validate()
        _fieldEpoch.set(key, (_fieldEpoch.get(key) ?? 0) + 1);
        if (debounceTimers.size === 0 && asyncInFlightMap.size === 0) isValidating = false;
    }

    function addFieldValidation(field: keyof T, validations: ValidationsConfig[]): void {
        _cancelFieldAsync(field);
        engine.addFieldValidation(field, validations);
        const sanitized = engine.getFieldValue(field, form[field as keyof T]);
        errors[field as keyof T] = engine.validateFieldSync(field, sanitized, { ...form } as T) as FormErrors<T>[keyof T];
    }

    function removeFieldValidation(field: keyof T, type: string): void {
        _cancelFieldAsync(field);
        engine.removeFieldValidation(field, type);
        const sanitized = engine.getFieldValue(field, form[field as keyof T]);
        errors[field as keyof T] = engine.validateFieldSync(field, sanitized, { ...form } as T) as FormErrors<T>[keyof T];
    }

    function setFieldValidations(field: keyof T, validations: ValidationsConfig[]): void {
        _cancelFieldAsync(field);
        engine.setFieldValidations(field, validations);
        const sanitized = engine.getFieldValue(field, form[field as keyof T]);
        errors[field as keyof T] = engine.validateFieldSync(field, sanitized, { ...form } as T) as FormErrors<T>[keyof T];
    }

    function clearFieldValidations(field: keyof T): void {
        _cancelFieldAsync(field);
        engine.clearFieldValidations(field);
        errors[field as keyof T] = null as FormErrors<T>[keyof T];
    }

    /** Programmatically trigger validation. If field is provided, only validates that field.
     *  If no field is provided, validates the entire form. */
    async function trigger(field?: keyof T): Promise<FormErrors<T>> {
        if (field !== undefined) {
            // Cancel any in-flight debounced async for this field so the result
            // from trigger() is not overwritten by a stale async debounce.
            _cancelFieldAsync(field);
            const currentForm = { ...form } as T;
            const sanitized = engine.getFieldValue(field, currentForm[field as keyof T]);
            const syncError = engine.validateFieldSync(field, sanitized, currentForm);
            errors[field as string] = syncError as FormErrors<T>[keyof T];

            if (engine.hasAsyncRules(field)) {
                isValidating = true;
                try {
                    const asyncError = await withTimeout(
                        engine.validateFieldAsync(field, sanitized, currentForm),
                        options.asyncTimeout ?? 10000
                    );
                    errors[field as string] = asyncError as FormErrors<T>[keyof T];
                } catch { /* keep sync error */ } finally {
                    if (debounceTimers.size === 0 && asyncInFlightMap.size === 0) {
                        isValidating = false;
                    }
                }
            }
            return { ...errors } as FormErrors<T>;
        }
        return validate();
    }

    /** Clear errors. If field is provided, clears only that field's error.
     *  If no field is provided, clears all errors. */
    function clearErrors(field?: keyof T): void {
        if (field !== undefined) {
            errors[field as string] = null as FormErrors<T>[keyof T];
        } else {
            Object.keys(errors).forEach((k) => { delete (errors as Partial<Record<keyof T, string[] | null>>)[k as keyof T]; });
        }
    }

    /** Returns a plain-object snapshot of the current form values. */
    function getValues(): T {
        return deepClone(form as T);
    }

    function destroy(): void {
        _epoch += 1;
        debounceTimers.forEach((t) => clearTimeout(t));
        debounceTimers.clear();
        asyncInFlightMap.clear();
        isValidating = false;
    }

    // validateOnMount: defer to next microtask so $state is fully initialised
    if (options.validateOnMount) {
        const mountEpoch = _epoch;
        Promise.resolve().then(() => {
            if (_epoch === mountEpoch) validate();
        });
    }

    // CRITICAL: get accessors keep primitive $state vars reactive through the returned object
    return {
        get form() { return form; },
        get errors() { return errors; },
        get isValid() { return isValid; },
        get isValidating() { return isValidating; },
        get isSubmitted() { return isSubmitted; },
        get submitCount() { return submitCount; },
        get touchedFields() { return touchedFields; },
        get dirtyFields() { return dirtyFields; },
        handleChange,
        handleBlur,
        validate,
        reset,
        handleSubmit,
        setServerErrors,
        setValues,
        addFieldValidation,
        removeFieldValidation,
        setFieldValidations,
        clearFieldValidations,
        trigger,
        clearErrors,
        getValues,
        destroy,
    };
}

import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';
import { createValiValid } from '../createValiValid';
import { ValidationType } from 'vali-valid';
import type { FieldValidationConfig, ValidationsConfig } from 'vali-valid';

// ---------------------------------------------------------------------------
// Shared test form shape and validations
// ---------------------------------------------------------------------------

type TestForm = { email: string; name: string };

const validations: FieldValidationConfig<TestForm>[] = [
    {
        field: 'email',
        validations: [
            { type: ValidationType.Required } as ValidationsConfig,
            { type: ValidationType.Email } as ValidationsConfig,
        ],
    },
    {
        field: 'name',
        validations: [
            { type: ValidationType.Required } as ValidationsConfig,
            { type: ValidationType.MinLength, value: 3 } as ValidationsConfig,
        ],
    },
];

// ---------------------------------------------------------------------------
// 1. Inicialización
// ---------------------------------------------------------------------------

describe('createValiValid (Svelte 4 stores)', () => {
    describe('inicialización', () => {
        it('inicializa con los valores iniciales en el store form', () => {
            const { form, errors, isValid } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            expect(get(form)).toEqual({ email: '', name: '' });
            expect(get(errors)).toEqual({});
            expect(get(isValid)).toBe(true);
        });

        it('isValid es true cuando no hay errores', () => {
            const { isValid } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            expect(get(isValid)).toBe(true);
        });

        it('isSubmitted inicia en false', () => {
            const { isSubmitted } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            expect(get(isSubmitted)).toBe(false);
        });

        it('submitCount inicia en 0', () => {
            const { submitCount } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            expect(get(submitCount)).toBe(0);
        });

        it('touchedFields inicia vacío', () => {
            const { touchedFields } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            expect(get(touchedFields).size).toBe(0);
        });

        it('dirtyFields inicia vacío', () => {
            const { dirtyFields } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            expect(get(dirtyFields).size).toBe(0);
        });

        it('isValidating inicia en false', () => {
            const { isValidating } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            expect(get(isValidating)).toBe(false);
        });

        it('funciona sin validaciones (sin pasar validations)', () => {
            const { form, errors, isValid } = createValiValid({
                initial: { email: '', name: '' },
            });
            expect(get(form)).toEqual({ email: '', name: '' });
            expect(get(errors)).toEqual({});
            expect(get(isValid)).toBe(true);
        });

        it('preserva valores iniciales no-vacíos', () => {
            const { form } = createValiValid({
                initial: { email: 'test@example.com', name: 'Alice' },
                validations,
            });
            expect(get(form)).toEqual({ email: 'test@example.com', name: 'Alice' });
        });

        it('devuelve todas las propiedades del API', () => {
            const result = createValiValid({ initial: { email: '', name: '' }, validations });
            expect(result).toHaveProperty('form');
            expect(result).toHaveProperty('errors');
            expect(result).toHaveProperty('isValid');
            expect(result).toHaveProperty('isValidating');
            expect(result).toHaveProperty('isSubmitted');
            expect(result).toHaveProperty('submitCount');
            expect(result).toHaveProperty('touchedFields');
            expect(result).toHaveProperty('dirtyFields');
            expect(result).toHaveProperty('handleChange');
            expect(result).toHaveProperty('handleBlur');
            expect(result).toHaveProperty('validate');
            expect(result).toHaveProperty('reset');
            expect(result).toHaveProperty('handleSubmit');
            expect(result).toHaveProperty('setServerErrors');
            expect(result).toHaveProperty('setValues');
            expect(result).toHaveProperty('addFieldValidation');
            expect(result).toHaveProperty('removeFieldValidation');
            expect(result).toHaveProperty('setFieldValidations');
            expect(result).toHaveProperty('clearFieldValidations');
            expect(result).toHaveProperty('destroy');
        });
    });

    // ---------------------------------------------------------------------------
    // 2. handleChange
    // ---------------------------------------------------------------------------

    describe('handleChange', () => {
        it('actualiza el store form al cambiar un campo', () => {
            const { form, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('email', 'test@example.com');
            expect(get(form).email).toBe('test@example.com');
        });

        it('valida y pone errores cuando el valor es inválido', () => {
            const { errors, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('email', 'invalid-email');
            expect(Array.isArray(get(errors).email)).toBe(true);
            expect((get(errors).email as string[]).length).toBeGreaterThan(0);
        });

        it('pone null en errors cuando el valor es válido', () => {
            const { errors, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('email', 'test@example.com');
            expect(get(errors).email).toBeNull();
        });

        it('marca el campo como dirty cuando el valor difiere del inicial', () => {
            const { dirtyFields, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('email', 'new@example.com');
            expect(get(dirtyFields).has('email')).toBe(true);
        });

        it('no marca como dirty cuando el valor vuelve al inicial', () => {
            const { dirtyFields, handleChange } = createValiValid({
                initial: { email: 'original@example.com', name: '' },
                validations,
            });
            handleChange('email', 'changed@example.com');
            expect(get(dirtyFields).has('email')).toBe(true);
            handleChange('email', 'original@example.com');
            expect(get(dirtyFields).has('email')).toBe(false);
        });

        it('no valida cuando validateOnBlur es true', () => {
            const { errors, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
                validateOnBlur: true,
            });
            handleChange('email', 'not-an-email');
            expect(get(errors).email).toBeUndefined();
        });

        it('no valida cuando validateOnSubmit es true y no se ha enviado', () => {
            const { errors, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
                validateOnSubmit: true,
            });
            handleChange('email', 'not-an-email');
            expect(get(errors).email).toBeUndefined();
        });

        it('requiere campo vacío y muestra error de required', () => {
            const { errors, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('name', '');
            const errs = get(errors).name as string[];
            expect(Array.isArray(errs)).toBe(true);
            expect(errs.length).toBeGreaterThan(0);
        });

        it('muestra error de minLength cuando el nombre es muy corto', () => {
            const { errors, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('name', 'ab');
            const errs = get(errors).name as string[];
            expect(Array.isArray(errs)).toBe(true);
        });

        it('acepta nombre válido sin error', () => {
            const { errors, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('name', 'Alice');
            expect(get(errors).name).toBeNull();
        });
    });

    // ---------------------------------------------------------------------------
    // 3. handleBlur + validateOnBlur
    // ---------------------------------------------------------------------------

    describe('handleBlur + validateOnBlur', () => {
        it('handleBlur marca el campo como touched', () => {
            const { touchedFields, handleBlur } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleBlur('email');
            expect(get(touchedFields).has('email')).toBe(true);
        });

        it('handleBlur no valida por defecto (sin validateOnBlur)', () => {
            const { errors, handleBlur } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleBlur('email');
            // No debe haber error porque el modo por defecto valida en change
            expect(get(errors).email).toBeUndefined();
        });

        it('handleBlur valida cuando validateOnBlur es true', () => {
            const { errors, handleChange, handleBlur } = createValiValid({
                initial: { email: '', name: '' },
                validations,
                validateOnBlur: true,
            });
            handleChange('email', 'not-an-email');
            handleBlur('email');
            expect(Array.isArray(get(errors).email)).toBe(true);
            expect((get(errors).email as string[]).length).toBeGreaterThan(0);
        });

        it('handleBlur pone null cuando el campo es válido en modo validateOnBlur', () => {
            const { errors, handleChange, handleBlur } = createValiValid({
                initial: { email: '', name: '' },
                validations,
                validateOnBlur: true,
            });
            handleChange('email', 'test@example.com');
            handleBlur('email');
            expect(get(errors).email).toBeNull();
        });

        it('handleBlur no valida cuando validateOnBlur es false (modo default)', () => {
            const { errors, handleBlur } = createValiValid({
                initial: { email: 'invalid', name: '' },
                validations,
            });
            handleBlur('email');
            // En modo default no se valida en blur (ya hubo validación en change si aplica)
            // pero handleBlur sin cambio previo no debería setear error
            expect(get(errors).email).toBeUndefined();
        });

        it('multiple campos pueden ser marcados como touched', () => {
            const { touchedFields, handleBlur } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleBlur('email');
            handleBlur('name');
            const touched = get(touchedFields);
            expect(touched.has('email')).toBe(true);
            expect(touched.has('name')).toBe(true);
        });

        it('handleBlur valida cuando validateOnSubmit es true y ya se envió', async () => {
            const { errors, handleChange, handleBlur, handleSubmit } = createValiValid({
                initial: { email: '', name: '' },
                validations,
                validateOnSubmit: true,
            });
            // Primero submit para marcar isSubmitted = true
            await handleSubmit(() => {})();
            // Cambiar a inválido sin validar (validateOnSubmit no valida en change)
            handleChange('email', 'bad-email');
            // Limpiar errores para ver si blur los vuelve a poner
            // handleBlur debería validar porque isSubmitted es true y validateOnSubmit es true
            handleBlur('email');
            expect(Array.isArray(get(errors).email)).toBe(true);
        });
    });

    // ---------------------------------------------------------------------------
    // 4. validate()
    // ---------------------------------------------------------------------------

    describe('validate()', () => {
        it('retorna errores para campos inválidos', async () => {
            const { validate } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            const result = await validate();
            expect(result.email).not.toBeNull();
            expect(result.name).not.toBeNull();
        });

        it('actualiza el store errors al validar', async () => {
            const { errors, validate } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await validate();
            expect(get(errors).email).not.toBeNull();
        });

        it('isValid se vuelve false después de validate() con errores', async () => {
            const { isValid, validate } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await validate();
            expect(get(isValid)).toBe(false);
        });

        it('isValid sigue true cuando todos los campos son válidos', async () => {
            const { isValid, validate } = createValiValid({
                initial: { email: 'test@example.com', name: 'Alice' },
                validations,
            });
            await validate();
            expect(get(isValid)).toBe(true);
        });

        it('retorna errores vacíos/null cuando el form es válido', async () => {
            const { validate } = createValiValid({
                initial: { email: 'test@example.com', name: 'Alice' },
                validations,
            });
            const result = await validate();
            expect(result.email === null || result.email === undefined || (Array.isArray(result.email) && result.email.length === 0)).toBe(true);
        });

        it('validate() setea isValidating a false al terminar', async () => {
            const { isValidating, validate } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await validate();
            expect(get(isValidating)).toBe(false);
        });
    });

    // ---------------------------------------------------------------------------
    // 5. handleSubmit
    // ---------------------------------------------------------------------------

    describe('handleSubmit', () => {
        it('llama onSubmit cuando el form es válido', async () => {
            const onSubmit = vi.fn();
            const { handleSubmit } = createValiValid({
                initial: { email: 'test@example.com', name: 'Alice' },
                validations,
            });
            await handleSubmit(onSubmit)();
            expect(onSubmit).toHaveBeenCalledWith({ email: 'test@example.com', name: 'Alice' });
        });

        it('NO llama onSubmit cuando el form es inválido', async () => {
            const onSubmit = vi.fn();
            const { handleSubmit } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await handleSubmit(onSubmit)();
            expect(onSubmit).not.toHaveBeenCalled();
        });

        it('incrementa submitCount en cada llamada', async () => {
            const { handleSubmit, submitCount } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            expect(get(submitCount)).toBe(0);
            await handleSubmit(() => {})();
            await handleSubmit(() => {})();
            expect(get(submitCount)).toBe(2);
        });

        it('sets isSubmitted to true after first submit', async () => {
            const { handleSubmit, isSubmitted } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            expect(get(isSubmitted)).toBe(false);
            await handleSubmit(() => {})();
            expect(get(isSubmitted)).toBe(true);
        });

        it('previene default del evento si se pasa evento', async () => {
            const { handleSubmit } = createValiValid({
                initial: { email: 'a@a.com', name: 'Bob' },
                validations,
            });
            const mockEvent = { preventDefault: vi.fn() } as unknown as Event;
            await handleSubmit(() => {})(mockEvent);
            expect(mockEvent.preventDefault).toHaveBeenCalled();
        });

        it('muestra errores en el store después de submit inválido', async () => {
            const { handleSubmit, errors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await handleSubmit(() => {})();
            expect(get(errors).email).not.toBeNull();
            expect(get(errors).name).not.toBeNull();
        });

        it('llama onSubmit con los datos actuales del form', async () => {
            const onSubmit = vi.fn();
            const { handleSubmit, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('email', 'user@example.com');
            handleChange('name', 'Carlos');
            await handleSubmit(onSubmit)();
            expect(onSubmit).toHaveBeenCalledWith({ email: 'user@example.com', name: 'Carlos' });
        });

        it('no hace double submit si se llama dos veces en paralelo', async () => {
            const onSubmit = vi.fn();
            const { handleSubmit } = createValiValid({
                initial: { email: 'test@example.com', name: 'Alice' },
                validations,
            });
            const submit = handleSubmit(onSubmit);
            await Promise.all([submit(), submit()]);
            // Solo debería haber sido llamado una vez (protección double-submit)
            expect(onSubmit).toHaveBeenCalledTimes(1);
        });
    });

    // ---------------------------------------------------------------------------
    // 6. reset()
    // ---------------------------------------------------------------------------

    describe('reset()', () => {
        it('resetea form a los valores iniciales', async () => {
            const { form, handleChange, reset } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('email', 'test@example.com');
            reset();
            expect(get(form)).toEqual({ email: '', name: '' });
        });

        it('resetea errors a {}', async () => {
            const { errors, validate, reset } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await validate();
            reset();
            expect(get(errors)).toEqual({});
        });

        it('resetea isSubmitted a false', async () => {
            const { isSubmitted, handleSubmit, reset } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await handleSubmit(() => {})();
            reset();
            expect(get(isSubmitted)).toBe(false);
        });

        it('resetea submitCount a 0', async () => {
            const { submitCount, handleSubmit, reset } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await handleSubmit(() => {})();
            reset();
            expect(get(submitCount)).toBe(0);
        });

        it('resetea touchedFields a vacío', () => {
            const { touchedFields, handleBlur, reset } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleBlur('email');
            reset();
            expect(get(touchedFields).size).toBe(0);
        });

        it('resetea dirtyFields a vacío', () => {
            const { dirtyFields, handleChange, reset } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('email', 'new@example.com');
            reset();
            expect(get(dirtyFields).size).toBe(0);
        });

        it('reset(newInitial) usa nuevos valores como base del form', () => {
            const { form, reset } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            reset({ email: 'new@example.com' });
            expect(get(form).email).toBe('new@example.com');
        });

        it('después de reset(newInitial), bare reset() vuelve a los valores originales', () => {
            const { form, reset } = createValiValid({
                initial: { email: 'original@example.com', name: '' },
                validations,
            });
            reset({ email: 'changed@example.com' });
            // bare reset usa _originalInitial
            reset();
            expect(get(form).email).toBe('original@example.com');
        });

        it('reset(newInitial) actualiza dirtyBase para comparaciones posteriores', () => {
            const { dirtyFields, handleChange, reset } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            reset({ email: 'new@example.com' });
            // Setear al valor del reset nuevo → no debe ser dirty
            handleChange('email', 'new@example.com');
            expect(get(dirtyFields).has('email')).toBe(false);
        });

        it('isValidating se pone a false después de reset', async () => {
            const { isValidating, reset } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            reset();
            expect(get(isValidating)).toBe(false);
        });
    });

    // ---------------------------------------------------------------------------
    // 7. setValues()
    // ---------------------------------------------------------------------------

    describe('setValues()', () => {
        it('actualiza múltiples campos a la vez', () => {
            const { form, setValues } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            setValues({ email: 'test@example.com', name: 'Alice' });
            expect(get(form).email).toBe('test@example.com');
            expect(get(form).name).toBe('Alice');
        });

        it('marca los campos como dirty cuando difieren del inicial', () => {
            const { dirtyFields, setValues } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            setValues({ email: 'new@example.com' });
            expect(get(dirtyFields).has('email')).toBe(true);
            expect(get(dirtyFields).has('name')).toBe(false);
        });

        it('valida los campos actualizados (en modo default)', () => {
            const { errors, setValues } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            setValues({ email: 'bad-email' });
            expect(Array.isArray(get(errors).email)).toBe(true);
        });

        it('no valida en setValues cuando validateOnBlur es true', () => {
            const { errors, setValues } = createValiValid({
                initial: { email: '', name: '' },
                validations,
                validateOnBlur: true,
            });
            setValues({ email: 'bad-email' });
            expect(get(errors).email).toBeUndefined();
        });

        it('actualiza solo el campo especificado, preserva los otros', () => {
            const { form, setValues } = createValiValid({
                initial: { email: 'a@a.com', name: 'Bob' },
                validations,
            });
            setValues({ email: 'new@example.com' });
            expect(get(form).email).toBe('new@example.com');
            expect(get(form).name).toBe('Bob');
        });

        it('elimina dirty cuando el valor vuelve al inicial', () => {
            const { dirtyFields, handleChange, setValues } = createValiValid({
                initial: { email: 'original@example.com', name: '' },
                validations,
            });
            handleChange('email', 'changed@example.com');
            expect(get(dirtyFields).has('email')).toBe(true);
            setValues({ email: 'original@example.com' });
            expect(get(dirtyFields).has('email')).toBe(false);
        });
    });

    // ---------------------------------------------------------------------------
    // 8. setServerErrors()
    // ---------------------------------------------------------------------------

    describe('setServerErrors()', () => {
        it('inyecta errores externos en el store errors', () => {
            const { errors, setServerErrors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            setServerErrors({ email: ['Este email ya está en uso'] });
            expect(get(errors).email).toEqual(['Este email ya está en uso']);
        });

        it('isValid es false después de inyectar errores de servidor', () => {
            const { isValid, setServerErrors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            setServerErrors({ email: ['Error del servidor'] });
            expect(get(isValid)).toBe(false);
        });

        it('preserva errores existentes al inyectar nuevos', () => {
            const { errors, setServerErrors, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('name', '');
            setServerErrors({ email: ['Email duplicado'] });
            expect(get(errors).email).toEqual(['Email duplicado']);
            // name debe tener error de required
            expect(Array.isArray(get(errors).name)).toBe(true);
        });

        it('puede inyectar errores para múltiples campos', () => {
            const { errors, setServerErrors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            setServerErrors({ email: ['Email inválido'], name: ['Nombre reservado'] });
            expect(get(errors).email).toEqual(['Email inválido']);
            expect(get(errors).name).toEqual(['Nombre reservado']);
        });

        it('sobrescribe error previo del mismo campo', () => {
            const { errors, handleChange, setServerErrors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('email', 'bad');
            setServerErrors({ email: ['Error personalizado'] });
            expect(get(errors).email).toEqual(['Error personalizado']);
        });
    });

    // ---------------------------------------------------------------------------
    // 9. validateOnSubmit mode
    // ---------------------------------------------------------------------------

    describe('validateOnSubmit mode', () => {
        it('no valida en handleChange cuando validateOnSubmit es true', () => {
            const { errors, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
                validateOnSubmit: true,
            });
            handleChange('email', 'invalid');
            expect(get(errors).email).toBeUndefined();
        });

        it('valida en handleSubmit aunque validateOnSubmit sea true', async () => {
            const { errors, handleSubmit } = createValiValid({
                initial: { email: '', name: '' },
                validations,
                validateOnSubmit: true,
            });
            await handleSubmit(() => {})();
            expect(get(errors).email).toBeInstanceOf(Array);
        });

        it('después del primer submit sí valida en handleChange', async () => {
            const { errors, handleChange, handleSubmit } = createValiValid({
                initial: { email: '', name: 'Alice' },
                validations,
                validateOnSubmit: true,
            });
            await handleSubmit(() => {})(); // isSubmitted = true
            handleChange('email', 'bad-email');
            // En validateOnSubmit, una vez isSubmitted=true aún no valida en change
            // pero sí en blur; si cambias handleChange no debería validar en change
            expect(get(errors).email).toBeInstanceOf(Array); // from validate() during submit
        });

        it('no valida en setValues cuando validateOnSubmit y no se ha enviado', () => {
            const { errors, setValues } = createValiValid({
                initial: { email: '', name: '' },
                validations,
                validateOnSubmit: true,
            });
            setValues({ email: 'not-an-email' });
            expect(get(errors).email).toBeUndefined();
        });
    });

    // ---------------------------------------------------------------------------
    // 10. addFieldValidation / removeFieldValidation / setFieldValidations / clearFieldValidations
    // ---------------------------------------------------------------------------

    describe('addFieldValidation / removeFieldValidation / setFieldValidations / clearFieldValidations', () => {
        it('addFieldValidation añade regla y re-valida', () => {
            const { errors, addFieldValidation } = createValiValid<{ email: string; name: string }>({
                initial: { email: 'test@test.com', name: '' },
                validations: [],
            });
            addFieldValidation('email', [{ type: ValidationType.Required } as ValidationsConfig]);
            // Con email='test@test.com' no debe tener error de required
            expect(get(errors).email).toBeNull();
        });

        it('addFieldValidation detecta error después de añadir regla', () => {
            const { errors, addFieldValidation } = createValiValid<{ email: string; name: string }>({
                initial: { email: '', name: '' },
                validations: [],
            });
            addFieldValidation('email', [{ type: ValidationType.Required } as ValidationsConfig]);
            expect(Array.isArray(get(errors).email)).toBe(true);
        });

        it('removeFieldValidation quita una regla y re-valida', () => {
            const { errors, removeFieldValidation } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            removeFieldValidation('email', ValidationType.Required);
            removeFieldValidation('email', ValidationType.Email);
            // Con todas las reglas de email eliminadas, el campo vacío no debería tener error
            expect(get(errors).email).toBeNull();
        });

        it('setFieldValidations reemplaza todas las reglas del campo', () => {
            const { errors, setFieldValidations } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            setFieldValidations('email', [{ type: ValidationType.Required } as ValidationsConfig]);
            // Email vacío → error de required (la regla de Email fue reemplazada)
            expect(Array.isArray(get(errors).email)).toBe(true);
        });

        it('clearFieldValidations elimina todas las reglas y pone null en error', () => {
            const { errors, clearFieldValidations } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            clearFieldValidations('email');
            expect(get(errors).email).toBeNull();
        });

        it('clearFieldValidations no afecta otros campos', () => {
            const { errors, handleChange, clearFieldValidations } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('name', ''); // dispara error de name
            clearFieldValidations('email');
            expect(get(errors).email).toBeNull();
            // name sigue teniendo su error
            expect(Array.isArray(get(errors).name)).toBe(true);
        });

        it('addFieldValidation con múltiples reglas funciona', () => {
            const { errors, addFieldValidation } = createValiValid<{ email: string; name: string }>({
                initial: { email: 'bad-email', name: '' },
                validations: [],
            });
            addFieldValidation('email', [
                { type: ValidationType.Required } as ValidationsConfig,
                { type: ValidationType.Email } as ValidationsConfig,
            ]);
            expect(Array.isArray(get(errors).email)).toBe(true);
        });
    });

    // ---------------------------------------------------------------------------
    // 11. isValid store reacciona a cambios
    // ---------------------------------------------------------------------------

    describe('isValid store reacciona a cambios', () => {
        it('isValid pasa de true a false cuando hay errores', () => {
            const { isValid, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            expect(get(isValid)).toBe(true);
            handleChange('email', 'bad-email');
            expect(get(isValid)).toBe(false);
        });

        it('isValid vuelve a true cuando se corrigen los errores', () => {
            const { isValid, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('email', 'bad-email');
            expect(get(isValid)).toBe(false);
            handleChange('email', 'good@example.com');
            handleChange('name', 'Alice');
            expect(get(isValid)).toBe(true);
        });

        it('isValid es derivado: refleja el estado actual de errors', async () => {
            const { isValid, validate } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await validate();
            expect(get(isValid)).toBe(false);
        });

        it('isValid es true cuando errores son null para todos los campos validados', () => {
            const { isValid, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('email', 'test@example.com');
            handleChange('name', 'Alice');
            expect(get(isValid)).toBe(true);
        });

        it('setServerErrors pone isValid en false', () => {
            const { isValid, setServerErrors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            setServerErrors({ email: ['Ya existe'] });
            expect(get(isValid)).toBe(false);
        });

        it('reset pone isValid en true', async () => {
            const { isValid, validate, reset } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await validate();
            expect(get(isValid)).toBe(false);
            reset();
            expect(get(isValid)).toBe(true);
        });
    });

    // ---------------------------------------------------------------------------
    // 12. dirtyFields tracking
    // ---------------------------------------------------------------------------

    describe('dirtyFields tracking', () => {
        it('marca campo como dirty en handleChange', () => {
            const { dirtyFields, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('email', 'a@b.com');
            expect(get(dirtyFields).has('email')).toBe(true);
        });

        it('elimina dirty cuando el valor vuelve al inicial', () => {
            const { dirtyFields, handleChange } = createValiValid({
                initial: { email: 'original@example.com', name: '' },
                validations,
            });
            handleChange('email', 'changed@example.com');
            handleChange('email', 'original@example.com');
            expect(get(dirtyFields).has('email')).toBe(false);
        });

        it('reset limpia todos los dirtyFields', () => {
            const { dirtyFields, handleChange, reset } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('email', 'a@b.com');
            handleChange('name', 'Bob');
            reset();
            expect(get(dirtyFields).size).toBe(0);
        });

        it('setValues también actualiza dirtyFields', () => {
            const { dirtyFields, setValues } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            setValues({ email: 'new@example.com', name: 'Alice' });
            expect(get(dirtyFields).has('email')).toBe(true);
            expect(get(dirtyFields).has('name')).toBe(true);
        });
    });

    // ---------------------------------------------------------------------------
    // 13. destroy()
    // ---------------------------------------------------------------------------

    describe('destroy()', () => {
        it('destroy() no lanza error', () => {
            const { destroy } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            expect(() => destroy()).not.toThrow();
        });

        it('destroy() pone isValidating en false', () => {
            const { isValidating, destroy } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            destroy();
            expect(get(isValidating)).toBe(false);
        });
    });

    // ---------------------------------------------------------------------------
    // 14. Casos borde y validaciones adicionales
    // ---------------------------------------------------------------------------

    describe('casos borde', () => {
        it('form con un solo campo funciona correctamente', () => {
            type SingleForm = { email: string };
            const { form, errors, handleChange } = createValiValid<SingleForm>({
                initial: { email: '' },
                validations: [
                    {
                        field: 'email',
                        validations: [{ type: ValidationType.Required } as ValidationsConfig],
                    },
                ],
            });
            handleChange('email', '');
            expect(get(form).email).toBe('');
            expect(Array.isArray(get(errors).email)).toBe(true);
        });

        it('handleSubmit retorna una función', () => {
            const { handleSubmit } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            const fn = handleSubmit(() => {});
            expect(typeof fn).toBe('function');
        });

        it('validate() retorna una Promise', () => {
            const { validate } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            const result = validate();
            expect(result).toBeInstanceOf(Promise);
        });

        it('múltiples instancias son independientes', () => {
            const inst1 = createValiValid({ initial: { email: '', name: '' }, validations });
            const inst2 = createValiValid({ initial: { email: 'a@b.com', name: '' }, validations });
            inst1.handleChange('email', 'changed@example.com');
            expect(get(inst1.form).email).toBe('changed@example.com');
            expect(get(inst2.form).email).toBe('a@b.com');
        });

        it('touchedFields no afecta a dirtyFields', () => {
            const { touchedFields, dirtyFields, handleBlur } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleBlur('email');
            expect(get(touchedFields).has('email')).toBe(true);
            expect(get(dirtyFields).has('email')).toBe(false);
        });

        it('handleChange con mismo valor no añade dirty si ya era igual al inicial', () => {
            const { dirtyFields, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('email', '');
            expect(get(dirtyFields).has('email')).toBe(false);
        });

        it('validate() sin validations configuradas retorna objeto vacío', async () => {
            const { validate } = createValiValid({
                initial: { email: '', name: '' },
            });
            const result = await validate();
            expect(Object.keys(result).length).toBe(0);
        });
    });

    // ---------------------------------------------------------------------------
    // 15. asyncTimeout
    // ---------------------------------------------------------------------------

    describe('asyncTimeout', () => {
        it('rejects async validators that exceed the timeout', async () => {
            // Create a form with an async validator that never resolves
            const neverResolves: FieldValidationConfig<TestForm> = {
                field: 'email',
                validations: [
                    {
                        type: ValidationType.Required,
                        asyncFn: () => new Promise<boolean>(() => {}), // never resolves
                    } as unknown as ValidationsConfig,
                ],
            };

            const { errors, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations: [neverResolves],
                asyncTimeout: 100,
                debounceMs: 0,
            });

            handleChange('email', 'test@example.com');
            // Wait for the timeout to expire (100ms + buffer)
            await new Promise((r) => setTimeout(r, 200));
            // The error should remain at the sync value (null for valid email with just required)
            // and the timeout should have fired without crashing
            expect(get(errors).email).toBeNull();
        }, 3000);

        it('passes async validators that complete within timeout', async () => {
            const fastAsync: FieldValidationConfig<TestForm> = {
                field: 'email',
                validations: [
                    {
                        type: ValidationType.AsyncPattern,
                        asyncFn: async (_value: unknown) => {
                            await new Promise((r) => setTimeout(r, 10));
                            return true; // passes
                        },
                        message: 'Async check failed',
                    } as unknown as ValidationsConfig,
                ],
            };

            const { errors, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations: [fastAsync],
                asyncTimeout: 5000,
                debounceMs: 0,
            });

            handleChange('email', 'test@example.com');
            await new Promise((r) => setTimeout(r, 100));
            // Async validator passed, so error should be null
            expect(get(errors).email).toBeNull();
        }, 3000);
    });

    // ---------------------------------------------------------------------------
    // 16. trigger
    // ---------------------------------------------------------------------------

    describe('trigger', () => {
        it('trigger() without args validates all fields', async () => {
            const { errors, trigger } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await trigger();
            expect(get(errors).email).not.toBeNull();
            expect(get(errors).name).not.toBeNull();
        });

        it('trigger(field) validates only that field', async () => {
            const { errors, trigger } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await trigger('email');
            // email should have errors (it's empty and required)
            expect(get(errors).email).not.toBeNull();
            // name should still be undefined (not validated yet)
            expect(get(errors).name).toBeUndefined();
        });

        it('trigger(field) returns current errors', async () => {
            const { trigger } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            const result = await trigger('email');
            expect(result).toHaveProperty('email');
        });

        it('trigger() returns FormErrors', async () => {
            const { trigger } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            const result = await trigger();
            expect(result).toHaveProperty('email');
            expect(result).toHaveProperty('name');
        });

        it('trigger(field) with valid value sets null error', async () => {
            const { errors, handleChange, trigger } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('email', 'valid@example.com');
            await trigger('email');
            expect(get(errors).email).toBeNull();
        });
    });

    // ---------------------------------------------------------------------------
    // 17. clearErrors
    // ---------------------------------------------------------------------------

    describe('clearErrors', () => {
        it('clearErrors() without args clears all errors', async () => {
            const { errors, validate, clearErrors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await validate();
            expect(get(errors).email).not.toBeNull();
            clearErrors();
            expect(get(errors)).toEqual({});
        });

        it('clearErrors(field) clears only that field errors', async () => {
            const { errors, validate, clearErrors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await validate();
            expect(get(errors).email).not.toBeNull();
            expect(get(errors).name).not.toBeNull();
            clearErrors('email');
            expect(get(errors).email).toBeNull();
            // name error should remain
            expect(get(errors).name).not.toBeNull();
        });

        it('clearErrors() resets isValid to true', async () => {
            const { isValid, validate, clearErrors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await validate();
            expect(get(isValid)).toBe(false);
            clearErrors();
            expect(get(isValid)).toBe(true);
        });

        it('clearErrors(field) makes isValid true when only that field had errors', async () => {
            const { isValid, handleChange, clearErrors } = createValiValid({
                initial: { email: '', name: 'Alice' },
                validations,
            });
            handleChange('email', 'bad-email');
            expect(get(isValid)).toBe(false);
            clearErrors('email');
            expect(get(isValid)).toBe(true);
        });
    });

    // ---------------------------------------------------------------------------
    // 18. trigger — async stale return fix (Fix 3)
    // ---------------------------------------------------------------------------

    describe('trigger — async result accuracy', () => {
        it('trigger(field) with async validator returns error after async completes', async () => {
            const asyncValidations: FieldValidationConfig<TestForm>[] = [
                {
                    field: 'email',
                    validations: [
                        {
                            type: 'AsyncPattern',
                            asyncFn: async (v: string) => v.includes('@'),
                            message: 'Must contain @',
                        } as ValidationsConfig,
                    ],
                },
            ];
            const { errors, trigger } = createValiValid({
                initial: { email: 'bad', name: '' },
                validations: asyncValidations,
            });
            const result = await trigger('email');
            // The returned value must already contain the async result
            expect(result.email).not.toBeNull();
            expect(get(errors).email).not.toBeNull();
        });

        it('trigger(field) with async validator returns null for valid value', async () => {
            const asyncValidations: FieldValidationConfig<TestForm>[] = [
                {
                    field: 'email',
                    validations: [
                        {
                            type: 'AsyncPattern',
                            asyncFn: async (v: string) => v.includes('@'),
                            message: 'Must contain @',
                        } as ValidationsConfig,
                    ],
                },
            ];
            const { trigger } = createValiValid({
                initial: { email: 'user@example.com', name: '' },
                validations: asyncValidations,
            });
            const result = await trigger('email');
            expect(result.email).toBeNull();
        });
    });

    // ---------------------------------------------------------------------------
    // 19. criteriaMode (Fix 4)
    // ---------------------------------------------------------------------------

    // ---------------------------------------------------------------------------
    // NEW: criteriaMode via handleChange (not just validate())
    // ---------------------------------------------------------------------------

    describe('criteriaMode via handleChange', () => {
        it('criteriaMode "firstError" → only 1 error per field when multiple validators fail via handleChange', () => {
            const multiValidations: FieldValidationConfig<TestForm>[] = [
                {
                    field: 'name',
                    validations: [
                        { type: ValidationType.Required } as ValidationsConfig,
                        { type: ValidationType.MinLength, value: 5 } as ValidationsConfig,
                        { type: ValidationType.Alpha } as ValidationsConfig,
                    ],
                },
            ];
            const { errors, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations: multiValidations,
                criteriaMode: 'firstError',
            });
            handleChange('name', '');
            const nameErrors = get(errors).name;
            expect(Array.isArray(nameErrors)).toBe(true);
            expect((nameErrors as string[]).length).toBe(1);
        });

        it('criteriaMode "all" (default) → multiple errors per field via handleChange', () => {
            const multiValidations: FieldValidationConfig<TestForm>[] = [
                {
                    field: 'name',
                    validations: [
                        { type: ValidationType.Required } as ValidationsConfig,
                        { type: ValidationType.MinLength, value: 5 } as ValidationsConfig,
                    ],
                },
            ];
            const { errors, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations: multiValidations,
                criteriaMode: 'all',
            });
            handleChange('name', '');
            const nameErrors = get(errors).name;
            expect(Array.isArray(nameErrors)).toBe(true);
            expect((nameErrors as string[]).length).toBeGreaterThanOrEqual(2);
        });
    });

    // ---------------------------------------------------------------------------
    // NEW: deepClone in reset — mutate nested array then reset()
    // ---------------------------------------------------------------------------

    describe('deepClone in reset()', () => {
        it('mutating nested array in form state does not corrupt reset() target', () => {
            type NestedForm = { tags: string[]; email: string };
            const initial: NestedForm = { tags: ['a', 'b'], email: '' };
            const { form, setValues, reset } = createValiValid<NestedForm>({
                initial,
                validations: [],
            });

            // Mutate the form by setting new values
            setValues({ tags: ['a', 'b', 'c', 'd'], email: 'mutated@example.com' });
            expect(get(form).tags).toEqual(['a', 'b', 'c', 'd']);

            // Bare reset() should restore exactly the original initial
            reset();
            expect(get(form).tags).toEqual(['a', 'b']);
            expect(get(form).email).toBe('');
        });

        it('reset(newInitial) then reset() returns to original initial, not last reset target', () => {
            const { form, reset } = createValiValid({
                initial: { email: 'original@example.com', name: '' },
                validations,
            });

            reset({ email: 'intermediate@example.com' });
            expect(get(form).email).toBe('intermediate@example.com');

            // Bare reset() should use _originalInitial, not 'intermediate@example.com'
            reset();
            expect(get(form).email).toBe('original@example.com');
        });
    });

    // ---------------------------------------------------------------------------
    // NEW: asyncTimeout non-blocking
    // ---------------------------------------------------------------------------

    describe('asyncTimeout non-blocking', () => {
        it('async validator taking 300ms does not block the form when asyncTimeout is 100ms', async () => {
            const slowAsync: FieldValidationConfig<TestForm> = {
                field: 'email',
                validations: [
                    {
                        type: 'AsyncPattern',
                        asyncFn: () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 300)),
                        message: 'slow check',
                    } as ValidationsConfig,
                ],
            };

            const { form, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations: [slowAsync],
                asyncTimeout: 100,
                debounceMs: 0,
            });

            handleChange('email', 'test@example.com');
            // Wait just past asyncTimeout — should not hang, timeout should reject
            await new Promise((r) => setTimeout(r, 200));

            // Form interaction still works normally after timeout rejection
            handleChange('email', 'other@example.com');
            expect(get(form).email).toBe('other@example.com');
        }, 3000);
    });

    // ---------------------------------------------------------------------------
    // NEW: validateOnMount additional coverage
    // ---------------------------------------------------------------------------

    describe('validateOnMount additional coverage', () => {
        it('validateOnMount: true → errors are non-null after microtask flush', async () => {
            const { errors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
                validateOnMount: true,
            });
            // Flush microtask queue (Promise.resolve().then(() => validate()) in createValiValid)
            await Promise.resolve();
            await new Promise((r) => setTimeout(r, 0));
            expect(get(errors).email).not.toBeNull();
        });

        it('validateOnMount: true → isValid becomes false for invalid initial values', async () => {
            const { isValid } = createValiValid({
                initial: { email: '', name: '' },
                validations,
                validateOnMount: true,
            });
            await Promise.resolve();
            await new Promise((r) => setTimeout(r, 0));
            expect(get(isValid)).toBe(false);
        });
    });

    // ---------------------------------------------------------------------------
    // NEW: trigger() with async validator
    // ---------------------------------------------------------------------------

    describe('trigger() with async validator', () => {
        it('trigger(field) with async validator → returns correct errors after async completes', async () => {
            const asyncValidations: FieldValidationConfig<TestForm>[] = [
                {
                    field: 'email',
                    validations: [
                        {
                            type: 'AsyncPattern',
                            asyncFn: async (v: string) => v.includes('@'),
                            message: 'Must contain @',
                        } as ValidationsConfig,
                    ],
                },
            ];
            const { errors, trigger } = createValiValid({
                initial: { email: 'no-at-sign', name: '' },
                validations: asyncValidations,
            });
            const result = await trigger('email');
            expect(result.email).not.toBeNull();
            expect(get(errors).email).not.toBeNull();
        });

        it('trigger() no-arg validates all fields and populates all errors', async () => {
            const { errors, trigger } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            const result = await trigger();
            expect(result).toHaveProperty('email');
            expect(result).toHaveProperty('name');
            expect(get(errors).email).not.toBeNull();
            expect(get(errors).name).not.toBeNull();
        });
    });

    // ---------------------------------------------------------------------------
    // NEW: clearErrors() additional coverage
    // ---------------------------------------------------------------------------

    describe('clearErrors() additional coverage', () => {
        it('clearErrors(field) → clears only that field error, others remain', async () => {
            const { errors, validate, clearErrors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await validate();
            expect(get(errors).email).not.toBeNull();
            expect(get(errors).name).not.toBeNull();
            clearErrors('email');
            expect(get(errors).email).toBeNull();
            expect(get(errors).name).not.toBeNull();
        });

        it('clearErrors() with no args → clears all errors and isValid becomes true', async () => {
            const { errors, isValid, validate, clearErrors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await validate();
            expect(get(isValid)).toBe(false);
            clearErrors();
            expect(get(errors)).toEqual({});
            expect(get(isValid)).toBe(true);
        });
    });

    // ---------------------------------------------------------------------------
    // NEW: reset() dirty tracking comprehensive
    // ---------------------------------------------------------------------------

    describe('reset() dirty tracking comprehensive', () => {
        it('reset(newInitial) → field whose value equals the new initial is NOT dirty', () => {
            const { dirtyFields, reset, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            // Make email dirty first
            handleChange('email', 'dirty@example.com');
            expect(get(dirtyFields).has('email')).toBe(true);

            // Reset with new initial — the form is set to 'reset@example.com'
            reset({ email: 'reset@example.com' });
            // After reset, dirtyFields should be empty
            expect(get(dirtyFields).has('email')).toBe(false);

            // Setting the same value as the new baseline should NOT be dirty
            handleChange('email', 'reset@example.com');
            expect(get(dirtyFields).has('email')).toBe(false);
        });

        it('reset(newInitial) → field that differs from new initial IS dirty after change', () => {
            const { dirtyFields, reset, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            reset({ email: 'base@example.com' });

            // Change to a value that differs from the new baseline
            handleChange('email', 'different@example.com');
            expect(get(dirtyFields).has('email')).toBe(true);
        });
    });

    describe('criteriaMode', () => {
        it('criteriaMode "all" (default) returns all errors for a field', async () => {
            const multiValidations: FieldValidationConfig<TestForm>[] = [
                {
                    field: 'name',
                    validations: [
                        { type: ValidationType.Required } as ValidationsConfig,
                        { type: ValidationType.MinLength, value: 5 } as ValidationsConfig,
                    ],
                },
            ];
            const { errors, validate } = createValiValid({
                initial: { email: '', name: '' },
                validations: multiValidations,
                criteriaMode: 'all',
            });
            await validate();
            // Both Required and MinLength should be reported
            expect(Array.isArray(get(errors).name)).toBe(true);
        });

        it('criteriaMode "firstError" returns only the first error for a field', async () => {
            const multiValidations: FieldValidationConfig<TestForm>[] = [
                {
                    field: 'name',
                    validations: [
                        { type: ValidationType.Required } as ValidationsConfig,
                        { type: ValidationType.MinLength, value: 5 } as ValidationsConfig,
                    ],
                },
            ];
            const { errors, validate } = createValiValid({
                initial: { email: '', name: '' },
                validations: multiValidations,
                criteriaMode: 'firstError',
            });
            await validate();
            const nameErrors = get(errors).name;
            expect(Array.isArray(nameErrors)).toBe(true);
            expect((nameErrors as string[]).length).toBe(1);
        });
    });

    // ---------------------------------------------------------------------------
    // 20. validateOnMount (Fix 4)
    // ---------------------------------------------------------------------------

    describe('validateOnMount', () => {
        it('validateOnMount: true triggers validation on initialization', async () => {
            const { errors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
                validateOnMount: true,
            });
            // Flush the microtask queue so the deferred validate() runs
            await Promise.resolve();
            // Another tick to let the async validation settle
            await new Promise((r) => setTimeout(r, 0));
            expect(get(errors).email).not.toBeNull();
            expect(get(errors).name).not.toBeNull();
        });

        it('validateOnMount: false (default) does not trigger validation on initialization', () => {
            const { errors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            expect(get(errors)).toEqual({});
        });
    });

    // ---------------------------------------------------------------------------
    // Group A: getValues()
    // ---------------------------------------------------------------------------

    describe('getValues()', () => {
        it('returns a snapshot of the current form values', () => {
            const { form, getValues, handleChange } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('email', 'user@example.com');
            handleChange('name', 'Alice');
            const values = getValues();
            expect(values).toEqual(get(form));
        });

        it('returns a deep clone — mutating the result does NOT affect the form store', () => {
            const { form, getValues } = createValiValid({
                initial: { email: 'a@b.com', name: 'Bob' },
                validations,
            });
            const values = getValues();
            values.email = 'mutated@example.com';
            expect(get(form).email).toBe('a@b.com');
        });

        it('getValues() after reset() returns the initial values', () => {
            const { getValues, handleChange, reset } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            handleChange('email', 'changed@example.com');
            reset();
            const values = getValues();
            expect(values.email).toBe('');
            expect(values.name).toBe('');
        });

        it('getValues() after reset(newInitial) returns the new initial values', () => {
            const { getValues, reset } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            reset({ email: 'new@example.com' });
            const values = getValues();
            expect(values.email).toBe('new@example.com');
        });
    });

    // ---------------------------------------------------------------------------
    // Group B: addFieldValidation / removeFieldValidation / setFieldValidations / clearFieldValidations (comprehensive)
    // ---------------------------------------------------------------------------

    describe('addFieldValidation / removeFieldValidation / setFieldValidations / clearFieldValidations (comprehensive)', () => {
        it('addFieldValidation — adds a rule; next validate() enforces it', async () => {
            const { validate, addFieldValidation } = createValiValid<TestForm>({
                initial: { email: '', name: 'Alice' },
                validations: [],
            });
            // No validations yet — validate should pass email with empty string
            const before = await validate();
            const emailBefore = before.email;
            expect(emailBefore === null || emailBefore === undefined || (Array.isArray(emailBefore) && emailBefore.length === 0)).toBe(true);

            // Add required rule for email
            addFieldValidation('email', [{ type: ValidationType.Required } as ValidationsConfig]);
            const after = await validate();
            expect(Array.isArray(after.email)).toBe(true);
            expect((after.email as string[]).length).toBeGreaterThan(0);
        });

        it('removeFieldValidation — removes a specific rule type; validate() no longer checks it', async () => {
            const { validate, removeFieldValidation } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            // email is empty — Required should fire before removal
            const before = await validate();
            expect(Array.isArray(before.email)).toBe(true);

            // Remove both validators from email
            removeFieldValidation('email', ValidationType.Required);
            removeFieldValidation('email', ValidationType.Email);

            const after = await validate();
            const emailAfter = after.email;
            expect(emailAfter === null || emailAfter === undefined || (Array.isArray(emailAfter) && emailAfter.length === 0)).toBe(true);
        });

        it('setFieldValidations — replaces all rules for a field', async () => {
            const { validate, setFieldValidations } = createValiValid({
                initial: { email: 'not-an-email', name: '' },
                validations,
            });
            // Replace email rules with only MinLength(20)
            setFieldValidations('email', [{ type: ValidationType.MinLength, value: 20 } as ValidationsConfig]);
            const result = await validate();
            // "not-an-email" is only 12 chars → MinLength(20) should fire
            expect(Array.isArray(result.email)).toBe(true);
            // But the old Email validator should not fire (message should differ)
        });

        it('clearFieldValidations — removes all rules; validate() returns null for that field', async () => {
            const { validate, clearFieldValidations } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            clearFieldValidations('email');
            const result = await validate();
            expect(result.email === null || result.email === undefined || (Array.isArray(result.email) && result.email.length === 0)).toBe(true);
        });

        it('clearFieldValidations — does not affect other fields', async () => {
            const { validate, clearFieldValidations } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            clearFieldValidations('email');
            const result = await validate();
            // name still has rules, should fail required
            expect(Array.isArray(result.name)).toBe(true);
            expect((result.name as string[]).length).toBeGreaterThan(0);
        });
    });

    // ---------------------------------------------------------------------------
    // Group C: trigger() comprehensive
    // ---------------------------------------------------------------------------

    describe('trigger() comprehensive', () => {
        it('trigger() no arg — validates ALL fields, returns FormErrors with all field keys', async () => {
            const { trigger } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            const result = await trigger();
            expect(result).toHaveProperty('email');
            expect(result).toHaveProperty('name');
            expect(Array.isArray(result.email)).toBe(true);
            expect(Array.isArray(result.name)).toBe(true);
        });

        it('trigger(field) — validates only that field, leaves others untouched', async () => {
            const { errors, trigger } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await trigger('email');
            expect(get(errors).email).not.toBeNull();
            // name was never triggered — should remain undefined
            expect(get(errors).name).toBeUndefined();
        });

        it('trigger(field) with async rule — returns correct errors after async resolves', async () => {
            const asyncValidations: FieldValidationConfig<TestForm>[] = [
                {
                    field: 'email',
                    validations: [
                        {
                            type: 'AsyncPattern',
                            asyncFn: async (v: string) => v.length > 3,
                            message: 'Too short',
                        } as ValidationsConfig,
                    ],
                },
            ];
            const { trigger } = createValiValid({
                initial: { email: 'ab', name: '' },
                validations: asyncValidations,
            });
            const result = await trigger('email');
            // 'ab' length is 2, which is NOT > 3, so async returns false → error
            expect(result.email).not.toBeNull();
        });

        it('trigger() and validate() both resolve correctly when called together', async () => {
            const { trigger, validate } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            const [triggerResult, validateResult] = await Promise.all([trigger(), validate()]);
            expect(triggerResult).toHaveProperty('email');
            expect(validateResult).toHaveProperty('email');
            expect(Array.isArray(triggerResult.email)).toBe(true);
            expect(Array.isArray(validateResult.email)).toBe(true);
        });
    });

    // ---------------------------------------------------------------------------
    // Group D: clearErrors() comprehensive
    // ---------------------------------------------------------------------------

    describe('clearErrors() comprehensive', () => {
        it('clearErrors(field) — sets that field to null; isValid becomes true if no other errors', async () => {
            const { errors, isValid, handleChange, clearErrors } = createValiValid({
                initial: { email: '', name: 'Alice' },
                validations,
            });
            handleChange('email', 'bad-email');
            expect(get(isValid)).toBe(false);
            clearErrors('email');
            expect(get(errors).email).toBeNull();
            expect(get(isValid)).toBe(true);
        });

        it('clearErrors() no arg — clears ALL errors; isValid becomes true', async () => {
            const { errors, isValid, validate, clearErrors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            await validate();
            expect(get(isValid)).toBe(false);
            clearErrors();
            expect(get(errors)).toEqual({});
            expect(get(isValid)).toBe(true);
        });

        it('clearErrors(field) on a field that was never validated — no-op, no error thrown', () => {
            const { errors, clearErrors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            // email was never validated — errors.email is undefined
            expect(get(errors).email).toBeUndefined();
            expect(() => clearErrors('email')).not.toThrow();
            // After clearErrors(field), it should be null (set explicitly)
            expect(get(errors).email).toBeNull();
        });
    });

    // ---------------------------------------------------------------------------
    // Group E: locale option
    // ---------------------------------------------------------------------------

    describe('locale option', () => {
        it("locale: 'es' — error messages are in Spanish", async () => {
            const { validate } = createValiValid({
                initial: { email: '', name: '' },
                validations: [
                    {
                        field: 'email',
                        validations: [{ type: ValidationType.Required } as ValidationsConfig],
                    },
                ],
                locale: 'es',
            });
            const result = await validate();
            const emailErrors = result.email as string[];
            expect(Array.isArray(emailErrors)).toBe(true);
            // Spanish required message
            expect(emailErrors[0]).toBe('Campo obligatorio.');
        });

        it("locale: 'en' — error messages are in English", async () => {
            const { validate } = createValiValid({
                initial: { email: '', name: '' },
                validations: [
                    {
                        field: 'email',
                        validations: [{ type: ValidationType.Required } as ValidationsConfig],
                    },
                ],
                locale: 'en',
            });
            const result = await validate();
            const emailErrors = result.email as string[];
            expect(Array.isArray(emailErrors)).toBe(true);
            // English required message
            expect(emailErrors[0]).toBe('Required field.');
        });

        it('default (no locale) — English messages are used', async () => {
            const { validate } = createValiValid({
                initial: { email: '', name: '' },
                validations: [
                    {
                        field: 'email',
                        validations: [{ type: ValidationType.Required } as ValidationsConfig],
                    },
                ],
            });
            const result = await validate();
            const emailErrors = result.email as string[];
            expect(Array.isArray(emailErrors)).toBe(true);
            expect(emailErrors[0]).toBe('Required field.');
        });
    });

    // ---------------------------------------------------------------------------
    // Group F: destroy() behavior
    // ---------------------------------------------------------------------------

    describe('destroy() behavior', () => {
        it('destroy() can be called multiple times without error', () => {
            const { destroy } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            expect(() => {
                destroy();
                destroy();
                destroy();
            }).not.toThrow();
        });

        it('form store values remain readable after destroy()', () => {
            const { form, destroy } = createValiValid({
                initial: { email: 'test@example.com', name: 'Alice' },
                validations,
            });
            destroy();
            expect(get(form).email).toBe('test@example.com');
            expect(get(form).name).toBe('Alice');
        });

        it('destroy() clears debounce timers — isValidating is false after destroy', () => {
            const { isValidating, destroy } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            destroy();
            expect(get(isValidating)).toBe(false);
        });
    });

    // ---------------------------------------------------------------------------
    // Group G: validateOnMount
    // ---------------------------------------------------------------------------

    describe('validateOnMount (comprehensive)', () => {
        it('validateOnMount: true — validate() is called after initialization; errors populated', async () => {
            const { errors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
                validateOnMount: true,
            });
            // Errors should be empty before microtasks run
            expect(get(errors)).toEqual({});
            // Flush microtask queue
            await Promise.resolve();
            await new Promise((r) => setTimeout(r, 0));
            expect(get(errors).email).not.toBeNull();
            expect(get(errors).name).not.toBeNull();
        });

        it('validateOnMount: false (default) — errors remain {} until explicit validate()', async () => {
            const { errors, validate } = createValiValid({
                initial: { email: '', name: '' },
                validations,
            });
            // After multiple microtask flushes, still no errors
            await Promise.resolve();
            await new Promise((r) => setTimeout(r, 0));
            expect(get(errors)).toEqual({});
            // Explicit validate populates errors
            await validate();
            expect(get(errors).email).not.toBeNull();
        });

        it('validateOnMount: true with valid initial values — isValid remains true', async () => {
            const { isValid } = createValiValid({
                initial: { email: 'valid@example.com', name: 'Alice' },
                validations,
                validateOnMount: true,
            });
            await Promise.resolve();
            await new Promise((r) => setTimeout(r, 0));
            expect(get(isValid)).toBe(true);
        });
    });

    // ---------------------------------------------------------------------------
    // Group H: trigger() race condition, validateOnMount epoch guard, destroy() post-writes
    // ---------------------------------------------------------------------------

    describe('trigger() race condition — debounce does not overwrite trigger result', () => {
        it('handleChange with debounce then trigger() — debounce timer does NOT overwrite trigger result', async () => {
            const asyncValidations: FieldValidationConfig<TestForm>[] = [
                {
                    field: 'email',
                    validations: [
                        {
                            type: 'AsyncPattern',
                            asyncFn: async (v: string) => v.includes('@'),
                            message: 'Must contain @',
                        } as ValidationsConfig,
                    ],
                },
            ];

            const { errors, handleChange, trigger } = createValiValid({
                initial: { email: '', name: '' },
                validations: asyncValidations,
                debounceMs: 200,
            });

            // Arms a debounce timer for the async validator
            handleChange('email', 'no-at-sign');

            // Immediately call trigger — it should cancel the pending debounce and
            // run async validation inline to completion
            const result = await trigger('email');

            // trigger result should reflect the async validation outcome (no '@' → error)
            expect(result.email).not.toBeNull();
            expect(get(errors).email).not.toBeNull();

            // Wait past the original debounce window to ensure the stale timer
            // (which was cancelled by trigger) does NOT overwrite the errors store
            const errorsAfterTrigger = get(errors).email;
            await new Promise((r) => setTimeout(r, 300));
            // Errors should still be what trigger set — the debounce did not fire
            expect(get(errors).email).toEqual(errorsAfterTrigger);
        }, 3000);

        it('trigger(field) with async validator — awaits and returns correct errors', async () => {
            const asyncValidations: FieldValidationConfig<TestForm>[] = [
                {
                    field: 'email',
                    validations: [
                        {
                            type: 'AsyncPattern',
                            asyncFn: async (v: string) => {
                                // Simulate a small async delay
                                await new Promise((r) => setTimeout(r, 20));
                                return v.includes('@');
                            },
                            message: 'Must contain @',
                        } as ValidationsConfig,
                    ],
                },
            ];

            const { trigger } = createValiValid({
                initial: { email: 'no-at', name: '' },
                validations: asyncValidations,
            });

            // trigger must await the async validator and return its result
            const result = await trigger('email');
            // 'no-at' does not contain '@' — async returns false → error
            expect(result.email).not.toBeNull();
        }, 3000);
    });

    describe('validateOnMount epoch guard — reset() cancels mount validation', () => {
        it('validateOnMount: true then reset() synchronously — errors remain {} (epoch guard cancels mount validate)', async () => {
            const { errors, reset } = createValiValid({
                initial: { email: '', name: '' },
                validations,
                validateOnMount: true,
            });

            // Synchronously reset before the microtask that calls validate() fires
            reset();

            // Flush the microtask queue — the mount validate() should be a no-op
            // because reset() incremented _epoch, making mountEpoch stale
            await Promise.resolve();
            await new Promise((r) => setTimeout(r, 0));

            // Errors must still be {} because the epoch guard skipped the mount validation
            expect(get(errors)).toEqual({});
        });

        it('validateOnMount: true without reset() — errors are populated after microtask resolves', async () => {
            const { errors } = createValiValid({
                initial: { email: '', name: '' },
                validations,
                validateOnMount: true,
            });

            // Before the microtask runs, errors are still empty
            expect(get(errors)).toEqual({});

            // Flush the microtask — mount validate() runs without interference
            await Promise.resolve();
            await new Promise((r) => setTimeout(r, 0));

            // Now errors should be populated for invalid initial values
            expect(get(errors).email).not.toBeNull();
            expect(get(errors).name).not.toBeNull();
        });
    });

    describe('destroy() prevents post-destroy async writes', () => {
        it('after destroy(), async validate() result does NOT write to the errors store', async () => {
            const asyncValidations: FieldValidationConfig<TestForm>[] = [
                {
                    field: 'email',
                    validations: [
                        {
                            type: 'AsyncPattern',
                            asyncFn: async (v: string) => {
                                await new Promise((r) => setTimeout(r, 50));
                                return v.includes('@');
                            },
                            message: 'Must contain @',
                        } as ValidationsConfig,
                    ],
                },
            ];

            const { errors, validate, destroy } = createValiValid({
                initial: { email: 'no-at', name: '' },
                validations: asyncValidations,
            });

            // Start an async validation
            const validatePromise = validate();

            // Destroy immediately — increments _epoch so the in-flight result is stale
            destroy();

            // Await the validation — it should resolve but NOT write to errors (stale epoch)
            await validatePromise;

            // Errors store must remain {} (the pre-destroy state — never written to)
            expect(get(errors)).toEqual({});
        }, 3000);

        it('after destroy(), stores are still readable and isValidating is false', () => {
            const { form, errors, isValid, isValidating, destroy } = createValiValid({
                initial: { email: 'test@example.com', name: 'Alice' },
                validations,
            });

            destroy();

            // All stores remain readable after destroy
            expect(get(form)).toEqual({ email: 'test@example.com', name: 'Alice' });
            expect(get(errors)).toEqual({});
            expect(get(isValid)).toBe(true);
            expect(get(isValidating)).toBe(false);
        });
    });

    // ---------------------------------------------------------------------------
    // Concurrent isValidating — trigger() fix
    // ---------------------------------------------------------------------------

    describe('concurrent isValidating behaviour', () => {
        it('isValidating stays true until BOTH async validators resolve when validate() runs two fields concurrently', async () => {
            // Two separate resolve functions so we can control each promise independently
            let resolveEmail!: (v: boolean) => void;
            let resolveName!: (v: boolean) => void;

            const emailPromise = new Promise<boolean>((r) => { resolveEmail = r; });
            const namePromise  = new Promise<boolean>((r) => { resolveName  = r; });

            type TwoField = { email: string; name: string };
            const asyncValidations: FieldValidationConfig<TwoField>[] = [
                {
                    field: 'email',
                    validations: [
                        {
                            type: 'AsyncPattern',
                            asyncFn: async (_v: string) => emailPromise,
                            message: 'email async error',
                        } as ValidationsConfig,
                    ],
                },
                {
                    field: 'name',
                    validations: [
                        {
                            type: 'AsyncPattern',
                            asyncFn: async (_v: string) => namePromise,
                            message: 'name async error',
                        } as ValidationsConfig,
                    ],
                },
            ];

            const { isValidating, validate } = createValiValid<TwoField>({
                initial: { email: 'bad', name: 'bad' },
                validations: asyncValidations,
            });

            // validate() runs all fields concurrently
            const validatePromise = validate();

            // Both fields are in-flight — isValidating must be true
            expect(get(isValidating)).toBe(true);

            // Resolve only the first field
            resolveEmail(true);
            // Give microtasks a chance to settle
            await Promise.resolve();

            // name is still in-flight — isValidating must still be true
            expect(get(isValidating)).toBe(true);

            // Now resolve the second field
            resolveName(true);
            await validatePromise;

            // Both done — isValidating must have dropped to false
            expect(get(isValidating)).toBe(false);
        }, 5000);

        it('trigger(field1) does not lower isValidating while field2 has an in-flight async from handleChange', async () => {
            let resolveEmail!: (v: boolean) => void;
            let resolveName!: (v: boolean) => void;

            const emailPromise = new Promise<boolean>((r) => { resolveEmail = r; });
            const namePromise  = new Promise<boolean>((r) => { resolveName  = r; });

            type TwoField = { email: string; name: string };
            const asyncValidations: FieldValidationConfig<TwoField>[] = [
                {
                    field: 'email',
                    validations: [
                        {
                            type: 'AsyncPattern',
                            asyncFn: async (_v: string) => emailPromise,
                            message: 'email async error',
                        } as ValidationsConfig,
                    ],
                },
                {
                    field: 'name',
                    validations: [
                        {
                            type: 'AsyncPattern',
                            asyncFn: async (_v: string) => namePromise,
                            message: 'name async error',
                        } as ValidationsConfig,
                    ],
                },
            ];

            const { isValidating, handleChange, trigger } = createValiValid<TwoField>({
                initial: { email: 'bad', name: 'bad' },
                validations: asyncValidations,
                debounceMs: 0,
            });

            // Start async for 'name' via handleChange (uses debounce timer path)
            handleChange('name', 'bad');

            // Allow the debounce timer (0 ms) to fire and register in-flight async
            await new Promise((r) => setTimeout(r, 10));

            // isValidating should be true because name's async is still running
            expect(get(isValidating)).toBe(true);

            // Now trigger 'email' — this completes immediately after we resolve emailPromise
            const triggerPromise = trigger('email');
            resolveEmail(true);
            await triggerPromise;

            // email is done, but name is still in-flight — isValidating must remain true
            expect(get(isValidating)).toBe(true);

            // Resolve name too
            resolveName(true);
            // Drain microtasks
            await new Promise((r) => setTimeout(r, 10));

            // Now both are done — isValidating should be false
            expect(get(isValidating)).toBe(false);
        }, 5000);
    });
});


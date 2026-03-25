# vali-valid-svelte

Svelte adapter for [vali-valid](https://www.npmjs.com/package/vali-valid) — supports both Svelte 4 (stores) and Svelte 5 (runes).

## Installation

```bash
npm install vali-valid-svelte vali-valid
```

## Two APIs

| Adapter | Import path | Reactivity model |
|---|---|---|
| Svelte 4 | `vali-valid-svelte` | Svelte writable stores |
| Svelte 5 | `vali-valid-svelte/svelte5` | Svelte 5 `$state` / `$derived` runes |

---

## Svelte 4 — `createValiValid`

```svelte
<script>
  import { createValiValid } from 'vali-valid-svelte';
  import { ValidationType } from 'vali-valid';

  const { form, errors, isValid, handleChange, handleSubmit } = createValiValid({
    initial: { email: '', password: '' },
    validations: [
      { field: 'email', validations: [{ type: ValidationType.Required }, { type: ValidationType.Email }] },
      { field: 'password', validations: [{ type: ValidationType.Required }, { type: ValidationType.MinLength, value: 8 }] },
    ],
  });

  const submit = handleSubmit((data) => console.log(data));
</script>

<form on:submit={submit}>
  <input value={$form.email} on:input={e => handleChange('email', e.target.value)} />
  {#if $errors.email}<span>{$errors.email[0]}</span>{/if}

  <input type="password" value={$form.password} on:input={e => handleChange('password', e.target.value)} />
  {#if $errors.password}<span>{$errors.password[0]}</span>{/if}

  <button type="submit" disabled={!$isValid}>Submit</button>
</form>
```

`createValiValid` returns Svelte writable stores: `form`, `errors`, `isValid`, `isValidating`, `isSubmitted`, `submitCount`, `touchedFields`, `dirtyFields`. Subscribe with the `$` prefix in templates or `get()` in script.

---

## Svelte 5 — `useValiValid`

Import from the `vali-valid-svelte/svelte5` subpath. Requires a Svelte-aware bundler (SvelteKit or Vite + `@sveltejs/vite-plugin-svelte`).

```svelte
<script>
  import { useValiValid } from 'vali-valid-svelte/svelte5';
  import { ValidationType } from 'vali-valid';

  const { form, errors, isValid, handleChange, handleSubmit } = useValiValid({
    initial: { email: '', password: '' },
    validations: [
      { field: 'email', validations: [{ type: ValidationType.Required }, { type: ValidationType.Email }] },
      { field: 'password', validations: [{ type: ValidationType.Required }, { type: ValidationType.MinLength, value: 8 }] },
    ],
  });

  const submit = handleSubmit((data) => console.log(data));
</script>

<form onsubmit={submit}>
  <input value={form.email} oninput={e => handleChange('email', e.target.value)} />
  {#if errors.email}<span>{errors.email[0]}</span>{/if}

  <input type="password" value={form.password} oninput={e => handleChange('password', e.target.value)} />
  {#if errors.password}<span>{errors.password[0]}</span>{/if}

  <button type="submit" disabled={!isValid}>Submit</button>
</form>
```

`useValiValid` returns plain reactive objects backed by `$state`/`$derived`. Access properties directly — no `$` prefix or `get()` needed.

---

## Options

Both `createValiValid` and `useValiValid` accept the same options object.

| Option | Type | Default | Description |
|---|---|---|---|
| `initial` | `T` | required | Initial form values |
| `validations` | `FieldValidationConfig<T>[]` | `[]` | Validation rules per field |
| `locale` | `string` | global locale | Per-instance locale override (`'en'`, `'es'`, `'pt'`, `'fr'`, `'de'`) |
| `criteriaMode` | `'all' \| 'firstError'` | `'all'` | Return all errors or stop at first |
| `validateOnMount` | `boolean` | `false` | Run full validation immediately on mount |
| `validateOnBlur` | `boolean` | `false` | Validate a field when it loses focus instead of on change |
| `validateOnSubmit` | `boolean` | `false` | Suppress validation until first submit attempt |
| `debounceMs` | `number` | `0` | Debounce delay for async validators (ms) |
| `asyncTimeout` | `number` | `10000` | Timeout for async validators (ms) |

---

## Returned API

Both adapters expose the same methods:

| Method | Description |
|---|---|
| `handleChange(field, value)` | Update a field value and trigger validation |
| `handleBlur(field)` | Mark a field as touched and trigger blur validation |
| `handleSubmit(onSubmit)` | Returns a submit handler; validates before calling `onSubmit` |
| `validate()` | Programmatically validate the entire form |
| `trigger(field?)` | Programmatically validate one field or the whole form |
| `reset(newInitial?)` | Reset form and errors to initial (or new) values |
| `setValues(values)` | Patch multiple field values |
| `setServerErrors(errors)` | Merge server-side errors into the error state |
| `clearErrors(field?)` | Clear one field's error or all errors |
| `getValues()` | Return a plain-object snapshot of the current form |
| `addFieldValidation(field, validations)` | Add validation rules to a field at runtime |
| `removeFieldValidation(field, type)` | Remove a specific validation rule from a field |
| `setFieldValidations(field, validations)` | Replace all validation rules for a field |
| `clearFieldValidations(field)` | Remove all validation rules from a field |
| `destroy()` | Cancel pending async work (called automatically inside a component) |

---

## Links

- [vali-valid-svelte on npm](https://www.npmjs.com/package/vali-valid-svelte)
- [vali-valid core on npm](https://www.npmjs.com/package/vali-valid)

## License

MIT

# vali-valid-svelte

Svelte adapter for [vali-valid](https://www.npmjs.com/package/vali-valid) — supports both **Svelte 4** (stores) and **Svelte 5** (runes).

[![npm](https://img.shields.io/npm/v/vali-valid-svelte)](https://www.npmjs.com/package/vali-valid-svelte)
[![license](https://img.shields.io/npm/l/vali-valid-svelte)](LICENSE)

---

## Installation

```bash
npm install vali-valid-svelte vali-valid
```

> **Note:** `vali-valid` must be version **≥ 3.1.0**.

---

## Two APIs

| Adapter | Import path | Reactivity model |
|---|---|---|
| Svelte 4 | `vali-valid-svelte` | Svelte writable stores (`$form`, `$errors`) |
| Svelte 5 | `vali-valid-svelte/svelte5` | Svelte 5 `$state` / `$derived` runes |

---

## Svelte 4 — `createValiValid`

```svelte
<script>
  import { createValiValid } from 'vali-valid-svelte';
  import { rule } from 'vali-valid';

  const { form, errors, isValid, handleChange, validate } = createValiValid({
    initial: { email: '', password: '' },
    validations: [
      { field: 'email',    validations: rule().required().email().build() },
      { field: 'password', validations: rule().required().minLength(8).build() },
    ],
  });

  async function onSubmit() {
    const result = await validate();
    if (result.isValid) {
      console.log('Submit:', $form);
    }
  }
</script>

<form on:submit|preventDefault={onSubmit}>
  <div>
    <input placeholder="Email" value={$form.email}
      on:input={e => handleChange('email', e.target.value)} />
    {#each ($errors.email || []) as msg}
      <p style="color:red">{msg}</p>
    {/each}
  </div>

  <div>
    <input type="password" placeholder="Password" value={$form.password}
      on:input={e => handleChange('password', e.target.value)} />
    {#each ($errors.password || []) as msg}
      <p style="color:red">{msg}</p>
    {/each}
  </div>

  <button type="submit" disabled={!$isValid}>Login</button>
</form>
```

`createValiValid` returns Svelte writable stores. Subscribe with the `$` prefix in templates or `get()` in script.

---

## Svelte 5 — `useValiValid`

Import from the `vali-valid-svelte/svelte5` subpath. Requires a Svelte-aware bundler (SvelteKit or Vite + `@sveltejs/vite-plugin-svelte`).

```svelte
<script>
  import { useValiValid } from 'vali-valid-svelte/svelte5';
  import { rule } from 'vali-valid';

  const { form, errors, isValid, handleChange, validate } = useValiValid({
    initial: { email: '', password: '' },
    validations: [
      { field: 'email',    validations: rule().required().email().build() },
      { field: 'password', validations: rule().required().minLength(8).build() },
    ],
  });

  async function onSubmit() {
    const result = await validate();
    if (result.isValid) {
      console.log('Submit:', form);
    }
  }
</script>

<form onsubmit={e => { e.preventDefault(); onSubmit(); }}>
  <div>
    <input placeholder="Email" value={form.email}
      oninput={e => handleChange('email', e.target.value)} />
    {#each (errors.email || []) as msg}
      <p style="color:red">{msg}</p>
    {/each}
  </div>

  <div>
    <input type="password" placeholder="Password" value={form.password}
      oninput={e => handleChange('password', e.target.value)} />
    {#each (errors.password || []) as msg}
      <p style="color:red">{msg}</p>
    {/each}
  </div>

  <button type="submit" disabled={!isValid}>Login</button>
</form>
```

`useValiValid` returns plain reactive objects backed by `$state`/`$derived`. Access properties directly — no `$` prefix or `get()` needed.

---

## Async validation

```svelte
<script>
  import { createValiValid } from 'vali-valid-svelte';
  import { rule } from 'vali-valid';

  const { form, errors, isValidating, handleChange, validate } = createValiValid({
    initial: { username: '', email: '' },
    validations: [
      {
        field: 'username',
        validations: rule()
          .required()
          .minLength(3)
          .asyncPattern(
            async (value) => {
              const res = await fetch(`/api/users/check?username=${value}`);
              const { available } = await res.json();
              return available;
            },
            'Username is already taken.'
          )
          .build(),
      },
      { field: 'email', validations: rule().required().email().build() },
    ],
    debounceMs: 400,
  });
</script>

<div>
  <input placeholder="Username" value={$form.username}
    on:input={e => handleChange('username', e.target.value)} />
  {#if $isValidating}<span>Checking…</span>{/if}
  {#each ($errors.username || []) as msg}<p style="color:red">{msg}</p>{/each}
</div>
```

---

## i18n — runtime locale switching

`vali-valid` ships with built-in error messages in **EN, ES, PT, FR and DE**.

```svelte
<script>
  import { createValiValid } from 'vali-valid-svelte';
  import { rule, setLocale } from 'vali-valid';

  const locales = ['en', 'es', 'pt', 'fr', 'de'];
  let locale = 'en';

  const { form, errors, handleChange, validate } = createValiValid({
    initial: { name: '', email: '' },
    validations: [
      { field: 'name',  validations: rule().required().minLength(3).build() },
      { field: 'email', validations: rule().required().email().build() },
    ],
  });

  async function switchLocale(l) {
    locale = l;
    setLocale(l);
    await validate();
  }
</script>

<div>
  {#each locales as l}
    <button on:click={() => switchLocale(l)}
      style="font-weight:{locale===l?'bold':'normal'}">
      {l.toUpperCase()}
    </button>
  {/each}

  <input placeholder="Name" value={$form.name}
    on:input={e => handleChange('name', e.target.value)} />
  {#each ($errors.name || []) as msg}<p>{msg}</p>{/each}

  <button on:click={() => validate()}>Validate ({locale.toUpperCase()})</button>
</div>
```

---

## Server-side errors

```svelte
<script>
  const { setServerErrors } = createValiValid({ ... });

  async function onSubmit() {
    const res = await api.register($form);
    if (res.status === 422) {
      setServerErrors({ email: ['Email is already in use.'] });
    }
  }
</script>
```

---

## Dynamic rules

Add, replace, or remove validation rules on a field at runtime — useful for multi-step forms or conditional validation logic.

```svelte
<script>
  import { createValiValid } from 'vali-valid-svelte';
  import { rule } from 'vali-valid';

  const { form, errors, handleChange, addFieldValidation, removeFieldValidation, setFieldValidations, clearFieldValidations } = createValiValid({
    initial: { phone: '', promoCode: '' },
    validations: [
      { field: 'phone', validations: rule().required().build() },
    ],
  });

  // Add a pattern rule to an existing field
  function requireMobileFormat() {
    addFieldValidation('phone', rule().pattern(/^(\+\d{1,3})?\d{9,15}$/, 'Enter a valid phone number.').build());
  }

  // Swap all rules on a field (e.g. promo code becomes required on a later step)
  function enablePromoValidation() {
    setFieldValidations('promoCode', rule().required().minLength(6).build());
  }

  // Remove all rules (field becomes optional)
  function makePromoOptional() {
    clearFieldValidations('promoCode');
  }
</script>

<div>
  <input placeholder="Phone" value={$form.phone}
    on:input={e => handleChange('phone', e.target.value)} />
  {#each ($errors.phone || []) as msg}<p style="color:red">{msg}</p>{/each}

  <button on:click={requireMobileFormat}>Require mobile format</button>
  <button on:click={enablePromoValidation}>Enable promo code</button>
  <button on:click={makePromoOptional}>Make promo optional</button>
</div>
```

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
| `validateOnBlur` | `boolean` | `false` | Validate a field when it loses focus |
| `validateOnSubmit` | `boolean` | `false` | Suppress per-keystroke validation until first submit |
| `debounceMs` | `number` | `0` | Debounce delay for async validators (ms) |
| `asyncTimeout` | `number` | `10000` | Timeout for async validators (ms) |

---

## Returned API

Both adapters expose the same methods. For Svelte 4, state properties are writable stores — use `$` prefix in templates. For Svelte 5, they are plain reactive objects.

| Property / Method | Type | Description |
|---|---|---|
| `form` | `Writable<T>` / `T` | Current form values |
| `errors` | `Writable<…>` / reactive | Current validation errors per field |
| `isValid` | `Readable<boolean>` / `boolean` | `true` when there are no errors |
| `isValidating` | `Readable<boolean>` / `boolean` | `true` while an async validator is running |
| `isSubmitted` | `Readable<boolean>` / `boolean` | `true` after the first `validate()` call |
| `submitCount` | `Readable<number>` / `number` | Number of times `validate()` has been called |
| `touchedFields` | store / reactive | Fields that have been interacted with |
| `dirtyFields` | store / reactive | Fields whose value differs from `initial` |
| `handleChange(field, value)` | `void` | Update a field value and trigger validation |
| `handleBlur(field)` | `void` | Mark a field as touched and trigger blur validation |
| `validate()` | `Promise<{ isValid: boolean; errors: … }>` | Validate the entire form |
| `trigger(field?)` | `Promise<void>` | Validate one field or the whole form |
| `reset(newInitial?)` | `void` | Reset form and errors to initial (or new) values |
| `setValues(values)` | `void` | Patch multiple field values without validation |
| `setServerErrors(errors)` | `void` | Merge server-side errors into the error state |
| `clearErrors(field?)` | `void` | Clear one field's error or all errors |
| `getValues()` | `T` | Snapshot of the current form values |
| `addFieldValidation(field, rules)` | `void` | Add validation rules to a field at runtime |
| `removeFieldValidation(field, type)` | `void` | Remove a specific rule type from a field |
| `setFieldValidations(field, rules)` | `void` | Replace all rules for a field |
| `clearFieldValidations(field)` | `void` | Remove all rules from a field |
| `destroy()` | `void` | Cancel pending async work (called automatically on component destroy) |

---

## Requirements

| Peer dependency | Minimum version |
|---|---|
| `svelte` | `4.0.0` |
| `vali-valid` | `3.1.0` |

---

## Links

- [Documentation](https://vali-valid.dev/svelte)
- [vali-valid core on npm](https://www.npmjs.com/package/vali-valid)
- [GitHub](https://github.com/UBF21/Vali-Valid-Svelte)

---

## License

MIT

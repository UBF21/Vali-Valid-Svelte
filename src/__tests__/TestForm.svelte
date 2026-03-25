<script lang="ts">
    import { useValiValid } from '../useValiValid.svelte.ts';
    import type { UseValiValidOptions } from '../useValiValid.svelte.ts';

    let { options, onSubmit = () => {} }: { options: UseValiValidOptions<any>, onSubmit?: () => void } = $props();

    const form = useValiValid(options);

    // Local state for controlled inputs and operation results
    let nameInput: string = $state('');
    let emailInput: string = $state('');
    let triggerResult: any = $state(undefined);
    let triggerAllResult: any = $state(undefined);
</script>

<div>
    <span data-testid="isValid">{form.isValid}</span>
    <span data-testid="errors">{JSON.stringify(form.errors)}</span>
    <span data-testid="submitCount">{form.submitCount}</span>
    <span data-testid="isValidating">{form.isValidating}</span>
    <span data-testid="getValues">{JSON.stringify(form.getValues())}</span>
    <span data-testid="triggerResult">{JSON.stringify(triggerResult)}</span>
    <span data-testid="triggerAllResult">{JSON.stringify(triggerAllResult)}</span>

    <button data-testid="validate" onclick={() => form.validate()}>validate</button>
    <button data-testid="reset" onclick={() => form.reset()}>reset</button>
    <button data-testid="submit" onclick={() => form.handleSubmit(onSubmit)()}>submit</button>

    <!-- handleChange controls -->
    <input data-testid="name-input" bind:value={nameInput} />
    <button data-testid="handleChange-name" onclick={() => form.handleChange('name', nameInput)}>handleChange name</button>

    <input data-testid="email-input" bind:value={emailInput} />
    <button data-testid="handleChange-email" onclick={() => form.handleChange('email', emailInput)}>handleChange email</button>

    <!-- trigger controls -->
    <button data-testid="trigger-name" onclick={async () => { triggerResult = await form.trigger('name'); }}>trigger name</button>
    <button data-testid="trigger-all" onclick={async () => { triggerAllResult = await form.trigger(); }}>trigger all</button>

    <!-- clearErrors controls -->
    <button data-testid="clearErrors-name" onclick={() => form.clearErrors('name')}>clearErrors name</button>
    <button data-testid="clearErrors-email" onclick={() => form.clearErrors('email')}>clearErrors email</button>
    <button data-testid="clearErrors-all" onclick={() => form.clearErrors()}>clearErrors all</button>
</div>

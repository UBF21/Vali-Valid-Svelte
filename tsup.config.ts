import { defineConfig } from 'tsup';

export default defineConfig([
    {
        entry: { index: 'src/index.ts' },
        outDir: 'dist/esm',
        format: ['esm'],
        dts: true,
        outExtension: () => ({ js: '.mjs' }),
        clean: true,
        splitting: false,
        sourcemap: true,
        treeshake: true,
        external: ['svelte', 'svelte/store', 'vali-valid'],
    },
    {
        entry: { index: 'src/index.ts' },
        outDir: 'dist/cjs',
        format: ['cjs'],
        dts: false,
        clean: false,
        splitting: false,
        sourcemap: true,
        external: ['svelte', 'svelte/store', 'vali-valid'],
    },
]);

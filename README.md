# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## License

Copyright (c) 2026 Ryan David Hartman.

This project — its source code, generated content tables and documentation — is licensed under
the [Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/)
(CC BY-SA 4.0). The full legal text is in [`LICENSE`](LICENSE).

CC BY-SA 4.0 is the license of the *Basic Fantasy Role-Playing Game* 4th Edition, so material
adapted from Basic Fantasy RPG can be included here and this project's own material can be
reused in Basic Fantasy-compatible works, provided attribution is given and adaptations are
shared under the same license.

### Attribution

Portions of the equipment, services and tavern price tables are adapted from the *Basic Fantasy
RPG Equipment Emporium*, © Chris Gonnerman and contributors, Basic Fantasy Role-Playing Game
project (https://www.basicfantasy.org), used under CC BY-SA 4.0.

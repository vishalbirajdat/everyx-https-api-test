# 🚀 Running Tests with pnpm

## 1. First run (creates snapshot file)

Run tests and generate snapshots:

```bash

pnpm test -- --updateSnapshot

```




2. Subsequent runs (compare with snapshot)

Run tests normally:

pnpm test
```bash

pnpm test

```


If the API response matches the snapshot → ✅ Test passes

If the API response differs → ❌ Test fails




3. Accept updated responses

If the API response changed intentionally, update snapshots:

```bash

pnpm test -- --updateSnapshot

```

## 2025-01-23 - High Frequency Array Allocation in Audio Loop
**Learning:** The `useAudioAnalysis` hook was creating multiple temporary `Uint8Array` slices (via `slice()`) and reducing them on every frame (20Hz). In a resource-constrained environment, this creates significant garbage collection pressure.
**Action:** Replace `slice().reduce()` chains with direct loop traversal using a helper function like `sumRange` to avoid allocation in hot paths.

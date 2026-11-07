# Local deepmerge security patch

Upstream: deepmerge 4.3.1, https://github.com/TehShrike/deepmerge (MIT).

Original standalone `dist/cjs.js` SHA-256: `2e5160f84a1141bd927264afe4d15766f1e6cf07daef182b37ff53fea121de7d`.

Reason: GHSA-gcqx-w48m-w2h4 / CVE-2026-93753 has no upstream fixed version as of 2026-11-07. This local package preserves the upstream implementation and adds a forbidden-key check for `__proto__`, `constructor` and `prototype` in both the target-copy loop and the source-copy loop. Tests cover JSON inputs, null-prototype sources, nesting, symbols, array options and the Hexo wrapper.

The root npm override routes every transitive `deepmerge` import to this package. Keep this provenance and the MIT license. Replace the override with an upstream release only after the regression tests pass. A clean npm audit does not replace those tests.

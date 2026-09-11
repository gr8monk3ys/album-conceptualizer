# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0](https://github.com/gr8monk3ys/album-conceptualizer/compare/v0.2.0...v0.3.0) (2026-08-29)


### Features

* **core:** harden api backends and production configuration ([b2a6158](https://github.com/gr8monk3ys/album-conceptualizer/commit/b2a6158e7222295f2027e1bf211e715d8bd0293b))
* **prod:** harden db schema routing and add live validation checks ([6f14ab2](https://github.com/gr8monk3ys/album-conceptualizer/commit/6f14ab2ea0caf9364bf4b7c76dab679659c4a7f7))
* production hardening and deps updates ([70226c8](https://github.com/gr8monk3ys/album-conceptualizer/commit/70226c8dd3a6d26c3efeead58476fb7ffa4e1ce3))
* ship AI copilot + harden backend for alpha ([#39](https://github.com/gr8monk3ys/album-conceptualizer/issues/39)) ([21da824](https://github.com/gr8monk3ys/album-conceptualizer/commit/21da82459b8476aa93d56e0a9c738463f896bf15))
* **storage:** default to SQLite backend with in-memory test isolation ([2ca0915](https://github.com/gr8monk3ys/album-conceptualizer/commit/2ca0915b52313b4b14c182609e2ffb38d519a8c7))
* **test:** add local web e2e backstop ([1a244a5](https://github.com/gr8monk3ys/album-conceptualizer/commit/1a244a5da6e5a6128be7bfa48076d77ed8c155d3))
* **web:** add album reference workspace ([087a5cc](https://github.com/gr8monk3ys/album-conceptualizer/commit/087a5ccd4c41fc3cd51571aa69f1633110be33da))
* **web:** add generator handoff packs ([c1cb9c8](https://github.com/gr8monk3ys/album-conceptualizer/commit/c1cb9c8daa6f818a8de2eae62c261556fe062e77))
* **web:** add onboarding funnel and workspace analytics ([fd12d3a](https://github.com/gr8monk3ys/album-conceptualizer/commit/fd12d3a335ab5b8b775aad6657102e416435111c))
* **web:** add voice and style bible ([21de640](https://github.com/gr8monk3ys/album-conceptualizer/commit/21de64080428207b6665107b2e57d5f2758cdb16))
* **web:** deepen album coherence review ([27ca744](https://github.com/gr8monk3ys/album-conceptualizer/commit/27ca744ed164392e0f0dc973f76476ca6408a0d0))
* **web:** harden shell quality gates and lighthouse audits ([cdf28a7](https://github.com/gr8monk3ys/album-conceptualizer/commit/cdf28a74978de6bfa83dc368edad8638686d8e6e))
* **web:** hit react-doctor 100 and formalize coverage suites ([0e444f5](https://github.com/gr8monk3ys/album-conceptualizer/commit/0e444f528e680f258757004bcc96957ae67c37f8))


### Bug Fixes

* **ci:** repair the CI pipeline end to end — install, collection, lint, tests ([#87](https://github.com/gr8monk3ys/album-conceptualizer/issues/87)) ([88a135b](https://github.com/gr8monk3ys/album-conceptualizer/commit/88a135b868a35eccb3f12c2226195f553fccca48))
* **ci:** repoint org workflows to the public reusable home ([#91](https://github.com/gr8monk3ys/album-conceptualizer/issues/91)) ([4c7aad1](https://github.com/gr8monk3ys/album-conceptualizer/commit/4c7aad110c066d1d832a859f1ce49b1e54f3f595))
* harden production readiness and backup flows ([#26](https://github.com/gr8monk3ys/album-conceptualizer/issues/26)) ([e2e9ea1](https://github.com/gr8monk3ys/album-conceptualizer/commit/e2e9ea19c92729d2cc8634b68c666d6defbf343f))
* **health:** import health functions to fix broken compat endpoints ([fb1029b](https://github.com/gr8monk3ys/album-conceptualizer/commit/fb1029bd8dd6942a647def4a4cd17180cf4741ca))
* pin hono&gt;=4.11.7 and lodash&gt;=4.17.23 to resolve XSS and prototype pollution vulnerabilities ([c043e7e](https://github.com/gr8monk3ys/album-conceptualizer/commit/c043e7e89c8dc126c074d1515f10e74f0858fa17))
* **prod:** wire engine service and resilient web auth ([0263e79](https://github.com/gr8monk3ys/album-conceptualizer/commit/0263e791659b5f880f3aa1028a18b507357106d9))
* **security:** pin minimatch and ajv to resolve ReDoS vulnerabilities ([3e40ba0](https://github.com/gr8monk3ys/album-conceptualizer/commit/3e40ba03c8330c924382f66ae5cecaf09221457a))
* timing attack, Stripe stub comment, coverage threshold ([baf30a5](https://github.com/gr8monk3ys/album-conceptualizer/commit/baf30a51b59a17cb115d128f99320ef910367baf))
* **web:** add shared utils helper for app alias imports ([dc0f9d0](https://github.com/gr8monk3ys/album-conceptualizer/commit/dc0f9d04b48cf5c85309549a57d9a7dbe7907d40))
* **web:** avoid prefetching health endpoint ([49ba277](https://github.com/gr8monk3ys/album-conceptualizer/commit/49ba277a1cd087fc0f5118037c44462e9d36d405))
* **web:** harden analytics tracking semantics ([c8b9069](https://github.com/gr8monk3ys/album-conceptualizer/commit/c8b906995099938ae267f4a9d8c726be870c8810))
* **web:** pin prisma schema and harden stripe billing errors ([194d6d5](https://github.com/gr8monk3ys/album-conceptualizer/commit/194d6d528180edda08b6eecd3059a978cd204113))
* **web:** preserve handoff section ordinals ([6177727](https://github.com/gr8monk3ys/album-conceptualizer/commit/6177727f41be91ee957ddfb6baffc5ae5f13bcae))
* **web:** resolve 17 Dependabot advisories in apps/web ([#94](https://github.com/gr8monk3ys/album-conceptualizer/issues/94)) ([7d57d00](https://github.com/gr8monk3ys/album-conceptualizer/commit/7d57d00fdbb69bd2fb2383d1efdc8d737d29f924))
* **web:** restore lint compatibility ([9c471cd](https://github.com/gr8monk3ys/album-conceptualizer/commit/9c471cd1fdbfd7abadd5a03f671d6be402adc92b))
* **web:** support explicit lighthouse base urls ([96f355c](https://github.com/gr8monk3ys/album-conceptualizer/commit/96f355c397a836c7c9ce11574f19e4b706670b7e))


### Dependencies

* **deps-dev:** update chromadb requirement ([#13](https://github.com/gr8monk3ys/album-conceptualizer/issues/13)) ([1812aac](https://github.com/gr8monk3ys/album-conceptualizer/commit/1812aac8b31738a607e23dbdc0fb2946b8d4bda5))
* **deps:** update python-dotenv requirement ([#12](https://github.com/gr8monk3ys/album-conceptualizer/issues/12)) ([e3bb7d4](https://github.com/gr8monk3ys/album-conceptualizer/commit/e3bb7d4eeb7383c919c0add46755cfbc66ccb87b))


### Documentation

* add alpha launch planning assets ([ea61b94](https://github.com/gr8monk3ys/album-conceptualizer/commit/ea61b94a530e257fc4c3bc468c753b93d9d3bf48))
* expand onboarding and architecture guides ([2c2bc1c](https://github.com/gr8monk3ys/album-conceptualizer/commit/2c2bc1c797955e7323c75cb686059b9c06dc5e77))
* sharpen concept album positioning and launch plan ([66f7759](https://github.com/gr8monk3ys/album-conceptualizer/commit/66f7759a0bac1fb30dee6a41e8cbe6da9a2ba1fa))

## [Unreleased]

## [0.2.0] - 2026-02-05
### Added
- Production deployment tooling: Caddy proxy, production compose, and ops scripts.
- Prometheus monitoring config and alert rules.
- Backup and restore scripts with a documented restore drill.
- API auth (API keys), rate limiting, quotas, metrics, and logging middleware.
- Persistent storage backends (file + SQLite) for API data.
- UI helpers, seed support, retry UX, and project persistence utilities.
- Expanded test coverage for UI helpers, exports, rate limits, and quotas.

### Changed
- Production documentation and configuration examples.

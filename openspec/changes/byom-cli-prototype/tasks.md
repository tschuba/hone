## 1. Prototype Harness and Capability Probes

- [ ] 1.1 Define and document the transport-agnostic runtime contract (`invoke(input) -> structured_output | classified_error`).
- [ ] 1.2 Implement capability probes for CLI and secondary provider paths and capture capability matrix fields.
- [ ] 1.3 Verify both adapters can be exercised through one harness entrypoint without transport-specific caller branching.

## 2. Scenario Matrix and Error Taxonomy

- [ ] 2.1 Execute the 40-run minimum matrix with 10 runs each for scenarios A/B/C/D.
- [ ] 2.2 Include at least two prompt classes per scenario and one parser-robustness negative prompt per scenario.
- [ ] 2.3 Build and validate error taxonomy mapping into fallback-allowed versus fallback-blocking classes.

## 3. Reliability, Safety, and Security Gates

- [ ] 3.1 Validate structured parse reliability threshold (>=95% overall and >=90% per provider with one retry max).
- [ ] 3.2 Measure SRE metrics (`success_rate`, `p95_latency`, `timeout_rate`, `fallback_rate`) and define breaker thresholds.
- [ ] 3.3 Validate CLI safety controls (allowlist, fixed path, no shell interpolation, env scrubbing, timeout/kill).
- [ ] 3.4 Run strict-gate parity tests to confirm transport-independent Sport Medic abstain/escalation behavior.

## 4. Decision and Rollout Readiness

- [ ] 4.1 Produce harness spec plus evidence report with metric tables and safety/security results.
- [ ] 4.2 Complete go/no-go review input package (summary, metrics, safety table, security checklist, risk register).
- [ ] 4.3 Record final decision: `CLI launch-supported` or `API-only launch; CLI deferred`.
